import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Room from '@/models/Room';
import User from '@/models/User';

// POST - Assign a user to a room directly (by admin)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const adminLineUserId = await requireAdmin(request);
    await connectDB();

    const { roomId } = await params;
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Find the room
    const room = await Room.findById(roomId);
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Check if room is already occupied
    if (room.status === 'occupied') {
      return NextResponse.json(
        { error: 'Room is already occupied' },
        { status: 400 }
      );
    }

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user already has a room
    if (user.roomId) {
      const existingRoom = await Room.findById(user.roomId);
      if (existingRoom) {
        return NextResponse.json(
          { error: `User is already assigned to room ${existingRoom.roomNumber}` },
          { status: 400 }
        );
      }
    }

    // Assign room to user
    user.roomId = room._id;
    user.contractStartDate = new Date();
    await user.save();

    // Update room status
    room.tenantId = user._id;
    room.status = 'occupied';
    room.assignmentToken = undefined;
    room.tokenExpiresAt = undefined;

    // Add room log for check-in (by admin)
    room.roomLogs.push({
      eventType: 'check_in',
      eventAt: new Date(),
      performedBy: adminLineUserId,
      performedByRole: 'admin',
      description: `ผู้ดูแลเพิ่มผู้เช่า ${user.displayName || user.fullName || 'ไม่ระบุชื่อ'} เข้าพัก`,
      metadata: {
        tenantId: user._id.toString(),
        tenantName: user.displayName || user.fullName,
        previousStatus: 'vacant',
        newStatus: 'occupied',
      },
    });

    await room.save();

    // Populate tenant info for response
    const updatedRoom = await Room.findById(roomId).populate(
      'tenantId',
      'displayName fullName notes pictureUrl phone'
    );

    return NextResponse.json({
      success: true,
      message: `Successfully assigned ${user.displayName || user.fullName || 'user'} to room ${room.roomNumber}`,
      room: updatedRoom,
    });
  } catch (error: any) {
    console.error('Assign tenant error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
