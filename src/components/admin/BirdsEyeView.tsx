'use client'

import { formatCurrency } from '@/lib/utils'
import { useState } from 'react'
import useSWR from 'swr'
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip,
    Legend,
    XAxis,
    YAxis,
    CartesianGrid,
    Bar,
    BarChart,
} from 'recharts'
import LoadingScreen from '@/components/LoadingScreen'

interface DashboardInvoice {
    id: string
    roomNumber: string
    floor: number
    tenantName: string
    tenantPhone?: string
    tenantPictureUrl?: string
    month: number
    year: number
    rentAmount: number
    waterAmount: number
    electricityAmount: number
    totalAmount: number
    paymentStatus: 'pending' | 'paid' | 'overdue'
    dueDate: string
    paidAt?: string
}

interface MonthlyUtilityData {
    month: number
    year: number
    waterUnits: number
    electricityUnits: number
    waterAmount: number
    electricityAmount: number
    collectedWaterAmount: number
    collectedElectricityAmount: number
    collectedRentAmount: number
    revenue: number
    invoiceCount: number
}

interface DashboardData {
    invoices: DashboardInvoice[]
    stats: {
        totalRooms: number
        occupiedRooms: number
        vacantRooms: number
        maintenanceRooms: number
        paidInvoices: number
        pendingInvoices: number
        overdueInvoices: number
        totalRevenue: number
        expectedRevenue: number
        collectedWaterAmount: number
        collectedElectricityAmount: number
        collectedRentAmount: number
        expectedWaterAmount: number
        expectedElectricityAmount: number
        expectedRentAmount: number
    }
    monthlyUtilityData: MonthlyUtilityData[]
    currentPeriod: {
        month: number
        year: number
    }
}

