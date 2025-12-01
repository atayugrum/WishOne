const functions = require('firebase-functions');
const { onDocumentDeleted } = require("firebase-functions/v2/firestore");
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

// Safe Dotenv Loading
try {
    if (process.env.NODE_ENV !== 'production') {
        require('dotenv').config();
    }
} catch (e) {
    console.warn("Dotenv not loaded", e);
}

const app = express();

// Middleware
app.use(cors({ origin: true }));
app.use(express.json());

// --- LAZY INITIALIZATION ---
let dbInstance = null;
let genAIInstance = null;

function getDB() {
    if (!dbInstance) {
        if (!admin.apps.length) {
            admin.initializeApp();
        }
        dbInstance = admin.firestore();
    }
    return dbInstance;
}

function getGenAI() {
    if (!genAIInstance && process.env.GEMINI_API_KEY) {
        const { GoogleGenerativeAI } = require("@google/generative-ai"); 
        genAIInstance = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
    return genAIInstance;
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
    if (!text) return {};
    try {
        return JSON.parse(text);
    } catch (e) {
        let clean = text.replace(/```json|```/g, '').trim();
        clean = clean.replace(/\/\/.*$/gm, '');
        const firstOpen = clean.indexOf('{');
        const lastClose = clean.lastIndexOf('}');
        if (firstOpen !== -1 && lastClose !== -1) {
            clean = clean.substring(firstOpen, lastClose + 1);
            try { return JSON.parse(clean); } catch (e2) { return {}; }
        }
        return {};
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

async function urlToGenerativePart(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const arrayBuffer = await response.arrayBuffer();
        return {
            inlineData: {
                data: Buffer.from(arrayBuffer).toString("base64"),
                mimeType: response.headers.get("content-type") || "image/jpeg",
            },
        };
    } catch (e) { return null; }
}

async function scrapeProduct(url) {
    const cheerio = require('cheerio'); 
    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
        const html = await response.text();
        const $ = cheerio.load(html);

        const getMeta = (p) => $(`meta[property="${p}"]`).attr('content') || $(`meta[name="${p}"]`).attr('content');
        let title = getMeta('og:title') || $('title').text() || '';
        let description = getMeta('og:description') || '';
        let image = getMeta('og:image') || $('link[rel="image_src"]').attr('href');
        let rawPrice = getMeta('product:price:amount') || getMeta('og:price:amount');
        let currency = getMeta('product:price:currency') || 'TRY';

        try {
            $('script[type="application/ld+json"]').each((i, el) => {
                const json = JSON.parse($(el).html());
                const data = Array.isArray(json) ? json.find(i => i['@type'] === 'Product') : (json['@type'] === 'Product' ? json : null);
                if (data) {
                    if (data.name) title = data.name;
                    if (data.image) image = Array.isArray(data.image) ? data.image[0] : data.image;
                    if (data.offers) {
                        const offer = Array.isArray(data.offers) ? data.offers[0] : data.offers;
                        if (offer.price) rawPrice = offer.price;
                    }
                }
            });
        } catch (e) { }

        if (!rawPrice) rawPrice = $('.price, .product-price, .a-price-whole').first().text().trim();
        if (!image) image = $('#landingImage, #main-image').first().attr('src');
        if (image && image.startsWith('/')) try { image = new URL(image, url).href; } catch (e) { }

        return { title: title.trim(), imageUrl: image, description: description.trim(), price: parsePrice(rawPrice, currency), currency, url };
    } catch (error) {
        return { title: '', imageUrl: '', price: null, currency: 'TRY', url, error: error.message };
    }
}

// --- ROUTES ---

app.post('/api/product/metadata', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'URL required' });
        const data = await scrapeProduct(url);
        const genAI = getGenAI();
        if (genAI && (data.title || data.description)) {
            try {
                const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
                const prompt = `Analyze: ${data.title} ${data.description.substring(0, 200)} ${data.price}. Cats: ${JSON.stringify(CATEGORY_MAP)}. Output strict JSON only. JSON: { "category": "String", "subcategory": "String", "cleanTitle": "String", "priorityLevel": "String", "reason": "String", "estimatedPrice": Number }`;
                const result = await model.generateContent(prompt);
                const aiData = cleanAndParseJSON(result.response.text());
                if (aiData.category) data.category = aiData.category;
                if (aiData.subcategory) data.subcategory = mapSubcategory(data.category, aiData.subcategory);
                if (aiData.cleanTitle) data.title = aiData.cleanTitle;
                data.priorityLevel = aiData.priorityLevel;
                data.reason = aiData.reason;
                if (!data.price) data.price = aiData.estimatedPrice;
            } catch (e) { console.error("AI Enrich Fail", e); }
        }
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/ai/combo-suggestions', async (req, res) => {
    try {
        const { closetItems } = req.body;
        const genAI = getGenAI();
        if (!genAI) return res.status(503).json({ error: 'AI unavailable' });
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const prompt = `Stylist Task: Create 1-3 outfits from: ${JSON.stringify(closetItems.map(i => ({ id: i.id, name: i.title, cat: i.category })))}. Output strict JSON only. JSON: { "combos": [{ "name": "String", "description": "String", "itemIds": ["id1"] }] }`;
        const result = await model.generateContent(prompt);
        res.json(cleanAndParseJSON(result.response.text()));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/ai/purchase-planner', async (req, res) => {
    try {
        const { wishlistItems, budget, currency } = req.body;
        const genAI = getGenAI();
        if (!genAI) return res.status(503).json({ error: 'AI unavailable' });
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const prompt = `Budget: ${budget} ${currency}. Items: ${JSON.stringify(wishlistItems.map(i => ({ id: i.id, name: i.title, price: i.price, priority: i.priority })))}. Pick items. Output strict JSON only. JSON: { "recommendedItems": [{ "itemId": "String", "reason": "String" }], "summary": "String" }`;
        const result = await model.generateContent(prompt);
        res.json(cleanAndParseJSON(result.response.text()));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/ai/moodboard', async (req, res) => {
    try {
        const { title, existingPins } = req.body;
        const genAI = getGenAI();
        if (!genAI) return res.status(503).json({ error: 'AI unavailable' });
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        let promptText = `Moodboard "${title}". Describe aesthetic in 3 words, suggest 3 products. JSON: { "aesthetic": "String", "suggestions": [{ "name": "String", "why": "String" }] }`;
        const imageParts = [];
        if (existingPins && existingPins.length > 0) {
            const recentPins = existingPins.slice(-3);
            const results = await Promise.all(recentPins.map(pin => pin.imageUrl ? urlToGenerativePart(pin.imageUrl) : null));
            results.forEach(part => { if (part) imageParts.push(part); });
        }
        const result = await model.generateContent([promptText, ...imageParts]);
        res.json(cleanAndParseJSON(result.response.text()));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/ai/style-profile', async (req, res) => {
    try {
        const { items } = req.body; 
        const genAI = getGenAI();
        if (!genAI) return res.status(503).json({ error: 'AI unavailable' });
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const sample = items.slice(0, 20).map(i => `${i.title} (${i.category})`);
        const prompt = `Analyze style from items: ${sample.join(', ')}. Output strict JSON only. JSON: { "vibes": ["String", "String", "String"], "colors": ["String", "String"], "summary": "Short 2 sentence style description.", "shoppingAdvice": "One sentence tip." }`;
        const result = await model.generateContent(prompt);
        res.json(cleanAndParseJSON(result.response.text()));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/ai/reaction', async (req, res) => {
    try {
        const { userAction, context } = req.body;
        const genAI = getGenAI();
        if (!genAI) return res.json({ message: "Nice!", mood: "happy" });
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const prompt = `React to action: ${userAction} by ${context.user}. Max 10 words. Moods: ${JSON.stringify(ALLOWED_MOODS)}. JSON: { "message": "String", "mood": "String" }`;
        const result = await model.generateContent(prompt);
        res.json(cleanAndParseJSON(result.response.text()));
    } catch (e) { res.json({ message: "Cool!", mood: "idle" }); }
});

app.post('/api/ai/compatibility', async (req, res) => {
    try {
        const { userItems, friendItems, names } = req.body;
        const genAI = getGenAI();
        if (!genAI) return res.status(503).json({ error: 'AI unavailable' });
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const prompt = `Matchmaking. User: ${JSON.stringify(userItems.slice(0, 10))}. Friend: ${JSON.stringify(friendItems.slice(0, 10))}. JSON: { "summary": "String", "score": Number, "sharedInterests": ["Tag"] }`;
        const result = await model.generateContent(prompt);
        res.json(cleanAndParseJSON(result.response.text()));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// [NEW] Export Endpoint
app.post('/api/export/wishlist', async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ error: 'User ID required' });

        const db = getDB();
        
        // 1. Fetch Items
        const itemsSnap = await db.collection('items').where('ownerId', '==', userId).get();
        const items = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // 2. Fetch Boards
        const boardsSnap = await db.collection('boards').where('ownerId', '==', userId).get();
        const boards = boardsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // 3. Fetch Combos
        const combosSnap = await db.collection('combos').where('ownerId', '==', userId).get();
        const combos = combosSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // 4. Fetch Profile
        const profileSnap = await db.collection('users').doc(userId).get();
        const profile = profileSnap.exists ? profileSnap.data() : {};

        res.json({
            exportDate: new Date().toISOString(),
            app: "WishOne",
            profile: { 
                displayName: profile.displayName, 
                username: profile.username,
                bio: profile.bio
            },
            stats: {
                totalItems: items.length,
                totalBoards: boards.length
            },
            data: {
                items,
                boards,
                combos
            }
        });
    } catch (e) {
        console.error("Export error", e);
        res.status(500).json({ error: "Export failed." });
    }
});

app.get('/api/currency/rates', (req, res) => {
    res.json({ TRY: 1, USD: 0.030, EUR: 0.028, GBP: 0.024 });
});

exports.api = functions.https.onRequest(app);
exports.onItemDeleted = onDocumentDeleted("items/{itemId}", async (event) => { console.log("Item deleted:", event.params.itemId); });