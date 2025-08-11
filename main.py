# main.py
import json
import textwrap
import logging
import asyncio
from flask import Flask, request, jsonify
import langextract as lx
from langextract.inference import OllamaLanguageModel
from scrape import ArabamScraper

# --- Kurulum ---
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
app = Flask(__name__)

# --- Bilgi Bankası: Kategori JSON'ını yükle ve işle ---
try:
    with open('arabam_sequence_categories.json', 'r', encoding='utf-8') as f:
        car_categories_data = json.load(f)
    
    # Modelden markaya ve kategoriye hızlı erişim için bir harita oluştur
    model_to_brand_map = {}
    # Marka/model kontrolü için tüm markaların bir listesini oluştur
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
    logging.info("Araba kategori bilgi bankası ve marka listesi başarıyla oluşturuldu.")
except FileNotFoundError:
    logging.error("arabam_sequence_categories.json dosyası bulunamadı.")
    car_categories_data = {}
    model_to_brand_map = {}
    all_brands = set()


# --- LangExtract Prompt ve Örnekler ---
prompt_description = textwrap.dedent("""
    Sen, bir kullanıcı sorgusundaki araba arama kriterlerini tanımlayan bir uzmansın.
    Metin içindeki her bir kriteri (marka, model, fiyat aralığı, yıl aralığı, renk, vites, hasar durumu, sıralama vb.)
    verilen GEÇERLİ SEÇENEKLER'i referans alarak (RAG) ayrı ayrı etiketleyerek çıkar.
    Sorguda açıkça belirtilmeyen bir bilgiyi ASLA varsayma veya uydurma.

    ---
    **GEÇERLİ SEÇENEKLER (Bu listeyi referans al)**
    - Renkler: {renkler}
    - Vitesler: {vitesler}
    - Araç Durumu: {arac_durumu}
    - Ağır Hasar Kayıtlı: {agir_hasar_kayitli}
    - Takasa Uygunluk: {takasa_uygun}
    - Boya/Değişen Durumu: {boya_degisen_parca}
    - Sıralama Anahtar Kelimeleri: "en yeni ilan", "en düşük km", "en ucuz"
    
    ---
    **KURALLAR**
    1.  **ANA KATEGORİ:** Çıktıdaki ilk anahtar "ana_kategori" olmalıdır.
        -   Kullanıcı "kiralık" derse, "ana_kategori" SADECE \`["Kiralık Araçlar"]\` olmalıdır.
        -   Eğer yukarıdaki koşullar sağlanmazsa ve kategori belirsizse, varsayılan olarak \`["Otomobil", "Arazi, SUV, Pick-up", "Minivan & Panelvan"]\` kullan.
    2.  **TÜM ALANLARI DOLDUR:** Çıktıda BÜTÜN olası anahtarlar bulunmalıdır. Belirtilmeyen alanların değeri boş (""), null veya boş dizi ([]) olmalıdır.
    3.  **TÜRKÇE ANAHTAR KULLAN:** JSON anahtarları daima şu listeden olmalıdır: "ana_kategori", "marka", "model", "minYil", "maxYil", "minFiyat", "maxFiyat", "minKm", "maxKm", "renkler", "vites", "siralama", "arac_durumu", "agir_hasar_kayitli", "takasa_uygun", "boya_degişen_parca", "searchText".
    4.  **ÇEVİRİ YASAK:** Değerleri ASLA İngilizce'ye çevirme. "3 Serisi" -> "3 Serisi" olarak kalmalıdır.
    5.  **DEĞERLERİ BİRLEŞTİR:** Kullanıcı birden çok renk veya vites belirtirse, bunları ilgili anahtar altında TEK BİR DİZİDE birleştir.
    6.  **searchText KULLANIMI:** YALNIZCA "yumurta kasa", "çelik jantlı" gibi standart filtreler DIŞINDAKİ tanımlayıcı ifadeleri bu alana yaz. Marka, model veya komut kelimeleri ("bul", "getir") ASLA bu alana YAZMA. Eğer böyle bir ifade yoksa, alanı boş bırak: "".
    7.  **searchText NORMALİZASYONU:** Kullanıcı "1.6 motor tdi" gibi bir ifade kullanırsa, `searchText` alanına "motor" kelimesini çıkararak "1.6 tdi" şeklinde yaz. motor kelimesini hiçbir zaman yazma.
    8.  **FİLTRE AYRIMI:** "otomatik", "düz" gibi ifadeler "vites" alanına, "1.6 TDi" gibi motor/donanım bilgileri ise 'searchText' alanına yazılmalıdır.
    9.  **ARALIKLARI DOĞRU YORUMLA:** "X'ten yeni", "X üstü", "minimum X" gibi ifadeler min (en az) değerini belirtir (örn: "minYil", "minKm"). "X'ten eski", "X altı", "maksimum X" gibi ifadeler max (en fazla) değerini belirtir (örn: "maxYil", "maxKm"). BU KURAL ÇOK ÖNEMLİDİR.
    10.  **SIRALAMA:** Eğer kullanıcı sıralama belirtirse, "siralama" alanını uygun şekilde doldur. Eğer sıralama yoksa, bu alanı boş bırak: "".
    
    ---                        
""").format(
    renkler=json.dumps(car_categories_data.get('renkler', []), ensure_ascii=False),
    vitesler=json.dumps(car_categories_data.get('vitesler', []), ensure_ascii=False),
    arac_durumu=json.dumps(car_categories_data.get('arac_durumu', []), ensure_ascii=False),
    agir_hasar_kayitli=json.dumps(car_categories_data.get('agir_hasar_kayitli', []), ensure_ascii=False),
    takasa_uygun=json.dumps(car_categories_data.get('takasa_uygun', []), ensure_ascii=False),
    boya_degisen_parca=json.dumps(car_categories_data.get('boya_degişen_parca', []), ensure_ascii=False)
)



