"use client"

const MODEL_ID = 'Qwen3-2B-text-from-vl-int4-webgpu'
const MODEL_BASE = `/models/${MODEL_ID}`

const SYSTEM_INSTRUCTION = `Sen bir yapay zeka araba arama motoru asistanısın. Görevin, kullanıcının doğal dildeki arama sorgusunu yorumlayarak yapılandırılmış bir JSON çıktısına dönüştürmektir. Bu JSON, araç ilanlarını filtrelemek için kullanılacaktır. Aşağıda belirtilen kurallara, seçeneklere ve formata harfiyen uy.

GEÇERLİ YAKIT TİPLERİ: ["Benzin", "Dizel", "Elektrik", "Hibrit", "LPG"]
GEÇERLİ RENKLER: ["Altın", "Bej", "Beyaz", "Bordo", "Füme", "Gri", "Gri (Gümüş)", "Gri (metalik)", "Gri (titanyum)", "Kahverengi", "Kırmızı", "Lacivert", "Mavi", "Mavi (metalik)", "Mor", "Pembe", "Şampanya", "Sarı", "Siyah", "Turkuaz", "Turuncu", "Yeşil", "Yeşil (metalik)", "Diğer"]
GEÇERLİ VİTES TÜRLERİ: ["Düz", "Otomatik", "Yarı Otomatik"]
ARAÇ DURUMU SEÇENEKLERİ: ["İkinci El", "Sıfır", "Yetkili Bayiden Sıfır", "Yurtdışından İthal Sıfır"]
AĞIR HASAR KAYITLI SEÇENEKLERİ: ["Evet", "Hayır"]
BOYA/DEĞİŞEN SEÇENEKLERİ: ["Boyasız, Değişensiz ve Tramersiz", "Boyasız ve Değişensiz", "Boyasız", "Değişensiz", "Tramersiz"]
TAKAS SEÇENEKLERİ: ["Takasa Uygun", "Takasa Uygun Değil"]
SIRALAMA TÜRLERİ: {"Fiyat - Ucuzdan Pahalıya": "price.asc", "Fiyat - Pahalıdan Ucuza": "price.desc", "Yıl - Yeniden Eskiye": "year.desc", "Yıl - Eskiden Yeniye": "year.asc", "Kilometre - Düşükten Yükseğe": "km.asc", "Kilometre - Yüksekten Düşüğe": "km.desc", "Tarih - Yeniden Eskiye": "startedAt.desc", "Tarih - Eskiden Yeniye": "startedAt.asc"}

İSTENEN ÇIKTI YAPISI:
{
  "ana_kategori": ["string"],
  "marka": "string",
  "model": "string",
  "searchText": "string",
  "minFiyat": "integer | null",
  "maxFiyat": "integer | null",
  "minYil": "integer | null",
  "maxYil": "integer | null",
  "minKm": "integer | null",
  "maxKm": "integer | null",
  "renkler": ["string"],
  "vites": ["string"],
  "yakit_tipi": ["string"],
  "il": ["string"],
  "boya_degişen_parca": ["string"],
  "arac_durumu": ["string"],
  "agir_hasar_kayitli": "string",
  "siralama": "string",
  "takasa_uygun": "string"
}

KURALLAR:
1) Çıktıdaki ilk anahtar "ana_kategori" olmalıdır.
2) Kullanıcı "kiralık" derse "ana_kategori" sadece ["Kiralık Araçlar"] olmalıdır.
3) Kategori belirsizse varsayılan "ana_kategori" değeri ["Otomobil", "Arazi, SUV, Pick-up", "Minivan & Panelvan"] olmalıdır.
4) Tüm alanlar her zaman çıktıda bulunmalıdır.
5) Belirtilmeyen alanları uygun şekilde boş bırak: sayılar null, diziler [], metinler "".
6) Türkçe anahtarları kullan: "ana_kategori", "marka", "model", "minYil", "maxYil", "minFiyat", "maxFiyat", "minKm", "maxKm", "renkler", "vites", "siralama", "arac_durumu", "agir_hasar_kayitli", "takasa_uygun", "boya_degişen_parca", "searchText", "yakit_tipi", "il".
7) Değerleri asla İngilizceye çevirme.
8) Birden fazla renk/vites/yakıt/il gibi değerleri tek bir dizide birleştir.
9) searchText yalnızca standart filtre dışı tanımlayıcı ifadeler için kullanılmalıdır.
10) Marka, model veya komut kelimelerini searchText alanına yazma.
11) "motor" kelimesini searchText içinde asla yazma; örn: "1.6 motor tdi" -> "1.6 tdi".
12) "otomatik", "düz" gibi ifadeleri "vites" alanına yaz; motor/donanım ifadelerini searchText alanına yaz.
13) Aralık yorumları:
   - "X'ten yeni", "X üstü", "minimum X" => min değeri
   - "X'ten eski", "X altı", "maksimum X" => max değeri
14) Sıralama belirtilirse "siralama" alanını uygun kod ile doldur; belirtilmezse "" bırak.
15) İlçe belirtilse bile yalnızca "il" alanını doldur; ilce anahtarı kullanma.
16) Çıktı yalnızca JSON olmalı; açıklama, ek metin veya markdown ekleme.`

