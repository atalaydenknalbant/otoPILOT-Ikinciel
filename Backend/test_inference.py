# # infer_llama32_3b_safe.py — HF 4-bit + PEFT adapter, Unsloth fast path YOK
# # Base-only için ADAPTER_DIR = None yap.

# import torch
# from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig, GenerationConfig
# from peft import PeftModel

# # -------- Config --------
# MODEL_ID    = "unsloth/Llama-3.2-3B-Instruct-unsloth-bnb-4bit"
# ADAPTER_DIR = r"C:\Users\yineh\OneDrive\Masaüstü\llama32_3b_unsloth_lora_runtime_fast"  # None => base-only
# MAX_SEQ_LEN = 2048

# assert torch.cuda.is_available(), "CUDA required"
# device = "cuda"

# # 4-bit NF4 yükle (HF yolu)
# bnb_cfg = BitsAndBytesConfig(
#     load_in_4bit=True,
#     bnb_4bit_quant_type="nf4",
#     bnb_4bit_compute_dtype=torch.bfloat16,
#     bnb_4bit_use_double_quant=True,
# )

# tok = AutoTokenizer.from_pretrained(MODEL_ID, use_fast=True)
# if tok.pad_token_id is None:
#     tok.pad_token_id = tok.eos_token_id

# base = AutoModelForCausalLM.from_pretrained(
#     MODEL_ID,
#     quantization_config=bnb_cfg,
#     torch_dtype=torch.bfloat16,
#     device_map=device,   # tek GPU
# )

# model = PeftModel.from_pretrained(base, ADAPTER_DIR).to(device) if ADAPTER_DIR else base.to(device)
# model.eval()

# # Greedy config açık ve net
# gen_cfg = GenerationConfig.from_model_config(model.config)
# gen_cfg.do_sample   = False       # sıcaklık için gerekli
# gen_cfg.temperature = 0.1
# gen_cfg.top_p       = 0.9
# gen_cfg.num_beams   = 1
# gen_cfg.use_cache   = True
# gen_cfg.pad_token_id = tok.pad_token_id
# gen_cfg.eos_token_id = tok.eos_token_id

# # ---- Örnek istek ----
# messages = [
#     {"role": "system", "content": """Sen bir yapay zeka araba arama motoru asistanısın. Görevin, kullanıcının doğal dildeki arama sorgusunu yorumlayarak yapılandırılmış bir JSON çıktısına dönüştürmektir. Bu JSON, araç ilanlarını filtrelemek için kullanılacaktır. Aşağıda belirtilen kurallara, seçeneklere ve formata harfiyen uy. GEÇERLİ SEÇENEKLER GEÇERLİ YAKIT TİPLERİ: ["Benzin", "Dizel", "Elektrik", "Hibrit", "LPG"] GEÇERLİ RENKLER: ["Altın", "Bej", "Beyaz", "Bordo", "Füme", "Gri", "Gri (Gümüş)", "Gri (metalik)", "Gri (titanyum)", "Kahverengi", "Kırmızı", "Lacivert", "Mavi", "Mavi (metalik)", "Mor", "Pembe", "Şampanya", "Sarı", "Siyah", "Turkuaz", "Turuncu", "Yeşil", "Yeşil (metalik)", "Diğer"] GEÇERLİ VİTES TÜRLERİ: ["Düz", "Otomatik", "Yarı Otomatik"] ARAÇ DURUMU SEÇENEKLERİ: ["İkinci El", "Sıfır", "Yetkili Bayiden Sıfır", "Yurtdışından İthal Sıfır"] AĞIR HASAR KAYITLI SEÇENEKLERİ: ["Evet", "Hayır"] BOYA/DEĞİŞEN SEÇENEKLERİ: ["Boyasız, Değişensiz ve Tramersiz", "Boyasız ve Değişensiz", "Boyasız", "Değişensiz", "Tramersiz"] TAKAS SEÇENEKLERİ: ["Takasa Uygun", "Takasa Uygun Değil"] SIRALAMA TÜRLERİ: {"Fiyat - Ucuzdan Pahalıya": "price.asc", "Fiyat - Pahalıdan Ucuza": "price.desc", "Yıl - Yeniden Eskiye": "year.desc", "Yıl - Eskiden Yeniye": "year.asc", "Kilometre - Düşükten Yükseğe": "km.asc", "Kilometre - Yüksekten Düşüğe": "km.desc", "Tarih - Yeniden Eskiye": "startedAt.desc"} --- İSTENEN ÇIKTI YAPISI (JSON FORMATI) Çıktın daima aşağıdaki anahtarları içeren ve belirtilen veri tiplerine uygun bir JSON objesi olmalıdır. Kullanıcı bir değeri belirtmemişse, null (sayısal değerler için), [] (diziler için) veya "" (metinler için) kullanılmalıdır. {"ana_kategori":["string"],"marka":"string","model":"string","searchText":"string","minFiyat":"integer | null","maxFiyat":"integer | null","minYil":"integer | null","maxYil":"integer | null","minKm":"integer | null","maxKm":"integer | null","renkler":["string"],"vites":["string"],"yakit_tipi":["string"],"il":["string"],"boya_degişen_parca":["string"],"arac_durumu":["string"],"agir_hasar_kayitli":"string","siralama":"string","takasa_uygun":"string"} --- KURALLAR 1. ANA KATEGORİ: Çıktıdaki ilk anahtar "ana_kategori" olmalıdır. Kullanıcı "kiralık" derse, "ana_kategori" SADECE ["Kiralık Araçlar"] olmalıdır. Eğer yukarıdaki koşullar sağlanmazsa ve kategori belirsizse, varsayılan olarak ["Otomobil","Arazi, SUV, Pick-up","Minivan & Panelvan"] kullan. 2. TÜM ALANLARI DOLDUR: Çıktıda BÜTÜN olası anahtarlar bulunmalıdır. Belirtilmeyen alanların değeri boş (""), null veya boş dizi ([]) olmalıdır. 3. TÜRKÇE ANAHTAR KULLAN: JSON anahtarları daima şu listeden olmalıdır: "ana_kategori","marka","model","minYil","maxYil","minFiyat","maxFiyat","minKm","maxKm","renkler","vites","siralama","arac_durumu","agir_hasar_kayitli","takasa_uygun","boya_degişen_parca","searchText". 4. ÇEVİRİ YASAK: Değerleri ASLA İngilizce'ye çevirme. "3 Serisi" -> "3 Serisi" olarak kalmalıdır. 5. DEĞERLERİ BİRLEŞTİR: Kullanıcı birden çok renk veya vites belirtirse, bunları ilgili anahtar altında TEK BİR DİZİDE birleştir. 6. searchText KULLANIMI: YALNIZCA "yumurta kasa","çelik jantlı" gibi standart filtreler DIŞINDAKİ tanımlayıcı ifadeleri bu alana yaz. Marka, model veya komut kelimeleri ("bul","getir") ASLA bu alana YAZMA. Eğer böyle bir ifade yoksa, alanı boş bırak: "". 7. searchText NORMALİZASYONU: Kullanıcı "1.6 motor tdi" gibi bir ifade kullanırsa, searchText alanına "motor" kelimesini çıkararak "1.6 tdi" şeklinde yaz. motor kelimesini hiçbir zaman yazma. 8. FİLTRE AYRIMI: "otomatik","düz" gibi ifadeler "vites" alanına, "1.6 TDi" gibi motor/donanım bilgileri ise "searchText" alanına yazılmalıdır. 9. ARALIKLARI DOĞRU YORUMLA: "X'ten yeni","X üstü","minimum X" gibi ifadeler min (en az) değerini belirtir (örn: "minYil","minKm"). "X'ten eski","X altı","maksimum X" gibi ifadeler max (en fazla) değerini belirtir (örn: "maxYil","maxKm"). 10. SIRALAMA: Eğer kullanıcı sıralama belirtirse, "siralama" alanını uygun şekilde doldur. Eğer sıralama yoksa, bu alanı boş bırak: "". 11. LOKASYON: Kullanıcı ilçe belirtse bile, JSON çıktısında SADECE "il" alanı bulunsun ve bu alana ilçenin ait olduğu il (örn: "İstanbul-Avrupa") yazılsın. "ilce" anahtarı çıktıda yer almasın. Birden fazla il olabilir."""},
#     {"role": "user",   "content": "bana porse araclar bul"},
# ]
# prompt = tok.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
# inputs = tok(prompt, return_tensors="pt", truncation=True, max_length=MAX_SEQ_LEN).to(device)

