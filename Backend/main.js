import express from 'express';
import { Ollama } from 'ollama';
import { readFile } from 'fs/promises';
import { log } from 'crawlee';
import { ArabamScraper } from './scrape.js';

const app = express();
const PORT = process.env.PORT || 8080;
app.use(express.json({ limit: '150mb' }));

// Ollama configuration 
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'tykefencer/otomodel_v1.2_q8';
const ollama = new Ollama({ host: OLLAMA_URL });

// Load categories JSON (UI options)
const carCategories = JSON.parse(
  await readFile(new URL('./arabam_sequence_categories.json', import.meta.url))
);
// Load full brand-model map grouped by categories for inference
const carCategoriesFull = JSON.parse(
  await readFile(new URL('./arabam_sequence_categories_full_min.json', import.meta.url))
);

// In-flight runs for cancellation
const RUNS = new Map(); // runId -> { activeScrape?: boolean, scrapeAc?: AbortController }

// Sorting defaults
const SIRALAMA_DEFAULTS = {
  'Fiyat - Ucuzdan Pahalıya': 'price.asc',
  'Fiyat - Pahalıdan Ucuza': 'price.desc',
  'Yıl - Yeniden Eskiye': 'year.desc',
  'Yıl - Eskiden Yeniye': 'year.asc',
  'Kilometre - Düşükten Yükseğe': 'km.asc',
  'Kilometre - Yüksekten Düşüğe': 'km.desc',
  'Tarih - Yeniden Eskiye': 'startedAt.desc',
  'Tarih - Eskiden Yeniye': 'startedAt.asc',
};

// Normalize manual filter payloads coming from UI or other clients
function normalizeManualFilters(input) {
  const data = { ...(input || {}) };

  // Map common Turkish labels to sort codes if necessary
  if (data.siralama && SIRALAMA_DEFAULTS[data.siralama]) {
    data.siralama = SIRALAMA_DEFAULTS[data.siralama];
  }

  // Ensure array-typed fields are arrays even if single value is sent
  const arrayKeys = [
    'ana_kategori',
    'renkler',
    'vites',
    'yakit_tipi',
    'il',
    'boya_degişen_parca',
    'arac_durumu',
  ];
  for (const k of arrayKeys) {
    if (k in data && !Array.isArray(data[k])) {
      data[k] = data[k] == null || data[k] === '' ? [] : [data[k]];
    }
  }

  // Coerce numeric-like fields when strings are provided
  const numericKeys = ['minFiyat', 'maxFiyat', 'minYil', 'maxYil', 'minKm', 'maxKm'];
  for (const k of numericKeys) {
    if (k in data && typeof data[k] === 'string') {
      const n = Number(String(data[k]).replace(/[^0-9.-]/g, ''));
      if (!Number.isNaN(n)) data[k] = n;
    }
  }

  return data;
}

