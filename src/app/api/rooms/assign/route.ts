import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { generateRoomAssignmentToken, generateAssignmentUrl } from '@/lib/room-assignment';

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);

    const { roomId } = await request.json();

    if (!roomId) {
      return NextResponse.json({ error: 'Room ID is required' }, { status: 400 });
    }

    const token = await generateRoomAssignmentToken(roomId);
    const assignmentUrl = generateAssignmentUrl(token);

    return NextResponse.json({
      success: true,
      token,
      assignmentUrl,
    });
  } catch (error: any) {
    console.error('Generate assignment token error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
