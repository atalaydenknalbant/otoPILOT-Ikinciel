'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'

interface AdvertItem {
  id: string
  url: string
  title: string
  price: string
  imageUrl: string
  location: string
  year: string
  km: string
  isPromoted: boolean
}

interface AdvertsContextType {
  promotedUrls: Set<string>
  isAdvertUrl: (url: string) => boolean
  loadPromotedAdverts: () => Promise<void>
}

const AdvertsContext = createContext<AdvertsContextType | undefined>(undefined)

export function AdvertsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [promotedUrls, setPromotedUrls] = useState<Set<string>>(new Set())

  const isAdvertUrl = (url: string) => {
    return promotedUrls.has(url)
  }

  const loadPromotedAdverts = async () => {
    if (!user) return

    try {
      const advertsRef = collection(db, 'adverts')
      const q = query(advertsRef, where('isPromoted', '==', true))
      const querySnapshot = await getDocs(q)
      
      const urls = new Set<string>()
      querySnapshot.forEach((doc) => {
        const data = doc.data()
        if (data.url) {
          urls.add(data.url)
        }
      })
      
      setPromotedUrls(urls)
      console.log('Öne çıkan ilanlar yüklendi:', urls.size)
    } catch (error) {
      console.error('Öne çıkan ilanlar yüklenirken hata:', error)
    }
  }

  useEffect(() => {
    loadPromotedAdverts()
  }, [user])

  return (
    <AdvertsContext.Provider value={{
      promotedUrls,
      isAdvertUrl,
      loadPromotedAdverts
    }}>
      {children}
    </AdvertsContext.Provider>
  )
}

export function useAdverts() {
  const context = useContext(AdvertsContext)
  if (context === undefined) {
    throw new Error('useAdverts must be used within an AdvertsProvider')
  }
  return context
}
