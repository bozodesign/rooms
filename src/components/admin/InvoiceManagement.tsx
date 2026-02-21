'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatCurrency } from '@/lib/utils'

interface OtherChargeItem {
    description: string
    amount: number
}

interface Invoice {
    _id: string
    roomId: {
        _id: string
        roomNumber: string
        floor: number
    }
    tenantId: {
        _id: string
        displayName: string
        fullName?: string
        pictureUrl?: string
    }
    month: number
    year: number
    waterUnits: number
    electricityUnits: number
    previousWaterReading?: number
    currentWaterReading?: number
    previousElectricityReading?: number
    currentElectricityReading?: number
    rentAmount: number
    waterAmount: number
    electricityAmount: number
    otherCharges: OtherChargeItem[]
    discount?: number
    totalAmount: number
    paymentStatus: 'pending' | 'paid' | 'overdue'
    dueDate: string
    paidAt?: string
}

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
    tenantId?: {
        _id: string
        displayName: string
        fullName?: string
    }
    baseRentPrice: number
    waterRate?: number
    electricityRate?: number
    waterMeterReadings?: MeterReadingHistory[]
    electricityMeterReadings?: MeterReadingHistory[]
}

async function fetchInvoices(
    lineUserId: string,
    month: number,
    year: number,
): Promise<{ invoices: Invoice[] }> {
    const res = await fetch(`/api/admin/invoices?month=${month}&year=${year}`, {
        headers: { 'x-line-userid': lineUserId },
    })
    if (!res.ok) throw new Error('Failed to fetch invoices')
    return res.json()
}

async function fetchRooms(lineUserId: string): Promise<{ rooms: Room[] }> {
    const res = await fetch('/api/admin/rooms', {
        headers: { 'x-line-userid': lineUserId },
    })
    if (!res.ok) throw new Error('Failed to fetch rooms')
    return res.json()
}

async function calculateInvoices(
    lineUserId: string,
    roomIds: string[],
    month: number,
    year: number,
    dueDate: string,
) {
    const res = await fetch('/api/admin/invoices', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-line-userid': lineUserId,
        },
        body: JSON.stringify({ roomIds, month, year, dueDate }),
    })
    if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to calculate invoices')
    }
    return res.json()
}

