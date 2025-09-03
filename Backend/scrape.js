import { CheerioCrawler, log, RequestQueue } from 'crawlee';
import { URLSearchParams } from 'url';

export class ArabamScraper {

    _getCategorySlug(categoryName) {
        const slugMap = {
            "Otomobil": "otomobil",
            "Arazi, SUV, Pick-up": "arazi-suv-pick-up",
            "Minivan & Panelvan": "minivan-van_panelvan",
            "Kiralık Araçlar": "kiralik-araclar"
        };
        return slugMap[categoryName] || "otomobil";
    }

    _buildUrlWithFilters(userInput, category) {
        const { brand, model, minYear, maxYear, minPrice, maxPrice, minKm, maxKm, 
                colors = [], gear = [], sort, status = [], severaldamaged, swap, 
                damagestatus = [], searchText } = userInput;
        
        const categorySlug = this._getCategorySlug(category);
        let baseUrl = `https://www.arabam.com/ikinci-el/${categorySlug}`;

        if (brand && category !== "Kiralık Araçlar") {
            baseUrl += `/${brand.toLowerCase().replace(/ /g, '-')}`;
            if (model) {
                baseUrl += `-${model.toLowerCase().replace(/ /g, '-')}`;
            }
        }

        const params = new URLSearchParams();
        params.set('take', '50');

        if (minYear) params.set('minYear', minYear);
        if (maxYear) params.set('maxYear', maxYear);
        if (minPrice) params.set('minPrice', minPrice);
        if (maxPrice) params.set('maxPrice', maxPrice);
        if (minKm) params.set('minkm', minKm);
        if (maxKm) params.set('maxkm', maxKm);
        if (sort) params.set('sort', sort);
        if (swap) params.set('swap', swap);
        if (severaldamaged) params.set('severaldamaged', severaldamaged);
        
        if (searchText) {
            params.set('searchText', searchText);
            params.set('searchDesc', 'true');
        }
        
        gear.forEach(g => params.append('gear', g));
        colors.forEach(c => params.append('color', c));
        status.forEach(s => params.append('status', s));
        damagestatus.forEach(d => params.append('damagestatus', d));
        
        const finalUrl = `${baseUrl}?${params.toString()}`;
        log.info(`Oluşturulan URL (${category}): ${finalUrl}`);
        return finalUrl;
    }

    async scrape(userInput, category) {
        const startUrl = this._buildUrlWithFilters(userInput, category);
        const allScrapedData = [];

        // Use a fresh RequestQueue per run to avoid cross-run deduplication
        const requestQueue = await RequestQueue.open(`arabam-${Date.now()}-${Math.random().toString(36).slice(2)}`);

        const crawler = new CheerioCrawler({
            requestQueue,
            requestHandlerTimeoutSecs: 180,
            async requestHandler({ request, $, enqueueLinks, log }) {
                const url = new URL(request.loadedUrl);
                
                // --- DÜZELTME: Sayfalama (Pagination) mantığı geri eklendi ---
                // Sadece ilk sayfadayken diğer sayfaları sıraya ekle
                if (parseInt(url.searchParams.get('page') || '1', 10) === 1) {
                    try {
                        const totalPageText = $('#js-hook-for-total-page-count').text();
                        const lastPageNumber = parseInt(totalPageText, 10);
                        if (!isNaN(lastPageNumber) && lastPageNumber > 1) {
                            const urlsToEnqueue = [];
                            log.info(`Toplam ${lastPageNumber} sayfa bulundu, diğer sayfalar sıraya ekleniyor...`);
                            for (let i = 2; i <= lastPageNumber; i++) {
                                url.searchParams.set('page', i);
                                urlsToEnqueue.push(url.toString());
                            }
                            await enqueueLinks({ urls: urlsToEnqueue });
                        }
                    } catch (error) {
                        log.warning('Sayfalama bilgisi alınamadı.');
                    }
                }

                const carRows = $('tr.listing-list-item');

                for (const row of carRows) {
                    const rowElement = $(row);
                    try {
                        const rowId = rowElement.attr('id');
                        if (!rowId) continue;
                        const partialUrl = rowElement.find('td.horizontal-half-padder-minus.pr > a').attr('href');
                        const listingUrl = `https://www.arabam.com${partialUrl}`;
                        const imageElement = rowElement.find('td:nth-child(1) img');
                        const imageUrl = imageElement.attr('data-src') || imageElement.attr('src');
                        const model = rowElement.find('td.listing-modelname h3 > div').text();
                        const title = rowElement.find('td.horizontal-half-padder-minus h4 > div').text();
                        const year = rowElement.find('td:nth-of-type(4)').text();
                        const km = rowElement.find('td:nth-of-type(5)').text();
                        const color = rowElement.find('td:nth-of-type(6)').text();
                        const price = rowElement.find('span.listing-price').text();
                        const date = rowElement.find('td.listing-text.tac').text();
                        const fullLocationText = rowElement.find('td:nth-of-type(9)').text();
                        const location = fullLocationText.split('Karşılaştır')[0].trim();
                        allScrapedData.push({ 
                            source: 'arabam.com', url: listingUrl, imageUrl: imageUrl?.trim(), 
                            model: model.trim(), title: title.trim(), year: year.trim(), 
                            km: km.trim(), color: color.trim(), price: price.trim(), 
                            date: date.replace(/\s+/g, ' ').trim(), location: location
                        });
                    } catch (e) {
                        log.error(`Bir ilan satırı işlenirken hata oluştu: ${e.message}`);
                    }
                }
            },
        });

        // Seed the start URL into the fresh queue and run
        await requestQueue.addRequest({ url: startUrl });
        await crawler.run();
        return allScrapedData;
    }
}
