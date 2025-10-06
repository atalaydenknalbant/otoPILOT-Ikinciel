import { CheerioCrawler, RequestQueue } from 'crawlee';

export class FavoriteScraper {
    async scrapeFavorites(urls) {
        // URL listesi kontrolü - boş veya geçersiz ise boş array döndür
        if (!Array.isArray(urls) || urls.length === 0) {
            console.log('Favori scraping: URL listesi boş veya geçersiz');
            return [];
        }

        console.log(`Favori scraping başlatıldı: ${urls.length} URL`);
        const scrapedData = [];

        try {
            // Mevcut scrape.js ile aynı yapıyı kullan - RequestQueue ile
            const requestQueue = await RequestQueue.open(`favorites-${Date.now()}-${Math.random().toString(36).slice(2)}`);

            const crawler = new CheerioCrawler({
                requestQueue,
                requestHandlerTimeoutSecs: 180,
                async requestHandler({ request, $, log }) {
                    try {
                        const url = request.loadedUrl;
                        console.log(`İşleniyor: ${url}`);
                        
                        // Araç detay sayfasından veri çekme - mevcut scrape.js'teki gibi
                        const title = $('h1.listing-title').text().trim() || 
                                     $('.listing-title').text().trim() ||
                                     $('h1').first().text().trim() ||
                                     'Başlık bulunamadı';
                        
                        // Fiyat bilgisi çekme - mevcut scrape.js'teki gibi
                        const price = $('.price').text().trim() || 
                                     $('.listing-price').text().trim() ||
                                     $('[class*="price"]').first().text().trim() ||
                                     'Fiyat bilgisi yok';
                        
                        // İlan detayındaki doğru görseli seç
                        const preferredSelectors = [
                            '#slider .swiper-wrapper .swiper-slide.swiper-slide-active img',
                            '#slider .swiper-wrapper .swiper-slide[data-swiper-slide-index="0"] img',
                            '#slider img.swiper-main-img',
                            'img.swiper-main-img',
                            '#slider img[data-src*="ilanfotograflari"]',
                            '#slider img[src*="ilanfotograflari"]',
                        ];

                        const pickSrc = (el) => (el?.attr('data-src') || el?.attr('src') || '').trim();

                        let imageUrl = '';
                        for (const selector of preferredSelectors) {
                            const el = $(selector).first();
                            const src = pickSrc(el);
                            if (src) { imageUrl = src; break; }
                        }

                        // Fallback 1: Open Graph görseli
                        if (!imageUrl) {
                            const og = $('meta[property="og:image"]').attr('content');
                            if (og) imageUrl = og.trim();
                        }

                        // Fallback 2: Depolama alanından gelen ilk uygun görsel
                        if (!imageUrl) {
                            $('img').each((_, img) => {
                                const $img = $(img);
                                const altText = ($img.attr('alt') || '').toLocaleLowerCase('tr');
                                const src = ($img.attr('data-src') || $img.attr('src') || '').trim();
                                const isLogo = /logo/.test(altText) || /logo/i.test(src);
                                const isListingImg = /arbstorage\.(mncdn|mmcdn)\.com/.test(src) || /ilanfotograflari/.test(src);
                                if (!isLogo && isListingImg && src && !imageUrl) {
                                    imageUrl = src;
                                }
                            });
                        }
                        
                        // Yıl bilgisi çekme
                        const year = $('.listing-attributes .year').text().trim() ||
                                    $('[class*="year"]').text().trim() ||
                                    title.match(/\b(19|20)\d{2}\b/)?.[0] ||
                                    'Yıl bilgisi yok';
                        
                        // Kilometre bilgisi çekme
                        const km = $('.listing-attributes .km').text().trim() ||
                                  $('[class*="km"]').text().trim() ||
                                  title.match(/\d+\.?\d*\s*km/i)?.[0] ||
                                  'KM bilgisi yok';
                        
                        // Konum bilgisi çekme
                        const location = $('.listing-location').text().trim() ||
                                       $('[class*="location"]').text().trim() ||
                                       $('.city').text().trim() ||
                                       'Konum bilgisi yok';
                        
                        // Model bilgisi çekme
                        const model = $('.listing-model').text().trim() ||
                                     $('[class*="model"]').text().trim() ||
                                     title.split(' ')[0] ||
                                     'Model bilgisi yok';

                        // Veri varsa ekle - mevcut scrape.js'teki gibi
                        if (url && title && title !== 'Başlık bulunamadı') {
                            const carData = { 
                                source: 'arabam.com', 
                                url: url, 
                                imageUrl: imageUrl?.trim(), 
                                model: model.trim(), 
                                title: title.trim(), 
                                year: year.trim(), 
                                km: km.trim(), 
                                price: price.trim(), 
                                date: new Date().toLocaleDateString('tr-TR'), 
                                location: location.trim()
                            };
                            
                            scrapedData.push(carData);
                            
                            console.log(`✓ ${title} - Resim: ${imageUrl ? 'VAR' : 'YOK'}`);
                        } else {
                            console.log(`Veri yetersiz, atlandı: ${url}`);
                        }
                    } catch (error) {
                        console.error(`URL işlenirken hata (${request.loadedUrl}):`, error);
                        // Hata olsa bile devam et, diğer URL'leri işle
                    }
                },
            });

            // URL'leri sıraya ekle - mevcut scrape.js'teki gibi
            for (const url of urls) {
                await requestQueue.addRequest({ url });
            }
            
            // Scraping işlemini başlat
            await crawler.run();

            console.log(`Favori scraping tamamlandı: ${scrapedData.length} araç bulundu`);
            return scrapedData;

        } catch (error) {
            console.error('Favori scraping genel hatası:', error);
            // Hata olsa bile mevcut verileri döndür
            return scrapedData;
        }
    }
}

