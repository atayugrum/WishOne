require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cheerio = require('cheerio');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- ROUTES ---

// Helper: Scrape Product Data
async function scrapeProduct(url) {
    // Robust Headers
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache'
    };

    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
    const html = await response.text();
    const $ = cheerio.load(html);

    // Extraction Helpers
    const getMeta = (prop) => $(`meta[property="${prop}"]`).attr('content') || $(`meta[name="${prop}"]`).attr('content');

    let title = getMeta('og:title') || getMeta('twitter:title') || $('title').text() || '';
    const image = getMeta('og:image') || getMeta('twitter:image') || $('link[rel="image_src"]').attr('href') || $('#landingImage').attr('src') || '';
    const description = getMeta('og:description') || getMeta('twitter:description') || getMeta('description') || '';

    // Amazon Specifics
    if (url.includes('amazon')) {
        const amazonTitle = $('#productTitle').text().trim();
        if (amazonTitle) title = amazonTitle;
    }

    // Price Extraction
    let price = getMeta('product:price:amount') || getMeta('og:price:amount');
    let currency = getMeta('product:price:currency') || getMeta('og:price:currency');

    // Fallback Price
    if (!price) {
        // Amazon
        const amazonPrice = $('.a-price-whole').first().text().replace(/[^0-9]/g, '');
        if (amazonPrice) {
            price = amazonPrice;
            const symbol = $('.a-price-symbol').first().text();
            if (symbol.includes('₺')) currency = 'TRY';
            else if (symbol.includes('$')) currency = 'USD';
            else if (symbol.includes('€')) currency = 'EUR';
        }
    }

    return {
        title: title.trim(),
        imageUrl: image,
        description: description.trim(),
        price: price ? Number(price.replace(',', '.')) : null,
        currency: currency || 'TRY',
        url: url
    };
}

// 1. Magic Add: Fetch Metadata from URL (Scraping)
app.post('/api/product/metadata', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'URL is required' });

        const data = await scrapeProduct(url);
        res.json(data);

    } catch (error) {
        console.error('Metadata fetch error:', error.message);
        res.json({
            title: '',
            imageUrl: '',
            description: '',
            price: null,
            currency: null,
            url: req.body.url,
            error: error.message
        });
    }
});

// 1.5 Price Refresh
app.post('/api/product/refresh', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'URL is required' });

        const data = await scrapeProduct(url);
        res.json({ price: data.price, currency: data.currency });

    } catch (error) {
        console.error('Price refresh error:', error.message);
        res.status(500).json({ error: 'Failed to refresh price' });
    }
});

// 2. AI Suggestion: Enhance Item Data (Gemini)
app.post('/api/ai/suggestion', async (req, res) => {
    try {
        const { title, description, url } = req.body;

        if (!process.env.GEMINI_API_KEY) {
            return res.status(503).json({ error: 'AI service unavailable (Key missing)' });
        }

        // Use Gemini 2.0 Flash
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const prompt = `
            Analyze this product:
            Title: ${title}
            Description: ${description}
            URL: ${url}

            Return a JSON object with:
            - "category": Best fit category (e.g., Tech, Home, Fashion, Wellness, Experience, Other)
            - "subcategory": A short 1-2 word subcategory
            - "shortTitle": A clean, concise version of the title (max 5 words)
            - "priceEstimate": A number (guess) if you can infer it, else null
            - "currency": "TRY", "USD", or "EUR" (default to TRY if unknown)
            
            Output JSON only.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Clean markdown
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(jsonStr);

        res.json(data);

    } catch (error) {
        console.error('AI error:', error);
        res.status(500).json({ error: 'AI processing failed' });
    }
});

// 3. AI Chat / Reaction
app.post('/api/ai/reaction', async (req, res) => {
    try {
        res.json({ message: "That sounds amazing! Great choice." });
    } catch (error) {
        res.status(500).json({ error: 'AI reaction failed' });
    }
});

// 4. Currency Rates
let cachedRates = null;
let lastFetchTime = 0;
const CACHE_DURATION = 3600 * 1000; // 1 hour

app.get('/api/currency/rates', async (req, res) => {
    try {
        const now = Date.now();
        if (cachedRates && (now - lastFetchTime < CACHE_DURATION)) {
            return res.json(cachedRates);
        }

        // Fetch from free API (Base: TRY)
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/TRY');
        if (!response.ok) throw new Error('Failed to fetch rates');

        const data = await response.json();
        cachedRates = data.rates;
        lastFetchTime = now;

        res.json(cachedRates);
    } catch (error) {
        console.error('Currency fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch currency rates' });
    }
});

app.listen(PORT, () => {
    console.log(`WishOne Backend running on http://localhost:${PORT}`);
});