# with torch.inference_mode(), torch.autocast(device_type="cuda", dtype=torch.bfloat16):
#     out = model.generate(**inputs, max_new_tokens=400, generation_config=gen_cfg)

# print(tok.decode(out[0], skip_special_tokens=True))


# from unsloth import FastLanguageModel
# import os, torch
# from transformers import AutoTokenizer
# from peft import PeftModel

# Keep the compiler disabled on Windows if you previously hit Dynamo issues.

# assert torch.cuda.is_available(), "CUDA required"
# device = "cuda"

# BASE = "unsloth/gemma-3-4b-it-unsloth-bnb-4bit"
# ADAPTER_DIR = r"C:\Users\yineh\OneDrive\Masaüstü\gemma3_4b_unsloth_lora_runtime_fast_best"  



# tok = AutoTokenizer.from_pretrained(BASE, use_fast=True)
# base, _ = FastLanguageModel.from_pretrained(
#     model_name=BASE,
#     max_seq_length=2048,
#     temperature=0,
#     dtype=None,
#     load_in_4bit=True,
# )
# model = PeftModel.from_pretrained(base, ADAPTER_DIR)
# FastLanguageModel.for_inference(model)  # sets eval friendly flags

# prompt = [
#     {"role": "system", "content": """Sen bir yapay zeka araba arama motoru asistanısın. Görevin, kullanıcının doğal dildeki arama sorgusunu yorumlayarak yapılandırılmış bir JSON çıktısına dönüştürmektir. Bu JSON, araç ilanlarını filtrelemek için kullanılacaktır. Aşağıda belirtilen kurallara, seçeneklere ve formata harfiyen uy. GEÇERLİ SEÇENEKLER GEÇERLİ YAKIT TİPLERİ: ["Benzin", "Dizel", "Elektrik", "Hibrit", "LPG"] GEÇERLİ RENKLER: ["Altın", "Bej", "Beyaz", "Bordo", "Füme", "Gri", "Gri (Gümüş)", "Gri (metalik)", "Gri (titanyum)", "Kahverengi", "Kırmızı", "Lacivert", "Mavi", "Mavi (metalik)", "Mor", "Pembe", "Şampanya", "Sarı", "Siyah", "Turkuaz", "Turuncu", "Yeşil", "Yeşil (metalik)", "Diğer"] GEÇERLİ VİTES TÜRLERİ: ["Düz", "Otomatik", "Yarı Otomatik"] ARAÇ DURUMU SEÇENEKLERİ: ["İkinci El", "Sıfır", "Yetkili Bayiden Sıfır", "Yurtdışından İthal Sıfır"] AĞIR HASAR KAYITLI SEÇENEKLERİ: ["Evet", "Hayır"] BOYA/DEĞİŞEN SEÇENEKLERİ: ["Boyasız, Değişensiz ve Tramersiz", "Boyasız ve Değişensiz", "Boyasız", "Değişensiz", "Tramersiz"] TAKAS SEÇENEKLERİ: ["Takasa Uygun", "Takasa Uygun Değil"] SIRALAMA TÜRLERİ: {"Fiyat - Ucuzdan Pahalıya": "price.asc", "Fiyat - Pahalıdan Ucuza": "price.desc", "Yıl - Yeniden Eskiye": "year.desc", "Yıl - Eskiden Yeniye": "year.asc", "Kilometre - Düşükten Yükseğe": "km.asc", "Kilometre - Yüksekten Düşüğe": "km.desc", "Tarih - Yeniden Eskiye": "startedAt.desc"} --- İSTENEN ÇIKTI YAPISI (JSON FORMATI) Çıktın daima aşağıdaki anahtarları içeren ve belirtilen veri tiplerine uygun bir JSON objesi olmalıdır. Kullanıcı bir değeri belirtmemişse, null (sayısal değerler için), [] (diziler için) veya "" (metinler için) kullanılmalıdır. {"ana_kategori":["string"],"marka":"string","model":"string","searchText":"string","minFiyat":"integer | null","maxFiyat":"integer | null","minYil":"integer | null","maxYil":"integer | null","minKm":"integer | null","maxKm":"integer | null","renkler":["string"],"vites":["string"],"yakit_tipi":["string"],"il":["string"],"boya_degişen_parca":["string"],"arac_durumu":["string"],"agir_hasar_kayitli":"string","siralama":"string","takasa_uygun":"string"} --- KURALLAR 1. ANA KATEGORİ: Çıktıdaki ilk anahtar "ana_kategori" olmalıdır. Kullanıcı "kiralık" derse, "ana_kategori" SADECE ["Kiralık Araçlar"] olmalıdır. Eğer yukarıdaki koşullar sağlanmazsa ve kategori belirsizse, varsayılan olarak ["Otomobil","Arazi, SUV, Pick-up","Minivan & Panelvan"] kullan. 2. TÜM ALANLARI DOLDUR: Çıktıda BÜTÜN olası anahtarlar bulunmalıdır. Belirtilmeyen alanların değeri boş (""), null veya boş dizi ([]) olmalıdır. 3. TÜRKÇE ANAHTAR KULLAN: JSON anahtarları daima şu listeden olmalıdır: "ana_kategori","marka","model","minYil","maxYil","minFiyat","maxFiyat","minKm","maxKm","renkler","vites","siralama","arac_durumu","agir_hasar_kayitli","takasa_uygun","boya_degişen_parca","searchText". 4. ÇEVİRİ YASAK: Değerleri ASLA İngilizce'ye çevirme. "3 Serisi" -> "3 Serisi" olarak kalmalıdır. 5. DEĞERLERİ BİRLEŞTİR: Kullanıcı birden çok renk veya vites belirtirse, bunları ilgili anahtar altında TEK BİR DİZİDE birleştir. 6. searchText KULLANIMI: YALNIZCA "yumurta kasa","çelik jantlı" gibi standart filtreler DIŞINDAKİ tanımlayıcı ifadeleri bu alana yaz. Marka, model veya komut kelimeleri ("bul","getir") ASLA bu alana YAZMA. Eğer böyle bir ifade yoksa, alanı boş bırak: "". 7. searchText NORMALİZASYONU: Kullanıcı "1.6 motor tdi" gibi bir ifade kullanırsa, searchText alanına "motor" kelimesini çıkararak "1.6 tdi" şeklinde yaz. motor kelimesini hiçbir zaman yazma. 8. FİLTRE AYRIMI: "otomatik","düz" gibi ifadeler "vites" alanına, "1.6 TDi" gibi motor/donanım bilgileri ise "searchText" alanına yazılmalıdır. 9. ARALIKLARI DOĞRU YORUMLA: "X'ten yeni","X üstü","minimum X" gibi ifadeler min (en az) değerini belirtir (örn: "minYil","minKm"). "X'ten eski","X altı","maksimum X" gibi ifadeler max (en fazla) değerini belirtir (örn: "maxYil","maxKm"). 10. SIRALAMA: Eğer kullanıcı sıralama belirtirse, "siralama" alanını uygun şekilde doldur. Eğer sıralama yoksa, bu alanı boş bırak: "". 11. LOKASYON: Kullanıcı ilçe belirtse bile, JSON çıktısında SADECE "il" alanı bulunsun ve bu alana ilçenin ait olduğu il (örn: "İstanbul-Avrupa") yazılsın. "ilce" anahtarı çıktıda yer almasın. Birden fazla il olabilir."""},
#     {"role": "user",   "content": "ford bul minivan maksimum 3000 tl olsun. Istanbulda. hadi bakalim yapay zeka goster numaralarini"},
# ]
# txt = tok.apply_chat_template(prompt, tokenize=False, add_generation_prompt=True)
# inputs = tok(txt, return_tensors="pt", truncation=True, max_length=2048).to("cuda")

