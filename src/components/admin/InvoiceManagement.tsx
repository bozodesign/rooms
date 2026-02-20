'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatCurrency } from '@/lib/utils';

interface OtherChargeItem {
  description: string;
  amount: number;
}

interface Invoice {
  _id: string;
  roomId: {
    _id: string;
    roomNumber: string;
    floor: number;
  };
  tenantId: {
    _id: string;
    displayName: string;
    fullName?: string;
    pictureUrl?: string;
  };
  month: number;
  year: number;
  waterUnits: number;
  electricityUnits: number;
  previousWaterReading?: number;
  currentWaterReading?: number;
  previousElectricityReading?: number;
  currentElectricityReading?: number;
  rentAmount: number;
  waterAmount: number;
  electricityAmount: number;
  otherCharges: OtherChargeItem[];
  discount?: number;
  totalAmount: number;
  paymentStatus: 'pending' | 'paid' | 'overdue';
  dueDate: string;
  paidAt?: string;
}

interface MeterReadingHistory {
  value: number;
  recordedAt: string;
  recordedBy?: string;
  notes?: string;
}

interface Room {
  _id: string;
  roomNumber: string;
  floor: number;
  status: 'vacant' | 'occupied' | 'maintenance';
  tenantId?: {
    _id: string;
    displayName: string;
    fullName?: string;
  };
  baseRentPrice: number;
  waterRate?: number;
  electricityRate?: number;
  waterMeterReadings?: MeterReadingHistory[];
  electricityMeterReadings?: MeterReadingHistory[];
}

async function fetchInvoices(
  lineUserId: string,
  month: number,
  year: number
): Promise<{ invoices: Invoice[] }> {
  const res = await fetch(`/api/admin/invoices?month=${month}&year=${year}`, {
    headers: { 'x-line-userid': lineUserId },
  });
  if (!res.ok) throw new Error('Failed to fetch invoices');
  return res.json();
}

async function fetchRooms(lineUserId: string): Promise<{ rooms: Room[] }> {
  const res = await fetch('/api/admin/rooms', {
    headers: { 'x-line-userid': lineUserId },
  });
  if (!res.ok) throw new Error('Failed to fetch rooms');
  return res.json();
}

async function calculateInvoices(
  lineUserId: string,
  roomIds: string[],
  month: number,
  year: number,
  dueDate: string
) {
  const res = await fetch('/api/admin/invoices', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-line-userid': lineUserId,
    },
    body: JSON.stringify({ roomIds, month, year, dueDate }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to calculate invoices');
  }
  return res.json();
}

