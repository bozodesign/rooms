import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getCurrentUser } from '@/lib/auth';
import { getCurrentMonthInvoice } from '@/lib/billing';

// Type for populated room
interface PopulatedRoom {
  _id: string;
  roomNumber: string;
}

export async function GET(request: NextRequest) {
  try {
    const lineUserId = await requireAuth(request);
    const user = await getCurrentUser(lineUserId);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const invoice = await getCurrentMonthInvoice(user._id.toString());

    if (!invoice) {
      return NextResponse.json({ error: 'No invoice found for current month' }, { status: 404 });
    }

    // Cast populated roomId to get roomNumber
    const room = invoice.roomId as unknown as PopulatedRoom | null;

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
        otherCharges: invoice.otherCharges,
        discount: invoice.discount,
        totalAmount: invoice.totalAmount,
        paymentStatus: invoice.paymentStatus,
        dueDate: invoice.dueDate,
        paidAt: invoice.paidAt,
        roomNumber: room?.roomNumber,
      },
    });
  } catch (error: any) {
    console.error('Get current invoice error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
