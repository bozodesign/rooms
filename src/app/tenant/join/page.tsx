'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useLiff } from '@/providers/LiffProvider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function JoinRoomPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { liff, profile, isLoading } = useLiff()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [roomNumber, setRoomNumber] = useState<string | null>(null)

  useEffect(() => {
    const token = searchParams.get('token')

    if (!token) {
      setStatus('error')
      setMessage('ไม่พบ Token การเข้าห้อง')
      return
    }

    // Wait for LIFF to be ready and profile to be loaded
    if (isLoading || !profile) {
      return
    }

    // Call API to assign room
    const assignRoom = async () => {
      try {
        const response = await fetch('/api/tenant/join', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-line-userid': profile.userId,
          },
          body: JSON.stringify({ token }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to assign room')
        }

        setStatus('success')
        setMessage(data.message)
        setRoomNumber(data.roomNumber)
      } catch (error: any) {
        setStatus('error')
        setMessage(error.message || 'เกิดข้อผิดพลาดในการเข้าห้อง')
      }
    }

    assignRoom()
  }, [searchParams, profile, isLoading])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">กำลังเชื่อมต่อ LINE...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-red-200">
          <CardHeader className="bg-red-50">
            <CardTitle className="text-center text-red-600">
              ไม่สามารถเข้าสู่ระบบได้
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-red-700 text-center font-medium">
                กรุณาเปิดลิงก์นี้ผ่าน LINE เท่านั้น
              </p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800 font-medium mb-2">วิธีใช้งานที่ถูกต้อง:</p>
              <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                <li>เปิดแอป LINE บนมือถือ</li>
                <li>สแกน QR Code ที่ได้รับจากแอดมิน</li>
                <li>ระบบจะเปิดหน้านี้ใน LINE Browser</li>
                <li>ทำการเข้าห้องอัตโนมัติ</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">กำลังดำเนินการเข้าห้อง...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-red-200">
          <CardHeader className="bg-red-50">
            <CardTitle className="text-center text-red-600 flex items-center justify-center gap-2">
              <span className="text-2xl">❌</span>
              <span>ไม่สามารถเข้าห้องได้</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-red-700 text-center">{message}</p>
            </div>
            <div className="space-y-2 text-sm text-gray-600">
              <p className="font-medium">เหตุผลที่เป็นไปได้:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>QR Code หมดอายุ (เกิน 24 ชั่วโมง)</li>
                <li>ห้องถูกจองแล้ว</li>
                <li>คุณมีห้องอยู่แล้ว</li>
                <li>Token ไม่ถูกต้อง</li>
              </ul>
            </div>
            <Button
              onClick={() => {
                if (liff) {
                  liff.closeWindow()
                }
              }}
              className="w-full mt-6 bg-red-600 hover:bg-red-700"
            >
              ปิดหน้าต่าง
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Success state
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-green-200">
        <CardHeader className="bg-green-50">
          <CardTitle className="text-center text-green-600 flex items-center justify-center gap-2">
            <span className="text-2xl">✅</span>
            <span>เข้าห้องสำเร็จ</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="bg-gradient-to-br from-green-100 to-blue-100 rounded-lg p-6 border-2 border-green-200">
              <p className="text-gray-600 text-sm mb-2">คุณได้รับห้องหมายเลข</p>
              <p className="text-4xl font-bold text-green-700">{roomNumber}</p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
              <p className="text-sm text-blue-800 font-medium mb-2">ขั้นตอนต่อไป:</p>
              <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                <li>เพิ่มเพื่อน LINE Official Account ของหอพัก</li>
                <li>รอแอดมินยืนยันข้อมูลและส่งใบแจ้งหนี้</li>
                <li>ชำระค่าเช่าและค่ามัดจำ</li>
                <li>รับกุญแจห้องและเข้าพักได้เลย</li>
              </ol>
            </div>

            <div className="text-sm text-gray-500">
              <p>ยินดีต้อนรับสู่หอพัก! 🎉</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => router.push('/tenant/dashboard')}
                className="bg-green-600 hover:bg-green-700"
              >
                ไปหน้าแรก
              </Button>
              <Button
                onClick={() => {
                  if (liff) {
                    liff.closeWindow()
                  }
                }}
                variant="outline"
              >
                ปิดหน้าต่าง
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
