import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAdmin } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Room from '@/models/Room';
import User from '@/models/User';

// GET - Get a single room
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
    const room = await Room.findById(roomId).populate('tenantId', 'displayName fullName notes pictureUrl phone');

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    return NextResponse.json({ room });
  } catch (error: any) {
    console.error('Get room error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update a room
export async function PATCH(
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

    const body = await request.json();
    const {
      roomNumber,
      floor,
      baseRentPrice,
      status,
      waterMeterNumber,
      electricityMeterNumber,
      waterRate,
      electricityRate,
      depositAmount,
      notes,
      // Tenant fields (saved to User model)
      tenantFullName,
      tenantNotes,
    } = body;

    const { roomId } = await params;
    const room = await Room.findById(roomId);

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Check if room number is being changed and if it already exists
    if (roomNumber && roomNumber !== room.roomNumber) {
      const existingRoom = await Room.findOne({ roomNumber });
      if (existingRoom) {
        return NextResponse.json({ error: 'Room number already exists' }, { status: 400 });
      }
    }

    // Track status change for logging
    const previousStatus = room.status;
    const statusChanged = status !== undefined && status !== previousStatus;

    // Update room fields
    if (roomNumber !== undefined) room.roomNumber = roomNumber;
    if (floor !== undefined) room.floor = floor;
    if (baseRentPrice !== undefined) room.baseRentPrice = baseRentPrice;
    if (status !== undefined) room.status = status;
    if (waterMeterNumber !== undefined) room.waterMeterNumber = waterMeterNumber;
    if (electricityMeterNumber !== undefined) room.electricityMeterNumber = electricityMeterNumber;
    if (waterRate !== undefined) room.waterRate = waterRate;
    if (electricityRate !== undefined) room.electricityRate = electricityRate;
    if (depositAmount !== undefined) room.depositAmount = depositAmount;
    if (notes !== undefined) room.notes = notes;

    // Add room log for status change (manual toggle)
    if (statusChanged) {
      const statusLabels: Record<string, string> = {
        vacant: 'ว่าง',
        occupied: 'ไม่ว่าง',
        maintenance: 'ซ่อมแซม',
      };
      room.roomLogs.push({
        eventType: 'status_change',
        eventAt: new Date(),
        performedBy: lineUserId,
        performedByRole: 'admin',
        description: `เปลี่ยนสถานะห้องจาก "${statusLabels[previousStatus]}" เป็น "${statusLabels[status]}" (โดยผู้ดูแล)`,
        metadata: {
          previousStatus,
          newStatus: status,
        },
      });
    }

    await room.save();

    // Update tenant (User) fields if room has tenant
    if (room.tenantId && (tenantFullName !== undefined || tenantNotes !== undefined)) {
      const updateData: { fullName?: string; notes?: string } = {};
      if (tenantFullName !== undefined) updateData.fullName = tenantFullName;
      if (tenantNotes !== undefined) updateData.notes = tenantNotes;
      await User.findByIdAndUpdate(room.tenantId, updateData);
    }

    return NextResponse.json({ room });
  } catch (error: any) {
    console.error('Update room error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete a room
export async function DELETE(
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
    const room = await Room.findById(roomId);

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Don't allow deleting occupied rooms
    if (room.status === 'occupied') {
      return NextResponse.json(
        { error: 'Cannot delete an occupied room. Please remove the tenant first.' },
        { status: 400 }
      );
    }

    await Room.findByIdAndDelete(roomId);

    return NextResponse.json({ message: 'Room deleted successfully' });
  } catch (error: any) {
    console.error('Delete room error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
