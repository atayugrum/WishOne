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
    } else {
        console.warn("Warning: No Google Credentials found. Scheduler might fail to write to Firestore.");
    }
} catch (e) {
    console.warn("Firebase Init Error (Non-fatal):", e.message);
}

// --- CATEGORY MAPPING CONTEXT ---
const CATEGORY_CONTEXT = `
{
    "Clothing": ["Tops", "Bottoms", "Dresses", "Outerwear", "Activewear", "Swimwear", "Sleepwear"],
    "Shoes": ["Sneakers", "Boots", "Heels", "Sandals", "Flats", "Loafers"],
    "Accessories": ["Bags", "Jewelry", "Hats", "Belts", "Sunglasses", "Watches"],
    "Beauty": ["Makeup", "Skincare", "Fragrance", "Haircare", "Tools"],
    "Home": ["Decor", "Kitchen", "Bedding", "Furniture", "Lighting"],
    "Tech": ["Gadgets", "Accessories", "Smart Home", "Audio"],
    "Gaming": ["Consoles", "Games", "Accessories", "PC"],
    "Books": ["Fiction", "Non-Fiction", "Comics", "Educational"],
    "Other": ["Misc"]
}
`;

// Helper: Parse Price
function parsePrice(priceStr, currency) {
    if (!priceStr) return null;
    let clean = priceStr.replace(/[^0-9.,]/g, '');

    if (clean.includes(',') && clean.includes('.')) {
        if (clean.indexOf(',') > clean.indexOf('.')) {
            clean = clean.replace(/\./g, '').replace(',', '.');
        } else {
            clean = clean.replace(/,/g, '');
        }
    } else if (clean.includes(',')) {
        if (currency === 'EUR' || currency === 'TRY' || clean.length < 4) {
            clean = clean.replace(',', '.');
        } else {
            clean = clean.replace(/,/g, '');
        }
    }

    return parseFloat(clean);
}

// Helper: Map Subcategory
function mapSubcategory(category, subcategory) {
    const validSubs = JSON.parse(CATEGORY_CONTEXT)[category];
    if (!validSubs) return 'Misc';

    const target = subcategory.toLowerCase();

    if (validSubs.map(s => s.toLowerCase()).includes(target)) {
        return validSubs.find(s => s.toLowerCase() === target);
    }

    const mappings = {
        'shirt': 'Tops', 'blouse': 'Tops', 'tee': 'Tops', 'sweater': 'Tops', 'hoodie': 'Tops',
        'pant': 'Bottoms', 'jeans': 'Bottoms', 'skirt': 'Bottoms', 'short': 'Bottoms',
        'console': 'Gaming', 'videogame': 'Gaming', 'game': 'Gaming', 'controller': 'Gaming',
        'ps5': 'Gaming', 'xbox': 'Gaming', 'nintendo': 'Gaming',
        'coat': 'Outerwear', 'jacket': 'Outerwear',
        'sneaker': 'Shoes', 'boot': 'Shoes',
        'necklace': 'Jewelry', 'ring': 'Jewelry',
        'laptop': 'Tech', 'phone': 'Tech',
        'sofa': 'Furniture', 'chair': 'Furniture',
        'lipstick': 'Makeup'
    };

    for (const [key, val] of Object.entries(mappings)) {
        if (target.includes(key) && validSubs.includes(val)) {
            return val;
        }
    }

    for (const sub of validSubs) {
        const s = sub.toLowerCase();
        if (target.includes(s) || s.includes(target)) {
            return sub;
        }
    }

    return null;
}

