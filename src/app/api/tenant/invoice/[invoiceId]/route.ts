import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getCurrentUser } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Invoice from '@/models/Invoice';

interface PopulatedRoom {
  _id: string;
  roomNumber: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    const lineUserId = await requireAuth(request);
    const user = await getCurrentUser(lineUserId);
    const { invoiceId } = await params;

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await connectDB();

    const invoice = await Invoice.findOne({
      _id: invoiceId,
      tenantId: user._id,
    }).populate('roomId', 'roomNumber');

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const room = invoice.roomId as unknown as PopulatedRoom | null;

    // Calculate total of other charges
    const otherChargesTotal = invoice.otherCharges?.reduce(
      (sum: number, item: { amount: number }) => sum + item.amount,
      0
    ) || 0;

    return NextResponse.json({
      success: true,
      invoice: {
        id: invoice._id,
        month: invoice.month,
        year: invoice.year,
        rentAmount: invoice.rentAmount,
        waterAmount: invoice.waterAmount,
        electricityAmount: invoice.electricityAmount,
        waterUnits: invoice.waterUnits,
        electricityUnits: invoice.electricityUnits,
        previousWaterReading: invoice.previousWaterReading,
        previousElectricityReading: invoice.previousElectricityReading,
        currentWaterReading: invoice.currentWaterReading,
        currentElectricityReading: invoice.currentElectricityReading,
        otherCharges: invoice.otherCharges || [],
        otherChargesTotal,
        discount: invoice.discount || 0,
        totalAmount: invoice.totalAmount,
        paymentStatus: invoice.paymentStatus,
        dueDate: invoice.dueDate,
        paidAt: invoice.paidAt,
        paymentMethod: invoice.paymentMethod,
        paymentSlipUrl: invoice.paymentSlipUrl,
        paymentNote: invoice.paymentNote,
        roomNumber: room?.roomNumber,
        createdAt: invoice.createdAt,
      },
    });
  } catch (error: unknown) {
    console.error('Get invoice by ID error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
