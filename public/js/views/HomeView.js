import { firestoreService } from '../services/FirestoreService.js';
import { authService } from '../services/AuthService.js';
import { AddItemModal } from '../components/addItemModal.js';
import { AdSlot } from '../components/AdSlot.js';
import { CATEGORIES } from '../config/categories.js';
import { i18n } from '../services/LocalizationService.js';
import { apiCall } from '../config/api.js';
import { FEATURES } from '../config/limits.js';
import { premiumModal } from '../components/PremiumModal.js';
import { GamificationService } from '../services/GamificationService.js';
import { aiService } from '../services/AIService.js'; // Import AI Service

let addItemModal = null;
let currentView = 'grid';
let itemsMap = new Map();
let showSaleOnly = false;

function getCountdown(dateString) { if (!dateString) return null; const target = new Date(dateString); if (isNaN(target.getTime())) return null; const today = new Date(); today.setHours(0, 0, 0, 0); target.setHours(0, 0, 0, 0); const diffTime = target - today; const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); if (diffDays < 0) return { text: "Overdue", class: "tag-overdue", days: diffDays }; if (diffDays === 0) return { text: "Today!", class: "tag-urgent", days: 0 }; if (diffDays <= 7) return { text: `${diffDays} days left`, class: "tag-urgent", days: diffDays }; if (diffDays <= 30) return { text: `${diffDays} days left`, class: "tag-soon", days: diffDays }; const months = Math.round(diffDays / 30); if (months <= 1) return { text: "Next Month", class: "tag-far", days: diffDays }; if (months >= 12) return { text: `in ${(months / 12).toFixed(1)} years`, class: "tag-far", days: diffDays }; return { text: `in ${months} months`, class: "tag-far", days: diffDays }; }

window.showToast = (message, icon = "✨") => {
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'toast-notification glass-panel';
    toast.innerHTML = `<span>${icon}</span> ${message}`;
    document.body.appendChild(toast);
    toast.offsetHeight;
    toast.classList.add('visible');
    setTimeout(() => { toast.classList.remove('visible'); setTimeout(() => toast.remove(), 400); }, 3000);
};

