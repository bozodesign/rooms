import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { assignRoomToTenant } from '@/lib/room-assignment';

export async function POST(request: NextRequest) {
  try {
    const lineUserId = await requireAuth(request);

    const { token, contractStartDate, contractEndDate } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Assignment token is required' }, { status: 400 });
    }

    const result = await assignRoomToTenant(
      token,
      lineUserId,
      contractStartDate ? new Date(contractStartDate) : undefined,
      contractEndDate ? new Date(contractEndDate) : undefined
    );

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Room assignment error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
