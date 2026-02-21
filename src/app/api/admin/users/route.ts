import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

// GET - List all users
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    await connectDB();

    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');

    const query: Record<string, unknown> = { isActive: true };
    if (role) {
      query.role = role;
    }

    const users = await User.find(query)
      .select('lineUserId displayName pictureUrl phone role roomId createdAt')
      .populate('roomId', 'roomNumber')
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ users });
  } catch (error: any) {
    console.error('Get users error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.message?.includes('Forbidden') ? 403 : 500 }
    );
  }
}
