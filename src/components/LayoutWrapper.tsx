'use client'

import { usePathname } from 'next/navigation'
import BottomNav from '@/components/admin/BottomNav'
import { useLiff } from '@/providers/LiffProvider'

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { profile, isLoggedIn } = useLiff()

  // Show bottom nav only on admin pages when user is logged in
  const showBottomNav = isLoggedIn && profile && pathname?.startsWith('/admin')

  return (
    <>
      <div className={showBottomNav ? 'pb-20 md:pb-0' : ''}>
        {children}
      </div>

      {showBottomNav && <BottomNav />}
    </>
  )
}
