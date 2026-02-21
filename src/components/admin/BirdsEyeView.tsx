'use client'

import { formatCurrency } from '@/lib/utils'
import { useState } from 'react'
import useSWR from 'swr'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
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

const COLORS = {
    paid: '#22c55e',      // green-500
    pending: '#eab308',   // yellow-500
    overdue: '#ef4444',   // red-500
}

const monthNames = [
    '', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
]

export default function BirdsEyeView({ lineUserId }: { lineUserId: string }) {
    const [selectedInvoice, setSelectedInvoice] = useState<DashboardInvoice | null>(null)

    const { data, error, isLoading } = useSWR<DashboardData>(
        ['/api/admin/dashboard', lineUserId] as const,
        ([url, userId]: [string, string]) => fetcher(url, userId),
        {
            refreshInterval: 30000,
            revalidateOnFocus: true,
            revalidateOnReconnect: true,
            dedupingInterval: 2000,
        }
    )

    if (isLoading) {
        return <LoadingScreen />
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

    const { stats, invoices, currentPeriod } = data

    // Data for pie chart
    const pieData = [
        { name: 'ชำระแล้ว', value: stats.paidInvoices, color: COLORS.paid },
        { name: 'รอชำระ', value: stats.pendingInvoices, color: COLORS.pending },
        { name: 'เกินกำหนด', value: stats.overdueInvoices, color: COLORS.overdue },
    ].filter(d => d.value > 0)

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'paid':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">ชำระแล้ว</span>
            case 'pending':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">รอชำระ</span>
            case 'overdue':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">เกินกำหนด</span>
            default:
                return null
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-24">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-6 md:py-8">
                <div className="max-w-7xl mx-auto">
                    <h1 className="text-2xl md:text-3xl font-bold">แดชบอร์ด</h1>
                    <p className="text-blue-100 mt-1 text-lg">
                        {monthNames[currentPeriod.month]} {currentPeriod.year + 543}
                    </p>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 -mt-4 space-y-6">
                {/* Room Statistics Cards */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide">มีผู้เช่า</p>
                                <p className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">
                                    {stats.occupiedRooms}<span className="text-lg text-gray-400">/{stats.totalRooms}</span>
                                </p>
                            </div>
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide">ว่าง</p>
                                <p className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">{stats.vacantRooms}</p>
                            </div>
                            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide">ซ่อม</p>
                                <p className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">{stats.maintenanceRooms}</p>
                            </div>
                            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Revenue and Payment Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Revenue Card */}
                    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                        <h3 className="text-sm font-medium text-gray-500 mb-4">รายได้เดือนนี้</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">ได้รับแล้ว</span>
                                <span className="text-xl font-bold text-green-600">{formatCurrency(stats.totalRevenue)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">คาดหวัง</span>
                                <span className="text-xl font-bold text-gray-900">{formatCurrency(stats.expectedRevenue)}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                                <div
                                    className="bg-green-600 h-2.5 rounded-full transition-all duration-500"
                                    style={{ width: `${stats.expectedRevenue > 0 ? (stats.totalRevenue / stats.expectedRevenue) * 100 : 0}%` }}
                                ></div>
                            </div>
                            <p className="text-xs text-gray-500 text-right">
                                {stats.expectedRevenue > 0 ? Math.round((stats.totalRevenue / stats.expectedRevenue) * 100) : 0}% ของรายได้คาดหวัง
                            </p>
                        </div>
                    </div>

                    {/* Payment Status Pie Chart */}
                    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                        <h3 className="text-sm font-medium text-gray-500 mb-2">สถานะการชำระเงิน</h3>
                        {pieData.length > 0 ? (
                            <div className="h-48">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={pieData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={40}
                                            outerRadius={70}
                                            paddingAngle={2}
                                            dataKey="value"
                                        >
                                            {pieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            formatter={(value) => [`${value ?? 0} รายการ`, '']}
                                            contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                                        />
                                        <Legend
                                            formatter={(value) => <span className="text-sm text-gray-600">{value}</span>}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="h-48 flex items-center justify-center text-gray-400">
                                ไม่มีข้อมูลบิล
                            </div>
                        )}
                    </div>
                </div>

                {/* Invoice Summary Stats */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                        <p className="text-2xl md:text-3xl font-bold text-green-700">{stats.paidInvoices}</p>
                        <p className="text-xs text-green-600 mt-1">ชำระแล้ว</p>
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
                        <p className="text-2xl md:text-3xl font-bold text-yellow-700">{stats.pendingInvoices}</p>
                        <p className="text-xs text-yellow-600 mt-1">รอชำระ</p>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                        <p className="text-2xl md:text-3xl font-bold text-red-700">{stats.overdueInvoices}</p>
                        <p className="text-xs text-red-600 mt-1">เกินกำหนด</p>
                    </div>
                </div>

                {/* Invoice List */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-4 py-4 border-b border-gray-100">
                        <h2 className="text-lg font-semibold text-gray-900">รายการบิล</h2>
                        <p className="text-sm text-gray-500">{invoices.length} รายการ</p>
                    </div>

                    {invoices.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            <svg className="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <p>ไม่มีบิลในเดือนนี้</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {invoices.map((invoice) => (
                                <div
                                    key={invoice.id}
                                    className="px-4 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
                                    onClick={() => setSelectedInvoice(invoice)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            {invoice.tenantPictureUrl ? (
                                                <img
                                                    src={invoice.tenantPictureUrl}
                                                    alt={invoice.tenantName}
                                                    className="w-10 h-10 rounded-full object-cover border border-gray-200"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                                                    <span className="text-gray-600 font-medium text-sm">
                                                        {invoice.tenantName.charAt(0)}
                                                    </span>
                                                </div>
                                            )}
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-gray-900">ห้อง {invoice.roomNumber}</span>
                                                    {getStatusBadge(invoice.paymentStatus)}
                                                </div>
                                                <p className="text-sm text-gray-500">{invoice.tenantName}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-gray-900">{formatCurrency(invoice.totalAmount)}</p>
                                            <p className="text-xs text-gray-500">
                                                {invoice.paymentStatus === 'paid' && invoice.paidAt
                                                    ? `ชำระ ${new Date(invoice.paidAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}`
                                                    : `ครบ ${new Date(invoice.dueDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}`
                                                }
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Invoice Detail Modal */}
            {selectedInvoice && (
                <>
                    <div
                        className="fixed inset-0 bg-black bg-opacity-50 z-50"
                        onClick={() => setSelectedInvoice(null)}
                    />
                    <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-xl max-w-md mx-auto overflow-hidden">
                        <div className={`px-5 py-4 ${
                            selectedInvoice.paymentStatus === 'paid' ? 'bg-green-600' :
                            selectedInvoice.paymentStatus === 'overdue' ? 'bg-red-600' : 'bg-yellow-500'
                        } text-white`}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-xl font-bold">ห้อง {selectedInvoice.roomNumber}</h3>
                                    <p className="text-white text-opacity-80">{selectedInvoice.tenantName}</p>
                                </div>
                                <button
                                    onClick={() => setSelectedInvoice(null)}
                                    className="text-white text-opacity-80 hover:text-opacity-100"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div className="p-5 space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-gray-500">สถานะ</p>
                                    <p className="font-medium mt-1">{getStatusBadge(selectedInvoice.paymentStatus)}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500">
                                        {selectedInvoice.paymentStatus === 'paid' ? 'ชำระเมื่อ' : 'ครบกำหนด'}
                                    </p>
                                    <p className="font-medium mt-1">
                                        {selectedInvoice.paymentStatus === 'paid' && selectedInvoice.paidAt
                                            ? new Date(selectedInvoice.paidAt).toLocaleDateString('th-TH')
                                            : new Date(selectedInvoice.dueDate).toLocaleDateString('th-TH')
                                        }
                                    </p>
                                </div>
                            </div>

                            <div className="border-t border-gray-100 pt-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">ค่าเช่า</span>
                                    <span className="font-medium">{formatCurrency(selectedInvoice.rentAmount)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">ค่าน้ำ</span>
                                    <span className="font-medium">{formatCurrency(selectedInvoice.waterAmount)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">ค่าไฟ</span>
                                    <span className="font-medium">{formatCurrency(selectedInvoice.electricityAmount)}</span>
                                </div>
                                <div className="flex justify-between text-base font-bold border-t border-gray-100 pt-2 mt-2">
                                    <span>รวมทั้งหมด</span>
                                    <span className="text-blue-600">{formatCurrency(selectedInvoice.totalAmount)}</span>
                                </div>
                            </div>

                            {selectedInvoice.tenantPhone && (
                                <a
                                    href={`tel:${selectedInvoice.tenantPhone}`}
                                    className="block w-full bg-blue-600 hover:bg-blue-700 text-white text-center py-3 rounded-lg font-medium transition-colors"
                                >
                                    โทรหาผู้เช่า ({selectedInvoice.tenantPhone})
                                </a>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
