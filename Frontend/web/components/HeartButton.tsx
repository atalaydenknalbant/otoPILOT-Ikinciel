'use client'

import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useFavorites } from '../contexts/FavoritesContext'
import type { CarItem } from '../lib/types'

interface HeartButtonProps {
  car: CarItem
  className?: string
}

export default function HeartButton({ car, className = '' }: HeartButtonProps) {
  const { user } = useAuth()
  const { isFavorite, addToFavorites, removeFromFavorites } = useFavorites()
  const [isLoading, setIsLoading] = useState(false)

  const isFav = isFavorite(car.url || '')
  const [localIsFav, setLocalIsFav] = useState(isFav)

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!user) {
      alert('Favori eklemek için giriş yapmalısınız')
      return
    }

    if (!car.url) {
      alert('Bu araç için geçerli bir link bulunamadı')
      return
    }

    setIsLoading(true)
    try {
      if (localIsFav) {
        // Favori listesinden kaldır
        // const favoriteCar = { url: car.url, title: car.title || '', imageUrl: car.imageUrl, price: car.price }
        await removeFromFavorites(car.url)
        setLocalIsFav(false)
      } else {
        // Favori listesine ekle
        // const favoriteCar = {
        //   url: car.url,
        //   title: car.title || '',
        //   imageUrl: car.imageUrl,
        //   price: car.price
        // }
        await addToFavorites({
          url: car.url,
          title: car.title || '',
          imageUrl: car.imageUrl,
          price: car.price?.toString()
        })
        setLocalIsFav(true)
      }
    } catch (error) {
      console.error('Favori işlemi sırasında hata:', error)
      alert('İşlem sırasında bir hata oluştu')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`
        absolute top-2 right-2 z-10 
        p-2 rounded-full 
        transition-all duration-200 
        hover:scale-110 
        disabled:opacity-50 
        disabled:cursor-not-allowed
        ${localIsFav 
          ? 'bg-red-500 text-white shadow-lg' 
          : 'bg-white/80 text-gray-600 hover:bg-red-50 hover:text-red-500'
        }
        ${className}
      `}
      title={localIsFav ? 'Favorilerden kaldır' : 'Favorilere ekle'}
    >
      {isLoading ? (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <svg 
          className="w-4 h-4" 
          fill={localIsFav ? 'currentColor' : 'none'} 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" 
          />
        </svg>
      )}
    </button>
  )
}
