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
import { Droplets, PlugZap } from 'lucide-react'
interface MeterReadingHistory {
    value: number
    recordedAt: string
    recordedBy?: string
    notes?: string
}

interface OccupancyPeriod {
    _id: string
    startDate: string
    endDate?: string
    tenantName?: string
    notes?: string
    createdAt: string
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
        fullName?: string
        notes?: string
        phone?: string
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
    occupancyPeriods?: OccupancyPeriod[]
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
    tenantFullName?: string
    tenantNotes?: string
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

async function evictTenant(lineUserId: string, roomId: string) {
    const res = await fetch(`/api/admin/rooms/${roomId}/evict`, {
        method: 'POST',
        headers: { 'x-line-userid': lineUserId },
    })
    if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to evict tenant')
    }
    return res.json()
}

async function toggleRoomStatus(
    lineUserId: string,
    roomId: string,
    newStatus: 'vacant' | 'occupied',
) {
    const res = await fetch(`/api/admin/rooms/${roomId}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'x-line-userid': lineUserId,
        },
        body: JSON.stringify({ status: newStatus }),
    })
    if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to toggle room status')
    }
    return res.json()
}

async function addOccupancyPeriod(
    lineUserId: string,
    roomId: string,
    period: {
        startDate: string
        endDate?: string
        tenantName?: string
        notes?: string
    },
) {
    const res = await fetch(`/api/admin/rooms/${roomId}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'x-line-userid': lineUserId,
        },
        body: JSON.stringify({ addPeriod: period }),
    })
    if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to add period')
    }
    return res.json()
}