# with torch.inference_mode(), torch.autocast("cuda", dtype=torch.bfloat16):
#     out = model.generate(**inputs, max_new_tokens=400, do_sample=False)
# print(tok.decode(out[0], skip_special_tokens=True))




# import os, json, requests

# OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")

# # Q4 ana model
# # MODEL = "tykefencer/otomodel_q4:latest"
# MODEL = "tykefencer/otomodel_q8:latest"  # Q8 için bu satırı aç

# def ensure_model(model: str):
#     """Yerelde yoksa Ollama'dan indir."""
#     try:
#         tags = requests.get(f"{OLLAMA_URL}/api/tags", timeout=30).json().get("models", [])
#     except Exception:
#         tags = []
#     names = {m.get("name") for m in tags}
#     if model not in names:
#         with requests.post(f"{OLLAMA_URL}/api/pull", json={"name": model}, stream=True) as r:
#             r.raise_for_status()
#             for line in r.iter_lines():
#                 if line:
#                     # ilerlemeyi konsola dökmek istersen aç
#                     # print(line.decode("utf-8", errors="ignore"))
#                     pass

# # sistem ve kullanıcı mesajları
# messages = [
#     {"role": "system", "content": """Sen bir yapay zeka araba arama motoru asistanısın. Görevin, kullanıcının doğal dildeki arama sorgusunu yorumlayarak yapılandırılmış bir JSON çıktısına dönüştürmektir. Bu JSON, araç ilanlarını filtrelemek için kullanılacaktır. Aşağıda belirtilen kurallara, seçeneklere ve formata harfiyen uy. GEÇERLİ SEÇENEKLER GEÇERLİ YAKIT TİPLERİ: ["Benzin", "Dizel", "Elektrik", "Hibrit", "LPG"] GEÇERLİ RENKLER: ["Altın", "Bej", "Beyaz", "Bordo", "Füme", "Gri", "Gri (Gümüş)", "Gri (metalik)", "Gri (titanyum)", "Kahverengi", "Kırmızı", "Lacivert", "Mavi", "Mavi (metalik)", "Mor", "Pembe", "Şampanya", "Sarı", "Siyah", "Turkuaz", "Turuncu", "Yeşil", "Yeşil (metalik)", "Diğer"] GEÇERLİ VİTES TÜRLERİ: ["Düz", "Otomatik", "Yarı Otomatik"] ARAÇ DURUMU SEÇENEKLERİ: ["İkinci El", "Sıfır", "Yetkili Bayiden Sıfır", "Yurtdışından İthal Sıfır"] AĞIR HASAR KAYITLI SEÇENEKLERİ: ["Evet", "Hayır"] BOYA/DEĞİŞEN SEÇENEKLERİ: ["Boyasız, Değişensiz ve Tramersiz", "Boyasız ve Değişensiz", "Boyasız", "Değişensiz", "Tramersiz"] TAKAS SEÇENEKLERİ: ["Takasa Uygun", "Takasa Uygun Değil"] SIRALAMA TÜRLERİ: {"Fiyat - Ucuzdan Pahalıya": "price.asc", "Fiyat - Pahalıdan Ucuza": "price.desc", "Yıl - Yeniden Eskiye": "year.desc", "Yıl - Eskiden Yeniye": "year.asc", "Kilometre - Düşükten Yükseğe": "km.asc", "Kilometre - Yüksekten Düşüğe": "km.desc", "Tarih - Yeniden Eskiye": "startedAt.desc"} --- İSTENEN ÇIKTI YAPISI (JSON FORMATI) Çıktın daima aşağıdaki anahtarları içeren ve belirtilen veri tiplerine uygun bir JSON objesi olmalıdır. Kullanıcı bir değeri belirtmemişse, null (sayısal değerler için), [] (diziler için) veya "" (metinler için) kullanılmalıdır. {"ana_kategori":["string"],"marka":"string","model":"string","searchText":"string","minFiyat":"integer | null","maxFiyat":"integer | null","minYil":"integer | null","maxYil":"integer | null","minKm":"integer | null","maxKm":"integer | null","renkler":["string"],"vites":["string"],"yakit_tipi":["string"],"il":["string"],"boya_degişen_parca":["string"],"arac_durumu":["string"],"agir_hasar_kayitli":"string","siralama":"string","takasa_uygun":"string"} --- KURALLAR 1. ANA KATEGORİ: Çıktıdaki ilk anahtar "ana_kategori" olmalıdır. Kullanıcı "kiralık" derse, "ana_kategori" SADECE ["Kiralık Araçlar"] olmalıdır. Eğer yukarıdaki koşullar sağlanmazsa ve kategori belirsizse, varsayılan olarak ["Otomobil","Arazi, SUV, Pick-up","Minivan & Panelvan"] kullan. 2. TÜM ALANLARI DOLDUR: Çıktıda BÜTÜN olası anahtarlar bulunmalıdır. Belirtilmeyen alanların değeri boş (""), null veya boş dizi ([]) olmalıdır. 3. TÜRKÇE ANAHTAR KULLAN: JSON anahtarları daima şu listeden olmalıdır: "ana_kategori","marka","model","minYil","maxYil","minFiyat","maxFiyat","minKm","maxKm","renkler","vites","siralama","arac_durumu","agir_hasar_kayitli","takasa_uygun","boya_degişen_parca","searchText". 4. ÇEVİRİ YASAK: Değerleri ASLA İngilizce'ye çevirme. "3 Serisi" -> "3 Serisi" olarak kalmalıdır. 5. DEĞERLERİ BİRLEŞTİR: Kullanıcı birden çok renk veya vites belirtirse, bunları ilgili anahtar altında TEK BİR DİZİDE birleştir. 6. searchText KULLANIMI: YALNIZCA "yumurta kasa","çelik jantlı" gibi standart filtreler DIŞINDAKİ tanımlayıcı ifadeleri bu alana yaz. Marka, model veya komut kelimeleri ("bul","getir") ASLA bu alana YAZMA. Eğer böyle bir ifade yoksa, alanı boş bırak: "". 7. searchText NORMALİZASYONU: Kullanıcı "1.6 motor tdi" gibi bir ifade kullanırsa, searchText alanına "motor" kelimesini çıkararak "1.6 tdi" şeklinde yaz. motor kelimesini hiçbir zaman yazma. 8. FİLTRE AYRIMI: "otomatik","düz" gibi ifadeler "vites" alanına, "1.6 TDi" gibi motor/donanım bilgileri ise "searchText" alanına yazılmalıdır. 9. ARALIKLARI DOĞRU YORUMLA: "X'ten yeni","X üstü","minimum X" gibi ifadeler min (en az) değerini belirtir (örn: "minYil","minKm"). "X'ten eski","X altı","maksimum X" gibi ifadeler max (en fazla) değerini belirtir (örn: "maxYil","maxKm"). 10. SIRALAMA: Eğer kullanıcı sıralama belirtirse, "siralama" alanını uygun şekilde doldur. Eğer sıralama yoksa, bu alanı boş bırak: "". 11. LOKASYON: Kullanıcı ilçe belirtse bile, JSON çıktısında SADECE "il" alanı bulunsun ve bu alana ilçenin ait olduğu il (örn: "İstanbul-Avrupa") yazılsın. "ilce" anahtarı çıktıda yer almasın. Birden fazla il olabilir."""},
#     {"role": "user", "content": "selam bana kiralik porşe bul maksimum 3000 tl olsun. İstanbulda"},
# ]

