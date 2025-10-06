'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { 
  collection, 
  doc, 
  addDoc, 
  deleteDoc, 
  getDocs, 
  query, 
  where,
  orderBy 
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from './AuthContext'

interface FavoriteCar {
  id: string
  url: string
  title: string
  imageUrl?: string
  price?: string
  addedAt: Date
}

interface FavoritesContextType {
  favorites: FavoriteCar[]
  loading: boolean
  addToFavorites: (car: Omit<FavoriteCar, 'id' | 'addedAt'>) => Promise<void>
  removeFromFavorites: (url: string) => Promise<void>
  isFavorite: (url: string) => boolean
  refreshFavorites: () => Promise<void>
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined)

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [favorites, setFavorites] = useState<FavoriteCar[]>([])
  const [loading, setLoading] = useState(false)

  // Kullanıcı değiştiğinde favorileri yükle
  useEffect(() => {
    if (user) {
      loadFavorites()
    } else {
      setFavorites([])
    }
  }, [user])

  const loadFavorites = async () => {
    if (!user) return

    console.log('Loading favorites for user:', user.uid)
    setLoading(true)
    try {
      const favoritesRef = collection(db, 'favorites')
      const q = query(
        favoritesRef, 
        where('userId', '==', user.uid)
      )
      
      const querySnapshot = await getDocs(q)
      console.log('Query snapshot size:', querySnapshot.docs.length)
      
      const favoritesData = querySnapshot.docs.map(doc => {
        const data = doc.data()
        console.log('Favorite doc data:', data)
        return {
          id: doc.id,
          ...data,
          addedAt: data.addedAt.toDate()
        }
      }) as FavoriteCar[]
      
      console.log('Processed favorites:', favoritesData)
      setFavorites(favoritesData)
    } catch (error) {
      console.error('Favoriler yüklenirken hata:', error)
    } finally {
      setLoading(false)
    }
  }

  const addToFavorites = async (car: Omit<FavoriteCar, 'id' | 'addedAt'>) => {
    if (!user) {
      throw new Error('Favori eklemek için giriş yapmalısınız')
    }

    try {
      const favoritesRef = collection(db, 'favorites')
      const docRef = await addDoc(favoritesRef, {
        ...car,
        userId: user.uid,
        addedAt: new Date()
      })

      const newFavorite: FavoriteCar = {
        ...car,
        id: docRef.id,
        addedAt: new Date()
      }

      setFavorites(prev => [newFavorite, ...prev])
    } catch (error) {
      console.error('Favori eklenirken hata:', error)
      throw error
    }
  }

  const removeFromFavorites = async (url: string) => {
    if (!user) return

    try {
      // URL'ye göre favoriyi bul
      const favoriteToRemove = favorites.find(fav => fav.url === url)
      if (!favoriteToRemove) {
        console.warn('Kaldırılacak favori bulunamadı:', url)
        return
      }

      await deleteDoc(doc(db, 'favorites', favoriteToRemove.id))
      setFavorites(prev => prev.filter(fav => fav.url !== url))
    } catch (error) {
      console.error('Favori silinirken hata:', error)
      throw error
    }
  }

  const isFavorite = (url: string) => {
    return favorites.some(fav => fav.url === url)
  }

  const refreshFavorites = async () => {
    await loadFavorites()
  }

  const value = {
    favorites,
    loading,
    addToFavorites,
    removeFromFavorites,
    isFavorite,
    refreshFavorites
  }

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  )
}

export function useFavorites() {
  const context = useContext(FavoritesContext)
  if (context === undefined) {
    throw new Error('useFavorites must be used within a FavoritesProvider')
  }
  return context
}
