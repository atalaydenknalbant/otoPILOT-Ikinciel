'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { useAuth } from '../../contexts/AuthContext'
import Header from '../../components/Header'
import { collection, query, where, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { getAdvertCache, setAdvertCache, clearAdvertCache, getLastAdvertUpdateTime } from '../../lib/advertCache'

interface AdvertItem {
  id: string
  url: string
  title: string
  price: string
  imageUrl: string
  location: string
  year: string
  km: string
  createdAt: any
  isPromoted: boolean
}

export default function MyListingsPage() {
  const { user } = useAuth()
  const [adverts, setAdverts] = useState<AdvertItem[]>([])
  const [loading, setLoading] = useState(false)
  const [showLinkForm, setShowLinkForm] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [lastUpdateTime, setLastUpdateTime] = useState<string | null>(null)

  // İlanları yükle
  const loadAdverts = useCallback(async (useCache = true) => {
    if (!user) return
    
    // Önce cache'den yükle
    if (useCache) {
      const cachedAdverts = getAdvertCache()
      if (cachedAdverts.length > 0) {
        console.log('Cache\'den yüklenen ilanlar:', cachedAdverts.length)
        setAdverts(cachedAdverts)
        setLastUpdateTime(getLastAdvertUpdateTime())
        return
      }
    }
    
    setLoading(true)
    try {
      console.log('Firebase\'den ilanlar yükleniyor...')
      const advertsRef = collection(db, 'adverts')
      const q = query(advertsRef, where('userId', '==', user.uid))
      const querySnapshot = await getDocs(q)
      
      const advertsData: AdvertItem[] = []
      querySnapshot.forEach((doc) => {
        const data = doc.data()
        console.log('Firebase\'den gelen ilan:', data.title)
        advertsData.push({
          id: doc.id,
          ...data
        } as AdvertItem)
      })
      
      console.log('Toplam yüklenen ilan sayısı:', advertsData.length)
      setAdverts(advertsData)
      setAdvertCache(advertsData)
      setLastUpdateTime(getLastAdvertUpdateTime())
    } catch (error) {
      console.error('İlanlar yüklenirken hata:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  // Link ile ilan ekle
  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !linkUrl.trim()) return

    setSubmitting(true)
    try {
      // Backend'e link gönder
      const response = await fetch('/api/scrape-advert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: linkUrl })
      })

      if (!response.ok) {
        throw new Error('İlan bilgileri alınamadı')
      }

      const advertData = await response.json()

      // Firebase'e kaydet
      const advertsRef = collection(db, 'adverts')
      await addDoc(advertsRef, {
        userId: user.uid,
        url: linkUrl,
        title: advertData.title,
        price: advertData.price,
        imageUrl: advertData.imageUrl,
        location: advertData.location,
        year: advertData.year,
        km: advertData.km,
        isPromoted: true,
        createdAt: new Date()
      })

      setLinkUrl('')
      setShowLinkForm(false)
      loadAdverts()
      alert('İlanınız başarıyla eklendi!')
    } catch (error) {
      console.error('İlan eklenirken hata:', error)
      alert('İlan eklenirken bir hata oluştu')
    } finally {
      setSubmitting(false)
    }
  }

  // İlan sil
  const handleDeleteAdvert = async (advertId: string) => {
    if (!confirm('Bu ilanı silmek istediğinizden emin misiniz?')) return

    try {
      await deleteDoc(doc(db, 'adverts', advertId))
      loadAdverts()
      alert('İlan silindi')
    } catch (error) {
      console.error('İlan silinirken hata:', error)
      alert('İlan silinirken bir hata oluştu')
    }
  }

  useEffect(() => {
    // İlk yüklemede cache'i atla, direkt Firebase'den yükle
    loadAdverts(false)
  }, [user, loadAdverts])

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header currentPage="my-listings" hideSearch={true} />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              İlanlarım
            </h1>
            <p className="text-gray-600">
              İlanlarınızı görmek için giriş yapmanız gerekiyor.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header currentPage="my-listings" hideSearch={true} />
      
      <div className="container mx-auto px-4 py-8">
        {/* Başlık */}
        <div className="flex items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">İlanlarım</h1>
        </div>

        {/* İlan Ekleme Seçenekleri */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Link ile İlan Ekleme */}
          <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-blue-200 hover:border-blue-300 transition-colors">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                İlan Linki ile Öne Çıkarma
              </h3>
              <p className="text-gray-600 mb-4">
                Kullanıcılar ilgili arama yapınca sizin arabanız ilk sayfada gözükecek
              </p>
              <button
                onClick={() => setShowLinkForm(true)}
                className="btn btn-gradient w-full"
              >
                Link Ekle
              </button>
            </div>
          </div>

          {/* Manuel İlan Ekleme */}
          <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-green-200 hover:border-green-300 transition-colors">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                İlan Ver
              </h3>
              <p className="text-gray-600 mb-4">
                Aracınızı detaylı bilgilerle sisteme ekleyin
              </p>
              <button
                onClick={() => alert('Manuel ilan ekleme özelliği yakında eklenecek')}
                className="btn bg-green-600 hover:bg-green-700 text-white w-full"
              >
                İlan Ver
              </button>
            </div>
          </div>
        </div>

        {/* Link Ekleme Formu */}
        {showLinkForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
              <h3 className="text-xl font-semibold mb-4">İlan Linki Ekle</h3>
              <form onSubmit={handleAddLink}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Araba İlan Linki
                  </label>
                  <input
                    type="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://www.arabam.com/ilan/..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowLinkForm(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 btn btn-gradient disabled:opacity-50"
                  >
                    {submitting ? 'Ekleniyor...' : 'Ekle'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* İlanlar Listesi */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              İlanlarım ({adverts.length})
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => loadAdverts(false)}
                disabled={loading}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Yükleniyor...' : 'Verileri Güncelle'}
              </button>
              <button
                onClick={() => {
                  clearAdvertCache()
                  loadAdverts(false)
                }}
                className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
              >
                Önbellek Temizle
              </button>
            </div>
          </div>
          
          {lastUpdateTime && (
            <p className="text-sm text-gray-500 mb-4">
              Son güncelleme: {lastUpdateTime}
            </p>
          )}
          
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">İlanlar yükleniyor...</p>
            </div>
          ) : adverts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">Henüz ilanınız bulunmuyor.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {adverts.map((advert) => (
                <div key={advert.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-4">
                    <Image
                      src={advert.imageUrl || '/placeholder-car.jpg'}
                      alt={advert.title}
                      width={96}
                      height={96}
                      className="w-24 h-24 object-cover rounded-lg"
                      unoptimized
                    />
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <a 
                            href={advert.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="font-semibold text-gray-900 mb-1 hover:text-blue-600 hover:underline block"
                          >
                            {advert.title}
                          </a>
                          <p className="text-lg font-bold text-blue-600 mb-2">
                            {advert.price}
                          </p>
                          <div className="flex gap-4 text-sm text-gray-600">
                            <span>{advert.year}</span>
                            <span>{advert.km} km</span>
                            <span>{advert.location}</span>
                          </div>
                          {advert.isPromoted && (
                            <span className="inline-block mt-2 px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
                              Öne Çıkan
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteAdvert(advert.id)}
                          className="text-red-600 hover:text-red-800 p-1"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
