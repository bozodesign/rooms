import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Invitation from '@/models/Invitation';
import User from '@/models/User';

// GET - Check invitation validity
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ secretCode: string }> }
) {
  try {
    await connectDB();

    const { secretCode } = await params;

    const invitation = await Invitation.findOne({ secretCode });

    if (!invitation) {
      return NextResponse.json({ error: 'ไม่พบลิงก์เชิญนี้' }, { status: 404 });
    }

    if (invitation.status !== 'invited') {
      const statusMessages: Record<string, string> = {
        accepted: 'ลิงก์เชิญนี้ถูกใช้งานแล้ว',
        declined: 'ลิงก์เชิญนี้ถูกปฏิเสธแล้ว',
        expired: 'ลิงก์เชิญนี้หมดอายุแล้ว',
        cancelled: 'ลิงก์เชิญนี้ถูกยกเลิกแล้ว',
      };
      return NextResponse.json(
        { error: statusMessages[invitation.status] || 'ลิงก์เชิญไม่สามารถใช้งานได้' },
        { status: 400 }
      );
    }

    if (new Date() > invitation.expireDate) {
      invitation.status = 'expired';
      await invitation.save();
      return NextResponse.json({ error: 'ลิงก์เชิญนี้หมดอายุแล้ว' }, { status: 400 });
    }

    return NextResponse.json({
      valid: true,
      invitation: {
        inviter: invitation.inviter,
        createdAt: invitation.createdAt,
        expireDate: invitation.expireDate,
      },
    });
  } catch (error: any) {
    console.error('Check invitation error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Accept or decline invitation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ secretCode: string }> }
) {
  try {
    await connectDB();

    const { secretCode } = await params;
    const lineUserId = request.headers.get('x-line-userid');

    if (!lineUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const decision = body.decision as 'accept' | 'decline';

    if (!['accept', 'decline'].includes(decision)) {
      return NextResponse.json({ error: 'Invalid decision' }, { status: 400 });
    }

    const invitation = await Invitation.findOne({ secretCode });

    if (!invitation) {
      return NextResponse.json({ error: 'ไม่พบลิงก์เชิญนี้' }, { status: 404 });
    }

    if (invitation.status !== 'invited') {
      return NextResponse.json({ error: 'ลิงก์เชิญนี้ไม่สามารถใช้งานได้' }, { status: 400 });
    }

    if (new Date() > invitation.expireDate) {
      invitation.status = 'expired';
      await invitation.save();
      return NextResponse.json({ error: 'ลิงก์เชิญนี้หมดอายุแล้ว' }, { status: 400 });
    }

    // Get the accepting user
    const user = await User.findOne({ lineUserId });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user is already admin
    if (user.role === 'admin') {
      return NextResponse.json({ error: 'คุณเป็นผู้ดูแลอยู่แล้ว' }, { status: 400 });
    }

    // Update invitation
    invitation.invitee = {
      lineUserId: user.lineUserId,
      displayName: user.displayName,
      pictureUrl: user.pictureUrl,
    };
    invitation.usedAt = new Date();
    invitation.status = decision === 'accept' ? 'accepted' : 'declined';

    await invitation.save();

    // If accepted, update user role to admin
    if (decision === 'accept') {
      user.role = 'admin';
      await user.save();
    }

    return NextResponse.json({
      success: true,
      status: invitation.status,
    });
  } catch (error: any) {
    console.error('Update invitation error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
