'use client'

import { useQuery } from '@tanstack/react-query'
import { formatCurrency, formatDate, getPaymentStatusLabel } from '@/lib/utils'
import LoadingScreen from '@/components/LoadingScreen'

interface OtherChargeItem {
    description: string
    amount: number
}

interface Invoice {
    id: string
    month: number
    year: number
    rentAmount: number
    waterAmount: number
    electricityAmount: number
    waterUnits: number
    electricityUnits: number
    previousWaterReading?: number
    previousElectricityReading?: number
    currentWaterReading?: number
    currentElectricityReading?: number
    otherCharges: OtherChargeItem[]
    otherChargesTotal: number
    discount: number
    totalAmount: number
    paymentStatus: 'pending' | 'paid' | 'overdue'
    dueDate: string
    paidAt?: string
    paymentMethod?: string
    paymentSlipUrl?: string
    paymentNote?: string
    roomNumber: string
    createdAt: string
}

async function fetchInvoice(invoiceId: string, lineUserId: string): Promise<Invoice> {
    const res = await fetch(`/api/tenant/invoice/${invoiceId}`, {
        headers: {
            'x-line-userid': lineUserId,
        },
    })

    if (!res.ok) {
        throw new Error('Failed to fetch invoice')
    }

    const data = await res.json()
    return data.invoice
}

const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
]

const thaiMonthsShort = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
]

