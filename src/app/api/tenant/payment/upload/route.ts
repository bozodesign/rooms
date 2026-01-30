import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Invoice from '@/models/Invoice';

// This is a simplified version. In production, you would upload to cloud storage (Cloudinary, S3, etc.)
export async function POST(request: NextRequest) {
  try {
    const lineUserId = await requireAuth(request);
    const invoiceId = request.headers.get('x-invoice-id');

    if (!invoiceId) {
      return NextResponse.json({ error: 'Invoice ID required' }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    await connectDB();

    // In production, upload to cloud storage and get URL
    // For now, we'll simulate with a placeholder
    const uploadedUrl = `https://placeholder.com/slips/${Date.now()}_${file.name}`;

    // Update invoice with payment slip URL
    const invoice = await Invoice.findByIdAndUpdate(
      invoiceId,
      {
        paymentSlipUrl: uploadedUrl,
        paymentNote: `Uploaded by tenant on ${new Date().toISOString()}`,
      },
      { new: true }
    );

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // TODO: Send LINE notification to admin about new payment slip upload

    return NextResponse.json({
      success: true,
      message: 'Payment slip uploaded successfully',
      slipUrl: uploadedUrl,
    });
  } catch (error: any) {
    console.error('Upload payment slip error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

// Configure Next.js to handle file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};
