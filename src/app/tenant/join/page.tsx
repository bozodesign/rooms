'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useLiff } from '@/providers/LiffProvider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import LoadingScreen from '@/components/LoadingScreen'

function JoinRoomContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const { liff, profile, isLoading } = useLiff()
    const [status, setStatus] = useState<
        'loading' | 'success' | 'error' | 'need_friend'
    >('loading')
    const [message, setMessage] = useState('')
    const [roomNumber, setRoomNumber] = useState<string | null>(null)
    const [isFriend, setIsFriend] = useState<boolean | null>(null)
    const [checkingFriendship, setCheckingFriendship] = useState(true)
    const [roomAssigned, setRoomAssigned] = useState(false)

    const lineOaId = process.env.NEXT_PUBLIC_LINE_OA_ID || '@017acmke'
    const addFriendUrl = `https://line.me/R/ti/p/${lineOaId}`

    // Check friendship status first
    useEffect(() => {
        if (isLoading || !profile || !liff) {
            return
        }

        const checkFriendship = async () => {
            try {
                const friendship = await liff.getFriendship()
                setIsFriend(friendship.friendFlag)
                setCheckingFriendship(false)

                if (!friendship.friendFlag) {
                    setStatus('need_friend')
                }
            } catch (error) {
                console.error('Error checking friendship:', error)
                // If we can't check friendship, assume not friend
                setIsFriend(false)
                setCheckingFriendship(false)
                setStatus('need_friend')
            }
        }

        checkFriendship()
    }, [profile, isLoading, liff])

    useEffect(() => {
        // Don't run if already assigned
        if (roomAssigned) {
            return
        }

        const token = searchParams.get('token')

        if (!token) {
            setStatus('error')
            setMessage('ไม่พบ Token การเข้าห้อง')
            return
        }

        // Wait for LIFF to be ready and profile to be loaded
        if (isLoading || !profile) {
            return
        }

        // Wait for friendship check
        if (checkingFriendship) {
            return
        }

        // If not friend, don't proceed
        if (!isFriend) {
            setStatus('need_friend')
            return
        }

        // Call API to assign room
        const assignRoom = async () => {
            setStatus('loading')
            try {
                const response = await fetch('/api/tenant/join', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-line-userid': profile.userId,
                    },
                    body: JSON.stringify({ token }),
                })

                const data = await response.json()

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to assign room')
                }

                setRoomAssigned(true)
                setStatus('success')
                setMessage(data.message)
                setRoomNumber(data.roomNumber)
            } catch (error: any) {
                setStatus('error')
                setMessage(error.message || 'เกิดข้อผิดพลาดในการเข้าห้อง')
            }
        }

        assignRoom()
    }, [searchParams, profile, isLoading, isFriend, checkingFriendship, roomAssigned])

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
                <Card className="w-full max-w-md">
                    <CardContent className="pt-6">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
                            <p className="mt-4 text-gray-600">
                                กำลังเชื่อมต่อ LINE...
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (!profile) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
                <Card className="w-full max-w-md border-red-200">
                    <CardHeader className="bg-red-50">
                        <CardTitle className="text-center text-red-600">
                            ไม่สามารถเข้าสู่ระบบได้
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                            <p className="text-red-700 text-center font-medium">
                                กรุณาเปิดลิงก์นี้ผ่าน LINE เท่านั้น
                            </p>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-sm text-blue-800 font-medium mb-2">
                                วิธีใช้งานที่ถูกต้อง:
                            </p>
                            <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                                <li>เปิดแอป LINE บนมือถือ</li>
                                <li>สแกน QR Code ที่ได้รับจากแอดมิน</li>
                                <li>ระบบจะเปิดหน้านี้ใน LINE Browser</li>
                                <li>ทำการเข้าห้องอัตโนมัติ</li>
                            </ol>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (status === 'need_friend') {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center p-4">
                <Card className="w-full max-w-md border-zinc-200">
                    <CardContent className="pt-6">
                        <div className="text-center space-y-4">
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                <p className="text-yellow-800 text-lg">
                                    กรุณาเพิ่มเพื่อน LINE Official Account
                                    ของหอพักก่อน
                                    เพื่อรับการแจ้งเตือนและใบแจ้งหนี้
                                </p>
                            </div>

                            <Button
                                onClick={() => {
                                    if (liff) {
                                        liff.openWindow(addFriendUrl, true)
                                    }
                                }}
                                className="w-full bg-[#06C755] hover:bg-[#05b34d] text-white font-medium py-3"
                            >
                                <svg
                                    className="w-5 h-5 mr-2"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                >
                                    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                                </svg>
                                เพิ่มเพื่อน LINE OA
                            </Button>

                            <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 text-left">
                                <p className="text-sm text-zinc-800 font-medium mb-2">
                                    หลังจากเพิ่มเพื่อนแล้ว:
                                </p>
                                <ol className="text-xs text-zinc-700 space-y-1 list-decimal list-inside">
                                    <li>กดปุ่ม "ตรวจสอบอีกครั้ง" ด้านล่าง</li>
                                    <li>ระบบจะดำเนินการเข้าห้องให้อัตโนมัติ</li>
                                </ol>
                            </div>

                            <Button
                                onClick={() => {
                                    setCheckingFriendship(true)
                                    setStatus('loading')
                                    // Re-trigger friendship check
                                    if (liff) {
                                        liff.getFriendship()
                                            .then(
                                                (friendship: {
                                                    friendFlag: boolean
                                                }) => {
                                                    setIsFriend(
                                                        friendship.friendFlag,
                                                    )
                                                    setCheckingFriendship(false)
                                                    if (
                                                        !friendship.friendFlag
                                                    ) {
                                                        setStatus('need_friend')
                                                    }
                                                },
                                            )
                                            .catch(() => {
                                                setCheckingFriendship(false)
                                                setStatus('need_friend')
                                            })
                                    }
                                }}
                                variant="outline"
                                className="w-full"
                            >
                                ตรวจสอบอีกครั้ง
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
                <Card className="w-full max-w-md">
                    <CardContent className="pt-6">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
                            <p className="mt-4 text-gray-600">
                                กำลังดำเนินการเข้าห้อง...
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (status === 'error') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
                <Card className="w-full max-w-md border-red-200">
                    <CardHeader className="bg-red-50">
                        <CardTitle className="text-center text-red-600 flex items-center justify-center gap-2">
                            <span className="text-2xl">❌</span>
                            <span>ไม่สามารถเข้าห้องได้</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                            <p className="text-red-700 text-center">
                                {message}
                            </p>
                        </div>
                        <div className="space-y-2 text-sm text-gray-600">
                            <p className="font-medium">เหตุผลที่เป็นไปได้:</p>
                            <ul className="list-disc list-inside space-y-1 ml-2">
                                <li>QR Code หมดอายุ (เกิน 24 ชั่วโมง)</li>
                                <li>ห้องถูกจองแล้ว</li>
                                <li>คุณมีห้องอยู่แล้ว</li>
                                <li>Token ไม่ถูกต้อง</li>
                            </ul>
                        </div>
                        <Button
                            onClick={() => {
                                if (liff) {
                                    liff.closeWindow()
                                }
                            }}
                            className="w-full mt-6 bg-red-600 hover:bg-red-700"
                        >
                            ปิดหน้าต่าง
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // Success state
    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md border-green-200">
                <CardHeader className="bg-green-50">
                    <CardTitle className="text-center text-green-600 flex items-center justify-center gap-2">
                        <span className="text-2xl">✅</span>
                        <span>เข้าห้องสำเร็จ</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="text-center space-y-4">
                        <div className="bg-gradient-to-br from-green-100 to-blue-100 rounded-lg p-6 border-2 border-green-200">
                            <p className="text-gray-600 text-sm mb-2">
                                คุณได้รับห้องหมายเลข
                            </p>
                            <p className="text-4xl font-bold text-green-700">
                                {roomNumber}
                            </p>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
                            <p className="text-sm text-blue-800 font-medium mb-2">
                                ขั้นตอนต่อไป:
                            </p>
                            <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                                <li>
                                    เพิ่มเพื่อน LINE Official Account ของหอพัก
                                </li>
                                <li>รอแอดมินยืนยันข้อมูลและส่งใบแจ้งหนี้</li>
                                <li>ชำระค่าเช่าและค่ามัดจำ</li>
                                <li>รับกุญแจห้องและเข้าพักได้เลย</li>
                            </ol>
                        </div>

                        <div className="text-sm text-gray-500">
                            <p>ยินดีต้อนรับสู่หอพัก! 🎉</p>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                onClick={() => router.push('/tenant/dashboard')}
                                className="bg-green-600 hover:bg-green-700"
                            >
                                ไปหน้าแรก
                            </Button>
                            <Button
                                onClick={() => {
                                    if (liff) {
                                        liff.closeWindow()
                                    }
                                }}
                                variant="outline"
                            >
                                ปิดหน้าต่าง
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

export default function JoinRoomPage() {
    return (
        <Suspense fallback={<LoadingScreen />}>
            <JoinRoomContent />
        </Suspense>
    )
}
