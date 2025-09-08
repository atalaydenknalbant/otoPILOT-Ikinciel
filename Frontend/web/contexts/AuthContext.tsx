'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { 
  User, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup,
  GoogleAuthProvider,
  signOut, 
  onAuthStateChanged,
  sendEmailVerification as firebaseSendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'firebase/auth'
import { auth, db } from '../lib/firebase'
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, displayName?: string) => Promise<void>
  loginWithGoogle: () => Promise<void>
  logout: () => Promise<void>
  deleteAccount: () => Promise<void>
  getUserDisplayName: () => string
  getUserPhoto: () => string | null
  sendEmailVerification: () => Promise<void>
  sendPasswordReset: (email: string) => Promise<void>
  isEmailVerified: () => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const login = async (email: string, password: string) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password)
    
    // Email doğrulanmamışsa çıkış yap ve hata fırlat
    if (!userCredential.user.emailVerified) {
      await signOut(auth)
      throw new Error('EMAIL_NOT_VERIFIED')
    }
  }

  const register = async (email: string, password: string, displayName?: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)
    
    // Eğer displayName verilmişse, kullanıcı profilini güncelle
    if (displayName && userCredential.user) {
      await updateProfile(userCredential.user, {
        displayName: displayName
      })
    }
    
    // Email doğrulama gönder
    try {
      await firebaseSendEmailVerification(userCredential.user)
      console.log('Email doğrulama gönderildi:', userCredential.user.email)
    } catch (error) {
      console.error('Email doğrulama gönderilirken hata:', error)
    }
    
    // Kayıt olduktan sonra çıkış yap (email doğrulanana kadar giriş yapmasın)
    await signOut(auth)
  }

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider()
    await signInWithPopup(auth, provider)
  }

  const logout = async () => {
    await signOut(auth)
  }

  const deleteAccount = async (password?: string) => {
    if (!user) {
      throw new Error('Kullanıcı giriş yapmamış')
    }

    try {
      // 1. Re-authentication yap (gerekli)
      if (user.email && password) {
        const credential = EmailAuthProvider.credential(user.email, password)
        await reauthenticateWithCredential(user, credential)
      } else if (user.providerData.some(provider => provider.providerId === 'google.com')) {
        // Google ile giriş yapmışsa, Google ile re-authenticate et
        const provider = new GoogleAuthProvider()
        await signInWithPopup(auth, provider)
      } else {
        throw new Error('Hesap silmek için şifrenizi girmeniz gerekiyor')
      }

      // 2. Firestore'dan kullanıcının tüm verilerini sil
      const userId = user.uid
      
      // Favorileri sil
      const favoritesQuery = query(collection(db, 'favorites'), where('userId', '==', userId))
      const favoritesSnapshot = await getDocs(favoritesQuery)
      const favoritesDeletePromises = favoritesSnapshot.docs.map(docSnapshot => 
        deleteDoc(doc(db, 'favorites', docSnapshot.id))
      )
      await Promise.all(favoritesDeletePromises)

      // İlanları sil (gelecekte eklenecek)
      // const listingsQuery = query(collection(db, 'listings'), where('userId', '==', userId))
      // const listingsSnapshot = await getDocs(listingsQuery)
      // const listingsDeletePromises = listingsSnapshot.docs.map(docSnapshot => 
      //   deleteDoc(doc(db, 'listings', docSnapshot.id))
      // )
      // await Promise.all(listingsDeletePromises)

      // 3. Firebase Authentication'dan hesabı sil
      await deleteUser(user)
      
      // 4. Local storage'ı temizle
      localStorage.clear()
      
    } catch (error) {
      console.error('Hesap silinirken hata:', error)
      throw error
    }
  }

  // Kullanıcı adını al - Google'dan veya email'den
  const getUserDisplayName = () => {
    if (!user) return 'Kullanıcı'
    
    // Google'dan gelen displayName varsa onu kullan
    if (user.displayName) {
      return user.displayName
    }
    
    // Yoksa email'den @ öncesi kısmı al
    if (user.email) {
      return user.email.split('@')[0]
    }
    
    return 'Kullanıcı'
  }

  // Kullanıcı fotoğrafını al - Google'dan
  const getUserPhoto = () => {
    if (!user) return null
    return user.photoURL
  }

  // Email doğrulama gönder
  const sendEmailVerification = async (userToVerify?: User) => {
    const targetUser = userToVerify || user
    if (!targetUser) throw new Error('Kullanıcı giriş yapmamış')
    
    try {
      await firebaseSendEmailVerification(targetUser)
      console.log('Email doğrulama tekrar gönderildi:', targetUser.email)
    } catch (error) {
      console.error('Email doğrulama gönderilirken hata:', error)
      throw error
    }
  }

  // Şifre sıfırlama emaili gönder
  const sendPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email)
  }

  // Email doğrulanmış mı kontrol et
  const isEmailVerified = () => {
    if (!user) return false
    return user.emailVerified
  }

  const value = {
    user,
    loading,
    login,
    register,
    loginWithGoogle,
    logout,
    deleteAccount,
    getUserDisplayName,
    getUserPhoto,
    sendEmailVerification,
    sendPasswordReset,
    isEmailVerified
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
