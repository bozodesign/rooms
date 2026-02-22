import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import connectDB from '@/lib/mongodb';
import Invoice from '@/models/Invoice';
import User from '@/models/User';
import SystemConfig, { CONFIG_KEYS } from '@/models/SystemConfig';
import { replyLineMessage, createReceiptFlexMessage, createSlipErrorMessage, createAdminLinkFlexMessage } from '@/lib/line';
import { verifySlip, getLineImageContent } from '@/lib/slipChecker';

// LINE Webhook event types
interface LineEvent {
  type: string;
  replyToken: string;
  source: {
    userId: string;
    type: string;
  };
  message?: {
    type: string;
    id: string;
    text?: string;
  };
  timestamp: number;
}

interface LineWebhookBody {
  events: LineEvent[];
  destination: string;
}

// Verify LINE signature
function verifyLineSignature(body: string, signature: string): boolean {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret) {
    console.error('LINE_CHANNEL_SECRET is not configured');
    return false;
  }

  const hash = crypto
    .createHmac('sha256', channelSecret)
    .update(body)
    .digest('base64');

  return hash === signature;
}

// POST - LINE Webhook endpoint
export async function POST(request: NextRequest) {
  try {
    const bodyText = await request.text();
    const signature = request.headers.get('x-line-signature') || '';

    // Verify signature in production
    if (process.env.NODE_ENV === 'production') {
      if (!verifyLineSignature(bodyText, signature)) {
        console.error('Invalid LINE signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const body: LineWebhookBody = JSON.parse(bodyText);
    console.log('LINE Webhook received:', JSON.stringify(body, null, 2));

    // Process each event
    for (const event of body.events) {
      await processEvent(event);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('LINE Webhook error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

// Process individual LINE event
async function processEvent(event: LineEvent) {
  if (event.type !== 'message') {
    console.log('Skipping non-message event:', event.type);
    return;
  }

  const userId = event.source.userId;
  const replyToken = event.replyToken;

  // Handle text messages (admin keyword)
  if (event.message?.type === 'text') {
    const text = event.message.text?.toLowerCase().trim();
    if (text === 'admin') {
      await handleAdminKeyword(userId, replyToken);
    }
    return;
  }

  // Handle image messages (slip verification)
  if (event.message?.type !== 'image') {
    console.log('Skipping non-image/text event:', event.message?.type);
    return;
  }

  const messageId = event.message.id;
  console.log(`Processing image from user ${userId}, message ${messageId}`);

  try {
    await connectDB();

    // Find user by LINE userId
    const user = await User.findOne({ lineUserId: userId });
    if (!user) {
      console.log('User not found for LINE userId:', userId);
      await replyLineMessage(replyToken, [
        { type: 'text', text: 'ไม่พบข้อมูลผู้ใช้ในระบบ กรุณาลงทะเบียนก่อนส่งสลิป' },
      ]);
      return;
    }

    // Find pending invoice for this user
    const pendingInvoice = await Invoice.findOne({
      tenantId: user._id,
      paymentStatus: 'pending',
    })
      .sort({ year: -1, month: -1 })
      .populate('roomId', 'roomNumber');

    if (!pendingInvoice) {
      console.log('No pending invoice for user:', userId);
      await replyLineMessage(replyToken, [
        { type: 'text', text: 'ไม่พบบิลค้างชำระ ขอบคุณที่ชำระเงินตรงเวลา' },
      ]);
      return;
    }

    // Get PromptPay settings from SystemConfig
    const promptpayConfig = await SystemConfig.findOne({ key: CONFIG_KEYS.PROMPTPAY_ID });
    const promptpayNumber = promptpayConfig?.value;

    if (!promptpayNumber) {
      console.error('PromptPay number not configured');
      await replyLineMessage(replyToken, [
        { type: 'text', text: 'ระบบยังไม่ได้ตั้งค่า PromptPay กรุณาติดต่อผู้ดูแล' },
      ]);
      return;
    }

    // Fetch image content from LINE
    console.log('Fetching image from LINE...');
    const imageBuffer = await getLineImageContent(messageId);

    // Verify slip with SLIP2GO
    console.log(`Verifying slip for amount ${pendingInvoice.totalAmount}...`);
    const verificationResult = await verifySlip(
      imageBuffer,
      pendingInvoice.totalAmount,
      promptpayNumber
    );

    if (verificationResult.success) {
      // Update invoice as paid
      const paidAt = new Date();
      await Invoice.findByIdAndUpdate(pendingInvoice._id, {
        paymentStatus: 'paid',
        paidAt,
        paymentMethod: 'promptpay',
        paymentNote: 'ชำระผ่าน LINE (ตรวจสอบสลิปอัตโนมัติ)',
      });

      console.log(`Invoice ${pendingInvoice._id} marked as paid`);

      // Add to tenant's payment history
      const otherChargesTotal = (pendingInvoice.otherCharges || []).reduce(
        (sum: number, item: { amount: number }) => sum + item.amount,
        0
      );
      user.paymentHistory.push({
        invoiceId: pendingInvoice._id,
        month: pendingInvoice.month,
        year: pendingInvoice.year,
        totalAmount: pendingInvoice.totalAmount,
        baseRent: pendingInvoice.rentAmount,
        waterAmount: pendingInvoice.waterAmount,
        waterUnits: pendingInvoice.waterUnits,
        electricityAmount: pendingInvoice.electricityAmount,
        electricityUnits: pendingInvoice.electricityUnits,
        otherCharges: otherChargesTotal,
        paymentDate: paidAt,
        paymentMethod: 'promptpay',
        notes: 'ชำระผ่าน LINE (ตรวจสอบสลิปอัตโนมัติ)',
      });
      await user.save();
      console.log('Payment history added for user:', user._id);

      // Send receipt message
      const roomData = pendingInvoice.roomId as any;
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL;
      console.log('Using baseUrl for receipt:', baseUrl);
      const receiptMessage = createReceiptFlexMessage({
        roomNumber: roomData?.roomNumber || '-',
        tenantName: user.fullName || user.displayName || '-',
        month: pendingInvoice.month,
        year: pendingInvoice.year,
        rentAmount: pendingInvoice.rentAmount,
        waterAmount: pendingInvoice.waterAmount,
        waterUnits: pendingInvoice.waterUnits,
        electricityAmount: pendingInvoice.electricityAmount,
        electricityUnits: pendingInvoice.electricityUnits,
        otherCharges: pendingInvoice.otherCharges,
        totalAmount: pendingInvoice.totalAmount,
        paidAt,
      }, baseUrl);

      await replyLineMessage(replyToken, [receiptMessage]);
      console.log('Receipt sent successfully');
    } else {
      // Send error message
      console.log('Slip verification failed:', verificationResult.error);
      const errorMessage = createSlipErrorMessage(
        verificationResult.error || 'การตรวจสอบสลิปล้มเหลว'
      );
      await replyLineMessage(replyToken, [errorMessage]);
    }
  } catch (error: any) {
    console.error('Error processing slip:', error);
    try {
      await replyLineMessage(replyToken, [
        { type: 'text', text: 'เกิดข้อผิดพลาดในการตรวจสอบสลิป กรุณาลองใหม่อีกครั้ง' },
      ]);
    } catch (replyError) {
      console.error('Failed to send error reply:', replyError);
    }
  }
}

// Handle 'admin' keyword - send admin portal link if user is admin
async function handleAdminKeyword(userId: string, replyToken: string) {
  try {
    await connectDB();

    // Find user by LINE userId
    const user = await User.findOne({ lineUserId: userId });

    if (!user) {
      await replyLineMessage(replyToken, [
        { type: 'text', text: 'ไม่พบข้อมูลผู้ใช้ในระบบ' },
      ]);
      return;
    }

    // Check if user is admin - silently ignore if not
    if (user.role !== 'admin') {
      console.log(`User ${userId} is not admin, ignoring admin keyword`);
      return;
    }

    // Get LIFF ID from environment
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    if (!liffId) {
      console.error('NEXT_PUBLIC_LIFF_ID not configured');
      await replyLineMessage(replyToken, [
        { type: 'text', text: 'ระบบยังไม่ได้ตั้งค่า LIFF ID กรุณาติดต่อผู้พัฒนา' },
      ]);
      return;
    }

    // Send admin link flex message
    const adminLinkMessage = createAdminLinkFlexMessage(liffId);
    await replyLineMessage(replyToken, [adminLinkMessage]);
    console.log(`Admin link sent to user ${userId}`);
  } catch (error: any) {
    console.error('Error handling admin keyword:', error);
    try {
      await replyLineMessage(replyToken, [
        { type: 'text', text: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' },
      ]);
    } catch (replyError) {
      console.error('Failed to send error reply:', replyError);
    }
  }
}

// GET - Webhook verification (for LINE console setup)
export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'LINE Webhook endpoint' });
}
