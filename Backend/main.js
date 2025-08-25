import express from 'express';
import { Ollama } from 'ollama';
import { readFile } from 'fs/promises';
import { log } from 'crawlee';
import { ArabamScraper } from './scrape.js';

const app = express();
const PORT = process.env.PORT || 8080;
app.use(express.json({ limit: '50mb' }));

const ollama = new Ollama({ host: 'http://localhost:11434' });

const carCategories = JSON.parse(
  await readFile(new URL('./arabam_sequence_categories.json', import.meta.url))
);

function translateKeysToEnglish(turkishJson) {
    const translationMap = {
        'ana_kategori': 'main_category', 'marka': 'brand', 'model': 'model', 'minYil': 'minYear', 'maxYil': 'maxYear',
        'minFiyat': 'minPrice', 'maxFiyat': 'maxPrice', 'minKm': 'minKm', 'maxKm': 'maxKm',
        'renkler': 'colors', 'vites': 'gear', 'siralama': 'sort', 'arac_durumu': 'status', 
        'agir_hasar_kayitli': 'severaldamaged', 'takasa_uygun': 'swap', 'boya_degişen_parca': 'damagestatus', 
        'searchText': 'searchText'
    };
    const englishJson = {};
    for (const key in turkishJson) {
        if (translationMap[key]) {
            englishJson[translationMap[key]] = turkishJson[key];
        }
    }
    return englishJson;
}

function normalizeLLMOutput(rawJson) {
    // Bu fonksiyonun yeni görevi, RAG'dan gelen ve zaten büyük ölçüde doğru olan
    // JSON'daki bazı alanların formatını garanti altına almaktır.
    let finalJson = rawJson;

    // LLM'in hala "results" gibi bir sarmalayıcı kullanma ihtimaline karşı basit bir kontrol.
    if (finalJson.results && Array.isArray(finalJson.results) && finalJson.results.length > 0) {
        finalJson = finalJson.results[0];
    }

    // Dizi olması gereken tüm alanları tanımla.
    const arrayFields = ['renkler', 'vites', 'ana_kategori', 'boya_degişen_parca', 'arac_durumu'];
    
    arrayFields.forEach(field => {
        // Alanın JSON içinde var olup olmadığını kontrol et.
        if (Object.prototype.hasOwnProperty.call(finalJson, field)) {
            // Eğer varsa ve bir dizi (array) değilse, onu diziye çevir.
            if (!Array.isArray(finalJson[field])) {
                // Değer boş bir metin ise boş dizi yap, değilse tek elemanlı bir dizi yap.
                finalJson[field] = finalJson[field] === '' ? [] : [finalJson[field]];
            }
        }
    });

    return finalJson;
}