// Helper: Scrape Product Data
async function scrapeProduct(url) {
    try {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9'
        };

        const response = await fetch(url, { headers });
        if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
        const html = await response.text();
        const $ = cheerio.load(html);

        const getMeta = (prop) => $(`meta[property="${prop}"]`).attr('content') || $(`meta[name="${prop}"]`).attr('content');

        let title = getMeta('og:title') || getMeta('twitter:title') || $('title').text() || '';
        title = title.trim().replace(/\s+/g, ' ');
        if (url.includes('amazon')) {
            const amazonTitle = $('#productTitle').text().trim();
            if (amazonTitle) title = amazonTitle;
        }

        let image = getMeta('og:image') || getMeta('twitter:image') || $('link[rel="image_src"]').attr('href');
        if (!image) {
            image = $('#landingImage').attr('src') || $('.a-dynamic-image').first().attr('src') || $('.product-image').attr('src') || $('img[itemprop="image"]').attr('src');
        }

        const description = getMeta('og:description') || getMeta('twitter:description') || getMeta('description') || '';

        let price = null;
        let currency = getMeta('product:price:currency') || getMeta('og:price:currency');
        const metaPrice = getMeta('product:price:amount') || getMeta('og:price:amount');

        if (metaPrice) {
            price = parseFloat(metaPrice);
        }

        let rawDomPrice = '';
        if (price === null || isNaN(price)) {
            const priceSelectors = ['.a-price-whole', '.product-price', '[itemprop="price"]', '.price', '.prc-dsc', '#priceblock_ourprice', '.a-price .a-offscreen', '.price-container'];
            for (const sel of priceSelectors) {
                const txt = $(sel).first().text().trim();
                if (txt) { rawDomPrice = txt; break; }
            }
        }

        if (!currency && rawDomPrice) {
            if (rawDomPrice.includes('₺') || rawDomPrice.includes('TL')) currency = 'TRY';
            else if (rawDomPrice.includes('€') || rawDomPrice.includes('EUR')) currency = 'EUR';
            else if (rawDomPrice.includes('$') || rawDomPrice.includes('USD')) currency = 'USD';
        }

        if (!currency) {
            const bodyTxt = $('body').text();
            if (bodyTxt.includes('₺') || bodyTxt.includes('TL')) currency = 'TRY';
            else if (bodyTxt.includes('€') || bodyTxt.includes('EUR')) currency = 'EUR';
            else currency = 'USD';
        }

        if ((price === null || isNaN(price)) && rawDomPrice) {
            price = parsePrice(rawDomPrice, currency);
        }

        const sourceSite = new URL(url).hostname.replace('www.', '');

        return {
            title,
            imageUrl: image || '',
            description: description.trim(),
            price: isNaN(price) ? null : price,
            currency: currency || 'TRY',
            sourceSite,
            url
        };
    } catch (error) {
        console.error("Scrape Error:", error.message);
        return { title: '', imageUrl: '', price: null, currency: 'TRY', sourceSite: null, url, error: error.message };
    }
}

// --- ENDPOINTS ---

