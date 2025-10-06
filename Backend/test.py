import json
import pandas as pd
import random
import math

def create_final_dataset_with_structure():
    """
    Generates a large-scale (1M+ rows) dataset using a comprehensive set of
    parameters, including the newly added "yakit_tipi" (fuel type).
    """
    try:
        with open('arabam_sequence_categories.json', 'r', encoding='utf-8') as f:
            car_categories = json.load(f)
    except FileNotFoundError:
        print("Hata: 'arabam_sequence_categories.json' dosyası bulunamadı. Lütfen dosyanın doğru yolda olduğundan emin olun.")
        return

    system_message = """
Sen bir yapay zeka araba arama motoru asistanısın. Görevin, kullanıcının doğal dildeki arama sorgusunu yorumlayarak yapılandırılmış bir JSON çıktısına dönüştürmektir. Bu JSON, araç ilanlarını filtrelemek için kullanılacaktır. Aşağıda belirtilen kurallara, seçeneklere ve formata harfiyen uy.

**GEÇERLİ SEÇENEKLER**

GEÇERLİ YAKIT TİPLERİ: ["Benzin", "Dizel", "Elektrik", "Hibrit", "LPG"]
GEÇERLİ RENKLER: ["Altın", "Bej", "Beyaz", "Bordo", "Füme", "Gri", "Gri (Gümüş)", "Gri (metalik)", "Gri (titanyum)", "Kahverengi", "Kırmızı", "Lacivert", "Mavi", "Mavi (metalik)", "Mor", "Pembe", "Şampanya", "Sarı", "Siyah", "Turkuaz", "Turuncu", "Yeşil", "Yeşil (metalik)", "Diğer"]
GEÇERLİ VİTES TÜRLERİ: ["Düz", "Otomatik", "Yarı Otomatik"]
ARAÇ DURUMU SEÇENEKLERİ: ["İkinci El", "Sıfır", "Yetkili Bayiden Sıfır", "Yurtdışından İthal Sıfır"]
AĞIR HASAR KAYITLI SEÇENEKLERİ: ["Evet", "Hayır"]
BOYA/DEĞİŞEN SEÇENEKLERİ: ["Boyasız, Değişensiz ve Tramersiz", "Boyasız ve Değişensiz", "Boyasız", "Değişensiz", "Tramersiz"]
TAKAS SEÇENEKLERİ: ["Takasa Uygun", "Takasa Uygun Değil"]
SIRALAMA TÜRLERİ: {"Fiyat - Ucuzdan Pahalıya": "price.asc", "Fiyat - Pahalıdan Ucuza": "price.desc", "Yıl - Yeniden Eskiye": "year.desc", "Yıl - Eskiden Yeniye": "year.asc", "Kilometre - Düşükten Yükseğe": "km.asc", "Kilometre - Yüksekten Düşüğe": "km.desc", "Tarih - Yeniden Eskiye": "startedAt.desc"}

---
**İSTENEN ÇIKTI YAPISI (JSON FORMATI)**

Çıktın daima aşağıdaki anahtarları içeren ve belirtilen veri tiplerine uygun bir JSON objesi olmalıdır. Kullanıcı bir değeri belirtmemişse, `null` (sayısal değerler için), `[]` (diziler için) veya `""` (metinler için) kullanılmalıdır.

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
    "il": "string | null", 
    "boya_degişen_parca": ["string"],
    "arac_durumu": ["string"],
    "agir_hasar_kayitli": "string",
    "siralama": "string",
    "takasa_uygun": "string"
}

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
11. **LOKASYON:** Kullanıcı ilçe belirtse bile, JSON çıktısında SADECE `il` alanı bulunsun ve bu alana ilçenin ait olduğu il (örn: "İstanbul-Avrupa") yazılsın. `ilce` anahtarı çıktıda yer almasın.

"""
    def create_base_json():
        return {
            "ana_kategori": [], "marka": None, "model": None, "searchText": "",
            "minFiyat": None, "maxFiyat": None, "minYil": None, "maxYil": None,
            "minKm": None, "maxKm": None, "renkler": [], "vites": [], "yakit_tipi": [],
            "il": None, "boya_degişen_parca": [], "arac_durumu": [], "agir_hasar_kayitli": "",
            "siralama": "", "takasa_uygun": ""
        }

        
    with open(r"C:\Users\yineh\OneDrive\Masaüstü\butun_veri.json", "r", encoding="utf-8") as f:
        manual_examples = json.load(f)
    
    # Add manual examples to the dataset
    dataset = []
    
    for ex in manual_examples:
        dataset.append({
            "system": system_message,
            "user": ex["user"],
            "assistant": json.dumps(ex["assistant"], ensure_ascii=False)
        })   
        
     
    
    # --- USER-PROVIDED FULL PARAMETERS ---
    fiyatlar_satis = [500000, 1000000, 1500000, 2000000, 2500000, 3000000, 3500000, 4000000, 4500000, 5000000, 6000000, 7000000, 8000000, 9000000, 10000000, 25000000, 50000000, 100000000, 200000000]
    fiyatlar_kiralik = [99, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000, 6500, 7000, 7500, 8000, 8500, 9000, 9500, 10000, 20000, 30000, 40000, 60000]
    yillar = list(range(2000, 2025))
    kilometreler = [10000, 20000, 30000, 50000, 80000, 90000, 100000, 150000, 200000, 250000, 300000]
    
    # Applying the normalization rule to the search texts
    search_texts_raw = ["1.6 tdi", "cam tavanlı", "deri koltuk", "multimedya ekranlı", "1.5 dci", "1.4 tsi", "2.0 cdi", "Hatasız", "1.6 motor", "1.4 motor", "1.5 motor", "1.8 motor", "2.0 motor", "3.0 motor", "4x4", "yeni kasa", "eski kasa", "sıfır km", "az yakan", "Garantili", "düşük yakıt tüketen", "yeni model", "yeni kasa model"]
    search_texts = [(text.replace(" ", " motor "), text) if text.split(" ")[0][1] == '.' else (text, text) for text in search_texts_raw]
    yakit_tipi_options = {"benzin": ["Benzin"], "dizel": ["Dizel"], "elektrik": ["Elektrik"], "hibrit": ["Hibrit"], "lpg": ["LPG"]}
    siralama_options = { "en yeni ilana göre sırala": "startedAt.desc", "fiyata göre artan sırala": "price.asc", "fiyata göre azalan sırala": "price.desc", "yılı en yeni olandan sırala": "year.desc", "en düşük km'den sırala": "km.asc" }
    arac_durumu_options = { "ikinci el": ["İkinci El"], "sıfır": ["Sıfır"], "sahibinden": ["İkinci El"], "bayiden": ["Yetkili Bayiden Sıfır"] }
    agir_hasar_options = {"ağır hasarlı": "Evet", "ağır hasarsız": "Hayır"}
    takas_options = {"takaslı": "Takasa Uygun", "takassız": "Takasa Uygun Değil"}
    boya_degisen_options = { "boyasız": ["Boyasız"], "değişensiz": ["Değişensiz"], "tramersiz": ["Tramersiz"], "hatasız": ["Boyasız, Değişensiz ve Tramersiz"], "boyasız ve değişensiz": ["Boyasız ve Değişensiz"] }
    renkler = car_categories["renkler"]
    vitesler = car_categories["vitesler"]
    LOCATIONS = {
    "Adana": ["Aladağ", "Ceyhan", "Çukurova", "Feke", "İmamoğlu", "Karaisalı", "Karataş", "Kozan", "Pozantı", "Saimbeyli", "Sarıçam", "Seyhan", "Tufanbeyli", "Yumurtalık", "Yüreğir"],
    "Adıyaman": ["Besni", "Çelikhan", "Gerger", "Gölbaşı", "Kahta", "Merkez", "Samsat", "Sincik", "Tut"],
    "Afyonkarahisar": ["Başmakçı", "Bayat", "Bolvadin", "Çay", "Çobanlar", "Dazkırı", "Dinar", "Emirdağ", "Evciler", "Hocalar", "İhsaniye", "İscehisar", "Kızılören", "Merkez", "Sandıklı", "Sinanpaşa", "Sultandağı", "Şuhut"],
    "Ağrı": ["Diyadin", "Doğubayazıt", "Eleşkirt", "Hamur", "Merkez", "Patnos", "Taşlıçay", "Tutak"],
    "Amasya": ["Göynücek", "Gümüşhacıköy", "Hamamözü", "Merkez", "Merzifon", "Suluova", "Taşova"],
    "Ankara": ["Akyurt", "Altındağ", "Ayaş", "Bala", "Beypazarı", "Çamlıdere", "Çankaya", "Çubuk", "Elmadağ", "Etimesgut", "Evren", "Gölbaşı", "Güdül", "Haymana", "Kahramankazan", "Kalecik", "Keçiören", "Kızılcahamam", "Mamak", "Nallıhan", "Polatlı", "Pursaklar", "Sincan", "Şereflikoçhisar", "Yenimahalle"],
    "Antalya": ["Akseki", "Aksu", "Alanya", "Döşemealtı", "Elmalı", "Finike", "Gazipaşa", "Gündoğmuş", "İbradı", "Demre", "Kaş", "Kemer", "Kepez", "Konyaaltı", "Korkuteli", "Kumluca", "Manavgat", "Muratpaşa", "Serik"],
    "Artvin": ["Ardanuç", "Arhavi", "Borçka", "Hopa", "Kemalpaşa", "Merkez", "Murgul", "Şavşat", "Yusufeli"],
    "Aydın": ["Bozdoğan", "Buharkent", "Çine", "Didim", "Efeler", "Germencik", "İncirliova", "Karacasu", "Karpuzlu", "Koçarlı", "Köşk", "Kuşadası", "Kuyucak", "Nazilli", "Söke", "Sultanhisar", "Yenipazar"],
    "Balıkesir": ["Altıeylül", "Ayvalık", "Balya", "Bandırma", "Bigadiç", "Burhaniye", "Dursunbey", "Edremit", "Erdek", "Gömeç", "Gönen", "Havran", "İvrindi", "Karesi", "Kepsut", "Manyas", "Marmara", "Savaştepe", "Sındırgı", "Susurluk"],
    "Bilecik": ["Bozüyük", "Gölpazarı", "İnhisar", "Merkez", "Osmaneli", "Pazaryeri", "Söğüt", "Yenipazar"],
    "Bingöl": ["Adaklı", "Genç", "Karlıova", "Kiğı", "Merkez", "Solhan", "Yayladere", "Yedisu"],
    "Bitlis": ["Adilcevaz", "Ahlat", "Güroymak", "Hizan", "Merkez", "Mutki", "Tatvan"],
    "Bolu": ["Dörtdivan", "Gerede", "Göynük", "Kıbrıscık", "Mengen", "Merkez", "Mudurnu", "Seben", "Yeniçağa"],
    "Burdur": ["Ağlasun", "Altınyayla", "Bucak", "Çavdır", "Çeltikçi", "Gölhisar", "Karamanlı", "Kemer", "Merkez", "Tefenni", "Yeşilova"],
    "Bursa": ["Büyükorhan", "Gemlik", "Gürsu", "Harmancık", "İnegöl", "İznik", "Karacabey", "Keles", "Kestel", "Mudanya", "Mustafakemalpaşa", "Nilüfer", "Orhaneli", "Orhangazi", "Osmangazi", "Yenişehir", "Yıldırım"],
    "Çanakkale": ["Ayvacık", "Bayramiç", "Biga", "Bozcaada", "Çan", "Eceabat", "Ezine", "Gelibolu", "Gökçeada", "Lapseki", "Merkez", "Yenice"],
    "Çankırı": ["Atkaracalar", "Bayramören", "Çerkeş", "Eldivan", "Ilgaz", "Kızılırmak", "Korgun", "Kurşunlu", "Merkez", "Orta", "Şabanözü", "Yapraklı"],
    "Çorum": ["Alaca", "Bayat", "Boğazkale", "Dodurga", "İskilip", "Kargı", "Laçin", "Mecitözü", "Merkez", "Oğuzlar", "Ortaköy", "Osmancık", "Sungurlu", "Uğurludağ"],
    "Denizli": ["Acıpayam", "Babadağ", "Baklan", "Bekilli", "Beyağaç", "Bozkurt", "Buldan", "Çal", "Çameli", "Çardak", "Çivril", "Güney", "Honaz", "Kale", "Merkezefendi", "Pamukkale", "Sarayköy", "Serinhisar", "Tavas"],
    "Diyarbakır": ["Bağlar", "Bismil", "Çermik", "Çınar", "Çüngüş", "Dicle", "Eğil", "Ergani", "Hani", "Hazro", "Kayapınar", "Kocaköy", "Kulp", "Lice", "Silvan", "Sur", "Yenişehir"],
    "Edirne": ["Enez", "Havsa", "İpsala", "Keşan", "Lalapaşa", "Meriç", "Merkez", "Süloğlu", "Uzunköprü"],
    "Elazığ": ["Ağın", "Alacakaya", "Arıcak", "Baskil", "Karakoçan", "Keban", "Kovancılar", "Maden", "Merkez", "Palu", "Sivrice"],
    "Erzincan": ["Çayırlı", "İliç", "Kemah", "Kemaliye", "Merkez", "Otlukbeli", "Refahiye", "Tercan", "Üzümlü"],
    "Erzurum": ["Aşkale", "Aziziye", "Çat", "Hınıs", "Horasan", "İspir", "Karaçoban", "Karayazı", "Köprüköy", "Narman", "Oltu", "Olur", "Palandöken", "Pasinler", "Pazaryolu", "Şenkaya", "Tekman", "Tortum", "Uzundere", "Yakutiye"],
    "Eskişehir": ["Alpu", "Beylikova", "Çifteler", "Günyüzü", "Han", "İnönü", "Mahmudiye", "Mihalgazi", "Mihalıççık", "Odunpazarı", "Sarıcakaya", "Seyitgazi", "Sivrihisar", "Tepebaşı"],
    "Gaziantep": ["Araban", "İslahiye", "Karkamış", "Nizip", "Nurdağı", "Oğuzeli", "Şahinbey", "Şehitkamil", "Yavuzeli"],
    "Giresun": ["Alucra", "Bulancak", "Çamoluk", "Çanakçı", "Dereli", "Doğankent", "Espiye", "Eynesil", "Görele", "Güce", "Keşap", "Merkez", "Piraziz", "Şebinkarahisar", "Tirebolu", "Yağlıdere"],
    "Gümüşhane": ["Kelkit", "Köse", "Kürtün", "Merkez", "Şiran", "Torul"],
    "Hakkari": ["Çukurca", "Derecik", "Merkez", "Şemdinli", "Yüksekova"],
    "Hatay": ["Altınözü", "Antakya", "Arsuz", "Belen", "Defne", "Dörtyol", "Erzin", "Hassa", "İskenderun", "Kırıkhan", "Kumlu", "Payas", "Reyhanlı", "Samandağ", "Yayladağı"],
    "Isparta": ["Aksu", "Atabey", "Eğirdir", "Gelendost", "Gönen", "Keçiborlu", "Merkez", "Senirkent", "Sütçüler", "Şarkikaraağaç", "Uluborlu", "Yalvaç", "Yenişarbademli"],
    "Mersin": ["Akdeniz", "Anamur", "Aydıncık", "Bozyazı", "Çamlıyayla", "Erdemli", "Gülnar", "Mezitli", "Mut", "Silifke", "Tarsus", "Toroslar", "Yenişehir"],
    "İstanbul": ["Arnavutköy", "Avcılar", "Bağcılar", "Bahçelievler", "Bakırköy", "Başakşehir", "Bayrampaşa", "Beşiktaş", "Beylikdüzü", "Beyoğlu", "Büyükçekmece", "Çatalca", "Esenler", "Esenyurt", "Eyüpsultan", "Fatih", "Gaziosmanpaşa", "Güngören", "Kağıthane", "Küçükçekmece", "Sarıyer", "Silivri", "Sultangazi", "Şişli", "Zeytinburnu", "Adalar", "Ataşehir", "Beykoz", "Çekmeköy", "Kadıköy", "Kartal", "Maltepe", "Pendik", "Sancaktepe", "Sultanbeyli", "Şile", "Tuzla", "Ümraniye", "Üsküdar"],
    "İstanbul-Avrupa": ["Arnavutköy", "Avcılar", "Bağcılar", "Bahçelievler", "Bakırköy", "Başakşehir", "Bayrampaşa", "Beşiktaş", "Beylikdüzü", "Beyoğlu", "Büyükçekmece", "Çatalca", "Esenler", "Esenyurt", "Eyüpsultan", "Fatih", "Gaziosmanpaşa", "Güngören", "Kağıthane", "Küçükçekmece", "Sarıyer", "Silivri", "Sultangazi", "Şişli", "Zeytinburnu"],
    "İstanbul-Asya": ["Adalar", "Ataşehir", "Beykoz", "Çekmeköy", "Kadıköy", "Kartal", "Maltepe", "Pendik", "Sancaktepe", "Sultanbeyli", "Şile", "Tuzla", "Ümraniye", "Üsküdar"],
    "İzmir": ["Aliağa", "Balçova", "Bayındır", "Bayraklı", "Bergama", "Beydağ", "Bornova", "Buca", "Çeşme", "Çiğli", "Dikili", "Foça", "Gaziemir", "Güzelbahçe", "Karabağlar", "Karaburun", "Karşıyaka", "Kemalpaşa", "Kınık", "Kiraz", "Konak", "Menderes", "Menemen", "Narlıdere", "Ödemiş", "Seferihisar", "Selçuk", "Tire", "Torbalı", "Urla"],
    "Kars": ["Akyaka", "Arpaçay", "Digor", "Kağızman", "Merkez", "Sarıkamış", "Selim", "Susuz"],
    "Kastamonu": ["Abana", "Ağlı", "Araç", "Azdavay", "Bozkurt", "Cide", "Çatalzeytin", "Daday", "Devrekani", "Doğanyurt", "Hanönü", "İhsangazi", "İnebolu", "Küre", "Merkez", "Pınarbaşı", "Seydiler", "Şenpazar", "Taşköprü", "Tosya"],
    "Kayseri": ["Akkışla", "Bünyan", "Develi", "Felahiye", "Hacılar", "İncesu", "Kocasinan", "Melikgazi", "Özvatan", "Pınarbaşı", "Sarıoğlan", "Sarız", "Talas", "Tomarza", "Yahyalı", "Yeşilhisar"],
    "Kırklareli": ["Babaeski", "Demirköy", "Kofçaz", "Lüleburgaz", "Merkez", "Pehlivanköy", "Pınarhisar", "Vize"],
    "Kırşehir": ["Akçakent", "Akpınar", "Bozyazı", "Çiçekdağı", "Kaman", "Merkez", "Mucur"],
    "Kocaeli": ["Başiskele", "Çayırova", "Darıca", "Derince", "Dilovası", "Gebze", "Gölcük", "İzmit", "Kandıra", "Karamürsel", "Kartepe", "Körfez"],
    "Konya": ["Ahırlı", "Akören", "Akşehir", "Altınekin", "Beyşehir", "Bozkır", "Cihanbeyli", "Çeltik", "Çumra", "Derbent", "Derebucak", "Doğanhisar", "Emirgazi", "Ereğli", "Güneysınır", "Hadim", "Halkapınar", "Hüyük", "Ilgın", "Kadınhanı", "Karapınar", "Karatay", "Kulu", "Meram", "Sarayönü", "Selçuklu", "Seydişehir", "Taşkent", "Tuzlukçu", "Yalıhüyük", "Yunak"],
    "Kütahya": ["Altıntaş", "Aslanapa", "Çavdarhisar", "Domaniç", "Dumlupınar", "Emet", "Gediz", "Hisarcık", "İscehisar", "Merkez", "Pazarlar", "Simav", "Şaphane", "Tavşanlı"],
    "Malatya": ["Akçadağ", "Arapgir", "Arguvan", "Battalgazi", "Darende", "Doğanşehir", "Doğanyol", "Hekimhan", "Kale", "Kuluncak", "Pütürge", "Yazıhan", "Yeşilyurt"],
    "Manisa": ["Ahmetli", "Akhisar", "Alaşehir", "Demirci", "Gölmarmara", "Gördes", "Kırkağaç", "Köprübaşı", "Kula", "Salihli", "Sarıgöl", "Saruhanlı", "Selendi", "Soma", "Şehzadeler", "Turgutlu", "Yunusemre"],
    "Kahramanmaraş": ["Afşin", "Andırın", "Çağlayancerit", "Dulkadiroğlu", "Ekinözü", "Elbistan", "Göksun", "Nurhak", "Onikişubat", "Pazarcık", "Türkoğlu"],
    "Mardin": ["Artuklu", "Dargeçit", "Derik", "Kızıltepe", "Mazıdağı", "Midyat", "Nusaybin", "Ömerli", "Savur", "Yeşilli"],
    "Muğla": ["Bodrum", "Dalaman", "Datça", "Fethiye", "Kavaklıdere", "Köyceğiz", "Marmaris", "Menteşe", "Milas", "Ortaca", "Seydikemer", "Ula", "Yatağan"],
    "Muş": ["Bulanık", "Hasköy", "Korkut", "Malazgirt", "Merkez", "Varto"],
    "Nevşehir": ["Acıgöl", "Avanos", "Derinkuyu", "Gülşehir", "Hacıbektaş", "Kozaklı", "Merkez", "Ürgüp"],
    "Niğde": ["Altunhisar", "Bor", "Çamardı", "Çiftlik", "Merkez", "Ulukışla"],
    "Ordu": ["Akkuş", "Altınordu", "Aybastı", "Çamaş", "Çatalpınar", "Çaybaşı", "Fatsa", "Gölköy", "Gülyalı", "Gürgentepe", "İkizce", "Kabadüz", "Kabataş", "Korgan", "Kumru", "Mesudiye", "Perşembe", "Ulubey", "Ünye"],
    "Rize": ["Ardeşen", "Çamlıhemşin", "Çayeli", "Derepazarı", "Fındıklı", "Güneysu", "Hemşin", "İkizdere", "İyidere", "Kalkandere", "Merkez", "Pazar"],
    "Sakarya": ["Adapazarı", "Akyazı", "Arifiye", "Erenler", "Ferizli", "Geyve", "Hendek", "Karapürçek", "Karasu", "Kaynarca", "Kocaali", "Pamukova", "Sapanca", "Serdivan", "Söğütlü", "Taraklı"],
    "Samsun": ["19 Mayıs", "Alaçam", "Asarcık", "Atakum", "Ayvacık", "Bafra", "Canik", "Çarşamba", "Havza", "İlkadım", "Kavak", "Ladik", "Salıpazarı", "Tekkeköy", "Terme", "Vezirköprü", "Yakakent"],
    "Siirt": ["Baykan", "Eruh", "Kurtalan", "Merkez", "Pervari", "Şirvan", "Tillo"],
    "Sinop": ["Ayancık", "Boyabat", "Dikmen", "Durağan", "Erfelek", "Gerze", "Merkez", "Saraydüzü", "Türkeli"],
    "Sivas": ["Akıncılar", "Altınyayla", "Divriği", "Doğanşar", "Gemerek", "Gölova", "Hafik", "İmranlı", "Kangal", "Koyulhisar", "Merkez", "Suşehri", "Şarkışla", "Ulaş", "Yıldızeli", "Zara", "Gürün"],
    "Tekirdağ": ["Çerkezköy", "Çorlu", "Ergene", "Hayrabolu", "Kapaklı", "Malkara", "Marmaraereğlisi", "Muratlı", "Saray", "Süleymanpaşa", "Şarköy"],
    "Tokat": ["Almus", "Artova", "Başçiftlik", "Erbaa", "Merkez", "Niksar", "Pazar", "Reşadiye", "Sulusaray", "Turhal", "Yeşilyurt", "Zile"],
    "Trabzon": ["Akçaabat", "Araklı", "Arsin", "Beşikdüzü", "Çarşıbaşı", "Çaykara", "Dernekpazarı", "Düzköy", "Hayrat", "Köprübaşı", "Maçka", "Of", "Ortahisar", "Sürmene", "Şalpazarı", "Tonya", "Vakfıkebir", "Yomra"],
    "Tunceli": ["Çemişgezek", "Hozat", "Mazgirt", "Merkez", "Nazımiye", "Ovacık", "Pertek", "Pülümür"],
    "Şanlıurfa": ["Akçakale", "Birecik", "Bozova", "Ceylanpınar", "Eyyübiye", "Halfeti", "Haliliye", "Harran", "Hilvan", "Karaköprü", "Siverek", "Suruç", "Viranşehir"],
    "Uşak": ["Banaz", "Eşme", "Karahallı", "Merkez", "Sivaslı", "Ulubey"],
    "Van": ["Bahçesaray", "Başkale", "Çaldıran", "Çatak", "Edremit", "Erciş", "Gevaş", "Gürpınar", "İpekyolu", "Muradiye", "Özalp", "Saray", "Tuşba"],
    "Yozgat": ["Akdağmadeni", "Aydıncık", "Boğazlıyan", "Çandır", "Çayıralan", "Çekerek", "Kadışehri", "Merkez", "Saraykent", "Sarıkaya", "Sorgun", "Şefaatli", "Yenifakılı", "Yerköy"],
    "Zonguldak": ["Alaplı", "Çaycuma", "Devrek", "Ereğli", "Gökçebey", "Kilimli", "Kozlu", "Merkez"],
    "Aksaray": ["Ağaçören", "Eskil", "Gülağaç", "Güzelyurt", "Merkez", "Ortaköy", "Sarıyahşi", "Sultanhanı"],
    "Bayburt": ["Aydıntepe", "Demirözü", "Merkez"],
    "Karaman": ["Ayrancı", "Başyayla", "Ermenek", "Kazımkarabekir", "Merkez", "Sarıveliler"],
    "Kırıkkale": ["Bahşılı", "Balışeyh", "Çelebi", "Delice", "Karakeçili", "Keskin", "Merkez", "Sulakyurt", "Yahşihan"],
    "Batman": ["Beşiri", "Gercüş", "Hasankeyf", "Kozluk", "Merkez", "Sason"],
    "Şırnak": ["Beytüşşebap", "Cizre", "Güçlükonak", "İdil", "Merkez", "Silopi", "Uludere"],
    "Bartın": ["Amasra", "Kurucaşile", "Merkez", "Ulus"],
    "Ardahan": ["Çıldır", "Damal", "Göle", "Hanak", "Merkez", "Posof"],
    "Iğdır": ["Aralık", "Karakoyunlu", "Merkez", "Tuzluca"],
    "Yalova": ["Altınova", "Armutlu", "Çınarcık", "Çiftlikköy", "Merkez", "Termal"],
    "Karabük": ["Eflani", "Eskipazar", "Merkez", "Ovacık", "Safranbolu", "Yenice"],
    "Kilis": ["Elbeyli", "Merkez", "Musabeyli", "Polateli"],
    "Osmaniye": ["Bahçe", "Düziçi", "Hasanbeyli", "Kadirli", "Merkez", "Sumbas", "Toprakkale"],
    "Düzce": ["Akçakoca", "Çilimli", "Cumayeri", "Gölyaka", "Gümüşova", "Kaynaşlı", "Merkez", "Yığılca"]
    }
    

    # İlçe -> İl eşlemesi için ters bir sözlük oluşturma
    DISTRICT_TO_PROVINCE_MAP = {
        district: province
        for province, districts in LOCATIONS.items()
        for district in districts
    }

    all_cars = []
    for category, brands in car_categories["arabalar"].items():
        if not isinstance(brands, list): continue
        for brand_info in brands:
            for model_name in brand_info["modeller"]:
                all_cars.append({"category": category, "brand": brand_info["marka"], "model": model_name})
    
    total_models = len(all_cars)
    if total_models == 0: return

    target_rows = 100_000
    examples_per_model = math.ceil(target_rows / total_models)
    
    print(f"Toplam {total_models} model bulundu. Hedef {target_rows:,} satır için model başına ~{examples_per_model} örnek oluşturulacak.")

    for car in all_cars:
        for _ in range(examples_per_model):
            assistant_json = create_base_json()
            assistant_json["ana_kategori"] = [car["category"]]
            assistant_json["marka"] = car["brand"]
            assistant_json["model"] = car["model"]
            query_parts = [car["brand"], car["model"]]
            
            is_kiralik = car["category"] == "Kiralık Araçlar"
            current_fiyat_list = fiyatlar_kiralik if is_kiralik else fiyatlar_satis

            # --- Full Random Parameter Combination ---
            if random.random() < 0.35: # 35% chance to add a location filter
                search_type = random.choice(["province_only", "district_only", "province_and_district"])
                
                province = random.choice(list(LOCATIONS.keys()))
                
                if search_type == "province_only":
                    assistant_json["il"] = province
                    query_parts.append(province)
                    
                elif search_type == "district_only":
                    if LOCATIONS.get(province):
                        districts_without_merkez = [d for d in LOCATIONS[province] if d != "Merkez"]
                        
                        district = random.choice(districts_without_merkez)
                        
                        query_parts.append(district)
                        assistant_json["il"] = DISTRICT_TO_PROVINCE_MAP[district]

                elif search_type == "province_and_district":
                    if LOCATIONS.get(province):
                        district = random.choice(LOCATIONS[province])
                        # User query includes both
                        query_parts.extend([province, district])
                        # JSON output gets the province
                        assistant_json["il"] = province
            if random.random() < 0.15:
                key, value = random.choice(list(yakit_tipi_options.items()))
                assistant_json["yakit_tipi"] = value
                query_parts.append(key)
            if random.random() < 0.20:
                raw_text, normalized_text = random.choice(search_texts)
                assistant_json["searchText"] = normalized_text
                query_parts.append(raw_text)
            if random.random() < 0.3:
                assistant_json["maxFiyat"] = random.choice(current_fiyat_list)
                query_parts.append(f"{assistant_json['maxFiyat']:,} TL altı")
            if random.random() < 0.3:
                assistant_json["minFiyat"] = random.choice(current_fiyat_list)
                query_parts.append(f"en az {assistant_json['minFiyat']:,} TL")
            if not is_kiralik and random.random() < 0.4:
                 assistant_json["minYil"] = random.choice(yillar)
                 query_parts.append(f"{assistant_json['minYil']} sonrası")
            if not is_kiralik and random.random() < 0.3:
                 assistant_json["maxKm"] = random.choice(kilometreler)
                 query_parts.append(f"maksimum {assistant_json['maxKm']:,} km")
            if random.random() < 0.4:
                 assistant_json["renkler"] = [random.choice(renkler)]
                 query_parts.append(assistant_json["renkler"][0])
            if random.random() < 0.3:
                 assistant_json["vites"] = [random.choice(vitesler)]
                 query_parts.append(assistant_json["vites"][0])
            if not is_kiralik and random.random() < 0.15:
                key, value = random.choice(list(boya_degisen_options.items()))
                assistant_json["boya_degişen_parca"] = value
                query_parts.append(key)
            if not is_kiralik and random.random() < 0.2:
                key, value = random.choice(list(arac_durumu_options.items()))
                assistant_json["arac_durumu"] = value
                query_parts.append(key)
            if not is_kiralik and random.random() < 0.1:
                key, value = random.choice(list(agir_hasar_options.items()))
                assistant_json["agir_hasar_kayitli"] = value
                query_parts.append(key)
            if not is_kiralik and random.random() < 0.1:
                key, value = random.choice(list(takas_options.items()))
                assistant_json["takasa_uygun"] = value
                query_parts.append(key)
            if random.random() < 0.15:
                key, value = random.choice(list(siralama_options.items()))
                assistant_json["siralama"] = value
                query_parts.append(key)
            

            random.shuffle(query_parts)
            user_query = " ".join(query_parts)
            
            dataset.append({ "system": system_message, "user": user_query.strip(), "assistant": json.dumps(assistant_json, ensure_ascii=False) })

    df = pd.DataFrame(dataset)
    output_filename = "instruct_arabam_dataset_100k_v2.parquet"
    df.to_parquet(output_filename, index=False)
    
    print(f"\nVeri seti başarıyla oluşturuldu! Toplam {len(df):,} satır üretildi.")
    print(f"Dosya '{output_filename}' olarak kaydedildi.")

create_final_dataset_with_structure()