# def chat(model: str, messages):
#     ensure_model(model)
#     payload = {
#         "model": model,
#         "messages": messages,
#         "stream": False,
#         "format": "json",  # geçerli JSON’a zorla
#         "options": {
#             "temperature": 0.0,       
#             "top_p": 1.0,
#             "num_ctx": 16000,
#             "stop": ["<end_of_turn>"]
#         }
#     }
#     r = requests.post(f"{OLLAMA_URL}/api/chat", json=payload, timeout=600)
#     r.raise_for_status()
#     data = r.json()
#     return data["message"]["content"]

# if __name__ == "__main__":
#     out = chat(MODEL, messages)
#     print(out)
#     # JSON parse gerekirse:
#     # try:
#     #     print(json.dumps(json.loads(out), ensure_ascii=False, indent=2))
#     # except Exception:
#     #     pass





# import os
# import torch
# from transformers import AutoTokenizer
# from unsloth import FastLanguageModel

# # Optional env toggles if you ever hit Windows Dynamo issues
# # os.environ["UNSLOTH_COMPILE_DISABLE"] = "1"
# # os.environ["UNSLOTH_DISABLE_AUTO_UPDATES"] = "1"
# # os.environ["HF_HUB_ENABLE_HF_TRANSFER"] = "1"

# assert torch.cuda.is_available(), "CUDA required"
# device = "cuda"
# torch.backends.cuda.matmul.allow_tf32 = True
# torch.backends.cudnn.allow_tf32 = True
# torch.set_float32_matmul_precision("medium")