app.post('/parse', async (req, res) => {
    const { query } = req.body;
    log.info(`Ayrıştırma isteği alındı: "${query}"`);

    try {
        // --- Adım 1: Ön Analiz ve Varlık Çıkarımı ---
        const preAnalysisPrompt = `
        Kullanıcının sorgusundan marka, model, renk, vites, fiyat aralığı (minFiyat, maxFiyat), yıl aralığı (minYil, maxYil) ve kilometre aralığı (minKm, maxKm) gibi araba ile ilgili anahtar bilgileri çıkar ve basit bir JSON nesnesi olarak ver. Sadece bilgileri çıkar, çeviri yapma veya kural uygulama. Sayısal değerler (fiyat, km, yıl) için null veya sayı kullan, dizi kullanma. Diğer tüm metin bazlı değerleri (renk, vites vb.) dizi olarak ver.
        ---
        **ÖRNEKLER (Bu yapıya tam olarak uy)**
        **Sorgu:** "hatasız boyasız, 2020'den yeni, 3.000.000 TL altındaki maksimum 100000 km beyaz veya siyah renkli bmw 3 serisi otomatik vitesli arabaları bul., en yeni ilana göre sırala"
        **Çıktı:** {"ana_kategori":["Otomobil"],"marka":"BMW","model":"3 Serisi","searchText":"","minFiyat":null,"maxFiyat":3000000,"minYil":2020,"maxYil":null,"minKm":null,"maxKm":100000,"renkler":["Beyaz","Siyah"],"vites":["Otomatik"],"boya_degişen_parca":["Boyasız"],"arac_durumu":[],"agir_hasar_kayitli":"","siralama":"startedAt.desc","takasa_uygun":""}

        **Sorgu:** "sahibinden satılık en düşük kmli Tucson"
        **Çıktı:** {"ana_kategori":["Arazi, SUV, Pick-up"],"marka":"Hyundai","model":"Tucson","searchText":"","minFiyat":null,"maxFiyat":null,"minYil":null,"maxYil":null,"minKm":null,"maxKm":null,"renkler":[],"vites":[],"boya_degişen_parca":[],"arac_durumu":["İkinci El"],"agir_hasar_kayitli":"","siralama":"km.asc","takasa_uygun":""}

        **Sorgu:** "klimalı Ford Transit boyasız, değişensiz ve tramersiz"
        **Çıktı:** {"ana_kategori":["Minivan & Panelvan"],"marka":"Ford","model":"Transit","searchText":"klimalı","minFiyat":null,"maxFiyat":null,"minYil":null,"maxYil":null,"minKm":null,"maxKm":null,"renkler":[],"vites":[],"boya_degişen_parca":["Boyasız, Değişensiz ve Tramersiz],"arac_durumu":[],"agir_hasar_kayitli":"","siralama":"","takasa_uygun":""}

        **Sorgu:** "bana Porsche bul 2010dan yeni model 150 binde"
        **Çıktı:** {"ana_kategori":["Otomobil","Arazi, SUV, Pick-up"],"marka":"Porsche","model":null,"searchText":"","minFiyat":null,"maxFiyat":null,"minYil":2010,"maxYil":null,"minKm":null,"maxKm":150000,"renkler":[],"vites":[],"boya_degişen_parca":[],"arac_durumu":[],"agir_hasar_kayitli":"","siralama":"","takasa_uygun":""}

        **Sorgu:** "kiralık Audi 3 milyona kadar"
        **Çıktı:** {"ana_kategori":["Kiralık Araçlar"],"marka":"Audi","model":null,"searchText":"","minFiyat":null,"maxFiyat":3000000,"minYil":null,"maxYil":null,"minKm":null,"maxKm":null,"renkler":[],"vites":[],"boya_degişen_parca":[],"arac_durumu":[],"agir_hasar_kayitli":"","siralama":"","takasa_uygun":""}

        **Sorgu:** "50000 km altı toyota bul"
        **Çıktı:** {"ana_kategori":["Otomobil","Arazi, SUV, Pick-up","Minivan & Panelvan"],"marka":"Toyota","model":null,"searchText":"","minFiyat":null,"maxFiyat":null,"minYil":null,"maxYil":null,"minKm":null,"maxKm":50000,"renkler":[],"vites":[],"boya_degişen_parca":[],"arac_durumu":[],"agir_hasar_kayitli":"","siralama":"","takasa_uygun":""}

        **Sorgu:** "bana 1.6 tdi polo bul"
        **Çıktı:** { "ana_kategori": ["Otomobil"], "marka": "Volkswagen", "model": "Polo", "searchText": "1.6 tdi", "minYil": null, "maxYil": null, "minFiyat": null, "maxFiyat": null, "minKm": null, "maxKm": null, "renkler": [], "vites": [], "boya_degişen_parca": [], "arac_durumu": [], "agir_hasar_kayitli": "",  "siralama": "", "takasa_uygun": "" }
        ---
        **Kullanıcı Sorgusu:** "${query}"
        JSON Çıktısı:`;

        const preAnalysisResponse = await ollama.chat({
            model: 'llama3.2:3b-instruct-fp16',
            messages: [{ role: 'user', content: preAnalysisPrompt }],
            format: 'json'
        });
        const entities = JSON.parse(preAnalysisResponse.message.content);
        log.info('Ön analiz varlıkları:', entities);

        const fieldsToEnsureArray = [
            'ana_kategori', 'renkler', 'vites', 'arac_durumu',
            'boya_degişen_parca'
        ];
        fieldsToEnsureArray.forEach(field => {
            if (entities[field] && !Array.isArray(entities[field])) {
                // Değer boş bir metin ise boş dizi yap, değilse tek elemanlı bir dizi yap.
                entities[field] = entities[field] === '' ? [] : [entities[field]];
            }
        });

        const allVehicleTypes = ["Otomobil", "Arazi, SUV, Pick-up", "Minivan & Panelvan"];
        let retrieved = {
            marka: null, model: null, kategoriler: new Set(), renkler: new Set(), vitesler: new Set(),
            arac_durumu: new Set(), agir_hasar_kayitli: new Set(), takasa_uygun: new Set(), boya_degişen_parca: new Set()
        };

        const findClosestValue = (term, validOptions) => {
            if (!term || !validOptions) return null;
            const lowerTerm = term.toLowerCase();
            for (const option of validOptions) {
                if (option.toLowerCase().includes(lowerTerm)) return option;
            }
            return null;
        };
        
        const markaAdi = entities.marka ? entities.marka[0] : '';
        if (markaAdi) {
            for (const type of Object.keys(carCategories.arabalar)) {
                const categoryData = carCategories.arabalar[type];
                if (Array.isArray(categoryData)) {
                    for (const car of categoryData) {
                        if (car.marka.toLowerCase().includes(markaAdi.toLowerCase())) {
                            retrieved.marka = car.marka;
                            const modelAdi = entities.model ? entities.model[0] : '';
                            if (modelAdi) {
                                for (const m of car.modeller) {
                                    if (m.toLowerCase().includes(modelAdi.toLowerCase())) {
                                        retrieved.model = m;
                                        retrieved.kategoriler.add(type);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        if (retrieved.marka && retrieved.kategoriler.size === 0) {
            for (const type of Object.keys(carCategories.arabalar)) {
                const categoryData = carCategories.arabalar[type];
                if (Array.isArray(categoryData) && categoryData.some(c => c.marka === retrieved.marka)) {
                    retrieved.kategoriler.add(type);
                }
            }
        }

        (entities.renkler || []).forEach(val => { const match = findClosestValue(val, carCategories.renkler); if(match) retrieved.renkler.add(match); });
        (entities.vites || []).forEach(val => { const match = findClosestValue(val, carCategories.vitesler); if(match) retrieved.vitesler.add(match); });
        (entities.arac_durumu || []).forEach(val => { const match = findClosestValue(val, carCategories.arac_durumu); if(match) retrieved.arac_durumu.add(match); });
        (entities.agir_hasar_kayitli || []).forEach(val => { const match = findClosestValue(val, carCategories.agir_hasar_kayitli); if(match) retrieved.agir_hasar_kayitli.add(match); });
        (entities.takasa_uygun || []).forEach(val => { const match = findClosestValue(val, carCategories.takasa_uygun); if(match) retrieved.takasa_uygun.add(match); });
        (entities.boya_degişen_parca || []).forEach(val => { const match = findClosestValue(val, carCategories.boya_degişen_parca); if(match) retrieved.boya_degişen_parca.add(match); });
        // --- Adım 3: Ana Prompt'u Zenginleştirilmiş Veriyle ve Yeni Örneklerle Oluşturma (Augmentation) ---
        const finalPrompt = `
Sen, bir ön analizden gelen ham JSON çıktısını doğrulayan ve son haline getiren bir uzmansın. İstenen formatta ve tüm alanları içeren bir JSON oluşturacaksın.
---
**GİRDİ 1: KULLANICI SORGUSU**
${query}

---
**GİRDİ 2: ÖN ANALİZ ÇIKTISI (Ham Veri)**
Aşağıdaki JSON, kullanıcının sorgusundan çıkarılan ilk tahmindir. Hatalar veya eksikler içerebilir.
${JSON.stringify(entities, null, 2)}

---
**GİRDİ 3: DOĞRULANMIŞ BİLGİLER (Referans Veri)**
Aşağıdaki bilgiler, kod tarafından doğrulanmıştır. Bu bilgilere öncelik ver.
- Marka: ${retrieved.marka ? `"${retrieved.marka}"` : 'null'}
- Model: ${retrieved.model ? `"${retrieved.model}"` : 'null'}
- Modelin Olası Kategorileri: ${JSON.stringify([...retrieved.kategoriler])}

---
**GEÇERLİ SEÇENEKLER**
GEÇERLİ RENKLER: ${JSON.stringify(carCategories.renkler)}
GEÇERLİ VİTES TÜRLERİ: ${JSON.stringify(carCategories.vitesler)}
ARAÇ DURUMU SEÇENEKLERİ: ${JSON.stringify(carCategories.arac_durumu)}
AĞIR HASAR KAYITLI SEÇENEKLERİ: ${JSON.stringify(carCategories.agir_hasar_kayitli)}
BOYA/DEĞİŞEN SEÇENEKLERİ: ${JSON.stringify(carCategories.boya_degişen_parca)}
TAKAS SEÇENEKLERİ: ${JSON.stringify(carCategories.takasa_uygun)}
SIRALAMA TÜRLERİ: {"Fiyat - Ucuzdan Pahalıya": "price.asc", "Fiyat - Pahalıdan Ucuza": "price.desc", "Yıl - Yeniden Eskiye": "year.desc", "Yıl - Eskiden Yeniye": "year.asc", "Kilometre - Düşükten Yükseğe": "km.asc", "Kilometre - Yüksekten Düşüğe": "km.desc", "Tarih - Yeniden Eskiye": "startedAt.desc"}

---
**ÖRNEKLER (Bu yapıya tam olarak uy)**
**Sorgu:** "hatasız boyasız, 2020'den yeni, 3.000.000 TL altındaki maksimum 100000 km beyaz veya siyah renkli bmw 3 serisi otomatik vitesli arabaları bul., en yeni ilana göre sırala"
**Çıktı:** {"ana_kategori":["Otomobil"],"marka":"BMW","model":"3 Serisi","searchText":"","minFiyat":null,"maxFiyat":3000000,"minYil":2020,"maxYil":null,"minKm":null,"maxKm":100000,"renkler":["Beyaz","Siyah"],"vites":["Otomatik"],"boya_degişen_parca":["Boyasız"],"arac_durumu":[],"agir_hasar_kayitli":"","siralama":"startedAt.desc","takasa_uygun":""}

**Sorgu:** "sahibinden satılık en düşük kmli Tucson"
**Çıktı:** {"ana_kategori":["Arazi, SUV, Pick-up"],"marka":"Hyundai","model":"Tucson","searchText":"","minFiyat":null,"maxFiyat":null,"minYil":null,"maxYil":null,"minKm":null,"maxKm":null,"renkler":[],"vites":[],"boya_degişen_parca":[],"arac_durumu":["İkinci El"],"agir_hasar_kayitli":"","siralama":"km.asc","takasa_uygun":""}

**Sorgu:** "klimalı Ford Transit boyasız, değişensiz ve tramersiz"
**Çıktı:** {"ana_kategori":["Minivan & Panelvan"],"marka":"Ford","model":"Transit","searchText":"klimalı","minFiyat":null,"maxFiyat":null,"minYil":null,"maxYil":null,"minKm":null,"maxKm":null,"renkler":[],"vites":[],"boya_degişen_parca":["Boyasız, Değişensiz ve Tramersiz],"arac_durumu":[],"agir_hasar_kayitli":"","siralama":"","takasa_uygun":""}

**Sorgu:** "bana Porsche bul 2010dan yeni model 150 binde"
**Çıktı:** {"ana_kategori":["Otomobil","Arazi, SUV, Pick-up"],"marka":"Porsche","model":null,"searchText":"","minFiyat":null,"maxFiyat":null,"minYil":2010,"maxYil":null,"minKm":null,"maxKm":150000,"renkler":[],"vites":[],"boya_degişen_parca":[],"arac_durumu":[],"agir_hasar_kayitli":"","siralama":"","takasa_uygun":""}

**Sorgu:** "kiralık Audi 3 milyona kadar"
**Çıktı:** {"ana_kategori":["Kiralık Araçlar"],"marka":"Audi","model":null,"searchText":"","minFiyat":null,"maxFiyat":3000000,"minYil":null,"maxYil":null,"minKm":null,"maxKm":null,"renkler":[],"vites":[],"boya_degişen_parca":[],"arac_durumu":[],"agir_hasar_kayitli":"","siralama":"","takasa_uygun":""}

**Sorgu:** "50000 km altı toyota bul"
**Çıktı:** {"ana_kategori":["Otomobil","Arazi, SUV, Pick-up","Minivan & Panelvan"],"marka":"Toyota","model":null,"searchText":"","minFiyat":null,"maxFiyat":null,"minYil":null,"maxYil":null,"minKm":null,"maxKm":50000,"renkler":[],"vites":[],"boya_degişen_parca":[],"arac_durumu":[],"agir_hasar_kayitli":"","siralama":"","takasa_uygun":""}

**Sorgu:** "bana 1.6 tdi polo bul"
**Çıktı:** { "ana_kategori": ["Otomobil"], "marka": "Volkswagen", "model": "Polo", "searchText": "1.6 tdi", "minYil": null, "maxYil": null, "minFiyat": null, "maxFiyat": null, "minKm": null, "maxKm": null, "renkler": [], "vites": [], "boya_degişen_parca": [], "arac_durumu": [], "agir_hasar_kayitli": "",  "siralama": "", "takasa_uygun": "" }

---
**KURALLAR**
1.  **ANA KATEGORİ:** Çıktıdaki ilk anahtar "ana_kategori" olmalıdır.
    -   Kullanıcı "kiralık" derse, "ana_kategori" SADECE \`["Kiralık Araçlar"]\` olmalıdır.
    -   Eğer DOĞRULANMIŞ BİLGİLER'deki "Modelin Olası Kategorileri" listesi doluysa, o listeyi kullan.
    -   Eğer yukarıdaki koşullar sağlanmazsa ve kategori belirsizse, varsayılan olarak \`["Otomobil", "Arazi, SUV, Pick-up", "Minivan & Panelvan"]\` kullan.
2.  **TÜM ALANLARI DOLDUR:** Çıktıda BÜTÜN olası anahtarlar bulunmalıdır. Belirtilmeyen alanların değeri boş (""), null veya boş dizi ([]) olmalıdır.
3.  **TÜRKÇE ANAHTAR KULLAN:** JSON anahtarları daima şu listeden olmalıdır: "ana_kategori", "marka", "model", "minYil", "maxYil", "minFiyat", "maxFiyat", "minKm", "maxKm", "renkler", "vites", "siralama", "arac_durumu", "agir_hasar_kayitli", "takasa_uygun", "boya_degişen_parca", "searchText".
4.  **ÇEVİRİ YASAK:** Değerleri ASLA İngilizce'ye çevirme. "3 Serisi" -> "3 Serisi" olarak kalmalıdır.
5.  **DEĞERLERİ BİRLEŞTİR:** Kullanıcı birden çok renk veya vites belirtirse, bunları ilgili anahtar altında TEK BİR DİZİDE birleştir.
6.  **searchText KULLANIMI:** YALNIZCA "yumurta kasa", "çelik jantlı" gibi standart filtreler DIŞINDAKİ tanımlayıcı ifadeleri bu alana yaz. Marka, model veya komut kelimeleri ("bul", "getir") ASLA bu alana YAZMA. Eğer böyle bir ifade yoksa, alanı boş bırak: "".
7.  **FİLTRE AYRIMI:** "otomatik", "düz" gibi ifadeler "vites" alanına, "1.6 TDi" gibi motor/donanım bilgileri ise 'searchText' alanına yazılmalıdır.
8.  **ARALIKLARI DOĞRU YORUMLA:** "X'ten yeni", "X üstü", "minimum X" gibi ifadeler min (en az) değerini belirtir (örn: "minYil", "minKm"). "X'ten eski", "X altı", "maksimum X" gibi ifadeler max (en fazla) değerini belirtir (örn: "maxYil", "maxKm"). BU KURAL ÇOK ÖNEMLİDİR.

---
**NİHAİ JSON ÇIKTISI:**
`;
        
        const response = await ollama.chat({
            model: 'llama3.2:3b-instruct-fp16',
            messages: [{ role: 'user', content: finalPrompt }],
            format: 'json'
        });
        const rawJson = JSON.parse(response.message.content);
        log.info('Ana LLM Çıktısı:', rawJson);
        
        const finalJson = normalizeLLMOutput(rawJson);
        
        if (!finalJson.marka && !finalJson.siralama && !finalJson.searchText) {
            log.warning(`LLM could not identify a valid filter from the query: "${query}"`);
            return res.status(400).json({ error: 'Sorguda geçerli bir kriter bulunamadı.' });
        }
        
        log.info('Normalized LLM output (Turkish Keys):', finalJson);
        res.json(finalJson);

    } catch (error) {
        log.error(`LLM ayrıştırma hatası: ${error.message}`);
        res.status(500).json({ error: 'LLM isteği ayrıştıramadı.' });
    }
});

app.post('/scrape', async (req, res) => {
    log.info('Scrape isteği alındı (Turkish Keys):', req.body);
    try {
        let turkishJson = req.body;

        // --- YENİ: Kiralık Araçlar için Filtre Temizleme Mantığı ---
        // Eğer ana kategori sadece "Kiralık Araçlar" ise, geçersiz filtreleri temizle.
        if (
            Array.isArray(turkishJson.ana_kategori) &&
            turkishJson.ana_kategori.length === 1 &&
            turkishJson.ana_kategori[0] === 'Kiralık Araçlar'
        ) {
            log.info('Kiralık araç araması tespit edildi. Geçersiz filtreler temizleniyor...');
            
            const validRentalKeys = new Set([
                'ana_kategori', 'marka', 'model', 'renkler', 'vites', 'siralama', 'searchText'
            ]);
            
            // Gelen JSON'daki anahtarları gez ve sadece geçerli olanları yeni bir objeye al
            let sanitizedJson = {};
            for (const key in turkishJson) {
                if (validRentalKeys.has(key)) {
                    sanitizedJson[key] = turkishJson[key];
                }
            }
            turkishJson = sanitizedJson; // Temizlenmiş JSON'ı kullan
            log.info('Temizlenmiş filtreler:', turkishJson);
        }

        const englishKeysJson = translateKeysToEnglish(turkishJson);
        const scraper = new ArabamScraper();
        
        const mainCategories = englishKeysJson.main_category || ["Otomobil", "Arazi, SUV, Pick-up", "Minivan & Panelvan"];
        let allResults = [];

        for (const category of mainCategories) {
            log.info(`Scraping category: ${category}`);
            const categoryResults = await scraper.scrape(englishKeysJson, category);
            allResults.push(...categoryResults);
        }
        
        res.json(allResults);
    } catch (error) {
        log.error(`Scraping hatası: ${error.message}`);
        res.status(500).json({ error: 'Scraper çalıştırılamadı.' });
    }
});

app.listen(PORT, () => {
    log.info(`API sunucusu ${PORT} portunda dinliyor`);
});