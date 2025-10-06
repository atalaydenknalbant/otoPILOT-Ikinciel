import { CheerioCrawler, log, RequestQueue } from 'crawlee';
import { URLSearchParams } from 'url';

export class ArabamScraper {

    _normalizeCityKey(name) {
        const s = String(name || '').toLocaleLowerCase('tr');
        return s
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/ı/g, 'i')
            .replace(/ş/g, 's')
            .replace(/ğ/g, 'g')
            .replace(/ç/g, 'c')
            .replace(/ö/g, 'o')
            .replace(/ü/g, 'u')
            .replace(/[^a-z0-9]/g, '');
    }

    _getCityCode(cityNameOrCode) {
        // Accept numeric codes directly
        if (cityNameOrCode == null) return null;
        const str = String(cityNameOrCode).trim();
        if (/^\d+$/.test(str)) {
            const n = parseInt(str, 10);
            if (n >= 1 && n <= 81) return String(n);
        }

        // Map Turkish city names to plate codes (1..81)
        const map = {
            adana: 1, adiyaman: 2, afyonkarahisar: 3, agri: 4, amasya: 5, ankara: 6, antalya: 7, artvin: 8, aydin: 9,
            balikesir: 10, bilecik: 11, bingol: 12, bitlis: 13, bolu: 14, burdur: 15, bursa: 16,
            canakkale: 17, cankiri: 18, corum: 19, denizli: 20, diyarbakir: 21, edirne: 22, elazig: 23, erzincan: 24,
            erzurum: 25, eskisehir: 26, gaziantep: 27, giresun: 28, gumushane: 29, hakkari: 30, hatay: 31, isparta: 32,
            mersin: 33, icel: 33, istanbul: 34, izmir: 35, kars: 36, kastamonu: 37, kayseri: 38, kirklareli: 39,
            kirsehir: 40, kocaeli: 41, konya: 42, kutahya: 43, malatya: 44, manisa: 45, kahramanmaras: 46, mardin: 47,
            mugla: 48, mus: 49, nevsehir: 50, nigde: 51, ordu: 52, rize: 53, sakarya: 54, samsun: 55, siirt: 56,
            sinop: 57, sivas: 58, tekirdag: 59, tokat: 60, trabzon: 61, tunceli: 62, sanliurfa: 63, usak: 64, van: 65,
            yozgat: 66, zonguldak: 67, aksaray: 68, bayburt: 69, karaman: 70, kirikkale: 71, batman: 72, sirnak: 73,
            bartin: 74, ardahan: 75, igdir: 76, yalova: 77, karabuk: 78, kilis: 79, osmaniye: 80, duzce: 81,
        };

        const key = this._normalizeCityKey(str);
        const code = map[key];
        return code ? String(code) : null;
    }

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
                damagestatus = [], searchText, city = [] } = userInput;
        
        const categorySlug = this._getCategorySlug(category);
        let baseUrl = `https://www.arabam.com/ikinci-el/${categorySlug}`;

        if (brand && category !== "Kiralık Araçlar") {
            baseUrl += `/${brand.toLowerCase().replace(/ /g, '-')}`;
            if (model) {
                baseUrl += `-${model.toLowerCase().replace(/ /g, '-')}`;
            }
        }

        const params = new URLSearchParams();
        params.set('take', '200');

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

        // Cities: accept names or numeric codes; append multiple as repeated 'city' params
        if (Array.isArray(city)) {
            for (const c of city) {
                const code = this._getCityCode(c);
                if (code) params.append('city', code);
            }
        } else if (city) {
            const code = this._getCityCode(city);
            if (code) params.append('city', code);
        }

        const finalUrl = `${baseUrl}?${params.toString()}`;
        log.info(`Oluşturulan URL (${category}): ${finalUrl}`);
        return finalUrl;
    }

    async scrape(userInput, category, signal) {
        const startUrl = this._buildUrlWithFilters(userInput, category);
        const allScrapedData = [];

        if (signal?.aborted) return allScrapedData;

        // Use a fresh RequestQueue per run to avoid cross-run deduplication
        const requestQueue = await RequestQueue.open(`arabam-${Date.now()}-${Math.random().toString(36).slice(2)}`);

        let crawler;
        const abortIfNeeded = () => {
            try { if (signal?.aborted && crawler?.autoscaledPool) crawler.autoscaledPool.abort(); } catch {}
        };
        if (signal) signal.addEventListener('abort', abortIfNeeded, { once: true });

        crawler = new CheerioCrawler({
            requestQueue,
            requestHandlerTimeoutSecs: 180,
            async requestHandler({ request, $, enqueueLinks, log }) {
                if (signal?.aborted) return;
                const url = new URL(request.loadedUrl);
                
                // --- DÜZELTME: Sayfalama (Pagination) mantığı geri eklendi ---
                // Sadece ilk sayfadayken diğer sayfaları sıraya ekle
                if (!signal?.aborted && parseInt(url.searchParams.get('page') || '1', 10) === 1) {
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

                if (signal?.aborted) return;
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
                        if (signal?.aborted) return;
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
        if (!signal?.aborted) await requestQueue.addRequest({ url: startUrl });
        if (!signal?.aborted) await crawler.run();
        if (signal) try { signal.removeEventListener('abort', abortIfNeeded); } catch {}
        return allScrapedData;
    }
}
