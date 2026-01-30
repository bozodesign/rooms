import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAdmin } from '@/lib/auth';
import { generateRoomAssignmentToken, generateAssignmentUrl } from '@/lib/room-assignment';

// POST - Generate QR code token for room
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

    const { roomId } = await params;
    const token = await generateRoomAssignmentToken(roomId);
    const assignmentUrl = generateAssignmentUrl(token);

    return NextResponse.json({
      token,
      assignmentUrl,
      expiresIn: '24 hours',
    });
  } catch (error: any) {
    console.error('Generate QR token error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