app.post('/api/product/metadata', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'URL is required' });

        const data = await scrapeProduct(url);

        if (genAI && (data.title || data.description)) {
            try {
                const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

                const prompt = `
                Analyze this product:
                Title: ${data.title}
                Description: ${data.description.substring(0, 300)}
                Price: ${data.price} ${data.currency}
                
                Allowed Categories and Subcategories JSON:
                ${CATEGORY_CONTEXT}

                Task:
                1. Select the BEST fitting Category from the keys above.
                2. Select the BEST fitting Subcategory strictly from the list of that Category.
                3. Clean the title (remove brand names if repetitive, keep it short).
                4. Suggest Priority Level: "LOW", "MEDIUM", "HIGH", or "MUST_HAVE".
                5. Provide a "priorityLabel" (e.g. "Must-have", "High Priority", "Nice to have").
                6. ALWAYS provide a "reason" (max 10 words) explaining the priority.
                7. Estimate price if missing.

                Output strictly valid JSON:
                {
                    "category": "String",
                    "subcategory": "String",
                    "cleanTitle": "String",
                    "priorityLevel": "LOW" | "MEDIUM" | "HIGH" | "MUST_HAVE",
                    "priorityLabel": "String",
                    "reason": "String",
                    "estimatedPrice": Number or null
                }
            `;

                const result = await model.generateContent(prompt);
                const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
                const aiData = JSON.parse(text);

                if (aiData.category) {
                    data.category = aiData.category;
                    if (aiData.subcategory) {
                        const mappedSub = mapSubcategory(data.category, aiData.subcategory);
                        data.subcategory = mappedSub || null;
                    }
                }

                if (aiData.cleanTitle) data.title = aiData.cleanTitle;
                if (aiData.priorityLevel) data.priorityLevel = aiData.priorityLevel;
                if (aiData.priorityLabel) data.priorityLabel = aiData.priorityLabel;
                if (aiData.reason) data.reason = aiData.reason;
                if (!data.price && aiData.estimatedPrice) data.price = aiData.estimatedPrice;

            } catch (aiError) {
                console.warn("AI failed:", aiError.message);
                data.priorityLevel = "MEDIUM";
                data.priorityLabel = "Medium";
                data.reason = "AI insight unavailable";
            }
        } else {
            data.category = 'Other';
            data.subcategory = 'Misc';
            data.priorityLevel = 'MEDIUM';
            data.priorityLabel = 'Medium';
            data.reason = 'Standard priority';
        }

        res.json(data);

    } catch (error) {
        console.error('Magic Add error:', error.message);
        res.status(500).json({ error: 'Failed to process URL' });
    }
});

