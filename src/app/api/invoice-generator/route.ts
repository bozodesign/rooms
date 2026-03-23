import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import GeneratedInvoice, { GeneratedInvoiceType } from '@/models/GeneratedInvoice';

// GET - List all saved invoices
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') as GeneratedInvoiceType | null;

    const query: Record<string, unknown> = {};
    if (type) {
      query.type = type;
    }

    const invoices = await GeneratedInvoice.find(query)
      .sort({ updatedAt: -1 })
      .select('_id name type updatedAt createdAt')
      .lean();

    return NextResponse.json({
      success: true,
      invoices: invoices.map((inv) => ({
        id: inv._id.toString(),
        name: inv.name,
        type: inv.type,
        updatedAt: inv.updatedAt,
        createdAt: inv.createdAt,
      })),
    });
  } catch (error: unknown) {
    console.error('List generated invoices error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST - Create new invoice
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { name, type = 'invoice', data } = body;

    if (!name || !data) {
      return NextResponse.json(
        { error: 'Name and data are required' },
        { status: 400 }
      );
    }

    const invoice = await GeneratedInvoice.create({
      name,
      type,
      data,
    });

    return NextResponse.json({
      success: true,
      invoice: {
        id: invoice._id.toString(),
        name: invoice.name,
        type: invoice.type,
        data: invoice.data,
        updatedAt: invoice.updatedAt,
        createdAt: invoice.createdAt,
      },
    });
  } catch (error: unknown) {
    console.error('Create generated invoice error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
