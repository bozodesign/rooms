'use client';

import { useState, useEffect, use } from 'react';
import { useLiff } from '@/providers/LiffProvider';
import LoadingScreen from '@/components/LoadingScreen';

interface InvitationData {
  inviter: {
    displayName: string;
    pictureUrl?: string;
  };
  createdAt: string;
  expireDate: string;
}

export default function InvitationPage({
  params,
}: {
  params: Promise<{ secretCode: string }>;
}) {
  const { secretCode } = use(params);
  const { profile, isLoading: isLiffLoading, isLoggedIn } = useLiff();
  const lineUserId = profile?.userId || '';

  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [status, setStatus] = useState<'loading' | 'valid' | 'error' | 'accepted' | 'declined'>('loading');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check invitation validity
  useEffect(() => {
    const checkInvitation = async () => {
      try {
        const res = await fetch(`/api/invitation/${secretCode}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'เกิดข้อผิดพลาด');
          setStatus('error');
          return;
        }

        setInvitation(data.invitation);
        setStatus('valid');
      } catch {
        setError('ไม่สามารถตรวจสอบลิงก์เชิญได้');
        setStatus('error');
      }
    };

    checkInvitation();
  }, [secretCode]);

  const handleDecision = async (decision: 'accept' | 'decline') => {
    if (!lineUserId) {
      setError('กรุณาเข้าสู่ระบบก่อน');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/invitation/${secretCode}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-line-userid': lineUserId,
        },
        body: JSON.stringify({ decision }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'เกิดข้อผิดพลาด');
        setIsSubmitting(false);
        return;
      }

      setStatus(decision === 'accept' ? 'accepted' : 'declined');

      // Redirect after accepting
      if (decision === 'accept') {
        setTimeout(() => {
          window.location.href = '/admin/dashboard';
        }, 2000);
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการดำเนินการ');
      setIsSubmitting(false);
    }
  };

  if (isLiffLoading || status === 'loading') {
    return <LoadingScreen />;
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">ไม่สามารถใช้ลิงก์เชิญได้</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (status === 'accepted') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">ยินดีต้อนรับ!</h1>
          <p className="text-gray-600 mb-4">คุณได้รับสิทธิ์ผู้ดูแลระบบแล้ว</p>
          <p className="text-sm text-gray-500">กำลังนำคุณไปยังหน้าผู้ดูแล...</p>
        </div>
      </div>
    );
  }

  if (status === 'declined') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">ปฏิเสธคำเชิญแล้ว</h1>
          <p className="text-gray-600">คุณได้ปฏิเสธคำเชิญเป็นผู้ดูแลระบบ</p>
        </div>
      </div>
    );
  }

  // Show invitation details
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">คำเชิญเป็นผู้ดูแล</h1>
          <p className="text-gray-600 mt-1">ระบบจัดการหอพัก</p>
        </div>

        {/* Inviter info */}
        <div className="bg-orange-50 rounded-xl p-4 mb-6">
          <p className="text-sm text-gray-600 mb-3 text-center">เชิญโดย</p>
          <div className="flex items-center justify-center gap-3">
            {invitation?.inviter.pictureUrl ? (
              <img
                src={invitation.inviter.pictureUrl}
                alt={invitation.inviter.displayName}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 bg-orange-200 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            )}
            <div>
              <p className="font-medium text-gray-900">{invitation?.inviter.displayName}</p>
              <p className="text-xs text-gray-500">ผู้ดูแลระบบ</p>
            </div>
          </div>
        </div>

        {/* Role info */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-800 rounded-full">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span className="font-medium">สิทธิ์ผู้ดูแลระบบ</span>
          </div>
        </div>

        {/* Current user info */}
        {profile && (
          <div className="border-t border-gray-100 pt-4 mb-6">
            <p className="text-sm text-gray-600 mb-2 text-center">ยอมรับในนาม</p>
            <div className="flex items-center justify-center gap-3">
              {profile.pictureUrl ? (
                <img
                  src={profile.pictureUrl}
                  alt={profile.displayName}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
              <span className="font-medium text-gray-900">{profile.displayName}</span>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="space-y-3">
          <button
            onClick={() => handleDecision('accept')}
            disabled={isSubmitting || !lineUserId}
            className="w-full py-3 px-4 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-bold rounded-xl transition-colors shadow-lg"
          >
            {isSubmitting ? 'กำลังดำเนินการ...' : 'ยอมรับคำเชิญ'}
          </button>
          <button
            onClick={() => handleDecision('decline')}
            disabled={isSubmitting || !lineUserId}
            className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-100 text-gray-700 font-medium rounded-xl transition-colors"
          >
            ปฏิเสธ
          </button>
        </div>

        {!isLoggedIn && (
          <p className="text-center text-sm text-red-500 mt-4">
            กรุณาเปิดลิงก์นี้ในแอป LINE เพื่อยอมรับคำเชิญ
          </p>
        )}
      </div>
    </div>
  );
}
