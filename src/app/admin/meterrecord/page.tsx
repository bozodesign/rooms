'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLiff } from '@/providers/LiffProvider'

interface MeterReadingHistory {
    value: number
    recordedAt: string
    recordedBy?: string
    notes?: string
}

interface Room {
    _id: string
    roomNumber: string
    floor: number
    status: 'vacant' | 'occupied' | 'maintenance'
    waterMeterReadings?: MeterReadingHistory[]
    electricityMeterReadings?: MeterReadingHistory[]
}

interface MeterInput {
    roomId: string
    roomNumber: string
    waterValue: string
    electricityValue: string
    lastWater: number | null
    lastElectricity: number | null
    lastWaterDate: string | null
    lastElectricityDate: string | null
}

async function fetchRooms(lineUserId: string): Promise<{ rooms: Room[] }> {
    const res = await fetch('/api/admin/rooms', {
        headers: { 'x-line-userid': lineUserId },
    })
    if (!res.ok) throw new Error('Failed to fetch rooms')
    return res.json()
}

async function batchRecordMeter(
    lineUserId: string,
    readings: { roomId: string; meterType: 'water' | 'electricity'; value: number }[]
) {
    const res = await fetch('/api/admin/rooms/meter/batch', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-line-userid': lineUserId,
        },
        body: JSON.stringify({ readings }),
    })
    if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to record meter readings')
    }
    return res.json()
}