export default function InvoiceDetail({
    invoiceId,
    lineUserId,
}: {
    invoiceId: string
    lineUserId: string
}) {
    const { data: invoice, isLoading, error } = useQuery({
        queryKey: ['invoice-detail', invoiceId],
        queryFn: () => fetchInvoice(invoiceId, lineUserId),
    })

    if (isLoading) {
        return <LoadingScreen />
    }

    if (error || !invoice) {
        return (
            <div className="min-h-screen bg-zinc-100 flex items-center justify-center">
                <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                    <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <p className="text-zinc-800 font-semibold mb-2">ไม่พบบิล</p>
                    <p className="text-zinc-500 text-sm mb-4">ไม่พบข้อมูลบิลที่ต้องการ</p>
                    <button
                        onClick={() => window.location.href = '/tenant/dashboard'}
                        className="px-6 py-2 bg-zinc-800 text-white rounded-xl text-sm font-medium"
                    >
                        กลับหน้าหลัก
                    </button>
                </div>
            </div>
        )
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

    const getPaymentMethodLabel = (method?: string) => {
        switch (method) {
            case 'promptpay':
                return 'พร้อมเพย์'
            case 'cash':
                return 'เงินสด'
            case 'transfer':
                return 'โอนเงิน'
            default:
                return '-'
        }
    }

    return (
        <div className="min-h-screen bg-zinc-100">
            {/* Header */}
            <div className="bg-white border-b border-zinc-200 sticky top-0 z-10">
                <div className="px-4 py-3 flex items-center gap-3">
                    <button
                        onClick={() => window.location.href = '/tenant/dashboard'}
                        className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-zinc-100 transition-colors"
                    >
                        <svg className="w-5 h-5 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div className="flex-1">
                        <h1 className="text-base font-semibold text-zinc-800">รายละเอียดบิล</h1>
                        <p className="text-xs text-zinc-500">ห้อง {invoice.roomNumber}</p>
                    </div>
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusStyle(invoice.paymentStatus)}`}>
                        {getStatusIcon(invoice.paymentStatus)}
                        {getPaymentStatusLabel(invoice.paymentStatus)}
                    </div>
                </div>
            </div>

            <div className="p-4 space-y-4 pb-32">
                {/* Month Header Card */}
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-4 py-5 text-center bg-gradient-to-br from-zinc-800 to-zinc-900 text-white">
                        <p className="text-xs text-zinc-400 mb-1">บิลประจำเดือน</p>
                        <p className="text-xl font-bold">
                            {thaiMonths[invoice.month - 1]} {invoice.year + 543}
                        </p>
                    </div>
                    <div className="px-4 py-5 text-center border-b border-zinc-100">
                        <p className="text-xs text-zinc-500 mb-1">ยอดรวมทั้งหมด</p>
                        <p className="text-3xl font-bold text-zinc-800">
                            {formatCurrency(invoice.totalAmount)}
                        </p>
                    </div>
                </div>

                {/* Breakdown Card */}
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-100">
                        <h2 className="text-sm font-semibold text-zinc-800">รายละเอียดค่าใช้จ่าย</h2>
                    </div>
                    <div className="px-4 py-3 space-y-3">
                        {/* Rent */}
                        <div className="flex justify-between items-center py-2">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-zinc-100 rounded-xl flex items-center justify-center">
                                    <svg className="w-5 h-5 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                    </svg>
                                </div>
                                <span className="text-sm text-zinc-700">ค่าเช่าห้อง</span>
                            </div>
                            <span className="text-sm font-semibold text-zinc-800">{formatCurrency(invoice.rentAmount)}</span>
                        </div>

                        {/* Water */}
                        <div className="flex justify-between items-center py-2 border-t border-zinc-100">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
                                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                    </svg>
                                </div>
                                <div>
                                    <span className="text-sm text-zinc-700">ค่าน้ำ</span>
                                    <p className="text-xs text-zinc-400">{invoice.waterUnits} หน่วย</p>
                                </div>
                            </div>
                            <span className="text-sm font-semibold text-zinc-800">{formatCurrency(invoice.waterAmount)}</span>
                        </div>

                        {/* Water reading details */}
                        {(invoice.previousWaterReading !== undefined && invoice.currentWaterReading !== undefined) && (
                            <div className="ml-12 pl-3 border-l-2 border-blue-100">
                                <div className="flex justify-between text-xs text-zinc-500">
                                    <span>เลขก่อนหน้า</span>
                                    <span>{invoice.previousWaterReading}</span>
                                </div>
                                <div className="flex justify-between text-xs text-zinc-500">
                                    <span>เลขปัจจุบัน</span>
                                    <span>{invoice.currentWaterReading}</span>
                                </div>
                            </div>
                        )}

                        {/* Electricity */}
                        <div className="flex justify-between items-center py-2 border-t border-zinc-100">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center">
                                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </div>
                                <div>
                                    <span className="text-sm text-zinc-700">ค่าไฟ</span>
                                    <p className="text-xs text-zinc-400">{invoice.electricityUnits} หน่วย</p>
                                </div>
                            </div>
                            <span className="text-sm font-semibold text-zinc-800">{formatCurrency(invoice.electricityAmount)}</span>
                        </div>

                        {/* Electricity reading details */}
                        {(invoice.previousElectricityReading !== undefined && invoice.currentElectricityReading !== undefined) && (
                            <div className="ml-12 pl-3 border-l-2 border-amber-100">
                                <div className="flex justify-between text-xs text-zinc-500">
                                    <span>เลขก่อนหน้า</span>
                                    <span>{invoice.previousElectricityReading}</span>
                                </div>
                                <div className="flex justify-between text-xs text-zinc-500">
                                    <span>เลขปัจจุบัน</span>
                                    <span>{invoice.currentElectricityReading}</span>
                                </div>
                            </div>
                        )}

                        {/* Other Charges */}
                        {invoice.otherCharges && invoice.otherCharges.length > 0 && (
                            <>
                                <div className="flex justify-between items-center py-2 border-t border-zinc-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center">
                                            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                            </svg>
                                        </div>
                                        <span className="text-sm text-zinc-700">ค่าใช้จ่ายอื่นๆ</span>
                                    </div>
                                    <span className="text-sm font-semibold text-zinc-800">{formatCurrency(invoice.otherChargesTotal)}</span>
                                </div>
                                <div className="ml-12 pl-3 border-l-2 border-purple-100 space-y-1">
                                    {invoice.otherCharges.map((item, index) => (
                                        <div key={index} className="flex justify-between text-xs text-zinc-500">
                                            <span>{item.description}</span>
                                            <span>{formatCurrency(item.amount)}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {/* Discount */}
                        {invoice.discount > 0 && (
                            <div className="flex justify-between items-center py-2 border-t border-zinc-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center">
                                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                                        </svg>
                                    </div>
                                    <span className="text-sm text-green-600">ส่วนลด</span>
                                </div>
                                <span className="text-sm font-semibold text-green-600">-{formatCurrency(invoice.discount)}</span>
                            </div>
                        )}

                        {/* Total */}
                        <div className="flex justify-between items-center py-3 border-t-2 border-zinc-200 mt-2">
                            <span className="text-base font-semibold text-zinc-800">ยอดรวมสุทธิ</span>
                            <span className="text-lg font-bold text-zinc-800">{formatCurrency(invoice.totalAmount)}</span>
                        </div>
                    </div>
                </div>

                {/* Payment Info Card */}
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-100">
                        <h2 className="text-sm font-semibold text-zinc-800">ข้อมูลการชำระเงิน</h2>
                    </div>
                    <div className="px-4 py-3 space-y-3">
                        <div className="flex justify-between items-center py-2">
                            <span className="text-sm text-zinc-500">กำหนดชำระ</span>
                            <span className="text-sm font-medium text-zinc-800">{formatDate(invoice.dueDate)}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-t border-zinc-100">
                            <span className="text-sm text-zinc-500">สถานะ</span>
                            <span className={`text-sm font-medium ${
                                invoice.paymentStatus === 'paid' ? 'text-green-600' :
                                invoice.paymentStatus === 'overdue' ? 'text-red-600' : 'text-amber-600'
                            }`}>
                                {getPaymentStatusLabel(invoice.paymentStatus)}
                            </span>
                        </div>
                        {invoice.paidAt && (
                            <div className="flex justify-between items-center py-2 border-t border-zinc-100">
                                <span className="text-sm text-zinc-500">ชำระเมื่อ</span>
                                <span className="text-sm font-medium text-zinc-800">{formatDate(invoice.paidAt)}</span>
                            </div>
                        )}
                        {invoice.paymentMethod && (
                            <div className="flex justify-between items-center py-2 border-t border-zinc-100">
                                <span className="text-sm text-zinc-500">วิธีชำระ</span>
                                <span className="text-sm font-medium text-zinc-800">{getPaymentMethodLabel(invoice.paymentMethod)}</span>
                            </div>
                        )}
                        {invoice.paymentNote && (
                            <div className="py-2 border-t border-zinc-100">
                                <span className="text-sm text-zinc-500">หมายเหตุ</span>
                                <p className="text-sm text-zinc-800 mt-1">{invoice.paymentNote}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Payment Slip */}
                {invoice.paymentSlipUrl && (
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-100">
                            <h2 className="text-sm font-semibold text-zinc-800">สลิปการโอนเงิน</h2>
                        </div>
                        <div className="p-4">
                            <img
                                src={invoice.paymentSlipUrl}
                                alt="Payment Slip"
                                className="w-full rounded-xl border border-zinc-200"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Action */}
            {invoice.paymentStatus !== 'paid' && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 p-4">
                    <button
                        onClick={() => window.location.href = `/tenant/payment/${invoice.id}`}
                        className="w-full py-3.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors shadow-sm"
                    >
                        ชำระเงิน
                    </button>
                </div>
            )}
        </div>
    )
}
