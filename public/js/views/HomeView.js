/* public/js/views/HomeView.js */
import { authService } from '../services/AuthService.js';
import { firestoreService } from '../services/FirestoreService.js';
import { AddItemModal } from '../components/addItemModal.js';

let addItemModal = null;

export const HomeView = {
    render: async () => {
        const user = authService.currentUser;
        if (!user) return '';

        // [FIX] Removed local <div class="lab-gradient-bg"> to prevent double background layers.
        // The gradient is now handled globally in AppShell.

        return `
            <div class="home-container fade-in">
                
                <div class="home-header">
                    <div>
                        <h1 id="home-greeting" class="hero-title">Welcome Back</h1>
                        <p id="home-subline">Let's align your goals today.</p>
                    </div>
                    
                    <div class="glass-panel ai-insight-badge" style="padding:10px 20px; border-radius:100px; display:flex; gap:12px; align-items:center;">
                        <span style="font-size:1.2rem;">🔮</span>
                        <div>
                            <div style="font-size:0.7rem; text-transform:uppercase; color:var(--accent-color); font-weight:700; letter-spacing:1px;">Daily Vibe</div>
                            <div style="font-size:0.85rem; font-weight:500; color:var(--text-primary);">"Focus on quality."</div>
                        </div>
                    </div>
                </div>

                <div class="stats-row">
                    <div class="glass-panel stat-card">
                        <div class="stat-value" id="stat-total-wishes">-</div>
                        <div class="stat-label">Active</div>
                    </div>
                    <div class="glass-panel stat-card">
                        <div class="stat-value" id="stat-total-value">-</div>
                        <div class="stat-label">Value</div>
                    </div>
                    <div class="glass-panel stat-card" style="background: rgba(255, 255, 255, 0.8);">
                        <div class="stat-value">✨</div>
                        <div class="stat-label">Manifest</div>
                    </div>
                </div>

                <div id="wishlist-preview-section" style="margin-bottom: 40px;">
                    <div class="loading-spinner">Loading your universe...</div>
                </div>

                <h3 style="margin-bottom:16px; font-size:1rem; text-transform:uppercase; letter-spacing:1px; color:var(--text-tertiary); padding-left:4px;">Quick Actions</h3>
                <div class="quick-actions-grid">
                    
                    <button id="qa-add" class="glass-panel action-card primary-action">
                        <span class="action-icon">+</span>
                        <span class="action-label">Add Wish</span>
                    </button>

                    <button id="qa-planner" class="glass-panel action-card">
                        <span class="action-icon">🎯</span>
                        <span class="action-label">AI Planner</span>
                    </button>

                    <button id="qa-inspo" class="glass-panel action-card">
                        <span class="action-icon">🎨</span>
                        <span class="action-label">Moodboard</span>
                    </button>

                    <button id="qa-magic" class="glass-panel action-card">
                        <span class="action-icon">🧠</span>
                        <span class="action-label">Magic Add</span>
                    </button>

                </div>

            </div>
        `;
    },

    afterRender: async () => {
        const user = authService.currentUser;
        if (!user) return;

        if (!addItemModal) addItemModal = new AddItemModal(() => HomeView.refresh());

        // Bind Actions
        document.getElementById('qa-add').onclick = () => addItemModal.open();
        document.getElementById('qa-magic').onclick = () => addItemModal.open();
        document.getElementById('qa-planner').onclick = () => { window.location.hash = '#/app/wishlist'; };
        document.getElementById('qa-inspo').onclick = () => { window.location.hash = '#/app/inspo'; };

        try {
            // 1. Profile Data
            const profile = await firestoreService.getUserProfile(user.uid);
            const nameEl = document.getElementById('home-greeting');
            const subEl = document.getElementById('home-subline');
            
            if (profile?.displayName) {
                const name = profile.displayName.split(' ')[0];
                nameEl.innerText = `Hi, ${name} 👋`;
            }

            // 2. Wishlist Data
            const items = await firestoreService.getWishlist(user.uid, user.uid);
            const activeWishes = items.filter(i => i.status === 'wish' && !i.deleted);
            
            // Stats
            document.getElementById('stat-total-wishes').innerText = activeWishes.length;
            const totalVal = activeWishes.reduce((acc, curr) => acc + (curr.price || 0), 0);
            document.getElementById('stat-total-value').innerText = totalVal.toLocaleString();

            // 3. Render Preview
            const container = document.getElementById('wishlist-preview-section');
            
            if (activeWishes.length === 0) {
                subEl.innerText = "Your canvas is empty. Let's create.";
                container.innerHTML = `
                    <div class="glass-panel empty-home-card" style="text-align:center; padding: 40px; border:1px dashed rgba(0,0,0,0.1);">
                        <div style="font-size:3rem; margin-bottom:12px; opacity:0.8;">✨</div>
                        <h3 style="margin-bottom:8px;">Start Your Wishlist</h3>
                        <p style="color:var(--text-secondary); margin-bottom:24px;">Add your first item to unlock AI insights.</p>
                        <button class="btn-primary" onclick="document.getElementById('qa-add').click()">Add First Wish</button>
                    </div>
                `;
            } else {
                const recent = activeWishes.slice(0, 3);
                const listHtml = recent.map(item => `
                    <div class="glass-panel preview-item" style="display:flex; align-items:center; gap:16px; padding:12px; margin-bottom:12px;">
                        <img src="${item.imageUrl}" style="width:50px; height:50px; border-radius:12px; object-fit:cover;">
                        <div style="flex:1;">
                            <div style="font-weight:600; color:var(--text-primary);">${item.title}</div>
                            <div style="font-size:0.85rem; color:var(--text-secondary);">${item.price} ${item.currency}</div>
                        </div>
                    </div>
                `).join('');

                container.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding:0 4px;">
                        <h3 style="font-size:1rem; text-transform:uppercase; letter-spacing:1px; color:var(--text-tertiary); margin:0;">Top Wishes</h3>
                        <a href="#/app/wishlist" style="color:var(--accent-color); text-decoration:none; font-weight:600; font-size:0.9rem;">View All →</a>
                    </div>
                    ${listHtml}
                `;
            }

        } catch (e) { console.error(e); }
    },

    refresh: async () => {
        const app = document.getElementById('shell-content');
        app.innerHTML = await HomeView.render();
        await HomeView.afterRender();
    }
};