'use client'

import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'

export default function DebugEmailPage() {
  const { user, sendEmailVerification, isEmailVerified } = useAuth()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSendEmail = async () => {
    if (!user) {
      setMessage('Lütfen önce giriş yapın')
      return
    }

    setLoading(true)
    setMessage('')
    
    try {
      await sendEmailVerification()
      setMessage('Email doğrulama gönderildi! Lütfen email kutunuzu kontrol edin.')
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata'
      setMessage(`Hata: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Email Doğrulama Debug</h1>
      
      {user ? (
        <div className="space-y-4">
          <div className="bg-gray-100 p-4 rounded">
            <h2 className="font-semibold mb-2">Kullanıcı Bilgileri:</h2>
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>Email Doğrulandı mı:</strong> {isEmailVerified() ? 'Evet' : 'Hayır'}</p>
            <p><strong>UID:</strong> {user.uid}</p>
            <p><strong>Display Name:</strong> {user.displayName || 'Yok'}</p>
          </div>

          <button
            onClick={handleSendEmail}
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? 'Gönderiliyor...' : 'Email Doğrulama Gönder'}
          </button>

          {message && (
            <div className={`p-4 rounded ${message.includes('Hata') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
              {message}
            </div>
          )}

          <div className="bg-yellow-100 p-4 rounded">
            <h3 className="font-semibold mb-2">Kontrol Edilecekler:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Spam klasörünü kontrol edin</li>
              <li>Firebase Console → Authentication → Templates → Email address verification</li>
              <li>Firebase Console → Authentication → Settings → Authorized domains</li>
              <li>Console&apos;da hata mesajları var mı kontrol edin</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="text-center">
          <p className="mb-4">Bu sayfayı kullanmak için giriş yapmanız gerekiyor.</p>
          <a href="/login" className="btn btn-primary">Giriş Yap</a>
        </div>
      )}
    </div>
  )
}
