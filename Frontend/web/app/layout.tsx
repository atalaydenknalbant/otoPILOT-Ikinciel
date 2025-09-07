import './globals.css'
import type { Metadata } from 'next'
import { AuthProvider } from '../contexts/AuthContext'
import { FavoritesProvider } from '../contexts/FavoritesContext'

export const metadata: Metadata = {
  title: 'otoPILOT Ikinciel',
  description: 'AI destekli ve manuel filtreli ikinci el araç arama',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <AuthProvider>
          <FavoritesProvider>
            {children}
          </FavoritesProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