# BASE = "unsloth/mistral-7b-instruct-v0.2-bnb-4bit"
# # If you fine tuned with LoRA set this to your adapter directory. Otherwise set to None.
# ADAPTER_DIR = r"C:\Users\yineh\OneDrive\Masaüstü\otopilot trained models\mistral7b_v02_unsloth_lora_ctx8192"

# # 1) Load tokenizer
# tok = AutoTokenizer.from_pretrained(BASE, use_fast=True)

# # 2) Load base model in 4 bit
# model, _ = FastLanguageModel.from_pretrained(
#     model_name = BASE,
#     max_seq_length = 4096,
#     dtype = None,           # Auto selects bf16 or fp16 inside autocast
#     load_in_4bit = True,
# )

# # 3) If you have an adapter merge it in place
# if ADAPTER_DIR:
#     from peft import PeftModel
#     base_ref = model
#     model = PeftModel.from_pretrained(base_ref, ADAPTER_DIR)
#     # If you saved merged weights already, you can skip PeftModel and just point BASE to that folder

# # 4) Inference friendly flags
# FastLanguageModel.for_inference(model)

# # 5) Compose a chat prompt using the tokenizer chat template
# system_msg = """Sen bir yapay zeka araba arama motoru asistanısın. Görevin, kullanıcının doğal dildeki arama sorgusunu yorumlayarak yapılandırılmış bir JSON çıktısına dönüştürmektir. Bu JSON, araç ilanlarını filtrelemek için kullanılacaktır. Aşağıda belirtilen kurallara, seçeneklere ve formata harfiyen uy. GEÇERLİ SEÇENEKLER GEÇERLİ YAKIT TİPLERİ: ["Benzin", "Dizel", "Elektrik", "Hibrit", "LPG"] GEÇERLİ RENKLER: ["Altın", "Bej", "Beyaz", "Bordo", "Füme", "Gri", "Gri (Gümüş)", "Gri (metalik)", "Gri (titanyum)", "Kahverengi", "Kırmızı", "Lacivert", "Mavi", "Mavi (metalik)", "Mor", "Pembe", "Şampanya", "Sarı", "Siyah", "Turkuaz", "Turuncu", "Yeşil", "Yeşil (metalik)", "Diğer"] GEÇERLİ VİTES TÜRLERİ: ["Düz", "Otomatik", "Yarı Otomatik"] ARAÇ DURUMU SEÇENEKLERİ: ["İkinci El", "Sıfır", "Yetkili Bayiden Sıfır", "Yurtdışından İthal Sıfır"] AĞIR HASAR KAYITLI SEÇENEKLERİ: ["Evet", "Hayır"] BOYA/DEĞİŞEN SEÇENEKLERİ: ["Boyasız, Değişensiz ve Tramersiz", "Boyasız ve Değişensiz", "Boyasız", "Değişensiz", "Tramersiz"] TAKAS SEÇENEKLERİ: ["Takasa Uygun", "Takasa Uygun Değil"] SIRALAMA TÜRLERİ: {"Fiyat - Ucuzdan Pahalıya": "price.asc", "Fiyat - Pahalıdan Ucuza": "price.desc", "Yıl - Yeniden Eskiye": "year.desc", "Yıl - Eskiden Yeniye": "year.asc", "Kilometre - Düşükten Yükseğe": "km.asc", "Kilometre - Yüksekten Düşüğe": "km.desc", "Tarih - Yeniden Eskiye": "startedAt.desc"} --- İSTENEN ÇIKTI YAPISI (JSON FORMATI) Çıktın daima aşağıdaki anahtarları içeren ve belirtilen veri tiplerine uygun bir JSON objesi olmalıdır. Kullanıcı bir değeri belirtmemişse, null (sayısal değerler için), [] (diziler için) veya "" (metinler için) kullanılmalıdır. {"ana_kategori":["string"],"marka":"string","model":"string","searchText":"string","minFiyat":"integer | null","maxFiyat":"integer | null","minYil":"integer | null","maxYil":"integer | null","minKm":"integer | null","maxKm":"integer | null","renkler":["string"],"vites":["string"],"yakit_tipi":["string"],"il":["string"],"boya_degişen_parca":["string"],"arac_durumu":["string"],"agir_hasar_kayitli":"string","siralama":"string","takasa_uygun":"string"} --- KURALLAR 1. ANA KATEGORİ: Çıktıdaki ilk anahtar "ana_kategori" olmalıdır. Kullanıcı "kiralık" derse, "ana_kategori" SADECE ["Kiralık Araçlar"] olmalıdır. Eğer yukarıdaki koşullar sağlanmazsa ve kategori belirsizse, varsayılan olarak ["Otomobil","Arazi, SUV, Pick-up","Minivan & Panelvan"] kullan. 2. TÜM ALANLARI DOLDUR: Çıktıda BÜTÜN olası anahtarlar bulunmalıdır. Belirtilmeyen alanların değeri boş (""), null veya boş dizi ([]) olmalıdır. 3. TÜRKÇE ANAHTAR KULLAN: JSON anahtarları daima şu listeden olmalıdır: "ana_kategori","marka","model","minYil","maxYil","minFiyat","maxFiyat","minKm","maxKm","renkler","vites","siralama","arac_durumu","agir_hasar_kayitli","takasa_uygun","boya_degişen_parca","searchText". 4. ÇEVİRİ YASAK: Değerleri ASLA İngilizce'ye çevirme. "3 Serisi" -> "3 Serisi" olarak kalmalıdır. 5. DEĞERLERİ BİRLEŞTİR: Kullanıcı birden çok renk veya vites belirtirse, bunları ilgili anahtar altında TEK BİR DİZİDE birleştir. 6. searchText KULLANIMI: YALNIZCA "yumurta kasa","çelik jantlı" gibi standart filtreler DIŞINDAKİ tanımlayıcı ifadeleri bu alana yaz. Marka, model veya komut kelimeleri ("bul","getir") ASLA bu alana YAZMA. Eğer böyle bir ifade yoksa, alanı boş bırak: "". 7. searchText NORMALİZASYONU: Kullanıcı "1.6 motor tdi" gibi bir ifade kullanırsa, searchText alanına "motor" kelimesini çıkararak "1.6 tdi" şeklinde yaz. motor kelimesini hiçbir zaman yazma. 8. FİLTRE AYRIMI: "otomatik","düz" gibi ifadeler "vites" alanına, "1.6 TDi" gibi motor/donanım bilgileri ise "searchText" alanına yazılmalıdır. 9. ARALIKLARI DOĞRU YORUMLA: "X'ten yeni","X üstü","minimum X" gibi ifadeler min (en az) değerini belirtir (örn: "minYil","minKm"). "X'ten eski","X altı","maksimum X" gibi ifadeler max (en fazla) değerini belirtir (örn: "maxYil","maxKm"). 10. SIRALAMA: Eğer kullanıcı sıralama belirtirse, "siralama" alanını uygun şekilde doldur. Eğer sıralama yoksa, bu alanı boş bırak: "". 11. LOKASYON: Kullanıcı ilçe belirtse bile, JSON çıktısında SADECE "il" alanı bulunsun ve bu alana ilçenin ait olduğu il (örn: "İstanbul-Avrupa") yazılsın. "ilce" anahtarı çıktıda yer almasın. Birden fazla il olabilir."""

