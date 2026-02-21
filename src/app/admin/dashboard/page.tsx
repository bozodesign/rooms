'use client';

import { useLiff } from '@/providers/LiffProvider';
import BirdsEyeView from '@/components/admin/BirdsEyeView';
import LoadingScreen from '@/components/LoadingScreen';

export default function AdminDashboardPage() {
  const { isReady, isLoggedIn, profile } = useLiff();

  if (!isReady || !isLoggedIn || !profile) {
    return <LoadingScreen />;
  }

  return <BirdsEyeView lineUserId={profile.userId} />;
}
