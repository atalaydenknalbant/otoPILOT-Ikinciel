import { CheerioCrawler, log } from 'crawlee';

export class AdvertScraper {
  async scrapeAdvert(url) {
    try {
      console.log(`İlan scrape başlatılıyor: ${url}`);
      
      let scrapedData = null;
      
      const crawler = new CheerioCrawler({
        async requestHandler({ request, $ }) {
          try {
            console.log(`İlan scrape ediliyor: ${request.url}`);
            
            // Arabam.com ilan sayfası yapısına göre veri çekme
            const title = $('h1[data-testid="ad-title"]').text().trim() || 
                         $('.detail-title').text().trim() ||
                         $('h1').first().text().trim();
            
            const price = $('[data-testid="ad-price"]').text().trim() ||
                         $('.detail-price').text().trim() ||
                         $('.price').first().text().trim();
            
            const location = $('[data-testid="ad-location"]').text().trim() ||
                            $('.detail-location').text().trim() ||
                            $('.location').first().text().trim();
            
            // Araba detayları
            const year = $('[data-testid="ad-year"]').text().trim() ||
                        $('.detail-year').text().trim() ||
                        $('.year').first().text().trim();
            
            const km = $('[data-testid="ad-km"]').text().trim() ||
                      $('.detail-km').text().trim() ||
                      $('.km').first().text().trim();
            
            // Resim URL'si - arabam.com yapısına göre
            let imageUrl = '';
            
            // Önce data-src ile dene
            const imgElement = $('img[data-src*="ilanfotograflari"]').first();
            if (imgElement.length) {
              imageUrl = imgElement.attr('data-src');
            } else {
              // Sonra src ile dene
              const imgSrc = $('img[src*="ilanfotograflari"]').first();
              if (imgSrc.length) {
                imageUrl = imgSrc.attr('src');
              } else {
                // Genel resim arama
                const generalImg = $('img').first();
                if (generalImg.length) {
                  imageUrl = generalImg.attr('src') || generalImg.attr('data-src');
                }
              }
            }
            
            // URL'yi düzelt
            if (imageUrl) {
              if (imageUrl.startsWith('//')) {
                imageUrl = 'https:' + imageUrl;
              } else if (imageUrl.startsWith('/')) {
                imageUrl = 'https://www.arabam.com' + imageUrl;
              }
            }
            
            console.log('Çekilen veriler:', {
              title,
              price,
              location,
              year,
              km,
              imageUrl
            });
            
            scrapedData = {
              title: title || 'Başlık bulunamadı',
              price: price || 'Fiyat belirtilmemiş',
              location: location || 'Konum belirtilmemiş',
              year: year || 'Yıl belirtilmemiş',
              km: km || 'KM belirtilmemiş',
              imageUrl: imageUrl || '/placeholder-car.jpg'
            };
            
          } catch (error) {
            console.error('İlan scrape hatası:', error);
            throw new Error('İlan bilgileri alınamadı');
          }
        },
      });

      // Crawler'ı çalıştır
      await crawler.run([url]);
      
      if (scrapedData) {
        console.log('İlan başarıyla scrape edildi');
        return scrapedData;
      } else {
        throw new Error('İlan bilgileri alınamadı');
      }
      
    } catch (error) {
      console.error('Scrape hatası:', error);
      throw error;
    }
  }
}
