'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate, getPaymentStatusColor, getPaymentStatusLabel } from '@/lib/utils';
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
  otherCharges: number;
  discount: number;
  totalAmount: number;
  paymentStatus: 'pending' | 'paid' | 'overdue';
  dueDate: string;
  paidAt?: string;
  roomNumber: string;
}

async function fetchCurrentInvoice(lineUserId: string): Promise<Invoice | null> {
  const res = await fetch('/api/tenant/invoice/current', {
    headers: {
      'x-line-userid': lineUserId,
    },
  });

  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error('Failed to fetch invoice');
  }

  const data = await res.json();
  return data.invoice;
}

async function fetchInvoiceHistory(lineUserId: string): Promise<Invoice[]> {
  const res = await fetch('/api/tenant/invoice/history', {
    headers: {
      'x-line-userid': lineUserId,
    },
  });

  if (!res.ok) {
    throw new Error('Failed to fetch invoice history');
  }

  const data = await res.json();
  return data.invoices;
}

export default function TenantDashboard({ lineUserId }: { lineUserId: string }) {
  const { data: currentInvoice, isLoading: loadingCurrent } = useQuery({
    queryKey: ['current-invoice', lineUserId],
    queryFn: () => fetchCurrentInvoice(lineUserId),
  });

  const { data: history, isLoading: loadingHistory } = useQuery({
    queryKey: ['invoice-history', lineUserId],
    queryFn: () => fetchInvoiceHistory(lineUserId),
  });

  if (loadingCurrent) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4 pb-20">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="text-center py-6">
          <h1 className="text-2xl font-bold text-gray-800">บิลค่าเช่าของฉัน</h1>
        </div>

        {/* Current Invoice */}
        {currentInvoice ? (
          <Card className="bg-white shadow-lg">
            <CardHeader className="bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-t-lg">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl">ห้อง {currentInvoice.roomNumber}</CardTitle>
                  <p className="text-sm mt-1">
                    {currentInvoice.month}/{currentInvoice.year}
                  </p>
                </div>
                <div
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${getPaymentStatusColor(
                    currentInvoice.paymentStatus
                  )}`}
                >
                  {getPaymentStatusLabel(currentInvoice.paymentStatus)}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              {/* Invoice Details */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">ค่าเช่าห้อง</span>
                  <span className="font-semibold">{formatCurrency(currentInvoice.rentAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">ค่าน้ำ ({currentInvoice.waterUnits} หน่วย)</span>
                  <span className="font-semibold">{formatCurrency(currentInvoice.waterAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    ค่าไฟ ({currentInvoice.electricityUnits} หน่วย)
                  </span>
                  <span className="font-semibold">{formatCurrency(currentInvoice.electricityAmount)}</span>
                </div>
                {currentInvoice.otherCharges > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">ค่าใช้จ่ายอื่นๆ</span>
                    <span className="font-semibold">{formatCurrency(currentInvoice.otherCharges)}</span>
                  </div>
                )}
                {currentInvoice.discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>ส่วนลด</span>
                    <span className="font-semibold">-{formatCurrency(currentInvoice.discount)}</span>
                  </div>
                )}
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between">
                    <span className="font-bold text-lg">ยอดรวม</span>
                    <span className="font-bold text-lg text-green-600">
                      {formatCurrency(currentInvoice.totalAmount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Due Date */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600">กำหนดชำระ</p>
                <p className="font-semibold text-gray-800">{formatDate(currentInvoice.dueDate)}</p>
              </div>

              {/* Action Buttons */}
              {currentInvoice.paymentStatus !== 'paid' && (
                <div className="space-y-2">
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700"
                    onClick={() => (window.location.href = `/tenant/payment/${currentInvoice.id}`)}
                  >
                    ชำระเงิน
                  </Button>
                </div>
              )}

              {currentInvoice.paymentStatus === 'paid' && currentInvoice.paidAt && (
                <div className="bg-green-50 p-3 rounded-lg text-center">
                  <p className="text-sm text-green-700">ชำระเงินเรียบร้อยแล้ว</p>
                  <p className="text-xs text-green-600 mt-1">
                    {formatDate(currentInvoice.paidAt)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-white">
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">ยังไม่มีบิลสำหรับเดือนนี้</p>
            </CardContent>
          </Card>
        )}

        {/* Invoice History */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-lg">ประวัติการชำระ</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingHistory ? (
              <p className="text-center text-gray-500">กำลังโหลด...</p>
            ) : history && history.length > 0 ? (
              <div className="space-y-3">
                {history.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                    onClick={() => (window.location.href = `/tenant/invoice/${invoice.id}`)}
                  >
                    <div>
                      <p className="font-semibold text-sm">
                        {invoice.month}/{invoice.year}
                      </p>
                      <p className="text-xs text-gray-500">ห้อง {invoice.roomNumber}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm">{formatCurrency(invoice.totalAmount)}</p>
                      <p
                        className={`text-xs px-2 py-0.5 rounded-full inline-block mt-1 ${getPaymentStatusColor(
                          invoice.paymentStatus
                        )}`}
                      >
                        {getPaymentStatusLabel(invoice.paymentStatus)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500">ยังไม่มีประวัติการชำระ</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