export const HomeView = {
    skeletonTemplate: `
        <article class="glass-panel card skeleton-card">
            <div class="skeleton-img"></div>
            <div class="skeleton-text title"></div>
            <div class="skeleton-text meta"></div>
        </article>
    `,

    render: async () => {
        if (!addItemModal) addItemModal = new AddItemModal(() => HomeView.loadData());

        window.openAddModal = () => addItemModal.open();

        window.handleDeleteItem = async (itemId) => {
            const item = itemsMap.get(itemId);
            if (confirm(i18n.t('common.confirm'))) {
                const card = document.querySelector(`[data-id="${itemId}"]`);
                if (card) { card.style.transform = 'scale(0.9)'; card.style.opacity = '0'; }

                // AI Reaction for deleting (e.g., "Letting go is good.")
                if (item) aiService.triggerReaction('delete_wish', item);

                await firestoreService.deleteItem(itemId);
                HomeView.loadData();
            }
        };

        window.handleEditItem = (itemId) => {
            const item = itemsMap.get(itemId);
            if (item) addItemModal.open(item);
        };

        window.handleMoveToCloset = async (itemId) => {
            const item = itemsMap.get(itemId);
            const card = document.querySelector(`[data-id="${itemId}"]`);
            if (card) { card.style.transform = 'scale(1.1) translateY(-10px)'; card.style.opacity = '0'; }

            GamificationService.triggerConfetti();
            window.showToast("Manifested! Moved to Closet.", "🎉");

            // AI Reaction for Manifesting (e.g. "Celebrating" mood)
            if (item) aiService.triggerReaction('manifest', item);

            setTimeout(async () => {
                await firestoreService.markAsOwned(itemId);
                HomeView.loadData();
            }, 400);
        };

        window.setView = (mode) => {
            currentView = mode;
            HomeView.loadData();
            document.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.remove('active'));
            document.getElementById(`btn-${mode}`).classList.add('active');
        };

        window.toggleSaleFilter = () => {
            showSaleOnly = !showSaleOnly;
            const btn = document.getElementById('btn-sale-filter');
            if (showSaleOnly) btn.classList.add('active'); else btn.classList.remove('active');
            HomeView.loadData();
        };

        window.openPlannerModal = () => {
            if (!authService.canUseFeature(FEATURES.AI_PLANNER)) { premiumModal.open(); return; }
            const modal = document.getElementById('planner-modal');
            if (modal) { modal.style.display = 'flex'; requestAnimationFrame(() => modal.classList.add('active')); }
        };

        window.closePlannerModal = () => {
            const modal = document.getElementById('planner-modal');
            if (modal) { modal.classList.remove('active'); setTimeout(() => modal.style.display = 'none', 300); }
        };

        window.handleAiPlannerSubmit = async () => {
            const budget = parseFloat(document.getElementById('planner-budget').value);
            const resultsDiv = document.getElementById('planner-results');
            if (!budget) return alert("Enter budget.");
            resultsDiv.innerHTML = `<div class="loading-spinner">${i18n.t('common.loading')}</div>`;

            // Mascot Thinking Mood
            if (window.aiCompanion) window.aiCompanion.say("Crunching the numbers...", "thinking");

            try {
                const items = await firestoreService.getWishlist(authService.currentUser.uid);
                const data = await apiCall('/api/ai/purchase-planner', 'POST', { wishlistItems: items, budget, currency: 'TRY' });
                authService.trackFeatureUsage(FEATURES.AI_PLANNER);

                if (data.recommendedItems) {
                    if (window.aiCompanion) window.aiCompanion.say("Here is a plan for you!", "presenting");

                    resultsDiv.innerHTML = `
                        <div style="background:rgba(255,255,255,0.5); padding:10px; border-radius:8px; margin-bottom:10px;"><strong>Plan:</strong> ${data.summary}</div>
                        ${data.recommendedItems.map(rec => { const item = items.find(i => i.id === rec.itemId); return item ? `<div class="glass-panel" style="padding:8px; margin-bottom:5px;"><b>${item.title}</b><br><small>${rec.reason}</small></div>` : ''; }).join('')}
                    `;
                } else { resultsDiv.innerHTML = `<p>No plan.</p>`; }
            } catch (error) { resultsDiv.innerHTML = `<p style="color:#ff3b30">Error: ${error.message}</p>`; }
        };

        setTimeout(() => HomeView.loadData(), 0);

        return `
            <div class="view-header" style="display:flex; align-items:flex-end;">
                <div>
                    <h1>${i18n.t('home.title')}</h1>
                    <p>${i18n.t('home.subtitle')}</p>
                </div>
                
                <div class="view-toggle">
                    <button class="btn-magic" onclick="window.openPlannerModal()" style="margin-right:12px;">💰</button>
                    <button id="btn-sale-filter" class="toggle-btn" onclick="window.toggleSaleFilter()" title="${i18n.t('home.sale_filter')}" style="margin-right:12px;">%</button>
                    <button id="btn-grid" class="toggle-btn active" onclick="window.setView('grid')">⊞</button>
                    <button id="btn-timeline" class="toggle-btn" onclick="window.setView('timeline')">☰</button>
                </div>
            </div>
            
            <div style="display:flex; flex-wrap:wrap; gap:24px;">
                <div id="content-area" style="flex:1; min-width:300px;">
                    <div class="masonry-grid">
                        ${HomeView.skeletonTemplate.repeat(4)}
                    </div>
                </div>
                
                <div class="activity-sidebar" style="width:250px; display:none;" id="activity-log-container">
                    <h3 style="font-size:0.9rem; color:var(--text-secondary); margin-bottom:12px;">Recent Activity</h3>
                    <div id="activity-list"></div>
                </div>
            </div>
            
            <button class="fab-add" onclick="window.openAddModal()">+</button>

            <div id="planner-modal" class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header"><h2>Purchase Planner</h2><button class="close-btn" onclick="window.closePlannerModal()">&times;</button></div>
                    <div class="form-group"><input type="number" id="planner-budget" placeholder="Budget"></div>
                    <button class="btn-primary" onclick="window.handleAiPlannerSubmit()">Plan</button>
                    <div id="planner-results" style="margin-top:20px;"></div>
                </div>
            </div>
        `;
    },

    loadData: async () => {
        const container = document.getElementById('content-area');
        if (!container) return;

        const user = authService.currentUser;
        if (!user) { container.innerHTML = `<div class="empty-state">Login required.</div>`; return; }

        try {
            const [items, closetItems] = await Promise.all([
                firestoreService.getWishlist(user.uid),
                firestoreService.getCloset(user.uid)
            ]);

            itemsMap.clear();
            items.forEach(item => itemsMap.set(item.id, item));

            GamificationService.checkMilestones('add_item', items.length);
            GamificationService.checkMilestones('manifest', closetItems.length);

            // Activity Log
            const activityContainer = document.getElementById('activity-log-container');
            const activityList = document.getElementById('activity-list');
            if (window.innerWidth > 1000) {
                const activities = await firestoreService.getRecentActivities(user.uid);
                if (activities.length > 0) {
                    activityContainer.style.display = 'block';
                    activityList.innerHTML = activities.map(act => {
                        let text = '';
                        if (act.type === 'add_wish') text = `Wished for <strong>${act.details.title}</strong>`;
                        if (act.type === 'manifest') text = `Manifested <strong>${act.details.title}</strong> ✨`;
                        if (act.type === 'friend_add') text = `Added <strong>${act.details.name}</strong> as friend`;
                        if (act.type === 'create_board') text = `Created board <strong>${act.details.title}</strong>`;

                        return `
                            <div class="glass-panel" style="padding:10px; margin-bottom:8px; font-size:0.8rem;">
                                <span>${text}</span>
                                <div style="color:var(--text-tertiary); font-size:0.7rem; margin-top:4px;">Recently</div>
                            </div>
                        `;
                    }).join('');
                }
            }

            const displayItems = showSaleOnly ? items.filter(item => item.onSale) : items;

            if (displayItems.length === 0) {
                let content = '';
                if (!showSaleOnly) {
                    content = `
                        <div class="empty-actions">
                            <button class="btn-primary" onclick="window.openAddModal()" style="width:100%">+ ${i18n.t('home.addBtn')}</button>
                            <button class="btn-primary btn-google" onclick="window.openAddModal(); setTimeout(() => document.getElementById('btn-magic-add').click(), 200);" style="width:100%">${i18n.t('modal.magic')}</button>
                        </div>
                    `;
                }
                container.innerHTML = `
                    <div class="glass-panel empty-state-card">
                        <span class="empty-icon">💭</span>
                        <h2 class="empty-title">${i18n.t('home.empty')}</h2>
                        ${content}
                    </div>
                `;
                return;
            }

            if (currentView === 'grid') {
                let gridHtml = '';
                displayItems.forEach((item, index) => {
                    gridHtml += HomeView.renderCard(item);
                    if (!authService.isPremium && (index + 1) % 5 === 0) {
                        const ad = new AdSlot({ provider: 'adsense' });
                        gridHtml += `<div class="ad-wrapper">${ad.getElement().outerHTML}</div>`;
                    }
                });
                container.innerHTML = `<div class="masonry-grid">` + gridHtml + `</div>`;
                container.querySelectorAll('.ad-slot').forEach(el => el.addEventListener('click', () => premiumModal.open()));
            } else {
                container.innerHTML = HomeView.renderTimeline(displayItems);
            }

        } catch (error) {
            console.error("HomeView Load Error:", error);
            container.innerHTML = `<div class="empty-state">${i18n.t('common.error')} <button class="btn-text" onclick="HomeView.loadData()">Retry</button></div>`;
        }
    },

    renderCard: (item) => {
        const catConfig = CATEGORIES[item.category] || (item.category ? { icon: '✨', color: '#ccc' } : CATEGORIES['Other']);
        const icon = catConfig ? catConfig.icon : '📦';
        const subText = item.subcategory ? `• ${item.subcategory}` : '';
        const timeData = getCountdown(item.targetDate);

        let badges = '';
        if (timeData) {
            badges += `<span class="time-tag ${timeData.class}" style="display: inline-flex;">⏳ ${timeData.text}</span>`;
        }
        if (item.occasion) {
            badges += `<span class="time-tag tag-far" style="display: inline-flex; margin-left:4px;">🎉 ${item.occasion}</span>`;
        }
        if (item.visibility === 'private') {
            badges += `<span class="time-tag tag-far" style="display: inline-flex; margin-left:4px; background:rgba(0,0,0,0.05); color:var(--text-primary);">${i18n.t('home.private_badge')}</span>`;
        }

        let topBadge = '';
        let priceDisplay = `<span class="price">${item.price} ${item.currency}</span>`;

        if (item.onSale && item.originalPrice && item.price < item.originalPrice) {
            const discount = item.discountPercent || Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100);
            topBadge = `<div class="tag-sale">On Sale ${discount > 0 ? ` -${discount}%` : ''}</div>`;
            priceDisplay = `
                <div style="display:flex; flex-direction:column; align-items:flex-end;">
                    <span class="original-price">${item.originalPrice} ${item.currency}</span>
                    <span class="price sale-price">${item.price} ${item.currency}</span>
                </div>
            `;
        }

        return `
            <article class="glass-panel card" data-id="${item.id}">
                <button class="card-action-btn delete-btn" onclick="window.handleDeleteItem('${item.id}')" title="${i18n.t('common.delete')}">&times;</button>
                <button class="card-action-btn edit-btn" onclick="window.handleEditItem('${item.id}')" title="${i18n.t('common.edit')}">✎</button>
                <button class="card-action-btn closet-btn" onclick="window.handleMoveToCloset('${item.id}')" title="Moved to Closet">✔</button>
                
                <div class="card-img-container">
                    ${topBadge}
                    <img src="${item.imageUrl || 'https://placehold.co/600x400'}" class="card-img" onerror="this.src='https://placehold.co/600x400'">
                </div>
                <div class="card-content">
                    <h3>${item.title}</h3>
                    <div style="margin-bottom:8px;">${badges}</div>
                    <div class="card-meta">
                        <span class="tag">${icon} ${item.category} ${subText}</span>
                        ${priceDisplay}
                    </div>
                </div>
            </article>
        `;
    },

    renderTimeline: (items) => { return `<div class="empty-state">Timeline coming soon...</div>`; }
};