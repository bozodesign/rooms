import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Invoice from '@/models/Invoice';
import User from '@/models/User';
import Room from '@/models/Room';
import { sendLineMessage, createReceiptFlexMessage } from '@/lib/line';

// GET - Get invoice details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    await requireAdmin(request);
    await connectDB();

    const { invoiceId } = await params;

    const invoice = await Invoice.findById(invoiceId)
      .populate('roomId', 'roomNumber floor waterMeterNumber electricityMeterNumber')
      .populate('tenantId', 'displayName phone pictureUrl')
      .populate('generatedBy', 'displayName')
      .populate('verifiedBy', 'displayName')
      .lean();

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    return NextResponse.json({ invoice });
  } catch (error: any) {
    console.error('Get invoice error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update invoice (e.g., mark as paid, update amounts)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    const admin = await requireAdmin(request);
    await connectDB();

    const { invoiceId } = await params;
    const body = await request.json();

    const invoice = await Invoice.findById(invoiceId);

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Update payment status
    if (body.paymentStatus !== undefined) {
      console.log('=== PAYMENT STATUS UPDATE ===');
      console.log('Invoice ID:', invoiceId);
      console.log('Current status:', invoice.paymentStatus);
      console.log('New status:', body.paymentStatus);
      console.log('Current paidAt:', invoice.paidAt);

      const wasNotPaidBefore = invoice.paymentStatus !== 'paid';
      console.log('Was not paid before:', wasNotPaidBefore);

      invoice.paymentStatus = body.paymentStatus;

      // If marked as paid, record payment date and send receipt
      const shouldSendReceipt = body.paymentStatus === 'paid' && wasNotPaidBefore;
      console.log('Should send receipt:', shouldSendReceipt);

      if (shouldSendReceipt) {
        invoice.paidAt = new Date();
        console.log('Invoice marked as paid, paidAt set to:', invoice.paidAt);

        // Get admin user for tracking
        const adminUser = await User.findOne({ lineUserId: admin, role: 'admin' });
        if (adminUser) {
          invoice.verifiedBy = adminUser._id;
        }

        // Add to tenant's payment history
        const tenant = await User.findById(invoice.tenantId);
        console.log('Tenant found:', tenant ? tenant._id : 'null', 'lineUserId:', tenant?.lineUserId);
        if (tenant) {
          // Calculate total other charges from array
          const otherChargesTotal = (invoice.otherCharges || []).reduce(
            (sum: number, item: { amount: number }) => sum + item.amount,
            0
          );
          tenant.paymentHistory.push({
            invoiceId: invoice._id,
            month: invoice.month,
            year: invoice.year,
            totalAmount: invoice.totalAmount,
            baseRent: invoice.rentAmount,
            waterAmount: invoice.waterAmount,
            waterUnits: invoice.waterUnits,
            electricityAmount: invoice.electricityAmount,
            electricityUnits: invoice.electricityUnits,
            otherCharges: otherChargesTotal,
            paymentDate: new Date(),
            paymentMethod: body.paymentMethod,
            notes: body.paymentNote,
          });
          await tenant.save();

          // Send receipt via LINE to tenant
          if (tenant.lineUserId) {
            console.log('Attempting to send receipt to tenant:', tenant.lineUserId);
            try {
              // Get room info for receipt
              const room = await Room.findById(invoice.roomId);
              const roomNumber = room?.roomNumber || 'N/A';
              const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL;
              console.log('Using baseUrl for receipt:', baseUrl);

              const receiptMessage = createReceiptFlexMessage({
                roomNumber,
                tenantName: tenant.displayName || tenant.fullName || 'ผู้เช่า',
                month: invoice.month,
                year: invoice.year,
                rentAmount: invoice.rentAmount,
                waterAmount: invoice.waterAmount,
                waterUnits: invoice.waterUnits,
                electricityAmount: invoice.electricityAmount,
                electricityUnits: invoice.electricityUnits,
                otherCharges: invoice.otherCharges || [],
                totalAmount: invoice.totalAmount,
                paidAt: invoice.paidAt,
              }, baseUrl);

              await sendLineMessage(tenant.lineUserId, [receiptMessage]);
              console.log('Receipt sent successfully to tenant:', tenant.lineUserId);
            } catch (lineError) {
              // Log error but don't fail the request - receipt sending is secondary
              console.error('Failed to send receipt via LINE:', lineError);
            }
          } else {
            console.log('Tenant does not have lineUserId, skipping receipt send');
          }
        }
      }
    }

    // Update other fields
    if (body.paymentMethod !== undefined) invoice.paymentMethod = body.paymentMethod;
    if (body.paymentNote !== undefined) invoice.paymentNote = body.paymentNote;
    if (body.paymentSlipUrl !== undefined) invoice.paymentSlipUrl = body.paymentSlipUrl;

    // Handle water/electricity inclusion toggles
    if (body.includeWater === false) {
      invoice.waterAmount = 0;
      invoice.waterUnits = 0;
    }
    if (body.includeElectricity === false) {
      invoice.electricityAmount = 0;
      invoice.electricityUnits = 0;
    }

    if (body.otherCharges !== undefined) {
      invoice.otherCharges = body.otherCharges;
    }

    if (body.discount !== undefined) {
      invoice.discount = body.discount;
    }

    // Recalculate total amount
    const otherChargesTotal = (invoice.otherCharges || []).reduce(
      (sum: number, item: { amount: number }) => sum + item.amount,
      0
    );
    invoice.totalAmount =
      invoice.rentAmount + invoice.waterAmount + invoice.electricityAmount + otherChargesTotal - (invoice.discount || 0);

    await invoice.save();

    return NextResponse.json({
      success: true,
      invoice,
    });
  } catch (error: any) {
    console.error('Update invoice error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete invoice
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    await requireAdmin(request);
    await connectDB();

    const { invoiceId } = await params;

    const invoice = await Invoice.findById(invoiceId);

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Don't allow deleting paid invoices
    if (invoice.paymentStatus === 'paid') {
      return NextResponse.json(
        { error: 'Cannot delete a paid invoice' },
        { status: 400 }
      );
    }

    await Invoice.findByIdAndDelete(invoiceId);

    return NextResponse.json({
      success: true,
      message: 'Invoice deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete invoice error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
