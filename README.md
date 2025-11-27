# WishOne — A Zen Wishlist for Friends (Part of the AtOne Ecosystem)

WishOne is a **friends-based, AI-assisted wishlist web app** built as part of the **AtOne** ecosystem.

It’s designed to feel like a **native Apple experience** in the browser:
- Soft, animated pastel background
- Glassmorphism cards and modals
- Calm, emotional microinteractions
- Clean flows for adding, organizing and “manifesting” what you want

---

## 1. Core Concept

WishOne is **not** just a product list.

It’s a **social manifestation system** where:
- You save things you want (with images, prices, categories, deadlines)
- Your friends can see your wishes and secretly “claim” gifts
- AI helps you prioritize, categorize and plan
- Over time, your “Closet” becomes a museum of things you actually manifested

---

## 2. Current Feature Set

### 2.1 Auth & Profile

- **Multi-auth support**
  - Google Sign-In
  - Email & Password sign-up/login
- User profile data stored in Firestore:
  - `displayName`, `email`, optional `photoURL`
  - Basic profile meta reserved for future features (username, birthday, plan type etc.)

> Note: Phone auth & full profile onboarding are planned but not fully implemented yet.

---

### 2.2 Social Layer – Friends, Not Just Couples

- The old **“Partner”** model has been replaced with a **friends-based model**:
  - Add friends by email
  - See their public wishlists
  - Navigate via:
    - **FriendsView** — list of your friends
    - **FriendWishlistView** — selected friend’s wishlist

- **Secret gifting**:
  - When you view a friend’s wishlist, you can “claim” an item as a gift.
  - For you (gifter): the card gets a “reserved” / gifted state.
  - For your friend (owner): the item still looks normal — surprise preserved.

---

### 2.3 Wishlist & Items

- **My Wishlist (HomeView)**:
  - Masonry-style grid layout with glass cards
  - Each card shows:
    - Image
    - Title
    - Price & currency
    - Category & subcategory
    - Optional target date (deadline)
  - “Closet” toggle to mark items as **owned/manifested**

- **Full edit flow**:
  - Existing items can be edited:
    - Title, price, currency
    - Category / subcategory
    - Target date
    - Image URL
  - Edit uses the same smooth modal UI as “Add Item”.

- **ClosetView**:
  - Shows items marked as `isOwned = true`
  - Visual style:
    - Slightly desaturated/softened
    - Meant to feel like a “manifested gallery” rather than an active wishlist

---

### 2.4 Magic Add 2.0 (Backend-Assisted)

- **Magic Add** lets users paste a product URL instead of manually entering everything:
  - The Node.js backend fetches product metadata (title, image, price) using scraping.
  - Basic normalization fixes price formats (`,` vs `.` and currency symbols).
  - Data is then saved in Firestore and rendered in the UI.

- UI states:
  - While fetching:
    - Inline loading state in the modal (“Fetching details…”)
  - On success:
    - Fields auto-fill and animate in.
  - On error:
    - Friendly message and manual input fallback.

> The exact scraping provider / method may be iterated over, but the flow is in place.

---

### 2.5 AI Assistance

AI is integrated via a backend service (Gemini-based):

- **Priority insight (in progress)**:
  - For Magic Add items, AI can suggest:
    - A priority (e.g. “High / Need soon” vs “Low / Nice to have”)
    - A short reason (“You already have similar items”, “Price is high vs your other wishes”, etc.)

- **Planned AI helpers**:
  - Budget/savings helper (how to plan saving for upcoming items)
  - Smart combo suggestions for outfits
  - Smarter categorization & title cleanup for Magic Add

> Some AI paths are partially wired; fine-tuning is ongoing.

---

### 2.6 Combo Builder

- **ComboView** (early version):
  - Uses items marked as owned (`isOwned = true`) as a “wardrobe”.
  - Allows creating simple **virtual combos/outfits** by selecting multiple owned items.
  - Combos are saved in Firestore for later reference.

This is the foundation for richer “style board” and outfit-planning experiences.

---

### 2.7 Ads & Freemium Foundation

- **AdSlot component**:
  - Injects ad placeholders for free users.
  - Built to be compatible with real ad networks later (e.g. AdSense).
  - Premium users (later) will see no ads.

