'use client';

import { use } from 'react';
import { useLiff } from '@/providers/LiffProvider';
import InvoiceDetail from '@/components/tenant/InvoiceDetail';
import LoadingScreen from '@/components/LoadingScreen';

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const resolvedParams = use(params);
  const { isReady, isLoggedIn, profile } = useLiff();

  if (!isReady || !isLoggedIn || !profile) {
    return <LoadingScreen />;
  }

  return <InvoiceDetail invoiceId={resolvedParams.invoiceId} lineUserId={profile.userId} />;
}
