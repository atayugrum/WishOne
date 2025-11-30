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
import { aiService } from '../services/AIService.js';
import { db } from '../config/firebase-config.js';
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let addItemModal = null;
let itemsMap = new Map();
let showSaleOnly = false;
let currentSearchTerm = '';

// Helper: Countdown
function getCountdown(dateString) {
    if (!dateString) return null;
    const target = new Date(dateString);
    if (isNaN(target.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    const diffTime = target - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: i18n.t('time.overdue') || "Overdue", class: "tag-overdue" };
    if (diffDays === 0) return { text: i18n.t('time.today') || "Today!", class: "tag-urgent" };
    if (diffDays <= 7) return { text: `${diffDays} ${i18n.t('time.days_left') || "days left"}`, class: "tag-urgent" };
    if (diffDays <= 30) return { text: `${diffDays} ${i18n.t('time.days_left') || "days left"}`, class: "tag-soon" };

    const months = Math.round(diffDays / 30);
    if (months <= 1) return { text: i18n.t('time.next_month') || "Next Month", class: "tag-far" };
    if (months >= 12) return { text: `in ${(months / 12).toFixed(1)} ${i18n.t('time.years') || "years"}`, class: "tag-far" };

    return { text: `in ${months} ${i18n.t('time.months') || "months"}`, class: "tag-far" };
}

export const HomeView = {
    skeletonTemplate: `
        <article class="glass-panel card skeleton-card">
            <div class="skeleton-img"></div>
            <div class="skeleton-text title"></div>
            <div class="skeleton-text meta"></div>
        </article>
    `,

    render: async () => {
        // Return pure HTML structure
        return `
            <div class="view-header" style="display:flex; flex-direction:column; gap:20px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-end; width:100%;">
                    <div>
                        <h1>${i18n.t('home.title')} 
                            <button class="btn-text" id="btn-run-tutorial" title="Show Tutorial" style="font-size:0.8rem; vertical-align:middle; opacity:0.5;">?</button>
                        </h1>
                        <p>${i18n.t('home.subtitle')}</p>
                    </div>
                    
                    <div class="view-toggle">
                        <button id="btn-planner" class="btn-magic" style="margin-right:12px; opacity:0.5; cursor:not-allowed;" title="${i18n.t('home.planner_locked')}">💰</button>
                        <button class="toggle-btn" id="btn-share-list" title="${i18n.t('home.share_btn')}" style="margin-right:12px;">🔗</button>
                        <button id="btn-sale-filter" class="toggle-btn" title="${i18n.t('home.sale_filter')}" style="margin-right:12px;">%</button>
                        <button id="btn-grid" class="toggle-btn active">⊞</button>
                        </div>
                </div>

                <div class="search-bar-container" style="width:100%; max-width:400px;">
                    <div class="glass-panel" style="display:flex; align-items:center; padding:0 12px; height:40px; background:rgba(255,255,255,0.5); border-radius:12px;">
                        <span style="font-size:1rem; opacity:0.5; margin-right:8px;">🔍</span>
                        <input type="text" id="search-input" placeholder="${i18n.t('ai.inputPlaceholder') || 'Search...'}" 
                            style="border:none; background:transparent; font-size:0.9rem; width:100%; outline:none; height:100%; padding:0; color:var(--text-primary);">
                    </div>
                </div>
            </div>
            
            <div class="home-grid-layout" style="display:flex; gap:24px; align-items:start; margin-top:24px;">
                <div id="col-ads-left" style="width:160px; position:sticky; top:120px; display:none; flex-direction:column; gap:20px;"></div>

                <div id="content-area" style="flex:1; min-width:0;">
                    <div class="masonry-grid">
                        ${HomeView.skeletonTemplate.repeat(4)}
                    </div>
                </div>
                
                <div id="col-right" style="width:250px; display:none; flex-direction:column; gap:20px; position:sticky; top:120px;">
                    <div class="activity-sidebar" id="activity-log-container">
                        <h3 style="font-size:0.9rem; color:var(--text-secondary); margin-bottom:12px;">Recent Activity</h3>
                        <div id="activity-list"></div>
                    </div>
                    <div id="col-ads-right" style="display:flex; flex-direction:column; gap:20px;"></div>
                </div>
            </div>
            
            <button class="fab-add" id="fab-add-wish" style="width:auto; padding:0 24px; border-radius:100px;">
                <span style="font-size:24px; margin-right:8px;">+</span> 
                <span style="font-size:16px; font-weight:600;">${i18n.t('home.addBtn')}</span>
            </button>

            <div id="planner-modal" class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header"><h2>Purchase Planner</h2><button class="close-btn" id="close-planner">&times;</button></div>
                    <div class="form-group"><input type="number" id="planner-budget" placeholder="Budget"></div>
                    <button class="btn-primary" id="btn-ai-plan">Plan</button>
                    <div id="planner-results" style="margin-top:20px;"></div>
                </div>
            </div>
        `;
    },

    afterRender: async () => {
        if (!addItemModal) addItemModal = new AddItemModal(() => HomeView.loadData());

        // 1. Bind Static Events
        document.getElementById('fab-add-wish').onclick = () => addItemModal.open();
        document.getElementById('btn-run-tutorial').onclick = () => window.runTutorial();

        document.getElementById('btn-share-list').onclick = () => {
            const user = authService.currentUser;
            const profile = authService.userProfile;
            if (profile && profile.isPrivate && !confirm(i18n.t('home.share_private_warn'))) return;
            const url = `${window.location.origin}/#/share?uid=${user.uid}`;
            navigator.clipboard.writeText(url).then(() => window.showToast(i18n.t('home.share_copy'), "🔗"));
        };

        document.getElementById('btn-sale-filter').onclick = (e) => {
            showSaleOnly = !showSaleOnly;
            e.target.classList.toggle('active', showSaleOnly);
            HomeView.renderGrid();
        };

        document.getElementById('search-input').addEventListener('input', (e) => {
            currentSearchTerm = e.target.value.toLowerCase().trim();
            HomeView.renderGrid();
        });

        // Planner Logic
        const plannerModal = document.getElementById('planner-modal');
        const plannerBtn = document.getElementById('btn-planner');

        plannerBtn.onclick = () => {
            if (itemsMap.size < 3) return alert(i18n.t('home.planner_locked'));
            if (!authService.canUseFeature(FEATURES.AI_PLANNER)) { premiumModal.open(); return; }
            plannerModal.classList.add('active');
        };

        document.getElementById('close-planner').onclick = () => plannerModal.classList.remove('active');

        document.getElementById('btn-ai-plan').onclick = async () => {
            const budget = parseFloat(document.getElementById('planner-budget').value);
            const resultsDiv = document.getElementById('planner-results');
            if (!budget) return alert("Enter budget.");
            resultsDiv.innerHTML = `<div class="loading-spinner">${i18n.t('common.loading')}</div>`;

            try {
                // Fetch again to be safe or use itemsMap
                const items = Array.from(itemsMap.values());
                const data = await apiCall('/api/ai/purchase-planner', 'POST', { wishlistItems: items, budget, currency: 'TRY' });
                authService.trackFeatureUsage(FEATURES.AI_PLANNER);
                if (data.recommendedItems) {
                    resultsDiv.innerHTML = `
                        <div style="background:rgba(255,255,255,0.5); padding:10px; border-radius:8px; margin-bottom:10px;"><strong>Plan:</strong> ${data.summary}</div>
                        ${data.recommendedItems.map(rec => { const item = items.find(i => i.id === rec.itemId); return item ? `<div class="glass-panel" style="padding:8px; margin-bottom:5px;"><b>${item.title}</b><br><small>${rec.reason}</small></div>` : ''; }).join('')}
                    `;
                } else { resultsDiv.innerHTML = `<p>No plan.</p>`; }
            } catch (error) { resultsDiv.innerHTML = `<p style="color:#ff3b30">Error: ${error.message}</p>`; }
        };

        // 2. Setup Tutorial Helper (Global because it recurses)
        window.runTutorial = async () => {
            const steps = [
                { el: '#fab-add-wish', text: "Start here! Add your first wish." },
                { el: 'a[href="#/inspo"]', text: "Create moodboards here." },
                { el: 'a[href="#/combos"]', text: "Mix & match items in your Closet." },
                { el: '#btn-planner', text: "Use AI to plan purchases." }
            ];

            const showStep = (index) => {
                document.querySelectorAll('.tutorial-overlay').forEach(e => e.remove());
                if (index >= steps.length) {
                    const user = authService.currentUser;
                    if (user) updateDoc(doc(db, "users", user.uid), { tutorialSeen: true }).catch(() => { });
                    if (window.aiCompanion) window.aiCompanion.say("You're all set!", "celebrating");
                    return;
                }
                const step = steps[index];
                const target = document.querySelector(step.el);
                if (!target) { showStep(index + 1); return; }
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });

                const overlay = document.createElement('div');
                overlay.className = 'tutorial-overlay glass-panel';
                overlay.style.cssText = `position:fixed; z-index:2000; padding:16px; max-width:250px; text-align:center;`;

                const rect = target.getBoundingClientRect();
                let top = rect.bottom + 10;
                let left = rect.left + (rect.width / 2) - 125;
                if (left < 10) left = 10;
                if (top + 100 > window.innerHeight) top = rect.top - 120;

                overlay.style.top = top + 'px';
                overlay.style.left = left + 'px';
                overlay.innerHTML = `<p style="margin-bottom:12px; font-weight:600;">${step.text}</p><button class="btn-primary" style="padding:6px 12px; font-size:0.8rem;" id="btn-next-step">Next</button>`;
                document.body.appendChild(overlay);
                document.getElementById('btn-next-step').onclick = () => showStep(index + 1);
            };
            showStep(0);
        };

        // 3. Load Data
        await HomeView.loadData();
    },

    loadData: async () => {
        const container = document.getElementById('content-area');
        if (!container) return;

        const user = authService.currentUser;
        if (!user) { container.innerHTML = `<div class="empty-state">Login required.</div>`; return; }

        try {
            const [items, closetItems] = await Promise.all([
                firestoreService.getWishlist(user.uid, user.uid),
                firestoreService.getCloset(user.uid)
            ]);

            itemsMap.clear();
            items.forEach(item => itemsMap.set(item.id, item));

            GamificationService.checkMilestones('add_item', items.length);
            GamificationService.checkMilestones('manifest', closetItems.length);

            // Planner Button State
            const plannerBtn = document.getElementById('btn-planner');
            if (plannerBtn) {
                const canUse = items.length >= 3;
                plannerBtn.style.opacity = canUse ? '1' : '0.5';
                plannerBtn.style.cursor = canUse ? 'pointer' : 'not-allowed';
            }

            // Auto Tutorial
            if (authService.userProfile && !authService.userProfile.tutorialSeen) {
                setTimeout(() => window.runTutorial(), 800);
            }

            // Sidebar Ads & Activity
            HomeView.setupSidebars(user);

            // Render Content
            HomeView.renderGrid();

        } catch (error) {
            console.error(error);
            container.innerHTML = `<div class="empty-state">${i18n.t('common.error')} <button class="btn-text" onclick="HomeView.loadData()">Retry</button></div>`;
        }
    },

    setupSidebars: async (user) => {
        const rightCol = document.getElementById('col-right');
        const leftCol = document.getElementById('col-ads-left');
        const rightAds = document.getElementById('col-ads-right');
        const activityContainer = document.getElementById('activity-log-container');
        const activityList = document.getElementById('activity-list');

        // 1. Visibility based on width
        if (window.innerWidth > 1000) {
            rightCol.style.display = 'flex';
            const activities = await firestoreService.getRecentActivities(user.uid);
            if (activities.length > 0) {
                activityContainer.style.display = 'block';
                activityList.innerHTML = activities.map(act => {
                    let text = act.type;
                    if (act.type === 'add_wish') text = `Wished for <strong>${act.details.title}</strong>`;
                    if (act.type === 'manifest') text = `Manifested <strong>${act.details.title}</strong> ✨`;
                    if (act.type === 'friend_add') text = `Added <strong>${act.details.name}</strong> as friend`;
                    return `<div class="glass-panel" style="padding:10px; margin-bottom:8px; font-size:0.8rem;"><span>${text}</span></div>`;
                }).join('');
            } else {
                activityContainer.style.display = 'none';
            }
        }

        // 2. Ads
        if (!authService.isPremium) {
            // Mock or Real, config handles it
            if (window.innerWidth > 1300) {
                leftCol.style.display = 'flex';
                leftCol.innerHTML = '';
                const leftAd = new AdSlot({ provider: 'mock', height: '600px' });
                leftCol.appendChild(leftAd.getElement());
            }
            if (window.innerWidth > 1000) {
                rightAds.innerHTML = '';
                const rightAd = new AdSlot({ provider: 'mock', height: '300px' });
                rightAds.appendChild(rightAd.getElement());
            }
        }
    },

    renderGrid: () => {
        const container = document.getElementById('content-area');
        if (!container) return;

        let displayItems = Array.from(itemsMap.values());

        // Filter
        if (showSaleOnly) displayItems = displayItems.filter(item => item.onSale);
        if (currentSearchTerm) {
            displayItems = displayItems.filter(item =>
                (item.title && item.title.toLowerCase().includes(currentSearchTerm)) ||
                (item.category && item.category.toLowerCase().includes(currentSearchTerm))
            );
        }

        if (displayItems.length === 0) {
            if (!showSaleOnly && !currentSearchTerm) {
                container.innerHTML = `
                    <div class="glass-panel empty-state-card">
                        <span class="empty-icon">💭</span>
                        <h2 class="empty-title">${i18n.t('home.empty')}</h2>
                        <div class="empty-actions">
                            <button class="btn-primary" onclick="window.openAddModal()">+ ${i18n.t('home.addBtn')}</button>
                        </div>
                    </div>`;
            } else {
                container.innerHTML = `<div class="empty-state"><p>No matches found.</p></div>`;
            }
            return;
        }

        let gridHtml = '';
        displayItems.forEach((item, index) => {
            gridHtml += HomeView.renderCard(item);
            // Mobile inline ad
            if (!authService.isPremium && window.innerWidth <= 1000 && (index + 1) % 4 === 0) {
                const ad = new AdSlot({ provider: 'mock', height: '250px' });
                gridHtml += `<div class="ad-wrapper">${ad.getElement().outerHTML}</div>`;
            }
        });

        container.innerHTML = `<div class="masonry-grid">` + gridHtml + `</div>`;

        // Card Action Bindings
        container.querySelectorAll('.delete-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                window.handleDeleteItem(btn.closest('.card').dataset.id);
            };
        });
        container.querySelectorAll('.edit-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                window.handleEditItem(btn.closest('.card').dataset.id);
            };
        });
        container.querySelectorAll('.closet-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                window.handleMoveToCloset(btn.closest('.card').dataset.id);
            };
        });
        // Ad Remove Link
        container.querySelectorAll('.remove-ads-link').forEach(el => {
            el.onclick = (e) => { e.stopPropagation(); premiumModal.open(); };
        });
    },

    renderCard: (item) => {
        const catConfig = CATEGORIES[item.category] || CATEGORIES['Other'];
        const icon = catConfig.icon || '📦';
        const timeData = getCountdown(item.targetDate);

        let badges = '';
        if (timeData) badges += `<span class="time-tag ${timeData.class}">⏳ ${timeData.text}</span>`;
        if (item.visibility === 'private') badges += `<span class="time-tag tag-far" style="margin-left:4px;">🔒</span>`;

        return `
            <article class="glass-panel card" data-id="${item.id}">
                <div class="card-actions" style="position:absolute; top:10px; right:10px; z-index:10; display:flex; gap:4px;">
                    <button class="card-action-btn edit-btn" style="position:static; opacity:1;">✎</button>
                    <button class="card-action-btn delete-btn" style="position:static; opacity:1; color:#ff3b30;">&times;</button>
                </div>
                <button class="card-action-btn closet-btn" style="position:absolute; top:10px; left:10px; z-index:10; opacity:1; color:#34C759;" title="Manifest!">✔</button>
                
                <div class="card-img-container">
                    <img src="${item.imageUrl}" class="card-img" onerror="this.src='https://placehold.co/600x400'">
                </div>
                <div class="card-content">
                    <h3>${item.title}</h3>
                    <div style="margin-bottom:8px; display:flex; flex-wrap:wrap; gap:4px;">${badges}</div>
                    <div class="card-meta">
                        <span class="tag">${icon} ${item.category}</span>
                        <span class="price">${item.price} ${item.currency}</span>
                    </div>
                </div>
            </article>
        `;
    }
};