// Build the detailed system prompt with valid options from category data
function buildSystemPrompt(data) {
  const get = (obj, key, fallback = []) => (obj && Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : fallback);
  const yakit_tipi = JSON.stringify(get(data, 'yakit_tipi'));
  const renkler = JSON.stringify(get(data, 'renkler'));
  const vitesler = JSON.stringify(get(data, 'vitesler'));
  const arac_durumu = JSON.stringify(get(data, 'arac_durumu'));
  const agir_hasar_kayitli = JSON.stringify(get(data, 'agir_hasar_kayitli'));
  const boyaList = get(data, 'boya_degişen_parca', get(data, 'boya_degisen_parca', get(data, 'boya_degi\u0015Yen_parca', [])));
  const boya_degisen_parca = JSON.stringify(boyaList);
  const takasa_uygun = JSON.stringify(get(data, 'takasa_uygun'));
  const siralama_map = JSON.stringify(data?.siralama_turleri || SIRALAMA_DEFAULTS);

  return (
`Sen bir yapay zeka araba arama motoru asistanısın. Görevin, kullanıcının doğal dildeki arama sorgusunu
yorumlayarak yapılandırılmış bir JSON çıktısına dönüştürmektir. Bu JSON, araç ilanlarını filtrelemek için
kullanılacaktır. Aşağıdaki kurallara ve GEÇERLİ SEÇENEKLER'e harfiyen uy.

GEÇERLİ SEÇENEKLER
- GEÇERLİ YAKIT TİPLERİ: ${yakit_tipi}
- GEÇERLİ RENKLER: ${renkler}
- GEÇERLİ VİTES TÜRLERİ: ${vitesler}
- ARAÇ DURUMU SEÇENEKLERİ: ${arac_durumu}
- AĞIR HASAR KAYITLI SEÇENEKLERİ: ${agir_hasar_kayitli}
- BOYA/DEĞİŞEN SEÇENEKLERİ: ${boya_degisen_parca}
- TAKAS SEÇENEKLERİ: ${takasa_uygun}
- SIRALAMA TÜRLERİ: ${siralama_map}

İSTENEN ÇIKTI YAPISI (JSON)
Çıktı her zaman şu anahtarları içeren TEK bir JSON nesnesi olmalıdır:
{"ana_kategori":["string"],"marka":"string","model":"string","searchText":"string","minFiyat":"integer | null",
"maxFiyat":"integer | null","minYil":"integer | null","maxYil":"integer | null","minKm":"integer | null",
"maxKm":"integer | null","renkler":["string"],"vites":["string"],"yakit_tipi":["string"],"il":["string"],
"boya_degişen_parca":["string"],"arac_durumu":["string"],"agir_hasar_kayitli":"string","siralama":"string",
"takasa_uygun":"string"}

KURALLAR
1.  **ANA KATEGORİ:** Çıktıdaki ilk anahtar "ana_kategori" olmalıdır.
    -   Kullanıcı "kiralık" derse, "ana_kategori" SADECE ["Kiralık Araçlar"] olmalıdır.
    -   Eğer yukarıdaki koşullar sağlanmazsa ve kategori belirsizse, varsayılan olarak \`["Otomobil", "Arazi, SUV, Pick-up", "Minivan & Panelvan"]\` kullan.
2.  **TÜM ALANLARI DOLDUR:** Çıktıda BÜTÜN olası anahtarlar bulunmalıdır. Belirtilmeyen alanların değeri boş (""), null veya boş dizi ([]) olmalıdır.
3.  **TÜRKÇE ANAHTAR KULLAN:** JSON anahtarları daima şu listeden olmalıdır: "ana_kategori", "marka", "model", "minYil", "maxYil", "minFiyat", "maxFiyat", "minKm", "maxKm", "renkler", "vites", "siralama", "arac_durumu", "agir_hasar_kayitli", "takasa_uygun", "boya_degişen_parca", "searchText".
4.  **ÇEVİRİ YASAK:** Değerleri ASLA İngilizce'ye çevirme. "3 Serisi" -> "3 Serisi" olarak kalmalıdır.
5.  **DEĞERLERİ BİRLEŞTİR:** Kullanıcı birden çok renk veya vites belirtirse, bunları ilgili anahtar altında TEK BİR DİZİDE birleştir.
6.  **searchText KULLANIMI:** YALNIZCA "yumurta kasa", "çelik jantlı" gibi standart filtreler DIŞINDAKİ tanımlayıcı ifadeleri bu alana yaz. Marka, model veya komut kelimeleri ("bul", "getir", "sorgula", "listele", "ara") ASLA bu alana YAZMA. Eğer böyle bir ifade yoksa, alanı boş bırak: "".
7.  **searchText NORMALİZASYONU:** Kullanıcı "1.6 motor tdi" gibi bir ifade kullanırsa, "searchText" alanına "motor" kelimesini çıkararak "1.6 tdi" şeklinde yaz. motor kelimesini hiçbir zaman yazma.
8.  **FİLTRE AYRIMI:** "otomatik", "düz" gibi ifadeler "vites" alanına, "1.6 TDi" gibi motor/donanım bilgileri ise 'searchText' alanına yazılmalıdır.
9.  **ARALIKLARI DOĞRU YORUMLA:** "X'ten yeni", "X üstü", "minimum X" gibi ifadeler min (en az) değerini belirtir (örn: "minYil", "minKm"). "X'ten eski", "X altı", "maksimum X" gibi ifadeler max (en fazla) değerini belirtir (örn: "maxYil", "maxKm"). BU KURAL ÇOK ÖNEMLİDİR.
10. **SIRALAMA:** Eğer kullanıcı sıralama belirtirse, "siralama" alanını uygun şekilde doldur. Eğer sıralama yoksa, bu alanı boş bırak: "".
11. **LOKASYON:** Kullanıcı ilçe belirtse bile, JSON çıktısında SADECE "il" alanı bulunsun ve bu alana ilçenin ait olduğu il (örn: "İstanbul-Avrupa") yazılsın. 'ilce' anahtarı çıktıda yer almasın. Birden fazla il olabilir.

Yalnızca tek bir geçerli JSON nesnesi döndür. Açıklama ekleme.`
  );
}