- **Plan awareness in data model**:
  - The Firestore user document supports:
    - `plan: "free" | "premium"` (and possible future tiers).
  - Logic will progressively use this to:
    - Limit advanced AI calls for free users,
    - Hide ads for premium users,
    - Unlock extra features (price tracking alerts, etc.).

---

## 3. UI / UX & Motion (Latest Improvements)

The most recent work focused on **polishing the UI/UX and animations**, especially in the context of the AtOne + Apple-like experience:

### 3.1 Global Motion

- Introduced consistent easing curves and durations for transitions:
  - Fast microinteractions (e.g. button taps)
  - Smooth view transitions (e.g. Home ↔ Friends ↔ Inspo)
- View changes now feel more like **“screens in an app”** rather than hard page reloads.

### 3.2 Cards & Microinteractions

- Wishlist cards:
  - Subtle hover “lift” (translate + slight scale)
  - Action buttons (delete/gift/closet) appear with soft fade & scale.
- Owned / gifted / locked states:
  - More consistent use of color and glow, keeping everything premium and calm.

### 3.3 Modals & Magic Add UX

- Add/Edit item modal:
  - Smoother open/close transitions (scale + opacity).
  - Better focus styles on inputs (glass + accent glow).
- Magic Add:
  - Clearer feedback while fetching from URL.
  - Better error messaging without blocking the user.

### 3.4 Empty & Loading States (Foundations)

- Skeleton loaders for content-heavy views.
- Basic empty states in views like Inspo, Closet, Friends, Combo to avoid “hard blank” screens.

More AtOne-flavored copy and illustrations are planned as next UX polish steps.

---

## 4. Tech Stack

- **Frontend**
  - Vanilla JavaScript (ES6 modules)
  - SPA pattern with a simple Router
  - CSS:
    - Custom pastel mesh background
    - Glassmorphism cards and modals
    - Components split into `main.css` and `components.css`

- **Backend**
  - Node.js backend server for:
    - Magic Add metadata fetching
    - AI (Gemini) integration
    - Currency & formatting helpers

- **Firebase**
  - Cloud Firestore
  - Firebase Auth (Google + Email/Password)
  - Firebase Hosting (static assets)

> No frontend frameworks (no React/Vue), no CSS frameworks (no Tailwind/Bootstrap), by design.

---

## 5. Project Structure (High Level)

```text
/public
  index.html
  /css
    variables.css
    main.css
    components.css
  /js
    app.js
    Router.js
    /config
      firebase-config.js
      locales.js
      api.js        # backend endpoints / constants
    /services
      AuthService.js
      FirestoreService.js
      CurrencyService.js
      AIService.js
    /components
      Header.js
      AddItemModal.js
      AdSlot.js
    /views
      WelcomeView.js
      HomeView.js
      FriendsView.js
      FriendWishlistView.js
      InspoView.js
      ClosetView.js
      ComboView.js

/server
  # Node backend for Magic Add, AI, etc.
```

---

## 6. Getting Started (Dev)

1. **Clone the repo**

   ```bash
   git clone https://github.com/atayugrum/WishOne.git
   cd WishOne
   ```

2. **Install server dependencies**

   ```bash
   cd server
   npm install
   ```

3. **Configure environment**

   - Add your Firebase config in `/public/js/config/firebase-config.js`.
   - Add backend/API keys (e.g. Gemini) in server `.env` and `/public/js/config/api.js` if needed.

4. **Run backend locally**

   ```bash
   cd server
   npm start
   # or npm run dev
   ```

5. **Serve frontend**

   - Use a simple static server from `/public` (e.g. VS Code Live Server, `npx serve public`, or Firebase Hosting emulators).

---

## 7. Roadmap / Next Steps

Planned upcoming work includes:

- Daily price refresh & **sale alerts** (especially for Premium users)
- More robust **AI helpers**:
  - Budget planning
  - Outfit / combo suggestions
  - Smarter categorization
- Proper **Free vs Premium** feature split and paywall UX
- **Ads integration** with a real network (e.g. Google AdSense)
- Deep AtOne-level onboarding, empty states and emotional copywriting

---

## 8. License

TBD (personal project / closed source for now, unless decided otherwise).
