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

    // Build date range for 6-month aggregation query
    const monthRanges: { month: number; year: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const targetDate = new Date(currentYear, currentMonth - 1 - i, 1);
      monthRanges.push({
        month: targetDate.getMonth() + 1,
        year: targetDate.getFullYear(),
      });
    }

    // Run all queries in parallel for maximum efficiency
    const [rooms, allInvoices, monthlyAggregation] = await Promise.all([
      // Query 1: Get all rooms with only needed tenant fields
      Room.find()
        .populate('tenantId', 'displayName phone pictureUrl contractStartDate contractEndDate depositAmount meterReadings')
        .sort({ floor: 1, roomNumber: 1 })
        .lean() as Promise<unknown> as Promise<RoomWithTenant[]>,

      // Query 2: Get current month invoices with populated references (single query instead of two)
      Invoice.find({
        month: currentMonth,
        year: currentYear,
      })
        .populate('roomId', 'roomNumber floor')
        .populate('tenantId', 'displayName fullName phone pictureUrl')
        .lean() as Promise<unknown> as Promise<PopulatedInvoice[]>,

      // Query 3: Aggregation for 6-month utility data (single query instead of 6)
      Invoice.aggregate([
        {
          $match: {
            $or: monthRanges.map(({ month, year }) => ({ month, year })),
          },
        },
        {
          $group: {
            _id: { month: '$month', year: '$year' },
            waterUnits: { $sum: { $ifNull: ['$waterUnits', 0] } },
            electricityUnits: { $sum: { $ifNull: ['$electricityUnits', 0] } },
            waterAmount: { $sum: { $ifNull: ['$waterAmount', 0] } },
            electricityAmount: { $sum: { $ifNull: ['$electricityAmount', 0] } },
            invoiceCount: { $sum: 1 },
            // Conditional sums for paid invoices only
            revenue: {
              $sum: {
                $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$totalAmount', 0],
              },
            },
            collectedWaterAmount: {
              $sum: {
                $cond: [{ $eq: ['$paymentStatus', 'paid'] }, { $ifNull: ['$waterAmount', 0] }, 0],
              },
            },
            collectedElectricityAmount: {
              $sum: {
                $cond: [{ $eq: ['$paymentStatus', 'paid'] }, { $ifNull: ['$electricityAmount', 0] }, 0],
              },
            },
            collectedRentAmount: {
              $sum: {
                $cond: [{ $eq: ['$paymentStatus', 'paid'] }, { $ifNull: ['$rentAmount', 0] }, 0],
              },
            },
          },
        },
        {
          $sort: { '_id.year': 1, '_id.month': 1 },
        },
      ]),
    ]);

    // Create invoice map for room status lookup
    const invoiceMap = new Map<string, PopulatedInvoice>();
    allInvoices.forEach((invoice) => {
      invoiceMap.set(invoice.roomId?._id?.toString() || '', invoice);
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
              meterReadings: tenant.meterReadings ? [...tenant.meterReadings].reverse() : [],
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

    // Sort invoices: pending/overdue first, then paid
    const sortedInvoices = [...allInvoices].sort((a, b) => {
      const statusOrder = { overdue: 0, pending: 1, paid: 2 };
      const aOrder = statusOrder[a.paymentStatus] ?? 1;
      const bOrder = statusOrder[b.paymentStatus] ?? 1;
      if (aOrder !== bOrder) return aOrder - bOrder;
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

    // Calculate statistics from already-fetched invoices
    const paidInvoices = allInvoices.filter((i) => i.paymentStatus === 'paid');
    const stats = {
      totalRooms: rooms.length,
      occupiedRooms: rooms.filter((r) => r.status === 'occupied').length,
      vacantRooms: rooms.filter((r) => r.status === 'vacant').length,
      maintenanceRooms: rooms.filter((r) => r.status === 'maintenance').length,
      paidInvoices: paidInvoices.length,
      pendingInvoices: allInvoices.filter((i) => i.paymentStatus === 'pending').length,
      overdueInvoices: allInvoices.filter((i) => i.paymentStatus === 'overdue').length,
      totalRevenue: paidInvoices.reduce((sum, i) => sum + i.totalAmount, 0),
      expectedRevenue: allInvoices.reduce((sum, i) => sum + i.totalAmount, 0),
      collectedWaterAmount: paidInvoices.reduce((sum, i) => sum + (i.waterAmount || 0), 0),
      collectedElectricityAmount: paidInvoices.reduce((sum, i) => sum + (i.electricityAmount || 0), 0),
      collectedRentAmount: paidInvoices.reduce((sum, i) => sum + (i.rentAmount || 0), 0),
      expectedWaterAmount: allInvoices.reduce((sum, i) => sum + (i.waterAmount || 0), 0),
      expectedElectricityAmount: allInvoices.reduce((sum, i) => sum + (i.electricityAmount || 0), 0),
      expectedRentAmount: allInvoices.reduce((sum, i) => sum + (i.rentAmount || 0), 0),
    };

    // Transform aggregation results to expected format, ensuring all months are represented
    const aggregationMap = new Map(
      monthlyAggregation.map((item: any) => [`${item._id.year}-${item._id.month}`, item])
    );

    const monthlyUtilityData = monthRanges.map(({ month, year }) => {
      const data = aggregationMap.get(`${year}-${month}`);
      return {
        month,
        year,
        waterUnits: data?.waterUnits || 0,
        electricityUnits: data?.electricityUnits || 0,
        waterAmount: data?.waterAmount || 0,
        electricityAmount: data?.electricityAmount || 0,
        collectedWaterAmount: data?.collectedWaterAmount || 0,
        collectedElectricityAmount: data?.collectedElectricityAmount || 0,
        collectedRentAmount: data?.collectedRentAmount || 0,
        revenue: data?.revenue || 0,
        invoiceCount: data?.invoiceCount || 0,
      };
    });

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
