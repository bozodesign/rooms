import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import SystemConfig from '@/models/SystemConfig';

const CONFIG_KEY = 'invoice_generator_defaults';

// GET - Get default settings
export async function GET() {
  try {
    await connectDB();

    const config = await SystemConfig.findOne({ key: CONFIG_KEY }).lean();

    return NextResponse.json({
      success: true,
      defaults: config?.value || null,
    });
  } catch (error: unknown) {
    console.error('Get invoice generator defaults error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST - Save default settings
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { defaults } = body;

    if (!defaults) {
      return NextResponse.json(
        { error: 'Defaults data is required' },
        { status: 400 }
      );
    }

    await SystemConfig.findOneAndUpdate(
      { key: CONFIG_KEY },
      { key: CONFIG_KEY, value: defaults },
      { upsert: true, new: true }
    );

    return NextResponse.json({
      success: true,
      message: 'Defaults saved successfully',
    });
  } catch (error: unknown) {
    console.error('Save invoice generator defaults error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
