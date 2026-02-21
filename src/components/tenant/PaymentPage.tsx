'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getPromptPayQRCodeUrl } from '@/lib/promptpay';
import LoadingScreen from '@/components/LoadingScreen';

interface Invoice {
  id: string;
  month: number;
  year: number;
  rentAmount: number;
  waterAmount: number;
  electricityAmount: number;
  waterUnits: number;
  electricityUnits: number;
  totalAmount: number;
  paymentStatus: 'pending' | 'paid' | 'overdue';
  dueDate: string;
  roomNumber: string;
}

async function fetchInvoice(invoiceId: string, lineUserId: string): Promise<Invoice> {
  const res = await fetch(`/api/tenant/invoice/${invoiceId}`, {
    headers: {
      'x-line-userid': lineUserId,
    },
  });

  if (!res.ok) {
    throw new Error('Failed to fetch invoice');
  }

  const data = await res.json();
  return data.invoice;
}

async function uploadPaymentSlip(invoiceId: string, file: File, lineUserId: string) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`/api/tenant/payment/upload`, {
    method: 'POST',
    headers: {
      'x-line-userid': lineUserId,
      'x-invoice-id': invoiceId,
    },
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Failed to upload payment slip');
  }

  return res.json();
}

export default function PaymentPage({
  invoiceId,
  lineUserId,
}: {
  invoiceId: string;
  lineUserId: string;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => fetchInvoice(invoiceId, lineUserId),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadPaymentSlip(invoiceId, file, lineUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['current-invoice'] });
      alert('อัพโหลดสลิปเรียบร้อยแล้ว! รอการตรวจสอบจากเจ้าของหอพัก');
      window.location.href = '/tenant/dashboard';
    },
    onError: (error: Error) => {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = () => {
    if (!selectedFile) {
      alert('กรุณาเลือกไฟล์สลิป');
      return;
    }
    uploadMutation.mutate(selectedFile);
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!invoice) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-50">
        <p className="text-red-600">ไม่พบบิล</p>
      </div>
    );
  }

  const promptPayId = process.env.NEXT_PUBLIC_PROMPTPAY_ID || '0123456789';
  const qrCodeUrl = getPromptPayQRCodeUrl(promptPayId, invoice.totalAmount);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="text-center py-6">
          <h1 className="text-2xl font-bold text-gray-800">ชำระค่าเช่า</h1>
          <p className="text-gray-600 mt-1">
            ห้อง {invoice.roomNumber} - {invoice.month}/{invoice.year}
          </p>
        </div>

        {/* Invoice Summary */}
        <Card className="bg-white shadow-lg">
          <CardHeader className="bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-t-lg">
            <CardTitle className="text-center text-xl">ยอดชำระทั้งหมด</CardTitle>
            <p className="text-center text-3xl font-bold mt-2">
              {formatCurrency(invoice.totalAmount)}
            </p>
          </CardHeader>
          <CardContent className="pt-6 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">ค่าเช่าห้อง</span>
              <span className="font-semibold">{formatCurrency(invoice.rentAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">ค่าน้ำ ({invoice.waterUnits} หน่วย)</span>
              <span className="font-semibold">{formatCurrency(invoice.waterAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">ค่าไฟ ({invoice.electricityUnits} หน่วย)</span>
              <span className="font-semibold">{formatCurrency(invoice.electricityAmount)}</span>
            </div>
            <div className="border-t pt-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">กำหนดชำระ</span>
                <span className="font-semibold text-red-600">{formatDate(invoice.dueDate)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PromptPay QR Code */}
        <Card className="bg-white shadow-lg">
          <CardHeader>
            <CardTitle className="text-center text-lg">สแกน QR Code เพื่อชำระเงิน</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
              <img
                src={qrCodeUrl}
                alt="PromptPay QR Code"
                className="w-64 h-64"
                crossOrigin="anonymous"
              />
            </div>
            <p className="text-center text-sm text-gray-600 mt-4">
              สแกน QR Code ด้วยแอพธนาคารของคุณ
            </p>
            <p className="text-center text-xs text-gray-500 mt-1">
              PromptPay ID: {promptPayId}
            </p>
          </CardContent>
        </Card>

        {/* Payment Slip Upload */}
        <Card className="bg-white shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">อัพโหลดสลิปการโอนเงิน</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
              />
            </div>

            {previewUrl && (
              <div className="mt-4">
                <p className="text-sm text-gray-600 mb-2">ตัวอย่างสลิป:</p>
                <img src={previewUrl} alt="Preview" className="w-full rounded-lg border" />
              </div>
            )}

            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploadMutation.isPending}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {uploadMutation.isPending ? 'กำลังอัพโหลด...' : 'ส่งสลิปการชำระเงิน'}
            </Button>

            <p className="text-xs text-gray-500 text-center">
              หลังจากอัพโหลดสลิป เจ้าของหอพักจะตรวจสอบและอัพเดทสถานะการชำระเงินของคุณ
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
