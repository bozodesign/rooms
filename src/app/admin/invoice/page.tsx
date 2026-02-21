'use client';

import { useLiff } from '@/providers/LiffProvider';
import InvoiceManagement from '@/components/admin/InvoiceManagement';
import LoadingScreen from '@/components/LoadingScreen';

export default function AdminInvoicePage() {
  const { isReady, isLoggedIn, profile } = useLiff();

  if (!isReady || !isLoggedIn || !profile) {
    return <LoadingScreen />;
  }

  return <InvoiceManagement lineUserId={profile.userId} />;
}
