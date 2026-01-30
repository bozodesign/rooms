'use client';

import { useLiff } from '@/providers/LiffProvider';
import TenantDashboard from '@/components/tenant/Dashboard';

export default function TenantDashboardPage() {
  const { isReady, isLoggedIn, profile } = useLiff();

  if (!isReady || !isLoggedIn || !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  return <TenantDashboard lineUserId={profile.userId} />;
}
