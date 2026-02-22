import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAdmin } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Room from '@/models/Room';

// Helper to get latest reading from array efficiently (O(n) instead of O(n log n) sort)
function getLatestReading(readings: { value: number; recordedAt: Date }[] | undefined) {
  if (!readings || readings.length === 0) return null;
  let latest = readings[0];
  let latestTime = new Date(latest.recordedAt).getTime();
  for (let i = 1; i < readings.length; i++) {
    const time = new Date(readings[i].recordedAt).getTime();
    if (time > latestTime) {
      latest = readings[i];
      latestTime = time;
    }
  }
  return latest;
}

// GET - List all rooms
export async function GET(request: NextRequest) {
  try {
    const lineUserId = await requireAuth(request);

    // Check if user is admin
    const userIsAdmin = await isAdmin(lineUserId);
    if (!userIsAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const forMeterRecord = searchParams.get('forMeterRecord') === 'true';

    if (forMeterRecord) {
      // Optimized query for meter record page - only fetch needed fields
      const rooms = await Room.find({})
        .select('roomNumber floor status waterMeterReadings electricityMeterReadings')
        .sort({ floor: 1, roomNumber: 1 })
        .lean();

      // Pre-compute latest readings server-side to reduce client processing
      const roomsWithLatestReadings = rooms.map((room: any) => {
        const lastWaterReading = getLatestReading(room.waterMeterReadings);
        const lastElectricityReading = getLatestReading(room.electricityMeterReadings);
        return {
          _id: room._id,
          roomNumber: room.roomNumber,
          floor: room.floor,
          status: room.status,
          lastWaterReading: lastWaterReading ? {
            value: lastWaterReading.value,
            recordedAt: lastWaterReading.recordedAt,
          } : null,
          lastElectricityReading: lastElectricityReading ? {
            value: lastElectricityReading.value,
            recordedAt: lastElectricityReading.recordedAt,
          } : null,
        };
      });

      return NextResponse.json({ rooms: roomsWithLatestReadings });
    }

    // Full query for other pages (rooms management, etc.)
    const rooms = await Room.find({})
      .populate('tenantId', 'displayName fullName notes pictureUrl phone')
      .sort({ floor: 1, roomNumber: 1 })
      .lean();

    return NextResponse.json({ rooms });
  } catch (error: any) {
    console.error('Get rooms error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new room
export async function POST(request: NextRequest) {
  try {
    const lineUserId = await requireAuth(request);

    // Check if user is admin
    const userIsAdmin = await isAdmin(lineUserId);
    if (!userIsAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await connectDB();

    const body = await request.json();
    const {
      roomNumber,
      floor,
      baseRentPrice,
      waterRate,
      electricityRate,
      hasMotorcycleParking,
      motorcycleParkingRate,
      depositAmount,
      notes,
    } = body;

    // Validate required fields
    if (!roomNumber || !floor || baseRentPrice === undefined) {
      return NextResponse.json(
        { error: 'Room number, floor, and base rent price are required' },
        { status: 400 }
      );
    }

    // Check if room number already exists
    const existingRoom = await Room.findOne({ roomNumber });
    if (existingRoom) {
      return NextResponse.json({ error: 'Room number already exists' }, { status: 400 });
    }

    const room = new Room({
      roomNumber,
      floor,
      baseRentPrice,
      waterRate,
      electricityRate,
      hasMotorcycleParking,
      motorcycleParkingRate,
      depositAmount,
      notes,
      status: 'vacant',
    });

    await room.save();

    return NextResponse.json({ room }, { status: 201 });
  } catch (error: any) {
    console.error('Create room error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
