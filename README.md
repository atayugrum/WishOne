# WishOne v2 — The AI-Powered Social Wishlist

WishOne is a **friends-based, AI-assisted wishlist web app**. Version 2 introduces advanced AI agents, privacy controls, and a "soft gamified" experience to help you manifest your dreams.

It maintains the **AtOne design philosophy**: Zen, Fluid, and Emotional.

---

## ✨ New in Version 2

### 🤖 Advanced AI Agents
- **Moodboard Stylist**: Inside Inspo Boards, ask AI to suggest products that match your board's "vibe".
- **Friendship Compatibility**: Analyze the shared "vibe" between you and a friend based on your wishlists.
- **Purchase Planner**: AI helps you budget and prioritize which wishes to fulfill next.
- **Magic Add 2.0**: Enhanced scraping with duplicate detection and auto-categorization.

### 🔒 Privacy & Sharing
- **Public Share Links**: Generate a read-only link (`/#/share?uid=...`) to share your list with anyone (even non-users).
- **Visibility Controls**: Toggle your list between "Public", "Friends Only", or "Private" in Profile settings.

### 🎮 Soft Gamification
- **Manifestation Confetti**: Celebrate when you move an item to your Closet.
- **Micro-Rewards**: Subtle toasts when you hit milestones (e.g., "5 Wishes Added").
- **Activity Log**: A persistent feed of your recent actions and friends' updates.

### 💰 Smart Shopping
- **Occasion Badges**: Tag wishes for Birthdays, Anniversaries, etc.
- **Price Drop Tracking**: Background job (`/api/jobs/refresh-prices`) checks for sales daily.
- **AdSense Ready**: Architecture supports real ad networks for Free users.

---

## 🛠️ Tech Stack

- **Frontend**: Vanilla JS (ES6+), CSS Variables, Glassmorphism (No frameworks).
- **Backend**: Node.js + Express (handling AI & Scraping).
- **Database**: Firebase Cloud Firestore.
- **AI**: Google Gemini Pro via Node.js SDK.

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js v18+
- A Firebase Project
- A Google Gemini API Key

### 2. Setup

**Frontend Assets:**
1. Place your logo at `public/img/logo.jpg`
2. Place your icon at `public/img/icon.jpg`

**Backend:**
1. Navigate to `/server`
2. `npm install`
3. Create a `.env` file (see `.env.example`)
4. Add your `GEMINI_API_KEY` and Firebase credentials.

### 3. Running the App

**Start Backend:**
```bash
cd server
npm start
# Runs on http://localhost:3001
```

**Start Frontend:** Serve the `/public` folder using any static server:
```bash
npx serve public
# Runs on http://localhost:3000
```

---

## 📂 Project Structure

```text
/public
  /css          # Design system (variables, glassmorphism)
  /js
    /components # UI widgets (Header, AdSlot, Modals)
    /services   # Logic (Auth, Firestore, AI, Logs)
    /views      # Screens (Home, Friends, Inspo, Public)
    /config     # Envs and Constants
  /img          # Logo and Icons
/server         # Node.js Backend API
```

---

## 🤖 AI Features Usage

- **Magic Add**: Paste a URL in the "Add Item" modal. The backend scrapes metadata and uses Gemini to categorize it.
- **Compatibility**: Go to "Friends", click the 🔮 icon on a friend card.
- **Moodboard Ideas**: Open an Inspo Board, click "✨ Ideas".

---

## 📊 Monitoring

The app now includes a Structured Logging Service:

- **Frontend logs**: `LogService.js` (console + localStorage for critical errors).
- **Backend logs**: JSON-formatted stdout for easy parsing in Cloud Logging.

---

## 📄 License

AtOne Ecosystem. All Rights Reserved.

---

## ✅ Final Instructions for You

1. **Images**:  
   Save your previously uploaded `WishOneIcon.jpg` as `public/img/icon.jpg` and `WishOneLogo.jpg` as `public/img/logo.jpg`.

2. **Dependencies**:  
   Run `npm install` in the `server` folder to ensure `dotenv` and `firebase-admin` are installed.

3. **Deploy**:  
   If deploying to production (e.g., Firebase Hosting + Cloud Run), ensure the `getBaseUrl()` function in `api.js` points to your production backend URL.

**WishOne v2 is now feature-complete.** You have a robust, AI-powered, social wishlist app with a premium UI/UX.
