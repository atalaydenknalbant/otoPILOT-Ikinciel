'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useFavorites } from '../../contexts/FavoritesContext'
import CarCard from '../../components/CarCard'
import type { CarItem } from '../../lib/types'
import { getCachedFavorites, setCachedFavorites, getLastUpdated, clearCachedFavorites } from '../../lib/cache'

export default function FavoritesPage() {
  const { user, loading: authLoading } = useAuth()
  const { favorites, loading: favoritesLoading } = useFavorites()
  const [scrapedCars, setScrapedCars] = useState<CarItem[]>([])
  const [scraping, setScraping] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  // Cache'den veri yükleme
  const loadFromCache = useCallback(() => {
    const cached = getCachedFavorites()
    if (cached) {
      setScrapedCars(cached.data)
      setLastUpdated(getLastUpdated())
    }
  }, [])

  // Favori linklerden veri çekme (cache'i güncelle)
  const scrapeFavorites = useCallback(async (forceUpdate = false) => {
    if (!favorites.length) return

    // Cache'den yükle (force update değilse)
    if (!forceUpdate) {
      const cached = getCachedFavorites()
      if (cached) {
        setScrapedCars(cached.data)
        setLastUpdated(getLastUpdated())
        return
      }
    }

    setScraping(true)
    try {
      const urls = favorites.map(fav => fav.url)
      
      // Backend'e favori linklerini gönder
      const response = await fetch('/api/scrape-favorites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ urls })
      })

      if (!response.ok) {
        throw new Error('Favori verileri çekilemedi')
      }

      const data = await response.json()
      const cars = data.cars || []
      
      // Debug: İlk araçta resim var mı?
      if (cars[0]) {
        console.log('İlk araç resmi:', cars[0].imageUrl ? 'VAR' : 'YOK')
      }
      
      // Cache'e kaydet
      setCachedFavorites(cars)
      setScrapedCars(cars)
      setLastUpdated(getLastUpdated())
      
    } catch (error) {
      console.error('Favori verileri çekilirken hata:', error)
      alert('Favori verileri çekilirken bir hata oluştu')
    } finally {
      setScraping(false)
    }
  }, [favorites])

  // Sayfa yüklendiğinde favori verilerini çek
  useEffect(() => {
    if (favorites.length > 0) {
      // Önce cache'den yükle, yoksa scrape et
      loadFromCache()
      if (!getCachedFavorites()) {
        scrapeFavorites()
      }
    }
  }, [favorites, loadFromCache, scrapeFavorites])


  // Auth yükleniyor
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p>Yükleniyor...</p>
        </div>
      </div>
    )
  }

  // Kullanıcı giriş yapmamış
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Favori Listesi</h1>
          <p className="text-gray-600 mb-6">Favori araçlarınızı görmek için giriş yapmalısınız.</p>
          <button 
            onClick={() => window.location.href = '/login'}
            className="btn btn-gradient"
          >
            Giriş Yap
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Favori Araçlarım</h1>
            <p className="text-gray-600 mt-2">
              {favorites.length} favori araç • {scrapedCars.length} güncel veri
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                onClick={() => scrapeFavorites(true)}
                disabled={scraping || favoritesLoading || !favorites.length}
                className="btn btn-gradient disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {scraping ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Güncelleniyor...
                  </>
                ) : (
                  'Verileri Güncelle'
                )}
              </button>
              <button
                onClick={() => {
                  clearCachedFavorites()
                  setScrapedCars([])
                  setLastUpdated(null)
                }}
                className="btn btn-outline text-red-600 border-red-600 hover:bg-red-50"
              >
                Cache Temizle
              </button>
            </div>
            {lastUpdated && (
              <p className="text-sm text-gray-500 text-center">
                Son güncelleme: {lastUpdated}
              </p>
            )}
          </div>
        </div>

        {favoritesLoading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p>Favoriler yükleniyor...</p>
          </div>
        ) : favorites.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Henüz favori araç yok</h2>
            <p className="text-gray-600 mb-6">Beğendiğiniz araçları favorilere ekleyerek burada görebilirsiniz.</p>
            <button 
              onClick={() => window.location.href = '/'}
              className="btn btn-gradient"
            >
              Araç Ara
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {scrapedCars.map((car, index) => (
              <CarCard key={car.url || index} item={car} />
            ))}
          </div>
        )}

        {favorites.length > 0 && scrapedCars.length === 0 && !scraping && (
          <div className="text-center py-8">
            <p className="text-gray-600 mb-4">Favori verilerinizi güncellemek için yukarıdaki butona tıklayın.</p>
          </div>
        )}
      </div>
    </div>
  )
}
