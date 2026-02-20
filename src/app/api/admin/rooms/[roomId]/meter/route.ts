import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAdmin } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Room from '@/models/Room';

// POST - Record a new meter reading
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const lineUserId = await requireAuth(request);

    // Check if user is admin
    const userIsAdmin = await isAdmin(lineUserId);
    if (!userIsAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await connectDB();

    const { roomId } = await params;
    const body = await request.json();
    const { meterType, value, notes } = body;

    // Validate input
    if (!meterType || !['water', 'electricity'].includes(meterType)) {
      return NextResponse.json(
        { error: 'Invalid meter type. Must be "water" or "electricity"' },
        { status: 400 }
      );
    }

    if (value === undefined || value === null || isNaN(Number(value))) {
      return NextResponse.json(
        { error: 'Meter value is required and must be a number' },
        { status: 400 }
      );
    }

    const room = await Room.findById(roomId);
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const newValue = Number(value);

    // Helper function to get the latest reading by date
    const getLatestReading = (readings: { value: number; recordedAt: Date }[]) => {
      if (!readings || readings.length === 0) return null;
      return [...readings].sort(
        (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
      )[0];
    };

    // Validate that new value is not less than the latest reading
    if (meterType === 'water') {
      const latestReading = getLatestReading(room.waterMeterReadings);
      if (latestReading && newValue < latestReading.value) {
        return NextResponse.json(
          { error: `ค่ามิเตอร์น้ำ (${newValue}) น้อยกว่าค่าเดิม (${latestReading.value})` },
          { status: 400 }
        );
      }
    } else {
      const latestReading = getLatestReading(room.electricityMeterReadings);
      if (latestReading && newValue < latestReading.value) {
        return NextResponse.json(
          { error: `ค่ามิเตอร์ไฟ (${newValue}) น้อยกว่าค่าเดิม (${latestReading.value})` },
          { status: 400 }
        );
      }
    }

    // Create the new reading entry
    const newReading = {
      value: newValue,
      recordedAt: new Date(),
      recordedBy: lineUserId,
      notes: notes || undefined,
    };

    // Add to the appropriate meter readings array
    if (meterType === 'water') {
      room.waterMeterReadings.push(newReading);
    } else {
      room.electricityMeterReadings.push(newReading);
    }

    await room.save();

    return NextResponse.json({
      success: true,
      message: `${meterType === 'water' ? 'Water' : 'Electricity'} meter reading recorded successfully`,
      reading: newReading,
    });
  } catch (error: any) {
    console.error('Record meter reading error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - Get meter readings for a room
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const lineUserId = await requireAuth(request);

    // Check if user is admin
    const userIsAdmin = await isAdmin(lineUserId);
    if (!userIsAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await connectDB();

    const { roomId } = await params;
    const room = await Room.findById(roomId).select('roomNumber waterMeterReadings electricityMeterReadings');

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      roomNumber: room.roomNumber,
      waterMeterReadings: room.waterMeterReadings || [],
      electricityMeterReadings: room.electricityMeterReadings || [],
    });
  } catch (error: any) {
    console.error('Get meter readings error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
