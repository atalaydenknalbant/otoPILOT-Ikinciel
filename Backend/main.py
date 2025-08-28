import json
import textwrap
import logging
import asyncio
import os
import requests
from flask import Flask, request, jsonify
from scrape import ArabamScraper

# --- Kurulum ---
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
app = Flask(__name__)

# --- Ollama ayarları ---
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "tykefencer/otomodel_v1.1_q8")

# --- Bilgi Bankası: Kategori JSON'ını yükle ve işle ---
try:
    with open('arabam_sequence_categories.json', 'r', encoding='utf-8') as f:
        car_categories_data = json.load(f)

    # Marka ve model haritaları (ileride gerekirse kullanırsın; şu an akış LLM JSON’u baz alıyor)
    model_to_brand_map = {}
    all_brands = set()
    for category, brands_list in car_categories_data.get("arabalar", {}).items():
        if isinstance(brands_list, list):
            for brand_info in brands_list:
                if brand_name := brand_info.get("marka"):
                    all_brands.add(brand_name.lower())
                    for model_name in brand_info.get("modeller", []):
                        model_to_brand_map[model_name.lower()] = {
                            "brand": brand_name,
                            "category": category
                        }
    logging.info("Araba kategori bilgi bankası ve marka listesi yüklendi.")
except FileNotFoundError:
    logging.error("arabam_sequence_categories.json dosyası bulunamadı.")
    car_categories_data = {}
    model_to_brand_map = {}
    all_brands = set()


SIRALAMA_DEFAULTS = {
    "Fiyat - Ucuzdan Pahalıya": "price.asc",
    "Fiyat - Pahalıdan Ucuza": "price.desc",
    "Yıl - Yeniden Eskiye": "year.desc",
    "Yıl - Eskiden Yeniye": "year.asc",
    "Kilometre - Düşükten Yükseğe": "km.asc",
    "Kilometre - Yüksekten Düşüğe": "km.desc",
    "Tarih - Yeniden Eskiye": "startedAt.desc",
}



def build_system_prompt(data: dict) -> str:
    """Geçerli seçenekleri JSON'dan çekip sistem talimatına işler."""
    yakit_tipi          = json.dumps(data.get('yakit_tipi', []), ensure_ascii=False)
    renkler             = json.dumps(data.get('renkler', []), ensure_ascii=False)
    vitesler            = json.dumps(data.get('vitesler', []), ensure_ascii=False)
    arac_durumu         = json.dumps(data.get('arac_durumu', []), ensure_ascii=False)
    agir_hasar_kayitli  = json.dumps(data.get('agir_hasar_kayitli', []), ensure_ascii=False)
    boya_degisen_parca  = json.dumps(data.get('boya_degişen_parca', []), ensure_ascii=False)
    takasa_uygun        = json.dumps(data.get('takasa_uygun', []), ensure_ascii=False)
    siralama_map        = json.dumps(data.get('siralama_turleri', SIRALAMA_DEFAULTS), ensure_ascii=False)

    return textwrap.dedent(f"""
    Sen bir yapay zeka araba arama motoru asistanısın. Görevin, kullanıcının doğal dildeki arama sorgusunu
    yorumlayarak yapılandırılmış bir JSON çıktısına dönüştürmektir. Bu JSON, araç ilanlarını filtrelemek için
    kullanılacaktır. Aşağıdaki kurallara ve GEÇERLİ SEÇENEKLER'e harfiyen uy.

    GEÇERLİ SEÇENEKLER
    - GEÇERLİ YAKIT TİPLERİ: {yakit_tipi}
    - GEÇERLİ RENKLER: {renkler}
    - GEÇERLİ VİTES TÜRLERİ: {vitesler}
    - ARAÇ DURUMU SEÇENEKLERİ: {arac_durumu}
    - AĞIR HASAR KAYITLI SEÇENEKLERİ: {agir_hasar_kayitli}
    - BOYA/DEĞİŞEN SEÇENEKLERİ: {boya_degisen_parca}
    - TAKAS SEÇENEKLERİ: {takasa_uygun}
    - SIRALAMA TÜRLERİ: {siralama_map}

    İSTENEN ÇIKTI YAPISI (JSON)
    Çıktı her zaman şu anahtarları içeren TEK bir JSON nesnesi olmalıdır:
    {{"ana_kategori":["string"],"marka":"string","model":"string","searchText":"string","minFiyat":"integer | null",
    "maxFiyat":"integer | null","minYil":"integer | null","maxYil":"integer | null","minKm":"integer | null",
    "maxKm":"integer | null","renkler":["string"],"vites":["string"],"yakit_tipi":["string"],"il":["string"],
    "boya_degişen_parca":["string"],"arac_durumu":["string"],"agir_hasar_kayitli":"string","siralama":"string",
    "takasa_uygun":"string"}}

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

    Yalnızca tek bir geçerli JSON nesnesi döndür. Açıklama ekleme.
    """).strip()