async function updateInvoice(
    lineUserId: string,
    invoiceId: string,
    data: {
        otherCharges?: OtherChargeItem[]
        paymentStatus?: string
        includeWater?: boolean
        includeElectricity?: boolean
    },
) {
    const res = await fetch(`/api/admin/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'x-line-userid': lineUserId,
        },
        body: JSON.stringify(data),
    })
    if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update invoice')
    }
    return res.json()
}

async function sendInvoices(
    lineUserId: string,
    invoiceIds: string[],
): Promise<{
    success: boolean
    results: {
        sent: number
        failed: number
        errors: { invoiceId: string; error: string }[]
    }
}> {
    const res = await fetch('/api/admin/invoices/send', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-line-userid': lineUserId,
        },
        body: JSON.stringify({ invoiceIds }),
    })
    if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to send invoices')
    }
    return res.json()
}

async function deleteInvoice(lineUserId: string, invoiceId: string) {
    const res = await fetch(`/api/admin/invoices/${invoiceId}`, {
        method: 'DELETE',
        headers: {
            'x-line-userid': lineUserId,
        },
    })
    if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete invoice')
    }
    return res.json()
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
]

export default function InvoiceManagement({
    lineUserId,
}: {
    lineUserId: string
}) {
    const queryClient = useQueryClient()
    const now = new Date()
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
    const [selectedYear, setSelectedYear] = useState(now.getFullYear())
    const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)
    const [otherChargesList, setOtherChargesList] = useState<OtherChargeItem[]>(
        [],
    )
    const [isCalculating, setIsCalculating] = useState(false)
    const [searchRoomNumber, setSearchRoomNumber] = useState('')
    const [meterWarnings, setMeterWarnings] = useState<
        {
            roomNumber: string
            missingWater: boolean
            missingElectricity: boolean
        }[]
    >([])
    const [showMeterWarning, setShowMeterWarning] = useState(false)
    const [editIncludeWater, setEditIncludeWater] = useState(true)
    const [editIncludeElectricity, setEditIncludeElectricity] = useState(true)

    const { data: invoicesData, isLoading: invoicesLoading } = useQuery({
        queryKey: ['invoices', lineUserId, selectedMonth, selectedYear],
        queryFn: () => fetchInvoices(lineUserId, selectedMonth, selectedYear),
    })

    const { data: roomsData } = useQuery({
        queryKey: ['rooms', lineUserId],
        queryFn: () => fetchRooms(lineUserId),
    })

    const calculateMutation = useMutation({
        mutationFn: ({
            roomIds,
            month,
            year,
            dueDate,
        }: {
            roomIds: string[]
            month: number
            year: number
            dueDate: string
        }) => calculateInvoices(lineUserId, roomIds, month, year, dueDate),
        onSuccess: (data: {
            created: number
            failed: number
            errors?: { roomId: string; error: string }[]
        }) => {
            queryClient.invalidateQueries({ queryKey: ['invoices'] })
            setIsCalculating(false)

            if (data.created > 0 && data.failed === 0) {
                alert(`สร้างบิลสำเร็จ ${data.created} รายการ`)
            } else if (data.created > 0 && data.failed > 0) {
                const errorMessages =
                    data.errors?.map((e) => e.error).join(', ') || ''
                alert(
                    `สร้างบิลสำเร็จ ${data.created} รายการ\nข้าม ${data.failed} รายการ (${errorMessages})`,
                )
            } else if (data.failed > 0) {
                const errorMessages =
                    data.errors?.map((e) => e.error).join(', ') || ''
                alert(`ไม่สามารถสร้างบิลได้: ${errorMessages}`)
            }
        },
        onError: (error: Error) => {
            alert(error.message)
            setIsCalculating(false)
        },
    })

    const updateMutation = useMutation({
        mutationFn: ({
            invoiceId,
            data,
        }: {
            invoiceId: string
            data: {
                otherCharges?: OtherChargeItem[]
                paymentStatus?: string
                includeWater?: boolean
                includeElectricity?: boolean
            }
        }) => updateInvoice(lineUserId, invoiceId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invoices'] })
            setEditingInvoice(null)
        },
        onError: (error: Error) => {
            alert(error.message)
        },
    })

    const sendMutation = useMutation({
        mutationFn: (invoiceIds: string[]) =>
            sendInvoices(lineUserId, invoiceIds),
        onSuccess: (data) => {
            if (data.results.sent > 0 && data.results.failed === 0) {
                alert(`ส่งบิลสำเร็จ ${data.results.sent} รายการ`)
            } else if (data.results.sent > 0 && data.results.failed > 0) {
                const errorMessages = data.results.errors
                    .map((e) => e.error)
                    .join('\n')
                alert(
                    `ส่งบิลสำเร็จ ${data.results.sent} รายการ\nล้มเหลว ${data.results.failed} รายการ:\n${errorMessages}`,
                )
            } else if (data.results.failed > 0) {
                const errorMessages = data.results.errors
                    .map((e) => e.error)
                    .join('\n')
                alert(`ส่งบิลล้มเหลว:\n${errorMessages}`)
            }
        },
        onError: (error: Error) => {
            alert('เกิดข้อผิดพลาด: ' + error.message)
        },
    })

    const deleteMutation = useMutation({
        mutationFn: (invoiceId: string) => deleteInvoice(lineUserId, invoiceId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invoices'] })
            setEditingInvoice(null)
            alert('ลบบิลสำเร็จ')
        },
        onError: (error: Error) => {
            alert('เกิดข้อผิดพลาด: ' + error.message)
        },
    })

    const invoices = invoicesData?.invoices || []
    const rooms = roomsData?.rooms || []
    const occupiedRooms = rooms.filter(
        (r) => r.status === 'occupied' && r.tenantId,
    )

    const hasReadingForMonth = (
        readings: MeterReadingHistory[] | undefined,
        month: number,
        year: number,
    ): boolean => {
        if (!readings || readings.length === 0) return false
        return readings.some((reading) => {
            const recordedDate = new Date(reading.recordedAt)
            return (
                recordedDate.getMonth() + 1 === month &&
                recordedDate.getFullYear() === year
            )
        })
    }

    const getRoomsMissingReadings = () => {
        return occupiedRooms
            .map((room) => {
                const missingWater = !hasReadingForMonth(
                    room.waterMeterReadings,
                    selectedMonth,
                    selectedYear,
                )
                const missingElectricity = !hasReadingForMonth(
                    room.electricityMeterReadings,
                    selectedMonth,
                    selectedYear,
                )
                if (missingWater || missingElectricity) {
                    return {
                        roomNumber: room.roomNumber,
                        missingWater,
                        missingElectricity,
                    }
                }
                return null
            })
            .filter(Boolean) as {
            roomNumber: string
            missingWater: boolean
            missingElectricity: boolean
        }[]
    }

    const filteredInvoices = searchRoomNumber
        ? invoices.filter((inv) =>
              inv.roomId?.roomNumber
                  ?.toLowerCase()
                  .includes(searchRoomNumber.toLowerCase()),
          )
        : invoices

    const handleCalculate = () => {
        if (occupiedRooms.length === 0) {
            alert('ไม่มีห้องที่มีผู้เช่า')
            return
        }

        const warnings = getRoomsMissingReadings()
        if (warnings.length > 0) {
            setMeterWarnings(warnings)
            setShowMeterWarning(true)
            return
        }

        proceedWithCalculation()
    }

    const proceedWithCalculation = () => {
        const dueDate = new Date(selectedYear, selectedMonth, 15)

        setShowMeterWarning(false)
        setMeterWarnings([])
        setIsCalculating(true)
        calculateMutation.mutate({
            roomIds: occupiedRooms.map((r) => r._id),
            month: selectedMonth,
            year: selectedYear,
            dueDate: dueDate.toISOString(),
        })
    }

    const handleEditInvoice = (invoice: Invoice) => {
        setEditingInvoice(invoice)
        setOtherChargesList(invoice.otherCharges || [])
        setEditIncludeWater(invoice.waterAmount > 0 || invoice.waterUnits > 0)
        setEditIncludeElectricity(
            invoice.electricityAmount > 0 || invoice.electricityUnits > 0,
        )
    }

    const handleAddOtherCharge = () => {
        setOtherChargesList([
            ...otherChargesList,
            { description: '', amount: 0 },
        ])
    }

    const handleRemoveOtherCharge = (index: number) => {
        setOtherChargesList(otherChargesList.filter((_, i) => i !== index))
    }

    const handleOtherChargeChange = (
        index: number,
        field: 'description' | 'amount',
        value: string | number,
    ) => {
        const updated = [...otherChargesList]
        if (field === 'description') {
            updated[index].description = value as string
        } else {
            updated[index].amount = value as number
        }
        setOtherChargesList(updated)
    }

    const handleSaveInvoice = () => {
        if (!editingInvoice) return

        const validCharges = otherChargesList.filter(
            (item) => item.description.trim() && item.amount !== 0,
        )

        updateMutation.mutate({
            invoiceId: editingInvoice._id,
            data: {
                otherCharges: validCharges,
                includeWater: editIncludeWater,
                includeElectricity: editIncludeElectricity,
            },
        })
    }

    const handleMarkAsPaid = (invoiceId: string) => {
        if (!confirm('ยืนยันว่าได้รับชำระเงินแล้ว?')) return

        updateMutation.mutate({
            invoiceId,
            data: {
                paymentStatus: 'paid',
            },
        })
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'paid':
                return (
                    <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
                        ชำระแล้ว
                    </span>
                )
            case 'overdue':
                return (
                    <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded">
                        เกินกำหนด
                    </span>
                )
            default:
                return (
                    <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 rounded">
                        รอชำระ
                    </span>
                )
        }
    }

    const calculateOtherChargesTotal = (charges: OtherChargeItem[]) => {
        return (charges || []).reduce(
            (sum, item) => sum + (item.amount || 0),
            0,
        )
    }

    return (
        <div className="min-h-screen bg-white pb-24">
            {/* Header */}
            <div className="border-b border-gray-200 sticky top-0 z-10 bg-white">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <h1 className="text-xl font-semibold text-gray-900">
                        จัดการบิล
                    </h1>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
                {/* Month/Year Selector */}
                <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-4">
                        <div className="flex-1">
                            <label className="block text-sm text-gray-600 mb-1">
                                เดือน
                            </label>
                            <select
                                value={selectedMonth}
                                onChange={(e) =>
                                    setSelectedMonth(parseInt(e.target.value))
                                }
                                className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-gray-900 focus:border-gray-900 bg-white"
                            >
                                {MONTHS.map((month, index) => (
                                    <option key={index} value={index + 1}>
                                        {month}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm text-gray-600 mb-1">
                                ปี
                            </label>
                            <select
                                value={selectedYear}
                                onChange={(e) =>
                                    setSelectedYear(parseInt(e.target.value))
                                }
                                className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-gray-900 focus:border-gray-900 bg-white"
                            >
                                {[
                                    now.getFullYear(),
                                    now.getFullYear() + 1,
                                    now.getFullYear() + 2,
                                ].map((year) => (
                                    <option key={year} value={year}>
                                        {year + 543}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <button
                        onClick={handleCalculate}
                        disabled={isCalculating || calculateMutation.isPending}
                        className="mt-4 w-full bg-gray-900 text-white py-3 px-4 rounded-md font-medium hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                        {isCalculating || calculateMutation.isPending ? (
                            <span className="flex items-center justify-center gap-2">
                                <svg
                                    className="animate-spin h-5 w-5"
                                    viewBox="0 0 24 24"
                                >
                                    <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                        fill="none"
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
                        คำนวณบิลสำหรับห้องที่มีผู้เช่า {occupiedRooms.length}{' '}
                        ห้อง
                    </p>
                </div>

                {/* Search */}
                <div className="relative">
                    <input
                        type="text"
                        value={searchRoomNumber}
                        onChange={(e) => setSearchRoomNumber(e.target.value)}
                        placeholder="ค้นหาเลขห้อง..."
                        className="w-full p-3 pl-10 border border-gray-300 rounded-md focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
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
                            strokeWidth={1.5}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                    </svg>
                    {searchRoomNumber && (
                        <button
                            onClick={() => setSearchRoomNumber('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
                                    strokeWidth={1.5}
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Invoices List */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-medium text-gray-900">
                            {MONTHS[selectedMonth - 1]} {selectedYear + 543}
                        </h2>
                        <div className="flex items-center gap-3">
                            {filteredInvoices.length > 0 && (
                                <span className="text-sm text-gray-500">
                                    {filteredInvoices.length} รายการ
                                </span>
                            )}
                            {(() => {
                                const pendingInvoices = filteredInvoices.filter(
                                    (inv) => inv.paymentStatus !== 'paid',
                                )
                                if (pendingInvoices.length === 0) return null
                                return (
                                    <button
                                        onClick={() => {
                                            if (
                                                !confirm(
                                                    `ส่งบิลค้างชำระทั้งหมด ${pendingInvoices.length} รายการ ไปยัง LINE ของผู้เช่า?`,
                                                )
                                            )
                                                return
                                            sendMutation.mutate(
                                                pendingInvoices.map(
                                                    (inv) => inv._id,
                                                ),
                                            )
                                        }}
                                        disabled={sendMutation.isPending}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {sendMutation.isPending ? (
                                            <>
                                                <svg
                                                    className="animate-spin h-4 w-4"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <circle
                                                        className="opacity-25"
                                                        cx="12"
                                                        cy="12"
                                                        r="10"
                                                        stroke="currentColor"
                                                        strokeWidth="4"
                                                        fill="none"
                                                    />
                                                    <path
                                                        className="opacity-75"
                                                        fill="currentColor"
                                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                                    />
                                                </svg>
                                                กำลังส่ง...
                                            </>
                                        ) : (
                                            <>
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
                                                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                                                    />
                                                </svg>
                                                ส่งบิลทั้งหมด
                                            </>
                                        )}
                                    </button>
                                )
                            })()}
                        </div>
                    </div>

                    {invoicesLoading ? (
                        <div className="py-12 text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-900 border-t-transparent mx-auto"></div>
                            <p className="mt-3 text-sm text-gray-500">
                                กำลังโหลด...
                            </p>
                        </div>
                    ) : filteredInvoices.length === 0 ? (
                        <div className="py-12 text-center border border-dashed border-gray-300 rounded-lg">
                            <svg
                                className="w-10 h-10 mx-auto text-gray-300 mb-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1.5}
                                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                            </svg>
                            {searchRoomNumber ? (
                                <p className="text-gray-500">
                                    ไม่พบบิลสำหรับห้อง "{searchRoomNumber}"
                                </p>
                            ) : (
                                <>
                                    <p className="text-gray-500">
                                        ยังไม่มีบิลสำหรับเดือนนี้
                                    </p>
                                    <p className="text-sm text-gray-400 mt-1">
                                        กด "คำนวณค่าห้อง" เพื่อสร้างบิล
                                    </p>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredInvoices.map((invoice) => {
                                const tenantFullName =
                                    invoice.tenantId?.fullName

                                return (
                                    <div
                                        key={invoice._id}
                                        className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                                    >
                                        {/* Header */}
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <p className="text-2xl font-medium text-gray-900">
                                                    ห้อง{' '}
                                                    {invoice.roomId?.roomNumber}
                                                </p>
                                                <p className="text-sm text-gray-500">
                                                    {tenantFullName ||
                                                        invoice.tenantId
                                                            ?.displayName ||
                                                        'ไม่มีข้อมูล'}
                                                </p>
                                            </div>
                                            {getStatusBadge(
                                                invoice.paymentStatus,
                                            )}
                                        </div>

                                        {/* Details */}
                                        <div className="border-t border-gray-100 pt-3 space-y-1.5 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">
                                                    ค่าเช่า
                                                </span>
                                                <span>
                                                    {formatCurrency(
                                                        invoice.rentAmount,
                                                    )}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">
                                                    ค่าน้ำ ({invoice.waterUnits}{' '}
                                                    หน่วย)
                                                </span>
                                                <span>
                                                    {formatCurrency(
                                                        invoice.waterAmount,
                                                    )}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">
                                                    ค่าไฟ (
                                                    {invoice.electricityUnits}{' '}
                                                    หน่วย)
                                                </span>
                                                <span>
                                                    {formatCurrency(
                                                        invoice.electricityAmount,
                                                    )}
                                                </span>
                                            </div>
                                            {invoice.otherCharges?.map(
                                                (charge, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="flex justify-between"
                                                    >
                                                        <span className="text-gray-500">
                                                            {charge.description}
                                                        </span>
                                                        <span>
                                                            {formatCurrency(
                                                                charge.amount,
                                                            )}
                                                        </span>
                                                    </div>
                                                ),
                                            )}
                                            <div className="flex justify-between pt-2 border-t border-gray-100 font-medium">
                                                <span>รวม</span>
                                                <span>
                                                    {formatCurrency(
                                                        invoice.totalAmount,
                                                    )}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="mt-4 flex gap-2">
                                            <button
                                                onClick={() =>
                                                    handleEditInvoice(invoice)
                                                }
                                                className="flex-1 py-2 px-3 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                                            >
                                                แก้ไข
                                            </button>
                                            {invoice.paymentStatus !==
                                                'paid' && (
                                                <>
                                                    <button
                                                        onClick={() => {
                                                            if (
                                                                !confirm(
                                                                    `ส่งบิลห้อง ${invoice.roomId?.roomNumber} ไปยัง LINE ของผู้เช่า?`,
                                                                )
                                                            )
                                                                return
                                                            sendMutation.mutate(
                                                                [invoice._id],
                                                            )
                                                        }}
                                                        disabled={
                                                            sendMutation.isPending
                                                        }
                                                        className="py-2 px-3 text-sm font-medium text-green-700 border border-green-300 rounded-md hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                        title="ส่งบิลทาง LINE"
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
                                                                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                                                            />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            handleMarkAsPaid(
                                                                invoice._id,
                                                            )
                                                        }
                                                        className="flex-1 py-2 px-3 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 transition-colors"
                                                    >
                                                        รับชำระแล้ว
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Edit Modal */}
            {editingInvoice && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
                        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                            <h2 className="font-semibold text-gray-900">
                                แก้ไขบิล - ห้อง{' '}
                                {editingInvoice.roomId?.roomNumber}
                            </h2>
                            <button
                                onClick={() => setEditingInvoice(null)}
                                className="p-1 hover:bg-gray-100 rounded"
                            >
                                <svg
                                    className="w-5 h-5 text-gray-500"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={1.5}
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                </svg>
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            {/* Tenant Info */}
                            <div className="pb-4 border-b border-gray-100">
                                <p className="font-medium text-gray-900">
                                    {editingInvoice.tenantId?.fullName ||
                                        editingInvoice.tenantId?.displayName ||
                                        'ไม่มีข้อมูล'}
                                </p>
                            </div>

                            {/* Invoice Items */}
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">
                                        ค่าเช่า
                                    </span>
                                    <span className="font-medium">
                                        {formatCurrency(
                                            editingInvoice.rentAmount,
                                        )}
                                    </span>
                                </div>

                                <div className="flex justify-between items-center text-sm">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={editIncludeWater}
                                            onChange={(e) =>
                                                setEditIncludeWater(
                                                    e.target.checked,
                                                )
                                            }
                                            className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                                        />
                                        <span
                                            className={
                                                editIncludeWater
                                                    ? 'text-gray-600'
                                                    : 'text-gray-400 line-through'
                                            }
                                        >
                                            ค่าน้ำ ({editingInvoice.waterUnits}{' '}
                                            หน่วย)
                                        </span>
                                    </label>
                                    <span
                                        className={`font-medium ${!editIncludeWater ? 'text-gray-400 line-through' : ''}`}
                                    >
                                        {formatCurrency(
                                            editIncludeWater
                                                ? editingInvoice.waterAmount
                                                : 0,
                                        )}
                                    </span>
                                </div>

                                <div className="flex justify-between items-center text-sm">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={editIncludeElectricity}
                                            onChange={(e) =>
                                                setEditIncludeElectricity(
                                                    e.target.checked,
                                                )
                                            }
                                            className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                                        />
                                        <span
                                            className={
                                                editIncludeElectricity
                                                    ? 'text-gray-600'
                                                    : 'text-gray-400 line-through'
                                            }
                                        >
                                            ค่าไฟ (
                                            {editingInvoice.electricityUnits}{' '}
                                            หน่วย)
                                        </span>
                                    </label>
                                    <span
                                        className={`font-medium ${!editIncludeElectricity ? 'text-gray-400 line-through' : ''}`}
                                    >
                                        {formatCurrency(
                                            editIncludeElectricity
                                                ? editingInvoice.electricityAmount
                                                : 0,
                                        )}
                                    </span>
                                </div>
                            </div>

                            {/* Other Charges */}
                            <div className="pt-3 border-t border-gray-100">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm text-gray-600">
                                        ค่าอื่นๆ
                                    </span>
                                    <button
                                        onClick={handleAddOtherCharge}
                                        className="text-sm text-gray-900 hover:text-gray-700 font-medium"
                                    >
                                        + เพิ่มรายการ
                                    </button>
                                </div>

                                {otherChargesList.length === 0 ? (
                                    <p className="text-sm text-gray-400 text-center py-3">
                                        ไม่มีค่าใช้จ่ายเพิ่มเติม
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {otherChargesList.map(
                                            (charge, index) => (
                                                <div
                                                    key={index}
                                                    className="flex gap-2 items-center"
                                                >
                                                    <input
                                                        type="text"
                                                        value={
                                                            charge.description
                                                        }
                                                        onChange={(e) =>
                                                            handleOtherChargeChange(
                                                                index,
                                                                'description',
                                                                e.target.value,
                                                            )
                                                        }
                                                        placeholder="รายการ"
                                                        className="flex-1 p-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                                                    />
                                                    <input
                                                        type="number"
                                                        value={
                                                            charge.amount || ''
                                                        }
                                                        onChange={(e) =>
                                                            handleOtherChargeChange(
                                                                index,
                                                                'amount',
                                                                parseFloat(
                                                                    e.target
                                                                        .value,
                                                                ) || 0,
                                                            )
                                                        }
                                                        placeholder="0"
                                                        className="w-24 p-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                                                    />
                                                    <button
                                                        onClick={() =>
                                                            handleRemoveOtherCharge(
                                                                index,
                                                            )
                                                        }
                                                        className="p-2 text-gray-400 hover:text-gray-600"
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
                                                                    1.5
                                                                }
                                                                d="M6 18L18 6M6 6l12 12"
                                                            />
                                                        </svg>
                                                    </button>
                                                </div>
                                            ),
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Total */}
                            <div className="pt-3 border-t border-gray-200">
                                <div className="flex justify-between items-center">
                                    <span className="font-medium text-gray-900">
                                        รวมทั้งหมด
                                    </span>
                                    <span className="text-xl font-semibold text-gray-900">
                                        {formatCurrency(
                                            editingInvoice.rentAmount +
                                                (editIncludeWater
                                                    ? editingInvoice.waterAmount
                                                    : 0) +
                                                (editIncludeElectricity
                                                    ? editingInvoice.electricityAmount
                                                    : 0) +
                                                calculateOtherChargesTotal(
                                                    otherChargesList,
                                                ) -
                                                (editingInvoice.discount || 0),
                                        )}
                                    </span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col gap-2 pt-2">
                                <div className="flex gap-3">
                                    {editingInvoice.paymentStatus !==
                                        'paid' && (
                                        <button
                                            onClick={() => {
                                                if (
                                                    confirm(
                                                        `ต้องการลบบิลห้อง ${editingInvoice.roomId?.roomNumber} เดือน ${MONTHS[editingInvoice.month - 1]} ${editingInvoice.year + 543} หรือไม่?`,
                                                    )
                                                ) {
                                                    deleteMutation.mutate(
                                                        editingInvoice._id,
                                                    )
                                                }
                                            }}
                                            disabled={deleteMutation.isPending}
                                            className="w-1/5 py-2.5 px-4 text-red-600 border border-red-300 rounded-md font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
                                        >
                                            {deleteMutation.isPending
                                                ? 'กำลังลบ...'
                                                : 'ลบ'}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setEditingInvoice(null)}
                                        className="w-2/5 flex-1 py-2.5 px-4 text-gray-700 border border-gray-300 rounded-md font-medium hover:bg-gray-50 transition-colors"
                                    >
                                        ยกเลิก
                                    </button>
                                    <button
                                        onClick={handleSaveInvoice}
                                        disabled={updateMutation.isPending}
                                        className="w-2/5 flex-1 py-2.5 px-4 text-white bg-gray-900 rounded-md font-medium hover:bg-gray-800 disabled:bg-gray-400 transition-colors"
                                    >
                                        {updateMutation.isPending
                                            ? 'กำลังบันทึก...'
                                            : 'บันทึก'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Meter Warning Modal */}
            {showMeterWarning && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
                        <div className="p-4 border-b border-gray-200">
                            <h2 className="font-semibold text-gray-900">
                                ห้องยังไม่บันทึกมิเตอร์
                            </h2>
                        </div>

                        <div className="p-4">
                            <p className="text-sm text-gray-600 mb-4">
                                ห้องเหล่านี้ยังไม่มีการบันทึกค่ามิเตอร์ในเดือน{' '}
                                {MONTHS[selectedMonth - 1]} {selectedYear + 543}
                                :
                            </p>

                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {meterWarnings.map((warning, index) => (
                                    <div
                                        key={index}
                                        className="border border-gray-200 rounded-md p-3"
                                    >
                                        <p className="font-medium text-gray-900">
                                            ห้อง {warning.roomNumber}
                                        </p>
                                        <p className="text-sm text-gray-500 mt-0.5">
                                            {warning.missingWater &&
                                            warning.missingElectricity
                                                ? 'ยังไม่บันทึกมิเตอร์น้ำและไฟ'
                                                : warning.missingWater
                                                  ? 'ยังไม่บันทึกมิเตอร์น้ำ'
                                                  : 'ยังไม่บันทึกมิเตอร์ไฟ'}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            <p className="mt-4 text-sm text-gray-500">
                                หากคำนวณบิลตอนนี้
                                ค่าน้ำ/ค่าไฟจะคำนวณจากค่าที่บันทึกล่าสุด
                            </p>

                            <div className="mt-6 flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowMeterWarning(false)
                                        setMeterWarnings([])
                                    }}
                                    className="flex-1 py-2.5 px-4 text-gray-700 border border-gray-300 rounded-md font-medium hover:bg-gray-50 transition-colors"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    onClick={proceedWithCalculation}
                                    className="flex-1 py-2.5 px-4 text-white bg-gray-900 rounded-md font-medium hover:bg-gray-800 transition-colors"
                                >
                                    คำนวณต่อ
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
