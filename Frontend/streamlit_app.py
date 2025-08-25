import streamlit as st
import requests
import json
import psutil

# --- Use st.secrets for the API URL in production ---
SCRAPER_API_URL = st.secrets.get("SCRAPER_API_URL", "http://localhost:8080") 

st.set_page_config(layout="wide")
st.title("🚗 IkinciEl PİLOT")
st.caption("Canlı Araba RAG Ajanı")

# --- Initialize session state for the button logic ---
if 'searching' not in st.session_state:
    st.session_state.searching = False
if 'search_complete' not in st.session_state:
    st.session_state.search_complete = False
if 'retrieved_data' not in st.session_state:
    st.session_state.retrieved_data = None

def display_resource_monitor():
    st.sidebar.header("📊 Kaynak Gözlemcisi (Lokal)")
    try:
        def bytes_to_gb(bytes_value):
            return bytes_value / (1024**3)
        ram = psutil.virtual_memory()
        ram_used_gb = bytes_to_gb(ram.used)
        ram_total_gb = bytes_to_gb(ram.total)
        st.sidebar.progress(ram.percent / 100, text=f"RAM: {ram_used_gb:.1f} GB / {ram_total_gb:.1f} GB")
        disk = psutil.disk_usage('/')
        disk_used_gb = bytes_to_gb(disk.used)
        disk_total_gb = bytes_to_gb(disk.total)
        st.sidebar.progress(disk.percent / 100, text=f"Disk: {disk_used_gb:.1f} GB / {disk_total_gb:.1f} GB")
        st.sidebar.caption("Bu uygulamayı çalıştıran makinenin toplam sistem kullanımını gösterir.")
    except Exception as e:
        st.sidebar.caption(f"Kaynak verileri alınamadı: {e}")

display_resource_monitor()

def call_api(endpoint, payload):
    url = f"{SCRAPER_API_URL}{endpoint}"
    try:
        response = requests.post(url, json=payload, timeout=300)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        st.error(f"Backend sunucusuna bağlanırken hata oluştu ({url}): {e}")
        return None
    except json.JSONDecodeError:
        st.error(f"Backend sunucusu ({url}) geçersiz bir yanıt döndü. Backend loglarını kontrol edin.")
        return None

# --- Streamlit UI ---
# GÜNCELLEME: Varsayılan arama metni isteğiniz üzerine değiştirildi.
user_input = st.text_input(
    "Nasıl bir araba arıyorsunuz?", 
    "boyasız, 2020'den yeni, 3.000.000 TL altındaki maksimum 100000 km beyaz veya siyah renkli bmw 3 serisi otomatik vitesli arabaları bul., en yeni ilana göre sırala", 
    key="user_query_input"
)

if st.button("Araba Bul", disabled=(st.session_state.searching or st.session_state.search_complete)):
    st.session_state.searching = True
    st.session_state.search_complete = False
    st.session_state.retrieved_data = None
    st.rerun()

if st.session_state.searching:
    try:
        if st.session_state.user_query_input:
            query_params = None
            with st.spinner("Adım 1/2: Talebiniz yapay zeka tarafından anlaşılıyor..."):
                parse_payload = {"query": st.session_state.user_query_input}
                query_params = call_api("/parse", parse_payload)
                if query_params:
                    st.info(f"Yapay Zeka Talebinizi Şu Şekilde Anladı: {json.dumps(query_params, indent=2, ensure_ascii=False)}")
                else:
                    st.error("Dil modeli talebinizi anlayamadı.")
            
            if query_params:
                with st.spinner("Adım 2/2: Canlı veri çekici başlatılıyor..."):
                    st.session_state.retrieved_data = call_api("/scrape", query_params)
    finally:
        st.session_state.searching = False
        st.session_state.search_complete = True
        st.rerun()

if st.session_state.search_complete:
    st.markdown("---")
    st.header("🔍 Veri Çekici Sonuçları")
    retrieved_data = st.session_state.retrieved_data

    col1, col2, _ = st.columns([1, 1, 3])

    with col2:
        if st.button("Tekrar Ara"):
            st.session_state.search_complete = False
            st.session_state.searching = False
            st.session_state.retrieved_data = None
            st.rerun()
            
    if retrieved_data:
        st.success(f"Arama tamamlandı. {len(retrieved_data)} adet eşleşen araba bulundu.")
        
        with col1:
            st.download_button(
               label="📄 Tüm Sonuçları İndir",
               data=json.dumps(retrieved_data, indent=2, ensure_ascii=False),
               file_name="scraped_car_data.json",
               mime="application/json",
            )

        max_cars_to_show = 20
        cars_to_display = retrieved_data[:max_cars_to_show]
        num_columns = 5
        for i in range(0, len(cars_to_display), num_columns):
            cols = st.columns(num_columns)
            row_cars = cars_to_display[i:i+num_columns]
            for j, car in enumerate(row_cars):
                with cols[j]:
                    title = car.get('model', 'N/A')
                    listing_url = car.get('url', '#')
                    image_url = car.get('imageUrl')
                    st.markdown(f'**<a href="{listing_url}" target="_blank" style="text-decoration: none; color: inherit;">{title}</a>**', unsafe_allow_html=True)
                    st.caption(f"{car.get('price', 'N/A')}")
                    if image_url:
                        st.markdown(f'<a href="{listing_url}" target="_blank"><img src="{image_url}" style="width:100%; border-radius:5px;"></a>', unsafe_allow_html=True)
                    st.caption(f"{car.get('year', '')} | {car.get('km', '')} km")
                    st.caption(f"{car.get('location', '')}")
    else:
        st.error("Veri çekiciden herhangi bir veri alınamadı veya eşleşen araba bulunamadı.")