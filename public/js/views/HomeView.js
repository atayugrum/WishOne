/* public/js/views/HomeView.js */
import { authService } from '../services/AuthService.js';
import { firestoreService } from '../services/FirestoreService.js';
import { i18n } from '../services/LocalizationService.js';
import { AddItemModal } from '../components/addItemModal.js';

let addItemModal = null;

export const HomeView = {
    render: async () => {
        const user = authService.currentUser;
        if (!user) return '';

        return `
            <div class="home-view fade-in">
                <div class="home-hero">
                    <div>
                        <h1 id="home-welcome">Hi, User 👋</h1>
                        <p class="subtitle">${i18n.t('home.subtitle')}</p>
                    </div>
                    <button id="btn-quick-add" class="btn-primary btn-glow">+ ${i18n.t('home.addBtn')}</button>
                </div>

                <div class="glass-panel financial-card" style="margin-bottom: 24px; padding: 20px; background: linear-gradient(135deg, rgba(255,255,255,0.8), rgba(255,255,255,0.4));">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <div style="font-size:0.8rem; color:var(--text-secondary); text-transform:uppercase; letter-spacing:1px;">Weekly Goal</div>
                            <div id="home-weekly-savings" style="font-size:1.8rem; font-weight:800; color:var(--accent-color);">...</div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:0.8rem; color:var(--text-secondary); text-transform:uppercase; letter-spacing:1px;">Total Value</div>
                            <div id="home-total-value" style="font-size:1.2rem; font-weight:600;">...</div>
                        </div>
                    </div>
                    <div style="margin-top:12px; font-size:0.9rem; color:var(--text-tertiary);">
                        To reach all your target dates, save this amount per week.
                    </div>
                </div>

                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-bottom:24px;">
                    <div class="glass-panel" style="padding:16px; display:flex; align-items:center; gap:12px;">
                        <span style="font-size:2rem;">✨</span>
                        <div>
                            <div id="stat-wishes" style="font-weight:700; font-size:1.2rem;">-</div>
                            <div style="font-size:0.8rem; color:var(--text-secondary);">Active Wishes</div>
                        </div>
                    </div>
                    <div class="glass-panel" style="padding:16px; display:flex; align-items:center; gap:12px;">
                        <span style="font-size:2rem;">🧥</span>
                        <div>
                            <div id="stat-closet" style="font-weight:700; font-size:1.2rem;">-</div>
                            <div style="font-size:0.8rem; color:var(--text-secondary);">In Closet</div>
                        </div>
                    </div>
                </div>

                <h3 style="margin-bottom:12px;">📅 Upcoming Goals</h3>
                <div id="home-upcoming-list" class="scroll-row" style="display:flex; gap:12px; overflow-x:auto; padding-bottom:20px; min-height:100px;">
                    <div class="loading-spinner"></div>
                </div>

                <div style="margin-top:12px;">
                    <div class="glass-panel" onclick="window.location.hash='#/app/inspo'" style="padding:16px; display:flex; align-items:center; justify-content:space-between; cursor:pointer;">
                        <div style="display:flex; align-items:center; gap:12px;">
                            <span style="font-size:1.5rem;">🎨</span>
                            <div>
                                <div style="font-weight:600;">Inspo Boards</div>
                                <div style="font-size:0.8rem; color:var(--text-secondary);">Continue visualizing</div>
                            </div>
                        </div>
                        <span>→</span>
                    </div>
                </div>
            </div>
        `;
    },

    afterRender: async () => {
        const user = authService.currentUser;
        if (!user) return;

        if (!addItemModal) addItemModal = new AddItemModal(() => HomeView.afterRender());
        
        document.getElementById('btn-quick-add').onclick = () => addItemModal.open();

        try {
            // Load Profile for Name
            const profile = await firestoreService.getUserProfile(user.uid);
            document.getElementById('home-welcome').innerText = `Hi, ${profile?.displayName?.split(' ')[0] || 'Dreamer'} 👋`;

            // Load Items for Stats & Financials
            const items = await firestoreService.getWishlist(user.uid, user.uid); // Active & Bought (mostly)
            
            // Stats
            const activeWishes = items.filter(i => i.status === 'wish' && !i.deleted);
            const boughtItems = await firestoreService.getCloset(user.uid);
            
            document.getElementById('stat-wishes').innerText = activeWishes.length;
            document.getElementById('stat-closet').innerText = boughtItems.length;

            // Financials
            let totalValue = 0;
            let weeklySum = 0;
            
            activeWishes.forEach(i => {
                totalValue += (i.price || 0);
                if (i.targetDate) {
                    const today = new Date();
                    const target = new Date(i.targetDate);
                    if (target > today) {
                        const weeks = Math.max(1, Math.ceil((target - today) / (1000 * 60 * 60 * 24 * 7)));
                        weeklySum += (i.price / weeks);
                    }
                }
            });

            document.getElementById('home-total-value').innerText = `${totalValue.toLocaleString()} TRY`; // Simplified currency
            document.getElementById('home-weekly-savings').innerText = `${Math.ceil(weeklySum).toLocaleString()} TRY`;

            // Upcoming
            const upcoming = activeWishes
                .filter(i => i.targetDate)
                .sort((a, b) => new Date(a.targetDate) - new Date(b.targetDate))
                .slice(0, 5);

            const upcomingContainer = document.getElementById('home-upcoming-list');
            if (upcoming.length === 0) {
                upcomingContainer.innerHTML = `<div style="color:var(--text-tertiary); font-size:0.9rem;">No upcoming target dates. Add one!</div>`;
            } else {
                upcomingContainer.innerHTML = upcoming.map(i => {
                    const date = new Date(i.targetDate);
                    const day = date.getDate();
                    const month = date.toLocaleString('default', { month: 'short' });
                    return `
                        <div class="glass-panel" style="min-width:140px; padding:12px; display:flex; flex-direction:column; gap:8px;">
                            <div style="font-size:0.8rem; color:var(--accent-color); font-weight:700;">${day} ${month}</div>
                            <div style="font-weight:600; font-size:0.9rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${i.title}</div>
                            <div style="font-size:0.8rem; color:var(--text-secondary);">${i.price} ${i.currency}</div>
                        </div>
                    `;
                }).join('');
            }

        } catch (e) {
            console.error(e);
        }
    }
};