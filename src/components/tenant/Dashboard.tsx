'use client'

import { useQuery } from '@tanstack/react-query'
import {
    formatCurrency,
    formatDate,
    getPaymentStatusLabel,
} from '@/lib/utils'
import LoadingScreen from '@/components/LoadingScreen'
import Image from 'next/image'

interface Invoice {
    id: string
    month: number
    year: number
    rentAmount: number
    waterAmount: number
    electricityAmount: number
    waterUnits: number
    electricityUnits: number
    otherCharges: number
    discount: number
    totalAmount: number
    paymentStatus: 'pending' | 'paid' | 'overdue'
    dueDate: string
    paidAt?: string
    roomNumber: string
}

interface UserInfo {
    displayName: string
    pictureUrl?: string
    roomNumber?: string
}

async function fetchCurrentInvoice(
    lineUserId: string,
): Promise<Invoice | null> {
    const res = await fetch('/api/tenant/invoice/current', {
        headers: {
            'x-line-userid': lineUserId,
        },
    })

    if (!res.ok) {
        if (res.status === 404) return null
        throw new Error('Failed to fetch invoice')
    }

    const data = await res.json()
    return data.invoice
}

async function fetchInvoiceHistory(lineUserId: string): Promise<Invoice[]> {
    const res = await fetch('/api/tenant/invoice/history', {
        headers: {
            'x-line-userid': lineUserId,
        },
    })

    if (!res.ok) {
        throw new Error('Failed to fetch invoice history')
    }

    const data = await res.json()
    return data.invoices
}

async function fetchUserInfo(lineUserId: string): Promise<UserInfo | null> {
    const res = await fetch('/api/tenant/profile', {
        headers: {
            'x-line-userid': lineUserId,
        },
    })

    if (!res.ok) return null
    const data = await res.json()
    return data.user
}

const thaiMonths = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
]

