import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Invoice from '@/models/Invoice';
import Room from '@/models/Room';
import User from '@/models/User';

// POST - Create new invoice(s)
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    await connectDB();

    const body = await request.json();
    const { roomIds, month, year, dueDate } = body;

    if (!roomIds || !Array.isArray(roomIds) || roomIds.length === 0) {
      return NextResponse.json({ error: 'Room IDs are required' }, { status: 400 });
    }

    if (!month || !year || !dueDate) {
      return NextResponse.json({ error: 'Month, year, and due date are required' }, { status: 400 });
    }

    // Find admin user for tracking
    const adminUser = await User.findOne({ lineUserId: admin, role: 'admin' });

    const results = [];
    const errors = [];

    for (const roomId of roomIds) {
      try {
        // Get room with tenant
        const room = await Room.findById(roomId).populate('tenantId');

        if (!room) {
          errors.push({ roomId, error: 'Room not found' });
          continue;
        }

        if (!room.tenantId) {
          errors.push({ roomId, error: 'Room has no tenant' });
          continue;
        }

        // Check if invoice already exists for this month/year
        const existingInvoice = await Invoice.findOne({
          roomId,
          month,
          year,
        });

        if (existingInvoice) {
          errors.push({ roomId, error: 'Invoice already exists for this period' });
          continue;
        }

        // Get tenant's latest meter readings
        const tenant = room.tenantId as any;
        const meterReadings = tenant.meterReadings || [];

        let previousWaterReading = 0;
        let previousElectricityReading = 0;
        let currentWaterReading = 0;
        let currentElectricityReading = 0;

        if (meterReadings.length > 0) {
          // Latest reading
          currentWaterReading = meterReadings[meterReadings.length - 1].waterReading;
          currentElectricityReading = meterReadings[meterReadings.length - 1].electricityReading;

          // Previous reading (if exists)
          if (meterReadings.length > 1) {
            previousWaterReading = meterReadings[meterReadings.length - 2].waterReading;
            previousElectricityReading = meterReadings[meterReadings.length - 2].electricityReading;
          }
        }

        // Calculate units used
        const waterUnits = Math.max(0, currentWaterReading - previousWaterReading);
        const electricityUnits = Math.max(0, currentElectricityReading - previousElectricityReading);

        // Calculate charges
        const rentAmount = room.baseRentPrice || 0;
        const waterAmount = waterUnits * (room.waterRate || 18);
        const electricityAmount = electricityUnits * (room.electricityRate || 8);
        const totalAmount = rentAmount + waterAmount + electricityAmount;

        // Create invoice
        const invoice = await Invoice.create({
          roomId: room._id,
          tenantId: tenant._id,
          month,
          year,
          waterUnits,
          electricityUnits,
          previousWaterReading,
          previousElectricityReading,
          currentWaterReading,
          currentElectricityReading,
          rentAmount,
          waterAmount,
          electricityAmount,
          totalAmount,
          paymentStatus: 'pending',
          dueDate: new Date(dueDate),
          generatedBy: adminUser?._id,
        });

        results.push({
          roomId,
          roomNumber: room.roomNumber,
          invoiceId: invoice._id,
          totalAmount,
        });
      } catch (error: any) {
        errors.push({ roomId, error: error.message });
      }
    }

    return NextResponse.json({
      success: true,
      created: results.length,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('Create invoices error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

// GET - List invoices with filters
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    await connectDB();

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const status = searchParams.get('status');
    const roomId = searchParams.get('roomId');

    const query: any = {};

    if (month) query.month = parseInt(month);
    if (year) query.year = parseInt(year);
    if (status) query.paymentStatus = status;
    if (roomId) query.roomId = roomId;

    const invoices = await Invoice.find(query)
      .populate('roomId', 'roomNumber floor')
      .populate('tenantId', 'displayName phone pictureUrl')
      .sort({ year: -1, month: -1, createdAt: -1 })
      .lean();

    return NextResponse.json({ invoices });
  } catch (error: any) {
    console.error('Get invoices error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