type ProgressState = {
  model: string
  percent: number
  stage: string
  file?: string
  error?: string
}

type ProgressCallback = (state: ProgressState) => void
type TransformersModule = {
  env: any
  pipeline: (task: string, model: string, options: any) => Promise<any>
}

let progressCb: ProgressCallback | null = null
let generator: any | null = null
let initPromise: Promise<void> | null = null
let transformersMod: TransformersModule | null = null

export function getLlmModelId(): string {
  return MODEL_ID
}

export function onLlmProgress(cb: ProgressCallback) {
  progressCb = cb
  return () => {
    if (progressCb === cb) progressCb = null
  }
}

function emitProgress(patch: Partial<ProgressState>) {
  try {
    progressCb?.({
      model: MODEL_ID,
      percent: Math.max(0, Math.min(100, Math.round(patch.percent ?? 0))),
      stage: patch.stage ?? '',
      file: patch.file,
      error: patch.error,
    })
  } catch {}
}

async function getTransformers(): Promise<TransformersModule> {
  if (transformersMod) return transformersMod
  const moduleUrl = '/vendor/transformers.web.js'
  const dynamicImporter = new Function('u', 'return import(/* webpackIgnore: true */ u)') as (u: string) => Promise<unknown>
  transformersMod = (await dynamicImporter(moduleUrl)) as TransformersModule
  return transformersMod
}

function setupRuntimeEnv(tf: TransformersModule) {
  const { env } = tf

  env.allowRemoteModels = false
  env.allowLocalModels = true
  env.localModelPath = '/models/'
  env.useBrowserCache = false

  env.backends.onnx.wasm.wasmPaths = {
    mjs: '/ort/ort-wasm-simd-threaded.asyncify.mjs',
    wasm: '/ort/ort-wasm-simd-threaded.asyncify.wasm',
  }
  env.backends.onnx.wasm.proxy = false
  env.backends.onnx.wasm.numThreads = 1
}

async function ensureChatTemplate(tokenizer: any): Promise<void> {
  if (tokenizer?.chat_template && String(tokenizer.chat_template).trim()) return

  const response = await fetch(`${MODEL_BASE}/chat_template.jinja`, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`chat_template.jinja bulunamadi (${response.status})`)
  }

  tokenizer.chat_template = await response.text()
}

export async function initLocalModel(): Promise<void> {
  if (generator) return
  if (initPromise) return initPromise

  initPromise = (async () => {
    if (!('gpu' in navigator)) {
      throw new Error('Tarayicida WebGPU destegi yok.')
    }

    const tf = await getTransformers()
    setupRuntimeEnv(tf)
    emitProgress({ percent: 1, stage: 'Model yukleme baslatildi.' })

    const pipe = await tf.pipeline('text-generation', MODEL_ID, {
      device: 'webgpu',
      dtype: 'fp32',
      progress_callback: (progress: any) => {
        const pRaw = Number(progress?.progress ?? 0)
        const p = Number.isFinite(pRaw) ? (pRaw <= 1 ? pRaw * 100 : pRaw) : 0
        const file = typeof progress?.file === 'string' ? progress.file : ''
        emitProgress({
          percent: p,
          stage: file ? `Yukleniyor: ${file}` : 'Model dosyalari yukleniyor...',
          file,
        })
      },
    })

    await ensureChatTemplate((pipe as any).tokenizer)
    generator = pipe
    emitProgress({ percent: 100, stage: 'Model WebGPU uzerinde hazir.' })
  })()
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err)
      emitProgress({ percent: 0, stage: 'Model yuklenemedi.', error: message })
      throw err
    })
    .finally(() => {
      initPromise = null
    })

  return initPromise
}

export async function runLocalParse(query: string): Promise<{ json: unknown | null; raw: string }> {
  await initLocalModel()
  if (!generator) throw new Error('Model hazir degil.')

  const messages = [
    { role: 'system', content: SYSTEM_INSTRUCTION },
    {
      role: 'user',
      content: `Kullanici sorgusu: ${query}\nYalnizca gecerli JSON ciktisi dondur.`,
    },
  ]

  const result = await generator(messages, {
    do_sample: false,
    max_new_tokens: 512,
  })

  const raw = normalizeOutput(result)
  const parsed = tryExtractJson(raw)
  return { json: parsed, raw }
}

function normalizeOutput(result: unknown): string {
  if (Array.isArray(result) && result.length > 0) {
    const first = result[0] as any
    const generated = first?.generated_text

    if (Array.isArray(generated) && generated.length > 0) {
      const last = generated[generated.length - 1]
      if (typeof last?.content === 'string') return last.content
    }

    if (typeof generated === 'string') return generated
  }

  return JSON.stringify(result ?? '')
}

function tryExtractJson(rawText: string): unknown | null {
  const start = rawText.indexOf('{')
  if (start < 0) return null

  for (let end = rawText.lastIndexOf('}'); end > start; end = rawText.lastIndexOf('}', end - 1)) {
    const candidate = rawText.slice(start, end + 1)
    try {
      return JSON.parse(candidate)
    } catch {}
  }

  return null
}

