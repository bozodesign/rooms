import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import GeneratedInvoice from '@/models/GeneratedInvoice';

// GET - Get single invoice by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    const { id } = await params;
    const invoice = await GeneratedInvoice.findById(id).lean();

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

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
    console.error('Get generated invoice error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT - Update invoice
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    const { id } = await params;
    const body = await request.json();
    const { name, type, data } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (data !== undefined) updateData.data = data;

    const invoice = await GeneratedInvoice.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).lean();

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

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
    console.error('Update generated invoice error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - Delete invoice
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    const { id } = await params;
    const invoice = await GeneratedInvoice.findByIdAndDelete(id);

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Invoice deleted successfully',
    });
  } catch (error: unknown) {
    console.error('Delete generated invoice error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