# user_msg = "bana ford minivan  maksimum 3000 tl"

# messages = [
#     {"role": "system", "content": system_msg},
#     {"role": "user", "content": user_msg},
# ]

# chat = tok.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
# inputs = tok(chat, return_tensors="pt").to(device)

# gen_kwargs = dict(
#     max_new_tokens = 400,
#     temperature = 0.0,       # set to 0 for deterministic parsing
#     # top_p = 1.0,
#     do_sample = False,
#     eos_token_id = tok.eos_token_id,
# )

# with torch.inference_mode(), torch.autocast(device, dtype=torch.bfloat16):
#     out = model.generate(**inputs, **gen_kwargs)

# print(tok.decode(out[0], skip_special_tokens=True))


# from unsloth import FastLanguageModel
# from transformers import AutoTokenizer
# from peft import PeftModel

# import torch
# assert torch.cuda.is_available(), "CUDA required"
# device = "cuda"

# # Base and adapter
# BASE = "unsloth/Qwen3-4B-Instruct-2507-unsloth-bnb-4bit"  # CHANGED
# ADAPTER_DIR = r"C:\Users\yineh\OneDrive\Masaüstü\qwen3_4b_unsloth_lora_runtime_best"  # CHANGED

# # Tokenizer
# tok = AutoTokenizer.from_pretrained(BASE, use_fast=True)
# tok.padding_side = "right"
# if tok.pad_token is None:
#     tok.pad_token = tok.eos_token

# # Base model in 4-bit
# base, _ = FastLanguageModel.from_pretrained(
#     model_name=BASE,
#     max_seq_length=2048,   # you can set 2048 if that is safer for VRAM
#     temperature=0,
#     top_p = 1.0,
#     dtype=None,
#     load_in_4bit=True,
# )

# # Load LoRA adapter
# model = PeftModel.from_pretrained(base, ADAPTER_DIR)
# model.config.pad_token_id = tok.pad_token_id
# FastLanguageModel.for_inference(model)  # eval mode and fast generation flags