examples = [
    lx.data.ExampleData(
        text="boyasız, 2020'den yeni, 3.000.000 TL altındaki maksimum 100000 km beyaz veya siyah renkli bmw 3 serisi otomatik vitesli arabaları bul., en yeni ilana göre sırala",
        extractions=[
            lx.data.Extraction(extraction_class="brand", extraction_text="bmw", attributes={"value": "BMW"}),
            lx.data.Extraction(extraction_class="model", extraction_text="3 serisi", attributes={"value": "3 Serisi"}),
            lx.data.Extraction(extraction_class="year_filter", extraction_text="2020'den yeni", attributes={"min": 2020}),
            lx.data.Extraction(extraction_class="price_filter", extraction_text="3.000.000 TL altındaki", attributes={"max": 3000000}),
            lx.data.Extraction(extraction_class="km_filter", extraction_text="maksimum 100000 km", attributes={"max": 100000}),
            lx.data.Extraction(extraction_class="color", extraction_text="beyaz", attributes={"value": "Beyaz"}),
            lx.data.Extraction(extraction_class="color", extraction_text="siyah", attributes={"value": "Siyah"}),
            lx.data.Extraction(extraction_class="gear", extraction_text="otomatik", attributes={"value": "Otomatik"}),
            lx.data.Extraction(extraction_class="damage_status", extraction_text="boyasız", attributes={"value": "Boyasız"}),
            lx.data.Extraction(extraction_class="sort", extraction_text="en yeni ilana göre", attributes={"value": "startedAt.desc"}),
        ]
    ),
    lx.data.ExampleData(
        text="sahibinden satılık en düşük kmli, takasa uygun, hasar kayıtsız Tucson",
        extractions=[
            lx.data.Extraction(extraction_class="model", extraction_text="Tucson", attributes={"value": "Tucson"}),
            lx.data.Extraction(extraction_class="sort", extraction_text="en düşük kmli", attributes={"value": "km.asc"}),
            lx.data.Extraction(extraction_class="swap", extraction_text="takasa uygun", attributes={"value": "Takasa Uygun"}),
            lx.data.Extraction(extraction_class="severaldamaged", extraction_text="hasar kayıtsız", attributes={"value": "Hayır"}),
        ]
    ),
    lx.data.ExampleData(
        text="1.6 tdi polo",
        extractions=[
            lx.data.Extraction(extraction_class="model", extraction_text="polo", attributes={"value": "Polo"}),
            lx.data.Extraction(extraction_class="search_text", extraction_text="1.6 tdi", attributes={"value": "1.6 tdi"}),
        ]
    )
]

