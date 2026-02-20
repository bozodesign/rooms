'use client'

import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import QRCode from 'qrcode'
import { formatCurrency } from '@/lib/utils'
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    LabelList,
} from 'recharts'

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
    baseRentPrice: number
    status: 'vacant' | 'occupied' | 'maintenance'
    tenantId?: {
        _id: string
        displayName: string
        phoneNumber?: string
        pictureUrl?: string
    }
    waterRate?: number
    electricityRate?: number
    waterMeterNumber?: string
    electricityMeterNumber?: string
    waterMeterReadings?: MeterReadingHistory[]
    electricityMeterReadings?: MeterReadingHistory[]
    depositAmount?: number
    notes?: string
}

interface RoomFormData {
    roomNumber: string
    floor: number
    baseRentPrice: number
    waterRate: number
    electricityRate: number
    waterMeterNumber: string
    electricityMeterNumber: string
    depositAmount: number
    notes: string
}

async function fetchRooms(lineUserId: string): Promise<{ rooms: Room[] }> {
    const res = await fetch('/api/admin/rooms', {
        headers: { 'x-line-userid': lineUserId },
    })
    if (!res.ok) throw new Error('Failed to fetch rooms')
    return res.json()
}

async function createRoom(lineUserId: string, data: RoomFormData) {
    const res = await fetch('/api/admin/rooms', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-line-userid': lineUserId,
        },
        body: JSON.stringify(data),
    })
    if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create room')
    }
    return res.json()
}

