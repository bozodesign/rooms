'use client'

import { useEffect } from 'react'
import { useLiff } from '@/providers/LiffProvider'
import LoadingScreen from '@/components/LoadingScreen'

export default function HomePage() {
    const { isReady, isLoggedIn, profile, login } = useLiff()

    useEffect(() => {
        if (isReady && isLoggedIn && profile) {
            // Redirect based on role
            fetch('/api/auth/profile', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-line-userid': profile.userId,
                },
                body: JSON.stringify(profile),
            })
                .then((res) => res.json())
                .then((data) => {
                    if (data.user.role === 'admin') {
                        window.location.href = '/admin/dashboard'
                    } else {
                        window.location.href = '/tenant/dashboard'
                    }
                })
                .catch(() => {
                    window.location.href = '/tenant/dashboard'
                })
        }
    }, [isReady, isLoggedIn, profile])

    if (!isReady) {
        return <LoadingScreen />
    }

    if (!isLoggedIn) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
                <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
                    <h1 className="text-2xl font-bold text-gray-800 mb-4">
                        ระบบจัดการหอพัก
                    </h1>
                    <p className="text-gray-600 mb-6">
                        กรุณาเข้าสู่ระบบด้วย LINE
                    </p>
                    <button
                        onClick={login}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                    >
                        เข้าสู่ระบบด้วย LINE
                    </button>
                </div>
            </div>
        )
    }

    return <LoadingScreen message="กำลังเข้าสู่ระบบ..." />
}
