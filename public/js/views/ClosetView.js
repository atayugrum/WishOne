/* public/js/views/ClosetView.js */
import { firestoreService } from '../services/FirestoreService.js';
import { authService } from '../services/AuthService.js';
import { AddItemModal } from '../components/addItemModal.js';
import { CATEGORIES } from '../config/categories.js';
import { i18n } from '../services/LocalizationService.js';

let addItemModal = null;
let itemsMap = new Map();

// Filter State
let currentFilters = {
    category: 'All',
    occasion: 'All',
    search: '',
    sortOrder: 'newest'
};

export const ClosetView = {
    render: async () => {
        const cats = ['All', ...Object.keys(CATEGORIES)];
        const catOptions = cats.map(c => `<option value="${c}">${c}</option>`).join('');
        const occasions = ['All', 'Birthday', 'New Year', 'Anniversary', 'Self-care', 'Custom'];
        const occOptions = occasions.map(o => `<option value="${o}">${o}</option>`).join('');

        return `
            <div class="view-header" style="display:flex; flex-direction:column; gap:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <h1>${i18n.t('nav.closet')}</h1>
                        <p style="color:var(--text-secondary); font-size:0.9rem;" id="closet-stats">Loading stats...</p>
                    </div>
                    <button class="btn-primary" id="btn-add-closet" style="padding:8px 16px;">+ Add Item</button>
                </div>

                <div class="filter-bar" style="display:flex; gap:8px; overflow-x:auto; padding:4px 0; align-items:center; scrollbar-width:none;">
                    <div class="glass-panel" style="display:flex; align-items:center; padding:0 12px; height:36px; border-radius:20px; min-width:140px;">
                        <span style="font-size:0.9rem; opacity:0.5; margin-right:6px;">🔍</span>
                        <input type="text" id="closet-search" placeholder="Search closet..." 
                            style="border:none; background:transparent; font-size:0.85rem; width:100%; outline:none; padding:0; color:var(--text-primary);">
                    </div>

                    <select id="closet-sort" class="filter-chip" style="min-width: auto; padding-right:24px;">
                        <option value="newest">🕒 Newest</option>
                        <option value="oldest">🕒 Oldest</option>
                        <option value="price_high">💰 Price High</option>
                        <option value="price_low">💰 Price Low</option>
                    </select>

                    <select id="closet-category" class="filter-chip" style="min-width: auto; padding-right:24px;">${catOptions}</select>
                    <select id="closet-occasion" class="filter-chip" style="min-width: auto; padding-right:24px;">
                        <option value="All">🎉 Occasion</option>${occOptions}
                    </select>
                </div>
            </div>
            
            <div id="closet-content" style="flex:1; min-width:0; margin-top:24px;">
                <div class="masonry-grid">
                    <div class="glass-panel card skeleton-card" style="height:200px;"></div>
                    <div class="glass-panel card skeleton-card" style="height:250px;"></div>
                    <div class="glass-panel card skeleton-card" style="height:180px;"></div>
                </div>
            </div>

             <div id="select-board-modal" class="modal-overlay" style="z-index: 1200;">
                <div class="modal-content" style="max-width:350px;">
                    <div class="modal-header"><h3>📌 Add to Board</h3><button class="close-btn close-select-board">&times;</button></div>
                    <div id="board-list-simple" style="display:flex; flex-direction:column; gap:8px; max-height:300px; overflow-y:auto;"></div>
                </div>
            </div>
        `;
    },

    afterRender: async () => {
        const user = authService.currentUser;
        if (!user) return;

        if (!addItemModal) addItemModal = new AddItemModal(() => ClosetView.loadData());

        // Add Button
        document.getElementById('btn-add-closet').onclick = () => {
            // Open modal with 'bought' status by default
            addItemModal.open(null, 'bought');
        };

        // Filter Bindings
        const bindFilter = (id, key) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', (e) => {
                currentFilters[key] = e.target.value === 'All' ? 'All' : e.target.value;
                ClosetView.renderContent();
            });
        };
        bindFilter('closet-search', 'search');
        bindFilter('closet-sort', 'sortOrder');
        bindFilter('closet-category', 'category');
        bindFilter('closet-occasion', 'occasion');

        // Board Modal Close
        const boardModal = document.getElementById('select-board-modal');
        document.querySelector('.close-select-board').onclick = () => {
            boardModal.classList.remove('active');
            setTimeout(() => boardModal.style.display = 'none', 300);
        };

        await ClosetView.loadData();
    },

    loadData: async () => {
        const container = document.getElementById('closet-content');
        const user = authService.currentUser;
        
        try {
            const items = await firestoreService.getCloset(user.uid);
            itemsMap.clear();
            items.forEach(item => itemsMap.set(item.id, item));
            
            ClosetView.updateStats(items);
            ClosetView.renderContent();
        } catch (error) {
            console.error(error);
            container.innerHTML = `<div class="empty-state">${i18n.t('common.error')}</div>`;
        }
    },

    updateStats: (items) => {
        const statsEl = document.getElementById('closet-stats');
        if (!statsEl) return;
        
        const count = items.length;
        // Calculate approx value (sum of prices, ignoring mixed currencies for MVP simplicity, or just summing numbers)
        // Ideally we group by currency
        const totals = {};
        items.forEach(i => {
            const curr = i.currency || 'TRY';
            if (!totals[curr]) totals[curr] = 0;
            totals[curr] += (i.price || 0);
        });

        const valueStr = Object.entries(totals)
            .map(([curr, val]) => `${val.toLocaleString()} ${curr}`)
            .join(' + ');

        statsEl.innerHTML = `<b>${count}</b> items • Value: <b>${valueStr || '0'}</b>`;
    },

    renderContent: () => {
        const container = document.getElementById('closet-content');
        if (!container) return;

        let displayItems = Array.from(itemsMap.values());

        // Filtering
        if (currentFilters.category !== 'All') displayItems = displayItems.filter(item => item.category === currentFilters.category);
        if (currentFilters.occasion !== 'All') displayItems = displayItems.filter(item => item.occasion === currentFilters.occasion);
        if (currentFilters.search) {
            const term = currentFilters.search.toLowerCase();
            displayItems = displayItems.filter(item => item.title.toLowerCase().includes(term));
        }

        // Sorting
        displayItems.sort((a, b) => {
            switch (currentFilters.sortOrder) {
                case 'oldest': return (a.purchasedAt?.seconds || a.createdAt?.seconds || 0) - (b.purchasedAt?.seconds || b.createdAt?.seconds || 0);
                case 'price_high': return (b.price || 0) - (a.price || 0);
                case 'price_low': return (a.price || 0) - (b.price || 0);
                case 'newest': default: return (b.purchasedAt?.seconds || b.createdAt?.seconds || 0) - (a.purchasedAt?.seconds || a.createdAt?.seconds || 0);
            }
        });

        if (displayItems.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="margin-top:40px;">
                    <div style="font-size:3rem; margin-bottom:16px;">🧥</div>
                    <h3>Your Closet is empty</h3>
                    <p style="color:var(--text-secondary);">Mark wishes as bought or add items manually.</p>
                </div>`;
            return;
        }

        const html = displayItems.map(item => `
            <article class="glass-panel card card-owned" data-id="${item.id}">
                <div class="card-actions" style="position:absolute; top:10px; right:10px; z-index:10; display:flex; gap:4px;">
                    <button class="card-action-btn edit-btn">✎</button>
                    <button class="card-action-btn unbuy-btn" title="Move back to Wishlist" style="color:orange;">↩</button>
                    <button class="card-action-btn delete-btn" style="color:#ff3b30;">&times;</button>
                </div>
                
                <button class="card-action-btn pin-btn" style="position:absolute; top:10px; left:10px; z-index:10; color:#007AFF;" title="Add to Board">📌</button>

                <div class="card-img-container">
                    <img src="${item.imageUrl}" class="card-img" onerror="this.src='https://placehold.co/600x400'">
                </div>
                <div class="card-content">
                    <h3>${item.title}</h3>
                    <div class="card-meta">
                        <span class="tag">${item.category}</span>
                        <span class="price">${item.price} ${item.currency}</span>
                    </div>
                    ${item.purchasedAt ? `<div style="font-size:0.7rem; color:var(--text-tertiary); margin-top:6px;">Bought: ${new Date(item.purchasedAt.seconds * 1000).toLocaleDateString()}</div>` : ''}
                </div>
            </article>
        `).join('');

        container.innerHTML = `<div class="masonry-grid">${html}</div>`;

        // Bind Events
        container.querySelectorAll('.edit-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const id = btn.closest('.card').dataset.id;
                addItemModal.open(itemsMap.get(id));
            };
        });
        container.querySelectorAll('.unbuy-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const id = btn.closest('.card').dataset.id;
                window.handleUnmarkOwned(id);
            };
        });
        container.querySelectorAll('.delete-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const id = btn.closest('.card').dataset.id;
                window.handleDeleteClosetItem(id);
            };
        });
        container.querySelectorAll('.pin-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const card = btn.closest('.card');
                const item = itemsMap.get(card.dataset.id);
                window.openBoardSelect(item.id, item.imageUrl);
            };
        });
    }
};

// Global Handlers
window.handleUnmarkOwned = async (id) => {
    if (confirm("Move this item back to Wishlist?")) {
        try {
            await firestoreService.unmarkOwned(id);
            window.showToast("Returned to Wishlist", "↩");
            ClosetView.loadData();
        } catch (e) { console.error(e); }
    }
};

window.handleDeleteClosetItem = async (id) => {
    if (confirm("Delete this item permanently?")) {
        try {
            await firestoreService.deleteItem(id); // Soft delete/archive
            ClosetView.loadData();
            window.showToast("Item removed", "🗑");
        } catch (e) { console.error(e); }
    }
};