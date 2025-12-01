import { authService } from '../services/AuthService.js';
import { firestoreService } from '../services/FirestoreService.js';
import { AddItemModal } from '../components/addItemModal.js';
import { i18n } from '../services/LocalizationService.js';

// Simplified Dashboard View
let addItemModal = null;

export const HomeView = {
    render: async () => {
        const user = authService.currentUser;
        const profile = authService.userProfile;
        const name = profile?.displayName?.split(' ')[0] || 'Dreamer';

        return `
            <div class="view-header">
                <div>
                    <h1>Hi, ${name} 👋</h1>
                    <p>Here's a snapshot of your wishes today.</p>
                </div>
            </div>

            <!-- Quick Add Widget -->
            <div class="glass-panel" style="padding: 24px; margin-bottom: 32px; background: linear-gradient(135deg, rgba(255,255,255,0.8), rgba(255,255,255,0.5)); border: 1px solid rgba(255,255,255,0.8);">
                <h3 style="margin-bottom: 16px;">✨ Quick Add</h3>
                <div style="display:flex; gap:12px;">
                    <button class="btn-primary" id="btn-quick-add" style="flex:1; padding:12px;">+ Add New Wish</button>
                    <button class="btn-magic" id="btn-magic-add-home" style="flex:1; padding:12px;">🪄 Magic Paste</button>
                </div>
            </div>

            <div class="dashboard-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:24px;">
                
                <!-- Mini Analytics -->
                <div class="glass-panel" style="padding: 20px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <h4 style="margin:0;">Progress</h4>
                    </div>
                    <div id="mini-stats">
                        <div class="loading-spinner">...</div>
                    </div>
                    <button class="btn-text" onclick="window.location.hash='#/app/profile'" style="margin-top:12px; font-size:0.8rem;">View Full Stats →</button>
                </div>

                <!-- Gift Teaser -->
                <div class="glass-panel" style="padding: 20px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <h4 style="margin:0;">🎁 Upcoming</h4>
                        <button class="btn-text" onclick="window.location.hash='#/app/wishlist'" style="font-size:0.8rem;">View All</button>
                    </div>
                    <div id="gift-teaser-list" style="display:flex; flex-direction:column; gap:8px;">
                        <div style="font-size:0.9rem; opacity:0.6;">Loading...</div>
                    </div>
                </div>

                <!-- Resume -->
                <div class="glass-panel" style="padding: 20px; cursor:pointer;" onclick="window.location.hash='#/app/inspo'">
                    <h4 style="margin-bottom:8px;">📌 Inspiration</h4>
                    <p style="font-size:0.9rem; color:var(--text-secondary);">Continue building your visual boards.</p>
                    <div style="margin-top:12px; display:flex; gap:-8px;">
                        <div style="width:30px; height:30px; border-radius:50%; background:#eee; border:2px solid white;"></div>
                        <div style="width:30px; height:30px; border-radius:50%; background:#ddd; border:2px solid white; margin-left:-10px;"></div>
                        <div style="width:30px; height:30px; border-radius:50%; background:#ccc; border:2px solid white; margin-left:-10px;"></div>
                    </div>
                </div>

            </div>
        `;
    },

    afterRender: async () => {
        const user = authService.currentUser;
        if (!user) return;

        if (!addItemModal) addItemModal = new AddItemModal(() => window.showToast("Added!", "✨"));

        document.getElementById('btn-quick-add').onclick = () => addItemModal.open();
        document.getElementById('btn-magic-add-home').onclick = () => {
            addItemModal.open();
            // Could add logic to auto-focus magic input
        };

        // Load Mini Stats & Gifts
        try {
            const stats = await firestoreService.getUserStats(user.uid);
            const wishes = await firestoreService.getWishlist(user.uid, user.uid);

            // Stats
            document.getElementById('mini-stats').innerHTML = `
                <div style="font-size:2rem; font-weight:700;">${stats.fulfilled} <span style="font-size:1rem; font-weight:400; color:var(--text-secondary);">/ ${stats.totalWishes}</span></div>
                <div style="font-size:0.8rem; color:var(--text-secondary);">Wishes fulfilled</div>
                <div style="width:100%; height:4px; background:#eee; border-radius:2px; margin-top:8px; overflow:hidden;">
                    <div style="width:${(stats.fulfilled / Math.max(1, stats.totalWishes)) * 100}%; height:100%; background:var(--accent-color);"></div>
                </div>
            `;

            // Gift Teaser (Filter by occasion)
            const occasions = wishes.filter(w => w.occasion && w.status === 'wish').slice(0, 3);
            const giftList = document.getElementById('gift-teaser-list');

            if (occasions.length > 0) {
                giftList.innerHTML = occasions.map(o => `
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:6px; height:6px; background:#FFD700; border-radius:50%;"></div>
                        <div style="font-weight:500; font-size:0.9rem; flex:1;">${o.title}</div>
                        <div style="font-size:0.75rem; background:#FFF8E1; padding:2px 6px; border-radius:4px; color:#F57C00;">${o.occasion}</div>
                    </div>
                `).join('');
            } else {
                giftList.innerHTML = `<p style="font-size:0.9rem; color:var(--text-secondary);">No upcoming occasions.</p>`;
            }

        } catch (e) { console.error(e); }
    }
};