// Translate Turkish keys to English (extended)
function translateKeysToEnglish(turkishJson) {
  const translationMap = {
    'ana_kategori': 'main_category', 'marka': 'brand', 'model': 'model', 'minYil': 'minYear', 'maxYil': 'maxYear',
    'minFiyat': 'minPrice', 'maxFiyat': 'maxPrice', 'minKm': 'minKm', 'maxKm': 'maxKm',
    'renkler': 'colors', 'vites': 'gear', 'siralama': 'sort', 'arac_durumu': 'status',
    'agir_hasar_kayitli': 'severaldamaged', 'takasa_uygun': 'swap', 'boya_degişen_parca': 'damagestatus',
    'searchText': 'searchText', 'yakit_tipi': 'fuel_type', 'il': 'city'
  };
  const out = {};
  for (const k in turkishJson) if (Object.prototype.hasOwnProperty.call(translationMap, k)) out[translationMap[k]] = turkishJson[k];
  return out;
}

// Normalize and fill required keys exactly like Python normalize_result
function normalizeLLMOutput(rawJson) {
  let finalJson = rawJson || {};
  if (finalJson.results && Array.isArray(finalJson.results) && finalJson.results.length > 0) {
    finalJson = finalJson.results[0];
  }
  const REQUIRED_KEYS = [
    'ana_kategori','marka','model','searchText','minFiyat','maxFiyat','minYil','maxYil',
    'minKm','maxKm','renkler','vites','yakit_tipi','il','boya_degişen_parca','arac_durumu',
    'agir_hasar_kayitli','siralama','takasa_uygun'
  ];
  const arrayKeys = new Set(['renkler','vites','yakit_tipi','il','boya_degişen_parca','arac_durumu','ana_kategori']);
  const numericKeys = new Set(['minFiyat','maxFiyat','minYil','maxYil','minKm','maxKm']);
  const out = { ...finalJson };
  for (const k of REQUIRED_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(out, k)) {
      if (arrayKeys.has(k)) out[k] = [];
      else if (numericKeys.has(k)) out[k] = null;
      else out[k] = '';
    }
  }
  // Ensure array-typed fields are arrays
  for (const k of arrayKeys) {
    if (Object.prototype.hasOwnProperty.call(out, k) && !Array.isArray(out[k])) {
      out[k] = out[k] === '' || out[k] == null ? [] : [out[k]];
    }
  }
  return out;
}

// Loose string equality for Turkish text: ignore hyphens and extra spaces, case-insensitive
function eqLoose(a, b) {
  const norm = (s) => String(s ?? '')
    .toLocaleLowerCase('tr')
    .replace(/[‐‑‒–—−]/g, '-') // normalize dash variants
    .replace(/\s*[-]\s*/g, ' ') // treat hyphen as space
    .replace(/\s+/g, ' ') // collapse spaces
    .trim();
  return norm(a) === norm(b);
}

// Infer main categories from brand+model using the full mapping JSON
function inferCategoriesFromBrandModel(brand, model) {
  if (!brand || !model) return [];
  const out = [];
  const groups = carCategoriesFull?.arabalar || {};
  for (const [category, entries] of Object.entries(groups)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') continue;
      if (eqLoose(entry.marka, brand)) {
        const models = Array.isArray(entry.modeller) ? entry.modeller : [];
        if (models.some((m) => eqLoose(m, model))) {
          out.push(category);
          break;
        }
      }
    }
  }
  return out;
}

// Single-pass parse endpoint
app.post('/parse', async (req, res) => {
  const { query } = req.body || {};
  if (!query) return res.status(400).json({ error: 'Sorgu boş olamaz.' });
  log.info(`Ayrıştırma isteği alındı: "${query}"`);
  try {
    const systemPrompt = buildSystemPrompt(carCategories);
    const response = await ollama.chat({
      model: OLLAMA_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query },
      ],
      format: 'json',
      options: { temperature: 0, top_p: 1.0, num_ctx: 16000, seed: 1 },
      stream: false,
    });
    const obj = JSON.parse(response.message.content);
    const finalJson = normalizeLLMOutput(obj);
    log.info('LLM JSON çıktısı:', finalJson);
    res.json(finalJson);
  } catch (error) {
    log.error(`LLM ayrıştırma hatası: ${error.message}`);
    res.status(500).json({ error: 'LLM isteği ayrıştıramadı.' });
  }
});

