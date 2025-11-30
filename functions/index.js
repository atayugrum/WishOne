const functions = require('firebase-functions');
const { onDocumentDeleted } = require("firebase-functions/v2/firestore"); // [YENİ] V2 Import
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

// --- CONFIGURATION ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SCHEDULER_SECRET = process.env.SCHEDULER_SECRET;

// --- LAZY INITIALIZATION ---
let dbInstance = null;
let genAIInstance = null;

function getDB() {
    if (!dbInstance) {
        if (!admin.apps.length) {
            admin.initializeApp();
        }
        dbInstance = admin.firestore();
        Logger.info("FIREBASE_INIT_SUCCESS");
    }
    return dbInstance;
}

function getGenAI() {
    if (!genAIInstance && GEMINI_API_KEY) {
        genAIInstance = new GoogleGenerativeAI(GEMINI_API_KEY);
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

// Helper to fetch image for multimodal AI
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
    } catch (e) {
        Logger.warn("IMAGE_FETCH_FAIL", { url });
        return null;
    }
}

async function scrapeProduct(url) {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });

        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
        const html = await response.text();
        const $ = cheerio.load(html);
        const getMeta = (p) => $(`meta[property="${p}"]`).attr('content') || $(`meta[name="${p}"]`).attr('content');

        let title = getMeta('og:title') || getMeta('twitter:title') || $('title').text() || '';
        let description = getMeta('og:description') || getMeta('twitter:description') || getMeta('description') || '';
        let image = getMeta('og:image') || getMeta('twitter:image') || $('link[rel="image_src"]').attr('href');
        let rawPrice = getMeta('product:price:amount') || getMeta('og:price:amount');
        let currency = getMeta('product:price:currency') || getMeta('og:price:currency') || 'TRY';

        try {
            $('script[type="application/ld+json"]').each((i, el) => {
                const jsonText = $(el).html();
                if (!jsonText) return;
                const json = JSON.parse(jsonText);
                const data = Array.isArray(json) ? json.find(i => i['@type'] === 'Product') : (json['@type'] === 'Product' ? json : null);

                if (data) {
                    if (data.name) title = data.name;
                    if (data.description) description = data.description;

                    if (data.image) {
                        const imgs = Array.isArray(data.image) ? data.image : [data.image];
                        const validImg = imgs.find(img => typeof img === 'string' || (img && img.url));
                        if (validImg) {
                            const newImg = typeof validImg === 'object' ? validImg.url : validImg;
                            if (newImg) image = newImg;
                        }
                    }

                    const offer = Array.isArray(data.offers) ? data.offers[0] : data.offers;
                    if (offer) {
                        if (offer.price) rawPrice = offer.price.toString();
                        if (offer.priceCurrency) currency = offer.priceCurrency;
                    }
                }
            });
        } catch (e) { }

        if (!rawPrice) {
            const txt = $('.price, .product-price, .a-price-whole, .price-box__price').first().text().trim();
            if (txt) rawPrice = txt;
        }

        if (!image) {
            const possibleImg = $('#landingImage, #imgBlkFront, #main-image, .product-image-main, .gallery-image, img[itemprop="image"]').first().attr('src');
            if (possibleImg) image = possibleImg;
        }

        if (image && image.startsWith('/')) {
            try { image = new URL(image, url).href; } catch (e) { }
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
app.post('/api/product/metadata', async (req, res) => {
    Logger.metric('magic_add_request');
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'URL is required' });

        const data = await scrapeProduct(url);
        const genAI = getGenAI();

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

app.post('/api/ai/combo-suggestions', async (req, res) => {
    Logger.metric('ai_combo_request');
    try {
        const { closetItems } = req.body;
        const genAI = getGenAI();
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

app.post('/api/ai/purchase-planner', async (req, res) => {
    Logger.metric('ai_planner_request');
    try {
        const { wishlistItems, budget, currency } = req.body;
        const genAI = getGenAI();
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

app.get('/api/currency/rates', (req, res) => {
    res.json({ TRY: 1, USD: 0.030, EUR: 0.028, GBP: 0.024 });
});

app.post('/api/ai/reaction', async (req, res) => {
    try {
        const { context, userAction } = req.body;
        const genAI = getGenAI();

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

app.post('/api/ai/moodboard', async (req, res) => {
    Logger.metric('ai_moodboard_request');
    try {
        const { title, existingPins } = req.body;
        const genAI = getGenAI();
        if (!genAI) return res.status(503).json({ error: 'AI unavailable' });

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        let promptText = `
            Act as a high-end interior designer and fashion stylist.
            Analyze this Moodboard titled: "${title}".
            Task:
            1. Describe the aesthetic/vibe in 3 words.
            2. Suggest 3-4 specific product TYPES that would fit.
            3. Briefly explain WHY.
            Output strict JSON only. JSON: { "aesthetic": "String", "suggestions": [{ "name": "String", "why": "String" }] }
        `;

        const imageParts = [];
        if (existingPins && existingPins.length > 0) {
            const recentPins = existingPins.slice(-3);
            const promises = recentPins.map(pin =>
                pin.imageUrl ? urlToGenerativePart(pin.imageUrl) : null
            );
            const results = await Promise.all(promises);
            results.forEach(part => { if (part) imageParts.push(part); });
        }

        const content = [promptText, ...imageParts];
        const result = await model.generateContent(content);
        res.json(cleanAndParseJSON(result.response.text()));

    } catch (e) {
        Logger.error("AI_MOODBOARD_FAIL", e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/ai/compatibility', async (req, res) => {
    Logger.metric('ai_compatibility_request');
    try {
        const { userItems, friendItems, names } = req.body;
        const genAI = getGenAI();
        if (!genAI) return res.status(503).json({ error: 'AI unavailable' });

        const simplify = (items) => (items || []).slice(0, 50).map(i => `${i.title} (${i.category || 'General'})`);
        const userList = simplify(userItems);
        const friendList = simplify(friendItems);

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const prompt = `
            Act as a fun, matchmaking friend.
            Analyze compatibility based on wishlists.
            ${names.user}'s List: ${JSON.stringify(userList)}
            ${names.friend}'s List: ${JSON.stringify(friendList)}
            
            Task: 
            1. Identify shared interests/vibes.
            2. Give a "Compatibility Score" (0-100%).
            3. Write a cheerful summary.
            4. Extract 3-5 short "Shared Interest" tags.
            
            Output strict JSON only. JSON: { "summary": "String", "score": Number, "sharedInterests": ["Tag1", "Tag2"] }
        `;

        const result = await model.generateContent(prompt);
        res.json(cleanAndParseJSON(result.response.text()));
    } catch (e) {
        Logger.error("AI_COMPATIBILITY_FAIL", e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/jobs/refresh-prices', async (req, res) => {
    const db = getDB();
    if (!db) return res.status(500).json({ error: 'Firestore not connected' });

    const authHeader = req.headers['x-scheduler-secret'];
    if (authHeader !== SCHEDULER_SECRET) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

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
        res.json({ success: true, checked: snapshot.size, updates });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 1. API Export
exports.api = functions.https.onRequest(app);

// 2. Cleanup Trigger (V2 Syntax)
exports.onItemDeleted = onDocumentDeleted("items/{itemId}", async (event) => {
    const itemId = event.params.itemId;
    const db = getDB();
    const batch = db.batch();
    let commitNeeded = false;

    Logger.info("TRIGGER_ITEM_DELETED", { itemId });

    try {
        // Clean from Combos
        const combosQuery = await db.collection('combos')
            .where('itemIds', 'array-contains', itemId)
            .get();

        combosQuery.docs.forEach(doc => {
            const combo = doc.data();
            const newItemIds = combo.itemIds.filter(id => id !== itemId);
            batch.update(doc.ref, { itemIds: newItemIds });
            commitNeeded = true;
            Logger.info("CLEANUP_COMBO", { comboId: doc.id });
        });

        // Clean from Pins (Group Query)
        const pinsQuery = await db.collectionGroup('pins')
            .where('refId', '==', itemId)
            .get();

        pinsQuery.docs.forEach(doc => {
            batch.delete(doc.ref);
            commitNeeded = true;
        });

        if (commitNeeded) {
            await batch.commit();
        }
    } catch (error) {
        Logger.error("CLEANUP_FAIL", error);
    }
});