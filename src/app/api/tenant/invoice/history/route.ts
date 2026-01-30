import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getCurrentUser } from '@/lib/auth';
import { getInvoicesByTenant } from '@/lib/billing';

export async function GET(request: NextRequest) {
  try {
    const lineUserId = await requireAuth(request);
    const user = await getCurrentUser(lineUserId);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const invoices = await getInvoicesByTenant(user._id.toString(), 12);

    return NextResponse.json({
      success: true,
      invoices: invoices.map((invoice) => ({
        id: invoice._id,
        month: invoice.month,
        year: invoice.year,
        totalAmount: invoice.totalAmount,
        paymentStatus: invoice.paymentStatus,
        dueDate: invoice.dueDate,
        paidAt: invoice.paidAt,
        roomNumber: invoice.roomId?.roomNumber,
      })),
    });
  } catch (error: any) {
    console.error('Get invoice history error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
