import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

// GET - Get admin settings
export async function GET(request: NextRequest) {
  try {
    const lineUserId = await requireAdmin(request);
    await connectDB();

    const admin = await User.findOne({ lineUserId, role: 'admin' });

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      settings: {
        promptpayNumber: admin.promptpayNumber,
        promptpayName: admin.promptpayName,
      },
    });
  } catch (error: any) {
    console.error('Get settings error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update admin settings
export async function PATCH(request: NextRequest) {
  try {
    const lineUserId = await requireAdmin(request);
    await connectDB();

    const body = await request.json();
    const { promptpayNumber, promptpayName } = body;

    const admin = await User.findOne({ lineUserId, role: 'admin' });

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    // Update settings
    if (promptpayNumber !== undefined) admin.promptpayNumber = promptpayNumber;
    if (promptpayName !== undefined) admin.promptpayName = promptpayName;

    await admin.save();

    return NextResponse.json({
      success: true,
      settings: {
        promptpayNumber: admin.promptpayNumber,
        promptpayName: admin.promptpayName,
      },
    });
  } catch (error: any) {
    console.error('Update settings error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
