import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireAdmin } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Invitation from '@/models/Invitation';
import User from '@/models/User';

// GET - List all invitations
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    await connectDB();

    // Get active invitations
    const invited = await Invitation.find({
      status: 'invited',
      expireDate: { $gt: new Date() },
    })
      .sort({ createdAt: -1 })
      .lean();

    // Get recent completed invitations (accepted/declined)
    const others = await Invitation.find({
      status: { $in: ['accepted', 'declined', 'cancelled'] },
    })
      .sort({ updatedAt: -1 })
      .limit(10)
      .lean();

    return NextResponse.json({ invited, others });
  } catch (error: any) {
    console.error('Get invitations error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.message?.includes('Forbidden') ? 403 : 500 }
    );
  }
}

// POST - Create new invitation
export async function POST(request: NextRequest) {
  try {
    const adminLineUserId = await requireAdmin(request);
    await connectDB();

    const body = await request.json();
    const expireHours = body.expireHours || 24;

    // Check invitation limit (max 5 active)
    const activeCount = await Invitation.countDocuments({
      status: 'invited',
      expireDate: { $gt: new Date() },
    });

    if (activeCount >= 5) {
      return NextResponse.json(
        { error: 'มีลิงก์เชิญที่ใช้งานได้ครบ 5 ลิงก์แล้ว กรุณายกเลิกลิงก์เก่าก่อน' },
        { status: 400 }
      );
    }

    // Get admin user info
    const adminUser = await User.findOne({ lineUserId: adminLineUserId });
    if (!adminUser) {
      return NextResponse.json({ error: 'Admin user not found' }, { status: 404 });
    }

    // Generate secret code
    const secretCode = crypto.randomBytes(16).toString('hex');

    // Build invitation URL using LIFF URL for LINE mini app
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    const fullUrl = liffId
      ? `https://liff.line.me/${liffId}/invitation/${secretCode}`
      : `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invitation/${secretCode}`;

    // Try to shorten URL
    let shortUrl = fullUrl;
    try {
      const tinyUrlResponse = await fetch(
        `https://tinyurl.com/api-create.php?url=${encodeURIComponent(fullUrl)}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (tinyUrlResponse.ok) {
        shortUrl = await tinyUrlResponse.text();
      }
    } catch {
      // Keep full URL if shortening fails
    }

    // Create invitation
    const expireDate = new Date();
    expireDate.setHours(expireDate.getHours() + expireHours);

    const invitation = await Invitation.create({
      inviter: {
        lineUserId: adminUser.lineUserId,
        displayName: adminUser.displayName,
        pictureUrl: adminUser.pictureUrl,
      },
      secretCode,
      status: 'invited',
      expireDate,
      fullUrl,
      shortUrl,
    });

    return NextResponse.json({
      success: true,
      invitation: {
        _id: invitation._id,
        secretCode: invitation.secretCode,
        fullUrl: invitation.fullUrl,
        shortUrl: invitation.shortUrl,
        expireDate: invitation.expireDate,
      },
    });
  } catch (error: any) {
    console.error('Create invitation error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Cancel invitation
export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin(request);
    await connectDB();

    const { searchParams } = new URL(request.url);
    const invitationId = searchParams.get('id');

    if (!invitationId) {
      return NextResponse.json({ error: 'Invitation ID required' }, { status: 400 });
    }

    const invitation = await Invitation.findById(invitationId);

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    if (invitation.status !== 'invited') {
      return NextResponse.json(
        { error: 'Only pending invitations can be cancelled' },
        { status: 400 }
      );
    }

    invitation.status = 'cancelled';
    await invitation.save();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Cancel invitation error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
