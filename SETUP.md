# Firebase Authentication ve Favori Sistemi Kurulumu

## 🚀 Yeni Özellikler

- ✅ Firebase Authentication (Email/Password)
- ✅ Favori araç sistemi (link tabanlı)
- ✅ Kalp ikonu ile favori ekleme/çıkarma
- ✅ Favori listesi sayfası
- ✅ Login olmadan favori kısıtlaması
- ✅ Favori linklerden fresh data çekme

## 📋 Kurulum Adımları

### 1. Firebase Projesi Oluşturma

1. [Firebase Console](https://console.firebase.google.com/)'a gidin
2. "Create a project" tıklayın
3. Proje adını girin (örn: "otopilot-ikinciel")
4. Google Analytics'i etkinleştirin (opsiyonel)
5. "Create project" tıklayın

### 2. Authentication Ayarlama

1. Firebase Console'da "Authentication" > "Sign-in method" gidin
2. "Email/Password" seçeneğini etkinleştirin
3. "Save" tıklayın

### 3. Firestore Database Oluşturma

1. "Firestore Database" > "Create database" tıklayın
2. "Start in test mode" seçin (geliştirme için)
3. Bölge seçin (Europe-west3 önerilir)
4. "Done" tıklayın

### 4. Firebase Konfigürasyonu

1. Firebase Console'da "Project settings" > "General" gidin
2. "Your apps" bölümünde "Web" ikonuna tıklayın
3. App nickname girin (örn: "otopilot-web")
4. "Register app" tıklayın
5. Konfigürasyon kodunu kopyalayın

### 5. Environment Variables

`Frontend/web/.env.local` dosyası oluşturun:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### 6. Firestore Güvenlik Kuralları

Firestore Console'da "Rules" sekmesine gidin ve şu kuralları ekleyin:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Favoriler koleksiyonu - sadece kendi verilerine erişim
    match /favorites/{document} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
  }
}
```

## 🎯 Kullanım

### Giriş/Kayıt
- `/login` sayfasından giriş yapabilir veya kayıt olabilirsiniz
- Header'da giriş durumuna göre butonlar görünür

### Favori Ekleme
- Araç kartlarının sağ üst köşesindeki kalp ikonuna tıklayın
- Giriş yapmadan favori ekleyemezsiniz
- Kalp kırmızı olursa favoriye eklendi demektir

### Favori Listesi
- Header'daki "Favorilerim" butonuna tıklayın
- Favori linklerden fresh veri çekilir
- "Verileri Güncelle" butonu ile manuel güncelleme yapabilirsiniz

## 🔧 Teknik Detaylar

### Dosya Yapısı
```
Frontend/web/
├── contexts/
│   ├── AuthContext.tsx      # Authentication yönetimi
│   └── FavoritesContext.tsx # Favori yönetimi
├── components/
│   ├── HeartButton.tsx      # Kalp ikonu bileşeni
│   └── CarCard.tsx         # Güncellenmiş araç kartı
├── app/
│   ├── login/page.tsx       # Giriş/Kayıt sayfası
│   ├── favorites/page.tsx   # Favori listesi sayfası
│   └── api/scrape-favorites/route.ts # Favori scraping API
└── lib/
    └── firebase.ts          # Firebase konfigürasyonu

Backend/
└── favorite.js              # Favori scraping sınıfı
```

### Veri Akışı
1. Kullanıcı kalp ikonuna tıklar
2. URL Firestore'a kaydedilir
3. Favori sayfasında URL'ler toplanır
4. Backend'e gönderilir ve fresh data çekilir
5. Güncel veriler gösterilir

## 🚨 Önemli Notlar

- Backend'e dokunulmadı, sadece yeni endpoint eklendi
- Veri saklanmıyor, sadece linkler tutuluyor
- Her favori listesi ziyaretinde fresh data çekiliyor
- Login olmadan favori işlemleri yapılamıyor
