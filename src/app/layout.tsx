import type { Metadata, Viewport } from 'next'
import { Kanit } from 'next/font/google'
import './globals.css'
import QueryProvider from '@/providers/QueryProvider'
import LiffProvider from '@/providers/LiffProvider'
import SWRProvider from '@/providers/SWRProvider'
import LayoutWrapper from '@/components/LayoutWrapper'

const kanit = Kanit({
    subsets: ['thai', 'latin'],
    weight: ['300', '400', '500', '600', '700'],
})

export const metadata: Metadata = {
    title: 'Cosy Place by Wanna',
    description: 'Family-run Dormitory Management System',
}

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
}

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode
}>) {
    return (
        <html lang="th">
            <head>
                <script src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
            </head>
            <body className={kanit.className}>
                <SWRProvider>
                    <QueryProvider>
                        <LiffProvider>
                            <LayoutWrapper>{children}</LayoutWrapper>
                        </LiffProvider>
                    </QueryProvider>
                </SWRProvider>
            </body>
        </html>
    )
}