// Scrape endpoint
app.post('/scrape', async (req, res) => {
  const ac = new AbortController();
  // Abort only when client truly aborts the request stream
  req.on('aborted', () => { try { ac.abort(); } catch {} });
  log.info('Scrape isteği alındı (Turkish Keys):', req.body);
  try { globalThis.__currentScrape = { runId: (req.headers["x-run-id"] || (req.get ? req.get("x-run-id") : undefined)), ac }; } catch {}
  try {
    let turkishJson = normalizeManualFilters(req.body || {});

    // Rental search sanitization: keep only relevant filters
    if (Array.isArray(turkishJson.ana_kategori) && turkishJson.ana_kategori.length === 1 && turkishJson.ana_kategori[0] === 'Kiralık Araçlar') {
      log.info('Kiralık araç araması tespit edildi. Geçersiz filtreler temizleniyor...');
      const validRentalKeys = new Set(['ana_kategori', 'marka', 'model', 'renkler', 'vites', 'siralama', 'searchText']);
      const sanitized = {};
      for (const k in turkishJson) if (validRentalKeys.has(k)) sanitized[k] = turkishJson[k];
      turkishJson = sanitized;
      log.info('Temizlenmiş filtreler:', turkishJson);
    }

    const englishKeysJson = translateKeysToEnglish(turkishJson);
    const scraper = new ArabamScraper();

    // Default category if missing; run categories in parallel
    let mainCategories = englishKeysJson.main_category;
    if (!Array.isArray(mainCategories) || mainCategories.length === 0) {
      // Try to infer categories from brand+model mapping when user provided both
      const inferred = inferCategoriesFromBrandModel(englishKeysJson.brand, englishKeysJson.model);
      if (inferred.length) {
        mainCategories = inferred;
        log.info(`Kategori belirtilmemişti; marka+model ile çıkarıldı: ${JSON.stringify(inferred)}`);
      } else {
        log.warning("Scrape için kategori belirtilmedi, varsayılan 'Otomobil', 'Arazi, SUV, Pick-up', 'Minivan & Panelvan' kullanılıyor.");
        mainCategories = ['Otomobil', 'Arazi, SUV, Pick-up', 'Minivan & Panelvan'];
      }
    }
    
    // Enforce category correction from brand+model if available
    try {
      const __inferred = inferCategoriesFromBrandModel(englishKeysJson.brand, englishKeysJson.model);
      if (englishKeysJson.brand && englishKeysJson.model && Array.isArray(__inferred) && __inferred.length) {
        mainCategories = __inferred;
        log.info('Ana kategori, marka+model ile otomatik düzeltildi: ' + JSON.stringify(__inferred));
      }
    } catch {}

    const resultsPerCategory = await Promise.all(
      mainCategories.map((category) => {
        log.info(`Scraping category: ${category}`);
        return scraper.scrape(englishKeysJson, category, ac.signal);
      })
    );
    const allResults = resultsPerCategory.flat();
    // If categories were inferred and request had none, reflect back to client for UI update
    if ((!Array.isArray(turkishJson.ana_kategori) || turkishJson.ana_kategori.length === 0) && Array.isArray(mainCategories) && mainCategories.length > 0) {
      turkishJson.ana_kategori = mainCategories;
    }
    // Sync used categories back regardless, for UI correction when brand/model changed
    try {
      if (Array.isArray(mainCategories) && mainCategories.length > 0) {
        turkishJson.ana_kategori = mainCategories;
      }
    } catch {}
    res.json({ items: allResults, filters: turkishJson });
  } catch (error) {
    log.error(`Scraping hatası: ${error.message}`);
    res.status(500).json({ error: 'Scraper çalıştırılamadı.' });
  }
});

// Cancel endpoint: stop ongoing scrape/parse for a given run id (best-effort)
app.post('/cancel', async (req, res) => {
  try {
    const runId = req.headers['x-run-id'] || req.body?.runId || (req.get ? req.get('x-run-id') : undefined);
    let stopped = false;
    try {
      const cur = globalThis.__currentScrape;
      if (cur && (!runId || cur.runId === runId)) {
        try { cur.ac?.abort?.(); stopped = true; } catch {}
      }
    } catch {}
    // Attempt to stop via registry map as well
    try {
      if (RUNS && runId && RUNS.has(runId)) {
        const rec = RUNS.get(runId);
        try { rec.scrapeAc?.abort?.(); stopped = true; } catch {}
      }
    } catch {}
    res.json({ ok: true, stopped });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});
app.listen(PORT, () => {
  log.info(`API sunucusu ${PORT} portunda dinliyor`);
});