REQUIRED_KEYS = [
    "ana_kategori","marka","model","searchText","minFiyat","maxFiyat","minYil","maxYil",
    "minKm","maxKm","renkler","vites","yakit_tipi","il","boya_degişen_parca","arac_durumu",
    "agir_hasar_kayitli","siralama","takasa_uygun",
]

def normalize_result(obj: dict) -> dict:
    """Eksik anahtarları tamamla ve tipleri stabilize et."""
    out = dict(obj)
    for k in REQUIRED_KEYS:
        if k not in out:
            # Varsayılanları beklenen tipe göre ata
            if k in ["renkler","vites","yakit_tipi","il","boya_degişen_parca","arac_durumu","ana_kategori"]:
                out[k] = []
            elif k in ["minFiyat","maxFiyat","minYil","maxYil","minKm","maxKm"]:
                out[k] = None
            else:
                out[k] = ""
    # "il" tekil gelirse diziye çevir
    if isinstance(out.get("il"), str):
        out["il"] = [out["il"]]
    return out


def translate_keys_to_english(turkish_json: dict) -> dict:
    translation_map = {
        'ana_kategori': 'main_category', 'marka': 'brand', 'model': 'model', 'minYil': 'minYear', 'maxYil': 'maxYear',
        'minFiyat': 'minPrice', 'maxFiyat': 'maxPrice', 'minKm': 'minKm', 'maxKm': 'maxKm',
        'renkler': 'colors', 'vites': 'gear', 'siralama': 'sort', 'arac_durumu': 'status',
        'agir_hasar_kayitli': 'severaldamaged', 'takasa_uygun': 'swap', 'boya_degişen_parca': 'damagestatus',
        'searchText': 'searchText', 'yakit_tipi': 'fuel_type', 'il': 'city'
    }
    return {translation_map.get(k, k): v for k, v in turkish_json.items()}


@app.route('/parse', methods=['POST'])
def parse_query():
    """LLM’e tek adımda JSON üret. LangExtract yok."""
    query = request.json.get('query')
    if not query:
        return jsonify({"error": "Sorgu boş olamaz."}), 400

    logging.info(f'Ayrıştırma isteği alındı: "{query}"')

    system_prompt = build_system_prompt(car_categories_data)
    payload = {
        "model": OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": query}
        ],
        "stream": False,
        "format": "json",
        "options": {
            "temperature": 0,
            "top_p": 1.0,
            "num_ctx": 16000,
            "seed": 1
        }
    }

    try:
        resp = requests.post(f"{OLLAMA_URL}/api/chat", json=payload, timeout=600)
        resp.raise_for_status()
        content = resp.json()["message"]["content"]
        obj = json.loads(content)
        final_json = normalize_result(obj)
        logging.info(f'LLM JSON çıktısı: {json.dumps(final_json, ensure_ascii=False, indent=2)}')
        return jsonify(final_json)
    except Exception as e:
        logging.error(f"LLM ayrıştırma hatası: {e}", exc_info=True)
        return jsonify({"error": f"LLM isteği ayrıştıramadı: {e}"}), 500


async def run_scrape_tasks(scraper, english_keys_json, categories):
    tasks = [scraper.scrape(english_keys_json, category) for category in categories]
    return await asyncio.gather(*tasks)


@app.route('/scrape', methods=['POST'])
def scrape_data():
    turkish_json = request.json
    logging.info(f'Scrape isteği alındı: {turkish_json}')
    try:
        english_keys_json = translate_keys_to_english(turkish_json)
        scraper = ArabamScraper()
        main_categories = english_keys_json.get("main_category", [])

        if not main_categories:
            logging.warning("Scrape için kategori belirtilmedi, varsayılan kategori 'Otomobil' kullanılıyor.")
            main_categories = ["Otomobil"]

        results_per_category = asyncio.run(run_scrape_tasks(scraper, english_keys_json, main_categories))
        all_results = [item for sublist in results_per_category for item in sublist]
        logging.info(f"Toplam {len(all_results)} adet ilan bulundu.")
        return jsonify(all_results)
    except Exception as e:
        logging.error(f"Scraping hatası: {e}", exc_info=True)
        return jsonify({"error": "Scraper çalıştırılamadı."}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)
