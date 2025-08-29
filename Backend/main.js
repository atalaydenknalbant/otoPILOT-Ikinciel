import express from 'express';
import { Ollama } from 'ollama';
import { readFile } from 'fs/promises';
import { log } from 'crawlee';
import { ArabamScraper } from './scrape.js';

const app = express();
const PORT = process.env.PORT || 8080;
app.use(express.json({ limit: '50mb' }));

// Ollama configuration (single-pass like Python)
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'tykefencer/otomodel_v1.1_q8';
const ollama = new Ollama({ host: OLLAMA_URL });

// Load categories JSON
const carCategories = JSON.parse(
  await readFile(new URL('./arabam_sequence_categories.json', import.meta.url))
);

// Sorting defaults (synced with Python SIRALAMA_DEFAULTS)
const SIRALAMA_DEFAULTS = {
  'Fiyat - Ucuzdan Pahalıya': 'price.asc',
  'Fiyat - Pahalıdan Ucuza': 'price.desc',
  'Yıl - Yeniden Eskiye': 'year.desc',
  'Yıl - Eskiden Yeniye': 'year.asc',
  'Kilometre - Düşükten Yükseğe': 'km.asc',
  'Kilometre - Yüksekten Düşüğe': 'km.desc',
  'Tarih - Yeniden Eskiye': 'startedAt.desc',
};

// Build the detailed system prompt with valid options from category data (exactly as in Python)
function buildSystemPrompt(data) {
  const get = (obj, key, fallback = []) => (obj && Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : fallback);
  const yakit_tipi = JSON.stringify(get(data, 'yakit_tipi'));
  const renkler = JSON.stringify(get(data, 'renkler'));
  const vitesler = JSON.stringify(get(data, 'vitesler'));
  const arac_durumu = JSON.stringify(get(data, 'arac_durumu'));
  const agir_hasar_kayitli = JSON.stringify(get(data, 'agir_hasar_kayitli'));
  // Handle possible encoding variants in repo JSON
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
1. ANA KATEGORİ: İlk anahtar "ana_kategori" olmalıdır. Kullanıcı "kiralık" derse SADECE ["Kiralık Araçlar"] yaz.
   Belirsizse ["Otomobil","Arazi, SUV, Pick-up","Minivan & Panelvan"] kullan.
2. TÜM ALANLAR: Tüm anahtarlar bulunmalı. Belirtilmeyen alanlar null, "" veya [] olmalı.
3. TÜRKÇE ANAHTAR: Anahtarlar sadece listelenen Türkçe anahtarlar olmalı.
4. ÇEVİRİ YASAK: Değerleri İngilizceye çevirme.
5. ÇOKLU DEĞER: Renk ve vites gibi çoklu değerleri tek dizide birleştir.
6. searchText: Sadece standart filtre dışındaki tanımlayıcı ifadeler. Marka model veya komut kelimeleri olmasın.
7. "motor" kelimesini searchText’e yazma. "1.6 motor tdi" -> "1.6 tdi".
8. Filtre ayrımı: "otomatik","düz" -> vites. "1.6 TDi" gibi ifadeler -> searchText.
9. Aralık yorumları: "X'ten yeni","X üstü","minimum X" -> min. "X'ten eski","X altı","maksimum X" -> max.
10. Sıralama: Verilmediyse "" bırak.
11. Lokasyon: İlçe verilse bile çıktıda SADECE "il" olsun ve ili yaz. Birden fazla il olabilir.

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

// Single-pass parse endpoint (no pre-analysis)
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
  log.info('Scrape isteği alındı (Turkish Keys):', req.body);
  try {
    let turkishJson = req.body || {};

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
      log.warning("Scrape için kategori belirtilmedi, varsayılan 'Otomobil' kullanılıyor.");
      mainCategories = ['Otomobil'];
    }

    const resultsPerCategory = await Promise.all(
      mainCategories.map((category) => {
        log.info(`Scraping category: ${category}`);
        return scraper.scrape(englishKeysJson, category);
      })
    );
    const allResults = resultsPerCategory.flat();
    res.json(allResults);
  } catch (error) {
    log.error(`Scraping hatası: ${error.message}`);
    res.status(500).json({ error: 'Scraper çalıştırılamadı.' });
  }
});

app.listen(PORT, () => {
  log.info(`API sunucusu ${PORT} portunda dinliyor`);
});

