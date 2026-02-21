'use client';

import { useLiff } from '@/providers/LiffProvider';
import RoomsManagement from '@/components/admin/RoomsManagement';
import LoadingScreen from '@/components/LoadingScreen';

export default function AdminRoomsPage() {
  const { isReady, isLoggedIn, profile } = useLiff();

  if (!isReady || !isLoggedIn || !profile) {
    return <LoadingScreen />;
  }

  return <RoomsManagement lineUserId={profile.userId} />;
}
