// Centralized filter constants used across filter UI

export const RENKLER = [
  "Altın", "Bej", "Beyaz", "Bordo", "Füme", "Gri", "Gri (Gümüş)", "Gri (metalik)",
  "Gri (titanyum)", "Kahverengi", "Kırmızı", "Lacivert", "Mavi", "Mavi (metalik)",
  "Mor", "Pembe", "Şampanya", "Sarı", "Siyah", "Turkuaz", "Turuncu", "Yeşil",
  "Yeşil (metalik)", "Diğer"
]

export const VITES = ["Düz", "Otomatik", "Yarı Otomatik"]

export const ARAC_DURUMU = [
  "İkinci El", "Sıfır", "Yetkili Bayiden Sıfır", "Yurtdışından İthal Sıfır"
]

export const AGIR_HASAR = ["Evet", "Hayır"]

export const TAKAS = ["Takasa Uygun", "Takasa Uygun Değil"]

export const ANA_KATEGORI = [
  "Kiralık Araçlar", "Otomobil", "Arazi, SUV, Pick-up", "Minivan & Panelvan"
]

export const YAKIT_TIPLERI = ["Benzin", "Dizel", "Elektrik", "Hibrit", "LPG"]

export const BOYA_DEGISEN = [
  "Boyasız, Değişensiz ve Tramersiz",
  "Boyasız ve Değişensiz",
  "Boyasız",
  "Değişensiz",
  "Tramersiz",
]

export const SIRALAMA_MAP: Record<string, string> = {
  "Fiyat - Ucuzdan Pahalıya": "price.asc",
  "Fiyat - Pahalıdan Ucuza": "price.desc",
  "Yıl - Yeniden Eskiye": "year.desc",
  "Yıl - Eskiden Yeniye": "year.asc",
  "Kilometre - Düşükten Yükseğe": "km.asc",
  "Kilometre - Yüksekten Düşüğe": "km.desc",
  "Tarih - Yeniden Eskiye": "startedAt.desc",
}
