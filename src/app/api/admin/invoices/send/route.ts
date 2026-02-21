import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Invoice from '@/models/Invoice';
import SystemConfig, { CONFIG_KEYS } from '@/models/SystemConfig';
import { sendLineMessage, createInvoiceFlexMessage } from '@/lib/line';

interface PopulatedInvoice {
  _id: string;
  roomId: {
    _id: string;
    roomNumber: string;
    floor: number;
  };
  tenantId: {
    _id: string;
    lineUserId: string;
    displayName: string;
    fullName?: string;
  };
  month: number;
  year: number;
  waterUnits: number;
  electricityUnits: number;
  rentAmount: number;
  waterAmount: number;
  electricityAmount: number;
  otherCharges: { description: string; amount: number }[];
  totalAmount: number;
  paymentStatus: string;
  dueDate: Date;
}

// POST - Send invoice(s) via LINE
export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    await connectDB();

    const body = await request.json();
    const { invoiceIds } = body;

    if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return NextResponse.json({ error: 'Invoice IDs are required' }, { status: 400 });
    }

    // Get PromptPay settings from SystemConfig
    const [promptpayIdConfig, promptpayNameConfig] = await Promise.all([
      SystemConfig.findOne({ key: CONFIG_KEYS.PROMPTPAY_ID }),
      SystemConfig.findOne({ key: CONFIG_KEYS.PROMPTPAY_NAME }),
    ]);
    const promptpayNumber = promptpayIdConfig?.value;
    const promptpayName = promptpayNameConfig?.value;

    // Fetch invoices with populated data
    const invoices = await Invoice.find({ _id: { $in: invoiceIds } })
      .populate('roomId', 'roomNumber floor')
      .populate('tenantId', 'lineUserId displayName fullName')
      .lean() as unknown as PopulatedInvoice[];

    if (invoices.length === 0) {
      return NextResponse.json({ error: 'No invoices found' }, { status: 404 });
    }

    const results = {
      sent: 0,
      failed: 0,
      errors: [] as { invoiceId: string; error: string }[],
    };

    // Send each invoice
    for (const invoice of invoices) {
      try {
        if (!invoice.tenantId?.lineUserId) {
          results.failed++;
          results.errors.push({
            invoiceId: invoice._id,
            error: `Room ${invoice.roomId?.roomNumber}: Tenant has no LINE user ID`,
          });
          continue;
        }

        // Create flex message for the invoice
        const flexMessage = createInvoiceFlexMessage(
          {
            roomNumber: invoice.roomId?.roomNumber || '-',
            tenantName: invoice.tenantId?.fullName || invoice.tenantId?.displayName || '-',
            month: invoice.month,
            year: invoice.year,
            rentAmount: invoice.rentAmount,
            waterAmount: invoice.waterAmount,
            waterUnits: invoice.waterUnits,
            electricityAmount: invoice.electricityAmount,
            electricityUnits: invoice.electricityUnits,
            otherCharges: invoice.otherCharges,
            totalAmount: invoice.totalAmount,
            dueDate: invoice.dueDate,
          },
          promptpayNumber,
          promptpayName,
        );

        // Send via LINE
        await sendLineMessage(invoice.tenantId.lineUserId, [flexMessage]);

        results.sent++;
      } catch (error: any) {
        console.error(`Failed to send invoice ${invoice._id}:`, error);
        results.failed++;
        results.errors.push({
          invoiceId: invoice._id,
          error: `Room ${invoice.roomId?.roomNumber}: ${error.message}`,
        });
      }
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error: any) {
    console.error('Send invoices error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
