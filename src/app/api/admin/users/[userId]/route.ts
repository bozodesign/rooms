import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

// GET - Get user details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    await requireAdmin(request);
    await connectDB();

    const { userId } = await params;

    const user = await User.findById(userId)
      .populate('roomId', 'roomNumber floor')
      .lean();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error: any) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH - Update user (role, etc.)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const adminLineUserId = await requireAdmin(request);
    await connectDB();

    const { userId } = await params;
    const body = await request.json();

    const user = await User.findById(userId);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prevent admin from removing their own admin role
    if (body.role !== undefined && body.role !== 'admin') {
      if (user.lineUserId === adminLineUserId) {
        return NextResponse.json(
          { error: 'Cannot remove your own admin role' },
          { status: 400 }
        );
      }
    }

    // Update allowed fields
    if (body.role !== undefined) {
      user.role = body.role;
    }

    await user.save();

    return NextResponse.json({
      success: true,
      user: {
        _id: user._id,
        displayName: user.displayName,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error('Update user error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
