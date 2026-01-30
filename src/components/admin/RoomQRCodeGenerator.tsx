'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Room {
  id: string;
  roomNumber: string;
  floor: number;
  status: string;
}

async function generateAssignmentToken(roomId: string, lineUserId: string) {
  const res = await fetch('/api/rooms/assign', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-line-userid': lineUserId,
    },
    body: JSON.stringify({ roomId }),
  });

  if (!res.ok) {
    throw new Error('Failed to generate assignment token');
  }

  return res.json();
}

export default function RoomQRCodeGenerator({
  room,
  lineUserId,
}: {
  room: Room;
  lineUserId: string;
}) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [assignmentUrl, setAssignmentUrl] = useState<string | null>(null);

  const generateMutation = useMutation({
    mutationFn: () => generateAssignmentToken(room.id, lineUserId),
    onSuccess: async (data) => {
      setAssignmentUrl(data.assignmentUrl);

      // Generate QR Code image
      try {
        const qrDataUrl = await QRCode.toDataURL(data.assignmentUrl, {
          width: 300,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        });
        setQrCodeUrl(qrDataUrl);
      } catch (error) {
        console.error('QR Code generation error:', error);
      }
    },
    onError: (error: Error) => {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    },
  });

  const handleDownloadQR = () => {
    if (!qrCodeUrl) return;

    const link = document.createElement('a');
    link.download = `room-${room.roomNumber}-qr.png`;
    link.href = qrCodeUrl;
    link.click();
  };

  const handlePrintQR = () => {
    if (!qrCodeUrl) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code - ห้อง ${room.roomNumber}</title>
          <style>
            body {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              font-family: Arial, sans-serif;
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
            <h1>ห้อง ${room.roomNumber}</h1>
            <p>ชั้น ${room.floor}</p>
            <img src="${qrCodeUrl}" alt="QR Code" />
            <p class="instructions">สแกน QR Code เพื่อเข้าสู่ห้องพัก</p>
            <p class="instructions">Scan QR Code to join this room</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle className="text-lg">สร้าง QR Code สำหรับห้อง {room.roomNumber}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!qrCodeUrl ? (
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending || room.status === 'occupied'}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            {generateMutation.isPending ? 'กำลังสร้าง...' : 'สร้าง QR Code'}
          </Button>
        ) : (
          <>
            <div className="flex justify-center">
              <div className="p-4 bg-white border-2 border-gray-200 rounded-lg">
                <img src={qrCodeUrl} alt="Room Assignment QR Code" className="w-64 h-64" />
              </div>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-600 break-all">{assignmentUrl}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button onClick={handleDownloadQR} variant="outline" className="w-full">
                ดาวน์โหลด QR
              </Button>
              <Button onClick={handlePrintQR} variant="outline" className="w-full">
                พิมพ์ QR
              </Button>
            </div>

            <Button
              onClick={() => {
                setQrCodeUrl(null);
                setAssignmentUrl(null);
              }}
              variant="ghost"
              className="w-full"
            >
              สร้างใหม่
            </Button>

            <p className="text-xs text-gray-500 text-center">
              QR Code นี้มีอายุ 24 ชั่วโมง
            </p>
          </>
        )}

        {room.status === 'occupied' && (
          <p className="text-sm text-yellow-600 text-center">
            ห้องนี้มีผู้เช่าอยู่แล้ว ไม่สามารถสร้าง QR Code ได้
          </p>
        )}
      </CardContent>
    </Card>
  );
}
