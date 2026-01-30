'use client'

import { SWRConfig } from 'swr'

export default function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        refreshInterval: 30000, // Auto-refresh every 30 seconds
        revalidateOnFocus: true, // Revalidate when window regains focus
        revalidateOnReconnect: true, // Revalidate when reconnected to network
        dedupingInterval: 2000, // Dedupe requests within 2 seconds
        shouldRetryOnError: true,
        errorRetryCount: 3,
        errorRetryInterval: 5000,
        // Global fetcher can be overridden per hook
        fetcher: (resource, init) => fetch(resource, init).then(res => res.json())
      }}
    >
      {children}
    </SWRConfig>
  )
}