export default function TenantDashboard({
    lineUserId,
}: {
    lineUserId: string
}) {
    const { data: currentInvoice, isLoading: loadingCurrent } = useQuery({
        queryKey: ['current-invoice', lineUserId],
        queryFn: () => fetchCurrentInvoice(lineUserId),
    })

    const { data: history, isLoading: loadingHistory } = useQuery({
        queryKey: ['invoice-history', lineUserId],
        queryFn: () => fetchInvoiceHistory(lineUserId),
    })

    const { data: userInfo } = useQuery({
        queryKey: ['user-info', lineUserId],
        queryFn: () => fetchUserInfo(lineUserId),
    })

    if (loadingCurrent) {
        return <LoadingScreen />
    }

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'paid':
                return 'bg-green-100 text-green-700 border-green-200'
            case 'overdue':
                return 'bg-red-100 text-red-700 border-red-200'
            default:
                return 'bg-amber-100 text-amber-700 border-amber-200'
        }
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'paid':
                return (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                )
            case 'overdue':
                return (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                )
            default:
                return (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                )
        }
    }

    return (
        <div className="min-h-screen bg-zinc-100">
            {/* Header */}
            <div className="bg-white border-b border-zinc-200">
                <div className="px-4 py-4">
                    <div className="flex items-center gap-3">
                        {userInfo?.pictureUrl ? (
                            <Image
                                src={userInfo.pictureUrl}
                                alt={userInfo.displayName || 'User'}
                                width={48}
                                height={48}
                                className="rounded-full"
                            />
                        ) : (
                            <div className="w-12 h-12 bg-zinc-200 rounded-full flex items-center justify-center">
                                <svg className="w-6 h-6 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                        )}
                        <div className="flex-1">
                            <h1 className="text-lg font-semibold text-zinc-800">
                                {userInfo?.displayName || 'ผู้เช่า'}
                            </h1>
                            {currentInvoice && (
                                <p className="text-sm text-zinc-500">ห้อง {currentInvoice.roomNumber}</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-4 space-y-4 pb-24">
                {/* Current Invoice Card */}
                {currentInvoice ? (
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                        {/* Invoice Header */}
                        <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-100 flex items-center justify-between">
                            <div>
                                <p className="text-xs text-zinc-500 font-medium">บิลประจำเดือน</p>
                                <p className="text-base font-semibold text-zinc-800">
                                    {thaiMonths[currentInvoice.month - 1]} {currentInvoice.year + 543}
                                </p>
                            </div>
                            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusStyle(currentInvoice.paymentStatus)}`}>
                                {getStatusIcon(currentInvoice.paymentStatus)}
                                {getPaymentStatusLabel(currentInvoice.paymentStatus)}
                            </div>
                        </div>

                        {/* Total Amount */}
                        <div className="px-4 py-5 text-center border-b border-zinc-100">
                            <p className="text-xs text-zinc-500 mb-1">ยอดที่ต้องชำระ</p>
                            <p className="text-3xl font-bold text-zinc-800">
                                {formatCurrency(currentInvoice.totalAmount)}
                            </p>
                            {currentInvoice.paymentStatus !== 'paid' && (
                                <p className="text-xs text-zinc-500 mt-2">
                                    กำหนดชำระ {formatDate(currentInvoice.dueDate)}
                                </p>
                            )}
                        </div>

                        {/* Breakdown */}
                        <div className="px-4 py-3 space-y-2">
                            <div className="flex justify-between items-center py-1.5">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 bg-zinc-100 rounded-lg flex items-center justify-center">
                                        <svg className="w-4 h-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                        </svg>
                                    </div>
                                    <span className="text-sm text-zinc-600">ค่าเช่าห้อง</span>
                                </div>
                                <span className="text-sm font-medium text-zinc-800">{formatCurrency(currentInvoice.rentAmount)}</span>
                            </div>

                            <div className="flex justify-between items-center py-1.5">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
                                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <span className="text-sm text-zinc-600">ค่าน้ำ</span>
                                        <span className="text-xs text-zinc-400 ml-1">({currentInvoice.waterUnits} หน่วย)</span>
                                    </div>
                                </div>
                                <span className="text-sm font-medium text-zinc-800">{formatCurrency(currentInvoice.waterAmount)}</span>
                            </div>

                            <div className="flex justify-between items-center py-1.5">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 bg-amber-50 rounded-lg flex items-center justify-center">
                                        <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <span className="text-sm text-zinc-600">ค่าไฟ</span>
                                        <span className="text-xs text-zinc-400 ml-1">({currentInvoice.electricityUnits} หน่วย)</span>
                                    </div>
                                </div>
                                <span className="text-sm font-medium text-zinc-800">{formatCurrency(currentInvoice.electricityAmount)}</span>
                            </div>

                            {currentInvoice.otherCharges > 0 && (
                                <div className="flex justify-between items-center py-1.5">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 bg-zinc-100 rounded-lg flex items-center justify-center">
                                            <svg className="w-4 h-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                            </svg>
                                        </div>
                                        <span className="text-sm text-zinc-600">ค่าใช้จ่ายอื่นๆ</span>
                                    </div>
                                    <span className="text-sm font-medium text-zinc-800">{formatCurrency(currentInvoice.otherCharges)}</span>
                                </div>
                            )}

                            {currentInvoice.discount > 0 && (
                                <div className="flex justify-between items-center py-1.5">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 bg-green-50 rounded-lg flex items-center justify-center">
                                            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                                            </svg>
                                        </div>
                                        <span className="text-sm text-green-600">ส่วนลด</span>
                                    </div>
                                    <span className="text-sm font-medium text-green-600">-{formatCurrency(currentInvoice.discount)}</span>
                                </div>
                            )}
                        </div>

                        {/* Action Button */}
                        {currentInvoice.paymentStatus !== 'paid' ? (
                            <div className="p-4 pt-2">
                                <button
                                    onClick={() => window.location.href = `/tenant/payment/${currentInvoice.id}`}
                                    className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors shadow-sm"
                                >
                                    ชำระเงิน
                                </button>
                            </div>
                        ) : (
                            <div className="p-4 pt-2">
                                <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
                                    <div className="flex items-center justify-center gap-2 text-green-700">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span className="font-medium">ชำระเงินเรียบร้อยแล้ว</span>
                                    </div>
                                    {currentInvoice.paidAt && (
                                        <p className="text-xs text-green-600 mt-1">
                                            {formatDate(currentInvoice.paidAt)}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
                        <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <p className="text-zinc-600 font-medium">ยังไม่มีบิลสำหรับเดือนนี้</p>
                        <p className="text-zinc-400 text-sm mt-1">บิลจะแสดงเมื่อผู้ดูแลสร้างบิล</p>
                    </div>
                )}

                {/* Invoice History */}
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-zinc-100">
                        <h2 className="text-base font-semibold text-zinc-800">ประวัติการชำระ</h2>
                    </div>

                    {loadingHistory ? (
                        <div className="p-8 text-center">
                            <Image
                                src="/img/loadnganimate.svg"
                                alt="Loading"
                                width={40}
                                height={40}
                                className="mx-auto"
                            />
                        </div>
                    ) : history && history.length > 0 ? (
                        <div className="divide-y divide-zinc-100">
                            {history.map((invoice) => (
                                <button
                                    key={invoice.id}
                                    onClick={() => window.location.href = `/tenant/invoice/${invoice.id}`}
                                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-50 transition-colors text-left"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                            invoice.paymentStatus === 'paid' ? 'bg-green-100' :
                                            invoice.paymentStatus === 'overdue' ? 'bg-red-100' : 'bg-amber-100'
                                        }`}>
                                            <span className={`text-xs font-bold ${
                                                invoice.paymentStatus === 'paid' ? 'text-green-700' :
                                                invoice.paymentStatus === 'overdue' ? 'text-red-700' : 'text-amber-700'
                                            }`}>
                                                {thaiMonths[invoice.month - 1]}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-zinc-800">
                                                {thaiMonths[invoice.month - 1]} {invoice.year + 543}
                                            </p>
                                            <p className="text-xs text-zinc-500">ห้อง {invoice.roomNumber}</p>
                                        </div>
                                    </div>
                                    <div className="text-right flex items-center gap-2">
                                        <div>
                                            <p className="text-sm font-semibold text-zinc-800">
                                                {formatCurrency(invoice.totalAmount)}
                                            </p>
                                            <p className={`text-[10px] font-medium ${
                                                invoice.paymentStatus === 'paid' ? 'text-green-600' :
                                                invoice.paymentStatus === 'overdue' ? 'text-red-600' : 'text-amber-600'
                                            }`}>
                                                {getPaymentStatusLabel(invoice.paymentStatus)}
                                            </p>
                                        </div>
                                        <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="p-8 text-center">
                            <p className="text-zinc-500 text-sm">ยังไม่มีประวัติการชำระ</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
