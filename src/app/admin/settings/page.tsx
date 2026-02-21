'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import useSWR from 'swr'
import { useLiff } from '@/providers/LiffProvider'
import LoadingScreen from '@/components/LoadingScreen'

interface Settings {
  promptpayNumber?: string
  promptpayName?: string
}

interface NewRoom {
  roomNumber: string
  floor: number
  baseRentPrice: number
  waterRate: number
  electricityRate: number
  depositAmount: number
  notes: string
}

const fetcher = async (url: string, lineUserId: string) => {
  const res = await fetch(url, {
    headers: {
      'x-line-userid': lineUserId,
    },
  })
  if (!res.ok) throw new Error('Failed to fetch settings')
  return res.json()
}

export default function SettingsPage() {
  const { profile, isLoading: isLiffLoading } = useLiff()
  const lineUserId = profile?.userId || ''
  const queryClient = useQueryClient()

  const [currentView, setCurrentView] = useState<'menu' | 'promptpay' | 'addRoom' | 'addBatch'>('menu')
  const [promptpayNumber, setPromptpayNumber] = useState('')
  const [promptpayName, setPromptpayName] = useState('')

  // Add room form state
  const [newRoom, setNewRoom] = useState<NewRoom>({
    roomNumber: '',
    floor: 1,
    baseRentPrice: 2500,
    waterRate: 18,
    electricityRate: 8,
    depositAmount: 0,
    notes: '',
  })
  const [batchInput, setBatchInput] = useState('')

  const { data: settingsData, mutate } = useSWR(
    lineUserId ? ['/api/admin/settings', lineUserId] : null,
    ([url, userId]) => fetcher(url, userId),
    {
      revalidateOnFocus: false,
    }
  )

  useEffect(() => {
    if (settingsData?.settings) {
      setPromptpayNumber(settingsData.settings.promptpayNumber || '')
      setPromptpayName(settingsData.settings.promptpayName || '')
    }
  }, [settingsData])

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: Settings) => {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-line-userid': lineUserId,
        },
        body: JSON.stringify(settings),
      })
      if (!res.ok) throw new Error('Failed to update settings')
      return res.json()
    },
    onSuccess: () => {
      mutate()
      alert('บันทึกการตั้งค่าเรียบร้อย')
    },
  })

  // Create room mutation
  const createRoomMutation = useMutation({
    mutationFn: async (room: NewRoom) => {
      const res = await fetch('/api/admin/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-line-userid': lineUserId,
        },
        body: JSON.stringify(room),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create room')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-rooms'] })
      setCurrentView('menu')
      resetRoomForm()
      alert('เพิ่มห้องเรียบร้อยแล้ว')
    },
    onError: (error: Error) => alert('เกิดข้อผิดพลาด: ' + error.message),
  })

  // Batch create rooms mutation
  const batchCreateMutation = useMutation({
    mutationFn: async (rooms: { roomNumber: string; floor: number; baseRentPrice: number }[]) => {
      const res = await fetch('/api/admin/rooms/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-line-userid': lineUserId,
        },
        body: JSON.stringify({ rooms }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create rooms')
      }
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-rooms'] })
      setCurrentView('menu')
      setBatchInput('')
      alert(`เพิ่มห้องสำเร็จ ${data.createdCount} ห้อง`)
    },
    onError: (error: Error) => alert('เกิดข้อผิดพลาด: ' + error.message),
  })

  const resetRoomForm = () => {
    setNewRoom({
      roomNumber: '',
      floor: 1,
      baseRentPrice: 2500,
      waterRate: 18,
      electricityRate: 8,
      depositAmount: 0,
      notes: '',
    })
  }

  const handleSaveSettings = () => {
    updateSettingsMutation.mutate({
      promptpayNumber,
      promptpayName,
    })
  }

  const handleAddRoom = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRoom.roomNumber.trim()) {
      alert('กรุณากรอกหมายเลขห้อง')
      return
    }
    createRoomMutation.mutate(newRoom)
  }

  const handleBatchCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!batchInput.trim()) {
      alert('กรุณากรอกข้อมูลห้อง')
      return
    }

    const lines = batchInput
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line)

    const rooms = lines.map((line) => {
      const parts = line.split(',').map((p) => p.trim())
      return {
        roomNumber: parts[0] || '',
        floor: parseInt(parts[1]) || 1,
        baseRentPrice: parseInt(parts[2]) || 2500,
      }
    })

    const invalidRooms = rooms.filter((r) => !r.roomNumber)
    if (invalidRooms.length > 0) {
      alert('พบข้อมูลห้องที่ไม่ถูกต้อง กรุณาตรวจสอบ')
      return
    }

    batchCreateMutation.mutate(rooms)
  }

  if (isLiffLoading) {
    return <LoadingScreen />
  }

  // Sub-page header component
  const SubPageHeader = ({ title, onBack }: { title: string; onBack: () => void }) => (
    <div className="bg-white/80 backdrop-blur-xl sticky top-0 z-30 border-b border-zinc-200/50">
      <div className="flex items-center h-14 px-4">
        <button
          onClick={onBack}
          className="flex items-center text-green-600 hover:text-green-700 -ml-2 px-2 py-1 rounded-lg"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-sm font-medium">กลับ</span>
        </button>
        <h1 className="flex-1 text-center text-base font-semibold text-zinc-800 -ml-10">{title}</h1>
      </div>
    </div>
  )

  // Settings row component
  const SettingsRow = ({
    icon,
    iconBg,
    iconColor,
    title,
    subtitle,
    onClick,
    isLink,
    href,
  }: {
    icon: React.ReactNode
    iconBg: string
    iconColor: string
    title: string
    subtitle?: string
    onClick?: () => void
    isLink?: boolean
    href?: string
  }) => {
    const content = (
      <div className="flex items-center px-4 py-3 bg-white hover:bg-zinc-50 active:bg-zinc-100 transition-colors">
        <div className={`w-8 h-8 ${iconBg} rounded-lg flex items-center justify-center mr-3`}>
          <div className={`w-5 h-5 ${iconColor}`}>{icon}</div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-medium text-zinc-900">{title}</p>
          {subtitle && <p className="text-xs text-zinc-500 truncate">{subtitle}</p>}
        </div>
        <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    )

    if (isLink && href) {
      return <a href={href} className="block">{content}</a>
    }

    return (
      <button onClick={onClick} className="w-full text-left">
        {content}
      </button>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-100 pb-24">
      {currentView === 'menu' ? (
        <>
          {/* Main Settings Header */}
          <div className="bg-white/80 backdrop-blur-xl sticky top-0 z-30 border-b border-zinc-200/50">
            <div className="flex items-center justify-between h-14 px-4">
              <h1 className="text-xl font-bold text-zinc-800">ตั้งค่า</h1>
              <a
                href="/admin/dashboard"
                className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-full transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </a>
            </div>
          </div>

          {/* Settings Content */}
          <div className="pt-6 px-4 space-y-6">
            {/* Payment Section */}
            <div>
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2 px-1">การชำระเงิน</p>
              <div className="bg-white rounded-xl overflow-hidden shadow-sm">
                <SettingsRow
                  icon={
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  }
                  iconBg="bg-blue-500"
                  iconColor="text-white"
                  title="พร้อมเพย์"
                  subtitle={promptpayNumber || 'ยังไม่ได้ตั้งค่า'}
                  onClick={() => setCurrentView('promptpay')}
                />
              </div>
            </div>

            {/* Room Management Section */}
            <div>
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2 px-1">จัดการห้องพัก</p>
              <div className="bg-white rounded-xl overflow-hidden shadow-sm divide-y divide-zinc-100">
                <SettingsRow
                  icon={
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  }
                  iconBg="bg-green-500"
                  iconColor="text-white"
                  title="เพิ่มห้องพัก"
                  subtitle="เพิ่มห้องใหม่ทีละห้อง"
                  onClick={() => setCurrentView('addRoom')}
                />
                <SettingsRow
                  icon={
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  }
                  iconBg="bg-violet-500"
                  iconColor="text-white"
                  title="เพิ่มหลายห้อง"
                  subtitle="นำเข้าข้อมูลห้องพร้อมกัน"
                  onClick={() => setCurrentView('addBatch')}
                />
              </div>
            </div>

            {/* Team Section */}
            <div>
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2 px-1">ทีมงาน</p>
              <div className="bg-white rounded-xl overflow-hidden shadow-sm">
                <SettingsRow
                  icon={
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  }
                  iconBg="bg-orange-500"
                  iconColor="text-white"
                  title="พนักงาน"
                  subtitle="จัดการสิทธิ์ผู้ดูแลระบบ"
                  isLink
                  href="/admin/users"
                />
              </div>
            </div>

            {/* App Info */}
            <div className="pt-4">
              <div className="text-center text-xs text-zinc-400 space-y-1">
                <p>ระบบจัดการหอพัก</p>
                <p>เวอร์ชัน 1.0.0</p>
              </div>
            </div>
          </div>
        </>
      ) : currentView === 'promptpay' ? (
        <>
          <SubPageHeader title="พร้อมเพย์" onBack={() => setCurrentView('menu')} />
          <div className="p-4 space-y-6">
            {/* Form Card */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                    เลขพร้อมเพย์
                  </label>
                  <input
                    type="text"
                    value={promptpayNumber}
                    onChange={(e) => setPromptpayNumber(e.target.value)}
                    className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-base font-mono tracking-wider transition-colors"
                    placeholder="เบอร์โทรหรือเลขบัตรประชาชน"
                    maxLength={13}
                  />
                  <p className="mt-1.5 text-xs text-zinc-500">เบอร์โทร 10 หลัก หรือ เลขบัตรประชาชน 13 หลัก</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                    ชื่อบัญชี
                  </label>
                  <input
                    type="text"
                    value={promptpayName}
                    onChange={(e) => setPromptpayName(e.target.value)}
                    className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-base transition-colors"
                    placeholder="ชื่อที่แสดงในบัญชี"
                  />
                </div>
              </div>

              {/* Preview */}
              {promptpayNumber && (
                <div className="border-t border-zinc-100 bg-zinc-50 p-4">
                  <p className="text-xs text-zinc-500 mb-2">ตัวอย่างการแสดงผล</p>
                  <div className="bg-white rounded-lg border border-zinc-200 p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-zinc-900">{promptpayName || 'ไม่ระบุชื่อ'}</p>
                        <p className="text-sm text-zinc-500 font-mono">{promptpayNumber}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Save Button */}
            <button
              onClick={handleSaveSettings}
              disabled={updateSettingsMutation.isPending}
              className="w-full bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:bg-zinc-300 text-white font-semibold py-3 rounded-xl transition-colors shadow-sm"
            >
              {updateSettingsMutation.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </>
      ) : currentView === 'addRoom' ? (
        <>
          <SubPageHeader title="เพิ่มห้องพัก" onBack={() => setCurrentView('menu')} />
          <form onSubmit={handleAddRoom} className="p-4 space-y-6">
            {/* Basic Info */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-100">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">ข้อมูลพื้นฐาน</p>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">หมายเลขห้อง</label>
                    <input
                      type="text"
                      value={newRoom.roomNumber}
                      onChange={(e) => setNewRoom({ ...newRoom, roomNumber: e.target.value })}
                      className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-base transition-colors"
                      placeholder="101"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">ชั้น</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={newRoom.floor}
                      onChange={(e) => setNewRoom({ ...newRoom, floor: parseInt(e.target.value) || 1 })}
                      className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-base transition-colors"
                      min={1}
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-100">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">ราคา</p>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5">ค่าเช่ารายเดือน (บาท)</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={newRoom.baseRentPrice}
                    onChange={(e) => setNewRoom({ ...newRoom, baseRentPrice: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-base transition-colors"
                    min={0}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">ค่าน้ำ (บาท/หน่วย)</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={newRoom.waterRate}
                      onChange={(e) => setNewRoom({ ...newRoom, waterRate: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-base transition-colors"
                      min={0}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">ค่าไฟ (บาท/หน่วย)</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={newRoom.electricityRate}
                      onChange={(e) => setNewRoom({ ...newRoom, electricityRate: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-base transition-colors"
                      min={0}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-100">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">เพิ่มเติม</p>
              </div>
              <div className="p-4">
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">หมายเหตุ</label>
                <textarea
                  value={newRoom.notes}
                  onChange={(e) => setNewRoom({ ...newRoom, notes: e.target.value })}
                  className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-base transition-colors resize-none"
                  rows={2}
                  placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={createRoomMutation.isPending}
              className="w-full bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:bg-zinc-300 text-white font-semibold py-3 rounded-xl transition-colors shadow-sm"
            >
              {createRoomMutation.isPending ? 'กำลังบันทึก...' : 'เพิ่มห้องพัก'}
            </button>
          </form>
        </>
      ) : currentView === 'addBatch' ? (
        <>
          <SubPageHeader title="เพิ่มหลายห้อง" onBack={() => setCurrentView('menu')} />
          <form onSubmit={handleBatchCreate} className="p-4 space-y-6">
            {/* Instructions */}
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
              <div className="flex gap-3">
                <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-violet-900 mb-1">รูปแบบข้อมูล</p>
                  <p className="text-xs text-violet-700">หมายเลขห้อง, ชั้น, ค่าเช่า (บรรทัดละห้อง)</p>
                  <div className="mt-2 bg-white/60 rounded-lg p-2">
                    <code className="text-xs text-violet-800 font-mono leading-relaxed">
                      101, 1, 2500<br/>
                      102, 1, 2500<br/>
                      201, 2, 3000
                    </code>
                  </div>
                </div>
              </div>
            </div>

            {/* Input */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-100">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">ข้อมูลห้อง</p>
              </div>
              <div className="p-4">
                <textarea
                  value={batchInput}
                  onChange={(e) => setBatchInput(e.target.value)}
                  className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-sm font-mono transition-colors resize-none"
                  rows={8}
                  placeholder="101, 1, 2500&#10;102, 1, 2500&#10;201, 2, 3000"
                />
              </div>

              {/* Count Preview */}
              {batchInput.trim() && (
                <div className="px-4 py-3 border-t border-zinc-100 bg-zinc-50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-600">จำนวนห้องที่จะสร้าง</span>
                    <span className="text-sm font-semibold text-violet-600">
                      {batchInput.split('\n').filter((line) => line.trim()).length} ห้อง
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={batchCreateMutation.isPending}
              className="w-full bg-violet-600 hover:bg-violet-700 active:bg-violet-800 disabled:bg-zinc-300 text-white font-semibold py-3 rounded-xl transition-colors shadow-sm"
            >
              {batchCreateMutation.isPending ? 'กำลังสร้าง...' : 'เพิ่มห้องทั้งหมด'}
            </button>
          </form>
        </>
      ) : null}
    </div>
  )
}
