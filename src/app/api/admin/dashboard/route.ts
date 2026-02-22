import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Room from '@/models/Room';
import Invoice from '@/models/Invoice';
import { IMeterReading } from '@/models/User';

// Type for populated tenant
interface PopulatedTenant {
  _id: string;
  displayName: string;
  fullName?: string;
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

// Type for populated invoice
interface PopulatedInvoice {
  _id: string;
  roomId: {
    _id: string;
    roomNumber: string;
    floor: number;
  };
  tenantId: {
    _id: string;
    displayName?: string;
    fullName?: string;
    phone?: string;
    pictureUrl?: string;
  };
  month: number;
  year: number;
  rentAmount: number;
  waterAmount: number;
  electricityAmount: number;
  totalAmount: number;
  paymentStatus: 'pending' | 'paid' | 'overdue';
  dueDate: Date;
  paidAt?: Date;
  createdAt: Date;
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

    // Get all invoices for display (sorted: pending/overdue first, then paid)
    const allInvoices = await Invoice.find({
      month: currentMonth,
      year: currentYear,
    })
      .populate('roomId', 'roomNumber floor')
      .populate('tenantId', 'displayName fullName phone pictureUrl')
      .lean() as unknown as PopulatedInvoice[];

    // Sort invoices: pending/overdue first, then paid
    const sortedInvoices = allInvoices.sort((a, b) => {
      const statusOrder = { overdue: 0, pending: 1, paid: 2 };
      const aOrder = statusOrder[a.paymentStatus] ?? 1;
      const bOrder = statusOrder[b.paymentStatus] ?? 1;
      if (aOrder !== bOrder) return aOrder - bOrder;
      // Within same status, sort by due date (earliest first for pending/overdue, latest first for paid)
      if (a.paymentStatus === 'paid') {
        return new Date(b.paidAt || b.dueDate).getTime() - new Date(a.paidAt || a.dueDate).getTime();
      }
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

    // Format invoices for response
    const formattedInvoices = sortedInvoices.map((invoice) => ({
      id: invoice._id,
      roomNumber: invoice.roomId?.roomNumber || '-',
      floor: invoice.roomId?.floor || 0,
      tenantName: invoice.tenantId?.displayName || invoice.tenantId?.fullName || 'ไม่ระบุ',
      tenantPhone: invoice.tenantId?.phone,
      tenantPictureUrl: invoice.tenantId?.pictureUrl,
      month: invoice.month,
      year: invoice.year,
      rentAmount: invoice.rentAmount,
      waterAmount: invoice.waterAmount,
      electricityAmount: invoice.electricityAmount,
      totalAmount: invoice.totalAmount,
      paymentStatus: invoice.paymentStatus,
      dueDate: invoice.dueDate,
      paidAt: invoice.paidAt,
    }));

    // Calculate statistics
    const paidInvoices = invoices.filter((i) => i.paymentStatus === 'paid');
    const stats = {
      totalRooms: rooms.length,
      occupiedRooms: rooms.filter((r) => r.status === 'occupied').length,
      vacantRooms: rooms.filter((r) => r.status === 'vacant').length,
      maintenanceRooms: rooms.filter((r) => r.status === 'maintenance').length,
      paidInvoices: paidInvoices.length,
      pendingInvoices: invoices.filter((i) => i.paymentStatus === 'pending').length,
      overdueInvoices: invoices.filter((i) => i.paymentStatus === 'overdue').length,
      totalRevenue: paidInvoices.reduce((sum, i) => sum + i.totalAmount, 0),
      expectedRevenue: invoices.reduce((sum, i) => sum + i.totalAmount, 0),
      // Current month collected amounts (from paid invoices)
      collectedWaterAmount: paidInvoices.reduce((sum, i) => sum + (i.waterAmount || 0), 0),
      collectedElectricityAmount: paidInvoices.reduce((sum, i) => sum + (i.electricityAmount || 0), 0),
      collectedRentAmount: paidInvoices.reduce((sum, i) => sum + (i.rentAmount || 0), 0),
      // Current month expected amounts (from all invoices)
      expectedWaterAmount: invoices.reduce((sum, i) => sum + (i.waterAmount || 0), 0),
      expectedElectricityAmount: invoices.reduce((sum, i) => sum + (i.electricityAmount || 0), 0),
      expectedRentAmount: invoices.reduce((sum, i) => sum + (i.rentAmount || 0), 0),
    };

    // Get monthly utility usage for the past 6 months
    const monthlyUtilityData = [];
    for (let i = 5; i >= 0; i--) {
      const targetDate = new Date(currentYear, currentMonth - 1 - i, 1);
      const targetMonth = targetDate.getMonth() + 1;
      const targetYear = targetDate.getFullYear();

      const monthInvoices = await Invoice.find({
        month: targetMonth,
        year: targetYear,
      }).lean();

      const paidMonthInvoices = monthInvoices.filter((inv) => inv.paymentStatus === 'paid');

      const totalWaterUnits = monthInvoices.reduce((sum, inv) => sum + (inv.waterUnits || 0), 0);
      const totalElectricityUnits = monthInvoices.reduce((sum, inv) => sum + (inv.electricityUnits || 0), 0);
      const totalWaterAmount = monthInvoices.reduce((sum, inv) => sum + (inv.waterAmount || 0), 0);
      const totalElectricityAmount = monthInvoices.reduce((sum, inv) => sum + (inv.electricityAmount || 0), 0);
      const totalRevenue = paidMonthInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

      // Collected amounts (from paid invoices only)
      const collectedWaterAmount = paidMonthInvoices.reduce((sum, inv) => sum + (inv.waterAmount || 0), 0);
      const collectedElectricityAmount = paidMonthInvoices.reduce((sum, inv) => sum + (inv.electricityAmount || 0), 0);
      const collectedRentAmount = paidMonthInvoices.reduce((sum, inv) => sum + (inv.rentAmount || 0), 0);

      monthlyUtilityData.push({
        month: targetMonth,
        year: targetYear,
        waterUnits: totalWaterUnits,
        electricityUnits: totalElectricityUnits,
        waterAmount: totalWaterAmount,
        electricityAmount: totalElectricityAmount,
        collectedWaterAmount,
        collectedElectricityAmount,
        collectedRentAmount,
        revenue: totalRevenue,
        invoiceCount: monthInvoices.length,
      });
    }

    return NextResponse.json({
      success: true,
      rooms: roomsWithStatus,
      invoices: formattedInvoices,
      stats,
      monthlyUtilityData,
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
