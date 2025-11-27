# WishOne – Zen Social Wishlist

WishOne is a **zen, glassmorphic wishlist web app** that lets you:
- Save things you want,
- Share them with friends,
- Secretly claim gifts,
- Get AI-assisted suggestions when adding items.

It’s built as a **Vanilla JavaScript SPA + Firebase + Node backend**, with an Apple-like, soft UI and Pinterest-style layouts.

---

## ✨ Core Features (Current v2 State)

### 1. Friend-based wishlists (social model)
- Move away from a single “partner” into a **friends network**.
- Add friends (by email/username, depending on config) and see their wishlists.
- Each friend has their own wishlist view.

### 2. Magic Add (URL → item, AI-assisted)
- Paste a product URL and let **Magic Add**:
  - Scrape the page on the backend (title, image, price where possible),
  - Pre-fill the add-item form for you,
  - Use AI to clean up the title and suggest category/subcategory (beta),
  - Try to normalize price formats for TRY/EUR (still being improved).
- If something is missing or parsed badly, you can always edit manually.

### 3. Edit flow (fix wrong data easily)
- Each wishlist item has an **Edit (✎)** action.
- Reuses the same glassmorphic modal as Magic Add.
- Saves updates through a full `updateItem` flow in Firestore.

### 4. Secret gifting (Surprise Protocol)
- When you view a friend’s wishlist:
  - You see a **Gift / 🎁** action instead of destructive actions.
  - Claiming it sets `claimedBy` on that item.
- For you (the gifter):
  - The card becomes **gold / “reserved by you”**.
- For your friend (the owner):
  - The item looks normal—no hint that it’s already claimed.

### 5. Closet – owned items
- Items that you mark as **owned** move into the **Closet**.
- Closet has a softer, “museum-like” view of things that are already manifested.
- Useful for outfit building and tracking what you already have.

### 6. Inspo Boards (Pinterest-style)
- Create **boards** (e.g. “Summer 2026”, “Home Decor”) and pin pure images.
- Boards act like visual moodboards: no price or heavy UI, just images.
- Uses a masonry layout for a Pinterest-like feel.

### 7. Combo Builder (beta)
- A dedicated **Combo view** for creating simple outfits/combos from Closet items.
- Persists combos in Firestore (e.g. “Date Night”, “Office Fit”).
- Currently a **beta feature** – UX and AI integration will be iterated further.

### 8. Multi-auth & profile model
- Authentication via:
  - **Google Sign-In**
  - **Email & Password**
- User profiles in Firestore support:
  - Display name
  - Username (for friend search)
  - Email
  - Extra fields for future personalization (e.g. birthdate, plan).

### 9. Basic plans & ads scaffolding
- Data model supports **`plan`** (e.g. `"free"`, `"premium"`).
- An `AdSlot` component exists for in-app ad placements.
- Currently used as scaffolding for:
  - Future freemium limits (AI usage, price tracking),
  - Basic banner placements without breaking the layout.

### 10. AI helpers (early)
- Backend-connected **AIService** that:
  - Helps clean product titles,
  - Suggests categories/subcategories (where possible),
  - Provides **priority hints** (e.g. “must-have” vs “nice-to-have”) – still being refined.
- All AI calls are proxied via the Node backend (no API keys in the frontend).

### 11. Design system
- **Animated pastel gradient background** (Lavender, Pink, Blue, Peach).
- Heavy **Glassmorphism**:
  - Frosted cards, floating header, rounded modals.
- Typography:
  - `Urbanist` for titles,
  - `Inter` for body text.
- **Love Mode** toggle:
  - Warmer palette and subtle heart effects for a more romantic vibe.
- Fully responsive, mobile-first layout.

---

## 🧱 Tech Stack & Architecture

- **Frontend**
  - Vanilla JavaScript (ES modules)
  - Pure CSS (no Tailwind/Bootstrap)
  - SPA-style routing using a simple Router
  - Files live under: `public/`
    - `index.html`
    - `css/variables.css`, `css/main.css`, `css/components.css`
    - `js/app.js`, `js/services/*`, `js/views/*`, `js/components/*`

- **Backend**
  - Node.js (Express-style API in `server/`)
  - Responsibilities:
    - Scraping product pages for Magic Add
    - Normalizing price text → numeric value
    - Proxying calls to Gemini (AI) safely
    - (Soon) scheduled tasks like daily price checks

- **Firebase**
  - Firebase Auth (Google + Email/Password)
  - Cloud Firestore (NoSQL)
  - Collections:
    - `users` – profile, plan, friend relationships
    - `items` – wishlist entries
    - `boards` – inspo boards
    - (Nested collections for pins / combos, depending on version)

---

## 🚀 Getting Started (Local Dev)

1. **Clone the repo**

   ```bash
   git clone https://github.com/atayugrum/WishOne.git
   cd WishOne
   ```

2. **Firebase setup**
   - Create a Firebase project (if you don’t have one).
   - Enable:
     - **Authentication** (Google + Email/Password),
     - **Cloud Firestore**.
   - Put your Firebase config into `public/js/config/firebase-config.js` (follow the existing template in the repo).

3. **Backend setup**

   ```bash
   cd server
   npm install
   ```

   - Create a `.env` file with your secrets, e.g.:
     - Gemini API key
     - Any scraping-related secrets if needed.
   - Run the backend:
     - `npm run dev` or `npm start` (depending on the scripts defined in `package.json`).

4. **Frontend dev**

   - From the project root, you can either:
     - Serve `public/` with a simple static server like:

       ```bash
       npx serve public
       ```

     - or use VS Code’s **Live Server** extension on `public/index.html`.

5. **Open in browser**

   - Go to the URL from your static server (often `http://localhost:3000` or `http://127.0.0.1:5500/public` depending on your setup).
   - Log in, add some wishes, invite a friend, and try Magic Add.

---

## 🧭 Roadmap (short)

These are planned / partially implemented and will be iterated next:

- **Daily price refresh** for Premium users (automatic sale detection).
- **More robust AI priority & subcategory mapping** for Magic Add.
- **Deeper AI helpers**:
  - Outfit suggestions from Closet
  - Budget-based purchase planning
- **Stronger freemium model**:
  - Clear limits for Free,
  - Perks for Premium,
  - Proper ad integration.

---

## 📝 Development Notes

- No front-end frameworks: this is intentionally **framework-free Vanilla JS**.
- Services/Views/Components split:
  - `services/` handle data & logic,
  - `views/` render screens,
  - `components/` encapsulate reusable UI pieces.
- Designed to feel like a **small, personal Apple-quality product**, not a generic CRUD app.