async function updateRoom(
    lineUserId: string,
    roomId: string,
    data: Partial<RoomFormData>,
) {
    const res = await fetch(`/api/admin/rooms/${roomId}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'x-line-userid': lineUserId,
        },
        body: JSON.stringify(data),
    })
    if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update room')
    }
    return res.json()
}

async function deleteRoom(lineUserId: string, roomId: string) {
    const res = await fetch(`/api/admin/rooms/${roomId}`, {
        method: 'DELETE',
        headers: { 'x-line-userid': lineUserId },
    })
    if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete room')
    }
    return res.json()
}

async function generateQRToken(lineUserId: string, roomId: string) {
    const res = await fetch(`/api/admin/rooms/${roomId}/qr`, {
        method: 'POST',
        headers: { 'x-line-userid': lineUserId },
    })
    if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to generate QR code')
    }
    return res.json()
}

async function batchCreateRooms(lineUserId: string, rooms: RoomFormData[]) {
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
        throw new Error(error.error || 'Failed to batch create rooms')
    }
    return res.json()
}

async function recordMeterReading(
    lineUserId: string,
    roomId: string,
    meterType: 'water' | 'electricity',
    value: number,
    notes?: string,
) {
    const res = await fetch(`/api/admin/rooms/${roomId}/meter`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-line-userid': lineUserId,
        },
        body: JSON.stringify({ meterType, value, notes }),
    })
    if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to record meter reading')
    }
    return res.json()
}

// Helper function to get the latest reading by date
function getLatestReading(readings: MeterReadingHistory[] | undefined) {
    if (!readings || readings.length === 0) return null
    return [...readings].sort(
        (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
    )[0]
}

export default function RoomsManagement({
    lineUserId,
}: {
    lineUserId: string
}) {
    const queryClient = useQueryClient()
    const [activeTab, setActiveTab] = useState<'list' | 'add' | 'batch'>('list')
    const [editingRoom, setEditingRoom] = useState<Room | null>(null)
    const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
    const [showRoomModal, setShowRoomModal] = useState(false)
    const [qrCodeData, setQrCodeData] = useState<{
        url: string
        dataUrl: string
    } | null>(null)
    const [showQRModal, setShowQRModal] = useState(false)
    const [batchInput, setBatchInput] = useState('')
    const [filterStatus, setFilterStatus] = useState<
        'all' | 'vacant' | 'occupied' | 'maintenance'
    >('all')
    const [searchQuery, setSearchQuery] = useState('')

    // Meter reading state
    const [showMeterModal, setShowMeterModal] = useState(false)
    const [meterType, setMeterType] = useState<'water' | 'electricity'>('water')
    const [meterValue, setMeterValue] = useState('')
    const [meterNotes, setMeterNotes] = useState('')
    const [showMeterHistory, setShowMeterHistory] = useState(false)

    // Drag state for modals
    const [dragStartY, setDragStartY] = useState(0)
    const [dragCurrentY, setDragCurrentY] = useState(0)
    const [isDragging, setIsDragging] = useState(false)

    const [formData, setFormData] = useState<RoomFormData>({
        roomNumber: '',
        floor: 1,
        baseRentPrice: 3000,
        waterRate: 18,
        electricityRate: 8,
        waterMeterNumber: '',
        electricityMeterNumber: '',
        depositAmount: 0,
        notes: '',
    })

    const { data, isLoading, error } = useQuery({
        queryKey: ['admin-rooms', lineUserId],
        queryFn: () => fetchRooms(lineUserId),
    })

    const createMutation = useMutation({
        mutationFn: (data: RoomFormData) => createRoom(lineUserId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-rooms'] })
            setActiveTab('list')
            resetForm()
            alert('เพิ่มห้องเรียบร้อยแล้ว')
        },
        onError: (error: Error) => alert('เกิดข้อผิดพลาด: ' + error.message),
    })

    const updateMutation = useMutation({
        mutationFn: ({
            roomId,
            data,
        }: {
            roomId: string
            data: Partial<RoomFormData>
        }) => updateRoom(lineUserId, roomId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-rooms'] })
            setShowRoomModal(false)
            setEditingRoom(null)
            resetForm()
            alert('อัปเดตห้องเรียบร้อยแล้ว')
        },
        onError: (error: Error) => alert('เกิดข้อผิดพลาด: ' + error.message),
    })

    const deleteMutation = useMutation({
        mutationFn: (roomId: string) => deleteRoom(lineUserId, roomId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-rooms'] })
            setShowRoomModal(false)
            alert('ลบห้องเรียบร้อยแล้ว')
        },
        onError: (error: Error) => alert('เกิดข้อผิดพลาด: ' + error.message),
    })

    const qrMutation = useMutation({
        mutationFn: (roomId: string) => generateQRToken(lineUserId, roomId),
        onSuccess: async (data) => {
            try {
                const qrDataUrl = await QRCode.toDataURL(data.assignmentUrl, {
                    width: 300,
                    margin: 2,
                })
                setQrCodeData({ url: data.assignmentUrl, dataUrl: qrDataUrl })
                setShowQRModal(true)
            } catch (error) {
                alert('เกิดข้อผิดพลาดในการสร้าง QR Code')
            }
        },
        onError: (error: Error) => alert('เกิดข้อผิดพลาด: ' + error.message),
    })

    const batchMutation = useMutation({
        mutationFn: (rooms: RoomFormData[]) =>
            batchCreateRooms(lineUserId, rooms),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['admin-rooms'] })
            setActiveTab('list')
            setBatchInput('')
            alert(`เพิ่มห้องสำเร็จ ${data.createdCount} ห้อง`)
        },
        onError: (error: Error) => alert('เกิดข้อผิดพลาด: ' + error.message),
    })

    const meterMutation = useMutation({
        mutationFn: ({
            roomId,
            meterType,
            value,
            notes,
        }: {
            roomId: string
            meterType: 'water' | 'electricity'
            value: number
            notes?: string
        }) => recordMeterReading(lineUserId, roomId, meterType, value, notes),
        onMutate: async ({ roomId, meterType, value, notes }) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: ['admin-rooms'] })

            // Snapshot the previous value
            const previousData = queryClient.getQueryData([
                'admin-rooms',
                lineUserId,
            ])

            // Create the new reading
            const newReading: MeterReadingHistory = {
                value,
                recordedAt: new Date().toISOString(),
                recordedBy: lineUserId,
                notes,
            }

            // Optimistically update the cache
            queryClient.setQueryData(
                ['admin-rooms', lineUserId],
                (old: { rooms: Room[] } | undefined) => {
                    if (!old) return old
                    return {
                        ...old,
                        rooms: old.rooms.map((room) => {
                            if (room._id !== roomId) return room
                            if (meterType === 'water') {
                                return {
                                    ...room,
                                    waterMeterReadings: [
                                        ...(room.waterMeterReadings || []),
                                        newReading,
                                    ],
                                }
                            } else {
                                return {
                                    ...room,
                                    electricityMeterReadings: [
                                        ...(room.electricityMeterReadings ||
                                            []),
                                        newReading,
                                    ],
                                }
                            }
                        }),
                    }
                },
            )

            // Optimistically update selectedRoom
            if (selectedRoom && selectedRoom._id === roomId) {
                if (meterType === 'water') {
                    setSelectedRoom({
                        ...selectedRoom,
                        waterMeterReadings: [
                            ...(selectedRoom.waterMeterReadings || []),
                            newReading,
                        ],
                    })
                } else {
                    setSelectedRoom({
                        ...selectedRoom,
                        electricityMeterReadings: [
                            ...(selectedRoom.electricityMeterReadings || []),
                            newReading,
                        ],
                    })
                }
            }

            // Close modal immediately for better UX
            setShowMeterModal(false)
            setMeterValue('')
            setMeterNotes('')

            return { previousData }
        },
        onSuccess: () => {
            // Refetch to ensure server state is synced
            queryClient.invalidateQueries({ queryKey: ['admin-rooms'] })
        },
        onError: (error: Error, variables, context) => {
            // Rollback on error
            if (context?.previousData) {
                queryClient.setQueryData(
                    ['admin-rooms', lineUserId],
                    context.previousData,
                )
            }
            alert('เกิดข้อผิดพลาด: ' + error.message)
        },
    })

    const resetForm = () => {
        setFormData({
            roomNumber: '',
            floor: 1,
            baseRentPrice: 3000,
            waterRate: 18,
            electricityRate: 8,
            waterMeterNumber: '',
            electricityMeterNumber: '',
            depositAmount: 0,
            notes: '',
        })
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (editingRoom) {
            updateMutation.mutate({ roomId: editingRoom._id, data: formData })
        } else {
            createMutation.mutate(formData)
        }
    }

    const handleEditRoom = (room: Room) => {
        setEditingRoom(room)
        setFormData({
            roomNumber: room.roomNumber,
            floor: room.floor,
            baseRentPrice: room.baseRentPrice,
            waterRate: room.waterRate || 18,
            electricityRate: room.electricityRate || 8,
            waterMeterNumber: room.waterMeterNumber || '',
            electricityMeterNumber: room.electricityMeterNumber || '',
            depositAmount: room.depositAmount || 0,
            notes: room.notes || '',
        })
        setShowRoomModal(true)
    }

    const handleViewRoom = (room: Room) => {
        setSelectedRoom(room)
        setEditingRoom(null)
        setShowRoomModal(true)
    }

    const handleBatchSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const lines = batchInput.trim().split('\n')
            const rooms: RoomFormData[] = lines.map((line, index) => {
                const parts = line.split(',').map((p) => p.trim())
                if (parts.length < 3) {
                    throw new Error(
                        `บรรทัด ${index + 1}: ต้องมีอย่างน้อย 3 ค่า (หมายเลขห้อง,ชั้น,ค่าเช่า)`,
                    )
                }
                return {
                    roomNumber: parts[0],
                    floor: parseInt(parts[1]),
                    baseRentPrice: parseFloat(parts[2]),
                    waterRate: parts[3] ? parseFloat(parts[3]) : 18,
                    electricityRate: parts[4] ? parseFloat(parts[4]) : 8,
                    waterMeterNumber: '',
                    electricityMeterNumber: '',
                    depositAmount: parts[5] ? parseFloat(parts[5]) : 0,
                    notes: parts[6] || '',
                }
            })
            if (rooms.length === 0) {
                alert('กรุณากรอกข้อมูลห้องพัก')
                return
            }
            batchMutation.mutate(rooms)
        } catch (error: any) {
            alert('รูปแบบข้อมูลไม่ถูกต้อง: ' + error.message)
        }
    }

    const handleDownloadQR = () => {
        if (!qrCodeData || !selectedRoom) return
        const link = document.createElement('a')
        link.download = `room-${selectedRoom.roomNumber}-qr.png`
        link.href = qrCodeData.dataUrl
        link.click()
    }

    const handlePrintQR = () => {
        if (!qrCodeData || !selectedRoom) return
        const printWindow = window.open('', '_blank')
        if (!printWindow) return
        printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code - ห้อง ${selectedRoom.roomNumber}</title>
          <style>
            body { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; font-family: 'Kanit', Arial, sans-serif; }
            .container { text-align: center; padding: 40px; border: 2px solid #000; border-radius: 10px; }
            h1 { margin: 0 0 10px 0; font-size: 32px; }
            p { margin: 5px 0; font-size: 18px; color: #666; }
            img { margin: 20px 0; }
            .instructions { margin-top: 20px; font-size: 14px; color: #888; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>ห้อง ${selectedRoom.roomNumber}</h1>
            <p>ชั้น ${selectedRoom.floor}</p>
            <img src="${qrCodeData.dataUrl}" alt="QR Code" />
            <p class="instructions">สแกน QR Code เพื่อเข้าสู่ห้องพัก</p>
            <p class="instructions" style="font-size: 12px;">QR Code มีอายุ 24 ชั่วโมง</p>
          </div>
        </body>
      </html>
    `)
        printWindow.document.close()
        setTimeout(() => printWindow.print(), 250)
    }

    // Drag handlers
    const handleDragStart = (clientY: number) => {
        setDragStartY(clientY)
        setIsDragging(true)
    }

    const handleDragMove = (clientY: number) => {
        if (!isDragging) return
        const deltaY = clientY - dragStartY
        if (deltaY > 0) setDragCurrentY(deltaY)
    }

    const handleDragEnd = () => {
        if (dragCurrentY > 150) {
            setShowRoomModal(false)
            setShowQRModal(false)
            setSelectedRoom(null)
            setEditingRoom(null)
        }
        setDragCurrentY(0)
        setIsDragging(false)
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">กำลังโหลด...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="text-center p-6">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg
                            className="w-8 h-8 text-red-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </div>
                    <p className="text-red-600">
                        เกิดข้อผิดพลาด: {(error as Error).message}
                    </p>
                </div>
            </div>
        )
    }

    const rooms = data?.rooms || []
    const filteredRooms = rooms
        .filter(
            (room) => filterStatus === 'all' || room.status === filterStatus,
        )
        .filter(
            (room) =>
                searchQuery === '' ||
                room.roomNumber
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase()),
        )

    const stats = {
        total: rooms.length,
        vacant: rooms.filter((r) => r.status === 'vacant').length,
        occupied: rooms.filter((r) => r.status === 'occupied').length,
        maintenance: rooms.filter((r) => r.status === 'maintenance').length,
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
                <div className="px-4 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                จัดการห้องพัก
                            </h1>
                            <p className="text-sm text-gray-500 mt-1">
                                ทั้งหมด {stats.total} ห้อง
                            </p>
                        </div>
                        <a
                            href="/admin/dashboard"
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <svg
                                className="w-6 h-6"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        </a>
                    </div>

                </div>
            </div>

            {/* Content */}
            <div className="p-4 pb-24">
                {/* List View */}
                {activeTab === 'list' && (
                    <div className="space-y-4">
                        {/* Stats Cards */}
                        <div className="grid grid-cols-4 gap-2">
                            <button
                                onClick={() => setFilterStatus('all')}
                                className={`p-3 rounded-xl text-center transition-all ${
                                    filterStatus === 'all'
                                        ? 'bg-blue-100 border-2 border-blue-400'
                                        : 'bg-white border border-gray-200'
                                }`}
                            >
                                <p className="text-xl font-bold text-gray-900">
                                    {stats.total}
                                </p>
                                <p className="text-xs text-gray-500">ทั้งหมด</p>
                            </button>
                            <button
                                onClick={() => setFilterStatus('vacant')}
                                className={`p-3 rounded-xl text-center transition-all ${
                                    filterStatus === 'vacant'
                                        ? 'bg-gray-200 border-2 border-gray-400'
                                        : 'bg-white border border-gray-200'
                                }`}
                            >
                                <p className="text-xl font-bold text-gray-600">
                                    {stats.vacant}
                                </p>
                                <p className="text-xs text-gray-500">ว่าง</p>
                            </button>
                            <button
                                onClick={() => setFilterStatus('occupied')}
                                className={`p-3 rounded-xl text-center transition-all ${
                                    filterStatus === 'occupied'
                                        ? 'bg-green-200 border-2 border-green-400'
                                        : 'bg-white border border-gray-200'
                                }`}
                            >
                                <p className="text-xl font-bold text-green-600">
                                    {stats.occupied}
                                </p>
                                <p className="text-xs text-gray-500">
                                    มีผู้เช่า
                                </p>
                            </button>
                            <button
                                onClick={() => setFilterStatus('maintenance')}
                                className={`p-3 rounded-xl text-center transition-all ${
                                    filterStatus === 'maintenance'
                                        ? 'bg-orange-200 border-2 border-orange-400'
                                        : 'bg-white border border-gray-200'
                                }`}
                            >
                                <p className="text-xl font-bold text-orange-600">
                                    {stats.maintenance}
                                </p>
                                <p className="text-xs text-gray-500">ซ่อม</p>
                            </button>
                        </div>

                        {/* Search */}
                        <div className="relative">
                            <svg
                                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
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
                            <input
                                type="text"
                                placeholder="ค้นหาห้อง..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            />
                        </div>

                        {/* Room List */}
                        {filteredRooms.length === 0 ? (
                            <div className="bg-white rounded-2xl p-8 text-center">
                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg
                                        className="w-8 h-8 text-gray-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                                        />
                                    </svg>
                                </div>
                                <p className="text-gray-500">ไม่พบห้องพัก</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {filteredRooms.map((room) => (
                                    <button
                                        key={room._id}
                                        onClick={() => handleViewRoom(room)}
                                        className={`w-full bg-white rounded-xl p-4 text-left border-2 transition-all hover:shadow-md active:scale-[0.99] ${
                                            room.status === 'vacant'
                                                ? 'border-gray-200 hover:border-gray-300'
                                                : room.status === 'occupied'
                                                  ? 'border-green-200 hover:border-green-300 bg-green-50'
                                                  : 'border-orange-200 hover:border-orange-300 bg-orange-50'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className={`w-3 h-3 rounded-full ${
                                                            room.status === 'vacant'
                                                                ? 'bg-gray-400'
                                                                : room.status === 'occupied'
                                                                  ? 'bg-green-500'
                                                                  : 'bg-orange-500'
                                                        }`}
                                                    />
                                                    <span className="text-xl font-bold text-gray-900">
                                                        {room.roomNumber}
                                                    </span>
                                                </div>
                                                <span className="text-sm text-gray-500">
                                                    ชั้น {room.floor}
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-semibold text-gray-900">
                                                    {formatCurrency(room.baseRentPrice)}
                                                </p>
                                                {room.tenantId && (
                                                    <p className="text-xs text-green-600 truncate max-w-[120px]">
                                                        {room.tenantId.displayName}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

            </div>

            {/* Room Detail Modal */}
            {showRoomModal && (selectedRoom || editingRoom) && (
                <>
                    <div
                        className="fixed inset-0 bg-black bg-opacity-50 z-50"
                        onClick={() => setShowRoomModal(false)}
                    />
                    <div
                        className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl"
                        style={{
                            transform: `translateY(${dragCurrentY}px)`,
                            maxHeight: '85vh',
                            transition: isDragging
                                ? 'none'
                                : 'transform 0.3s ease-out',
                            animation: 'slideUp 0.3s ease-out',
                        }}
                    >
                        {/* Drag Handle */}
                        <div
                            className="sticky top-0 bg-white rounded-t-3xl px-6 py-4 border-b border-gray-100 cursor-grab active:cursor-grabbing"
                            onMouseDown={(e) => handleDragStart(e.clientY)}
                            onMouseMove={(e) =>
                                isDragging && handleDragMove(e.clientY)
                            }
                            onMouseUp={handleDragEnd}
                            onMouseLeave={handleDragEnd}
                            onTouchStart={(e) =>
                                handleDragStart(e.touches[0].clientY)
                            }
                            onTouchMove={(e) =>
                                isDragging &&
                                handleDragMove(e.touches[0].clientY)
                            }
                            onTouchEnd={handleDragEnd}
                        >
                            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-4"></div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900">
                                        ห้อง{' '}
                                        {
                                            (editingRoom || selectedRoom)
                                                ?.roomNumber
                                        }
                                    </h2>
                                    <p className="text-gray-500 text-sm">
                                        ชั้น{' '}
                                        {(editingRoom || selectedRoom)?.floor}
                                    </p>
                                </div>
                                <span
                                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                                        (editingRoom || selectedRoom)
                                            ?.status === 'vacant'
                                            ? 'bg-gray-100 text-gray-700'
                                            : (editingRoom || selectedRoom)
                                                    ?.status === 'occupied'
                                              ? 'bg-green-100 text-green-700'
                                              : 'bg-orange-100 text-orange-700'
                                    }`}
                                >
                                    {(editingRoom || selectedRoom)?.status ===
                                    'vacant'
                                        ? 'ว่าง'
                                        : (editingRoom || selectedRoom)
                                                ?.status === 'occupied'
                                          ? 'มีผู้เช่า'
                                          : 'ซ่อมแซม'}
                                </span>
                            </div>
                        </div>

                        {/* Content */}
                        <div
                            className="overflow-y-auto p-6 space-y-4"
                            style={{ maxHeight: 'calc(85vh - 120px)' }}
                        >
                            {editingRoom ? (
                                // Edit Form
                                <form
                                    onSubmit={handleSubmit}
                                    className="space-y-4"
                                >
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                ค่าเช่า
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.baseRentPrice}
                                                onChange={(e) =>
                                                    setFormData({
                                                        ...formData,
                                                        baseRentPrice: Number(
                                                            e.target.value,
                                                        ),
                                                    })
                                                }
                                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                เงินประกัน
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.depositAmount}
                                                onChange={(e) =>
                                                    setFormData({
                                                        ...formData,
                                                        depositAmount: Number(
                                                            e.target.value,
                                                        ),
                                                    })
                                                }
                                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                ค่าน้ำ/หน่วย
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.waterRate}
                                                onChange={(e) =>
                                                    setFormData({
                                                        ...formData,
                                                        waterRate: Number(
                                                            e.target.value,
                                                        ),
                                                    })
                                                }
                                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                ค่าไฟ/หน่วย
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.electricityRate}
                                                onChange={(e) =>
                                                    setFormData({
                                                        ...formData,
                                                        electricityRate: Number(
                                                            e.target.value,
                                                        ),
                                                    })
                                                }
                                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                มิเตอร์น้ำ
                                            </label>
                                            <input
                                                type="text"
                                                value={
                                                    formData.waterMeterNumber
                                                }
                                                onChange={(e) =>
                                                    setFormData({
                                                        ...formData,
                                                        waterMeterNumber:
                                                            e.target.value,
                                                    })
                                                }
                                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 font-mono tracking-wider"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                มิเตอร์ไฟ
                                            </label>
                                            <input
                                                type="text"
                                                value={
                                                    formData.electricityMeterNumber
                                                }
                                                onChange={(e) =>
                                                    setFormData({
                                                        ...formData,
                                                        electricityMeterNumber:
                                                            e.target.value,
                                                    })
                                                }
                                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 font-mono tracking-wider"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            หมายเหตุ
                                        </label>
                                        <textarea
                                            value={formData.notes}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    notes: e.target.value,
                                                })
                                            }
                                            rows={2}
                                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 resize-none"
                                        />
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditingRoom(null)
                                                setShowRoomModal(false)
                                            }}
                                            className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl"
                                        >
                                            ยกเลิก
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={updateMutation.isPending}
                                            className="flex-1 py-3 bg-green-600 text-white font-medium rounded-xl disabled:bg-gray-400"
                                        >
                                            {updateMutation.isPending
                                                ? 'กำลังบันทึก...'
                                                : 'บันทึก'}
                                        </button>
                                    </div>

                                    {/* Delete Button - Only shown in edit mode */}
                                    {editingRoom &&
                                        editingRoom.status !== 'occupied' && (
                                            <div className="pt-4 mt-4 border-t border-gray-200">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (
                                                            confirm(
                                                                `คุณแน่ใจว่าต้องการลบห้อง ${editingRoom.roomNumber}?`,
                                                            )
                                                        ) {
                                                            deleteMutation.mutate(
                                                                editingRoom._id,
                                                            )
                                                        }
                                                    }}
                                                    disabled={
                                                        deleteMutation.isPending
                                                    }
                                                    className="w-full py-3 bg-red-50 text-red-500 text-sm font-medium rounded-xl hover:bg-red-100 transition-colors border border-red-200"
                                                >
                                                    {deleteMutation.isPending
                                                        ? 'กำลังลบ...'
                                                        : 'ลบห้องนี้'}
                                                </button>
                                            </div>
                                        )}
                                </form>
                            ) : (
                                selectedRoom && (
                                    // View Details
                                    <>
                                        {/* Price Info */}
                                        <div className="bg-gray-50 rounded-xl p-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-sm text-gray-500">
                                                        ค่าเช่า
                                                    </p>
                                                    <p className="text-xl font-bold text-gray-900">
                                                        {formatCurrency(
                                                            selectedRoom.baseRentPrice,
                                                        )}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-gray-500">
                                                        เงินประกัน
                                                    </p>
                                                    <p className="text-xl font-bold text-gray-900">
                                                        {formatCurrency(
                                                            selectedRoom.depositAmount ||
                                                                0,
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Rates */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-blue-50 rounded-xl p-4">
                                                <p className="text-sm text-blue-600 font-medium">
                                                    ค่าน้ำ
                                                </p>
                                                <p className="text-lg font-bold text-blue-900">
                                                    {selectedRoom.waterRate ||
                                                        18}{' '}
                                                    บาท/หน่วย
                                                </p>
                                            </div>
                                            <div className="bg-yellow-50 rounded-xl p-4">
                                                <p className="text-sm text-yellow-600 font-medium">
                                                    ค่าไฟ
                                                </p>
                                                <p className="text-lg font-bold text-yellow-900">
                                                    {selectedRoom.electricityRate ||
                                                        8}{' '}
                                                    บาท/หน่วย
                                                </p>
                                            </div>
                                        </div>

                                        {/* Meter Section */}
                                        <div className="space-y-3">
                                            {/* Meter Numbers */}
                                            <div className="bg-gray-50 rounded-xl p-4">
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="text-sm text-gray-500">
                                                        หมายเลขมิเตอร์
                                                    </p>
                                                    <button
                                                        onClick={() =>
                                                            setShowMeterHistory(
                                                                !showMeterHistory,
                                                            )
                                                        }
                                                        className="text-xs text-blue-600 hover:text-blue-800"
                                                    >
                                                        {showMeterHistory
                                                            ? 'ซ่อนประวัติ'
                                                            : 'ดูประวัติ'}
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <p className="text-xs text-gray-400">
                                                            น้ำ
                                                        </p>
                                                        
                                                        {(() => {
                                                            const latest = getLatestReading(selectedRoom.waterMeterReadings)
                                                            return latest && (
                                                                <div className="text-xs text-blue-600 mt-1">
                                                                    <span>ล่าสุด: {latest.value}</span>
                                                                    <span className="text-gray-400 ml-1">
                                                                        ({new Date(latest.recordedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })})
                                                                    </span>
                                                                </div>
                                                            )
                                                        })()}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-400">
                                                            ไฟ
                                                        </p>
                                                        
                                                        {(() => {
                                                            const latest = getLatestReading(selectedRoom.electricityMeterReadings)
                                                            return latest && (
                                                                <div className="text-xs text-yellow-600 mt-1">
                                                                    <span>ล่าสุด: {latest.value}</span>
                                                                    <span className="text-gray-400 ml-1">
                                                                        ({new Date(latest.recordedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })})
                                                                    </span>
                                                                </div>
                                                            )
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Meter Reading History Charts */}
                                            {showMeterHistory && (
                                                <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                                                    <p className="text-sm font-medium text-gray-700">
                                                        ประวัติการจดมิเตอร์ (12
                                                        รายการล่าสุด)
                                                    </p>

                                                    {/* Water Meter Chart */}
                                                    <div className="bg-white rounded-lg p-3 border border-blue-200">
                                                        <p className="text-xs font-medium text-blue-700 mb-2 flex items-center gap-1">
                                                            <svg
                                                                className="w-4 h-4"
                                                                fill="none"
                                                                stroke="currentColor"
                                                                viewBox="0 0 24 24"
                                                            >
                                                                <path
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                    strokeWidth={
                                                                        2
                                                                    }
                                                                    d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                                                                />
                                                            </svg>
                                                            มิเตอร์น้ำ
                                                        </p>
                                                        {selectedRoom.waterMeterReadings &&
                                                        selectedRoom
                                                            .waterMeterReadings
                                                            .length > 0 ? (
                                                            <div className="h-48">
                                                                <ResponsiveContainer
                                                                    width="100%"
                                                                    height="100%"
                                                                >
                                                                    <BarChart
                                                                        data={(() => {
                                                                            const readings =
                                                                                [
                                                                                    ...selectedRoom.waterMeterReadings,
                                                                                ]
                                                                                    .sort(
                                                                                        (
                                                                                            a,
                                                                                            b,
                                                                                        ) =>
                                                                                            new Date(
                                                                                                a.recordedAt,
                                                                                            ).getTime() -
                                                                                            new Date(
                                                                                                b.recordedAt,
                                                                                            ).getTime(),
                                                                                    )
                                                                                    .slice(
                                                                                        -13,
                                                                                    )
                                                                            return readings
                                                                                .slice(
                                                                                    1,
                                                                                )
                                                                                .map(
                                                                                    (
                                                                                        reading,
                                                                                        idx,
                                                                                    ) => {
                                                                                        const prevValue =
                                                                                            readings[
                                                                                                idx
                                                                                            ]
                                                                                                .value
                                                                                        const usage =
                                                                                            reading.value -
                                                                                            prevValue
                                                                                        return {
                                                                                            date: new Date(
                                                                                                reading.recordedAt,
                                                                                            ).toLocaleDateString(
                                                                                                'th-TH',
                                                                                                {
                                                                                                    day: 'numeric',
                                                                                                    month: 'short',
                                                                                                },
                                                                                            ),
                                                                                            value: reading.value,
                                                                                            usage:
                                                                                                usage >
                                                                                                0
                                                                                                    ? usage
                                                                                                    : 0,
                                                                                        }
                                                                                    },
                                                                                )
                                                                        })()}
                                                                        margin={{
                                                                            top: 20,
                                                                            right: 10,
                                                                            left: -15,
                                                                            bottom: 5,
                                                                        }}
                                                                    >
                                                                        <defs>
                                                                            <linearGradient
                                                                                id="waterGradient"
                                                                                x1="0"
                                                                                y1="0"
                                                                                x2="0"
                                                                                y2="1"
                                                                            >
                                                                                <stop
                                                                                    offset="0%"
                                                                                    stopColor="#3b82f6"
                                                                                    stopOpacity={
                                                                                        1
                                                                                    }
                                                                                />
                                                                                <stop
                                                                                    offset="100%"
                                                                                    stopColor="#93c5fd"
                                                                                    stopOpacity={
                                                                                        0.8
                                                                                    }
                                                                                />
                                                                            </linearGradient>
                                                                        </defs>
                                                                        <CartesianGrid
                                                                            strokeDasharray="3 3"
                                                                            stroke="#e0e0e0"
                                                                        />
                                                                        <XAxis
                                                                            dataKey="date"
                                                                            tick={{
                                                                                fontSize: 9,
                                                                            }}
                                                                            interval={
                                                                                0
                                                                            }
                                                                            angle={
                                                                                -45
                                                                            }
                                                                            textAnchor="end"
                                                                            height={
                                                                                50
                                                                            }
                                                                        />
                                                                        <YAxis
                                                                            tick={{
                                                                                fontSize: 10,
                                                                            }}
                                                                        />
                                                                        <Tooltip
                                                                            contentStyle={{
                                                                                fontSize: 12,
                                                                                borderRadius: 8,
                                                                            }}
                                                                            content={({ active, payload, label }) => {
                                                                                if (active && payload && payload.length) {
                                                                                    const data = payload[0].payload;
                                                                                    return (
                                                                                        <div className="bg-white border border-gray-200 rounded-lg p-2 shadow-lg">
                                                                                            <p className="text-xs text-gray-500 mb-1">วันที่: {label}</p>
                                                                                            <p className="text-sm font-bold text-blue-600">ใช้: {data.usage} หน่วย</p>
                                                                                            <p className="text-xs text-gray-600">ค่ามิเตอร์: {data.value}</p>
                                                                                        </div>
                                                                                    );
                                                                                }
                                                                                return null;
                                                                            }}
                                                                        />
                                                                        <Bar
                                                                            dataKey="usage"
                                                                            fill="url(#waterGradient)"
                                                                            radius={[
                                                                                4,
                                                                                4,
                                                                                0,
                                                                                0,
                                                                            ]}
                                                                            name="หน่วยที่ใช้"
                                                                        >
                                                                            <LabelList
                                                                                dataKey="usage"
                                                                                position="top"
                                                                                style={{
                                                                                    fontSize: 9,
                                                                                    fill: '#3b82f6',
                                                                                    fontWeight:
                                                                                        'bold',
                                                                                }}
                                                                            />
                                                                        </Bar>
                                                                    </BarChart>
                                                                </ResponsiveContainer>
                                                            </div>
                                                        ) : (
                                                            <p className="text-xs text-gray-500 text-center py-8">
                                                                ยังไม่มีประวัติ
                                                            </p>
                                                        )}
                                                    </div>

                                                    {/* Electricity Meter Chart */}
                                                    <div className="bg-white rounded-lg p-3 border border-amber-200">
                                                        <p className="text-xs font-medium text-amber-700 mb-2 flex items-center gap-1">
                                                            <svg
                                                                className="w-4 h-4"
                                                                fill="none"
                                                                stroke="currentColor"
                                                                viewBox="0 0 24 24"
                                                            >
                                                                <path
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                    strokeWidth={
                                                                        2
                                                                    }
                                                                    d="M13 10V3L4 14h7v7l9-11h-7z"
                                                                />
                                                            </svg>
                                                            มิเตอร์ไฟ
                                                        </p>
                                                        {selectedRoom.electricityMeterReadings &&
                                                        selectedRoom
                                                            .electricityMeterReadings
                                                            .length > 0 ? (
                                                            <div className="h-48">
                                                                <ResponsiveContainer
                                                                    width="100%"
                                                                    height="100%"
                                                                >
                                                                    <BarChart
                                                                        data={(() => {
                                                                            const readings =
                                                                                [
                                                                                    ...selectedRoom.electricityMeterReadings,
                                                                                ]
                                                                                    .sort(
                                                                                        (
                                                                                            a,
                                                                                            b,
                                                                                        ) =>
                                                                                            new Date(
                                                                                                a.recordedAt,
                                                                                            ).getTime() -
                                                                                            new Date(
                                                                                                b.recordedAt,
                                                                                            ).getTime(),
                                                                                    )
                                                                                    .slice(
                                                                                        -13,
                                                                                    )
                                                                            return readings
                                                                                .slice(
                                                                                    1,
                                                                                )
                                                                                .map(
                                                                                    (
                                                                                        reading,
                                                                                        idx,
                                                                                    ) => {
                                                                                        const prevValue =
                                                                                            readings[
                                                                                                idx
                                                                                            ]
                                                                                                .value
                                                                                        const usage =
                                                                                            reading.value -
                                                                                            prevValue
                                                                                        return {
                                                                                            date: new Date(
                                                                                                reading.recordedAt,
                                                                                            ).toLocaleDateString(
                                                                                                'th-TH',
                                                                                                {
                                                                                                    day: 'numeric',
                                                                                                    month: 'short',
                                                                                                },
                                                                                            ),
                                                                                            value: reading.value,
                                                                                            usage:
                                                                                                usage >
                                                                                                0
                                                                                                    ? usage
                                                                                                    : 0,
                                                                                        }
                                                                                    },
                                                                                )
                                                                        })()}
                                                                        margin={{
                                                                            top: 20,
                                                                            right: 10,
                                                                            left: -15,
                                                                            bottom: 5,
                                                                        }}
                                                                    >
                                                                        <defs>
                                                                            <linearGradient
                                                                                id="electricityGradient"
                                                                                x1="0"
                                                                                y1="0"
                                                                                x2="0"
                                                                                y2="1"
                                                                            >
                                                                                <stop
                                                                                    offset="0%"
                                                                                    stopColor="#f59e0b"
                                                                                    stopOpacity={
                                                                                        1
                                                                                    }
                                                                                />
                                                                                <stop
                                                                                    offset="100%"
                                                                                    stopColor="#fcd34d"
                                                                                    stopOpacity={
                                                                                        0.8
                                                                                    }
                                                                                />
                                                                            </linearGradient>
                                                                        </defs>
                                                                        <CartesianGrid
                                                                            strokeDasharray="3 3"
                                                                            stroke="#e0e0e0"
                                                                        />
                                                                        <XAxis
                                                                            dataKey="date"
                                                                            tick={{
                                                                                fontSize: 9,
                                                                            }}
                                                                            interval={
                                                                                0
                                                                            }
                                                                            angle={
                                                                                -45
                                                                            }
                                                                            textAnchor="end"
                                                                            height={
                                                                                50
                                                                            }
                                                                        />
                                                                        <YAxis
                                                                            tick={{
                                                                                fontSize: 10,
                                                                            }}
                                                                        />
                                                                        <Tooltip
                                                                            contentStyle={{
                                                                                fontSize: 12,
                                                                                borderRadius: 8,
                                                                            }}
                                                                            content={({ active, payload, label }) => {
                                                                                if (active && payload && payload.length) {
                                                                                    const data = payload[0].payload;
                                                                                    return (
                                                                                        <div className="bg-white border border-gray-200 rounded-lg p-2 shadow-lg">
                                                                                            <p className="text-xs text-gray-500 mb-1">วันที่: {label}</p>
                                                                                            <p className="text-sm font-bold text-amber-600">ใช้: {data.usage} หน่วย</p>
                                                                                            <p className="text-xs text-gray-600">ค่ามิเตอร์: {data.value}</p>
                                                                                        </div>
                                                                                    );
                                                                                }
                                                                                return null;
                                                                            }}
                                                                        />
                                                                        <Bar
                                                                            dataKey="usage"
                                                                            fill="url(#electricityGradient)"
                                                                            radius={[
                                                                                4,
                                                                                4,
                                                                                0,
                                                                                0,
                                                                            ]}
                                                                            name="หน่วยที่ใช้"
                                                                        >
                                                                            <LabelList
                                                                                dataKey="usage"
                                                                                position="top"
                                                                                style={{
                                                                                    fontSize: 9,
                                                                                    fill: '#f59e0b',
                                                                                    fontWeight:
                                                                                        'bold',
                                                                                }}
                                                                            />
                                                                        </Bar>
                                                                    </BarChart>
                                                                </ResponsiveContainer>
                                                            </div>
                                                        ) : (
                                                            <p className="text-xs text-gray-500 text-center py-8">
                                                                ยังไม่มีประวัติ
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Record Meter Reading Buttons */}
                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    onClick={() => {
                                                        setMeterType('water')
                                                        setMeterValue('')
                                                        setMeterNotes('')
                                                        setShowMeterModal(true)
                                                    }}
                                                    className="py-2 px-3 bg-blue-100 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-200 transition-colors flex items-center justify-center gap-1"
                                                >
                                                    <svg
                                                        className="w-4 h-4"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={2}
                                                            d="M12 4v16m8-8H4"
                                                        />
                                                    </svg>
                                                    จดมิเตอร์น้ำ
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setMeterType(
                                                            'electricity',
                                                        )
                                                        setMeterValue('')
                                                        setMeterNotes('')
                                                        setShowMeterModal(true)
                                                    }}
                                                    className="py-2 px-3 bg-yellow-100 text-yellow-700 text-sm font-medium rounded-lg hover:bg-yellow-200 transition-colors flex items-center justify-center gap-1"
                                                >
                                                    <svg
                                                        className="w-4 h-4"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={2}
                                                            d="M12 4v16m8-8H4"
                                                        />
                                                    </svg>
                                                    จดมิเตอร์ไฟ
                                                </button>
                                            </div>
                                        </div>

                                        {/* Tenant Info */}
                                        {selectedRoom.tenantId && (
                                            <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                                                <p className="text-sm text-green-600 font-medium mb-2">
                                                    ผู้เช่าปัจจุบัน
                                                </p>
                                                <div className="flex items-center gap-3">
                                                    {selectedRoom.tenantId
                                                        .pictureUrl ? (
                                                        <img
                                                            src={
                                                                selectedRoom
                                                                    .tenantId
                                                                    .pictureUrl
                                                            }
                                                            alt={
                                                                selectedRoom
                                                                    .tenantId
                                                                    .displayName
                                                            }
                                                            className="w-12 h-12 rounded-full object-cover border-2 border-green-300"
                                                        />
                                                    ) : (
                                                        <div className="w-12 h-12 rounded-full bg-green-200 flex items-center justify-center">
                                                            <svg
                                                                className="w-6 h-6 text-green-600"
                                                                fill="none"
                                                                stroke="currentColor"
                                                                viewBox="0 0 24 24"
                                                            >
                                                                <path
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                    strokeWidth={
                                                                        2
                                                                    }
                                                                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                                                />
                                                            </svg>
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="font-bold text-green-900">
                                                            {
                                                                selectedRoom
                                                                    .tenantId
                                                                    .displayName
                                                            }
                                                        </p>
                                                        {selectedRoom.tenantId
                                                            .phoneNumber && (
                                                            <p className="text-sm text-green-700">
                                                                {
                                                                    selectedRoom
                                                                        .tenantId
                                                                        .phoneNumber
                                                                }
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Notes */}
                                        {selectedRoom.notes && (
                                            <div className="bg-gray-50 rounded-xl p-4">
                                                <p className="text-sm text-gray-500 mb-1">
                                                    หมายเหตุ
                                                </p>
                                                <p className="text-gray-900">
                                                    {selectedRoom.notes}
                                                </p>
                                            </div>
                                        )}

                                        {/* Action Buttons */}
                                        <div className="space-y-3 pt-2">
                                            <button
                                                onClick={() =>
                                                    handleEditRoom(selectedRoom)
                                                }
                                                className="w-full py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors"
                                            >
                                                แก้ไขข้อมูล
                                            </button>

                                            {selectedRoom.status ===
                                                'vacant' && (
                                                <button
                                                    onClick={() =>
                                                        qrMutation.mutate(
                                                            selectedRoom._id,
                                                        )
                                                    }
                                                    disabled={
                                                        qrMutation.isPending
                                                    }
                                                    className="w-full py-3 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 transition-colors disabled:bg-gray-400"
                                                >
                                                    {qrMutation.isPending
                                                        ? 'กำลังสร้าง...'
                                                        : 'สร้าง QR Code สำหรับผู้เช่า'}
                                                </button>
                                            )}
                                        </div>
                                    </>
                                )
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* QR Code Modal */}
            {showQRModal && qrCodeData && selectedRoom && (
                <>
                    <div
                        className="fixed inset-0 bg-black bg-opacity-50 z-50"
                        onClick={() => setShowQRModal(false)}
                    />
                    <div
                        className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl"
                        style={{
                            maxHeight: '85vh',
                            animation: 'slideUp 0.3s ease-out',
                        }}
                    >
                        <div className="px-6 py-4 border-b border-gray-100">
                            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-4"></div>
                            <h2 className="text-xl font-bold text-gray-900 text-center">
                                QR Code ห้อง {selectedRoom.roomNumber}
                            </h2>
                        </div>

                        <div
                            className="p-6 space-y-4 overflow-y-auto"
                            style={{ maxHeight: 'calc(85vh - 100px)' }}
                        >
                            <div className="flex justify-center">
                                <div className="bg-white p-4 rounded-2xl shadow-lg border border-gray-200">
                                    <img
                                        src={qrCodeData.dataUrl}
                                        alt="QR Code"
                                        className="w-64 h-64"
                                    />
                                </div>
                            </div>

                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                <p className="text-sm text-blue-800 font-medium mb-2">
                                    วิธีใช้งาน:
                                </p>
                                <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                                    <li>ให้ผู้เช่าสแกน QR Code นี้</li>
                                    <li>ผู้เช่าต้องเข้าสู่ระบบด้วย LINE</li>
                                    <li>ระบบจะกำหนดห้องให้อัตโนมัติ</li>
                                </ol>
                            </div>

                            <p className="text-xs text-amber-600 text-center font-medium bg-amber-50 py-2 px-3 rounded-lg border border-amber-200">
                                QR Code มีอายุ 24 ชั่วโมง
                            </p>

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={handleDownloadQR}
                                    className="py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
                                >
                                    ดาวน์โหลด
                                </button>
                                <button
                                    onClick={handlePrintQR}
                                    className="py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors"
                                >
                                    พิมพ์
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Meter Recording Modal */}
            {showMeterModal && selectedRoom && (
                <>
                    <div
                        className="fixed inset-0 bg-black bg-opacity-50 z-[60]"
                        onClick={() => setShowMeterModal(false)}
                    />
                    <div
                        className="fixed inset-x-0 bottom-0 z-[60] bg-white rounded-t-3xl shadow-2xl"
                        style={{
                            maxHeight: '60vh',
                            animation: 'slideUp 0.3s ease-out',
                        }}
                    >
                        <div
                            className={`px-6 py-4 border-b border-gray-100 ${meterType === 'water' ? 'bg-blue-50' : 'bg-yellow-50'}`}
                        >
                            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-4"></div>
                            <h2
                                className={`text-xl font-bold text-center ${meterType === 'water' ? 'text-blue-900' : 'text-yellow-900'}`}
                            >
                                จดมิเตอร์{meterType === 'water' ? 'น้ำ' : 'ไฟ'}{' '}
                                - ห้อง {selectedRoom.roomNumber}
                            </h2>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Previous Reading */}
                            <div
                                className={`rounded-xl p-4 ${meterType === 'water' ? 'bg-blue-50' : 'bg-yellow-50'}`}
                            >
                                <p className="text-sm text-gray-600 mb-1">
                                    ค่าล่าสุด
                                </p>
                                <p className="text-2xl font-bold font-mono">
                                    {meterType === 'water'
                                        ? getLatestReading(selectedRoom.waterMeterReadings)?.value ?? '-'
                                        : getLatestReading(selectedRoom.electricityMeterReadings)?.value ?? '-'}
                                </p>
                            </div>

                            {/* New Reading Input */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    ค่ามิเตอร์ใหม่
                                </label>
                                <input
                                    type="number"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={meterValue}
                                    onChange={(e) =>
                                        setMeterValue(e.target.value)
                                    }
                                    className={`w-full px-4 py-4 text-2xl font-mono border-2 rounded-xl focus:ring-2 ${
                                        meterType === 'water'
                                            ? 'border-blue-300 focus:ring-blue-500 focus:border-blue-500'
                                            : 'border-yellow-300 focus:ring-yellow-500 focus:border-yellow-500'
                                    }`}
                                    placeholder="0"
                                    autoFocus
                                />
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    หมายเหตุ (ถ้ามี)
                                </label>
                                <input
                                    type="text"
                                    value={meterNotes}
                                    onChange={(e) =>
                                        setMeterNotes(e.target.value)
                                    }
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-500"
                                    placeholder="เช่น มิเตอร์ชำรุด, อ่านค่าประมาณ"
                                />
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setShowMeterModal(false)}
                                    className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    onClick={() => {
                                        if (
                                            !meterValue ||
                                            isNaN(Number(meterValue))
                                        ) {
                                            alert('กรุณากรอกค่ามิเตอร์')
                                            return
                                        }
                                        meterMutation.mutate({
                                            roomId: selectedRoom._id,
                                            meterType,
                                            value: Number(meterValue),
                                            notes: meterNotes || undefined,
                                        })
                                    }}
                                    disabled={meterMutation.isPending}
                                    className={`flex-1 py-3 text-white font-medium rounded-xl disabled:bg-gray-400 ${
                                        meterType === 'water'
                                            ? 'bg-blue-600 hover:bg-blue-700'
                                            : 'bg-yellow-600 hover:bg-yellow-700'
                                    }`}
                                >
                                    {meterMutation.isPending
                                        ? 'กำลังบันทึก...'
                                        : 'บันทึก'}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