def consolidate_extractions(extractions: list, query_text: str) -> dict:
    """
    LangExtract'ten gelen parça parça sonuçları alır, RAG ve iş kurallarıyla zenginleştirir
    ve tek bir JSON'da birleştirir.
    """
    final_json = {
        "ana_kategori": [], "marka": None, "model": None, "searchText": None,
        "minFiyat": None, "maxFiyat": None, "minYil": None, "maxYil": None,
        "minKm": None, "maxKm": None, "renkler": [], "vites": [],
        "boya_degişen_parca": [], "arac_durumu": [], "agir_hasar_kayitli": None,
        "siralama": None, "takasa_uygun": None
    }
    
    # 1. Ham verileri işle: LLM'in çıkardığı varlıkları final_json'a doldur
    for extraction in extractions:
        cls = extraction.extraction_class
        attrs = extraction.attributes
        
        if cls == 'brand': final_json['marka'] = attrs.get('value')
        elif cls == 'model': final_json['model'] = attrs.get('value')
        elif cls == 'brand_or_model_candidate':
            final_json['model'] = attrs.get('value')
        elif cls == 'year_filter':
            if attrs.get('min') is not None: final_json['minYil'] = attrs['min']
            if attrs.get('max') is not None: final_json['maxYil'] = attrs['max']
        elif cls == 'price_filter':
            if attrs.get('min') is not None: final_json['minFiyat'] = attrs['min']
            if attrs.get('max') is not None: final_json['maxFiyat'] = attrs['max']
        elif cls == 'km_filter':
            if attrs.get('min') is not None: final_json['minKm'] = attrs['min']
            if attrs.get('max') is not None: final_json['maxKm'] = attrs['max']
        elif cls == 'color': final_json['renkler'].append(attrs.get('value'))
        elif cls == 'gear': final_json['vites'].append(attrs.get('value'))
        elif cls == 'damage_status': final_json['boya_degişen_parca'].append(attrs.get('value'))
        elif cls == 'status': final_json['arac_durumu'].append(attrs.get('value'))
        elif cls == 'severe_damage': final_json['agir_hasar_kayitli'] = attrs.get('value')
        elif cls == 'swap': final_json['takasa_uygun'] = attrs.get('value')
        elif cls == 'sort': final_json['siralama'] = attrs.get('value')
        elif cls == 'search_text': final_json['searchText'] = attrs.get('value')

    # 2. Marka/Model Düzeltme ve Zenginleştirme Mantığı
    brand_val = final_json.get('marka')
    model_val = final_json.get('model')

    # Durum 1: Marka ve modelin yerleri karışmış olabilir. (örn: marka: Taycan, model: Porsche)
    if (brand_val and brand_val.lower() in model_to_brand_map and
        model_val and model_val.lower() in all_brands):
        logging.info(f"Marka/Model değişimi algılandı. Düzeltiliyor: {brand_val} <-> {model_val}")
        final_json['marka'], final_json['model'] = model_val, brand_val

    # Durum 2: Model adı yanlışlıkla marka alanına yazılmış olabilir.
    elif brand_val and not model_val and brand_val.lower() in model_to_brand_map:
        logging.info(f"Model adı '{brand_val}' marka alanında bulundu. Düzeltiliyor.")
        info = model_to_brand_map[brand_val.lower()]
        final_json['marka'] = info['brand']
        final_json['model'] = brand_val

    # 3. Kategori Belirleme Mantığı (Düzeltilmiş verilere göre)
    if 'kiralık' in query_text.lower():
        final_json['ana_kategori'] = ["Kiralık Araçlar"]
    else:
        # Model bilgisine göre kategoriyi ve markayı kesinleştir
        model_value = final_json.get('model')
        if model_value and model_value.lower() in model_to_brand_map:
            info = model_to_brand_map[model_value.lower()]
            final_json['marka'] = info['brand'] # Markayı her zaman haritadan gelenle güncelle
            final_json['ana_kategori'] = [info['category']]
        else:
            final_json['ana_kategori'] = ["Otomobil", "Arazi, SUV, Pick-up", "Minivan & Panelvan"]

    # 4. Son temizlik ve formatlama
    for key, value in final_json.items():
        if value is None and key not in ["minFiyat", "maxFiyat", "minYil", "maxYil", "minKm", "maxKm", "marka", "model", "siralama", "takasa_uygun", "agir_hasar_kayitli", "searchText"]:
            final_json[key] = [] if isinstance(final_json.get(key), list) else ""

    return final_json

def translate_keys_to_english(turkish_json: dict) -> dict:
    translation_map = {
        'ana_kategori': 'main_category', 'marka': 'brand', 'model': 'model', 'minYil': 'minYear', 'maxYil': 'maxYear',
        'minFiyat': 'minPrice', 'maxFiyat': 'maxPrice', 'minKm': 'minKm', 'maxKm': 'maxKm',
        'renkler': 'colors', 'vites': 'gear', 'siralama': 'sort', 'arac_durumu': 'status',
        'agir_hasar_kayitli': 'severaldamaged', 'takasa_uygun': 'swap', 'boya_degişen_parca': 'damagestatus',
        'searchText': 'searchText'
    }
    return {translation_map.get(k, k): v for k, v in turkish_json.items()}


@app.route('/parse', methods=['POST'])
def parse_query():
    query = request.json.get('query')
    if not query: return jsonify({"error": "Sorgu boş olamaz."}), 400
    logging.info(f'Ayrıştırma isteği alındı: "{query}"')
    try:
        result = lx.extract(
            text_or_documents=query, prompt_description=prompt_description, examples=examples,
            language_model_type=OllamaLanguageModel, model_id="gemma3:4b-it-fp16",
            temperature=0.0,
            resolver_params={'extraction_index_suffix': None}
        )
        if not result.extractions:
            logging.warning("LangExtract sorgudan herhangi bir varlık çıkaramadı.")
            final_json = consolidate_extractions([], query)
        else:
            final_json = consolidate_extractions(result.extractions, query)
        
        logging.info(f'LangExtract Çıktısı (Birleştirilmiş): {json.dumps(final_json, ensure_ascii=False, indent=2)}')
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