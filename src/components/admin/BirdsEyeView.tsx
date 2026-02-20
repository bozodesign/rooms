'use client'

import { useMutation } from '@tanstack/react-query'
import { formatCurrency } from '@/lib/utils'
import { useState, useRef } from 'react'
import useSWR from 'swr'

interface DashboardRoom {
    id: string
    roomNumber: string
    floor: number
    baseRentPrice: number
    status: 'vacant' | 'occupied' | 'maintenance'
    waterMeterNumber?: string
    electricityMeterNumber?: string
    tenant: {
        id: string
        name: string
        phone?: string
        pictureUrl?: string
        contractStartDate?: string
        contractEndDate?: string
        depositAmount?: number
        meterReadings?: Array<{
            month: number
            year: number
            electricityReading: number
            waterReading: number
            electricityReadingDate: string
            waterReadingDate: string
            recordedBy?: string
            notes?: string
        }>
    } | null
    invoice: {
        id: string
        paymentStatus: 'pending' | 'paid' | 'overdue'
        totalAmount: number
        dueDate: string
        paidAt?: string
    } | null
}

interface DashboardData {
    rooms: DashboardRoom[]
    stats: {
        totalRooms: number
        occupiedRooms: number
        vacantRooms: number
        paidInvoices: number
        pendingInvoices: number
        overdueInvoices: number
        totalRevenue: number
        expectedRevenue: number
    }
    currentPeriod: {
        month: number
        year: number
    }
}

const fetcher = async (url: string, lineUserId: string): Promise<DashboardData> => {
    const res = await fetch(url, {
        headers: {
            'x-line-userid': lineUserId,
        },
    })

    if (!res.ok) {
        throw new Error('Failed to fetch dashboard data')
    }

    return res.json()
}

