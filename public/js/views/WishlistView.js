/* public/js/views/WishlistView.js */
import { firestoreService } from '../services/FirestoreService.js';
import { authService } from '../services/AuthService.js';
import { AddItemModal } from '../components/addItemModal.js';
import { i18n } from '../services/LocalizationService.js';

let addItemModal = null;
let itemsMap = new Map();

// Local state for filters
let currentFilter = {
    occasion: 'All', // 'All', 'Main', or specific string
};

export const WishlistView = {
    render: async () => {
        return `
            <div class="view-header">
                <h1>${i18n.t('nav.wishlist')}</h1>
            </div>

            <!-- Occasion Filter Bar -->
            <div id="occasion-filters" class="filter-scroll-container">
                <!-- Pills injected here -->
                <div class="loading-spinner">Loading...</div>
            </div>

            <!-- Add Button (Prominent) -->
            <button id="btn-add-wish-main" class="glass-panel" style="width:100%; padding:16px; margin-bottom:24px; display:flex; align-items:center; justify-content:center; gap:10px; color:var(--accent-color); font-weight:600; cursor:pointer; border:1px dashed var(--accent-color);">
                <span style="font-size:1.2rem;">+</span> Add New Wish
            </button>
            
            <!-- Main Grid -->
            <div id="wishlist-grid" class="masonry-grid">
                <!-- Cards injected here -->
            </div>
        `;
    },

    afterRender: async () => {
        const user = authService.currentUser;
        if (!user) return;

        if (!addItemModal) addItemModal = new AddItemModal(() => WishlistView.refresh());

        // Bind Main Add Button
        document.getElementById('btn-add-wish-main').onclick = () => addItemModal.open();

        await WishlistView.loadData();
    },

    loadData: async () => {
        const user = authService.currentUser;
        try {
            const items = await firestoreService.getWishlist(user.uid, user.uid);
            // Filter out bought items (they go to closet) and deleted ones
            const wishes = items.filter(i => i.status === 'wish' && !i.deleted);
            
            itemsMap.clear();
            wishes.forEach(i => itemsMap.set(i.id, i));

            WishlistView.renderFilters(wishes);
            WishlistView.renderGrid(wishes);

        } catch (e) {
            console.error(e);
        }
    },

    renderFilters: (wishes) => {
        const container = document.getElementById('occasion-filters');
        if(!container) return;

        // Extract unique occasions. Null/Empty = "Main List"
        const occasions = new Set(['All', 'Main']);
        wishes.forEach(i => {
            if(i.occasion) occasions.add(i.occasion);
        });

        container.innerHTML = Array.from(occasions).map(occ => {
            const isActive = currentFilter.occasion === occ ? 'active' : '';
            const label = occ === 'Main' ? 'General' : occ;
            return `<button class="occasion-pill ${isActive}" data-val="${occ}">${label}</button>`;
        }).join('');

        // Bind clicks
        container.querySelectorAll('.occasion-pill').forEach(btn => {
            btn.onclick = () => {
                currentFilter.occasion = btn.dataset.val;
                WishlistView.renderFilters(wishes); // Re-render pills to update active state
                WishlistView.renderGrid(wishes); // Filter grid
            };
        });
    },

    renderGrid: (allWishes) => {
        const container = document.getElementById('wishlist-grid');
        if(!container) return;

        // Filter Logic
        const filtered = allWishes.filter(item => {
            if (currentFilter.occasion === 'All') return true;
            if (currentFilter.occasion === 'Main') return !item.occasion; // Empty occasion
            return item.occasion === currentFilter.occasion;
        });

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column:1/-1; padding:40px 0;">
                    <div style="font-size:3rem; opacity:0.5; margin-bottom:12px;">🍃</div>
                    <h3>Nothing here yet</h3>
                    <p>This list is waiting for your dreams.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filtered.map(item => {
            // Calculation for display
            let savingHint = '';
            if (item.targetDate && item.price > 0) {
                const target = new Date(item.targetDate);
                const weeks = Math.max(1, Math.ceil((target - new Date()) / (1000 * 60 * 60 * 24 * 7)));
                const amount = Math.ceil(item.price / weeks);
                savingHint = `<div style="margin-top:8px; font-size:0.75rem; color:var(--accent-color); font-weight:600; background:rgba(99,102,241,0.05); padding:4px 8px; border-radius:8px; display:inline-block;">
                    🎯 Save ${amount} ${item.currency}/wk
                </div>`;
            }

            return `
                <article class="glass-panel card" data-id="${item.id}">
                    <div class="card-img-container">
                        <img src="${item.imageUrl}" class="card-img" onerror="this.src='https://placehold.co/400x300'">
                        <div style="position:absolute; top:8px; right:8px; display:flex; gap:4px;">
                            <span class="tag" style="background:rgba(255,255,255,0.9); backdrop-filter:blur(4px);">${item.priority}</span>
                        </div>
                    </div>
                    <div class="card-content" style="padding:16px;">
                        <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:4px;">
                            <h3 style="margin:0; font-size:1rem; line-height:1.3;">${item.title}</h3>
                        </div>
                        <div style="color:var(--text-secondary); font-size:0.9rem;">${item.price} ${item.currency}</div>
                        ${savingHint}
                        
                        <div class="card-actions-row" style="margin-top:16px; display:flex; justify-content:space-between; align-items:center;">
                            <button class="btn-text btn-edit" style="font-size:0.8rem;">Edit</button>
                            <div style="display:flex; gap:8px;">
                                <button class="icon-btn btn-delete" style="color:#ff3b30; font-size:1rem;" title="Delete">🗑</button>
                                <button class="icon-btn btn-complete" style="color:#34C759; background:rgba(52,199,89,0.1); border-radius:50%; width:32px; height:32px; display:flex; align-items:center; justify-content:center;" title="Manifested!">✔</button>
                            </div>
                        </div>
                    </div>
                </article>
            `;
        }).join('');

        // Bind Actions
        container.querySelectorAll('.btn-edit').forEach(b => b.onclick = (e) => {
            const id = b.closest('.card').dataset.id;
            addItemModal.open(itemsMap.get(id));
        });

        container.querySelectorAll('.btn-delete').forEach(b => b.onclick = (e) => {
            const id = b.closest('.card').dataset.id;
            if(confirm("Delete this wish?")) {
                firestoreService.deleteItem(id).then(() => WishlistView.refresh());
            }
        });

        container.querySelectorAll('.btn-complete').forEach(b => b.onclick = (e) => {
            const id = b.closest('.card').dataset.id;
            if(confirm("Mark as bought and move to Closet?")) {
                firestoreService.markAsOwned(id).then(() => {
                    window.showToast("Moved to Closet!", "🎉");
                    WishlistView.refresh();
                });
            }
        });
    },

    refresh: async () => {
        // Re-fetch and re-render
        await WishlistView.loadData();
    }
};