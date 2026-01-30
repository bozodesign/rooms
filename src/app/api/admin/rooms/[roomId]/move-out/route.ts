import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Room from '@/models/Room';
import User from '@/models/User';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    await requireAdmin(request);
    await connectDB();

    const { roomId } = await params;

    // Find the room with tenant
    const room = await Room.findById(roomId);

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    if (!room.tenantId) {
      return NextResponse.json({ error: 'Room has no tenant' }, { status: 400 });
    }

    // Update user - remove room assignment
    await User.findByIdAndUpdate(room.tenantId, {
      $unset: {
        roomId: 1,
        contractStartDate: 1,
        contractEndDate: 1,
      },
    });

    // Update room - remove tenant and change status to vacant
    room.tenantId = undefined;
    room.status = 'vacant';
    await room.save();

    return NextResponse.json({
      success: true,
      message: 'Tenant moved out successfully',
    });
  } catch (error: any) {
    console.error('Move out error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