app.post('/api/ai/combo-suggestions', async (req, res) => {
    console.log("Received AI Combo Suggestion Request");
    try {
        const { closetItems, focusedItem } = req.body;
        if (!closetItems || !Array.isArray(closetItems)) {
            return res.status(400).json({ error: 'Closet items array required' });
        }

        if (!genAI) {
            return res.status(503).json({ error: 'AI Service Unavailable' });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const simplifiedCloset = closetItems.map(i => ({
            id: i.id,
            title: i.title,
            category: i.category,
            subcategory: i.subcategory,
            color: i.color || 'Unknown'
        }));

        const focusedContext = focusedItem ? `
            Focus on building an outfit around this item:
            ${JSON.stringify({ title: focusedItem.title, category: focusedItem.category })}
        ` : '';

        const prompt = `
            You are a professional fashion stylist.
            
            Closet:
            ${JSON.stringify(simplifiedCloset)}

            ${focusedContext}

            Task:
            1. Create 1-3 distinct outfit combinations using ONLY the items from the Closet.
            2. If a "Focused Item" is provided, it MUST be included in every combo.
            3. If there are not enough items to make a good outfit, return an empty array and a "message" explaining why.
            4. Each combo must have a creative name and a short description.
            
            Output JSON Schema:
            {
                "combos": [
                    {
                        "name": "String",
                        "description": "String",
                        "itemIds": ["String (id of item 1)", "String (id of item 2)"]
                    }
                ],
                "message": "String (optional, if no combos found)"
            }
        `;

        const result = await model.generateContent(prompt);
        const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const aiData = JSON.parse(text);

        res.json(aiData);

    } catch (error) {
        console.error("AI Combo Error:", error.message);
        res.status(500).json({ error: 'AI processing failed' });
    }
});

app.post('/api/ai/purchase-planner', async (req, res) => {
    try {
        const { wishlistItems, budget, currency } = req.body;

        if (!wishlistItems || !Array.isArray(wishlistItems)) {
            return res.status(400).json({ error: 'Wishlist items required' });
        }
        if (!budget) {
            return res.status(400).json({ error: 'Budget required' });
        }

        if (!genAI) return res.status(503).json({ error: 'AI Service Unavailable' });

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const simplifiedWishlist = wishlistItems.map(i => ({
            id: i.id,
            title: i.title,
            price: i.price,
            priority: i.priorityLevel || 'MEDIUM',
            targetDate: i.targetDate,
            onSale: i.onSale
        }));

        const prompt = `
            You are a financial advisor and shopping assistant.
            
            Wishlist:
            ${JSON.stringify(simplifiedWishlist)}

            Budget: ${budget} ${currency}

            Task:
            1. Select the BEST set of items to buy now within the budget.
            2. Prioritize "HIGH" or "MUST_HAVE" items, items on sale, and items with approaching target dates.
            3. Do NOT exceed the budget.
            4. Provide a summary of the plan.
            5. Provide a weekly saving hint if they want to buy more later.
            
            Output JSON Schema:
            {
                "recommendedItems": [
                    {
                        "itemId": "String",
                        "reason": "String (why this was chosen)"
                    }
                ],
                "summary": "String",
                "weeklySavingHint": "String"
            }
        `;

        const result = await model.generateContent(prompt);
        const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const aiData = JSON.parse(text);

        res.json(aiData);

    } catch (error) {
        console.error("AI Planner Error:", error.message);
        res.status(500).json({ error: 'AI processing failed' });
    }
});

// --- SCHEDULER ---
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

async function checkDailyPrices() {
    if (!db) {
        console.log("Skipping daily check: DB not initialized (Missing Credentials).");
        return;
    }
    console.log("Starting Daily Price Check...");

    try {
        const itemsSnapshot = await db.collection('items').where('url', '!=', null).get();

        if (itemsSnapshot.empty) {
            console.log("No items with URLs found.");
            return;
        }

        let updateCount = 0;
        const batchSize = 10;
        const docs = itemsSnapshot.docs;

        for (let i = 0; i < docs.length; i += batchSize) {
            const chunk = docs.slice(i, i + batchSize);

            await Promise.all(chunk.map(async (doc) => {
                const item = doc.data();

                if (item.ownerId) {
                    const userDoc = await db.collection('users').doc(item.ownerId).get();
                    if (!userDoc.exists || userDoc.data().plan !== 'premium') {
                        return;
                    }
                }

                if (!item.url) return;

                try {
                    console.log(`Checking price for: ${item.title}`);
                    const newData = await scrapeProduct(item.url);

                    if (newData.price !== null) {
                        const oldPrice = item.price;
                        const newPrice = newData.price;
                        const originalPrice = item.originalPrice || oldPrice || newPrice;
                        const onSale = newPrice < originalPrice;

                        let discountPercent = 0;
                        if (onSale && originalPrice > 0) {
                            discountPercent = Math.round(((originalPrice - newPrice) / originalPrice) * 100);
                        }

                        await db.collection('items').doc(doc.id).update({
                            price: newPrice,
                            lastPrice: newPrice,
                            originalPrice: originalPrice,
                            onSale: onSale,
                            discountPercent: discountPercent,
                            priceLastCheckedAt: new Date().toISOString(),
                        });
                        updateCount++;
                    }
                } catch (err) {
                    console.error(`Failed to refresh ${doc.id}:`, err.message);
                }
            }));

            await new Promise(r => setTimeout(r, 2000));
        }

        console.log(`Daily Check Complete. Updated ${updateCount} items.`);

    } catch (error) {
        console.error("Scheduler Error:", error);
    }
}

// Schedule Daily
setInterval(checkDailyPrices, ONE_DAY_MS);

// Expose a test endpoint
app.get('/api/test-scheduler', async (req, res) => {
    checkDailyPrices(); // Async, don't wait
    res.json({ message: "Scheduler triggered manually." });
});

// --- CURRENCY RATES ---
app.get('/api/currency/rates', (req, res) => {
    // Hardcoded fallback rates (Base: TRY)
    const rates = {
        TRY: 1,
        USD: 0.030,
        EUR: 0.028,
        GBP: 0.024
    };
    res.json(rates);
});

const server = app.listen(PORT, () => {
    console.log(`WishOne Backend running on http://localhost:${PORT}`);
});

server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        console.error(`ERROR: Port ${PORT} is already in use!`);
    } else {
        console.error("Server error:", e);
    }
});