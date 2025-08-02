import { PlaywrightCrawler, log } from 'crawlee';
import express from 'express';
import { URLSearchParams } from 'url';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 8080;
app.use(express.json());

const OLLAMA_API_URL = "http://localhost:11434/api/chat";
const VALID_COLORS = new Set(['Altın', 'Bej', 'Beyaz', 'Bordo', 'Füme', 'Gri', 'Gri (Gümüş)', 'Gri (metalik)', 'Gri (titanyum)', 'Kahverengi', 'Kırmızı', 'Lacivert', 'Mavi', 'Mavi (metalik)', 'Mor', 'Pembe', 'Şampanya', 'Sarı', 'Siyah', 'Turkuaz', 'Turuncu', 'Yeşil', 'Yeşil (metalik)', 'Diğer']);

function buildUrlWithFilters(userInput) {
    const { brand, model, minYear, maxYear, minPrice, maxPrice, minKm, maxKm, colors = [] } = userInput;
    if (!brand || !model) throw new Error("Brand and model must be provided.");
    const baseUrl = `https://www.arabam.com/ikinci-el/otomobil/${brand.toLowerCase()}-${model.toLowerCase()}`;
    const params = new URLSearchParams();
    params.set('take', '50');
    if (minYear) params.set('minYear', minYear);
    if (maxYear) params.set('maxYear', maxYear);
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (minKm) params.set('minkm', minKm);
    if (maxKm) params.set('maxkm', maxKm);
    colors.forEach(color => {
        if (VALID_COLORS.has(color)) params.append('color', color);
    });
    return `${baseUrl}?${params.toString()}`;
}

async function scrapeData(userInput) {
    const allScrapedData = [];
    const startUrl = buildUrlWithFilters(userInput);
    const crawler = new PlaywrightCrawler({
        requestHandlerTimeoutSecs: 180,
        headless: true,
        async requestHandler({ request, page, enqueueLinks, log }) {
            try {
                const acceptButton = page.locator('button:has-text("Kabul Et")');
                if (await acceptButton.isVisible({ timeout: 7000 })) await acceptButton.click();
            } catch (e) {}
            await page.evaluate(async () => { /* ... scrolling logic ... */ });
            const url = new URL(request.loadedUrl);
            if (parseInt(url.searchParams.get('page') || '1', 10) === 1) {
                try {
                    const totalPageText = await page.locator('#js-hook-for-total-page-count').innerText({ timeout: 5000 });
                    const lastPageNumber = parseInt(totalPageText, 10);
                    if (!isNaN(lastPageNumber) && lastPageNumber > 1) {
                        const urlsToEnqueue = [];
                        for (let i = 2; i <= lastPageNumber; i++) {
                            url.searchParams.set('page', i);
                            urlsToEnqueue.push(url.toString());
                        }
                        await enqueueLinks({ urls: urlsToEnqueue });
                    }
                } catch (error) {}
            }
            const carRows = await page.locator('tr.listing-list-item').all();
            for (const row of carRows) {
                try {
                    const rowId = await row.getAttribute('id');
                    if (!rowId) continue;
                    const imageUrl = await page.locator(`#${rowId} td:nth-child(1) img`).getAttribute('src');
                    const model = await page.locator(`#${rowId} td.listing-modelname h3 > div`).innerText();
                    const listingTitle = await page.locator(`#${rowId} td.horizontal-half-padder-minus h4 > div`).innerText();
                    const year = await page.locator(`#${rowId} td:nth-of-type(4)`).innerText();
                    const km = await page.locator(`#${rowId} td:nth-of-type(5)`).innerText();
                    const color = await page.locator(`#${rowId} td:nth-of-type(6)`).innerText();
                    const price = await page.locator(`#${rowId} span.listing-price`).innerText();
                    const listingDate = await page.locator(`#${rowId} td.listing-text.tac`).innerText();
                    const location = await page.locator(`#${rowId} td:nth-of-type(9)`).innerText();
                    allScrapedData.push({ source: 'arabam.com', imageUrl, model: model.trim(), title: listingTitle.trim(), year: year.trim(), km: km.trim(), color: color.trim(), price: price.trim(), date: listingDate.replace(/\s+/g, ' ').trim(), location: location.replace(/\s+/g, ' ').trim() });
                } catch (e) {}
            }
        },
    });
    await crawler.run([startUrl]);
    return allScrapedData;
}

app.post('/scrape', async (req, res) => {
    log.info('Received /scrape request');
    try {
        const data = await scrapeData(req.body);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Scraper failed' });
    }
});

app.post('/generate', async (req, res) => {
    log.info('Received /generate request');
    const { query, scraped_data } = req.body;
    const prompt = `Based ONLY on this data: ${JSON.stringify(scraped_data, null, 2)}. Answer this question: "${query}"`;
    
    try {
        const response = await fetch(OLLAMA_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                // --- FIX: Update to the new, smaller model ---
                model: 'qwen2.5:0.5b',
                messages: [{ role: 'user', content: prompt }],
                stream: false
            })
        });
        const responseData = await response.json();
        res.json(responseData.message);
    } catch (error) {
        res.status(500).json({ error: 'LLM generation failed' });
    }
});

app.listen(PORT, () => {
    log.info(`API server listening on port ${PORT}`);
});