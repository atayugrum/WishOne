const functions = require('firebase-functions');
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cheerio = require('cheerio');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const admin = require('firebase-admin');

const app = express();

// Middleware
app.use(cors({ origin: true }));
app.use(express.json());

// --- LOGGING UTILITY ---
const Logger = {
    info: (event, data = {}) => console.log(JSON.stringify({ level: 'INFO', timestamp: new Date(), event, ...data })),
    error: (event, error) => console.error(JSON.stringify({ level: 'ERROR', timestamp: new Date(), event, message: error.message, stack: error.stack })),
    metric: (metricName, value = 1) => console.log(JSON.stringify({ level: 'METRIC', timestamp: new Date(), metric: metricName, value })),
    warn: (event, data = {}) => console.log(JSON.stringify({ level: 'WARN', timestamp: new Date(), event, ...data }))
};

// Request Logging Middleware
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        Logger.info('API_REQUEST', {
            method: req.method,
            path: req.path,
            status: res.statusCode,
            duration: `${Date.now() - start}ms`
        });
    });
    next();
});

// --- CONFIGURATION ---
// FIX: Use process.env directly. Cloud Functions loads variables into process.env automatically.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SCHEDULER_SECRET = process.env.SCHEDULER_SECRET;

// Initialize Gemini AI
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// Initialize Firebase Admin
let db = null;
try {
    if (!admin.apps.length) {
        admin.initializeApp();
    }
    db = admin.firestore();
    Logger.info("FIREBASE_INIT_SUCCESS");
} catch (e) {
    Logger.error("FIREBASE_INIT_FAIL", e);
}

// --- CONSTANTS ---
const CATEGORY_MAP = {
    "Tech": ["Audio", "Gaming", "Apple", "Smart Home", "Accessories"],
    "Fashion": ["Tops", "Bottoms", "Shoes", "Bags", "Jewelry", "Outerwear"],
    "Home": ["Decor", "Furniture", "Kitchen", "Plants", "Lighting"],
    "Beauty": ["Skincare", "Makeup", "Perfume", "Hair"],
    "Experience": ["Travel", "Dining", "Events", "Workshops"],
    "Wellness": ["Fitness", "Mindfulness", "Supplements", "Gear"],
    "Other": ["Books", "Stationery", "Gifts", "Misc"]
};

const ALLOWED_MOODS = [
    'idle', 'welcome', 'thinking', 'magic', 'celebrating',
    'dancing', 'loving', 'zen', 'presenting', 'error'
];

// --- HELPERS ---
function cleanAndParseJSON(text) {
    try {
        return JSON.parse(text);
    } catch (e) {
        let clean = text.replace(/```json|```/g, '').trim();
        clean = clean.replace(/\/\/.*$/gm, '');
        const firstOpen = clean.indexOf('{');
        const lastClose = clean.lastIndexOf('}');
        if (firstOpen !== -1 && lastClose !== -1) {
            clean = clean.substring(firstOpen, lastClose + 1);
            try {
                return JSON.parse(clean);
            } catch (e2) {
                throw new Error("Failed to parse JSON snippet");
            }
        }
        throw new Error("No JSON found");
    }
}

function parsePrice(priceStr, currency) {
    if (!priceStr) return null;
    let clean = priceStr.replace(/[^0-9.,]/g, '').trim();
    if (!clean) return null;
    const lastDot = clean.lastIndexOf('.');
    const lastComma = clean.lastIndexOf(',');
    let isDotDecimal = (lastDot > -1 && lastComma > -1) ? lastDot > lastComma : (lastDot > -1 ? true : (lastComma > -1 ? !['EUR', 'TRY'].includes(currency) : false));
    let normalized = isDotDecimal ? clean.replace(/,/g, '') : clean.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(normalized);
    return isNaN(num) ? null : num;
}

function mapSubcategory(category, subcategory) {
    if (!category || !subcategory) return null;
    const catKey = Object.keys(CATEGORY_MAP).find(k => k.toLowerCase() === category.toLowerCase());
    if (!catKey) return null;
    const validSubs = CATEGORY_MAP[catKey];
    const target = subcategory.toLowerCase().trim();
    return validSubs.find(s => s.toLowerCase() === target) || validSubs.find(s => target.includes(s.toLowerCase())) || null;
}

