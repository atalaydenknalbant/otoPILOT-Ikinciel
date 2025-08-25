# scrape.py
import logging
from urllib.parse import urlencode, urlparse, parse_qs, urlunparse
from crawlee.crawlers import ParselCrawler, ParselCrawlingContext
from parsel import Selector

log = logging.getLogger(__name__)

class ArabamScraper:
    def _get_category_slug(self, category_name: str) -> str:
        slug_map = {
            "Otomobil": "otomobil",
            "Arazi, SUV, Pick-up": "arazi-suv-pick-up",
            "Minivan & Panelvan": "minivan-van_panelvan",
            "Kiralık Araçlar": "kiralik-araclar"
        }
        return slug_map.get(category_name, "otomobil")

    def _build_url_with_filters(self, user_input: dict, category: str) -> str:
        category_slug = self._get_category_slug(category)
        base_url = f"https://www.arabam.com/ikinci-el/{category_slug}"

        params = {'take': '50'}
        for key, param_key in {
            'minYear': 'minYear', 'maxYear': 'maxYear', 'minPrice': 'minPrice',
            'maxPrice': 'maxPrice', 'minKm': 'minkm', 'maxKm': 'maxkm', 'sort': 'sort',
            'swap': 'swap', 'severaldamaged': 'severaldamaged', 'searchText': 'searchText'
        }.items():
            value = user_input.get(key)
            if value is not None and value != '':
                params[param_key] = value

        if user_input.get('searchText'):
            params['searchDesc'] = 'true'

        list_params = []
        for key, param_key in {
            'colors': 'color', 'gear': 'gear', 'status': 'status', 'damagestatus': 'damagestatus'
        }.items():
            value_list = user_input.get(key, [])
            if value_list:
                for item in value_list:
                    list_params.append((param_key, item))

        brand = user_input.get('brand')
        model = user_input.get('model')
        if brand and category != "Kiralık Araçlar":
            base_url += f"/{brand.lower().replace(' ', '-')}"
            if model:
                base_url += f"-{model.lower().replace(' ', '-')}"

        query_string = urlencode(params)
        if list_params:
            query_string += f"&{urlencode(list_params, doseq=True)}"
            
        final_url = f"{base_url}?{query_string}"
        log.info(f"Oluşturulan URL ({category}): {final_url}")
        return final_url

    async def scrape(self, user_input: dict, category: str) -> list:
        start_url = self._build_url_with_filters(user_input, category)
        all_scraped_data = []

        async def request_handler(context: ParselCrawlingContext):
            selector: Selector = context.selector
            log.info(f'Sayfa işleniyor: {context.request.url}')

            parsed_url = urlparse(context.request.url)
            query_params = parse_qs(parsed_url.query)
            current_page_str = query_params.get('page', ['1'])[0]

            if current_page_str.isdigit() and int(current_page_str) == 1:
                try:
                    total_page_text = selector.css('#js-hook-for-total-page-count::text').get()
                    last_page_number = int(total_page_text)
                    if last_page_number > 1:
                        context.log.info(f'Toplam {last_page_number} sayfa bulundu, sayfalar sıraya ekleniyor...')
                        urls_to_enqueue = []
                        for i in range(2, last_page_number + 1):
                            # query_params bir liste döndürdüğü için [str(i)] olarak atıyoruz
                            query_params['page'] = [str(i)]
                            new_query = urlencode(query_params, doseq=True)
                            next_page_url = urlunparse(parsed_url._replace(query=new_query))
                            urls_to_enqueue.append(next_page_url)
                        await context.enqueue_links(urls=urls_to_enqueue)
                except (ValueError, TypeError, AttributeError):
                    context.log.warning('Sayfalama bilgisi alınamadı.')

            for row in selector.css('tr.listing-list-item'):
                if not row.css('::attr(id)').get():
                    continue
                try:
                    partial_url = row.css('td.horizontal-half-padder-minus.pr > a::attr(href)').get()
                    listing_url = f"https://www.arabam.com{partial_url}"
                    image_url = row.css('td:nth-child(1) img::attr(data-src)').get() or row.css('td:nth-child(1) img::attr(src)').get()
                    model = " ".join(row.css('td.listing-modelname h3 > div *::text').getall()).strip()
                    title = " ".join(row.css('td.horizontal-half-padder-minus h4 > div *::text').getall()).strip()
                    year = (row.css('td:nth-of-type(4)::text').get() or "").strip()
                    km = (row.css('td:nth-of-type(5)::text').get() or "").strip()
                    price = (row.css('span.listing-price::text').get() or "").strip()
                    date = " ".join(row.css('td.listing-text.tac *::text').getall()).strip()
                    location_full = (row.css('td:nth-of-type(9)::text').get() or "").strip()
                    location = location_full.split('Karşılaştır')[0].strip()

                    all_scraped_data.append({
                        'source': 'arabam.com', 'url': listing_url,
                        'imageUrl': image_url.strip() if image_url else None,
                        'model': model, 'title': title, 'year': year,
                        'km': km, 'price': price,
                        'date': ' '.join(date.split()), 'location': location
                    })
                except Exception as e:
                    context.log.error(f"İlan satırı işlenemedi. Hata: {e}")

        crawler = ParselCrawler(request_handler=request_handler)
        await crawler.run([start_url])
        return all_scraped_data