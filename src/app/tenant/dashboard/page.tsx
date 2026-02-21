'use client';

import { useLiff } from '@/providers/LiffProvider';
import TenantDashboard from '@/components/tenant/Dashboard';
import LoadingScreen from '@/components/LoadingScreen';

export default function TenantDashboardPage() {
  const { isReady, isLoggedIn, profile } = useLiff();

  if (!isReady || !isLoggedIn || !profile) {
    return <LoadingScreen />;
  }

  return <TenantDashboard lineUserId={profile.userId} />;
}