async function scrapeProduct(url) {
    try {
        const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en-US' } });
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
        const html = await response.text();
        const $ = cheerio.load(html);
        const getMeta = (p) => $(`meta[property="${p}"]`).attr('content') || $(`meta[name="${p}"]`).attr('content');

        let title = getMeta('og:title') || $('title').text() || '';
        let image = getMeta('og:image') || $('link[rel="image_src"]').attr('href');
        let description = getMeta('og:description') || '';
        let rawPrice = getMeta('product:price:amount') || getMeta('og:price:amount');
        let currency = getMeta('product:price:currency') || getMeta('og:price:currency') || 'TRY';

        if (!rawPrice) {
            const txt = $('.price, .product-price, .a-price-whole').first().text().trim();
            if (txt) rawPrice = txt;
        }

        const price = parsePrice(rawPrice, currency);
        const sourceSite = new URL(url).hostname.replace('www.', '');
        return { title: title.trim(), imageUrl: image, description: description.trim(), price, currency, sourceSite, url };
    } catch (error) {
        Logger.error("SCRAPE_ERROR", error);
        return { title: '', imageUrl: '', price: null, currency: 'TRY', sourceSite: null, url, error: error.message };
    }
}

// --- ROUTES ---

// 1. Magic Add Metadata
app.post('/api/product/metadata', async (req, res) => {
    Logger.metric('magic_add_request');
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'URL is required' });

        const data = await scrapeProduct(url);

        if (genAI && (data.title || data.description)) {
            try {
                const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
                const prompt = `Analyze: ${data.title} ${data.description.substring(0, 200)} ${data.price}. Cats: ${JSON.stringify(CATEGORY_MAP)}. Output strict JSON only. No markdown. No comments. JSON: { "category": "String", "subcategory": "String", "cleanTitle": "String", "priorityLevel": "String", "priorityLabel": "String", "reason": "String", "estimatedPrice": Number }`;
                const result = await model.generateContent(prompt);
                const aiData = cleanAndParseJSON(result.response.text());

                if (aiData.category) data.category = aiData.category;
                if (aiData.subcategory) data.subcategory = mapSubcategory(data.category, aiData.subcategory);
                if (aiData.cleanTitle) data.title = aiData.cleanTitle;
                data.priorityLevel = aiData.priorityLevel;
                data.priorityLabel = aiData.priorityLabel;
                data.reason = aiData.reason;
                if (!data.price) data.price = aiData.estimatedPrice;

                Logger.metric('ai_enrichment_success');
            } catch (e) { Logger.error("AI_ENRICH_FAIL", e); }
        }
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 2. AI Combo Suggestions
app.post('/api/ai/combo-suggestions', async (req, res) => {
    Logger.metric('ai_combo_request');
    try {
        const { closetItems } = req.body;
        if (!genAI) return res.status(503).json({ error: 'AI unavailable' });

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const prompt = `Stylist Task: Create 1-3 outfits from: ${JSON.stringify(closetItems.map(i => ({ id: i.id, name: i.title, cat: i.category })))}. Output strict JSON only. No markdown. JSON: { "combos": [{ "name": "String", "description": "String", "itemIds": ["id1"] }] }`;
        const result = await model.generateContent(prompt);

        const json = cleanAndParseJSON(result.response.text());
        res.json(json);
    } catch (e) {
        Logger.error("AI_COMBO_FAIL", e);
        res.status(500).json({ error: e.message });
    }
});

// 3. AI Purchase Planner
app.post('/api/ai/purchase-planner', async (req, res) => {
    Logger.metric('ai_planner_request');
    try {
        const { wishlistItems, budget, currency } = req.body;
        if (!genAI) return res.status(503).json({ error: 'AI unavailable' });

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const prompt = `Budget: ${budget} ${currency}. Items: ${JSON.stringify(wishlistItems.map(i => ({ id: i.id, name: i.title, price: i.price, priority: i.priority })))}. Pick items. Output strict JSON only. No markdown. No comments. JSON: { "recommendedItems": [{ "itemId": "String", "reason": "String" }], "summary": "String" }`;
        const result = await model.generateContent(prompt);

        const json = cleanAndParseJSON(result.response.text());
        res.json(json);
    } catch (e) {
        Logger.error("AI_PLANNER_FAIL", e);
        res.status(500).json({ error: "AI Planner failed to parse response." });
    }
});

