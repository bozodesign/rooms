import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Room from '@/models/Room';
import Invoice from '@/models/Invoice';
import User, { IUser, IMeterReading } from '@/models/User';

// Type for populated tenant
interface PopulatedTenant {
  _id: string;
  displayName: string;
  phone?: string;
  pictureUrl?: string;
  contractStartDate?: Date;
  contractEndDate?: Date;
  depositAmount?: number;
  meterReadings?: IMeterReading[];
}

// Type for room with populated tenant
interface RoomWithTenant {
  _id: string;
  roomNumber: string;
  floor: number;
  baseRentPrice: number;
  status: string;
  waterMeterNumber?: string;
  electricityMeterNumber?: string;
  tenantId?: PopulatedTenant | null;
}

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
      .lean() as unknown as RoomWithTenant[];

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
      const tenant = room.tenantId as PopulatedTenant | null;

      return {
        id: room._id,
        roomNumber: room.roomNumber,
        floor: room.floor,
        baseRentPrice: room.baseRentPrice,
        status: room.status,
        waterMeterNumber: room.waterMeterNumber,
        electricityMeterNumber: room.electricityMeterNumber,
        tenant: tenant
          ? {
              id: tenant._id,
              name: tenant.displayName,
              phone: tenant.phone,
              pictureUrl: tenant.pictureUrl,
              contractStartDate: tenant.contractStartDate,
              contractEndDate: tenant.contractEndDate,
              depositAmount: tenant.depositAmount,
              meterReadings: tenant.meterReadings?.slice().reverse() || [], // Get all meter readings, latest first
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
