import { firestoreService } from '../services/FirestoreService.js';
import { authService } from '../services/AuthService.js';
import { AddItemModal } from '../components/addItemModal.js';
import { CATEGORIES } from '../config/categories.js';
import { i18n } from '../services/LocalizationService.js';
import { premiumModal } from '../components/PremiumModal.js';
import { GamificationService } from '../services/GamificationService.js';
import { aiService } from '../services/AIService.js';

let addItemModal = null;
let itemsMap = new Map();

// Filter State
let currentFilters = {
    saleOnly: false,
    category: 'All',
    occasion: 'All',
    status: 'wish',
    priceMin: null,
    priceMax: null,
    search: '',
    viewMode: 'grid', // 'grid' | 'timeline' | 'gift'
    sortOrder: 'newest'
};

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

export const WishlistView = {
    skeletonTemplate: `
        <article class="glass-panel card skeleton-card">
            <div class="skeleton-img"></div>
            <div class="skeleton-text title"></div>
            <div class="skeleton-text meta"></div>
        </article>
    `,

    render: async () => {
        const cats = ['All', ...Object.keys(CATEGORIES)];
        const catOptions = cats.map(c => `<option value="${c}">${c}</option>`).join('');
        const occasions = ['All', 'Birthday', 'New Year', 'Anniversary', 'Self-care', 'Custom'];
        const occOptions = occasions.map(o => `<option value="${o}">${o}</option>`).join('');

        return `
            <div class="view-header" style="display:flex; flex-direction:column; gap:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                    <div>
                        <h1>${i18n.t('nav.wishlist')}</h1>
                    </div>
                    
                    <div class="view-toggle btn-group">
                        <div style="display:flex; background:rgba(0,0,0,0.05); border-radius:20px; padding:2px;">
                            <button id="btn-view-grid" class="toggle-btn active" style="padding:6px 12px;" title="Grid View">⊞</button>
                            <button id="btn-view-timeline" class="toggle-btn" style="padding:6px 12px;" title="Timeline View">📅</button>
                            <button id="btn-view-gift" class="toggle-btn" style="padding:6px 12px;" title="Gift Mode">🎁</button>
                        </div>
                    </div>
                </div>

                <!-- Filter Bar -->
                <div class="filter-bar" style="display:flex; gap:8px; overflow-x:auto; padding:4px 0; align-items:center; scrollbar-width:none;">
                    <div class="glass-panel" style="display:flex; align-items:center; padding:0 12px; height:36px; border-radius:20px; min-width:140px;">
                        <span style="font-size:0.9rem; opacity:0.5; margin-right:6px;">🔍</span>
                        <input type="text" id="search-input" placeholder="${i18n.t('ai.inputPlaceholder') || 'Search...'}" 
                            style="border:none; background:transparent; font-size:0.85rem; width:100%; outline:none; padding:0; color:var(--text-primary);">
                    </div>

                    <select id="sort-order" class="filter-chip" style="min-width: auto; padding-right:24px;">
                        <option value="newest">🕒 Newest</option>
                        <option value="oldest">🕒 Oldest</option>
                        <option value="priority">🔥 Priority</option>
                        <option value="date_near">📅 Due Soon</option>
                    </select>

                    <select id="filter-category" class="filter-chip" style="min-width: auto; padding-right:24px;">${catOptions}</select>
                    <select id="filter-occasion" class="filter-chip" style="min-width: auto; padding-right:24px;">
                        <option value="All">🎉 Occasion</option>${occOptions}
                    </select>

                    <button id="btn-archive-toggle" class="filter-chip">📦 Archived</button>
                    <button id="btn-sale-filter" class="filter-chip">% Sale</button>
                </div>
            </div>
            
            <div id="content-area" style="flex:1; min-width:0; margin-top:24px;">
                <div class="masonry-grid">${WishlistView.skeletonTemplate.repeat(4)}</div>
            </div>
            
            <button class="fab-add" id="fab-add-wish" style="position:fixed; bottom:30px; right:30px; z-index:999;">
                <span style="font-size:24px;">+</span>
            </button>

            <!-- Board Select Modal -->
            <div id="select-board-modal" class="modal-overlay" style="z-index: 1200;">
                <div class="modal-content" style="max-width:350px;">
                    <div class="modal-header"><h3>📌 Add to Board</h3><button class="close-btn close-select-board">&times;</button></div>
                    <div id="board-list-simple" style="display:flex; flex-direction:column; gap:8px; max-height:300px; overflow-y:auto;"></div>
                </div>
            </div>
        `;
    },

    afterRender: async () => {
        if (!addItemModal) addItemModal = new AddItemModal(() => WishlistView.loadData());

        // Bind Events
        const fab = document.getElementById('fab-add-wish');
        if (fab) fab.onclick = () => addItemModal.open();

        const renderWithTransition = () => {
            const grid = document.querySelector('.masonry-grid');
            if (grid) {
                grid.classList.add('grid-transition-fade');
                setTimeout(() => {
                    WishlistView.renderContent();
                    const newGrid = document.querySelector('.masonry-grid');
                    if (newGrid) newGrid.classList.remove('grid-transition-fade');
                }, 200);
            } else {
                WishlistView.renderContent();
            }
        };

        // Filter Bindings
        const bindFilter = (id, key, type = 'value') => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener(type === 'click' ? 'click' : 'input', (e) => {
                if (type === 'click') {
                    currentFilters[key] = !currentFilters[key];
                    e.target.classList.toggle('active', currentFilters[key]);
                } else {
                    currentFilters[key] = e.target.value === 'All' ? 'All' : e.target.value;
                }
                renderWithTransition();
            });
        };

        bindFilter('search-input', 'search');
        bindFilter('filter-category', 'category');
        bindFilter('sort-order', 'sortOrder');
        bindFilter('btn-sale-filter', 'saleOnly', 'click');

        const occSelect = document.getElementById('filter-occasion');
        if (occSelect) occSelect.onchange = (e) => { currentFilters.occasion = e.target.value; renderWithTransition(); };

        const btnArchive = document.getElementById('btn-archive-toggle');
        if (btnArchive) {
            btnArchive.onclick = () => {
                if (currentFilters.status === 'wish') {
                    currentFilters.status = 'archived';
                    btnArchive.classList.add('active');
                    btnArchive.textContent = 'Active Wishes';
                } else {
                    currentFilters.status = 'wish';
                    btnArchive.classList.remove('active');
                    btnArchive.textContent = '📦 Archived';
                }
                renderWithTransition();
            };
        }

        // View Toggles
        const setView = (mode) => {
            currentFilters.viewMode = mode;
            ['grid', 'timeline', 'gift'].forEach(m => {
                const btn = document.getElementById(`btn-view-${m}`);
                if (btn) btn.classList.toggle('active', mode === m);
            });
            renderWithTransition();
        };
        document.getElementById('btn-view-grid').onclick = () => setView('grid');
        document.getElementById('btn-view-timeline').onclick = () => setView('timeline');
        document.getElementById('btn-view-gift').onclick = () => setView('gift');

        // Board Select Logic
        const boardModal = document.getElementById('select-board-modal');
        document.querySelector('.close-select-board').onclick = () => {
            boardModal.classList.remove('active');
            setTimeout(() => boardModal.style.display = 'none', 300);
        };

        window.openBoardSelect = async (itemId, imageUrl) => {
            boardModal.style.display = 'flex';
            requestAnimationFrame(() => boardModal.classList.add('active'));
            const list = document.getElementById('board-list-simple');
            list.innerHTML = `<div class="loading-spinner">Loading...</div>`;
            try {
                const user = authService.currentUser;
                const boards = await firestoreService.getBoards(user.uid);
                if (boards.length === 0) {
                    list.innerHTML = `<p style="text-align:center; color:#999;">No boards yet.</p>`;
                    return;
                }
                list.innerHTML = boards.map(b => `
                    <div class="glass-panel" style="padding:12px; cursor:pointer; display:flex; align-items:center; gap:12px;" onclick="window.saveToBoard('${b.id}', '${itemId}', '${imageUrl}')">
                        <div style="width:40px; height:40px; border-radius:8px; background-image:url('${b.coverUrl}'); background-size:cover;"></div>
                        <strong>${b.title}</strong>
                    </div>
                `).join('');
            } catch (e) { list.innerHTML = "Error loading boards."; }
        };

        window.saveToBoard = async (boardId, refId, imageUrl) => {
            document.getElementById('select-board-modal').classList.remove('active');
            setTimeout(() => document.getElementById('select-board-modal').style.display = 'none', 300);
            await firestoreService.addPin(boardId, { imageUrl, refId });
            window.showToast("Saved to board!", "📌");
        };

        // Sync UI
        const syncUI = () => {
            if (document.getElementById('search-input')) document.getElementById('search-input').value = currentFilters.search;
            if (document.getElementById('sort-order')) document.getElementById('sort-order').value = currentFilters.sortOrder;
            if (document.getElementById('filter-category')) document.getElementById('filter-category').value = currentFilters.category;
            if (document.getElementById('filter-occasion')) document.getElementById('filter-occasion').value = currentFilters.occasion;

            const btnA = document.getElementById('btn-archive-toggle');
            if (btnA && currentFilters.status === 'archived') {
                btnA.classList.add('active');
                btnA.textContent = 'Active Wishes';
            }

            const btnS = document.getElementById('btn-sale-filter');
            if (btnS && currentFilters.saleOnly) btnS.classList.add('active');

            ['grid', 'timeline', 'gift'].forEach(m => {
                const btn = document.getElementById(`btn-view-${m}`);
                if (btn) btn.classList.toggle('active', currentFilters.viewMode === m);
            });
        };
        syncUI();
        await WishlistView.loadData();
    },

    loadData: async () => {
        const container = document.getElementById('content-area');
        if (!container) return;

        const user = authService.currentUser;
        if (!user) { container.innerHTML = `<div class="empty-state">Login required.</div>`; return; }

        try {
            const items = await firestoreService.getWishlist(user.uid, user.uid);
            itemsMap.clear();
            items.forEach(item => itemsMap.set(item.id, item));

            // Check Milestones
            GamificationService.checkMilestones('add_item', items.length);

            WishlistView.renderContent();
        } catch (error) {
            console.error(error);
            container.innerHTML = `<div class="empty-state">${i18n.t('common.error')} <button class="btn-text" onclick="WishlistView.loadData()">Retry</button></div>`;
        }
    },

    renderContent: () => {
        const container = document.getElementById('content-area');
        if (!container) return;

        let displayItems = Array.from(itemsMap.values());

        // Filters
        displayItems = displayItems.filter(item => {
            if (currentFilters.status === 'archived') return item.status === 'archived';
            if (currentFilters.viewMode === 'gift') return item.status === 'wish' && item.occasion;
            return item.status === 'wish';
        });

        if (currentFilters.saleOnly) displayItems = displayItems.filter(item => item.onSale);
        if (currentFilters.category !== 'All') displayItems = displayItems.filter(item => item.category === currentFilters.category);
        if (currentFilters.occasion !== 'All') displayItems = displayItems.filter(item => item.occasion === currentFilters.occasion);
        if (currentFilters.search) {
            const term = currentFilters.search;
            displayItems = displayItems.filter(item =>
                (item.title && item.title.toLowerCase().includes(term)) ||
                (item.category && item.category.toLowerCase().includes(term))
            );
        }

        // Sort
        displayItems.sort((a, b) => {
            switch (currentFilters.sortOrder) {
                case 'oldest': return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
                case 'priority': const pMap = { 'High': 3, 'Medium': 2, 'Low': 1 }; return (pMap[b.priority] || 2) - (pMap[a.priority] || 2);
                case 'date_near': if (!a.targetDate) return 1; if (!b.targetDate) return -1; return new Date(a.targetDate) - new Date(b.targetDate);
                case 'newest': default: return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
            }
        });

        if (displayItems.length === 0) {
            container.innerHTML = `<div class="empty-state"><p>No matches found.</p></div>`;
            return;
        }

        if (currentFilters.viewMode === 'timeline') {
            WishlistView.renderTimeline(container, displayItems);
        } else if (currentFilters.viewMode === 'gift') {
            WishlistView.renderGiftMode(container, displayItems);
        } else {
            // Grid
            const gridHtml = displayItems.map(item => WishlistView.renderCard(item)).join('');
            container.innerHTML = `<div class="masonry-grid">${gridHtml}</div>`;
            WishlistView.bindCardEvents(container);
        }
    },

    renderTimeline: (container, items) => {
        const datedItems = items.filter(i => i.targetDate).sort((a, b) => new Date(a.targetDate) - new Date(b.targetDate));
        const undatedItems = items.filter(i => !i.targetDate);

        let html = `<div class="timeline-container">`;
        let currentMonth = '';
        datedItems.forEach(item => {
            const date = new Date(item.targetDate);
            const monthStr = date.toLocaleString('default', { month: 'long', year: 'numeric' });
            if (monthStr !== currentMonth) {
                if (currentMonth !== '') html += `</div>`;
                currentMonth = monthStr;
                html += `<div class="timeline-group"><div class="timeline-header">${currentMonth}</div>`;
            }
            const day = date.getDate();
            html += `
                <div class="timeline-item glass-panel" style="display:flex; align-items:center; padding:16px; gap:16px;">
                    <div style="background:rgba(0,0,0,0.05); padding:8px 12px; border-radius:12px; text-align:center; min-width:60px;">
                        <span style="font-size:1.2rem; font-weight:700; display:block;">${day}</span>
                        <span style="font-size:0.7rem; text-transform:uppercase;">Due</span>
                    </div>
                    <img src="${item.imageUrl}" style="width:60px; height:60px; border-radius:12px; object-fit:cover;">
                    <div style="flex:1;">
                        <h4 style="margin:0;">${item.title}</h4>
                        <div style="font-size:0.85rem; color:var(--text-secondary);">${item.price} ${item.currency}</div>
                    </div>
                    <button class="btn-text edit-btn" data-id="${item.id}" style="font-size:1.2rem;">✎</button>
                </div>
            `;
        });

        if (datedItems.length > 0) html += `</div>`;

        if (undatedItems.length > 0) {
            html += `<div class="timeline-group"><div class="timeline-header">Someday</div>`;
            undatedItems.forEach(item => {
                html += `
                    <div class="timeline-item glass-panel" style="display:flex; align-items:center; padding:16px; gap:16px; opacity:0.8;">
                        <div style="width:60px; text-align:center; font-size:1.5rem;">∞</div>
                        <img src="${item.imageUrl}" style="width:50px; height:50px; border-radius:12px; object-fit:cover;">
                        <div style="flex:1;"><h4 style="margin:0;">${item.title}</h4></div>
                        <button class="btn-text edit-btn" data-id="${item.id}">✎</button>
                    </div>
                `;
            });
            html += `</div>`;
        }

        html += `</div>`;
        container.innerHTML = html;
        WishlistView.bindCardEvents(container);
    },

    renderGiftMode: (container, items) => {
        const groups = {};
        items.forEach(i => {
            const occ = i.occasion || "Other";
            if (!groups[occ]) groups[occ] = [];
            groups[occ].push(i);
        });

        let html = `<div style="padding-bottom:100px;">`;
        Object.keys(groups).forEach(occ => {
            html += `
                <div class="gift-mode-header">
                    <h3>🎁 ${occ}</h3>
                    <span class="tag">${groups[occ].length} wishes</span>
                </div>
                <div class="scroll-row">
                    ${groups[occ].map(item => WishlistView.renderCard(item, 'gift')).join('')}
                </div>
            `;
        });
        html += `</div>`;
        container.innerHTML = html;
        WishlistView.bindCardEvents(container);
    },

    renderCard: (item, context = 'grid') => {
        const isGift = context === 'gift';
        const giftClass = item.occasion ? 'card-gift' : '';
        const timeData = getCountdown(item.targetDate);
        let badges = '';
        if (timeData) badges += `<span class="time-tag ${timeData.class}">⏳ ${timeData.text}</span>`;
        if (item.visibility === 'private') badges += `<span class="time-tag tag-far" style="margin-left:4px;">🔒</span>`;
        if (item.occasion) badges += `<span class="time-tag tag-far" style="margin-left:4px;">🎉 ${item.occasion}</span>`;

        const descTitle = item.description ? `title="${item.description.replace(/"/g, '&quot;')}"` : '';

        return `
            <article class="glass-panel card ${item.isOwned ? 'card-owned' : ''} ${giftClass}" data-id="${item.id}" ${descTitle} style="${isGift ? 'min-width:200px; display:inline-block; margin-right:16px;' : ''}">
                <div class="card-actions" style="position:absolute; top:10px; right:10px; z-index:10; display:flex; gap:4px;">
                    <button class="card-action-btn edit-btn" style="position:static; opacity:1;">✎</button>
                    <button class="card-action-btn delete-btn" style="position:static; opacity:1; color:#ff3b30;">&times;</button>
                </div>
                <button class="card-action-btn pin-btn" style="position:absolute; top:10px; left:10px; z-index:10; opacity:1; color:#007AFF;" title="Add to Board">📌</button>
                ${!item.isOwned ? `<button class="card-action-btn closet-btn" style="position:absolute; top:50px; left:10px; z-index:10; opacity:1; color:#34C759;" title="Manifest!">✔</button>` : ''}
                
                <div class="card-img-container">
                    <img src="${item.imageUrl}" class="card-img" onerror="this.src='https://placehold.co/600x400'">
                </div>
                <div class="card-content">
                    <h3>${item.title}</h3>
                    <div style="margin-bottom:8px; display:flex; flex-wrap:wrap; gap:4px;">${badges}</div>
                    <div class="card-meta">
                        <span class="tag">${item.category}</span>
                        <span class="price">${item.price} ${item.currency}</span>
                    </div>
                </div>
            </article>
        `;
    },

    bindCardEvents: (container) => {
        container.querySelectorAll('.delete-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const id = btn.closest('.card').dataset.id;
                window.handleDeleteItem(id);
            };
        });
        container.querySelectorAll('.edit-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const id = btn.closest('.card').dataset.id;
                window.handleEditItem(id);
            };
        });
        container.querySelectorAll('.closet-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const id = btn.closest('.card').dataset.id;
                window.handleMoveToCloset(id);
            };
        });
        container.querySelectorAll('.pin-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const card = btn.closest('.card');
                window.openBoardSelect(card.dataset.id, card.querySelector('img').src);
            };
        });
    }
};