export default function BirdsEyeView({ lineUserId }: { lineUserId: string }) {
    const [selectedRoom, setSelectedRoom] = useState<DashboardRoom | null>(null)
    const [showModal, setShowModal] = useState(false)
    const [showMeterHistory, setShowMeterHistory] = useState(false)
    const [isEditingMeters, setIsEditingMeters] = useState(false)
    const [waterMeterNumber, setWaterMeterNumber] = useState('')
    const [electricityMeterNumber, setElectricityMeterNumber] = useState('')
    const pressTimerRef = useRef<NodeJS.Timeout | null>(null)
    const [dragStartY, setDragStartY] = useState(0)
    const [dragCurrentY, setDragCurrentY] = useState(0)
    const [isDragging, setIsDragging] = useState(false)

    const { data, error, isLoading, mutate } = useSWR<DashboardData>(
        ['/api/admin/dashboard', lineUserId] as const,
        ([url, userId]: [string, string]) => fetcher(url, userId),
        {
            refreshInterval: 30000, // Refetch every 30 seconds
            revalidateOnFocus: true, // Revalidate when window is focused
            revalidateOnReconnect: true, // Revalidate when reconnected
            dedupingInterval: 2000, // Dedupe requests within 2 seconds
        }
    )

    const moveOutMutation = useMutation({
        mutationFn: async (roomId: string) => {
            const res = await fetch(`/api/admin/rooms/${roomId}/move-out`, {
                method: 'POST',
                headers: {
                    'x-line-userid': lineUserId,
                },
            })
            if (!res.ok) throw new Error('Failed to move out tenant')
            return res.json()
        },
        onSuccess: () => {
            mutate() // Revalidate SWR data
            setShowModal(false)
            setSelectedRoom(null)
        },
    })

    const toggleMaintenanceMutation = useMutation({
        mutationFn: async ({ roomId, status }: { roomId: string; status: 'maintenance' | 'vacant' }) => {
            const res = await fetch(`/api/admin/rooms/${roomId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'x-line-userid': lineUserId,
                },
                body: JSON.stringify({ status }),
            })
            if (!res.ok) throw new Error('Failed to update room status')
            return res.json()
        },
        onSuccess: () => {
            mutate() // Revalidate SWR data
            setShowModal(false)
            setSelectedRoom(null)
        },
    })

    const handlePressStart = (room: DashboardRoom) => {
        pressTimerRef.current = setTimeout(() => {
            handleOpenModal(room)
        }, 2000) // 2 seconds
    }

    const handlePressEnd = () => {
        if (pressTimerRef.current) {
            clearTimeout(pressTimerRef.current)
            pressTimerRef.current = null
        }
    }

    const handleMoveOut = () => {
        if (selectedRoom && confirm(`ยืนยันการย้ายออกจากห้อง ${selectedRoom.roomNumber}?`)) {
            moveOutMutation.mutate(selectedRoom.id)
        }
    }

    const handleToggleMaintenance = () => {
        if (!selectedRoom) return
        const newStatus = selectedRoom.status === 'maintenance' ? 'vacant' : 'maintenance'
        const confirmMessage = newStatus === 'maintenance'
            ? `ทำให้ห้อง ${selectedRoom.roomNumber} ไม่พร้อมใช้งาน (ซ่อมแซม)?`
            : `ทำให้ห้อง ${selectedRoom.roomNumber} พร้อมใช้งาน?`

        if (confirm(confirmMessage)) {
            toggleMaintenanceMutation.mutate({ roomId: selectedRoom.id, status: newStatus })
        }
    }

    const updateMetersMutation = useMutation({
        mutationFn: async ({ roomId, waterMeterNumber, electricityMeterNumber }: { roomId: string; waterMeterNumber: string; electricityMeterNumber: string }) => {
            const res = await fetch(`/api/admin/rooms/${roomId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'x-line-userid': lineUserId,
                },
                body: JSON.stringify({ waterMeterNumber, electricityMeterNumber }),
            })
            if (!res.ok) throw new Error('Failed to update meter numbers')
            return res.json()
        },
        onSuccess: (data) => {
            // Update the selected room immediately
            if (selectedRoom) {
                setSelectedRoom({
                    ...selectedRoom,
                    waterMeterNumber: data.room.waterMeterNumber,
                    electricityMeterNumber: data.room.electricityMeterNumber,
                })
            }
            mutate() // Revalidate SWR data
            setIsEditingMeters(false)
        },
    })

    const handleSaveMeters = () => {
        if (!selectedRoom) return
        updateMetersMutation.mutate({
            roomId: selectedRoom.id,
            waterMeterNumber,
            electricityMeterNumber,
        })
    }

    const handleOpenModal = (room: DashboardRoom) => {
        setSelectedRoom(room)
        setWaterMeterNumber(room.waterMeterNumber || '')
        setElectricityMeterNumber(room.electricityMeterNumber || '')
        setShowModal(true)
        setShowMeterHistory(false)
        setIsEditingMeters(false)
        setDragCurrentY(0)
    }

    const handleCloseModal = () => {
        setShowModal(false)
        setSelectedRoom(null)
        setDragCurrentY(0)
        setIsDragging(false)
    }

    const handleDragStart = (clientY: number) => {
        setDragStartY(clientY)
        setIsDragging(true)
    }

    const handleDragMove = (clientY: number) => {
        if (!isDragging) return
        const deltaY = clientY - dragStartY
        if (deltaY > 0) {
            setDragCurrentY(deltaY)
        }
    }

    const handleDragEnd = () => {
        if (dragCurrentY > 150) {
            handleCloseModal()
        } else {
            setDragCurrentY(0)
        }
        setIsDragging(false)
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-gray-900 mx-auto"></div>
                    <p className="mt-6 text-xl text-gray-700">กำลังโหลด...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="text-center p-6">
                    <p className="text-xl text-red-600">
                        เกิดข้อผิดพลาด: {error.message}
                    </p>
                </div>
            </div>
        )
    }

    if (!data) return null

    // Group rooms by floor
    const roomsByFloor = data.rooms.reduce<Record<number, DashboardRoom[]>>(
        (acc, room) => {
            if (!acc[room.floor]) {
                acc[room.floor] = []
            }
            acc[room.floor].push(room)
            return acc
        },
        {},
    )

    // Sort floors ascending and sort rooms within each floor
    const floors = Object.keys(roomsByFloor)
        .map(Number)
        .sort((a, b) => a - b)

    // Sort rooms within each floor
    floors.forEach((floor) => {
        roomsByFloor[floor].sort((a, b) => {
            const aNum = parseInt(a.roomNumber)
            const bNum = parseInt(b.roomNumber)
            if (!isNaN(aNum) && !isNaN(bNum)) {
                return aNum - bNum
            }
            return a.roomNumber.localeCompare(b.roomNumber)
        })
    })

    return (
        <div className="min-h-screen bg-gray-50 p-3 md:p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="text-center py-6 md:py-8">
                    <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-3">
                        ภาพรวมหอพัก
                    </h1>
                    <p className="text-xl md:text-2xl text-gray-600 font-medium">
                        {data.currentPeriod.month}/{data.currentPeriod.year}
                    </p>
                </div>

                {/* Statistics Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                    <div className="bg-white rounded-xl p-4 md:p-6 border border-gray-200 shadow-sm">
                        <p className="text-sm md:text-base text-gray-500 mb-2">ห้องทั้งหมด</p>
                        <p className="text-3xl md:text-4xl font-bold text-gray-900">
                            {data.stats.totalRooms}
                        </p>
                    </div>

                    <div className="bg-white rounded-xl p-4 md:p-6 border border-gray-200 shadow-sm">
                        <p className="text-sm md:text-base text-gray-500 mb-2">ชำระแล้ว</p>
                        <p className="text-3xl md:text-4xl font-bold text-gray-900">
                            {data.stats.paidInvoices}
                        </p>
                    </div>

                    <div className="bg-white rounded-xl p-4 md:p-6 border border-gray-200 shadow-sm">
                        <p className="text-sm md:text-base text-gray-500 mb-2">รอชำระ</p>
                        <p className="text-3xl md:text-4xl font-bold text-gray-900">
                            {data.stats.pendingInvoices}
                        </p>
                    </div>

                    <div className="bg-white rounded-xl p-4 md:p-6 border border-gray-200 shadow-sm">
                        <p className="text-sm md:text-base text-gray-500 mb-2">เกินกำหนด</p>
                        <p className="text-3xl md:text-4xl font-bold text-gray-900">
                            {data.stats.overdueInvoices}
                        </p>
                    </div>
                </div>

                {/* Revenue Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    <div className="bg-white rounded-xl p-5 md:p-7 border border-gray-200 shadow-sm">
                        <p className="text-base md:text-lg text-gray-500 mb-2">รายได้ที่ได้รับแล้ว</p>
                        <p className="text-3xl md:text-4xl font-bold text-gray-900">
                            {formatCurrency(data.stats.totalRevenue)}
                        </p>
                    </div>

                    <div className="bg-white rounded-xl p-5 md:p-7 border border-gray-200 shadow-sm">
                        <p className="text-base md:text-lg text-gray-500 mb-2">รายได้คาดหวัง</p>
                        <p className="text-3xl md:text-4xl font-bold text-gray-900">
                            {formatCurrency(data.stats.expectedRevenue)}
                        </p>
                    </div>
                </div>

                {/* Rooms Grid by Floor */}
                <div className="bg-white rounded-xl p-4 md:p-6 border border-gray-200 shadow-sm">
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">
                        ห้องพักทั้งหมด
                    </h2>
                    <div className="space-y-6">
                        {floors.map((floor, floorIndex) => (
                            <div key={floor}>
                                {/* Divider between floors */}
                                {floorIndex > 0 && (
                                    <div className="h-px bg-gray-200 my-6"></div>
                                )}

                                {/* Rooms Grid for this floor */}
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
                                    {roomsByFloor[floor].map((room) => {
                                        let bgColor = 'bg-gray-50'
                                        let borderColor = 'border-gray-300'
                                        let textColor = 'text-gray-700'
                                        let statusText = 'ว่าง'
                                        let statusBg = 'bg-gray-600'

                                        if (room.status === 'maintenance') {
                                            bgColor = 'bg-orange-50'
                                            borderColor = 'border-orange-300'
                                            textColor = 'text-orange-900'
                                            statusBg = 'bg-orange-600'
                                            statusText = 'ซ่อม'
                                        } else if (room.status === 'occupied' && room.invoice) {
                                            if (room.invoice.paymentStatus === 'paid') {
                                                bgColor = 'bg-green-50'
                                                borderColor = 'border-green-300'
                                                textColor = 'text-green-900'
                                                statusBg = 'bg-green-600'
                                                statusText = 'ชำระแล้ว'
                                            } else if (room.invoice.paymentStatus === 'overdue') {
                                                bgColor = 'bg-red-50'
                                                borderColor = 'border-red-300'
                                                textColor = 'text-red-900'
                                                statusBg = 'bg-red-600'
                                                statusText = 'เกินกำหนด'
                                            } else {
                                                bgColor = 'bg-yellow-50'
                                                borderColor = 'border-yellow-300'
                                                textColor = 'text-yellow-900'
                                                statusBg = 'bg-yellow-600'
                                                statusText = 'รอชำระ'
                                            }
                                        } else if (room.status === 'occupied' && !room.invoice) {
                                            bgColor = 'bg-blue-50'
                                            borderColor = 'border-blue-300'
                                            textColor = 'text-blue-900'
                                            statusBg = 'bg-blue-600'
                                            statusText = 'มีผู้เช่า'
                                        }

                                        return (
                                            <div
                                                key={room.id}
                                                className={`${bgColor} border-2 ${borderColor} rounded-lg p-3 md:p-4 text-center transition-all hover:shadow-md cursor-pointer select-none`}
                                                onMouseDown={() => handlePressStart(room)}
                                                onMouseUp={handlePressEnd}
                                                onMouseLeave={handlePressEnd}
                                                onTouchStart={() => handlePressStart(room)}
                                                onTouchEnd={handlePressEnd}
                                                onTouchCancel={handlePressEnd}
                                            >
                                                <p className={`font-bold text-2xl md:text-3xl ${textColor} mb-2`}>
                                                    {room.roomNumber}
                                                </p>
                                                {/* Only show status badge if no tenant OR if there's payment status to show */}
                                                {(!room.tenant || room.invoice) && (
                                                    <span className={`${statusBg} text-white text-xs md:text-sm px-2 py-1 rounded-full font-medium inline-block mb-2`}>
                                                        {statusText}
                                                    </span>
                                                )}
                                                {room.tenant && (
                                                    <div className="flex items-center justify-center my-2">
                                                        {room.tenant.pictureUrl ? (
                                                            <img
                                                                src={room.tenant.pictureUrl}
                                                                alt={room.tenant.name}
                                                                className="w-10 h-10 md:w-12 md:h-12 rounded-full border-2 border-white shadow-sm"
                                                            />
                                                        ) : (
                                                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gray-300 border-2 border-white shadow-sm flex items-center justify-center">
                                                                <span className="text-white text-sm md:text-base font-bold">
                                                                    {room.tenant.name.charAt(0)}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                <p className="text-sm md:text-base text-gray-500 font-medium">
                                                    {formatCurrency(room.baseRentPrice)}
                                                </p>
                                                {room.invoice && (
                                                    <p className={`text-sm md:text-base ${textColor} font-bold mt-2`}>
                                                        {formatCurrency(room.invoice.totalAmount)}
                                                    </p>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Legend */}
                <div className="bg-white rounded-xl p-4 md:p-6 border border-gray-200 shadow-sm">
                    <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-4">สัญลักษณ์</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 text-base md:text-lg">
                        <div className="flex items-center gap-3">
                            <div className="w-5 h-5 md:w-6 md:h-6 bg-gray-50 border-2 border-gray-300 rounded"></div>
                            <span className="text-gray-700">ว่าง</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-5 h-5 md:w-6 md:h-6 bg-green-50 border-2 border-green-300 rounded"></div>
                            <span className="text-gray-700">ชำระแล้ว</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-5 h-5 md:w-6 md:h-6 bg-yellow-50 border-2 border-yellow-300 rounded"></div>
                            <span className="text-gray-700">รอชำระ</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-5 h-5 md:w-6 md:h-6 bg-red-50 border-2 border-red-300 rounded"></div>
                            <span className="text-gray-700">เกินกำหนด</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-5 h-5 md:w-6 md:h-6 bg-orange-50 border-2 border-orange-300 rounded"></div>
                            <span className="text-gray-700">ซ่อมแซม</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-5 h-5 md:w-6 md:h-6 bg-blue-50 border-2 border-blue-300 rounded"></div>
                            <span className="text-gray-700">มีผู้เช่า</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Room Details Modal - Bottom Sheet */}
            {showModal && selectedRoom && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-black bg-opacity-50 z-50 transition-opacity"
                        onClick={handleCloseModal}
                    />

                    {/* Bottom Sheet */}
                    <div
                        className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl"
                        style={{
                            transform: `translateY(${dragCurrentY}px)`,
                            maxHeight: '90vh',
                            transition: isDragging ? 'none' : 'transform 0.3s ease-out',
                            animation: 'slideUp 0.3s ease-out',
                        }}
                    >
                        {/* Drag Handle */}
                        <div
                            className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 rounded-t-3xl cursor-grab active:cursor-grabbing"
                            onMouseDown={(e) => handleDragStart(e.clientY)}
                            onMouseMove={(e) => isDragging && handleDragMove(e.clientY)}
                            onMouseUp={handleDragEnd}
                            onMouseLeave={handleDragEnd}
                            onTouchStart={(e) => handleDragStart(e.touches[0].clientY)}
                            onTouchMove={(e) => isDragging && handleDragMove(e.touches[0].clientY)}
                            onTouchEnd={handleDragEnd}
                        >
                            {/* Drag Indicator */}
                            <div className="w-12 h-1.5 bg-white bg-opacity-50 rounded-full mx-auto mb-4"></div>

                            <div className="flex justify-between items-center">
                                <div>
                                    <h2 className="text-3xl font-bold">ห้อง {selectedRoom.roomNumber}</h2>
                                    <p className="text-blue-100 mt-1">ชั้น {selectedRoom.floor}</p>
                                </div>
                                <button
                                    onClick={handleCloseModal}
                                    className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-all"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Content - Scrollable */}
                        <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 100px)' }}>
                            <div className="p-6 space-y-6">
                            {/* Room Info */}
                            <div className="bg-gray-50 rounded-lg p-4">
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="font-bold text-lg text-gray-900">ข้อมูลห้อง</h3>
                                    {!isEditingMeters && (
                                        <button
                                            onClick={() => setIsEditingMeters(true)}
                                            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                                        >
                                            แก้ไขมิเตอร์
                                        </button>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                                    <div>
                                        <p className="text-gray-600">ค่าเช่า</p>
                                        <p className="font-bold text-gray-900">{formatCurrency(selectedRoom.baseRentPrice)}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-600">สถานะ</p>
                                        <p className="font-bold text-gray-900">
                                            {selectedRoom.status === 'vacant' && 'ว่าง'}
                                            {selectedRoom.status === 'occupied' && 'มีผู้เช่า'}
                                            {selectedRoom.status === 'maintenance' && 'ซ่อมแซม'}
                                        </p>
                                    </div>
                                </div>

                                {/* Meter Numbers */}
                                <div className="border-t border-gray-200 pt-3">
                                    <h4 className="font-semibold text-gray-900 mb-2">หมายเลขมิเตอร์</h4>
                                    {isEditingMeters ? (
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-xs text-gray-600 block mb-1">มิเตอร์น้ำ</label>
                                                <input
                                                    type="text"
                                                    value={waterMeterNumber}
                                                    onChange={(e) => setWaterMeterNumber(e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                    placeholder="เลขมิเตอร์น้ำ"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-600 block mb-1">มิเตอร์ไฟฟ้า</label>
                                                <input
                                                    type="text"
                                                    value={electricityMeterNumber}
                                                    onChange={(e) => setElectricityMeterNumber(e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                    placeholder="เลขมิเตอร์ไฟฟ้า"
                                                />
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={handleSaveMeters}
                                                    disabled={updateMetersMutation.isPending}
                                                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-2 px-3 rounded-lg text-sm font-medium"
                                                >
                                                    {updateMetersMutation.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setIsEditingMeters(false)
                                                        setWaterMeterNumber(selectedRoom.waterMeterNumber || '')
                                                        setElectricityMeterNumber(selectedRoom.electricityMeterNumber || '')
                                                    }}
                                                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-3 rounded-lg text-sm font-medium"
                                                >
                                                    ยกเลิก
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            <div>
                                                <p className="text-gray-600">มิเตอร์น้ำ</p>
                                                <p className="font-medium text-gray-900 tracking-wider font-mono">
                                                    {selectedRoom.waterMeterNumber || '-'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-gray-600">มิเตอร์ไฟฟ้า</p>
                                                <p className="font-medium text-gray-900 tracking-wider font-mono">
                                                    {selectedRoom.electricityMeterNumber || '-'}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Tenant Info */}
                            {selectedRoom.tenant && (
                                <div className="bg-blue-50 rounded-lg p-4">
                                    <h3 className="font-bold text-lg mb-3 text-gray-900">ข้อมูลผู้เช่า</h3>
                                    <div className="flex items-center gap-4 mb-4">
                                        {selectedRoom.tenant.pictureUrl ? (
                                            <img
                                                src={selectedRoom.tenant.pictureUrl}
                                                alt={selectedRoom.tenant.name}
                                                className="w-16 h-16 rounded-full border-2 border-white shadow-md"
                                            />
                                        ) : (
                                            <div className="w-16 h-16 rounded-full bg-gray-300 border-2 border-white shadow-md flex items-center justify-center">
                                                <span className="text-white text-xl font-bold">
                                                    {selectedRoom.tenant.name.charAt(0)}
                                                </span>
                                            </div>
                                        )}
                                        <div>
                                            <p className="font-bold text-lg text-gray-900">{selectedRoom.tenant.name}</p>
                                            {selectedRoom.tenant.phone && (
                                                <p className="text-gray-600">{selectedRoom.tenant.phone}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Contract Details */}
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        {selectedRoom.tenant.contractStartDate && (
                                            <div>
                                                <p className="text-gray-600">วันที่เข้า</p>
                                                <p className="font-medium text-gray-900">
                                                    {new Date(selectedRoom.tenant.contractStartDate).toLocaleDateString('th-TH')}
                                                </p>
                                            </div>
                                        )}
                                        {selectedRoom.tenant.contractEndDate && (
                                            <div>
                                                <p className="text-gray-600">วันที่สิ้นสุด</p>
                                                <p className="font-medium text-gray-900">
                                                    {new Date(selectedRoom.tenant.contractEndDate).toLocaleDateString('th-TH')}
                                                </p>
                                            </div>
                                        )}
                                        {selectedRoom.tenant.depositAmount !== undefined && (
                                            <div>
                                                <p className="text-gray-600">เงินมัดจำ</p>
                                                <p className="font-bold text-gray-900">
                                                    {formatCurrency(selectedRoom.tenant.depositAmount)}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Latest Meter Readings */}
                                    {selectedRoom.tenant.meterReadings && selectedRoom.tenant.meterReadings.length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-blue-200">
                                            <div className="flex justify-between items-center mb-3">
                                                <h4 className="font-semibold text-gray-900">บันทึกมิเตอร์</h4>
                                                {selectedRoom.tenant.meterReadings.length > 1 && (
                                                    <button
                                                        onClick={() => setShowMeterHistory(!showMeterHistory)}
                                                        className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                                                    >
                                                        {showMeterHistory ? 'ซ่อนประวัติ' : 'ดูประวัติทั้งหมด'}
                                                    </button>
                                                )}
                                            </div>

                                            {/* Current vs Previous Reading */}
                                            <div className="space-y-4">
                                                {/* Electricity */}
                                                <div className="bg-white bg-opacity-50 rounded-lg p-3">
                                                    <p className="text-gray-700 font-medium mb-2">⚡ ไฟฟ้า</p>
                                                    <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                                                        <div>
                                                            <p className="text-gray-500">เดือนปัจจุบัน</p>
                                                            <p className="font-bold text-gray-900 text-base">
                                                                {selectedRoom.tenant.meterReadings[0].electricityReading}
                                                            </p>
                                                            <p className="text-gray-400 text-xs">
                                                                {new Date(selectedRoom.tenant.meterReadings[0].electricityReadingDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                                                            </p>
                                                        </div>
                                                        {selectedRoom.tenant.meterReadings.length > 1 && (
                                                            <div>
                                                                <p className="text-gray-500">เดือนก่อนหน้า</p>
                                                                <p className="font-medium text-gray-700 text-base">
                                                                    {selectedRoom.tenant.meterReadings[1].electricityReading}
                                                                </p>
                                                                <p className="text-gray-400 text-xs">
                                                                    {new Date(selectedRoom.tenant.meterReadings[1].electricityReadingDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {selectedRoom.tenant.meterReadings.length > 1 && (
                                                        <div className="bg-yellow-50 rounded px-2 py-1 border border-yellow-200">
                                                            <p className="text-xs text-gray-600">
                                                                ใช้ไป: <span className="font-bold text-yellow-900">
                                                                    {selectedRoom.tenant.meterReadings[0].electricityReading - selectedRoom.tenant.meterReadings[1].electricityReading}
                                                                </span> หน่วย
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Water */}
                                                <div className="bg-white bg-opacity-50 rounded-lg p-3">
                                                    <p className="text-gray-700 font-medium mb-2">💧 น้ำ</p>
                                                    <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                                                        <div>
                                                            <p className="text-gray-500">เดือนปัจจุบัน</p>
                                                            <p className="font-bold text-gray-900 text-base">
                                                                {selectedRoom.tenant.meterReadings[0].waterReading}
                                                            </p>
                                                            <p className="text-gray-400 text-xs">
                                                                {new Date(selectedRoom.tenant.meterReadings[0].waterReadingDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                                                            </p>
                                                        </div>
                                                        {selectedRoom.tenant.meterReadings.length > 1 && (
                                                            <div>
                                                                <p className="text-gray-500">เดือนก่อนหน้า</p>
                                                                <p className="font-medium text-gray-700 text-base">
                                                                    {selectedRoom.tenant.meterReadings[1].waterReading}
                                                                </p>
                                                                <p className="text-gray-400 text-xs">
                                                                    {new Date(selectedRoom.tenant.meterReadings[1].waterReadingDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {selectedRoom.tenant.meterReadings.length > 1 && (
                                                        <div className="bg-blue-50 rounded px-2 py-1 border border-blue-200">
                                                            <p className="text-xs text-gray-600">
                                                                ใช้ไป: <span className="font-bold text-blue-900">
                                                                    {selectedRoom.tenant.meterReadings[0].waterReading - selectedRoom.tenant.meterReadings[1].waterReading}
                                                                </span> หน่วย
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Full History */}
                                            {showMeterHistory && selectedRoom.tenant.meterReadings.length > 1 && (
                                                <div className="mt-4 pt-4 border-t border-blue-200">
                                                    <h5 className="font-medium text-gray-900 mb-3 text-sm">ประวัติการบันทึกทั้งหมด</h5>
                                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                                        {selectedRoom.tenant.meterReadings.map((reading, index) => (
                                                            <div key={index} className="bg-white bg-opacity-70 rounded p-3 text-xs">
                                                                <div className="flex justify-between items-center mb-2">
                                                                    <span className="font-medium text-gray-900">
                                                                        {reading.month}/{reading.year}
                                                                    </span>
                                                                    {index === 0 && (
                                                                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">
                                                                            ล่าสุด
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    <div>
                                                                        <p className="text-gray-500">⚡ ไฟฟ้า</p>
                                                                        <p className="font-bold text-gray-900">{reading.electricityReading}</p>
                                                                        <p className="text-gray-400 text-xs">
                                                                            {new Date(reading.electricityReadingDate).toLocaleDateString('th-TH')}
                                                                        </p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-gray-500">💧 น้ำ</p>
                                                                        <p className="font-bold text-gray-900">{reading.waterReading}</p>
                                                                        <p className="text-gray-400 text-xs">
                                                                            {new Date(reading.waterReadingDate).toLocaleDateString('th-TH')}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                {reading.recordedBy && (
                                                                    <p className="text-gray-500 mt-1">บันทึกโดย: {reading.recordedBy}</p>
                                                                )}
                                                                {reading.notes && (
                                                                    <p className="text-gray-600 mt-1 italic">หมายเหตุ: {reading.notes}</p>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="space-y-3">
                                {selectedRoom.tenant && (
                                    <button
                                        onClick={handleMoveOut}
                                        disabled={moveOutMutation.isPending}
                                        className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                                    >
                                        {moveOutMutation.isPending ? 'กำลังดำเนินการ...' : 'ย้ายออกจากห้อง'}
                                    </button>
                                )}

                                <button
                                    onClick={handleToggleMaintenance}
                                    disabled={toggleMaintenanceMutation.isPending || selectedRoom.status === 'occupied'}
                                    className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                                >
                                    {toggleMaintenanceMutation.isPending
                                        ? 'กำลังดำเนินการ...'
                                        : selectedRoom.status === 'maintenance'
                                        ? 'ทำให้ห้องพร้อมใช้งาน'
                                        : 'ทำให้ห้องไม่พร้อมใช้งาน (ซ่อมแซม)'}
                                </button>

                                <button
                                    onClick={handleCloseModal}
                                    className="w-full bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-3 px-4 rounded-lg transition-colors"
                                >
                                    ปิด
                                </button>
                            </div>
                        </div>
                    </div>
                    </div>
                </>
            )}
        </div>
    )
}
