'use client'
import { useState } from 'react'
import Link from 'next/link'
import IconsRow from './IconsRow'
import SearchBar from './SearchBar'
import DeleteAccountDialog from './DeleteAccountDialog'
import type { Parsed, SearchItem } from '../types'
import Logo from './Logo'
import { useAuth } from '../contexts/AuthContext'
import Image from 'next/image'

export default function Header({
  aiMode = false,
  onModeChange = () => {},
  onResults = () => {},
  onLoading = () => {},
  onParsed,
  modelReady = false,
  onModelReady = () => {},
  parsed,
  loading = false,
  onCancel = () => {},
  currentPage = 'home',
  hideSearch = false,
}: {
  aiMode?: boolean
  onModeChange?: (b: boolean) => void
  onResults?: (items: SearchItem[], parsed?: Parsed) => void
  onLoading?: (b: boolean) => void
  onParsed?: (json: Parsed) => void
  modelReady?: boolean
  onModelReady?: (b: boolean) => void
  parsed?: Parsed
  loading?: boolean
  onCancel?: () => void
  currentPage?: 'home' | 'favorites' | 'my-listings'
  hideSearch?: boolean
}) {
  const { user, logout, deleteAccount, getUserDisplayName, getUserPhoto, isEmailVerified, sendEmailVerification } = useAuth()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDeleteAccount = async (password: string) => {
    setIsDeleting(true)
    try {
      await deleteAccount(password)
      setShowDeleteDialog(false)
      alert('Hesabınız başarıyla silindi.')
    } catch (error) {
      console.error('Hesap silinirken hata:', error)
      alert('Hesap silinirken bir hata oluştu. Lütfen tekrar deneyin.')
    } finally {
      setIsDeleting(false)
    }
  }

  const isGoogleUser = user?.providerData.some(provider => provider.providerId === 'google.com') || false

  return (
    <header className="bg-white/70 backdrop-blur border-b border-gray-100">
      <div className="container pl-0 pr-4 py-4 flex items-center gap-2 md:gap-3">
        <div className="shrink-0 -ml-2 md:-ml-3 flex items-center gap-3">
          <Logo src="/logo/logo.svg" desktopHeightClass="h-16 md:h-20 lg:h-24" mobileHeightClass="h-14" />
          {currentPage === 'favorites' && (
            <h1 className="text-2xl font-bold text-gray-900">Favori Araçlarım</h1>
          )}
        </div>
        {!hideSearch && (
          <div className="flex-1 min-w-0">
            <SearchBar
              aiMode={aiMode}
              onModeChange={onModeChange}
              onResults={onResults}
              onLoading={onLoading}
              onParsed={onParsed}
              modelReady={modelReady}
              onModelReady={onModelReady}
              parsed={parsed}
              loading={loading}
              onCancel={onCancel}
            />
          </div>
        )}
        <div className={`hidden md:flex flex-none items-center gap-2 ${hideSearch ? 'ml-auto' : 'ml-2 md:ml-3'}`}>
          {user ? (
            <div className="flex items-center gap-2">
              {/* Kullanıcı Menüsü */}
              <div className="relative group">
                <button className="btn btn-outline whitespace-nowrap flex items-center gap-2">
                  {/* Kullanıcı fotoğrafı varsa göster */}
               {getUserPhoto() ? (
                 <Image 
                   src={getUserPhoto()!} 
                   alt="Profil" 
                   width={24}
                   height={24}
                   className="w-6 h-6 rounded-full"
                 />
               ) : (
                    <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium">
                      {getUserDisplayName().charAt(0).toUpperCase()}
                    </div>
                  )}
                  {getUserDisplayName()}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {/* Dropdown Menü */}
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <div className="py-1">
                    {currentPage !== 'favorites' && (
                      <Link 
                        href="/favorites" 
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Favorilerim
                      </Link>
                    )}
                    {currentPage === 'favorites' && (
                      <Link 
                        href="/" 
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Ana Sayfaya Dön
                      </Link>
                    )}
                    {currentPage === 'my-listings' && (
                      <Link 
                        href="/" 
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Ana Sayfaya Dön
                      </Link>
                    )}
                    {currentPage !== 'my-listings' && currentPage !== 'favorites' && (
                      <Link 
                        href="/my-listings" 
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        İlanlarım
                      </Link>
                    )}
                    <hr className="my-1" />
                    <button 
                      onClick={logout}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Çıkış Yap
                    </button>
                    <button 
                      onClick={() => setShowDeleteDialog(true)}
                      className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      Hesap Sil
                    </button>
                  </div>
                </div>
              </div>
              
            </div>
          ) : (
            <Link 
              href="/login" 
              className="btn btn-gradient whitespace-nowrap"
            >
              Giriş Yap
            </Link>
          )}
        </div>
      </div>
      <div className="border-t border-gray-100">
        <div className="container py-3">
          <IconsRow />
        </div>
      </div>
      
      {/* Email Doğrulama Uyarısı */}
      {user && !isEmailVerified() && (
        <div className="bg-yellow-50 border-b border-yellow-200">
          <div className="container py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span className="text-sm text-yellow-800">
                  Email adresinizi doğrulayın. Doğrulama linki gönderildi.
                </span>
              </div>
              <button
                onClick={sendEmailVerification}
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                Tekrar Gönder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Dialog */}
      <DeleteAccountDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDeleteAccount}
        isLoading={isDeleting}
        isGoogleUser={isGoogleUser}
      />
    </header>
  )
}
