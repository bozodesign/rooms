import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAdmin } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Room from '@/models/Room';

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

    const rooms = await Room.find({})
      .populate('tenantId', 'displayName phoneNumber pictureUrl')
      .sort({ floor: 1, roomNumber: 1 });

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