export default function MeterRecordPage() {
    const { profile, isLoading: isLiffLoading } = useLiff()
    const lineUserId = profile?.userId || ''
    const queryClient = useQueryClient()

    const [meterInputs, setMeterInputs] = useState<MeterInput[]>([])
    const [filterFloor, setFilterFloor] = useState<number | 'all'>('all')
    const [showOnlyOccupied, setShowOnlyOccupied] = useState(true)

    const { data, isLoading, error } = useQuery({
        queryKey: ['admin-rooms', lineUserId],
        queryFn: () => fetchRooms(lineUserId),
        enabled: !!lineUserId,
    })

    const batchMutation = useMutation({
        mutationFn: (readings: { roomId: string; meterType: 'water' | 'electricity'; value: number }[]) =>
            batchRecordMeter(lineUserId, readings),
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['admin-rooms'] })
            alert(`บันทึกสำเร็จ ${result.successCount} รายการ`)
            // Clear inputs after success
            setMeterInputs((prev) =>
                prev.map((input) => ({
                    ...input,
                    waterValue: '',
                    electricityValue: '',
                }))
            )
        },
        onError: (error: Error) => {
            alert('เกิดข้อผิดพลาด: ' + error.message)
        },
    })

    // Helper function to get the latest reading by date
    const getLatestReading = (readings: MeterReadingHistory[] | undefined) => {
        if (!readings || readings.length === 0) return null
        return [...readings].sort(
            (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
        )[0]
    }

    // Initialize meter inputs when rooms data changes
    useEffect(() => {
        if (data?.rooms) {
            const inputs: MeterInput[] = data.rooms.map((room) => {
                const lastWaterReading = getLatestReading(room.waterMeterReadings)
                const lastElectricityReading = getLatestReading(room.electricityMeterReadings)

                return {
                    roomId: room._id,
                    roomNumber: room.roomNumber,
                    waterValue: '',
                    electricityValue: '',
                    lastWater: lastWaterReading?.value ?? null,
                    lastElectricity: lastElectricityReading?.value ?? null,
                    lastWaterDate: lastWaterReading?.recordedAt ?? null,
                    lastElectricityDate: lastElectricityReading?.recordedAt ?? null,
                }
            })
            setMeterInputs(inputs)
        }
    }, [data?.rooms])

    const handleInputChange = (
        roomId: string,
        field: 'waterValue' | 'electricityValue',
        value: string
    ) => {
        setMeterInputs((prev) =>
            prev.map((input) =>
                input.roomId === roomId ? { ...input, [field]: value } : input
            )
        )
    }

    const handleBatchSubmit = () => {
        const readings: { roomId: string; meterType: 'water' | 'electricity'; value: number }[] = []
        const errors: string[] = []

        meterInputs.forEach((input) => {
            // Validate water meter
            if (input.waterValue && !isNaN(Number(input.waterValue))) {
                const newValue = Number(input.waterValue)
                if (input.lastWater !== null && newValue < input.lastWater) {
                    errors.push(`ห้อง ${input.roomNumber}: ค่ามิเตอร์น้ำ (${newValue}) น้อยกว่าค่าเดิม (${input.lastWater})`)
                } else {
                    readings.push({
                        roomId: input.roomId,
                        meterType: 'water',
                        value: newValue,
                    })
                }
            }
            // Validate electricity meter
            if (input.electricityValue && !isNaN(Number(input.electricityValue))) {
                const newValue = Number(input.electricityValue)
                if (input.lastElectricity !== null && newValue < input.lastElectricity) {
                    errors.push(`ห้อง ${input.roomNumber}: ค่ามิเตอร์ไฟ (${newValue}) น้อยกว่าค่าเดิม (${input.lastElectricity})`)
                } else {
                    readings.push({
                        roomId: input.roomId,
                        meterType: 'electricity',
                        value: newValue,
                    })
                }
            }
        })

        if (errors.length > 0) {
            alert('พบข้อผิดพลาด:\n' + errors.join('\n'))
            return
        }

        if (readings.length === 0) {
            alert('กรุณากรอกค่ามิเตอร์อย่างน้อย 1 รายการ')
            return
        }

        if (confirm(`ยืนยันบันทึกมิเตอร์ ${readings.length} รายการ?`)) {
            batchMutation.mutate(readings)
        }
    }

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '-'
        return new Date(dateStr).toLocaleDateString('th-TH', {
            day: 'numeric',
            month: 'short',
        })
    }

    // Get unique floors
    const floors = data?.rooms
        ? [...new Set(data.rooms.map((r) => r.floor))].sort((a, b) => a - b)
        : []

    // Filter rooms
    const filteredRooms = data?.rooms
        ? data.rooms
              .filter((room) => filterFloor === 'all' || room.floor === filterFloor)
              .filter((room) => !showOnlyOccupied || room.status === 'occupied')
              .sort((a, b) => {
                  if (a.floor !== b.floor) return a.floor - b.floor
                  return a.roomNumber.localeCompare(b.roomNumber, 'th', { numeric: true })
              })
        : []

    const filteredInputs = meterInputs.filter((input) =>
        filteredRooms.some((room) => room._id === input.roomId)
    )

    // Count filled inputs
    const filledCount = filteredInputs.filter(
        (input) => input.waterValue || input.electricityValue
    ).length

    if (isLiffLoading || isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">กำลังโหลด...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="text-center p-6">
                    <p className="text-red-600">เกิดข้อผิดพลาด: {(error as Error).message}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-32">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
                <div className="px-4 py-4">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">จดมิเตอร์</h1>
                            <p className="text-sm text-gray-500">
                                {filteredRooms.length} ห้อง
                                {filledCount > 0 && (
                                    <span className="text-blue-600 ml-2">
                                        (กรอกแล้ว {filledCount})
                                    </span>
                                )}
                            </p>
                        </div>
                        <a
                            href="/admin/dashboard"
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </a>
                    </div>

                    {/* Filters */}
                    <div className="flex gap-2 flex-wrap">
                        <select
                            value={filterFloor}
                            onChange={(e) =>
                                setFilterFloor(e.target.value === 'all' ? 'all' : Number(e.target.value))
                            }
                            className="px-3 py-2 bg-gray-100 rounded-lg text-sm font-medium border-0 focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">ทุกชั้น</option>
                            {floors.map((floor) => (
                                <option key={floor} value={floor}>
                                    ชั้น {floor}
                                </option>
                            ))}
                        </select>

                        <button
                            onClick={() => setShowOnlyOccupied(!showOnlyOccupied)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                showOnlyOccupied
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-gray-100 text-gray-600'
                            }`}
                        >
                            {showOnlyOccupied ? 'เฉพาะมีผู้เช่า' : 'แสดงทั้งหมด'}
                        </button>
                    </div>
                </div>

                {/* Column Headers */}
                <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
                    <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500">
                        <div className="col-span-2">ห้อง</div>
                        <div className="col-span-5 text-center text-blue-600">มิเตอร์น้ำ</div>
                        <div className="col-span-5 text-center text-amber-600">มิเตอร์ไฟ</div>
                    </div>
                </div>
            </div>

            {/* Room List */}
            <div className="divide-y divide-gray-100">
                {filteredInputs.map((input) => {
                    const room = filteredRooms.find((r) => r._id === input.roomId)
                    if (!room) return null

                    return (
                        <div
                            key={input.roomId}
                            className="bg-white px-4 py-3"
                        >
                            <div className="grid grid-cols-12 gap-2 items-center">
                                {/* Room Number */}
                                <div className="col-span-2">
                                    <span className="font-bold text-gray-900">{room.roomNumber}</span>
                                    <span
                                        className={`block text-xs ${
                                            room.status === 'occupied'
                                                ? 'text-green-600'
                                                : room.status === 'vacant'
                                                ? 'text-gray-400'
                                                : 'text-orange-600'
                                        }`}
                                    >
                                        {room.status === 'occupied'
                                            ? 'มีผู้เช่า'
                                            : room.status === 'vacant'
                                            ? 'ว่าง'
                                            : 'ซ่อม'}
                                    </span>
                                </div>

                                {/* Water Meter */}
                                <div className="col-span-5">
                                    {(() => {
                                        const isInvalid = input.waterValue &&
                                            input.lastWater !== null &&
                                            Number(input.waterValue) < input.lastWater
                                        return (
                                            <>
                                                <div className="flex items-center gap-1">
                                                    <div className="flex-1">
                                                        <input
                                                            type="number"
                                                            inputMode="numeric"
                                                            pattern="[0-9]*"
                                                            value={input.waterValue}
                                                            onChange={(e) =>
                                                                handleInputChange(input.roomId, 'waterValue', e.target.value)
                                                            }
                                                            placeholder={input.lastWater?.toString() || '0'}
                                                            className={`w-full px-2 py-2 text-sm border rounded-lg focus:ring-2 font-mono ${
                                                                isInvalid
                                                                    ? 'border-red-400 bg-red-50 focus:ring-red-500 focus:border-red-500 text-red-600'
                                                                    : 'border-blue-200 focus:ring-blue-500 focus:border-blue-500'
                                                            }`}
                                                        />
                                                    </div>
                                                </div>
                                                {isInvalid ? (
                                                    <div className="text-xs text-red-500 mt-1">
                                                        ค่าน้อยกว่าเดิม ({input.lastWater})
                                                    </div>
                                                ) : (
                                                    <div className="text-xs text-gray-400 mt-1">
                                                        ล่าสุด: {input.lastWater ?? '-'}{' '}
                                                        <span className="text-gray-300">({formatDate(input.lastWaterDate)})</span>
                                                    </div>
                                                )}
                                            </>
                                        )
                                    })()}
                                </div>

                                {/* Electricity Meter */}
                                <div className="col-span-5">
                                    {(() => {
                                        const isInvalid = input.electricityValue &&
                                            input.lastElectricity !== null &&
                                            Number(input.electricityValue) < input.lastElectricity
                                        return (
                                            <>
                                                <div className="flex items-center gap-1">
                                                    <div className="flex-1">
                                                        <input
                                                            type="number"
                                                            inputMode="numeric"
                                                            pattern="[0-9]*"
                                                            value={input.electricityValue}
                                                            onChange={(e) =>
                                                                handleInputChange(input.roomId, 'electricityValue', e.target.value)
                                                            }
                                                            placeholder={input.lastElectricity?.toString() || '0'}
                                                            className={`w-full px-2 py-2 text-sm border rounded-lg focus:ring-2 font-mono ${
                                                                isInvalid
                                                                    ? 'border-red-400 bg-red-50 focus:ring-red-500 focus:border-red-500 text-red-600'
                                                                    : 'border-amber-200 focus:ring-amber-500 focus:border-amber-500'
                                                            }`}
                                                        />
                                                    </div>
                                                </div>
                                                {isInvalid ? (
                                                    <div className="text-xs text-red-500 mt-1">
                                                        ค่าน้อยกว่าเดิม ({input.lastElectricity})
                                                    </div>
                                                ) : (
                                                    <div className="text-xs text-gray-400 mt-1">
                                                        ล่าสุด: {input.lastElectricity ?? '-'}{' '}
                                                        <span className="text-gray-300">({formatDate(input.lastElectricityDate)})</span>
                                                    </div>
                                                )}
                                            </>
                                        )
                                    })()}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {filteredRooms.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                    ไม่พบห้องพัก
                </div>
            )}

            {/* Floating Save Button */}
            <div className="fixed bottom-20 left-0 right-0 p-4 bg-gradient-to-t from-white via-white to-transparent">
                <button
                    onClick={handleBatchSubmit}
                    disabled={batchMutation.isPending || filledCount === 0}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-bold rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2"
                >
                    {batchMutation.isPending ? (
                        <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            กำลังบันทึก...
                        </>
                    ) : (
                        <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            บันทึกมิเตอร์ทั้งหมด
                            {filledCount > 0 && ` (${filledCount} รายการ)`}
                        </>
                    )}
                </button>
            </div>
        </div>
    )
}
