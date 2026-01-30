import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Room from '@/models/Room';

// POST - Record meter reading for a tenant
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    await connectDB();

    const body = await request.json();
    const {
      roomId,
      month,
      year,
      electricityReading,
      waterReading,
      electricityReadingDate,
      waterReadingDate,
      notes,
    } = body;

    if (!roomId) {
      return NextResponse.json({ error: 'Room ID is required' }, { status: 400 });
    }

    if (!month || !year) {
      return NextResponse.json({ error: 'Month and year are required' }, { status: 400 });
    }

    if (electricityReading === undefined || waterReading === undefined) {
      return NextResponse.json(
        { error: 'Both electricity and water readings are required' },
        { status: 400 }
      );
    }

    // Get room with tenant
    const room = await Room.findById(roomId);

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    if (!room.tenantId) {
      return NextResponse.json({ error: 'Room has no tenant' }, { status: 400 });
    }

    // Get admin user for tracking
    const adminUser = await User.findOne({ lineUserId: admin, role: 'admin' });

    // Get tenant
    const tenant = await User.findById(room.tenantId);

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Check if reading for this month/year already exists
    const existingReading = tenant.meterReadings.find(
      (reading) => reading.month === month && reading.year === year
    );

    if (existingReading) {
      return NextResponse.json(
        { error: 'Meter reading already exists for this period' },
        { status: 400 }
      );
    }

    // Add new meter reading
    tenant.meterReadings.push({
      month,
      year,
      electricityReading,
      electricityReadingDate: electricityReadingDate
        ? new Date(electricityReadingDate)
        : new Date(),
      waterReading,
      waterReadingDate: waterReadingDate ? new Date(waterReadingDate) : new Date(),
      recordedBy: adminUser?.displayName || admin,
      notes,
    });

    await tenant.save();

    // Calculate usage if there's a previous reading
    let usage = null;
    if (tenant.meterReadings.length > 1) {
      const previousReading = tenant.meterReadings[tenant.meterReadings.length - 2];
      usage = {
        electricityUnits: electricityReading - previousReading.electricityReading,
        waterUnits: waterReading - previousReading.waterReading,
      };
    }

    return NextResponse.json({
      success: true,
      message: 'Meter reading recorded successfully',
      reading: tenant.meterReadings[tenant.meterReadings.length - 1],
      usage,
    });
  } catch (error: any) {
    console.error('Record meter reading error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
