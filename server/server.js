require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cheerio = require('cheerio');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const admin = require('firebase-admin');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Gemini AI
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

// Initialize Firebase Admin
let db = null;
try {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_CONFIG) {
        admin.initializeApp({
            credential: admin.credential.applicationDefault()
        });
        db = admin.firestore();
        console.log("Firebase Admin initialized.");
    }
} catch (e) {
    console.warn("Firebase Init Error (Non-fatal):", e.message);
}

// --- CONFIG ---
const CATEGORY_MAP = {
    "Tech": ["Audio", "Gaming", "Apple", "Smart Home", "Accessories"],
    "Fashion": ["Tops", "Bottoms", "Shoes", "Bags", "Jewelry", "Outerwear"],
    "Home": ["Decor", "Furniture", "Kitchen", "Plants", "Lighting"],
    "Beauty": ["Skincare", "Makeup", "Perfume", "Hair"],
    "Experience": ["Travel", "Dining", "Events", "Workshops"],
    "Wellness": ["Fitness", "Mindfulness", "Supplements", "Gear"],
    "Other": ["Books", "Stationery", "Gifts", "Misc"]
};

// --- HELPERS ---
function parsePrice(priceStr, currency) {
    if (!priceStr) return null;
    let clean = priceStr.replace(/[^0-9.,]/g, '').trim();
    if (!clean) return null;

    const lastDot = clean.lastIndexOf('.');
    const lastComma = clean.lastIndexOf(',');
    let isDotDecimal = false;

    if (lastDot > -1 && lastComma > -1) {
        isDotDecimal = lastDot > lastComma;
    } else if (lastDot > -1) {
        isDotDecimal = true;
    } else if (lastComma > -1) {
        isDotDecimal = !['EUR', 'TRY'].includes(currency);
    }

    let normalized = isDotDecimal
        ? clean.replace(/,/g, '')
        : clean.replace(/\./g, '').replace(',', '.');

    const num = parseFloat(normalized);
    return isNaN(num) ? null : num;
}

function mapSubcategory(category, subcategory) {
    if (!category || !subcategory) return null;
    const catKey = Object.keys(CATEGORY_MAP).find(k => k.toLowerCase() === category.toLowerCase());
    if (!catKey) return null;

    const validSubs = CATEGORY_MAP[catKey];
    const target = subcategory.toLowerCase().trim();

    // Direct or partial match
    return validSubs.find(s => s.toLowerCase() === target) ||
        validSubs.find(s => target.includes(s.toLowerCase())) ||
        null;
}

async function scrapeProduct(url) {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });
        if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
        const html = await response.text();
        const $ = cheerio.load(html);

        const getMeta = (p) => $(`meta[property="${p}"]`).attr('content') || $(`meta[name="${p}"]`).attr('content');

        let title = getMeta('og:title') || $('title').text() || '';
        let image = getMeta('og:image') || $('link[rel="image_src"]').attr('href') || $('.a-dynamic-image').attr('src');
        let description = getMeta('og:description') || '';

        // Price logic
        let rawPrice = getMeta('product:price:amount') || getMeta('og:price:amount');
        let currency = getMeta('product:price:currency') || getMeta('og:price:currency');

        if (!rawPrice) {
            const selectors = ['.a-price-whole', '.product-price', '.price', '.prc-dsc'];
            for (const s of selectors) {
                const txt = $(s).first().text().trim();
                if (txt) { rawPrice = txt; break; }
            }
        }

        // Currency fallback
        if (!currency) {
            const body = $('body').text();
            if (body.includes('₺') || body.includes('TL')) currency = 'TRY';
            else if (body.includes('€')) currency = 'EUR';
            else currency = 'USD';
        }

        const price = parsePrice(rawPrice, currency);
        const sourceSite = new URL(url).hostname.replace('www.', '');

        return { title: title.trim(), imageUrl: image, description: description.trim(), price, currency, sourceSite, url };
    } catch (error) {
        console.error("Scrape Error:", error.message);
        return { title: '', imageUrl: '', price: null, currency: 'TRY', sourceSite: null, url, error: error.message };
    }
}

// --- ROUTES ---

// 1. Magic Add Metadata
app.post('/api/product/metadata', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'URL is required' });

        const data = await scrapeProduct(url);

        if (genAI && (data.title || data.description)) {
            try {
                const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
                const prompt = `
                    Analyze product: ${data.title} ${data.description.substring(0, 200)} ${data.price}
                    Cats: ${JSON.stringify(CATEGORY_MAP)}
                    Output JSON: { "category": "String", "subcategory": "String", "cleanTitle": "String", "priorityLevel": "LOW|MEDIUM|HIGH|MUST_HAVE", "priorityLabel": "String", "reason": "String", "estimatedPrice": Number }
                `;
                const result = await model.generateContent(prompt);
                const aiData = JSON.parse(result.response.text().replace(/```json|```/g, '').trim());

                if (aiData.category) data.category = aiData.category;
                if (aiData.subcategory) data.subcategory = mapSubcategory(data.category, aiData.subcategory);
                if (aiData.cleanTitle) data.title = aiData.cleanTitle;
                data.priorityLevel = aiData.priorityLevel;
                data.priorityLabel = aiData.priorityLabel;
                data.reason = aiData.reason;
                if (!data.price) data.price = aiData.estimatedPrice;
            } catch (e) { console.warn("AI Fail", e.message); }
        }
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 2. AI Combo Suggestions
app.post('/api/ai/combo-suggestions', async (req, res) => {
    try {
        const { closetItems } = req.body;
        if (!genAI) return res.status(503).json({ error: 'AI unavailable' });

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const prompt = `
            Stylist Task: Create 1-3 outfits from these items: ${JSON.stringify(closetItems.map(i => ({ id: i.id, name: i.title, cat: i.category })))}
            Output JSON: { "combos": [{ "name": "String", "description": "String", "itemIds": ["id1", "id2"] }] }
        `;
        const result = await model.generateContent(prompt);
        const json = JSON.parse(result.response.text().replace(/```json|```/g, '').trim());
        res.json(json);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 3. AI Purchase Planner
app.post('/api/ai/purchase-planner', async (req, res) => {
    try {
        const { wishlistItems, budget, currency } = req.body;
        if (!genAI) return res.status(503).json({ error: 'AI unavailable' });

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const prompt = `
            Budget: ${budget} ${currency}. Items: ${JSON.stringify(wishlistItems.map(i => ({ id: i.id, name: i.title, price: i.price, priority: i.priority })))}
            Pick best items to buy.
            Output JSON: { "recommendedItems": [{ "itemId": "String", "reason": "String" }], "summary": "String", "weeklySavingHint": "String" }
        `;
        const result = await model.generateContent(prompt);
        const json = JSON.parse(result.response.text().replace(/```json|```/g, '').trim());
        res.json(json);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 4. Currency Rates (The one that was 404ing)
app.get('/api/currency/rates', (req, res) => {
    res.json({ TRY: 1, USD: 0.030, EUR: 0.028, GBP: 0.024 });
});

// 5. AI Reaction Endpoint (New)
app.post('/api/ai/reaction', async (req, res) => {
    try {
        res.json({ message: "That sounds amazing! Great choice." });
    } catch (error) {
        res.status(500).json({ error: 'AI reaction failed' });
    }
});

// Start Server
const server = app.listen(PORT, () => {
    console.log(`WishOne Backend running on http://localhost:${PORT}`);
});
server.on('error', (e) => console.error("Server Error:", e));