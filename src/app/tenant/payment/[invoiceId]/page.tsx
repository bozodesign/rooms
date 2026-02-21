'use client';

import { use } from 'react';
import { useLiff } from '@/providers/LiffProvider';
import PaymentPage from '@/components/tenant/PaymentPage';
import LoadingScreen from '@/components/LoadingScreen';

export default function PaymentPageRoute({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const resolvedParams = use(params);
  const { isReady, isLoggedIn, profile } = useLiff();

  if (!isReady || !isLoggedIn || !profile) {
    return <LoadingScreen />;
  }

  return <PaymentPage invoiceId={resolvedParams.invoiceId} lineUserId={profile.userId} />;
}
