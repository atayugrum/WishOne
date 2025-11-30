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
        Logger.info("FIREBASE_INIT_SUCCESS");
    }
} catch (e) {
    Logger.error("FIREBASE_INIT_FAIL", e);
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

const ALLOWED_MOODS = [
    'idle', 'welcome', 'thinking', 'magic', 'celebrating',
    'dancing', 'loving', 'zen', 'presenting', 'error'
];

// --- HELPERS ---

function cleanAndParseJSON(text) {
    if (!text) throw new Error("Empty response from AI");
    let clean = text.replace(/```json|```/g, '').trim();
    clean = clean.replace(/\/\/.*$/gm, ''); // Remove comments
    const firstOpen = clean.indexOf('{');
    const lastClose = clean.lastIndexOf('}');
    if (firstOpen !== -1 && lastClose !== -1) {
        clean = clean.substring(firstOpen, lastClose + 1);
    } else {
        throw new Error("No JSON object found");
    }
    try {
        return JSON.parse(clean);
    } catch (e) {
        Logger.error("JSON_PARSE_FAIL_RAW", { raw: clean });
        throw new Error("Failed to parse JSON");
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
        const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' } });
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
        const html = await response.text();
        const $ = cheerio.load(html);
        const getMeta = (p) => $(`meta[property="${p}"]`).attr('content') || $(`meta[name="${p}"]`).attr('content');

        // 1. Initialize with standard Meta Tags
        let title = getMeta('og:title') || getMeta('twitter:title') || $('title').text() || '';
        let description = getMeta('og:description') || getMeta('twitter:description') || getMeta('description') || '';

        // Image Priority: OpenGraph > Twitter > Link Rel
        let image = getMeta('og:image') ||
            getMeta('twitter:image') ||
            $('link[rel="image_src"]').attr('href');

        let rawPrice = getMeta('product:price:amount') || getMeta('og:price:amount');
        let currency = getMeta('product:price:currency') || getMeta('og:price:currency') || 'TRY';

        // 2. JSON-LD Extraction (High Quality Data)
        try {
            $('script[type="application/ld+json"]').each((i, el) => {
                const jsonText = $(el).html();
                if (!jsonText) return;
                const json = JSON.parse(jsonText);
                const data = Array.isArray(json) ? json.find(i => i['@type'] === 'Product') : (json['@type'] === 'Product' ? json : null);

                if (data) {
                    if (data.name) title = data.name;
                    if (data.description) description = data.description;

                    // Handle complex JSON-LD Image structures
                    if (data.image) {
                        const imgs = Array.isArray(data.image) ? data.image : [data.image];
                        // Find first valid string or object with url
                        const validImg = imgs.find(img => typeof img === 'string' || (img && img.url));
                        if (validImg) {
                            // If it's an object, prefer .url, otherwise use the string
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
        } catch (e) {
            // JSON-LD failed, persist with meta tags
        }

        // 3. DOM Fallbacks (If still missing)
        if (!rawPrice) {
            const txt = $('.price, .product-price, .a-price-whole, .price-box__price').first().text().trim();
            if (txt) rawPrice = txt;
        }

        // Heuristic: Try to find the main product image by common IDs/Classes
        if (!image) {
            const possibleImg = $('#landingImage, #imgBlkFront, #main-image, .product-image-main, .gallery-image, img[itemprop="image"]').first().attr('src');
            if (possibleImg) image = possibleImg;
        }

        // 4. Normalize Data
        // Fix relative image URLs
        if (image && image.startsWith('/')) {
            try {
                image = new URL(image, url).href;
            } catch (e) { /* ignore invalid URL */ }
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
                const prompt = `
                    Act as a smart shopping assistant.
                    Analyze this product: ${data.title} ${data.description.substring(0, 200)} ${data.price}.
                    Known Categories: ${JSON.stringify(CATEGORY_MAP)}.
                    
                    Task:
                    1. Categorize it.
                    2. Clean up the title (remove spammy keywords).
                    3. Suggest a priority level.
                    4. Give a friendly, short reason for the priority (e.g. "Great for summer!" or "A bit pricey, maybe wait for sale.").
                    
                    Output strict JSON only. No markdown. 
                    JSON: { "category": "String", "subcategory": "String", "cleanTitle": "String", "priorityLevel": "String", "priorityLabel": "String", "reason": "String", "estimatedPrice": Number }
                `;
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
        const prompt = `
            Act as a friendly personal stylist who loves fashion and design.
            Create 1-3 outfits/combos from these items: ${JSON.stringify(closetItems.map(i => ({ id: i.id, name: i.title, cat: i.category })))}.
            Write a fun, encouraging description for each combo.
            Output strict JSON only. No markdown. 
            JSON: { "combos": [{ "name": "String", "description": "String", "itemIds": ["id1"] }] }
        `;
        const result = await model.generateContent(prompt);
        res.json(cleanAndParseJSON(result.response.text()));
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
        const prompt = `
            Act as a supportive, financially savvy friend.
            Budget: ${budget} ${currency}.
            Items: ${JSON.stringify(wishlistItems.map(i => ({ id: i.id, name: i.title, price: i.price, priority: i.priority })))}.
            
            Task: Pick the best items to buy now.
            Write a "summary" that feels personal and encouraging, like "You can totally afford these this month!"
            Output strict JSON only. No markdown. 
            JSON: { "recommendedItems": [{ "itemId": "String", "reason": "String" }], "summary": "String" }
        `;
        const result = await model.generateContent(prompt);
        res.json(cleanAndParseJSON(result.response.text()));
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

        if (!genAI) {
            return res.json({ message: "You've got great taste!", mood: "presenting" });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const prompt = `
            You are the AtOne Mascot, a warm, friendly, and enthusiastic AI companion.
            Your goal is to make the user feel supported and excited about their wishes.
            
            User Action: ${userAction}
            Context: ${JSON.stringify(context)}
            Allowed Moods: ${JSON.stringify(ALLOWED_MOODS)}
            
            Task:
            1. Generate a short reaction message (max 12 words). It should feel like a text from a supportive friend. Use the user's name if available.
            2. Pick the best mascot mood.
            
            Examples:
            - "add_wish": "Ooh, that's beautiful! Added to your dreams." (mood: magic)
            - "manifest": "Yay! You manifested it! So proud of you." (mood: celebrating)
            - "login": "Hi [Name]! Ready to dream big today?" (mood: welcome)
            - "delete_wish": "Making space for better things. Good call." (mood: zen)
            
            Output strict JSON only. No markdown. JSON: { "message": "String", "mood": "String" }
        `;
        const result = await model.generateContent(prompt);
        res.json(cleanAndParseJSON(result.response.text()));
    } catch (error) {
        Logger.error("AI_REACTION_FAIL", error);
        res.json({ message: "Stored safely.", mood: "idle" });
    }
});

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

// 6. AI Moodboard (Now Multimodal!)
app.post('/api/ai/moodboard', async (req, res) => {
    Logger.metric('ai_moodboard_request');
    try {
        const { title, existingPins } = req.body; // existingPins is array of objects { imageUrl: ... }
        if (!genAI) return res.status(503).json({ error: 'AI unavailable' });

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        // 1. Prepare Text Prompt
        let promptText = `
            Act as a high-end interior designer and fashion stylist.
            Analyze this Moodboard titled: "${title}".
            
            Task:
            1. Describe the aesthetic/vibe in 3 words (e.g. "Minimalist, Earthy, Warm").
            2. Suggest 3-4 specific product TYPES that would fit this aesthetic perfectly.
            3. Briefly explain WHY they fit.
            
            Output strict JSON only. No markdown. 
            JSON: { "aesthetic": "String", "suggestions": [{ "name": "String", "why": "String" }] }
        `;

        // 2. Prepare Images (Multimodal)
        const imageParts = [];
        if (existingPins && existingPins.length > 0) {
            // Take last 3 pins to avoid overloading payload/latency
            const recentPins = existingPins.slice(-3);
            Logger.info("AI_MOODBOARD_FETCHING_IMAGES", { count: recentPins.length });

            const promises = recentPins.map(pin =>
                pin.imageUrl ? urlToGenerativePart(pin.imageUrl) : null
            );

            const results = await Promise.all(promises);
            results.forEach(part => {
                if (part) imageParts.push(part);
            });
        }

        // 3. Generate
        // Gemini accepts [text, ...images]
        const content = [promptText, ...imageParts];

        const result = await model.generateContent(content);
        res.json(cleanAndParseJSON(result.response.text()));

    } catch (e) {
        Logger.error("AI_MOODBOARD_FAIL", e);
        res.status(500).json({ error: e.message });
    }
});

// 7. AI Compatibility
app.post('/api/ai/compatibility', async (req, res) => {
    Logger.metric('ai_compatibility_request');
    try {
        const { userItems, friendItems, names } = req.body;
        if (!genAI) return res.status(503).json({ error: 'AI unavailable' });

        // [CHANGE] Extract relevant text data instead of just counts
        const simplify = (items) => (items || []).slice(0, 50).map(i => `${i.title} (${i.category || 'General'})`);
        const userList = simplify(userItems);
        const friendList = simplify(friendItems);

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const prompt = `
            Act as a fun, matchmaking friend.
            Analyze compatibility based on wishlists.
            
            ${names.user}'s Wishlist: ${JSON.stringify(userList)}
            ${names.friend}'s Wishlist: ${JSON.stringify(friendList)}
            
            Task: 
            1. Identify shared interests, aesthetic overlaps, or complementary vibes.
            2. Give a fun "Compatibility Score" (0-100%).
            3. Write a cheerful summary (max 2 sentences) explaining why they click.
            4. Extract 3-5 short "Shared Interest" tags (e.g. "Tech Geeks", "Cozy Home").
            
            Output strict JSON only. No markdown. 
            JSON: { "summary": "String", "score": Number, "sharedInterests": ["Tag1", "Tag2"] }
        `;

        const result = await model.generateContent(prompt);
        res.json(cleanAndParseJSON(result.response.text()));
    } catch (e) {
        Logger.error("AI_COMPATIBILITY_FAIL", e);
        res.status(500).json({ error: e.message });
    }
});

// 8. PRICE REFRESH JOB
app.post('/api/jobs/refresh-prices', async (req, res) => {
    if (!db) return res.status(500).json({ error: 'Firestore not connected' });

    // --- SECURITY CHECK ---
    const authHeader = req.headers['x-scheduler-secret'];
    if (authHeader !== process.env.SCHEDULER_SECRET) {
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

const server = app.listen(PORT, () => {
    Logger.info(`SERVER_START`, { port: PORT });
});