// 4. Currency Rates
app.get('/api/currency/rates', (req, res) => {
    res.json({ TRY: 1, USD: 0.030, EUR: 0.028, GBP: 0.024 });
});

// 5. AI Reaction (Dynamic Mascot)
app.post('/api/ai/reaction', async (req, res) => {
    try {
        const { context, userAction } = req.body;

        if (!genAI) return res.json({ message: "That looks amazing!", mood: "presenting" });

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const prompt = `
            You are a Zen, friendly AI mascot for a wishlist app called WishOne.
            User Action: ${userAction}
            Context: ${JSON.stringify(context)}
            Task: Generate a short, warm, encouraging reaction message (max 12 words) and pick a mood from: ${JSON.stringify(ALLOWED_MOODS)}.
            Output strict JSON only. No markdown. JSON: { "message": "String", "mood": "String" }
        `;
        const result = await model.generateContent(prompt);
        res.json(cleanAndParseJSON(result.response.text()));
    } catch (error) {
        Logger.error("AI_REACTION_FAIL", error);
        res.json({ message: "Stored safely.", mood: "idle" });
    }
});

// 6. AI Moodboard
app.post('/api/ai/moodboard', async (req, res) => {
    Logger.metric('ai_moodboard_request');
    try {
        const { title, existingPins } = req.body;
        if (!genAI) return res.status(503).json({ error: 'AI unavailable' });
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const prompt = `Context: Moodboard titled "${title}". Existing: ${existingPins?.length || 0}. Task: Suggest 3-4 product TYPES. Output strict JSON only. JSON: { "suggestions": [{ "name": "String", "why": "String" }] }`;
        const result = await model.generateContent(prompt);
        res.json(cleanAndParseJSON(result.response.text()));
    } catch (e) { Logger.error("AI_MOODBOARD_FAIL", e); res.status(500).json({ error: e.message }); }
});

// 7. AI Compatibility
app.post('/api/ai/compatibility', async (req, res) => {
    Logger.metric('ai_compatibility_request');
    try {
        const { userItems, friendItems, names } = req.body;
        if (!genAI) return res.status(503).json({ error: 'AI unavailable' });
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const prompt = `Analyze compatibility. A (${names.user}) items count: ${userItems.length}. B (${names.friend}) items count: ${friendItems.length}. Output strict JSON only. JSON: { "summary": "String", "score": Number, "sharedInterests": ["Tag1"] }`;
        const result = await model.generateContent(prompt);
        res.json(cleanAndParseJSON(result.response.text()));
    } catch (e) { Logger.error("AI_COMPATIBILITY_FAIL", e); res.status(500).json({ error: e.message }); }
});

// 8. PRICE REFRESH JOB
app.post('/api/jobs/refresh-prices', async (req, res) => {
    if (!db) return res.status(500).json({ error: 'Firestore not connected' });

    // --- SECURITY CHECK ---
    const authHeader = req.headers['x-scheduler-secret'];
    if (authHeader !== SCHEDULER_SECRET) {
        Logger.warn("JOB_UNAUTHORIZED_ATTEMPT");
        return res.status(403).json({ error: 'Unauthorized' });
    }

    Logger.metric('job_price_refresh_start');
    try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const snapshot = await db.collection('items')
            .where('originalUrl', '!=', null)
            .where('lastUpdatedAt', '<', admin.firestore.Timestamp.fromDate(yesterday))
            .limit(10)
            .get();

        const updates = [];
        for (const doc of snapshot.docs) {
            const item = doc.data();
            const newData = await scrapeProduct(item.originalUrl);

            if (newData.price && newData.price !== item.price) {
                updates.push({ id: doc.id, old: item.price, new: newData.price });
                await doc.ref.update({
                    price: newData.price,
                    lastPrice: item.price,
                    onSale: newData.price < (item.originalPrice || item.price),
                    lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            } else {
                await doc.ref.update({ lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp() });
            }
        }
        Logger.info('JOB_PRICE_REFRESH_COMPLETE', { checked: snapshot.size, updates: updates.length });
        res.json({ success: true, checked: snapshot.size, updates });
    } catch (error) {
        Logger.error("JOB_PRICE_REFRESH_FAIL", error);
        res.status(500).json({ error: error.message });
    }
});

// Export as Cloud Function
exports.api = functions.https.onRequest(app);