const fetcher = async (
    url: string,
    lineUserId: string,
): Promise<DashboardData> => {
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

const COLORS = {
    paid: '#22c55e',
    pending: '#eab308',
    overdue: '#ef4444',
}

const monthNamesShort = [
    '',
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
]

const monthNames = [
    '',
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

type TabType = 'overview' | 'invoices'

export default function BirdsEyeView({ lineUserId }: { lineUserId: string }) {
    const [selectedInvoice, setSelectedInvoice] =
        useState<DashboardInvoice | null>(null)
    const [activeTab, setActiveTab] = useState<TabType>('overview')

    const { data, error, isLoading } = useSWR<DashboardData>(
        ['/api/admin/dashboard', lineUserId] as const,
        ([url, userId]: [string, string]) => fetcher(url, userId),
        {
            refreshInterval: 30000,
            revalidateOnFocus: true,
            revalidateOnReconnect: true,
            dedupingInterval: 2000,
        },
    )

    if (isLoading) {
        return <LoadingScreen />
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-zinc-100">
                <div className="text-center p-6 bg-white rounded-2xl shadow-sm">
                    <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
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
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                        </svg>
                    </div>
                    <p className="text-zinc-800 font-semibold">
                        เกิดข้อผิดพลาด
                    </p>
                    <p className="text-zinc-500 text-sm mt-1">
                        {error.message}
                    </p>
                </div>
            </div>
        )
    }

    if (!data) return null

    const { stats, invoices, currentPeriod, monthlyUtilityData } = data

    // Prepare chart data with formatted month names
    const chartData = monthlyUtilityData.map((item) => ({
        ...item,
        monthLabel: monthNamesShort[item.month],
        monthYearLabel: `${monthNamesShort[item.month]} ${(item.year + 543).toString().slice(-2)}`,
    }))

    // Calculate current month totals
    const currentMonthData = monthlyUtilityData.find(
        (d) => d.month === currentPeriod.month && d.year === currentPeriod.year,
    )

    // Calculate comparison with previous month
    const prevMonthData = monthlyUtilityData[monthlyUtilityData.length - 2]
    const waterChange =
        prevMonthData && currentMonthData
            ? ((currentMonthData.waterUnits - prevMonthData.waterUnits) /
                  (prevMonthData.waterUnits || 1)) *
              100
            : 0
    const electricityChange =
        prevMonthData && currentMonthData
            ? ((currentMonthData.electricityUnits -
                  prevMonthData.electricityUnits) /
                  (prevMonthData.electricityUnits || 1)) *
              100
            : 0

    // Data for pie chart
    const pieData = [
        { name: 'ชำระแล้ว', value: stats.paidInvoices, color: COLORS.paid },
        { name: 'รอชำระ', value: stats.pendingInvoices, color: COLORS.pending },
        {
            name: 'เกินกำหนด',
            value: stats.overdueInvoices,
            color: COLORS.overdue,
        },
    ].filter((d) => d.value > 0)

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'paid':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                            />
                        </svg>
                        ชำระแล้ว
                    </span>
                )
            case 'pending':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                        <svg
                            className="w-3 h-3"
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
                        รอชำระ
                    </span>
                )
            case 'overdue':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                        <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                        </svg>
                        เกินกำหนด
                    </span>
                )
            default:
                return null
        }
    }

    return (
        <div className="min-h-screen bg-zinc-100 pb-24">
            {/* Header */}
            <div className="bg-white border-b border-zinc-200">
                <div className="px-4 py-5">
                    <p className="text-sm text-zinc-500 uppercase tracking-wide">
                        แดชบอร์ด
                    </p>
                    <h1 className="text-2xl font-bold text-zinc-800">
                        {monthNames[currentPeriod.month]}{' '}
                        {currentPeriod.year + 543}
                    </h1>
                </div>

                {/* Tabs */}
                <div className="px-4 flex gap-1">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`px-4 py-2.5 text-sm font-medium rounded-t-xl transition-colors ${
                            activeTab === 'overview'
                                ? 'bg-zinc-100 text-zinc-800'
                                : 'text-zinc-500 hover:text-zinc-700'
                        }`}
                    >
                        ภาพรวม
                    </button>
                    <button
                        onClick={() => setActiveTab('invoices')}
                        className={`px-4 py-2.5 text-sm font-medium rounded-t-xl transition-colors flex items-center gap-2 ${
                            activeTab === 'invoices'
                                ? 'bg-zinc-100 text-zinc-800'
                                : 'text-zinc-500 hover:text-zinc-700'
                        }`}
                    >
                        รายการบิล
                        <span
                            className={`px-2 py-0.5 rounded-full text-xs ${
                                activeTab === 'invoices'
                                    ? 'bg-zinc-200'
                                    : 'bg-zinc-100'
                            }`}
                        >
                            {invoices.length}
                        </span>
                    </button>
                </div>
            </div>

            {activeTab === 'overview' ? (
                <div className="p-4 space-y-4">
                    {/* Quick Stats Row */}
                    <div className="grid grid-cols-4 gap-2">
                        <div className="bg-white rounded-2xl p-3 shadow-sm">
                            <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center mb-2">
                                <svg
                                    className="w-5 h-5 text-blue-600"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                                    />
                                </svg>
                            </div>
                            <p className="text-2xl font-bold text-zinc-800">
                                {stats.occupiedRooms}
                            </p>
                            <p className="text-xs text-zinc-500">มีผู้เช่า</p>
                        </div>
                        <div className="bg-white rounded-2xl p-3 shadow-sm">
                            <div className="w-9 h-9 bg-zinc-100 rounded-xl flex items-center justify-center mb-2">
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
                                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                                    />
                                </svg>
                            </div>
                            <p className="text-2xl font-bold text-zinc-800">
                                {stats.vacantRooms}
                            </p>
                            <p className="text-xs text-zinc-500">ว่าง</p>
                        </div>
                        <div className="bg-white rounded-2xl p-3 shadow-sm">
                            <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center mb-2">
                                <svg
                                    className="w-5 h-5 text-green-600"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M5 13l4 4L19 7"
                                    />
                                </svg>
                            </div>
                            <p className="text-2xl font-bold text-zinc-800">
                                {stats.paidInvoices}
                            </p>
                            <p className="text-xs text-zinc-500">ชำระแล้ว</p>
                        </div>
                        <div className="bg-white rounded-2xl p-3 shadow-sm">
                            <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center mb-2">
                                <svg
                                    className="w-5 h-5 text-amber-600"
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
                            <p className="text-2xl font-bold text-zinc-800">
                                {stats.pendingInvoices + stats.overdueInvoices}
                            </p>
                            <p className="text-xs text-zinc-500">รอชำระ</p>
                        </div>
                    </div>

                    {/* Revenue Card */}
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-100">
                            <h2 className="text-base font-semibold text-zinc-800">
                                รายได้เดือนนี้
                            </h2>
                        </div>
                        <div className="p-4 space-y-4">
                            {/* Total Revenue */}
                            <div>
                                <div className="flex items-end justify-between mb-2">
                                    <div>
                                        <p className="text-sm text-zinc-500">
                                            รวมได้รับแล้ว
                                        </p>
                                        <p className="text-3xl font-bold text-green-600">
                                            {formatCurrency(stats.totalRevenue)}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-zinc-500">
                                            คาดหวัง
                                        </p>
                                        <p className="text-xl font-semibold text-zinc-800">
                                            {formatCurrency(
                                                stats.expectedRevenue,
                                            )}
                                        </p>
                                    </div>
                                </div>
                                <div className="w-full bg-zinc-200 rounded-full h-2.5">
                                    <div
                                        className="bg-green-500 h-2.5 rounded-full transition-all duration-500"
                                        style={{
                                            width: `${stats.expectedRevenue > 0 ? Math.min((stats.totalRevenue / stats.expectedRevenue) * 100, 100) : 0}%`,
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Breakdown by type */}
                            <div className="space-y-4 pt-4 border-t border-zinc-100">
                                {/* Rent */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center">
                                                <svg
                                                    className="w-4 h-4 text-zinc-600"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                                                    />
                                                </svg>
                                            </div>
                                            <span className="text-sm text-zinc-700">
                                                ค่าเช่า
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-base font-semibold text-zinc-800">
                                                {formatCurrency(
                                                    stats.collectedRentAmount,
                                                )}
                                            </span>
                                            <span className="text-sm text-zinc-400 ml-1">
                                                /{' '}
                                                {formatCurrency(
                                                    stats.expectedRentAmount,
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="w-full bg-zinc-100 rounded-full h-2">
                                        <div
                                            className="bg-zinc-500 h-2 rounded-full transition-all duration-500"
                                            style={{
                                                width: `${stats.expectedRentAmount > 0 ? Math.min((stats.collectedRentAmount / stats.expectedRentAmount) * 100, 100) : 0}%`,
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Water */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                                                <svg
                                                    className="w-4 h-4 text-blue-600"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                                                    />
                                                </svg>
                                            </div>
                                            <span className="text-sm text-zinc-700">
                                                ค่าน้ำ
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-base font-semibold text-blue-600">
                                                {formatCurrency(
                                                    stats.collectedWaterAmount,
                                                )}
                                            </span>
                                            <span className="text-sm text-zinc-400 ml-1">
                                                /{' '}
                                                {formatCurrency(
                                                    stats.expectedWaterAmount,
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="w-full bg-blue-50 rounded-full h-2">
                                        <div
                                            className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                                            style={{
                                                width: `${stats.expectedWaterAmount > 0 ? Math.min((stats.collectedWaterAmount / stats.expectedWaterAmount) * 100, 100) : 0}%`,
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Electricity */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
                                                <svg
                                                    className="w-4 h-4 text-amber-600"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M13 10V3L4 14h7v7l9-11h-7z"
                                                    />
                                                </svg>
                                            </div>
                                            <span className="text-sm text-zinc-700">
                                                ค่าไฟ
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-base font-semibold text-amber-600">
                                                {formatCurrency(
                                                    stats.collectedElectricityAmount,
                                                )}
                                            </span>
                                            <span className="text-sm text-zinc-400 ml-1">
                                                /{' '}
                                                {formatCurrency(
                                                    stats.expectedElectricityAmount,
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="w-full bg-amber-50 rounded-full h-2">
                                        <div
                                            className="bg-amber-500 h-2 rounded-full transition-all duration-500"
                                            style={{
                                                width: `${stats.expectedElectricityAmount > 0 ? Math.min((stats.collectedElectricityAmount / stats.expectedElectricityAmount) * 100, 100) : 0}%`,
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Utility Usage Summary Cards */}
                    <div className="grid grid-cols-2 gap-3">
                        {/* Water Summary */}
                        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                            <div className="p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                                        <svg
                                            className="w-5 h-5 text-blue-600"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                                            />
                                        </svg>
                                    </div>
                                    <span className="text-base font-medium text-zinc-700">
                                        น้ำ
                                    </span>
                                </div>
                                <p className="text-2xl font-bold text-zinc-800">
                                    {currentMonthData?.waterUnits.toLocaleString() ||
                                        0}
                                    <span className="text-base font-normal text-zinc-500 ml-1">
                                        หน่วย
                                    </span>
                                </p>
                                <div
                                    className={`flex items-center gap-1 mt-2 text-sm ${waterChange >= 0 ? 'text-red-500' : 'text-green-500'}`}
                                >
                                    <svg
                                        className={`w-4 h-4 ${waterChange < 0 ? 'rotate-180' : ''}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5 15l7-7 7 7"
                                        />
                                    </svg>
                                    <span>
                                        {Math.abs(waterChange).toFixed(1)}%
                                        จากเดือนก่อน
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Electricity Summary */}
                        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                            <div className="p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                                        <svg
                                            className="w-5 h-5 text-amber-600"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M13 10V3L4 14h7v7l9-11h-7z"
                                            />
                                        </svg>
                                    </div>
                                    <span className="text-base font-medium text-zinc-700">
                                        ไฟฟ้า
                                    </span>
                                </div>
                                <p className="text-2xl font-bold text-zinc-800">
                                    {currentMonthData?.electricityUnits.toLocaleString() ||
                                        0}
                                    <span className="text-base font-normal text-zinc-500 ml-1">
                                        หน่วย
                                    </span>
                                </p>
                                <div
                                    className={`flex items-center gap-1 mt-2 text-sm ${electricityChange >= 0 ? 'text-red-500' : 'text-green-500'}`}
                                >
                                    <svg
                                        className={`w-4 h-4 ${electricityChange < 0 ? 'rotate-180' : ''}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5 15l7-7 7 7"
                                        />
                                    </svg>
                                    <span>
                                        {Math.abs(electricityChange).toFixed(1)}
                                        % จากเดือนก่อน
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Utility Usage Bar Chart with Gradient */}
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-100">
                            <h2 className="text-base font-semibold text-zinc-800">
                                สรุปการใช้น้ำ-ไฟ 6 เดือนย้อนหลัง
                            </h2>
                        </div>
                        <div className="p-4">
                            {chartData.length > 0 ? (
                                <div className="h-64">
                                    <ResponsiveContainer
                                        width="100%"
                                        height="100%"
                                    >
                                        <BarChart
                                            data={chartData}
                                            margin={{
                                                top: 10,
                                                right: 10,
                                                left: -15,
                                                bottom: 0,
                                            }}
                                        >
                                            <defs>
                                                <linearGradient
                                                    id="waterBarGradient"
                                                    x1="0"
                                                    y1="0"
                                                    x2="0"
                                                    y2="1"
                                                >
                                                    <stop
                                                        offset="0%"
                                                        stopColor="#60a5fa"
                                                        stopOpacity={1}
                                                    />
                                                    <stop
                                                        offset="100%"
                                                        stopColor="#2563eb"
                                                        stopOpacity={1}
                                                    />
                                                </linearGradient>
                                                <linearGradient
                                                    id="electricityBarGradient"
                                                    x1="0"
                                                    y1="0"
                                                    x2="0"
                                                    y2="1"
                                                >
                                                    <stop
                                                        offset="0%"
                                                        stopColor="#fbbf24"
                                                        stopOpacity={1}
                                                    />
                                                    <stop
                                                        offset="100%"
                                                        stopColor="#d97706"
                                                        stopOpacity={1}
                                                    />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid
                                                strokeDasharray="3 3"
                                                stroke="#e5e7eb"
                                                vertical={false}
                                            />
                                            <XAxis
                                                dataKey="monthYearLabel"
                                                tick={{
                                                    fontSize: 12,
                                                    fill: '#52525b',
                                                }}
                                                tickLine={false}
                                                axisLine={{ stroke: '#e5e7eb' }}
                                            />
                                            <YAxis
                                                tick={{
                                                    fontSize: 12,
                                                    fill: '#52525b',
                                                }}
                                                tickLine={false}
                                                axisLine={false}
                                                tickFormatter={(value) =>
                                                    value.toLocaleString()
                                                }
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    borderRadius: '12px',
                                                    border: '1px solid #e5e7eb',
                                                    boxShadow:
                                                        '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                                    padding: '12px',
                                                    fontSize: '14px',
                                                }}
                                                formatter={(value, name) => {
                                                    const label =
                                                        name === 'waterUnits'
                                                            ? 'น้ำ'
                                                            : 'ไฟฟ้า'
                                                    return [
                                                        `${Number(value ?? 0).toLocaleString()} หน่วย`,
                                                        label,
                                                    ]
                                                }}
                                                labelFormatter={(label) =>
                                                    `เดือน ${label}`
                                                }
                                            />
                                            <Bar
                                                dataKey="waterUnits"
                                                fill="url(#waterBarGradient)"
                                                radius={[6, 6, 0, 0]}
                                                maxBarSize={32}
                                            />
                                            <Bar
                                                dataKey="electricityUnits"
                                                fill="url(#electricityBarGradient)"
                                                radius={[6, 6, 0, 0]}
                                                maxBarSize={32}
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="h-48 flex items-center justify-center text-zinc-400 text-base">
                                    ไม่มีข้อมูล
                                </div>
                            )}
                            {/* Legend */}
                            <div className="flex justify-center gap-6 mt-3 pt-3 border-t border-zinc-100">
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded bg-gradient-to-b from-blue-400 to-blue-600" />
                                    <span className="text-sm text-zinc-600">
                                        น้ำ (หน่วย)
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded bg-gradient-to-b from-amber-400 to-amber-600" />
                                    <span className="text-sm text-zinc-600">
                                        ไฟฟ้า (หน่วย)
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Payment Status Pie Chart */}
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-100">
                            <h2 className="text-base font-semibold text-zinc-800">
                                สถานะการชำระเงิน
                            </h2>
                        </div>
                        <div className="p-4">
                            {pieData.length > 0 ? (
                                <div className="h-52">
                                    <ResponsiveContainer
                                        width="100%"
                                        height="100%"
                                    >
                                        <PieChart>
                                            <Pie
                                                data={pieData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={50}
                                                outerRadius={75}
                                                paddingAngle={3}
                                                dataKey="value"
                                            >
                                                {pieData.map((entry, index) => (
                                                    <Cell
                                                        key={`cell-${index}`}
                                                        fill={entry.color}
                                                    />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                formatter={(value) => [
                                                    `${value ?? 0} รายการ`,
                                                    '',
                                                ]}
                                                contentStyle={{
                                                    borderRadius: '12px',
                                                    border: '1px solid #e5e7eb',
                                                    boxShadow:
                                                        '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                                    fontSize: '14px',
                                                }}
                                            />
                                            <Legend
                                                formatter={(value) => (
                                                    <span className="text-sm text-zinc-600">
                                                        {value}
                                                    </span>
                                                )}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="h-48 flex items-center justify-center text-zinc-400 text-base">
                                    ไม่มีข้อมูลบิล
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                /* Invoice List Tab */
                <div className="p-4">
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                        {invoices.length === 0 ? (
                            <div className="p-8 text-center">
                                <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <svg
                                        className="w-8 h-8 text-zinc-400"
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
                                </div>
                                <p className="text-zinc-500 text-base">
                                    ไม่มีบิลในเดือนนี้
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-zinc-100">
                                {invoices.map((invoice) => (
                                    <div
                                        key={invoice.id}
                                        className="px-4 py-3.5 hover:bg-zinc-50 active:bg-zinc-100 cursor-pointer transition-colors"
                                        onClick={() =>
                                            setSelectedInvoice(invoice)
                                        }
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                {invoice.tenantPictureUrl ? (
                                                    <img
                                                        src={
                                                            invoice.tenantPictureUrl
                                                        }
                                                        alt={invoice.tenantName}
                                                        className="w-11 h-11 rounded-xl object-cover border border-zinc-200"
                                                    />
                                                ) : (
                                                    <div className="w-11 h-11 rounded-xl bg-zinc-200 flex items-center justify-center">
                                                        <span className="text-zinc-600 font-medium text-base">
                                                            {invoice.tenantName.charAt(
                                                                0,
                                                            )}
                                                        </span>
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-base text-zinc-800">
                                                            ห้อง{' '}
                                                            {invoice.roomNumber}
                                                        </span>
                                                        {getStatusBadge(
                                                            invoice.paymentStatus,
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-zinc-500 mt-0.5">
                                                        {invoice.tenantName}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-base text-zinc-800">
                                                    {formatCurrency(
                                                        invoice.totalAmount,
                                                    )}
                                                </p>
                                                <p className="text-xs text-zinc-500 mt-0.5">
                                                    {invoice.paymentStatus ===
                                                        'paid' && invoice.paidAt
                                                        ? `ชำระ ${new Date(invoice.paidAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}`
                                                        : `ครบ ${new Date(invoice.dueDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}`}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Invoice Detail Modal */}
            {selectedInvoice && (
                <>
                    <div
                        className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
                        onClick={() => setSelectedInvoice(null)}
                    />
                    <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-xl max-w-md mx-auto overflow-hidden">
                        <div className="px-5 py-4 bg-zinc-800 text-white">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-xl font-bold">
                                        ห้อง {selectedInvoice.roomNumber}
                                    </h3>
                                    <p className="text-zinc-400 text-sm">
                                        {selectedInvoice.tenantName}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setSelectedInvoice(null)}
                                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
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
                                </button>
                            </div>
                        </div>

                        <div className="p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-zinc-500">สถานะ</span>
                                {getStatusBadge(selectedInvoice.paymentStatus)}
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-zinc-500">
                                    {selectedInvoice.paymentStatus === 'paid'
                                        ? 'ชำระเมื่อ'
                                        : 'ครบกำหนด'}
                                </span>
                                <span className="font-medium text-zinc-800">
                                    {selectedInvoice.paymentStatus === 'paid' &&
                                    selectedInvoice.paidAt
                                        ? new Date(
                                              selectedInvoice.paidAt,
                                          ).toLocaleDateString('th-TH')
                                        : new Date(
                                              selectedInvoice.dueDate,
                                          ).toLocaleDateString('th-TH')}
                                </span>
                            </div>

                            <div className="border-t border-zinc-100 py-0 space-y-0">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-zinc-600 ml-2">
                                            ค่าเช่า
                                        </span>
                                    </div>
                                    <span className="font-medium text-zinc-800">
                                        {formatCurrency(
                                            selectedInvoice.rentAmount,
                                        )}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-zinc-600 ml-2">
                                            ค่าน้ำ
                                        </span>
                                    </div>
                                    <span className="font-medium text-zinc-800">
                                        {formatCurrency(
                                            selectedInvoice.waterAmount,
                                        )}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-zinc-600 ml-2">
                                            ค่าไฟ
                                        </span>
                                    </div>
                                    <span className="font-medium text-zinc-800">
                                        {formatCurrency(
                                            selectedInvoice.electricityAmount,
                                        )}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center pt-3 border-t border-zinc-200">
                                    <span className="font-semibold text-zinc-800">
                                        รวมทั้งหมด
                                    </span>
                                    <span className="font-bold text-lg text-zinc-800">
                                        {formatCurrency(
                                            selectedInvoice.totalAmount,
                                        )}
                                    </span>
                                </div>
                            </div>

                            {selectedInvoice.tenantPhone && (
                                <a
                                    href={`tel:${selectedInvoice.tenantPhone}`}
                                    className="flex items-center justify-center gap-2 w-full bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl font-medium transition-colors"
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
                                            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                                        />
                                    </svg>
                                    โทรหาผู้เช่า
                                </a>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
