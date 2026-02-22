import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAdmin } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Room from '@/models/Room';

interface BatchRoomInput {
  roomNumber: string;
  floor: number;
  baseRentPrice: number;
  waterRate?: number;
  electricityRate?: number;
  hasMotorcycleParking?: boolean;
  motorcycleParkingRate?: number;
  depositAmount?: number;
  notes?: string;
}

// POST - Batch create rooms
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
    const { rooms } = body as { rooms: BatchRoomInput[] };

    if (!rooms || !Array.isArray(rooms) || rooms.length === 0) {
      return NextResponse.json(
        { error: 'Rooms array is required and must not be empty' },
        { status: 400 }
      );
    }

    // Validate all rooms before creating
    const errors: { index: number; roomNumber: string; error: string }[] = [];
    const roomNumbers = new Set<string>();
    const validRoomNumbers: string[] = [];

    // First pass: validate required fields and check for duplicates in batch
    for (let i = 0; i < rooms.length; i++) {
      const room = rooms[i];

      // Check required fields
      if (!room.roomNumber || !room.floor || room.baseRentPrice === undefined) {
        errors.push({
          index: i,
          roomNumber: room.roomNumber || 'N/A',
          error: 'Missing required fields (roomNumber, floor, baseRentPrice)',
        });
        continue;
      }

      // Check for duplicate room numbers in the batch
      if (roomNumbers.has(room.roomNumber)) {
        errors.push({
          index: i,
          roomNumber: room.roomNumber,
          error: 'Duplicate room number in batch',
        });
        continue;
      }

      roomNumbers.add(room.roomNumber);
      validRoomNumbers.push(room.roomNumber);
    }

    // Single query to check all existing rooms instead of N queries
    const existingRooms = await Room.find(
      { roomNumber: { $in: validRoomNumbers } },
      { roomNumber: 1 }
    ).lean();
    const existingRoomNumbers = new Set(existingRooms.map((r) => r.roomNumber));

    // Second pass: check against existing rooms in database
    for (let i = 0; i < rooms.length; i++) {
      const room = rooms[i];
      if (room.roomNumber && existingRoomNumbers.has(room.roomNumber)) {
        errors.push({
          index: i,
          roomNumber: room.roomNumber,
          error: 'Room number already exists in database',
        });
      }
    }

    // If there are validation errors, return them
    if (errors.length > 0) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          errors,
          validCount: rooms.length - errors.length,
          totalCount: rooms.length,
        },
        { status: 400 }
      );
    }

    // Create all rooms
    const createdRooms = await Room.insertMany(
      rooms.map((room) => ({
        roomNumber: room.roomNumber,
        floor: room.floor,
        baseRentPrice: room.baseRentPrice,
        waterRate: room.waterRate || 18,
        electricityRate: room.electricityRate || 8,
        hasMotorcycleParking: room.hasMotorcycleParking || false,
        motorcycleParkingRate: room.motorcycleParkingRate || 200,
        depositAmount: room.depositAmount || 0,
        notes: room.notes || '',
        status: 'vacant',
      }))
    );

    return NextResponse.json(
      {
        success: true,
        message: `Successfully created ${createdRooms.length} rooms`,
        createdCount: createdRooms.length,
        rooms: createdRooms,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Batch create rooms error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
