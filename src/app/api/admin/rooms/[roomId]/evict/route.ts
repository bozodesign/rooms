import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAdmin } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Room from '@/models/Room';
import User from '@/models/User';

// POST - Evict tenant from room
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
    const room = await Room.findById(roomId);

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    if (!room.tenantId) {
      return NextResponse.json({ error: 'Room has no tenant' }, { status: 400 });
    }

    // Get tenant info before removing
    const tenant = await User.findById(room.tenantId);
    const tenantName = tenant?.displayName || tenant?.fullName || 'ไม่ระบุชื่อ';

    // Remove room assignment from user
    await User.findByIdAndUpdate(room.tenantId, {
      $unset: { roomId: 1 },
    });

    // Add room log for check-out
    room.roomLogs.push({
      eventType: 'check_out',
      eventAt: new Date(),
      performedBy: lineUserId,
      performedByRole: 'admin',
      description: `ผู้เช่า ${tenantName} ย้ายออก (โดยผู้ดูแล)`,
      metadata: {
        tenantId: room.tenantId.toString(),
        tenantName,
        previousStatus: room.status,
        newStatus: 'vacant',
      },
    });

    // Clear tenant from room (user's fullName and notes are kept in User model)
    room.tenantId = undefined;
    room.status = 'vacant';
    room.assignmentToken = undefined;
    room.tokenExpiresAt = undefined;

    await room.save();

    return NextResponse.json({
      success: true,
      message: 'Tenant evicted successfully',
    });
  } catch (error: any) {
    console.error('Evict tenant error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