async function updateInvoice(
  lineUserId: string,
  invoiceId: string,
  data: { otherCharges?: OtherChargeItem[]; paymentStatus?: string }
) {
  const res = await fetch(`/api/admin/invoices/${invoiceId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-line-userid': lineUserId,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to update invoice');
  }
  return res.json();
}

const MONTHS = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];

export default function InvoiceManagement({ lineUserId }: { lineUserId: string }) {
  const queryClient = useQueryClient();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [otherChargesList, setOtherChargesList] = useState<OtherChargeItem[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [searchRoomNumber, setSearchRoomNumber] = useState('');
  const [meterWarnings, setMeterWarnings] = useState<
    { roomNumber: string; missingWater: boolean; missingElectricity: boolean }[]
  >([]);
  const [showMeterWarning, setShowMeterWarning] = useState(false);

  const { data: invoicesData, isLoading: invoicesLoading } = useQuery({
    queryKey: ['invoices', lineUserId, selectedMonth, selectedYear],
    queryFn: () => fetchInvoices(lineUserId, selectedMonth, selectedYear),
  });

  const { data: roomsData } = useQuery({
    queryKey: ['rooms', lineUserId],
    queryFn: () => fetchRooms(lineUserId),
  });

  const calculateMutation = useMutation({
    mutationFn: ({
      roomIds,
      month,
      year,
      dueDate,
    }: {
      roomIds: string[];
      month: number;
      year: number;
      dueDate: string;
    }) => calculateInvoices(lineUserId, roomIds, month, year, dueDate),
    onSuccess: (data: { created: number; failed: number; errors?: { roomId: string; error: string }[] }) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setIsCalculating(false);

      // Show result message
      if (data.created > 0 && data.failed === 0) {
        alert(`สร้างบิลสำเร็จ ${data.created} รายการ`);
      } else if (data.created > 0 && data.failed > 0) {
        const errorMessages = data.errors?.map(e => e.error).join(', ') || '';
        alert(`สร้างบิลสำเร็จ ${data.created} รายการ\nข้าม ${data.failed} รายการ (${errorMessages})`);
      } else if (data.failed > 0) {
        const errorMessages = data.errors?.map(e => e.error).join(', ') || '';
        alert(`ไม่สามารถสร้างบิลได้: ${errorMessages}`);
      }
    },
    onError: (error: Error) => {
      alert(error.message);
      setIsCalculating(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      invoiceId,
      data,
    }: {
      invoiceId: string;
      data: { otherCharges?: OtherChargeItem[]; paymentStatus?: string };
    }) => updateInvoice(lineUserId, invoiceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setEditingInvoice(null);
    },
    onError: (error: Error) => {
      alert(error.message);
    },
  });

  const invoices = invoicesData?.invoices || [];
  const rooms = roomsData?.rooms || [];
  const occupiedRooms = rooms.filter((r) => r.status === 'occupied' && r.tenantId);

  // Check if a room has meter reading for the selected month/year
  const hasReadingForMonth = (
    readings: MeterReadingHistory[] | undefined,
    month: number,
    year: number
  ): boolean => {
    if (!readings || readings.length === 0) return false;
    return readings.some((reading) => {
      const recordedDate = new Date(reading.recordedAt);
      return recordedDate.getMonth() + 1 === month && recordedDate.getFullYear() === year;
    });
  };

  // Get rooms with missing meter readings for the selected month
  const getRoomsMissingReadings = () => {
    return occupiedRooms
      .map((room) => {
        const missingWater = !hasReadingForMonth(
          room.waterMeterReadings,
          selectedMonth,
          selectedYear
        );
        const missingElectricity = !hasReadingForMonth(
          room.electricityMeterReadings,
          selectedMonth,
          selectedYear
        );
        if (missingWater || missingElectricity) {
          return {
            roomNumber: room.roomNumber,
            missingWater,
            missingElectricity,
          };
        }
        return null;
      })
      .filter(Boolean) as { roomNumber: string; missingWater: boolean; missingElectricity: boolean }[];
  };

  // Filter invoices by room number search
  const filteredInvoices = searchRoomNumber
    ? invoices.filter((inv) =>
        inv.roomId?.roomNumber?.toLowerCase().includes(searchRoomNumber.toLowerCase())
      )
    : invoices;

  const handleCalculate = () => {
    if (occupiedRooms.length === 0) {
      alert('ไม่มีห้องที่มีผู้เช่า');
      return;
    }

    // Check for rooms missing meter readings
    const warnings = getRoomsMissingReadings();
    if (warnings.length > 0) {
      setMeterWarnings(warnings);
      setShowMeterWarning(true);
      return;
    }

    proceedWithCalculation();
  };

  const proceedWithCalculation = () => {
    const dueDate = new Date(selectedYear, selectedMonth, 15);

    setShowMeterWarning(false);
    setMeterWarnings([]);
    setIsCalculating(true);
    calculateMutation.mutate({
      roomIds: occupiedRooms.map((r) => r._id),
      month: selectedMonth,
      year: selectedYear,
      dueDate: dueDate.toISOString(),
    });
  };

  const handleEditInvoice = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setOtherChargesList(invoice.otherCharges || []);
  };

  const handleAddOtherCharge = () => {
    setOtherChargesList([...otherChargesList, { description: '', amount: 0 }]);
  };

  const handleRemoveOtherCharge = (index: number) => {
    setOtherChargesList(otherChargesList.filter((_, i) => i !== index));
  };

  const handleOtherChargeChange = (
    index: number,
    field: 'description' | 'amount',
    value: string | number
  ) => {
    const updated = [...otherChargesList];
    if (field === 'description') {
      updated[index].description = value as string;
    } else {
      updated[index].amount = value as number;
    }
    setOtherChargesList(updated);
  };

  const handleSaveInvoice = () => {
    if (!editingInvoice) return;

    const validCharges = otherChargesList.filter(
      (item) => item.description.trim() && item.amount !== 0
    );

    updateMutation.mutate({
      invoiceId: editingInvoice._id,
      data: {
        otherCharges: validCharges,
      },
    });
  };

  const handleMarkAsPaid = (invoiceId: string) => {
    if (!confirm('ยืนยันว่าได้รับชำระเงินแล้ว?')) return;

    updateMutation.mutate({
      invoiceId,
      data: {
        paymentStatus: 'paid',
      },
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
            ชำระแล้ว
          </span>
        );
      case 'overdue':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
            เกินกำหนด
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
            รอชำระ
          </span>
        );
    }
  };

  const calculateOtherChargesTotal = (charges: OtherChargeItem[]) => {
    return (charges || []).reduce((sum, item) => sum + (item.amount || 0), 0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 pb-24">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900">จัดการบิล</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        {/* Month/Year Selector */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">เดือน</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {MONTHS.map((month, index) => (
                  <option key={index} value={index + 1}>
                    {month}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">ปี</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {[now.getFullYear(), now.getFullYear() + 1, now.getFullYear() + 2].map((year) => (
                  <option key={year} value={year}>
                    {year + 543}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Calculate Button */}
          <button
            onClick={handleCalculate}
            disabled={isCalculating || calculateMutation.isPending}
            className="mt-4 w-full bg-blue-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isCalculating || calculateMutation.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                กำลังคำนวณ...
              </span>
            ) : (
              'คำนวณค่าห้อง'
            )}
          </button>

          <p className="mt-2 text-xs text-gray-500 text-center">
            จะคำนวณบิลสำหรับห้องที่มีผู้เช่าทั้งหมด {occupiedRooms.length} ห้อง
          </p>
        </div>

        {/* Room Number Search */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ค้นหาตามเลขห้อง
          </label>
          <div className="relative">
            <input
              type="text"
              value={searchRoomNumber}
              onChange={(e) => setSearchRoomNumber(e.target.value)}
              placeholder="พิมพ์เลขห้อง..."
              className="w-full p-3 pl-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <svg
              className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            {searchRoomNumber && (
              <button
                onClick={() => setSearchRoomNumber('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Invoices List */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">
              รายการบิล {MONTHS[selectedMonth - 1]} {selectedYear + 543}
              {searchRoomNumber && (
                <span className="text-sm font-normal text-gray-500 ml-2">
                  (พบ {filteredInvoices.length} รายการ)
                </span>
              )}
            </h2>
          </div>

          {invoicesLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500">กำลังโหลด...</p>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <svg
                className="w-12 h-12 mx-auto text-gray-300 mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              {searchRoomNumber ? (
                <>
                  <p>ไม่พบบิลสำหรับห้อง "{searchRoomNumber}"</p>
                  <p className="text-sm mt-1">ลองค้นหาเลขห้องอื่น</p>
                </>
              ) : (
                <>
                  <p>ยังไม่มีบิลสำหรับเดือนนี้</p>
                  <p className="text-sm mt-1">กดปุ่ม "คำนวณค่าห้อง" เพื่อสร้างบิล</p>
                </>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredInvoices.map((invoice) => {
                const tenantFullName = invoice.tenantId?.fullName;
                const otherChargesTotal = calculateOtherChargesTotal(invoice.otherCharges);

                return (
                  <div key={invoice._id} className="p-4 hover:bg-gray-50">
                    {/* Tenant Info at Top */}
                    <div className="flex items-center gap-3 mb-3">
                      {invoice.tenantId?.pictureUrl ? (
                        <img
                          src={invoice.tenantId.pictureUrl}
                          alt={invoice.tenantId.displayName}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                          <svg
                            className="w-6 h-6 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            />
                          </svg>
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">
                          {tenantFullName || invoice.tenantId?.displayName || 'ไม่มีข้อมูลผู้เช่า'}
                        </p>
                        {tenantFullName && invoice.tenantId?.displayName && (
                          <p className="text-sm text-gray-500">({invoice.tenantId.displayName})</p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                          ห้อง {invoice.roomId?.roomNumber}
                        </div>
                      </div>
                    </div>

                    {/* Invoice Summary */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-lg font-bold text-gray-900">
                        {formatCurrency(invoice.totalAmount)}
                      </div>
                      {getStatusBadge(invoice.paymentStatus)}
                    </div>

                    {/* Invoice Details */}
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-gray-500">ค่าเช่า</p>
                        <p className="font-medium">{formatCurrency(invoice.rentAmount)}</p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-2">
                        <p className="text-blue-600">น้ำ ({invoice.waterUnits} หน่วย)</p>
                        <p className="font-medium">{formatCurrency(invoice.waterAmount)}</p>
                      </div>
                      <div className="bg-yellow-50 rounded-lg p-2">
                        <p className="text-yellow-600">ไฟ ({invoice.electricityUnits} หน่วย)</p>
                        <p className="font-medium">{formatCurrency(invoice.electricityAmount)}</p>
                      </div>
                    </div>

                    {/* Other Charges */}
                    {invoice.otherCharges && invoice.otherCharges.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {invoice.otherCharges.map((charge, idx) => (
                          <div
                            key={idx}
                            className={`rounded-lg p-2 text-sm flex justify-between ${
                              charge.amount < 0
                                ? 'bg-green-50'
                                : 'bg-orange-50'
                            }`}
                          >
                            <span className={charge.amount < 0 ? 'text-green-700' : 'text-orange-700'}>
                              {charge.description}
                            </span>
                            <span className={`font-medium ${charge.amount < 0 ? 'text-green-600' : ''}`}>
                              {formatCurrency(charge.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => handleEditInvoice(invoice)}
                        className="flex-1 py-2 px-3 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        แก้ไข
                      </button>
                      {invoice.paymentStatus !== 'paid' && (
                        <button
                          onClick={() => handleMarkAsPaid(invoice._id)}
                          className="flex-1 py-2 px-3 text-sm font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                        >
                          รับชำระแล้ว
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editingInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                แก้ไขบิล - ห้อง {editingInvoice.roomId?.roomNumber}
              </h2>
              <button
                onClick={() => setEditingInvoice(null)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Tenant Info */}
              <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                {editingInvoice.tenantId?.pictureUrl ? (
                  <img
                    src={editingInvoice.tenantId.pictureUrl}
                    alt={editingInvoice.tenantId.displayName}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  </div>
                )}
                <div>
                  <p className="font-medium text-gray-900">
                    {editingInvoice.tenantId?.fullName ||
                      editingInvoice.tenantId?.displayName ||
                      'ไม่มีข้อมูลผู้เช่า'}
                  </p>
                  {editingInvoice.tenantId?.fullName &&
                    editingInvoice.tenantId?.displayName && (
                      <p className="text-sm text-gray-500">
                        ({editingInvoice.tenantId.displayName})
                      </p>
                    )}
                </div>
              </div>

              {/* Invoice Summary */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">ค่าเช่า</span>
                  <span className="font-medium">{formatCurrency(editingInvoice.rentAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">
                    ค่าน้ำ ({editingInvoice.waterUnits} หน่วย)
                  </span>
                  <span className="font-medium">{formatCurrency(editingInvoice.waterAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">
                    ค่าไฟ ({editingInvoice.electricityUnits} หน่วย)
                  </span>
                  <span className="font-medium">
                    {formatCurrency(editingInvoice.electricityAmount)}
                  </span>
                </div>
              </div>

              {/* Other Charges List */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">ค่าอื่นๆ</label>
                  <button
                    onClick={handleAddOtherCharge}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    เพิ่มรายการ
                  </button>
                </div>

                {otherChargesList.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">ยังไม่มีค่าอื่นๆ</p>
                ) : (
                  <div className="space-y-2">
                    {otherChargesList.map((charge, index) => (
                      <div key={index} className="flex gap-2 items-start">
                        <input
                          type="text"
                          value={charge.description}
                          onChange={(e) =>
                            handleOtherChargeChange(index, 'description', e.target.value)
                          }
                          placeholder="รายละเอียด"
                          className="flex-1 p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <input
                          type="number"
                          value={charge.amount || ''}
                          onChange={(e) =>
                            handleOtherChargeChange(
                              index,
                              'amount',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          placeholder="บาท"
                          className={`w-24 p-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                            charge.amount < 0 ? 'border-red-300 text-red-600' : 'border-gray-300'
                          }`}
                        />
                        <button
                          onClick={() => handleRemoveOtherCharge(index)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Total */}
              <div className="bg-blue-50 rounded-xl p-4">
                <div className="flex justify-between items-center">
                  <span className="text-blue-800 font-medium">ยอดรวมทั้งหมด</span>
                  <span className="text-xl font-bold text-blue-600">
                    {formatCurrency(
                      editingInvoice.rentAmount +
                        editingInvoice.waterAmount +
                        editingInvoice.electricityAmount +
                        calculateOtherChargesTotal(otherChargesList) -
                        (editingInvoice.discount || 0)
                    )}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setEditingInvoice(null)}
                  className="flex-1 py-3 px-4 text-gray-700 bg-gray-100 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleSaveInvoice}
                  disabled={updateMutation.isPending}
                  className="flex-1 py-3 px-4 text-white bg-blue-600 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {updateMutation.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Meter Reading Warning Modal */}
      {showMeterWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-yellow-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">
                ห้องยังไม่บันทึกมิเตอร์
              </h2>
            </div>

            <div className="p-4">
              <p className="text-sm text-gray-600 mb-4">
                ห้องเหล่านี้ยังไม่มีการบันทึกค่ามิเตอร์ในเดือน {MONTHS[selectedMonth - 1]}{' '}
                {selectedYear + 543}:
              </p>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {meterWarnings.map((warning, index) => (
                  <div
                    key={index}
                    className="bg-yellow-50 border border-yellow-200 rounded-lg p-3"
                  >
                    <p className="font-medium text-yellow-800">ห้อง {warning.roomNumber}</p>
                    <div className="mt-1 text-sm text-yellow-700">
                      {warning.missingWater && warning.missingElectricity ? (
                        <span>ยังไม่บันทึกมิเตอร์น้ำและไฟ</span>
                      ) : warning.missingWater ? (
                        <span>ยังไม่บันทึกมิเตอร์น้ำ</span>
                      ) : (
                        <span>ยังไม่บันทึกมิเตอร์ไฟ</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-4 text-sm text-gray-500">
                หากคำนวณบิลตอนนี้ ค่าน้ำ/ค่าไฟจะคำนวณจากค่าที่บันทึกล่าสุด ซึ่งอาจไม่ถูกต้อง
              </p>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => {
                    setShowMeterWarning(false);
                    setMeterWarnings([]);
                  }}
                  className="flex-1 py-3 px-4 text-gray-700 bg-gray-100 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={proceedWithCalculation}
                  className="flex-1 py-3 px-4 text-white bg-yellow-600 rounded-xl font-medium hover:bg-yellow-700 transition-colors"
                >
                  คำนวณต่อ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
