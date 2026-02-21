'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import useSWR from 'swr'
import { useLiff } from '@/providers/LiffProvider'

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
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">กำลังโหลด...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-700 to-gray-800 text-white sticky top-0 z-30">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            {currentView !== 'menu' ? (
              <button
                onClick={() => setCurrentView('menu')}
                className="flex items-center gap-2 text-white hover:bg-white hover:bg-opacity-20 rounded-lg px-2 py-1 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span>กลับ</span>
              </button>
            ) : (
              <div>
                <h1 className="text-2xl font-bold">ตั้งค่า</h1>
                <p className="text-gray-300 text-sm mt-1">จัดการข้อมูลระบบ</p>
              </div>
            )}
            <a
              href="/admin/dashboard"
              className="p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </a>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {currentView === 'menu' ? (
          // Main Menu
          <div className="space-y-4">
            {/* PromptPay Card */}
            <button
              onClick={() => setCurrentView('promptpay')}
              className="w-full bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border-2 border-blue-200 hover:border-blue-400 transition-all hover:shadow-lg active:scale-95"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-blue-100 p-4 rounded-xl">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-xl text-gray-900">ตั้งค่าพร้อมเพย์</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {promptpayNumber ? `${promptpayNumber}` : 'ยังไม่ได้ตั้งค่า'}
                    </p>
                  </div>
                </div>
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>

            {/* Add Single Room Card */}
            <button
              onClick={() => setCurrentView('addRoom')}
              className="w-full bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border-2 border-green-200 hover:border-green-400 transition-all hover:shadow-lg active:scale-95"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-green-100 p-4 rounded-xl">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-xl text-gray-900">เพิ่มห้อง</h3>
                    <p className="text-sm text-gray-600 mt-1">เพิ่มห้องพักใหม่ทีละห้อง</p>
                  </div>
                </div>
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>

            {/* Add Multiple Rooms Card */}
            <button
              onClick={() => setCurrentView('addBatch')}
              className="w-full bg-gradient-to-br from-purple-50 to-violet-50 rounded-2xl p-6 border-2 border-purple-200 hover:border-purple-400 transition-all hover:shadow-lg active:scale-95"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-purple-100 p-4 rounded-xl">
                    <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-xl text-gray-900">เพิ่มหลายห้อง</h3>
                    <p className="text-sm text-gray-600 mt-1">เพิ่มห้องพักหลายห้องพร้อมกัน</p>
                  </div>
                </div>
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>

            {/* Staff Management Card */}
            <a
              href="/admin/users"
              className="block w-full bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-6 border-2 border-orange-200 hover:border-orange-400 transition-all hover:shadow-lg active:scale-95"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-orange-100 p-4 rounded-xl">
                    <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-xl text-gray-900">พนักงาน</h3>
                    <p className="text-sm text-gray-600 mt-1">จัดการสิทธิ์ผู้ดูแลระบบ</p>
                  </div>
                </div>
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </a>
          </div>
        ) : currentView === 'promptpay' ? (
          // PromptPay Form
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-200">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <h3 className="font-bold text-xl text-gray-900">PromptPay</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    เลขพร้อมเพย์ (เบอร์โทร/เลขบัตรประชาชน)
                  </label>
                  <input
                    type="text"
                    value={promptpayNumber}
                    onChange={(e) => setPromptpayNumber(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono tracking-wider"
                    placeholder="0812345678 หรือ 1234567890123"
                    maxLength={13}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ชื่อบัญชี
                  </label>
                  <input
                    type="text"
                    value={promptpayName}
                    onChange={(e) => setPromptpayName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="นายสมชาย ใจดี"
                  />
                </div>

                {promptpayNumber && (
                  <div className="bg-white rounded-lg p-3 border border-blue-300">
                    <p className="text-xs text-gray-600 mb-1">ตัวอย่างการแสดงผล:</p>
                    <p className="font-medium text-gray-900">
                      {promptpayName || 'ยังไม่ระบุชื่อ'}
                    </p>
                    <p className="text-sm text-gray-600 font-mono tracking-wider">
                      {promptpayNumber}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSaveSettings}
              disabled={updateSettingsMutation.isPending}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-4 px-4 rounded-xl transition-colors shadow-lg"
            >
              {updateSettingsMutation.isPending ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
            </button>
          </div>
        ) : currentView === 'addRoom' ? (
          // Add Single Room Form
          <form onSubmit={handleAddRoom} className="space-y-4">
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5 border border-green-200">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <h3 className="font-bold text-xl text-gray-900">เพิ่มห้องพัก</h3>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">หมายเลขห้อง *</label>
                    <input
                      type="text"
                      value={newRoom.roomNumber}
                      onChange={(e) => setNewRoom({ ...newRoom, roomNumber: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="101"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">ชั้น *</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={newRoom.floor}
                      onChange={(e) => setNewRoom({ ...newRoom, floor: parseInt(e.target.value) || 1 })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      min={1}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">ค่าเช่าพื้นฐาน (บาท/เดือน)</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={newRoom.baseRentPrice}
                    onChange={(e) => setNewRoom({ ...newRoom, baseRentPrice: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    min={0}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">ค่าน้ำ (บาท/หน่วย)</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={newRoom.waterRate}
                      onChange={(e) => setNewRoom({ ...newRoom, waterRate: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      min={0}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">ค่าไฟ (บาท/หน่วย)</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={newRoom.electricityRate}
                      onChange={(e) => setNewRoom({ ...newRoom, electricityRate: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      min={0}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">หมายเหตุ</label>
                  <textarea
                    value={newRoom.notes}
                    onChange={(e) => setNewRoom({ ...newRoom, notes: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    rows={2}
                    placeholder="หมายเหตุเพิ่มเติม..."
                  />
                </div>
              </div>
            </div>

            {/* Save Button */}
            <button
              type="submit"
              disabled={createRoomMutation.isPending}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-4 px-4 rounded-xl transition-colors shadow-lg"
            >
              {createRoomMutation.isPending ? 'กำลังบันทึก...' : 'เพิ่มห้องพัก'}
            </button>
          </form>
        ) : currentView === 'addBatch' ? (
          // Add Multiple Rooms Form
          <form onSubmit={handleBatchCreate} className="space-y-4">
            <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl p-5 border border-purple-200">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <h3 className="font-bold text-xl text-gray-900">เพิ่มหลายห้องพร้อมกัน</h3>
              </div>

              <div className="bg-purple-100 border border-purple-300 rounded-xl p-4 mb-4">
                <p className="text-sm text-purple-800 font-medium mb-2">รูปแบบ: หมายเลขห้อง, ชั้น, ค่าเช่า</p>
                <p className="text-xs text-purple-600">ตัวอย่าง:</p>
                <pre className="text-xs text-purple-700 mt-1 font-mono">
{`101, 1, 2500
102, 1, 2500
201, 2, 3000`}
                </pre>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ข้อมูลห้อง (ใส่แต่ละห้องคนละบรรทัด)</label>
                <textarea
                  value={batchInput}
                  onChange={(e) => setBatchInput(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                  rows={8}
                  placeholder="101, 1, 2500&#10;102, 1, 2500&#10;201, 2, 3000"
                />
              </div>

              {batchInput.trim() && (
                <div className="mt-4 p-3 bg-white rounded-lg border border-purple-200">
                  <p className="text-sm text-gray-600">
                    จำนวนห้องที่จะสร้าง:{' '}
                    <span className="font-bold text-purple-600">
                      {batchInput.split('\n').filter((line) => line.trim()).length} ห้อง
                    </span>
                  </p>
                </div>
              )}
            </div>

            {/* Save Button */}
            <button
              type="submit"
              disabled={batchCreateMutation.isPending}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-bold py-4 px-4 rounded-xl transition-colors shadow-lg"
            >
              {batchCreateMutation.isPending ? 'กำลังสร้าง...' : 'เพิ่มห้องทั้งหมด'}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  )
}