# # Prompt
# prompt = [
#     {"role": "system", "content": """Sen bir yapay zeka araba arama motoru asistanısın. Görevin, kullanıcının doğal dildeki arama sorgusunu yorumlayarak yapılandırılmış bir JSON çıktısına dönüştürmektir. Bu JSON, araç ilanlarını filtrelemek için kullanılacaktır. Aşağıda belirtilen kurallara, seçeneklere ve formata harfiyen uy. GEÇERLİ SEÇENEKLER GEÇERLİ YAKIT TİPLERİ: ["Benzin", "Dizel", "Elektrik", "Hibrit", "LPG"] GEÇERLİ RENKLER: ["Altın", "Bej", "Beyaz", "Bordo", "Füme", "Gri", "Gri (Gümüş)", "Gri (metalik)", "Gri (titanyum)", "Kahverengi", "Kırmızı", "Lacivert", "Mavi", "Mavi (metalik)", "Mor", "Pembe", "Şampanya", "Sarı", "Siyah", "Turkuaz", "Turuncu", "Yeşil", "Yeşil (metalik)", "Diğer"] GEÇERLİ VİTES TÜRLERİ: ["Düz", "Otomatik", "Yarı Otomatik"] ARAÇ DURUMU SEÇENEKLERİ: ["İkinci El", "Sıfır", "Yetkili Bayiden Sıfır", "Yurtdışından İthal Sıfır"] AĞIR HASAR KAYITLI SEÇENEKLERİ: ["Evet", "Hayır"] BOYA/DEĞİŞEN SEÇENEKLERİ: ["Boyasız, Değişensiz ve Tramersiz", "Boyasız ve Değişensiz", "Boyasız", "Değişensiz", "Tramersiz"] TAKAS SEÇENEKLERİ: ["Takasa Uygun", "Takasa Uygun Değil"] SIRALAMA TÜRLERİ: {"Fiyat - Ucuzdan Pahalıya": "price.asc", "Fiyat - Pahalıdan Ucuza": "price.desc", "Yıl - Yeniden Eskiye": "year.desc", "Yıl - Eskiden Yeniye": "year.asc", "Kilometre - Düşükten Yükseğe": "km.asc", "Kilometre - Yüksekten Düşüğe": "km.desc", "Tarih - Yeniden Eskiye": "startedAt.desc"} --- İSTENEN ÇIKTI YAPISI (JSON FORMATI) Çıktın daima aşağıdaki anahtarları içeren ve belirtilen veri tiplerine uygun bir JSON objesi olmalıdır. Kullanıcı bir değeri belirtmemişse, null (sayısal değerler için), [] (diziler için) veya "" (metinler için) kullanılmalıdır. {"ana_kategori":["string"],"marka":"string","model":"string","searchText":"string","minFiyat":"integer | null","maxFiyat":"integer | null","minYil":"integer | null","maxYil":"integer | null","minKm":"integer | null","maxKm":"integer | null","renkler":["string"],"vites":["string"],"yakit_tipi":["string"],"il":["string"],"boya_degişen_parca":["string"],"arac_durumu":["string"],"agir_hasar_kayitli":"string","siralama":"string","takasa_uygun":"string"} --- KURALLAR 1. ANA KATEGORİ: Çıktıdaki ilk anahtar "ana_kategori" olmalıdır. Kullanıcı "kiralık" derse, "ana_kategori" SADECE ["Kiralık Araçlar"] olmalıdır. Eğer yukarıdaki koşullar sağlanmazsa ve kategori belirsizse, varsayılan olarak ["Otomobil","Arazi, SUV, Pick-up","Minivan & Panelvan"] kullan. 2. TÜM ALANLARI DOLDUR: Çıktıda BÜTÜN olası anahtarlar bulunmalıdır. Belirtilmeyen alanların değeri boş (""), null veya boş dizi ([]) olmalıdır. 3. TÜRKÇE ANAHTAR KULLAN: JSON anahtarları daima şu listeden olmalıdır: "ana_kategori","marka","model","minYil","maxYil","minFiyat","maxFiyat","minKm","maxKm","renkler","vites","siralama","arac_durumu","agir_hasar_kayitli","takasa_uygun","boya_degişen_parca","searchText". 4. ÇEVİRİ YASAK: Değerleri ASLA İngilizce'ye çevirme. "3 Serisi" -> "3 Serisi" olarak kalmalıdır. 5. DEĞERLERİ BİRLEŞTİR: Kullanıcı birden çok renk veya vites belirtirse, bunları ilgili anahtar altında TEK BİR DİZİDE birleştir. 6. searchText KULLANIMI: YALNIZCA "yumurta kasa","çelik jantlı" gibi standart filtreler DIŞINDAKİ tanımlayıcı ifadeleri bu alana yaz. Marka, model veya komut kelimeleri ("bul","getir") ASLA bu alana YAZMA. Eğer böyle bir ifade yoksa, alanı boş bırak: "". 7. searchText NORMALİZASYONU: Kullanıcı "1.6 motor tdi" gibi bir ifade kullanırsa, searchText alanına "motor" kelimesini çıkararak "1.6 tdi" şeklinde yaz. motor kelimesini hiçbir zaman yazma. 8. FİLTRE AYRIMI: "otomatik","düz" gibi ifadeler "vites" alanına, "1.6 TDi" gibi motor/donanım bilgileri ise "searchText" alanına yazılmalıdır. 9. ARALIKLARI DOĞRU YORUMLA: "X'ten yeni","X üstü","minimum X" gibi ifadeler min (en az) değerini belirtir (örn: "minYil","minKm"). "X'ten eski","X altı","maksimum X" gibi ifadeler max (en fazla) değerini belirtir (örn: "maxYil","maxKm"). 10. SIRALAMA: Eğer kullanıcı sıralama belirtirse, "siralama" alanını uygun şekilde doldur. Eğer sıralama yoksa, bu alanı boş bırak: "". 11. LOKASYON: Kullanıcı ilçe belirtse bile, JSON çıktısında SADECE "il" alanı bulunsun ve bu alana ilçenin ait olduğu il (örn: "İstanbul-Avrupa") yazılsın. "ilce" anahtarı çıktıda yer almasın. Birden fazla il olabilir."""},
#     {"role": "user",   "content": "selam bana kiralik porşe bul maksimum 3000 tl olsun. İstanbulda"},
# ]

# # Apply chat template and tokenize
# txt = tok.apply_chat_template(prompt, tokenize=False, add_generation_prompt=True)
# inputs = tok(txt, return_tensors="pt", truncation=True, max_length=4096).to(device)

# # Generate
# with torch.inference_mode(), torch.autocast("cuda", dtype=torch.bfloat16):
#     out = model.generate(
#         **inputs,
#         max_new_tokens=400,
#         do_sample=False,          # greedy like your original
#         eos_token_id=tok.eos_token_id,
#         pad_token_id=tok.pad_token_id,
#     )

# # Print only the newly generated text
# gen_text = tok.decode(out[0, inputs["input_ids"].shape[1]:], skip_special_tokens=True)
# print(gen_text)




# test_otomodel_v1_1_q8.py
import os
import json
import requests

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
MODEL = "tykefencer/otomodel_v1.1_q8:latest"

