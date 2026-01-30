import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Room from '@/models/Room';
import Invoice from '@/models/Invoice';
import User from '@/models/User';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    await connectDB();

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Get all rooms with their current invoice status
    const rooms = await Room.find()
      .populate('tenantId')
      .sort({ floor: 1, roomNumber: 1 })
      .lean();

    // Get all invoices for current month
    const invoices = await Invoice.find({
      month: currentMonth,
      year: currentYear,
    }).lean();

    // Create a map of roomId to invoice
    const invoiceMap = new Map();
    invoices.forEach((invoice) => {
      invoiceMap.set(invoice.roomId.toString(), invoice);
    });

    // Build dashboard data
    const roomsWithStatus = rooms.map((room) => {
      const invoice = invoiceMap.get(room._id.toString());

      return {
        id: room._id,
        roomNumber: room.roomNumber,
        floor: room.floor,
        baseRentPrice: room.baseRentPrice,
        status: room.status,
        waterMeterNumber: room.waterMeterNumber,
        electricityMeterNumber: room.electricityMeterNumber,
        tenant: room.tenantId
          ? {
              id: room.tenantId._id,
              name: room.tenantId.displayName,
              phone: room.tenantId.phone,
              pictureUrl: room.tenantId.pictureUrl,
              contractStartDate: room.tenantId.contractStartDate,
              contractEndDate: room.tenantId.contractEndDate,
              depositAmount: room.tenantId.depositAmount,
              meterReadings: room.tenantId.meterReadings?.slice().reverse() || [], // Get all meter readings, latest first
            }
          : null,
        invoice: invoice
          ? {
              id: invoice._id,
              paymentStatus: invoice.paymentStatus,
              totalAmount: invoice.totalAmount,
              dueDate: invoice.dueDate,
              paidAt: invoice.paidAt,
            }
          : null,
      };
    });

    // Calculate statistics
    const stats = {
      totalRooms: rooms.length,
      occupiedRooms: rooms.filter((r) => r.status === 'occupied').length,
      vacantRooms: rooms.filter((r) => r.status === 'vacant').length,
      maintenanceRooms: rooms.filter((r) => r.status === 'maintenance').length,
      paidInvoices: invoices.filter((i) => i.paymentStatus === 'paid').length,
      pendingInvoices: invoices.filter((i) => i.paymentStatus === 'pending').length,
      overdueInvoices: invoices.filter((i) => i.paymentStatus === 'overdue').length,
      totalRevenue: invoices
        .filter((i) => i.paymentStatus === 'paid')
        .reduce((sum, i) => sum + i.totalAmount, 0),
      expectedRevenue: invoices.reduce((sum, i) => sum + i.totalAmount, 0),
    };

    return NextResponse.json({
      success: true,
      rooms: roomsWithStatus,
      stats,
      currentPeriod: {
        month: currentMonth,
        year: currentYear,
      },
    });
  } catch (error: any) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
