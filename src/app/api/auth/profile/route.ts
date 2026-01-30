import { NextRequest, NextResponse } from 'next/server';
import { upsertUserFromProfile } from '@/lib/auth';
import connectDB from '@/lib/mongodb';

export async function POST(request: NextRequest) {
  try {
    console.log('=== Profile Sync Started ===');

    // Ensure database connection
    await connectDB();
    console.log('Database connected');

    const profile = await request.json();
    console.log('Received profile:', {
      userId: profile.userId,
      displayName: profile.displayName,
      hasPictureUrl: !!profile.pictureUrl
    });

    if (!profile.userId || !profile.displayName) {
      console.error('Invalid profile data:', profile);
      return NextResponse.json({ error: 'Invalid profile data' }, { status: 400 });
    }

    const user = await upsertUserFromProfile(profile);
    console.log('User upserted successfully:', {
      id: user._id,
      lineUserId: user.lineUserId,
      displayName: user.displayName,
      role: user.role,
    });

    console.log('=== Profile Sync Completed ===');

    return NextResponse.json({
      success: true,
      user: {
        id: user._id,
        lineUserId: user.lineUserId,
        displayName: user.displayName,
        role: user.role,
        roomId: user.roomId,
      },
    });
  } catch (error: any) {
    console.error('=== Profile sync error ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Full error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
