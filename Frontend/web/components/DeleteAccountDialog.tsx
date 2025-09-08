'use client'

import { useState } from 'react'

interface DeleteAccountDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (password: string) => void
  isLoading: boolean
  isGoogleUser?: boolean
}

export default function DeleteAccountDialog({ isOpen, onClose, onConfirm, isLoading, isGoogleUser = false }: DeleteAccountDialogProps) {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isGoogleUser && !password.trim()) {
      alert('Lütfen şifrenizi girin')
      return
    }
    onConfirm(password)
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-auto border border-gray-200 animate-in zoom-in-95 duration-200">
        <form onSubmit={handleSubmit}>
          <div className="p-8">
            {/* Icon */}
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-6 bg-red-100 rounded-full">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>

            {/* Title */}
            <h3 className="text-xl font-bold text-gray-900 text-center mb-4">
              Hesabı Sil
            </h3>

            {/* Description */}
            <div className="text-sm text-gray-600 text-center mb-8">
              <p className="mb-2">
                Hesabınızı silmek istediğinizden emin misiniz?
              </p>
              <p className="font-medium text-red-600">
                Bu işlem geri alınamaz!
              </p>
              <div className="mt-3 p-3 bg-red-50 rounded-md">
                <p className="text-xs text-red-700">
                  <strong>Silinecek veriler:</strong>
                </p>
                <ul className="text-xs text-red-600 mt-1 space-y-1">
                  <li>• Favori araç listeniz</li>
                  <li>• İlanlarınız</li>
                  <li>• Tüm hesap bilgileriniz</li>
                  <li>• Arama geçmişiniz</li>
                </ul>
              </div>
            </div>

            {/* Password Input (sadece email/password kullanıcıları için) */}
            {!isGoogleUser && (
              <div className="mb-6">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Şifrenizi girin
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Hesap şifrenizi girin"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    disabled={isLoading}
                  >
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {showPassword ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      )}
                    </svg>
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Hesap silmek için şifrenizi doğrulamanız gerekiyor
                </p>
              </div>
            )}

            {/* Google kullanıcısı için bilgi */}
            {isGoogleUser && (
              <div className="mb-6 p-3 bg-blue-50 rounded-md">
                <p className="text-sm text-blue-700">
                  Google hesabınızla giriş yaptığınız için, hesap silme işlemi sırasında Google ile tekrar giriş yapmanız istenecek.
                </p>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-4 mt-8">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="flex-1 px-6 py-3 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 px-6 py-3 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Siliniyor...
                  </div>
                ) : (
                  'Evet, Sil'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
