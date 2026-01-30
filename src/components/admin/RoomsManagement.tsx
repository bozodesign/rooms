'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';

interface Room {
  _id: string;
  roomNumber: string;
  floor: number;
  baseRentPrice: number;
  status: 'vacant' | 'occupied' | 'maintenance';
  tenantId?: {
    _id: string;
    displayName: string;
    phoneNumber?: string;
  };
  waterRate?: number;
  electricityRate?: number;
  depositAmount?: number;
  notes?: string;
}

interface RoomFormData {
  roomNumber: string;
  floor: number;
  baseRentPrice: number;
  waterRate: number;
  electricityRate: number;
  depositAmount: number;
  notes: string;
}

async function fetchRooms(lineUserId: string): Promise<{ rooms: Room[] }> {
  const res = await fetch('/api/admin/rooms', {
    headers: {
      'x-line-userid': lineUserId,
    },
  });

  if (!res.ok) {
    throw new Error('Failed to fetch rooms');
  }

  return res.json();
}

async function createRoom(lineUserId: string, data: RoomFormData) {
  const res = await fetch('/api/admin/rooms', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-line-userid': lineUserId,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to create room');
  }

  return res.json();
}

async function updateRoom(lineUserId: string, roomId: string, data: Partial<RoomFormData>) {
  const res = await fetch(`/api/admin/rooms/${roomId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-line-userid': lineUserId,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to update room');
  }

  return res.json();
}

async function deleteRoom(lineUserId: string, roomId: string) {
  const res = await fetch(`/api/admin/rooms/${roomId}`, {
    method: 'DELETE',
    headers: {
      'x-line-userid': lineUserId,
    },
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to delete room');
  }

  return res.json();
}

async function generateQRToken(lineUserId: string, roomId: string) {
  const res = await fetch(`/api/admin/rooms/${roomId}/qr`, {
    method: 'POST',
    headers: {
      'x-line-userid': lineUserId,
    },
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to generate QR code');
  }

  return res.json();
}

async function batchCreateRooms(lineUserId: string, rooms: RoomFormData[]) {
  const res = await fetch('/api/admin/rooms/batch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-line-userid': lineUserId,
    },
    body: JSON.stringify({ rooms }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to batch create rooms');
  }

  return res.json();
}

export default function RoomsManagement({ lineUserId }: { lineUserId: string }) {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [selectedRoomForQR, setSelectedRoomForQR] = useState<Room | null>(null);
  const [qrCodeData, setQrCodeData] = useState<{ url: string; dataUrl: string } | null>(null);
  const [batchInput, setBatchInput] = useState('');

  const [formData, setFormData] = useState<RoomFormData>({
    roomNumber: '',
    floor: 1,
    baseRentPrice: 0,
    waterRate: 18,
    electricityRate: 8,
    depositAmount: 0,
    notes: '',
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-rooms', lineUserId],
    queryFn: () => fetchRooms(lineUserId),
  });

  const createMutation = useMutation({
    mutationFn: (data: RoomFormData) => createRoom(lineUserId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-rooms'] });
      setShowAddForm(false);
      resetForm();
      alert('เพิ่มห้องเรียบร้อยแล้ว');
    },
    onError: (error: Error) => {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ roomId, data }: { roomId: string; data: Partial<RoomFormData> }) =>
      updateRoom(lineUserId, roomId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-rooms'] });
      setEditingRoom(null);
      resetForm();
      alert('อัปเดตห้องเรียบร้อยแล้ว');
    },
    onError: (error: Error) => {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (roomId: string) => deleteRoom(lineUserId, roomId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-rooms'] });
      alert('ลบห้องเรียบร้อยแล้ว');
    },
    onError: (error: Error) => {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    },
  });

  const qrMutation = useMutation({
    mutationFn: (roomId: string) => generateQRToken(lineUserId, roomId),
    onSuccess: async (data) => {
      try {
        const qrDataUrl = await QRCode.toDataURL(data.assignmentUrl, {
          width: 300,
          margin: 2,
        });
        setQrCodeData({ url: data.assignmentUrl, dataUrl: qrDataUrl });
      } catch (error) {
        console.error('QR Code generation error:', error);
        alert('เกิดข้อผิดพลาดในการสร้าง QR Code');
      }
    },
    onError: (error: Error) => {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    },
  });

  const batchMutation = useMutation({
    mutationFn: (rooms: RoomFormData[]) => batchCreateRooms(lineUserId, rooms),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-rooms'] });
      setShowBatchForm(false);
      setBatchInput('');
      alert(`เพิ่มห้องสำเร็จ ${data.createdCount} ห้อง`);
    },
    onError: (error: Error) => {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      roomNumber: '',
      floor: 1,
      baseRentPrice: 0,
      waterRate: 18,
      electricityRate: 8,
      depositAmount: 0,
      notes: '',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRoom) {
      updateMutation.mutate({ roomId: editingRoom._id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (room: Room) => {
    setEditingRoom(room);
    setFormData({
      roomNumber: room.roomNumber,
      floor: room.floor,
      baseRentPrice: room.baseRentPrice,
      waterRate: room.waterRate || 18,
      electricityRate: room.electricityRate || 8,
      depositAmount: room.depositAmount || 0,
      notes: room.notes || '',
    });
    setShowAddForm(true);
  };

  const handleDelete = (room: Room) => {
    if (confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบห้อง ${room.roomNumber}?`)) {
      deleteMutation.mutate(room._id);
    }
  };

  const handleGenerateQR = (room: Room) => {
    setSelectedRoomForQR(room);
    setQrCodeData(null);
    qrMutation.mutate(room._id);
  };

  const handleBatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Parse CSV input (format: roomNumber,floor,baseRentPrice,waterRate,electricityRate,depositAmount)
      const lines = batchInput.trim().split('\n');
      const rooms: RoomFormData[] = lines.map((line, index) => {
        const parts = line.split(',').map(p => p.trim());

        if (parts.length < 3) {
          throw new Error(`Line ${index + 1}: At least 3 values required (roomNumber,floor,baseRentPrice)`);
        }

        return {
          roomNumber: parts[0],
          floor: parseInt(parts[1]),
          baseRentPrice: parseFloat(parts[2]),
          waterRate: parts[3] ? parseFloat(parts[3]) : 18,
          electricityRate: parts[4] ? parseFloat(parts[4]) : 8,
          depositAmount: parts[5] ? parseFloat(parts[5]) : 0,
          notes: parts[6] || '',
        };
      });

      if (rooms.length === 0) {
        alert('กรุณากรอกข้อมูลห้องพัก');
        return;
      }

      batchMutation.mutate(rooms);
    } catch (error: any) {
      alert('รูปแบบข้อมูลไม่ถูกต้อง: ' + error.message);
    }
  };

  const handleDownloadQR = () => {
    if (!qrCodeData || !selectedRoomForQR) return;

    const link = document.createElement('a');
    link.download = `room-${selectedRoomForQR.roomNumber}-qr.png`;
    link.href = qrCodeData.dataUrl;
    link.click();
  };

  const handlePrintQR = () => {
    if (!qrCodeData || !selectedRoomForQR) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code - ห้อง ${selectedRoomForQR.roomNumber}</title>
          <style>
            body {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              font-family: 'Kanit', Arial, sans-serif;
            }
            .container {
              text-align: center;
              padding: 40px;
              border: 2px solid #000;
              border-radius: 10px;
            }
            h1 {
              margin: 0 0 10px 0;
              font-size: 32px;
            }
            p {
              margin: 5px 0;
              font-size: 18px;
              color: #666;
            }
            img {
              margin: 20px 0;
            }
            .instructions {
              margin-top: 20px;
              font-size: 14px;
              color: #888;
            }
            @media print {
              body {
                margin: 0;
              }
              .container {
                border: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>ห้อง ${selectedRoomForQR.roomNumber}</h1>
            <p>ชั้น ${selectedRoomForQR.floor}</p>
            <img src="${qrCodeData.dataUrl}" alt="QR Code" />
            <p class="instructions">สแกน QR Code เพื่อเข้าสู่ห้องพัก</p>
            <p class="instructions">Scan QR Code to join this room</p>
            <p class="instructions" style="margin-top: 20px; font-size: 12px;">
              QR Code มีอายุ 24 ชั่วโมง
            </p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-50">
        <div className="text-center">
          <p className="text-red-600">เกิดข้อผิดพลาด: {(error as Error).message}</p>
        </div>
      </div>
    );
  }

  const rooms = data?.rooms || [];
  const roomsByFloor = rooms.reduce((acc, room) => {
    if (!acc[room.floor]) {
      acc[room.floor] = [];
    }
    acc[room.floor].push(room);
    return acc;
  }, {} as Record<number, Room[]>);

  const floors = Object.keys(roomsByFloor)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center py-6">
          <h1 className="text-3xl font-bold text-gray-800">จัดการห้องพัก</h1>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setShowBatchForm(!showBatchForm);
                setShowAddForm(false);
                setBatchInput('');
              }}
              variant="outline"
              className="border-green-600 text-green-600 hover:bg-green-50"
            >
              {showBatchForm ? 'ยกเลิก' : '+ เพิ่มหลายห้อง'}
            </Button>
            <Button
              onClick={() => {
                setShowAddForm(!showAddForm);
                setShowBatchForm(false);
                setEditingRoom(null);
                resetForm();
              }}
              className="bg-green-600 hover:bg-green-700"
            >
              {showAddForm ? 'ยกเลิก' : '+ เพิ่มห้องใหม่'}
            </Button>
          </div>
        </div>

        {/* Add/Edit Form */}
        {showAddForm && (
          <Card className="bg-white">
            <CardHeader>
              <CardTitle>{editingRoom ? 'แก้ไขห้อง' : 'เพิ่มห้องใหม่'}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      หมายเลขห้อง *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.roomNumber}
                      onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ชั้น *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={formData.floor}
                      onChange={(e) => setFormData({ ...formData, floor: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ค่าเช่าพื้นฐาน (บาท) *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.baseRentPrice}
                      onChange={(e) =>
                        setFormData({ ...formData, baseRentPrice: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ค่าน้ำ (บาท/หน่วย)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.waterRate}
                      onChange={(e) =>
                        setFormData({ ...formData, waterRate: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ค่าไฟ (บาท/หน่วย)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.electricityRate}
                      onChange={(e) =>
                        setFormData({ ...formData, electricityRate: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      เงินประกัน (บาท)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.depositAmount}
                      onChange={(e) =>
                        setFormData({ ...formData, depositAmount: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    หมายเหตุ
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {editingRoom ? 'บันทึกการแก้ไข' : 'เพิ่มห้อง'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowAddForm(false);
                      setEditingRoom(null);
                      resetForm();
                    }}
                  >
                    ยกเลิก
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Batch Add Form */}
        {showBatchForm && (
          <Card className="bg-white">
            <CardHeader>
              <CardTitle>เพิ่มหลายห้องพร้อมกัน</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleBatchSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ข้อมูลห้องพัก (แต่ละบรรทัดคือ 1 ห้อง)
                  </label>
                  <p className="text-sm text-gray-500 mb-2">
                    รูปแบบ: หมายเลขห้อง,ชั้น,ค่าเช่า,ค่าน้ำ,ค่าไฟ,เงินประกัน
                  </p>
                  <div className="bg-gray-50 p-3 rounded-md mb-2 text-xs text-gray-600 font-mono">
                    <div>ตัวอย่าง:</div>
                    <div>101,1,3000,18,8,3000</div>
                    <div>102,1,3000,18,8,3000</div>
                    <div>103,1,3500,18,8,3000</div>
                    <div>201,2,3200</div>
                  </div>
                  <textarea
                    value={batchInput}
                    onChange={(e) => setBatchInput(e.target.value)}
                    rows={10}
                    placeholder="101,1,3000,18,8,3000&#10;102,1,3000,18,8,3000&#10;103,1,3500,18,8,3000&#10;201,2,3200"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 font-mono text-sm"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    * ค่าน้ำ, ค่าไฟ, เงินประกัน เป็นค่าเริ่มต้น (ถ้าไม่กรอก จะใช้ค่า 18, 8, 0 ตามลำดับ)
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={batchMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {batchMutation.isPending ? 'กำลังสร้าง...' : 'เพิ่มห้องทั้งหมด'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowBatchForm(false);
                      setBatchInput('');
                    }}
                  >
                    ยกเลิก
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* QR Code Modal */}
        {selectedRoomForQR && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800">
                  QR Code สำหรับห้อง {selectedRoomForQR.roomNumber}
                </h2>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSelectedRoomForQR(null);
                    setQrCodeData(null);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </Button>
              </div>

              <div className="p-6 space-y-4">
                {qrMutation.isPending ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">กำลังสร้าง QR Code...</p>
                  </div>
                ) : qrCodeData ? (
                  <>
                    <div className="bg-gradient-to-br from-green-50 to-blue-50 p-6 rounded-lg">
                      <div className="flex justify-center">
                        <div className="p-4 bg-white rounded-lg shadow-md">
                          <img src={qrCodeData.dataUrl} alt="Room Assignment QR Code" className="w-64 h-64" />
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <p className="text-xs font-medium text-gray-500 mb-2">URL สำหรับเข้าห้อง:</p>
                      <p className="text-xs text-gray-700 break-all font-mono">{qrCodeData.url}</p>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm text-blue-800">
                        <span className="font-semibold">วิธีใช้งาน:</span>
                      </p>
                      <ol className="text-xs text-blue-700 mt-2 space-y-1 list-decimal list-inside">
                        <li>ให้ผู้เช่าสแกน QR Code นี้</li>
                        <li>ระบบจะนำไปยังหน้า LINE LIFF</li>
                        <li>ผู้เช่าต้องเข้าสู่ระบบด้วย LINE</li>
                        <li>ระบบจะสร้างบัญชีและกำหนดห้องให้อัตโนมัติ</li>
                      </ol>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Button onClick={handleDownloadQR} variant="outline" className="w-full border-green-600 text-green-600 hover:bg-green-50">
                        📥 ดาวน์โหลด QR
                      </Button>
                      <Button onClick={handlePrintQR} variant="outline" className="w-full border-blue-600 text-blue-600 hover:bg-blue-50">
                        🖨️ พิมพ์ QR
                      </Button>
                    </div>

                    <p className="text-xs text-amber-600 text-center font-medium bg-amber-50 py-2 px-3 rounded-lg border border-amber-200">
                      ⚠️ QR Code นี้มีอายุ 24 ชั่วโมง
                    </p>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* Rooms List */}
        {floors.length === 0 ? (
          <Card className="bg-white">
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">ยังไม่มีห้องพัก กรุณาเพิ่มห้องใหม่</p>
            </CardContent>
          </Card>
        ) : (
          floors.map((floor) => (
            <Card key={floor} className="bg-white">
              <CardHeader>
                <CardTitle className="text-lg">ชั้น {floor}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {roomsByFloor[floor].map((room) => (
                    <div
                      key={room._id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl font-bold text-gray-800">
                              ห้อง {room.roomNumber}
                            </h3>
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium ${
                                room.status === 'vacant'
                                  ? 'bg-gray-100 text-gray-700'
                                  : room.status === 'occupied'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-orange-100 text-orange-700'
                              }`}
                            >
                              {room.status === 'vacant'
                                ? 'ว่าง'
                                : room.status === 'occupied'
                                ? 'มีผู้เช่า'
                                : 'ซ่อมแซม'}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-600">
                            <div>
                              <span className="font-medium">ค่าเช่า:</span>{' '}
                              {formatCurrency(room.baseRentPrice)}
                            </div>
                            <div>
                              <span className="font-medium">น้ำ:</span> {room.waterRate} บาท/หน่วย
                            </div>
                            <div>
                              <span className="font-medium">ไฟ:</span> {room.electricityRate} บาท/หน่วย
                            </div>
                            <div>
                              <span className="font-medium">ประกัน:</span>{' '}
                              {formatCurrency(room.depositAmount || 0)}
                            </div>
                          </div>

                          {room.tenantId && (
                            <div className="mt-2 text-sm text-gray-600">
                              <span className="font-medium">ผู้เช่า:</span>{' '}
                              {room.tenantId.displayName}
                              {room.tenantId.phoneNumber && ` (${room.tenantId.phoneNumber})`}
                            </div>
                          )}

                          {room.notes && (
                            <div className="mt-2 text-sm text-gray-500">
                              <span className="font-medium">หมายเหตุ:</span> {room.notes}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-2 ml-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(room)}
                            className="text-xs"
                          >
                            แก้ไข
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleGenerateQR(room)}
                            disabled={room.status === 'occupied'}
                            className="text-xs"
                          >
                            QR Code
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(room)}
                            disabled={room.status === 'occupied'}
                            className="text-xs text-red-600 hover:bg-red-50"
                          >
                            ลบ
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
