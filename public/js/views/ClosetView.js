import { firestoreService } from '../services/FirestoreService.js';
import { authService } from '../services/AuthService.js';
import { AddItemModal } from '../components/addItemModal.js';
import { CATEGORIES } from '../config/categories.js';
import { i18n } from '../services/LocalizationService.js';
import { aiService } from '../services/AIService.js';

let addItemModal = null;
let closetItems = [];

// Filter State
let closetFilters = {
    category: 'All',
    occasion: 'All',
    search: ''
};

export const ClosetView = {
    render: async () => {
        const user = authService.currentUser;
        if (!user) return `<div class="empty-state">Login to see your closet.</div>`;

        const cats = ['All', ...Object.keys(CATEGORIES)];
        const occs = ['All', 'Birthday', 'New Year', 'Anniversary', 'Self-care', 'Custom'];

        return `
            <div class="view-header">
                <div style="display:flex; justify-content:space-between; align-items:flex-end;">
                    <div>
                        <h1>${i18n.t('nav.closet')}</h1>
                        <p>Your collection & fulfilled wishes.</p>
                    </div>
                    <button class="btn-primary" id="btn-add-closet" style="font-size:0.9rem;">+ Add Item</button>
                </div>

                <div class="filter-bar" style="display:flex; gap:12px; overflow-x:auto; padding-bottom:4px; margin-top:20px; align-items:center;">
                    <!-- Search -->
                    <div class="glass-panel" style="display:flex; align-items:center; padding:0 12px; height:40px; background:rgba(255,255,255,0.5); border-radius:12px; min-width:150px;">
                        <span style="font-size:1rem; opacity:0.5; margin-right:8px;">🔍</span>
                        <input type="text" id="closet-search" placeholder="Search..." 
                            style="border:none; background:transparent; font-size:0.9rem; width:100%; outline:none;">
                    </div>

                    <!-- Category -->
                    <select id="closet-cat" style="height:40px; padding:0 16px; border-radius:12px; border:none; background:rgba(255,255,255,0.5);">
                        ${cats.map(c => `<option value="${c}">${c}</option>`).join('')}
                    </select>

                    <!-- Occasion -->
                    <select id="closet-occ" style="height:40px; padding:0 16px; border-radius:12px; border:none; background:rgba(255,255,255,0.5);">
                        <option value="All">🎉 Occasion</option>
                        ${occs.map(o => `<option value="${o}">${o}</option>`).join('')}
                    </select>
                </div>
            </div>

            <div id="closet-grid" class="masonry-grid" style="margin-top:24px;">
                <div class="loading-spinner">${i18n.t('common.loading')}</div>
            </div>
        `;
    },

    afterRender: async () => {
        const user = authService.currentUser;
        if (!user) return;

        if (!addItemModal) addItemModal = new AddItemModal(() => ClosetView.loadData());

        // Bind Add Button (Opens modal with "Owned" checked by default logic if needed, 
        // but currently AddItemModal defaults to Wish. The user toggles "I own this".
        // We could enhance open() to accept a default status, but for now manual toggle is fine.)
        document.getElementById('btn-add-closet').onclick = () => addItemModal.open();

        // Bind Filters
        const render = () => ClosetView.renderGrid();

        document.getElementById('closet-search').addEventListener('input', (e) => {
            closetFilters.search = e.target.value.toLowerCase();
            render();
        });
        document.getElementById('closet-cat').addEventListener('change', (e) => {
            closetFilters.category = e.target.value;
            render();
        });
        document.getElementById('closet-occ').addEventListener('change', (e) => {
            closetFilters.occasion = e.target.value;
            render();
        });

        await ClosetView.loadData();
    },

    loadData: async () => {
        const user = authService.currentUser;
        try {
            // Uses the NEW getCloset which filters status='bought'
            closetItems = await firestoreService.getCloset(user.uid);
            ClosetView.renderGrid();
        } catch (e) {
            console.error(e);
            document.getElementById('closet-grid').innerHTML = `<p>Error loading closet.</p>`;
        }
    },

    renderGrid: () => {
        const container = document.getElementById('closet-grid');
        if (!container) return;

        let display = closetItems.filter(item => {
            // Search
            if (closetFilters.search && !item.title.toLowerCase().includes(closetFilters.search)) return false;
            // Category
            if (closetFilters.category !== 'All' && item.category !== closetFilters.category) return false;
            // Occasion
            if (closetFilters.occasion !== 'All' && item.occasion !== closetFilters.occasion) return false;
            return true;
        });

        if (display.length === 0) {
            container.innerHTML = `
                <div class="glass-panel empty-state-card">
                    <span class="empty-icon">🧥</span>
                    <h3>Your Closet is Empty</h3>
                    <p>Mark wishes as "Bought" or add items manually.</p>
                </div>`;
            return;
        }

        container.innerHTML = display.map(item => {
            const catConfig = CATEGORIES[item.category] || CATEGORIES['Other'];
            const icon = catConfig.icon || '📦';

            return `
                <article class="glass-panel card" data-id="${item.id}">
                    <div class="card-actions" style="position:absolute; top:10px; right:10px; z-index:10;">
                        <button class="card-action-btn edit-btn">✎</button>
                        <button class="card-action-btn return-btn" title="Move back to Wishlist">↺</button>
                    </div>
                    
                    <div class="card-img-container">
                        <img src="${item.imageUrl}" class="card-img" onerror="this.src='https://placehold.co/600x400'">
                    </div>
                    <div class="card-content">
                        <h3>${item.title}</h3>
                        <div class="card-meta">
                            <span class="tag">${icon} ${item.category}</span>
                            <span class="price">${item.price} ${item.currency}</span>
                        </div>
                    </div>
                </article>
            `;
        }).join('');

        // Bind Card Actions
        container.querySelectorAll('.edit-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const id = btn.closest('.card').dataset.id;
                const item = closetItems.find(i => i.id === id);
                if (item) addItemModal.open(item);
            };
        });

        container.querySelectorAll('.return-btn').forEach(btn => {
            btn.onclick = async (e) => {
                e.stopPropagation();
                if (confirm("Move this item back to your active Wishlist?")) {
                    const id = btn.closest('.card').dataset.id;
                    await firestoreService.unmarkOwned(id);
                    ClosetView.loadData();
                }
            };
        });
    }
};