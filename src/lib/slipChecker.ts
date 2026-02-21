// Slip verification using SLIP2GO API

export interface SlipVerificationResult {
  success: boolean;
  amount?: number;
  error?: string;
  code?: string;
}

export async function verifySlip(
  imageBuffer: ArrayBuffer,
  expectedAmount: number,
  promptpayNumber: string
): Promise<SlipVerificationResult> {
  const apiKey = process.env.SLIP2GO_API_KEY;

  if (!apiKey) {
    throw new Error('SLIP2GO_API_KEY environment variable not set');
  }

  const formData = new FormData();

  // Convert ArrayBuffer to Blob
  const blob = new Blob([new Uint8Array(imageBuffer)], { type: 'image/jpeg' });
  formData.append('file', blob, 'slip-image.jpg');

  // Clean promptpay number (remove dashes, spaces)
  const cleanPromptpay = promptpayNumber.replace(/[-\s]/g, '');

  // Determine account type: phone (10 digits) or national ID (13 digits)
  const isPhone = cleanPromptpay.length === 10;
  const accountType = isPhone ? '02001' : '02002'; // 02001 = PromptPay Phone, 02002 = PromptPay ID

  const checkDuplicate = process.env.NODE_ENV !== 'development';

  const payload = {
    checkDuplicate,
    checkReceiver: [
      {
        accountType,
        accountNumber: cleanPromptpay,
      },
    ],
    checkAmount: {
      type: 'eq',
      amount: parseFloat(expectedAmount.toString()),
    },
  };

  formData.append('payload', JSON.stringify(payload));

  const apiEndpoint = 'https://connect.slip2go.com/api/verify-slip/qr-image/info';

  try {
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    const result = await response.json();
    console.log('SLIP2GO response:', JSON.stringify(result, null, 2));

    const code = result?.code;
    const isValid = code === '200001' || code === '200200';

    if (response.ok && isValid) {
      return {
        success: true,
        amount: result?.data?.amount,
      };
    } else {
      let errorMessage = '';
      switch (code) {
        case '200401':
          errorMessage = 'บัญชีผู้รับไม่ถูกต้อง';
          break;
        case '200402':
          errorMessage = 'ยอดโอนเงินไม่ตรงกับบิล';
          break;
        case '200501':
          errorMessage = 'สลิปนี้เคยใช้แล้ว';
          break;
        default:
          errorMessage = result?.message || 'การตรวจสอบสลิปล้มเหลว';
      }

      return {
        success: false,
        error: errorMessage,
        code,
      };
    }
  } catch (error: any) {
    console.error('Slip verification error:', error);
    return {
      success: false,
      error: 'ไม่สามารถตรวจสอบสลิปได้ กรุณาลองใหม่อีกครั้ง',
    };
  }
}

// Fetch image from LINE Content API
export async function getLineImageContent(messageId: string): Promise<ArrayBuffer> {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  if (!channelAccessToken) {
    throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not configured');
  }

  const response = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
    headers: {
      Authorization: `Bearer ${channelAccessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch LINE image content: ${response.status}`);
  }

  return response.arrayBuffer();
}