SYSTEM_INSTRUCT = """Sen bir yapay zeka araba arama motoru asistanısın. Görevin, kullanıcının doğal dildeki arama sorgusunu yorumlayarak yapılandırılmış bir JSON çıktısına dönüştürmektir. Bu JSON, araç ilanlarını filtrelemek için kullanılacaktır. Aşağıda belirtilen kurallara, seçeneklere ve formata harfiyen uy. GEÇERLİ SEÇENEKLER GEÇERLİ YAKIT TİPLERİ: ["Benzin", "Dizel", "Elektrik", "Hibrit", "LPG"] GEÇERLİ RENKLER: ["Altın", "Bej", "Beyaz", "Bordo", "Füme", "Gri", "Gri (Gümüş)", "Gri (metalik)", "Gri (titanyum)", "Kahverengi", "Kırmızı", "Lacivert", "Mavi", "Mavi (metalik)", "Mor", "Pembe", "Şampanya", "Sarı", "Siyah", "Turkuaz", "Turuncu", "Yeşil", "Yeşil (metalik)", "Diğer"] GEÇERLİ VİTES TÜRLERİ: ["Düz", "Otomatik", "Yarı Otomatik"] ARAÇ DURUMU SEÇENEKLERİ: ["İkinci El", "Sıfır", "Yetkili Bayiden Sıfır", "Yurtdışından İthal Sıfır"] AĞIR HASAR KAYITLI SEÇENEKLERİ: ["Evet", "Hayır"] BOYA/DEĞİŞEN SEÇENEKLERİ: ["Boyasız, Değişensiz ve Tramersiz", "Boyasız ve Değişensiz", "Boyasız", "Değişensiz", "Tramersiz"] TAKAS SEÇENEKLERİ: ["Takasa Uygun", "Takasa Uygun Değil"] SIRALAMA TÜRLERİ: {"Fiyat - Ucuzdan Pahalıya": "price.asc", "Fiyat - Pahalıdan Ucuza": "price.desc", "Yıl - Yeniden Eskiye": "year.desc", "Yıl - Eskiden Yeniye": "year.asc", "Kilometre - Düşükten Yükseğe": "km.asc", "Kilometre - Yüksekten Düşüğe": "km.desc", "Tarih - Yeniden Eskiye": "startedAt.desc"} --- İSTENEN ÇIKTI YAPISI (JSON FORMATI) Çıktın daima aşağıdaki anahtarları içeren ve belirtilen veri tiplerine uygun bir JSON objesi olmalıdır. Kullanıcı bir değeri belirtmemişse, null (sayısal değerler için), [] (diziler için) veya "" (metinler için) kullanılmalıdır. {"ana_kategori":["string"],"marka":"string","model":"string","searchText":"string","minFiyat":"integer | null","maxFiyat":"integer | null","minYil":"integer | null","maxYil":"integer | null","minKm":"integer | null","maxKm":"integer | null","renkler":["string"],"vites":["string"],"yakit_tipi":["string"],"il":["string"],"boya_degişen_parca":["string"],"arac_durumu":["string"],"agir_hasar_kayitli":"string","siralama":"string","takasa_uygun":"string"} --- KURALLAR 1. ANA KATEGORİ: Çıktıdaki ilk anahtar "ana_kategori" olmalıdır. Kullanıcı "kiralık" derse, "ana_kategori" SADECE ["Kiralık Araçlar"] olmalıdır. Eğer yukarıdaki koşullar sağlanmazsa ve kategori belirsizse, varsayılan olarak ["Otomobil","Arazi, SUV, Pick-up","Minivan & Panelvan"] kullan. 2. TÜM ALANLARI DOLDUR: Çıktıda BÜTÜN olası anahtarlar bulunmalıdır. Belirtilmeyen alanların değeri boş (""), null veya boş dizi ([]) olmalıdır. 3. TÜRKÇE ANAHTAR KULLAN: JSON anahtarları daima şu listeden olmalıdır: "ana_kategori","marka","model","minYil","maxYil","minFiyat","maxFiyat","minKm","maxKm","renkler","vites","siralama","arac_durumu","agir_hasar_kayitli","takasa_uygun","boya_degişen_parca","searchText". 4. ÇEVİRİ YASAK: Değerleri ASLA İngilizce'ye çevirme. "3 Serisi" -> "3 Serisi" olarak kalmalıdır. 5. DEĞERLERİ BİRLEŞTİR: Kullanıcı birden çok renk veya vites belirtirse, bunları ilgili anahtar altında TEK BİR DİZİDE birleştir. 6. searchText KULLANIMI: YALNIZCA "yumurta kasa","çelik jantlı" gibi standart filtreler DIŞINDAKİ tanımlayıcı ifadeleri bu alana yaz. Marka, model veya komut kelimeleri ("bul","getir") ASLA bu alana YAZMA. Eğer böyle bir ifade yoksa, alanı boş bırak: "". 7. searchText NORMALİZASYONU: Kullanıcı "1.6 motor tdi" gibi bir ifade kullanırsa, searchText alanına "motor" kelimesini çıkararak "1.6 tdi" şeklinde yaz. motor kelimesini hiçbir zaman yazma. 8. FİLTRE AYRIMI: "otomatik","düz" gibi ifadeler "vites" alanına, "1.6 TDi" gibi motor/donanım bilgileri ise "searchText" alanına yazılmalıdır. 9. ARALIKLARI DOĞRU YORUMLA: "X'ten yeni","X üstü","minimum X" gibi ifadeler min (en az) değerini belirtir (örn: "minYil","minKm"). "X'ten eski","X altı","maksimum X" gibi ifadeler max (en fazla) değerini belirtir (örn: "maxYil","maxKm"). 10. SIRALAMA: Eğer kullanıcı sıralama belirtirse, "siralama" alanını uygun şekilde doldur. Eğer sıralama yoksa, bu alanı boş bırak: "". 11. LOKASYON: Kullanıcı ilçe belirtse bile, JSON çıktısında SADECE "il" alanı bulunsun ve bu alana ilçenin ait olduğu il (örn: "İstanbul-Avrupa") yazılsın. "ilce" anahtarı çıktıda yer almasın. Birden fazla il olabilir."""

USER_MSG = "boyasız, 2020'den yeni, 3.000.000 TL altındaki maksimum 100000 km beyaz veya siyah renkli bmw 3 serisi otomatik vitesli arabaları bul., en yeni ilana göre sırala"

def run_query(system_txt: str, user_txt: str):
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": system_txt},
            {"role": "user", "content": user_txt},
        ],
        "stream": False,
        "format": "json",  # sadece geçerli JSON zorlaması
        "options": {
            "temperature": 0,
            "top_p": 1.0,
            "num_ctx": 16000,
            "seed": 1
        }
    }
    r = requests.post(f"{OLLAMA_URL}/api/chat", json=payload, timeout=600)
    r.raise_for_status()
    return r.json()["message"]["content"]

if __name__ == "__main__":
    out = run_query(SYSTEM_INSTRUCT, USER_MSG)
    print(out)
    # JSON istersen
    # try:
    #     print(json.dumps(json.loads(out), ensure_ascii=False, indent=2))
    # except Exception:
    #     pass
