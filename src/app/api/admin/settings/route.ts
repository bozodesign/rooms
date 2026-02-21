import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import SystemConfig, { CONFIG_KEYS } from '@/models/SystemConfig';

// GET - Get admin settings
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    await connectDB();

    const [promptpayIdConfig, promptpayNameConfig] = await Promise.all([
      SystemConfig.findOne({ key: CONFIG_KEYS.PROMPTPAY_ID }),
      SystemConfig.findOne({ key: CONFIG_KEYS.PROMPTPAY_NAME }),
    ]);

    return NextResponse.json({
      success: true,
      settings: {
        promptpayNumber: promptpayIdConfig?.value || '',
        promptpayName: promptpayNameConfig?.value || '',
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
    await requireAdmin(request);
    await connectDB();

    const body = await request.json();
    const { promptpayNumber, promptpayName } = body;

    // Update settings in SystemConfig
    if (promptpayNumber !== undefined) {
      await SystemConfig.findOneAndUpdate(
        { key: CONFIG_KEYS.PROMPTPAY_ID },
        { key: CONFIG_KEYS.PROMPTPAY_ID, value: promptpayNumber },
        { upsert: true }
      );
    }

    if (promptpayName !== undefined) {
      await SystemConfig.findOneAndUpdate(
        { key: CONFIG_KEYS.PROMPTPAY_NAME },
        { key: CONFIG_KEYS.PROMPTPAY_NAME, value: promptpayName },
        { upsert: true }
      );
    }

    // Fetch updated values
    const [promptpayIdConfig, promptpayNameConfig] = await Promise.all([
      SystemConfig.findOne({ key: CONFIG_KEYS.PROMPTPAY_ID }),
      SystemConfig.findOne({ key: CONFIG_KEYS.PROMPTPAY_NAME }),
    ]);

    return NextResponse.json({
      success: true,
      settings: {
        promptpayNumber: promptpayIdConfig?.value || '',
        promptpayName: promptpayNameConfig?.value || '',
      },
    });
  } catch (error: any) {
    console.error('Update settings error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