async function removeOccupancyPeriod(
    lineUserId: string,
    roomId: string,
    periodId: string,
) {
    const res = await fetch(`/api/admin/rooms/${roomId}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'x-line-userid': lineUserId,
        },
        body: JSON.stringify({ removePeriod: { periodId } }),
    })
    if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to remove period')
    }
    return res.json()
}

// Helper function to get the latest reading by date
function getLatestReading(readings: MeterReadingHistory[] | undefined) {
    if (!readings || readings.length === 0) return null
    return [...readings].sort(
        (a, b) =>
            new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
    )[0]
}

export default function RoomsManagement({
    lineUserId,
}: {
    lineUserId: string
}) {
    const queryClient = useQueryClient()
    const [activeTab, setActiveTab] = useState<
        'list' | 'add' | 'batch' | 'calendar'
    >('list')
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
    const [showRoomMenu, setShowRoomMenu] = useState(false)

    // Occupancy period state
    const [showAddPeriod, setShowAddPeriod] = useState(false)
    const [periodStartDate, setPeriodStartDate] = useState<Date | null>(null)
    const [periodEndDate, setPeriodEndDate] = useState<Date | null>(null)
    const [periodTenantName, setPeriodTenantName] = useState('')
    const [periodNotes, setPeriodNotes] = useState('')
    const [periodCalendarMonth, setPeriodCalendarMonth] = useState(
        new Date().getMonth(),
    )
    const [periodCalendarYear, setPeriodCalendarYear] = useState(
        new Date().getFullYear(),
    )

    // Calendar availability state
    const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth())
    const [calendarYear, setCalendarYear] = useState(new Date().getFullYear())
    const [selectedStartDate, setSelectedStartDate] = useState<Date | null>(
        null,
    )
    const [selectedEndDate, setSelectedEndDate] = useState<Date | null>(null)

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
        tenantFullName: '',
        tenantNotes: '',
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

    const evictMutation = useMutation({
        mutationFn: (roomId: string) => evictTenant(lineUserId, roomId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-rooms'] })
            setShowRoomModal(false)
            setEditingRoom(null)
            alert('ย้ายผู้เช่าออกเรียบร้อยแล้ว')
        },
        onError: (error: Error) => alert('เกิดข้อผิดพลาด: ' + error.message),
    })

    const toggleStatusMutation = useMutation({
        mutationFn: ({
            roomId,
            newStatus,
        }: {
            roomId: string
            newStatus: 'vacant' | 'occupied'
        }) => toggleRoomStatus(lineUserId, roomId, newStatus),
        onMutate: async ({ roomId, newStatus }) => {
            await queryClient.cancelQueries({ queryKey: ['admin-rooms'] })
            const previousData = queryClient.getQueryData([
                'admin-rooms',
                lineUserId,
            ])

            // Optimistically update cache
            queryClient.setQueryData(
                ['admin-rooms', lineUserId],
                (old: { rooms: Room[] } | undefined) => {
                    if (!old) return old
                    return {
                        ...old,
                        rooms: old.rooms.map((room) =>
                            room._id === roomId
                                ? { ...room, status: newStatus }
                                : room,
                        ),
                    }
                },
            )

            // Optimistically update selectedRoom
            if (selectedRoom && selectedRoom._id === roomId) {
                setSelectedRoom({ ...selectedRoom, status: newStatus })
            }

            return { previousData }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-rooms'] })
        },
        onError: (error: Error, variables, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(
                    ['admin-rooms', lineUserId],
                    context.previousData,
                )
            }
            // Revert selectedRoom on error
            if (selectedRoom && selectedRoom._id === variables.roomId) {
                setSelectedRoom({
                    ...selectedRoom,
                    status:
                        variables.newStatus === 'occupied'
                            ? 'vacant'
                            : 'occupied',
                })
            }
            alert('เกิดข้อผิดพลาด: ' + error.message)
        },
    })

    const addPeriodMutation = useMutation({
        mutationFn: ({
            roomId,
            period,
        }: {
            roomId: string
            period: {
                startDate: string
                endDate?: string
                tenantName?: string
                notes?: string
            }
        }) => addOccupancyPeriod(lineUserId, roomId, period),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['admin-rooms'] })
            // Update selectedRoom with new data
            if (selectedRoom && data.room) {
                setSelectedRoom(data.room)
            }
            setShowAddPeriod(false)
            setPeriodStartDate(null)
            setPeriodEndDate(null)
            setPeriodTenantName('')
            setPeriodNotes('')
        },
        onError: (error: Error) => alert('เกิดข้อผิดพลาด: ' + error.message),
    })

    const removePeriodMutation = useMutation({
        mutationFn: ({
            roomId,
            periodId,
        }: {
            roomId: string
            periodId: string
        }) => removeOccupancyPeriod(lineUserId, roomId, periodId),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['admin-rooms'] })
            // Update selectedRoom with new data
            if (selectedRoom && data.room) {
                setSelectedRoom(data.room)
            }
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
            tenantFullName: '',
            tenantNotes: '',
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
            tenantFullName: room.tenantId?.fullName || '',
            tenantNotes: room.tenantId?.notes || '',
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
            setShowRoomMenu(false)
        }
        setDragCurrentY(0)
        setIsDragging(false)
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-zinc-300">
                <div className="text-center bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-lg">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-zinc-200 border-t-green-600 mx-auto"></div>
                    <p className="mt-4 text-zinc-600 font-medium">กำลังโหลด...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-zinc-300">
                <div className="text-center p-8 bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg max-w-sm mx-4">
                    <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
                        <svg
                            className="w-8 h-8 text-red-500"
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
                    <p className="text-red-600 font-medium">
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
        <div className="min-h-screen bg-zinc-300">
            {/* Header */}
            <div className="bg-white/95 backdrop-blur-md sticky top-0 z-30 border-b border-zinc-200/50 shadow-sm">
                <div className="px-4 py-4">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h1 className="text-xl font-bold text-zinc-800">
                                จัดการห้องพัก
                            </h1>
                            <p className="text-xs text-zinc-500 mt-0.5">
                                ทั้งหมด {stats.total} ห้อง
                            </p>
                        </div>
                        <a
                            href="/admin/dashboard"
                            className="p-2.5 text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 rounded-xl transition-all"
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
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        </a>
                    </div>

                    {/* Tab Switcher */}
                    <div className="flex gap-1.5 p-1 bg-zinc-100 rounded-xl">
                        <button
                            onClick={() => setActiveTab('list')}
                            className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-all ${
                                activeTab === 'list'
                                    ? 'bg-white text-green-700 shadow-sm'
                                    : 'text-zinc-500 hover:text-zinc-700'
                            }`}
                        >
                            รายชื่อห้อง
                        </button>
                        <button
                            onClick={() => setActiveTab('calendar')}
                            className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-all ${
                                activeTab === 'calendar'
                                    ? 'bg-white text-green-700 shadow-sm'
                                    : 'text-zinc-500 hover:text-zinc-700'
                            }`}
                        >
                            ปฏิทินห้องว่าง
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-4 pb-24">
                {/* List View */}
                {activeTab === 'list' && (
                    <div className="space-y-3">
                        {/* Stats Cards */}
                        <div className="grid grid-cols-4 gap-1.5">
                            <button
                                onClick={() => setFilterStatus('all')}
                                className={`p-2.5 rounded-xl text-center transition-all ${
                                    filterStatus === 'all'
                                        ? 'bg-white shadow-md ring-2 ring-green-500/30'
                                        : 'bg-white/70 hover:bg-white'
                                }`}
                            >
                                <p className="text-lg font-bold text-zinc-800">
                                    {stats.total}
                                </p>
                                <p className="text-[10px] text-zinc-500 font-medium">ทั้งหมด</p>
                            </button>
                            <button
                                onClick={() => setFilterStatus('vacant')}
                                className={`p-2.5 rounded-xl text-center transition-all ${
                                    filterStatus === 'vacant'
                                        ? 'bg-white shadow-md ring-2 ring-zinc-400/50'
                                        : 'bg-white/70 hover:bg-white'
                                }`}
                            >
                                <p className="text-lg font-bold text-zinc-500">
                                    {stats.vacant}
                                </p>
                                <p className="text-[10px] text-zinc-500 font-medium">ว่าง</p>
                            </button>
                            <button
                                onClick={() => setFilterStatus('occupied')}
                                className={`p-2.5 rounded-xl text-center transition-all ${
                                    filterStatus === 'occupied'
                                        ? 'bg-white shadow-md ring-2 ring-green-500/50'
                                        : 'bg-white/70 hover:bg-white'
                                }`}
                            >
                                <p className="text-lg font-bold text-green-600">
                                    {stats.occupied}
                                </p>
                                <p className="text-[10px] text-zinc-500 font-medium">
                                    มีผู้เช่า
                                </p>
                            </button>
                            <button
                                onClick={() => setFilterStatus('maintenance')}
                                className={`p-2.5 rounded-xl text-center transition-all ${
                                    filterStatus === 'maintenance'
                                        ? 'bg-white shadow-md ring-2 ring-amber-400/50'
                                        : 'bg-white/70 hover:bg-white'
                                }`}
                            >
                                <p className="text-lg font-bold text-amber-600">
                                    {stats.maintenance}
                                </p>
                                <p className="text-[10px] text-zinc-500 font-medium">ซ่อม</p>
                            </button>
                        </div>

                        {/* Search */}
                        <div className="relative">
                            <svg
                                className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400"
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
                                className="w-full pl-10 pr-4 py-2.5 bg-white/90 border border-zinc-200/50 rounded-xl text-sm focus:ring-2 focus:ring-green-500/30 focus:border-green-400 focus:bg-white transition-all"
                            />
                        </div>

                        {/* Room List */}
                        {filteredRooms.length === 0 ? (
                            <div className="bg-white/90 rounded-2xl p-8 text-center shadow-sm">
                                <div className="w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <svg
                                        className="w-7 h-7 text-zinc-400"
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
                                <p className="text-zinc-500 font-medium">ไม่พบห้องพัก</p>
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                {filteredRooms.map((room) => (
                                    <button
                                        key={room._id}
                                        onClick={() => handleViewRoom(room)}
                                        className={`w-full rounded-xl p-3.5 text-left transition-all hover:shadow-md active:scale-[0.995] ${
                                            room.status === 'vacant'
                                                ? 'bg-white/80 hover:bg-white'
                                                : room.status === 'occupied'
                                                  ? 'bg-gradient-to-r from-green-50 to-white border-l-4 border-l-green-500'
                                                  : 'bg-gradient-to-r from-amber-50 to-white border-l-4 border-l-amber-500'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                                    room.status === 'vacant'
                                                        ? 'bg-zinc-100'
                                                        : room.status === 'occupied'
                                                          ? 'bg-green-100'
                                                          : 'bg-amber-100'
                                                }`}>
                                                    <span className={`text-sm font-bold ${
                                                        room.status === 'vacant'
                                                            ? 'text-zinc-500'
                                                            : room.status === 'occupied'
                                                              ? 'text-green-600'
                                                              : 'text-amber-600'
                                                    }`}>
                                                        {room.roomNumber}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-base font-semibold text-zinc-800">
                                                        ห้อง {room.roomNumber}
                                                    </span>
                                                    {room.tenantId && (
                                                        <p className="text-xs text-green-600 truncate max-w-[140px]">
                                                            {room.tenantId.displayName}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-base font-bold text-zinc-800">
                                                    {formatCurrency(room.baseRentPrice)}
                                                </p>
                                                <p className="text-[10px] text-zinc-400">/เดือน</p>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Calendar View */}
                {activeTab === 'calendar' && (
                    <div className="space-y-3">
                        {/* Calendar Header */}
                        <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-4 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <button
                                    onClick={() => {
                                        if (calendarMonth === 0) {
                                            setCalendarMonth(11)
                                            setCalendarYear(calendarYear - 1)
                                        } else {
                                            setCalendarMonth(calendarMonth - 1)
                                        }
                                    }}
                                    className="p-2 hover:bg-zinc-100 rounded-xl transition-colors"
                                >
                                    <svg
                                        className="w-5 h-5 text-zinc-600"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M15 19l-7-7 7-7"
                                        />
                                    </svg>
                                </button>
                                <h2 className="text-base font-semibold text-zinc-800">
                                    {new Date(
                                        calendarYear,
                                        calendarMonth,
                                    ).toLocaleDateString('th-TH', {
                                        month: 'long',
                                        year: 'numeric',
                                    })}
                                </h2>
                                <button
                                    onClick={() => {
                                        if (calendarMonth === 11) {
                                            setCalendarMonth(0)
                                            setCalendarYear(calendarYear + 1)
                                        } else {
                                            setCalendarMonth(calendarMonth + 1)
                                        }
                                    }}
                                    className="p-2 hover:bg-zinc-100 rounded-xl transition-colors"
                                >
                                    <svg
                                        className="w-5 h-5 text-zinc-600"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M9 5l7 7-7 7"
                                        />
                                    </svg>
                                </button>
                            </div>

                            {/* Day Headers */}
                            <div className="grid grid-cols-7 gap-1 mb-2">
                                {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(
                                    (day, idx) => (
                                        <div
                                            key={day}
                                            className={`text-center text-xs font-medium py-2 ${
                                                idx === 0 ? 'text-red-400' : idx === 6 ? 'text-blue-400' : 'text-zinc-500'
                                            }`}
                                        >
                                            {day}
                                        </div>
                                    ),
                                )}
                            </div>

                            {/* Calendar Grid */}
                            <div className="grid grid-cols-7 gap-1">
                                {(() => {
                                    const firstDay = new Date(
                                        calendarYear,
                                        calendarMonth,
                                        1,
                                    ).getDay()
                                    const daysInMonth = new Date(
                                        calendarYear,
                                        calendarMonth + 1,
                                        0,
                                    ).getDate()
                                    const days = []

                                    // Empty cells for days before first of month
                                    for (let i = 0; i < firstDay; i++) {
                                        days.push(
                                            <div
                                                key={`empty-${i}`}
                                                className="h-10"
                                            />,
                                        )
                                    }

                                    // Days of the month
                                    for (
                                        let day = 1;
                                        day <= daysInMonth;
                                        day++
                                    ) {
                                        const date = new Date(
                                            calendarYear,
                                            calendarMonth,
                                            day,
                                        )
                                        const isSelected =
                                            selectedStartDate &&
                                            date.getTime() ===
                                                selectedStartDate.getTime()
                                        const isEndSelected =
                                            selectedEndDate &&
                                            date.getTime() ===
                                                selectedEndDate.getTime()
                                        const isInRange =
                                            selectedStartDate &&
                                            selectedEndDate &&
                                            date > selectedStartDate &&
                                            date < selectedEndDate
                                        const isToday =
                                            new Date().toDateString() ===
                                            date.toDateString()

                                        days.push(
                                            <button
                                                key={day}
                                                onClick={() => {
                                                    if (
                                                        !selectedStartDate ||
                                                        (selectedStartDate &&
                                                            selectedEndDate)
                                                    ) {
                                                        setSelectedStartDate(
                                                            date,
                                                        )
                                                        setSelectedEndDate(null)
                                                    } else if (
                                                        date < selectedStartDate
                                                    ) {
                                                        setSelectedStartDate(
                                                            date,
                                                        )
                                                    } else {
                                                        setSelectedEndDate(date)
                                                    }
                                                }}
                                                className={`h-10 rounded-xl text-sm font-medium transition-all ${
                                                    isSelected || isEndSelected
                                                        ? 'bg-green-600 text-white shadow-sm'
                                                        : isInRange
                                                          ? 'bg-green-100 text-green-700'
                                                          : isToday
                                                            ? 'bg-zinc-800 text-white'
                                                            : 'hover:bg-zinc-100 text-zinc-700'
                                                }`}
                                            >
                                                {day}
                                            </button>,
                                        )
                                    }

                                    return days
                                })()}
                            </div>

                            {/* Quick Select Buttons */}
                            {selectedStartDate && !selectedEndDate && (
                                <div className="mt-4 p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                                    <p className="text-xs text-zinc-600 mb-2 font-medium">
                                        เลือกระยะเวลา:
                                    </p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                const endDate = new Date(
                                                    selectedStartDate,
                                                )
                                                endDate.setMonth(
                                                    endDate.getMonth() + 1,
                                                )
                                                setSelectedEndDate(endDate)
                                            }}
                                            className="flex-1 py-2 px-3 bg-white text-zinc-700 text-sm font-medium rounded-lg hover:bg-green-50 hover:text-green-700 transition-colors border border-zinc-200"
                                        >
                                            1 เดือน
                                        </button>
                                        <button
                                            onClick={() => {
                                                const endDate = new Date(
                                                    selectedStartDate,
                                                )
                                                endDate.setMonth(
                                                    endDate.getMonth() + 6,
                                                )
                                                setSelectedEndDate(endDate)
                                            }}
                                            className="flex-1 py-2 px-3 bg-white text-zinc-700 text-sm font-medium rounded-lg hover:bg-green-50 hover:text-green-700 transition-colors border border-zinc-200"
                                        >
                                            6 เดือน
                                        </button>
                                        <button
                                            onClick={() => {
                                                const endDate = new Date(
                                                    selectedStartDate,
                                                )
                                                endDate.setFullYear(
                                                    endDate.getFullYear() + 1,
                                                )
                                                setSelectedEndDate(endDate)
                                            }}
                                            className="flex-1 py-2 px-3 bg-white text-zinc-700 text-sm font-medium rounded-lg hover:bg-green-50 hover:text-green-700 transition-colors border border-zinc-200"
                                        >
                                            12 เดือน
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Selected Range Display */}
                            {selectedStartDate && selectedEndDate && (
                                <div className="mt-4 p-3 bg-green-50 rounded-xl border border-green-100">
                                    <p className="text-sm text-green-800">
                                        <span className="font-medium">
                                            ช่วงวันที่เลือก:
                                        </span>{' '}
                                        {selectedStartDate.toLocaleDateString(
                                            'th-TH',
                                            {
                                                day: 'numeric',
                                                month: 'short',
                                                year: 'numeric',
                                            },
                                        )}
                                        {' - '}
                                        {selectedEndDate.toLocaleDateString(
                                            'th-TH',
                                            {
                                                day: 'numeric',
                                                month: 'short',
                                                year: 'numeric',
                                            },
                                        )}
                                    </p>
                                    <div className="flex gap-2 mt-2">
                                        <button
                                            onClick={() => {
                                                setSelectedEndDate(null)
                                            }}
                                            className="text-xs text-zinc-600 hover:text-zinc-800 font-medium"
                                        >
                                            เปลี่ยนระยะเวลา
                                        </button>
                                        <span className="text-zinc-300">|</span>
                                        <button
                                            onClick={() => {
                                                setSelectedStartDate(null)
                                                setSelectedEndDate(null)
                                            }}
                                            className="text-xs text-red-500 hover:text-red-700 font-medium"
                                        >
                                            ล้างการเลือก
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Available Rooms List */}
                        {selectedStartDate && selectedEndDate && (
                            <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-4 shadow-sm">
                                <h3 className="text-base font-semibold text-zinc-800 mb-3">
                                    ห้องว่างในช่วงที่เลือก
                                </h3>
                                {(() => {
                                    const availableRooms = rooms.filter(
                                        (room) => {
                                            // Skip rooms in maintenance
                                            if (room.status === 'maintenance')
                                                return false

                                            // Check if room is currently occupied (has tenant)
                                            if (
                                                room.status === 'occupied' &&
                                                room.tenantId
                                            ) {
                                                // Room is currently occupied, not available
                                                return false
                                            }

                                            // Check if room has any occupancy period that overlaps with selected range
                                            const hasOverlap =
                                                room.occupancyPeriods?.some(
                                                    (period) => {
                                                        const periodStart =
                                                            new Date(
                                                                period.startDate,
                                                            ).getTime()
                                                        const periodEnd =
                                                            period.endDate
                                                                ? new Date(
                                                                      period.endDate,
                                                                  ).getTime()
                                                                : new Date(
                                                                      '2099-12-31',
                                                                  ).getTime()
                                                        const selStart =
                                                            selectedStartDate!.getTime()
                                                        const selEnd =
                                                            selectedEndDate!.getTime()

                                                        // Check for overlap (using numeric timestamp comparison)
                                                        return !(
                                                            selEnd <
                                                                periodStart ||
                                                            selStart > periodEnd
                                                        )
                                                    },
                                                )
                                            return !hasOverlap
                                        },
                                    )

                                    if (availableRooms.length === 0) {
                                        return (
                                            <div className="text-center py-8">
                                                <div className="w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                                    <svg
                                                        className="w-7 h-7 text-zinc-400"
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
                                                <p className="text-zinc-500 font-medium">
                                                    ไม่มีห้องว่างในช่วงเวลานี้
                                                </p>
                                            </div>
                                        )
                                    }

                                    return (
                                        <div className="space-y-1.5">
                                            <p className="text-xs text-zinc-500 mb-2 font-medium">
                                                พบห้องว่าง{' '}
                                                {availableRooms.length} ห้อง
                                            </p>
                                            {availableRooms.map((room) => (
                                                <button
                                                    key={room._id}
                                                    onClick={() =>
                                                        handleViewRoom(room)
                                                    }
                                                    className="w-full bg-gradient-to-r from-green-50 to-white rounded-xl p-3.5 text-left hover:shadow-md transition-all border-l-4 border-l-green-500"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                                                                <svg
                                                                    className="w-5 h-5 text-green-600"
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
                                                                        d="M5 13l4 4L19 7"
                                                                    />
                                                                </svg>
                                                            </div>
                                                            <div>
                                                                <p className="text-base font-semibold text-zinc-800">
                                                                    ห้อง{' '}
                                                                    {
                                                                        room.roomNumber
                                                                    }
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-base font-bold text-green-600">
                                                                {formatCurrency(
                                                                    room.baseRentPrice,
                                                                )}
                                                            </p>
                                                            <p className="text-[10px] text-zinc-400">
                                                                /เดือน
                                                            </p>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )
                                })()}
                            </div>
                        )}

                        {/* Unavailable Rooms List */}
                        {selectedStartDate && selectedEndDate && (
                            <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-4 shadow-sm">
                                <h3 className="text-base font-semibold text-zinc-800 mb-3">
                                    ห้องไม่ว่าง
                                </h3>
                                {(() => {
                                    const unavailableRooms = rooms.filter(
                                        (room) => {
                                            if (room.status === 'maintenance')
                                                return true
                                            if (
                                                room.status === 'occupied' &&
                                                room.tenantId
                                            )
                                                return true

                                            const hasOverlap =
                                                room.occupancyPeriods?.some(
                                                    (period) => {
                                                        const periodStart =
                                                            new Date(
                                                                period.startDate,
                                                            ).getTime()
                                                        const periodEnd =
                                                            period.endDate
                                                                ? new Date(
                                                                      period.endDate,
                                                                  ).getTime()
                                                                : new Date(
                                                                      '2099-12-31',
                                                                  ).getTime()
                                                        const selStart =
                                                            selectedStartDate!.getTime()
                                                        const selEnd =
                                                            selectedEndDate!.getTime()
                                                        return !(
                                                            selEnd <
                                                                periodStart ||
                                                            selStart > periodEnd
                                                        )
                                                    },
                                                )
                                            return hasOverlap
                                        },
                                    )

                                    if (unavailableRooms.length === 0) {
                                        return (
                                            <p className="text-sm text-green-600 text-center py-4 font-medium">
                                                ทุกห้องว่าง!
                                            </p>
                                        )
                                    }

                                    return (
                                        <div className="space-y-1.5">
                                            <p className="text-xs text-zinc-500 mb-2 font-medium">
                                                ไม่ว่าง{' '}
                                                {unavailableRooms.length} ห้อง
                                            </p>
                                            {unavailableRooms.map((room) => {
                                                // Find overlapping period
                                                const overlappingPeriod =
                                                    room.occupancyPeriods?.find(
                                                        (period) => {
                                                            const periodStart =
                                                                new Date(
                                                                    period.startDate,
                                                                ).getTime()
                                                            const periodEnd =
                                                                period.endDate
                                                                    ? new Date(
                                                                          period.endDate,
                                                                      ).getTime()
                                                                    : new Date(
                                                                          '2099-12-31',
                                                                      ).getTime()
                                                            const selStart =
                                                                selectedStartDate!.getTime()
                                                            const selEnd =
                                                                selectedEndDate!.getTime()
                                                            return !(
                                                                selEnd <
                                                                    periodStart ||
                                                                selStart >
                                                                    periodEnd
                                                            )
                                                        },
                                                    )

                                                let reasonText = ''
                                                if (
                                                    room.status ===
                                                    'maintenance'
                                                ) {
                                                    reasonText =
                                                        'อยู่ระหว่างซ่อมแซม'
                                                } else if (
                                                    room.status ===
                                                        'occupied' &&
                                                    room.tenantId
                                                ) {
                                                    reasonText = `มีผู้เช่า: ${room.tenantId.displayName || room.tenantId.fullName || '-'}`
                                                } else if (overlappingPeriod) {
                                                    const start = new Date(
                                                        overlappingPeriod.startDate,
                                                    ).toLocaleDateString(
                                                        'th-TH',
                                                        {
                                                            day: 'numeric',
                                                            month: 'short',
                                                        },
                                                    )
                                                    const end =
                                                        overlappingPeriod.endDate
                                                            ? new Date(
                                                                  overlappingPeriod.endDate,
                                                              ).toLocaleDateString(
                                                                  'th-TH',
                                                                  {
                                                                      day: 'numeric',
                                                                      month: 'short',
                                                                  },
                                                              )
                                                            : 'ปัจจุบัน'
                                                    reasonText = `จองแล้ว: ${start} - ${end}${overlappingPeriod.tenantName ? ` (${overlappingPeriod.tenantName})` : ''}`
                                                }

                                                return (
                                                    <button
                                                        key={room._id}
                                                        onClick={() =>
                                                            handleViewRoom(room)
                                                        }
                                                        className="w-full bg-zinc-50/80 rounded-xl p-3 text-left hover:bg-zinc-100 transition-all"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <div
                                                                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                                                        room.status ===
                                                                        'maintenance'
                                                                            ? 'bg-amber-100'
                                                                            : 'bg-zinc-200'
                                                                    }`}
                                                                >
                                                                    <svg
                                                                        className={`w-4 h-4 ${
                                                                            room.status ===
                                                                            'maintenance'
                                                                                ? 'text-amber-600'
                                                                                : 'text-zinc-500'
                                                                        }`}
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
                                                                            d="M6 18L18 6M6 6l12 12"
                                                                        />
                                                                    </svg>
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-medium text-zinc-700">
                                                                        ห้อง{' '}
                                                                        {
                                                                            room.roomNumber
                                                                        }
                                                                    </p>
                                                                    <p className="text-[10px] text-zinc-500">
                                                                        {
                                                                            reasonText
                                                                        }
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <p className="text-sm text-zinc-400 font-medium">
                                                                {formatCurrency(
                                                                    room.baseRentPrice,
                                                                )}
                                                            </p>
                                                        </div>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )
                                })()}
                            </div>
                        )}

                        {/* Instruction when no date selected */}
                        {!selectedStartDate && (
                            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 text-center border border-zinc-100">
                                <div className="w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                    <svg
                                        className="w-7 h-7 text-zinc-500"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                        />
                                    </svg>
                                </div>
                                <p className="text-zinc-800 font-semibold">
                                    เลือกช่วงวันที่
                                </p>
                                <p className="text-zinc-500 text-sm mt-1">
                                    คลิกวันเริ่มต้นและวันสิ้นสุดเพื่อดูห้องว่าง
                                </p>
                            </div>
                        )}

                        {selectedStartDate && !selectedEndDate && (
                            <div className="bg-amber-50/80 backdrop-blur-sm rounded-2xl p-6 text-center border border-amber-100">
                                <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                    <svg
                                        className="w-7 h-7 text-amber-600"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                        />
                                    </svg>
                                </div>
                                <p className="text-amber-800 font-semibold">
                                    เลือกวันสิ้นสุด
                                </p>
                                <p className="text-amber-600 text-sm mt-1">
                                    คลิกวันที่สิ้นสุดเพื่อดูห้องว่างในช่วงนี้
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Room Detail Modal */}
            {showRoomModal && (selectedRoom || editingRoom) && (
                <>
                    <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                        onClick={() => {
                            setShowRoomModal(false)
                            setShowRoomMenu(false)
                        }}
                    />
                    <div
                        className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-[28px] shadow-2xl"
                        style={{
                            transform: `translateY(${dragCurrentY}px)`,
                            maxHeight: '85vh',
                            transition: isDragging
                                ? 'none'
                                : 'transform 0.3s ease-out',
                            animation: 'slideUp 0.3s ease-out',
                        }}
                    >
                        {/* Sticky Header - Drag Handle + Occupancy Periods */}
                        <div className="sticky top-0 z-10 bg-white rounded-t-[28px]">
                            {/* Drag Handle */}
                            <div
                                className="px-6 py-4 border-b border-zinc-100 cursor-grab active:cursor-grabbing"
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
                                <div className="w-10 h-1 bg-zinc-300 rounded-full mx-auto mb-4"></div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-xl font-bold text-zinc-800">
                                            ห้อง{' '}
                                            {
                                                (editingRoom || selectedRoom)
                                                    ?.roomNumber
                                            }
                                        </h2>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {/* Manual Toggle for rooms without tenant, or Status Badge */}
                                        {!editingRoom &&
                                        selectedRoom &&
                                        !selectedRoom.tenantId &&
                                        selectedRoom.status !==
                                            'maintenance' ? (
                                            <>
                                                <span
                                                    className={`text-xs font-medium ${selectedRoom.status === 'vacant' ? 'text-zinc-500' : 'text-zinc-400'}`}
                                                >
                                                    ว่าง
                                                </span>
                                                <button
                                                    onClick={() => {
                                                        const newStatus =
                                                            selectedRoom.status ===
                                                            'vacant'
                                                                ? 'occupied'
                                                                : 'vacant'
                                                        toggleStatusMutation.mutate(
                                                            {
                                                                roomId: selectedRoom._id,
                                                                newStatus,
                                                            },
                                                        )
                                                    }}
                                                    disabled={
                                                        toggleStatusMutation.isPending
                                                    }
                                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500/30 disabled:opacity-50 ${
                                                        selectedRoom.status ===
                                                        'occupied'
                                                            ? 'bg-green-500'
                                                            : 'bg-zinc-300'
                                                    }`}
                                                >
                                                    <span
                                                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                                                            selectedRoom.status ===
                                                            'occupied'
                                                                ? 'translate-x-6'
                                                                : 'translate-x-1'
                                                        }`}
                                                    />
                                                </button>
                                                <span
                                                    className={`text-xs font-medium ${selectedRoom.status === 'occupied' ? 'text-green-600' : 'text-zinc-400'}`}
                                                >
                                                    ไม่ว่าง
                                                </span>
                                            </>
                                        ) : (
                                            <span
                                                className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                                                    (
                                                        editingRoom ||
                                                        selectedRoom
                                                    )?.status === 'vacant'
                                                        ? 'bg-zinc-100 text-zinc-600'
                                                        : (
                                                                editingRoom ||
                                                                selectedRoom
                                                            )?.status ===
                                                            'occupied'
                                                          ? 'bg-green-100 text-green-700'
                                                          : 'bg-amber-100 text-amber-700'
                                                }`}
                                            >
                                                {(editingRoom || selectedRoom)
                                                    ?.status === 'vacant'
                                                    ? 'ว่าง'
                                                    : (
                                                            editingRoom ||
                                                            selectedRoom
                                                        )?.status === 'occupied'
                                                      ? 'มีผู้เช่า'
                                                      : 'ซ่อมแซม'}
                                            </span>
                                        )}
                                        {/* 3-dots menu button */}
                                        {!editingRoom && selectedRoom && (
                                            <div className="relative">
                                                <button
                                                    onClick={() =>
                                                        setShowRoomMenu(
                                                            !showRoomMenu,
                                                        )
                                                    }
                                                    className="p-2 hover:bg-zinc-100 rounded-xl transition-colors"
                                                >
                                                    <svg
                                                        className="w-5 h-5 text-zinc-500"
                                                        fill="currentColor"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <circle
                                                            cx="12"
                                                            cy="5"
                                                            r="2"
                                                        />
                                                        <circle
                                                            cx="12"
                                                            cy="12"
                                                            r="2"
                                                        />
                                                        <circle
                                                            cx="12"
                                                            cy="19"
                                                            r="2"
                                                        />
                                                    </svg>
                                                </button>
                                                {showRoomMenu && (
                                                    <>
                                                        <div
                                                            className="fixed inset-0 z-10"
                                                            onClick={() =>
                                                                setShowRoomMenu(
                                                                    false,
                                                                )
                                                            }
                                                        />
                                                        <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-zinc-100 py-1 z-20 min-w-[140px]">
                                                            <button
                                                                onClick={() => {
                                                                    handleEditRoom(
                                                                        selectedRoom,
                                                                    )
                                                                    setShowRoomMenu(
                                                                        false,
                                                                    )
                                                                }}
                                                                className="w-full px-4 py-2.5 text-left text-sm text-zinc-700 hover:bg-zinc-50 flex items-center gap-2"
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
                                                                        strokeWidth={
                                                                            2
                                                                        }
                                                                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                                                    />
                                                                </svg>
                                                                แก้ไขข้อมูล
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div
                            className="overflow-y-auto p-6 space-y-3"
                            style={{ maxHeight: 'calc(85vh - 120px)' }}
                        >
                            {/* Occupancy Periods Section - Under room number */}
                            {!editingRoom && selectedRoom && (
                                <div className="px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-100">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-sm font-semibold text-zinc-700">
                                            การจอง
                                        </h3>
                                        <button
                                            onClick={() => {
                                                if (!showAddPeriod) {
                                                    // Reset form when opening
                                                    setPeriodStartDate(null)
                                                    setPeriodEndDate(null)
                                                    setPeriodTenantName('')
                                                    setPeriodNotes('')
                                                    setPeriodCalendarMonth(
                                                        new Date().getMonth(),
                                                    )
                                                    setPeriodCalendarYear(
                                                        new Date().getFullYear(),
                                                    )
                                                }
                                                setShowAddPeriod(!showAddPeriod)
                                            }}
                                            className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
                                        >
                                            {showAddPeriod
                                                ? 'ยกเลิก'
                                                : '+ เพิ่ม'}
                                        </button>
                                    </div>

                                    {/* Add Period Form with Calendar */}
                                    {showAddPeriod && (
                                        <div className="bg-white p-3 rounded-lg mb-2 space-y-3">
                                            {/* Calendar Navigation */}
                                            <div className="flex items-center justify-between">
                                                <button
                                                    onClick={() => {
                                                        if (
                                                            periodCalendarMonth ===
                                                            0
                                                        ) {
                                                            setPeriodCalendarMonth(
                                                                11,
                                                            )
                                                            setPeriodCalendarYear(
                                                                periodCalendarYear -
                                                                    1,
                                                            )
                                                        } else {
                                                            setPeriodCalendarMonth(
                                                                periodCalendarMonth -
                                                                    1,
                                                            )
                                                        }
                                                    }}
                                                    className="p-1 hover:bg-gray-100 rounded"
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
                                                            d="M15 19l-7-7 7-7"
                                                        />
                                                    </svg>
                                                </button>
                                                <span className="text-sm font-medium text-gray-700">
                                                    {
                                                        [
                                                            'ม.ค.',
                                                            'ก.พ.',
                                                            'มี.ค.',
                                                            'เม.ย.',
                                                            'พ.ค.',
                                                            'มิ.ย.',
                                                            'ก.ค.',
                                                            'ส.ค.',
                                                            'ก.ย.',
                                                            'ต.ค.',
                                                            'พ.ย.',
                                                            'ธ.ค.',
                                                        ][periodCalendarMonth]
                                                    }{' '}
                                                    {periodCalendarYear + 543}
                                                </span>
                                                <button
                                                    onClick={() => {
                                                        if (
                                                            periodCalendarMonth ===
                                                            11
                                                        ) {
                                                            setPeriodCalendarMonth(
                                                                0,
                                                            )
                                                            setPeriodCalendarYear(
                                                                periodCalendarYear +
                                                                    1,
                                                            )
                                                        } else {
                                                            setPeriodCalendarMonth(
                                                                periodCalendarMonth +
                                                                    1,
                                                            )
                                                        }
                                                    }}
                                                    className="p-1 hover:bg-gray-100 rounded"
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
                                                            d="M9 5l7 7-7 7"
                                                        />
                                                    </svg>
                                                </button>
                                            </div>

                                            {/* Day Headers */}
                                            <div className="grid grid-cols-7 gap-0.5">
                                                {[
                                                    'อา',
                                                    'จ',
                                                    'อ',
                                                    'พ',
                                                    'พฤ',
                                                    'ศ',
                                                    'ส',
                                                ].map((day) => (
                                                    <div
                                                        key={day}
                                                        className="text-center text-[10px] font-medium text-gray-500 py-1"
                                                    >
                                                        {day}
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Calendar Grid */}
                                            <div className="grid grid-cols-7 gap-0.5">
                                                {(() => {
                                                    const firstDay = new Date(
                                                        periodCalendarYear,
                                                        periodCalendarMonth,
                                                        1,
                                                    ).getDay()
                                                    const daysInMonth =
                                                        new Date(
                                                            periodCalendarYear,
                                                            periodCalendarMonth +
                                                                1,
                                                            0,
                                                        ).getDate()
                                                    const days = []

                                                    // Check if date overlaps with existing periods
                                                    const isDateBooked = (
                                                        date: Date,
                                                    ) => {
                                                        return selectedRoom.occupancyPeriods?.some(
                                                            (period) => {
                                                                const pStart =
                                                                    new Date(
                                                                        period.startDate,
                                                                    ).getTime()
                                                                const pEnd =
                                                                    period.endDate
                                                                        ? new Date(
                                                                              period.endDate,
                                                                          ).getTime()
                                                                        : new Date(
                                                                              '2099-12-31',
                                                                          ).getTime()
                                                                const d =
                                                                    date.getTime()
                                                                return (
                                                                    d >=
                                                                        pStart &&
                                                                    d <= pEnd
                                                                )
                                                            },
                                                        )
                                                    }

                                                    // Empty cells for days before first of month
                                                    for (
                                                        let i = 0;
                                                        i < firstDay;
                                                        i++
                                                    ) {
                                                        days.push(
                                                            <div
                                                                key={`empty-${i}`}
                                                                className="h-7"
                                                            />,
                                                        )
                                                    }

                                                    // Days of the month
                                                    for (
                                                        let day = 1;
                                                        day <= daysInMonth;
                                                        day++
                                                    ) {
                                                        const date = new Date(
                                                            periodCalendarYear,
                                                            periodCalendarMonth,
                                                            day,
                                                        )
                                                        const isSelected =
                                                            periodStartDate &&
                                                            date.getTime() ===
                                                                periodStartDate.getTime()
                                                        const isEndSelected =
                                                            periodEndDate &&
                                                            date.getTime() ===
                                                                periodEndDate.getTime()
                                                        const isInRange =
                                                            periodStartDate &&
                                                            periodEndDate &&
                                                            date >
                                                                periodStartDate &&
                                                            date < periodEndDate
                                                        const isToday =
                                                            new Date().toDateString() ===
                                                            date.toDateString()
                                                        const isBooked =
                                                            isDateBooked(date)

                                                        days.push(
                                                            <button
                                                                key={day}
                                                                onClick={() => {
                                                                    if (
                                                                        isBooked
                                                                    )
                                                                        return // Don't allow selecting booked dates
                                                                    if (
                                                                        !periodStartDate ||
                                                                        (periodStartDate &&
                                                                            periodEndDate)
                                                                    ) {
                                                                        setPeriodStartDate(
                                                                            date,
                                                                        )
                                                                        setPeriodEndDate(
                                                                            null,
                                                                        )
                                                                    } else if (
                                                                        date <
                                                                        periodStartDate
                                                                    ) {
                                                                        setPeriodStartDate(
                                                                            date,
                                                                        )
                                                                    } else {
                                                                        // Check if range overlaps with any existing period
                                                                        const hasOverlap =
                                                                            selectedRoom.occupancyPeriods?.some(
                                                                                (
                                                                                    period,
                                                                                ) => {
                                                                                    const pStart =
                                                                                        new Date(
                                                                                            period.startDate,
                                                                                        ).getTime()
                                                                                    const pEnd =
                                                                                        period.endDate
                                                                                            ? new Date(
                                                                                                  period.endDate,
                                                                                              ).getTime()
                                                                                            : new Date(
                                                                                                  '2099-12-31',
                                                                                              ).getTime()
                                                                                    const selStart =
                                                                                        periodStartDate.getTime()
                                                                                    const selEnd =
                                                                                        date.getTime()
                                                                                    return !(
                                                                                        selEnd <
                                                                                            pStart ||
                                                                                        selStart >
                                                                                            pEnd
                                                                                    )
                                                                                },
                                                                            )
                                                                        if (
                                                                            hasOverlap
                                                                        ) {
                                                                            alert(
                                                                                'ช่วงเวลาที่เลือกซ้ำซ้อนกับการจองที่มีอยู่แล้ว',
                                                                            )
                                                                            return
                                                                        }
                                                                        setPeriodEndDate(
                                                                            date,
                                                                        )
                                                                    }
                                                                }}
                                                                disabled={
                                                                    isBooked
                                                                }
                                                                className={`h-7 rounded text-xs font-medium transition-all ${
                                                                    isBooked
                                                                        ? 'bg-red-100 text-red-400 cursor-not-allowed'
                                                                        : isSelected ||
                                                                            isEndSelected
                                                                          ? 'bg-green-600 text-white'
                                                                          : isInRange
                                                                            ? 'bg-green-100 text-green-800'
                                                                            : isToday
                                                                              ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                                                              : 'hover:bg-gray-100 text-gray-700'
                                                                }`}
                                                            >
                                                                {day}
                                                            </button>,
                                                        )
                                                    }

                                                    return days
                                                })()}
                                            </div>

                                            {/* Quick Select Buttons */}
                                            {periodStartDate &&
                                                !periodEndDate && (
                                                    <div className="p-2 bg-blue-50 rounded-lg">
                                                        <p className="text-[10px] text-blue-600 mb-1">
                                                            เลือกระยะเวลา:
                                                        </p>
                                                        <div className="flex gap-1">
                                                            {[
                                                                {
                                                                    label: '1 ด.',
                                                                    months: 1,
                                                                },
                                                                {
                                                                    label: '6 ด.',
                                                                    months: 6,
                                                                },
                                                                {
                                                                    label: '12 ด.',
                                                                    months: 12,
                                                                },
                                                            ].map(
                                                                ({
                                                                    label,
                                                                    months,
                                                                }) => (
                                                                    <button
                                                                        key={
                                                                            months
                                                                        }
                                                                        onClick={() => {
                                                                            const endDate =
                                                                                new Date(
                                                                                    periodStartDate,
                                                                                )
                                                                            if (
                                                                                months ===
                                                                                12
                                                                            ) {
                                                                                endDate.setFullYear(
                                                                                    endDate.getFullYear() +
                                                                                        1,
                                                                                )
                                                                            } else {
                                                                                endDate.setMonth(
                                                                                    endDate.getMonth() +
                                                                                        months,
                                                                                )
                                                                            }
                                                                            // Check overlap
                                                                            const hasOverlap =
                                                                                selectedRoom.occupancyPeriods?.some(
                                                                                    (
                                                                                        period,
                                                                                    ) => {
                                                                                        const pStart =
                                                                                            new Date(
                                                                                                period.startDate,
                                                                                            ).getTime()
                                                                                        const pEnd =
                                                                                            period.endDate
                                                                                                ? new Date(
                                                                                                      period.endDate,
                                                                                                  ).getTime()
                                                                                                : new Date(
                                                                                                      '2099-12-31',
                                                                                                  ).getTime()
                                                                                        const selStart =
                                                                                            periodStartDate.getTime()
                                                                                        const selEnd =
                                                                                            endDate.getTime()
                                                                                        return !(
                                                                                            selEnd <
                                                                                                pStart ||
                                                                                            selStart >
                                                                                                pEnd
                                                                                        )
                                                                                    },
                                                                                )
                                                                            if (
                                                                                hasOverlap
                                                                            ) {
                                                                                alert(
                                                                                    'ช่วงเวลาที่เลือกซ้ำซ้อนกับการจองที่มีอยู่แล้ว',
                                                                                )
                                                                                return
                                                                            }
                                                                            setPeriodEndDate(
                                                                                endDate,
                                                                            )
                                                                        }}
                                                                        className="flex-1 py-1.5 px-2 bg-blue-100 text-blue-700 text-xs font-medium rounded hover:bg-blue-200 transition-colors"
                                                                    >
                                                                        {label}
                                                                    </button>
                                                                ),
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                            {/* Selected Range Display */}
                                            {periodStartDate &&
                                                periodEndDate && (
                                                    <div className="p-2 bg-green-50 rounded-lg">
                                                        <p className="text-xs text-green-800">
                                                            <span className="font-medium">
                                                                ช่วงที่เลือก:
                                                            </span>{' '}
                                                            {periodStartDate.toLocaleDateString(
                                                                'th-TH',
                                                                {
                                                                    day: 'numeric',
                                                                    month: 'short',
                                                                    year: '2-digit',
                                                                },
                                                            )}
                                                            {' - '}
                                                            {periodEndDate.toLocaleDateString(
                                                                'th-TH',
                                                                {
                                                                    day: 'numeric',
                                                                    month: 'short',
                                                                    year: '2-digit',
                                                                },
                                                            )}
                                                        </p>
                                                        <div className="flex gap-2 mt-1">
                                                            <button
                                                                onClick={() =>
                                                                    setPeriodEndDate(
                                                                        null,
                                                                    )
                                                                }
                                                                className="text-[10px] text-blue-600 hover:text-blue-800"
                                                            >
                                                                เปลี่ยนระยะเวลา
                                                            </button>
                                                            <span className="text-gray-300">
                                                                |
                                                            </span>
                                                            <button
                                                                onClick={() => {
                                                                    setPeriodStartDate(
                                                                        null,
                                                                    )
                                                                    setPeriodEndDate(
                                                                        null,
                                                                    )
                                                                }}
                                                                className="text-[10px] text-green-600 hover:text-green-800"
                                                            >
                                                                ล้างการเลือก
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                            {/* Tenant Name & Notes */}
                                            <input
                                                type="text"
                                                placeholder="ชื่อผู้เช่า (ไม่บังคับ)"
                                                value={periodTenantName}
                                                onChange={(e) =>
                                                    setPeriodTenantName(
                                                        e.target.value,
                                                    )
                                                }
                                                className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded"
                                            />
                                            <input
                                                type="text"
                                                placeholder="หมายเหตุ (ไม่บังคับ)"
                                                value={periodNotes}
                                                onChange={(e) =>
                                                    setPeriodNotes(
                                                        e.target.value,
                                                    )
                                                }
                                                className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded"
                                            />
                                            <button
                                                onClick={() => {
                                                    if (!periodStartDate) {
                                                        alert(
                                                            'กรุณาเลือกวันที่เริ่มต้น',
                                                        )
                                                        return
                                                    }
                                                    if (!periodEndDate) {
                                                        alert(
                                                            'กรุณาเลือกวันที่สิ้นสุด',
                                                        )
                                                        return
                                                    }
                                                    if (
                                                        periodEndDate <
                                                        periodStartDate
                                                    ) {
                                                        alert(
                                                            'วันที่สิ้นสุดต้องมากกว่าวันที่เริ่มต้น',
                                                        )
                                                        return
                                                    }
                                                    // Final overlap check
                                                    const hasOverlap =
                                                        selectedRoom.occupancyPeriods?.some(
                                                            (period) => {
                                                                const pStart =
                                                                    new Date(
                                                                        period.startDate,
                                                                    ).getTime()
                                                                const pEnd =
                                                                    period.endDate
                                                                        ? new Date(
                                                                              period.endDate,
                                                                          ).getTime()
                                                                        : new Date(
                                                                              '2099-12-31',
                                                                          ).getTime()
                                                                const selStart =
                                                                    periodStartDate.getTime()
                                                                const selEnd =
                                                                    periodEndDate.getTime()
                                                                return !(
                                                                    selEnd <
                                                                        pStart ||
                                                                    selStart >
                                                                        pEnd
                                                                )
                                                            },
                                                        )
                                                    if (hasOverlap) {
                                                        alert(
                                                            'ช่วงเวลาที่เลือกซ้ำซ้อนกับการจองที่มีอยู่แล้ว',
                                                        )
                                                        return
                                                    }
                                                    addPeriodMutation.mutate({
                                                        roomId: selectedRoom._id,
                                                        period: {
                                                            startDate:
                                                                periodStartDate.toISOString(),
                                                            endDate:
                                                                periodEndDate.toISOString(),
                                                            tenantName:
                                                                periodTenantName ||
                                                                undefined,
                                                            notes:
                                                                periodNotes ||
                                                                undefined,
                                                        },
                                                    })
                                                }}
                                                disabled={
                                                    addPeriodMutation.isPending ||
                                                    !periodStartDate ||
                                                    !periodEndDate
                                                }
                                                className="w-full py-1.5 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {addPeriodMutation.isPending
                                                    ? 'กำลังบันทึก...'
                                                    : 'บันทึกการจอง'}
                                            </button>
                                        </div>
                                    )}

                                    {/* Period List */}
                                    {selectedRoom.occupancyPeriods &&
                                    selectedRoom.occupancyPeriods.length > 0 ? (
                                        <div className="space-y-1 max-h-32 overflow-y-auto">
                                            {[...selectedRoom.occupancyPeriods]
                                                .sort(
                                                    (a, b) =>
                                                        new Date(
                                                            b.startDate,
                                                        ).getTime() -
                                                        new Date(
                                                            a.startDate,
                                                        ).getTime(),
                                                )
                                                .map((period) => (
                                                    <div
                                                        key={period._id}
                                                        className="flex items-center justify-between bg-white px-2 py-1.5 rounded text-xs"
                                                    >
                                                        <div className="flex-1">
                                                            <span className="text-gray-900">
                                                                {new Date(
                                                                    period.startDate,
                                                                ).toLocaleDateString(
                                                                    'th-TH',
                                                                    {
                                                                        day: '2-digit',
                                                                        month: 'short',
                                                                        year: '2-digit',
                                                                    },
                                                                )}
                                                                {' - '}
                                                                {period.endDate
                                                                    ? new Date(
                                                                          period.endDate,
                                                                      ).toLocaleDateString(
                                                                          'th-TH',
                                                                          {
                                                                              day: '2-digit',
                                                                              month: 'short',
                                                                              year: '2-digit',
                                                                          },
                                                                      )
                                                                    : 'ปัจจุบัน'}
                                                            </span>
                                                            {period.tenantName && (
                                                                <span className="text-gray-500 ml-2">
                                                                    (
                                                                    {
                                                                        period.tenantName
                                                                    }
                                                                    )
                                                                </span>
                                                            )}
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                if (
                                                                    confirm(
                                                                        'ลบการจองนี้?',
                                                                    )
                                                                ) {
                                                                    removePeriodMutation.mutate(
                                                                        {
                                                                            roomId: selectedRoom._id,
                                                                            periodId:
                                                                                period._id,
                                                                        },
                                                                    )
                                                                }
                                                            }}
                                                            disabled={
                                                                removePeriodMutation.isPending
                                                            }
                                                            className="text-red-500 hover:text-red-700 ml-2"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-400">
                                            ยังไม่มีการจอง
                                        </p>
                                    )}
                                </div>
                            )}
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

                                    {/* Tenant Section - Only show if room has tenant */}
                                    {editingRoom?.tenantId && (
                                        <div className="bg-green-50 rounded-xl p-4 border border-green-200 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm font-medium text-green-700">
                                                    ข้อมูลผู้เช่า
                                                </p>
                                                {/* Evict Button - Top Right */}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (
                                                            confirm(
                                                                `คุณแน่ใจว่าต้องการย้าย ${editingRoom.tenantId?.displayName || 'ผู้เช่า'} ออกจากห้อง ${editingRoom.roomNumber}?`,
                                                            )
                                                        ) {
                                                            evictMutation.mutate(
                                                                editingRoom._id,
                                                            )
                                                        }
                                                    }}
                                                    disabled={
                                                        evictMutation.isPending
                                                    }
                                                    className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 transition-colors flex items-center gap-1"
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
                                                            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                                                        />
                                                    </svg>
                                                    {evictMutation.isPending
                                                        ? 'กำลังย้าย...'
                                                        : 'ย้ายออก'}
                                                </button>
                                            </div>

                                            {/* Tenant Display Info */}
                                            <div className="flex items-center gap-3 pb-3 border-b border-green-200">
                                                {editingRoom.tenantId
                                                    .pictureUrl ? (
                                                    <img
                                                        src={
                                                            editingRoom.tenantId
                                                                .pictureUrl
                                                        }
                                                        alt={
                                                            editingRoom.tenantId
                                                                .displayName
                                                        }
                                                        className="w-12 h-12 rounded-full object-cover border border-green-300"
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
                                                                strokeWidth={2}
                                                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                                            />
                                                        </svg>
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="font-bold text-green-900">
                                                        {
                                                            editingRoom.tenantId
                                                                .displayName
                                                        }
                                                    </p>
                                                    {editingRoom.tenantId
                                                        .phone && (
                                                        <p className="text-sm text-green-700">
                                                            {
                                                                editingRoom
                                                                    .tenantId
                                                                    .phone
                                                            }
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Editable Tenant Fields */}
                                            <div>
                                                <label className="block text-sm font-medium text-green-700 mb-1">
                                                    ชื่อ-นามสกุล
                                                </label>
                                                <input
                                                    type="text"
                                                    value={
                                                        formData.tenantFullName ||
                                                        ''
                                                    }
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            tenantFullName:
                                                                e.target.value,
                                                        })
                                                    }
                                                    placeholder="ระบุชื่อ-นามสกุลจริง"
                                                    className="w-full px-4 py-3 border border-green-200 rounded-xl focus:ring-2 focus:ring-green-500 bg-white"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-green-700 mb-1">
                                                    หมายเหตุผู้เช่า
                                                </label>
                                                <textarea
                                                    value={
                                                        formData.tenantNotes ||
                                                        ''
                                                    }
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            tenantNotes:
                                                                e.target.value,
                                                        })
                                                    }
                                                    placeholder="บันทึกข้อมูลเพิ่มเติม เช่น เบอร์โทรติดต่อฉุกเฉิน"
                                                    rows={2}
                                                    className="w-full px-4 py-3 border border-green-200 rounded-xl focus:ring-2 focus:ring-green-500 bg-white resize-none"
                                                />
                                            </div>
                                        </div>
                                    )}

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
                                        <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-100">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-xs text-zinc-500 font-medium mb-1">
                                                        ค่าเช่า
                                                    </p>
                                                    <p className="text-xl font-bold text-zinc-800">
                                                        {formatCurrency(
                                                            selectedRoom.baseRentPrice,
                                                        )}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-zinc-500 font-medium mb-1">
                                                        เงินประกัน
                                                    </p>
                                                    <p className="text-xl font-bold text-zinc-800">
                                                        {formatCurrency(
                                                            selectedRoom.depositAmount ||
                                                                0,
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Rates */}
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="bg-blue-50/80 gap-1 flex flex-row justify-between items-center rounded-xl px-3 py-2 border border-blue-100">
                                                <p className="text-xs text-blue-600 font-medium">
                                                    ค่าน้ำ
                                                </p>
                                                <p className="text-lg font-bold text-blue-700">
                                                    {selectedRoom.waterRate ||
                                                        18}{' '}
                                                </p>
                                                <p className="text-xs text-blue-600 font-medium">
                                                    บาท/หน่วย
                                                </p>
                                            </div>
                                            <div className="bg-amber-50/80 gap-1 flex flex-row justify-between items-center rounded-xl px-3 py-2 border border-amber-100">
                                                <p className="text-xs text-amber-600 font-medium">
                                                    ค่าไฟ
                                                </p>
                                                <p className="text-lg font-bold text-amber-700">
                                                    {selectedRoom.electricityRate ||
                                                        8}{' '}
                                                </p>
                                                <p className="text-xs text-amber-600 font-medium">
                                                    บาท/หน่วย
                                                </p>
                                            </div>
                                        </div>

                                        {/* Meter Section */}
                                        <div className="space-y-3">
                                            {/* Meter Numbers */}
                                            <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-100">
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="text-sm text-zinc-600 font-medium">
                                                        มิเตอร์
                                                    </p>
                                                    <button
                                                        onClick={() =>
                                                            setShowMeterHistory(
                                                                !showMeterHistory,
                                                            )
                                                        }
                                                        className="text-xs text-green-600 hover:text-green-700 font-medium"
                                                    >
                                                        {showMeterHistory
                                                            ? 'ซ่อนประวัติ'
                                                            : 'ดูประวัติ'}
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="px-1">
                                                        {(() => {
                                                            const latest =
                                                                getLatestReading(
                                                                    selectedRoom.waterMeterReadings,
                                                                )
                                                            return (
                                                                latest && (
                                                                    <div className="text-xs text-blue-600 mt-1">
                                                                        <div className="flex flex-row justify-between items-center">
                                                                            <Droplets />
                                                                            <span className="text-xl">
                                                                                {
                                                                                    latest.value
                                                                                }
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex flex-row justify-between items-center">
                                                                            <span></span>
                                                                            <span className="text-zinc-500 ml-1">
                                                                                จดเมื่อ:{' '}
                                                                                {new Date(
                                                                                    latest.recordedAt,
                                                                                ).toLocaleDateString(
                                                                                    'th-TH',
                                                                                    {
                                                                                        day: 'numeric',
                                                                                        month: 'short',
                                                                                    },
                                                                                )}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                )
                                                            )
                                                        })()}
                                                    </div>
                                                    <div>
                                                        <div className="px-1">
                                                            {(() => {
                                                                const latest =
                                                                    getLatestReading(
                                                                        selectedRoom.electricityMeterReadings,
                                                                    )
                                                                return (
                                                                    latest && (
                                                                        <div className="text-xs text-yellow-600 mt-1">
                                                                            <div className="flex flex-row justify-between items-center">
                                                                                <PlugZap />
                                                                                <span className="text-xl">
                                                                                    {
                                                                                        latest.value
                                                                                    }
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex flex-row justify-between items-center">
                                                                                <span></span>
                                                                                <span className="text-zinc-500 ml-1">
                                                                                    จดเมื่อ:{' '}
                                                                                    {new Date(
                                                                                        latest.recordedAt,
                                                                                    ).toLocaleDateString(
                                                                                        'th-TH',
                                                                                        {
                                                                                            day: 'numeric',
                                                                                            month: 'short',
                                                                                        },
                                                                                    )}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    )
                                                                )
                                                            })()}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Meter Reading History Charts */}
                                            {showMeterHistory && (
                                                <div className="bg-white rounded-xl p-4 space-y-4 border border-zinc-100">
                                                    <p className="text-sm font-semibold text-zinc-700">
                                                        ประวัติการจดมิเตอร์ (12
                                                        รายการล่าสุด)
                                                    </p>

                                                    {/* Water Meter Chart */}
                                                    <div className="bg-white rounded-lg p-3 border border-blue-200">
                                                        <p className="text-xs font-medium text-blue-700 mb-2 flex items-center gap-1">
                                                            <Droplets className="text-sm" />
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
                                                                            const chartData =
                                                                                readings
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
                                                                                            const recordedDate =
                                                                                                new Date(
                                                                                                    reading.recordedAt,
                                                                                                )
                                                                                            return {
                                                                                                date: recordedDate.toLocaleDateString(
                                                                                                    'th-TH',
                                                                                                    {
                                                                                                        day: 'numeric',
                                                                                                        month: 'short',
                                                                                                    },
                                                                                                ),
                                                                                                timestamp:
                                                                                                    recordedDate.getTime(),
                                                                                                value: reading.value,
                                                                                                usage:
                                                                                                    usage >
                                                                                                    0
                                                                                                        ? usage
                                                                                                        : 0,
                                                                                            }
                                                                                        },
                                                                                    )
                                                                            // Add index suffix to duplicate dates
                                                                            const dateCounts: Record<
                                                                                string,
                                                                                number
                                                                            > =
                                                                                {}
                                                                            return chartData.map(
                                                                                (
                                                                                    item,
                                                                                ) => {
                                                                                    dateCounts[
                                                                                        item.date
                                                                                    ] =
                                                                                        (dateCounts[
                                                                                            item
                                                                                                .date
                                                                                        ] ||
                                                                                            0) +
                                                                                        1
                                                                                    const count =
                                                                                        chartData.filter(
                                                                                            (
                                                                                                d,
                                                                                                i,
                                                                                            ) =>
                                                                                                d.date ===
                                                                                                    item.date &&
                                                                                                chartData.indexOf(
                                                                                                    d,
                                                                                                ) <=
                                                                                                    chartData.indexOf(
                                                                                                        item,
                                                                                                    ),
                                                                                        ).length
                                                                                    const totalSameDate =
                                                                                        chartData.filter(
                                                                                            (
                                                                                                d,
                                                                                            ) =>
                                                                                                d.date ===
                                                                                                item.date,
                                                                                        ).length
                                                                                    return {
                                                                                        ...item,
                                                                                        date:
                                                                                            totalSameDate >
                                                                                            1
                                                                                                ? `${item.date} (${count})`
                                                                                                : item.date,
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
                                                                            content={({
                                                                                active,
                                                                                payload,
                                                                                label,
                                                                            }) => {
                                                                                if (
                                                                                    active &&
                                                                                    payload &&
                                                                                    payload.length
                                                                                ) {
                                                                                    const data =
                                                                                        payload[0]
                                                                                            .payload
                                                                                    return (
                                                                                        <div className="bg-white border border-gray-200 rounded-lg p-2 shadow-lg">
                                                                                            <p className="text-xs text-gray-500 mb-1">
                                                                                                วันที่:{' '}
                                                                                                {
                                                                                                    label
                                                                                                }
                                                                                            </p>
                                                                                            <p className="text-sm font-bold text-blue-600">
                                                                                                ใช้:{' '}
                                                                                                {
                                                                                                    data.usage
                                                                                                }{' '}
                                                                                                หน่วย
                                                                                            </p>
                                                                                            <p className="text-xs text-gray-600">
                                                                                                ค่ามิเตอร์:{' '}
                                                                                                {
                                                                                                    data.value
                                                                                                }
                                                                                            </p>
                                                                                        </div>
                                                                                    )
                                                                                }
                                                                                return null
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
                                                            <PlugZap className="text-sm" />
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
                                                                            const chartData =
                                                                                readings
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
                                                                                            const recordedDate =
                                                                                                new Date(
                                                                                                    reading.recordedAt,
                                                                                                )
                                                                                            return {
                                                                                                date: recordedDate.toLocaleDateString(
                                                                                                    'th-TH',
                                                                                                    {
                                                                                                        day: 'numeric',
                                                                                                        month: 'short',
                                                                                                    },
                                                                                                ),
                                                                                                timestamp:
                                                                                                    recordedDate.getTime(),
                                                                                                value: reading.value,
                                                                                                usage:
                                                                                                    usage >
                                                                                                    0
                                                                                                        ? usage
                                                                                                        : 0,
                                                                                            }
                                                                                        },
                                                                                    )
                                                                            // Add index suffix to duplicate dates
                                                                            const dateCounts: Record<
                                                                                string,
                                                                                number
                                                                            > =
                                                                                {}
                                                                            return chartData.map(
                                                                                (
                                                                                    item,
                                                                                ) => {
                                                                                    dateCounts[
                                                                                        item.date
                                                                                    ] =
                                                                                        (dateCounts[
                                                                                            item
                                                                                                .date
                                                                                        ] ||
                                                                                            0) +
                                                                                        1
                                                                                    const count =
                                                                                        chartData.filter(
                                                                                            (
                                                                                                d,
                                                                                                i,
                                                                                            ) =>
                                                                                                d.date ===
                                                                                                    item.date &&
                                                                                                chartData.indexOf(
                                                                                                    d,
                                                                                                ) <=
                                                                                                    chartData.indexOf(
                                                                                                        item,
                                                                                                    ),
                                                                                        ).length
                                                                                    const totalSameDate =
                                                                                        chartData.filter(
                                                                                            (
                                                                                                d,
                                                                                            ) =>
                                                                                                d.date ===
                                                                                                item.date,
                                                                                        ).length
                                                                                    return {
                                                                                        ...item,
                                                                                        date:
                                                                                            totalSameDate >
                                                                                            1
                                                                                                ? `${item.date} (${count})`
                                                                                                : item.date,
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
                                                                            content={({
                                                                                active,
                                                                                payload,
                                                                                label,
                                                                            }) => {
                                                                                if (
                                                                                    active &&
                                                                                    payload &&
                                                                                    payload.length
                                                                                ) {
                                                                                    const data =
                                                                                        payload[0]
                                                                                            .payload
                                                                                    return (
                                                                                        <div className="bg-white border border-gray-200 rounded-lg p-2 shadow-lg">
                                                                                            <p className="text-xs text-gray-500 mb-1">
                                                                                                วันที่:{' '}
                                                                                                {
                                                                                                    label
                                                                                                }
                                                                                            </p>
                                                                                            <p className="text-sm font-bold text-amber-600">
                                                                                                ใช้:{' '}
                                                                                                {
                                                                                                    data.usage
                                                                                                }{' '}
                                                                                                หน่วย
                                                                                            </p>
                                                                                            <p className="text-xs text-gray-600">
                                                                                                ค่ามิเตอร์:{' '}
                                                                                                {
                                                                                                    data.value
                                                                                                }
                                                                                            </p>
                                                                                        </div>
                                                                                    )
                                                                                }
                                                                                return null
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
                                                    className="py-2.5 px-3 bg-blue-100/80 text-blue-700 text-sm font-medium rounded-xl hover:bg-blue-100 transition-colors flex items-center justify-center gap-1.5 border border-blue-200/50"
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
                                                    className="py-2.5 px-3 bg-amber-100/80 text-amber-700 text-sm font-medium rounded-xl hover:bg-amber-100 transition-colors flex items-center justify-center gap-1.5 border border-amber-200/50"
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
                                            <div className="bg-gradient-to-br from-green-50 to-white rounded-xl p-4 border border-green-100 space-y-3">
                                                <p className="text-xs text-green-600 font-semibold uppercase tracking-wide">
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
                                                            className="w-12 h-12 rounded-full object-cover border border-green-300"
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
                                                    <div className="flex-1">
                                                        <p className="font-bold text-green-900">
                                                            {selectedRoom
                                                                .tenantId
                                                                .fullName ||
                                                                selectedRoom
                                                                    .tenantId
                                                                    .displayName}
                                                        </p>
                                                        {selectedRoom.tenantId
                                                            .fullName && (
                                                            <p className="text-sm text-green-700">
                                                                (
                                                                {
                                                                    selectedRoom
                                                                        .tenantId
                                                                        .displayName
                                                                }
                                                                )
                                                            </p>
                                                        )}
                                                        {selectedRoom.tenantId
                                                            .phone && (
                                                            <p className="text-sm text-green-700">
                                                                {
                                                                    selectedRoom
                                                                        .tenantId
                                                                        .phone
                                                                }
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                {selectedRoom.tenantId
                                                    .notes && (
                                                    <div className="bg-green-100/50 rounded-lg p-3">
                                                        <p className="text-xs text-green-600 mb-1">
                                                            หมายเหตุผู้เช่า
                                                        </p>
                                                        <p className="text-sm text-green-800">
                                                            {
                                                                selectedRoom
                                                                    .tenantId
                                                                    .notes
                                                            }
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Notes */}
                                        {selectedRoom.notes && (
                                            <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-100">
                                                <p className="text-xs text-zinc-500 font-medium mb-1">
                                                    หมายเหตุ
                                                </p>
                                                <p className="text-sm text-zinc-800">
                                                    {selectedRoom.notes}
                                                </p>
                                            </div>
                                        )}

                                        {/* Action Buttons */}
                                        {selectedRoom.status === 'vacant' && (
                                            <div className="pt-2">
                                                <button
                                                    onClick={() =>
                                                        qrMutation.mutate(
                                                            selectedRoom._id,
                                                        )
                                                    }
                                                    disabled={
                                                        qrMutation.isPending
                                                    }
                                                    className="w-full py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors disabled:bg-zinc-300 shadow-sm"
                                                >
                                                    {qrMutation.isPending
                                                        ? 'กำลังสร้าง...'
                                                        : 'สร้าง QR Code สำหรับผู้เช่า'}
                                                </button>
                                            </div>
                                        )}
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
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                        onClick={() => setShowQRModal(false)}
                    />
                    <div
                        className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-[28px] shadow-2xl"
                        style={{
                            maxHeight: '85vh',
                            animation: 'slideUp 0.3s ease-out',
                        }}
                    >
                        <div className="px-6 py-4 border-b border-zinc-100">
                            <div className="w-10 h-1 bg-zinc-300 rounded-full mx-auto mb-4"></div>
                            <h2 className="text-lg font-bold text-zinc-800 text-center">
                                QR Code ห้อง {selectedRoom.roomNumber}
                            </h2>
                        </div>

                        <div
                            className="p-6 space-y-4 overflow-y-auto"
                            style={{ maxHeight: 'calc(85vh - 100px)' }}
                        >
                            <div className="flex justify-center">
                                <div className="bg-white p-4 rounded-2xl shadow-lg border border-zinc-100">
                                    <img
                                        src={qrCodeData.dataUrl}
                                        alt="QR Code"
                                        className="w-56 h-56"
                                    />
                                </div>
                            </div>

                            <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-4">
                                <p className="text-sm text-zinc-700 font-semibold mb-2">
                                    วิธีใช้งาน:
                                </p>
                                <ol className="text-xs text-zinc-600 space-y-1 list-decimal list-inside">
                                    <li>ให้ผู้เช่าสแกน QR Code นี้</li>
                                    <li>ผู้เช่าต้องเข้าสู่ระบบด้วย LINE</li>
                                    <li>ระบบจะกำหนดห้องให้อัตโนมัติ</li>
                                </ol>
                            </div>

                            <p className="text-xs text-amber-700 text-center font-medium bg-amber-50 py-2.5 px-3 rounded-xl border border-amber-100">
                                QR Code มีอายุ 24 ชั่วโมง
                            </p>

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={handleDownloadQR}
                                    className="py-3 bg-zinc-100 text-zinc-700 font-semibold rounded-xl hover:bg-zinc-200 transition-colors"
                                >
                                    ดาวน์โหลด
                                </button>
                                <button
                                    onClick={handlePrintQR}
                                    className="py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors shadow-sm"
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
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
                        onClick={() => setShowMeterModal(false)}
                    />
                    <div
                        className="fixed inset-x-0 bottom-0 z-[60] bg-white rounded-t-[28px] shadow-2xl"
                        style={{
                            maxHeight: '60vh',
                            animation: 'slideUp 0.3s ease-out',
                        }}
                    >
                        <div
                            className={`px-6 py-4 border-b ${meterType === 'water' ? 'bg-blue-50 border-blue-100' : 'bg-amber-50 border-amber-100'}`}
                        >
                            <div className="w-10 h-1 bg-zinc-300 rounded-full mx-auto mb-4"></div>
                            <h2
                                className={`text-lg font-bold text-center ${meterType === 'water' ? 'text-blue-800' : 'text-amber-800'}`}
                            >
                                จดมิเตอร์{meterType === 'water' ? 'น้ำ' : 'ไฟ'}{' '}
                                - ห้อง {selectedRoom.roomNumber}
                            </h2>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Previous Reading */}
                            <div
                                className={`rounded-xl p-4 border ${meterType === 'water' ? 'bg-blue-50/80 border-blue-100' : 'bg-amber-50/80 border-amber-100'}`}
                            >
                                <p className="text-xs text-zinc-500 font-medium mb-1">
                                    ค่าล่าสุด
                                </p>
                                <p className={`text-2xl font-bold font-mono ${meterType === 'water' ? 'text-blue-700' : 'text-amber-700'}`}>
                                    {meterType === 'water'
                                        ? (getLatestReading(
                                              selectedRoom.waterMeterReadings,
                                          )?.value ?? '-')
                                        : (getLatestReading(
                                              selectedRoom.electricityMeterReadings,
                                          )?.value ?? '-')}
                                </p>
                            </div>

                            {/* New Reading Input */}
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 mb-2">
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
                                    className={`w-full px-4 py-4 text-2xl font-mono border rounded-xl focus:ring-2 ${
                                        meterType === 'water'
                                            ? 'border-blue-200 focus:ring-blue-500/30 focus:border-blue-400'
                                            : 'border-amber-200 focus:ring-amber-500/30 focus:border-amber-400'
                                    }`}
                                    placeholder="0"
                                    autoFocus
                                />
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 mb-2">
                                    หมายเหตุ (ถ้ามี)
                                </label>
                                <input
                                    type="text"
                                    value={meterNotes}
                                    onChange={(e) =>
                                        setMeterNotes(e.target.value)
                                    }
                                    className="w-full px-4 py-3 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-500/30 focus:border-zinc-400"
                                    placeholder="เช่น มิเตอร์ชำรุด, อ่านค่าประมาณ"
                                />
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setShowMeterModal(false)}
                                    className="flex-1 py-3 bg-zinc-100 text-zinc-700 font-semibold rounded-xl hover:bg-zinc-200 transition-colors"
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
                                    className={`flex-1 py-3 text-white font-semibold rounded-xl disabled:bg-zinc-300 shadow-sm ${
                                        meterType === 'water'
                                            ? 'bg-blue-600 hover:bg-blue-700'
                                            : 'bg-amber-600 hover:bg-amber-700'
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
