/* public/js/views/ClosetView.js */
import { firestoreService } from '../services/FirestoreService.js';
import { authService } from '../services/AuthService.js';
import { AddItemModal } from '../components/addItemModal.js';
import { CATEGORIES } from '../config/categories.js';
import { i18n } from '../services/LocalizationService.js';

let addItemModal = null;
let closetItems = [];
let closetFilters = { category: 'All', occasion: 'All', search: '', sort: 'newest' };

export const ClosetView = {
    render: async () => {
        const cats = ['All', ...Object.keys(CATEGORIES)];
        const occs = ['All', 'Birthday', 'New Year', 'Anniversary', 'Work', 'Party'];

        return `
            <div class="view-header closet-view-header">
                <div style="display:flex; justify-content:space-between; align-items:flex-end;">
                    <div>
                        <h1>${i18n.t('nav.closet')}</h1>
                        <p>Your collection</p>
                    </div>
                    <button class="btn-primary" id="btn-add-closet">+ Add Item</button>
                </div>

                <!-- Stats Summary -->
                <div id="closet-stats" style="display:flex; gap:16px; margin-top:16px; font-size:0.9rem; color:var(--text-secondary);"></div>

                <div class="filter-bar" style="display:flex; gap:8px; overflow-x:auto; padding:4px 0; margin-top:16px; align-items:center;">
                    <div class="glass-panel" style="display:flex; align-items:center; padding:0 12px; height:36px; border-radius:20px; min-width:140px;">
                        <span style="font-size:0.9rem; opacity:0.5; margin-right:6px;">🔍</span>
                        <input type="text" id="closet-search" placeholder="Search..." style="border:none; background:transparent; font-size:0.85rem; width:100%; outline:none;">
                    </div>
                    <select id="closet-sort" class="filter-chip"><option value="newest">Newest</option><option value="category">Category</option></select>
                    <select id="closet-cat" class="filter-chip">${cats.map(c => `<option value="${c}">${c}</option>`).join('')}</select>
                    <select id="closet-occ" class="filter-chip"><option value="All">Occasion</option>${occs.map(o => `<option value="${o}">${o}</option>`).join('')}</select>
                </div>
            </div>

            <div id="closet-grid" class="masonry-grid" style="margin-top:24px; min-height: 300px;">
                <div class="loading-spinner">${i18n.t('common.loading')}</div>
            </div>
            
            <!-- Shared Board Select -->
            <div id="select-board-modal-closet" class="modal-overlay" style="z-index: 1200;">
                <div class="modal-content" style="max-width:350px;">
                    <div class="modal-header"><h3>📌 Add to Board</h3><button class="close-btn close-select-board">&times;</button></div>
                    <div id="board-list-simple-closet" style="display:flex; flex-direction:column; gap:8px;"></div>
                </div>
            </div>
        `;
    },

    afterRender: async () => {
        const user = authService.currentUser;
        if (!user) return;
        if (!addItemModal) addItemModal = new AddItemModal(() => ClosetView.loadData());

        document.getElementById('btn-add-closet').onclick = () => addItemModal.open(null, { defaultStatus: 'bought' });

        const render = () => ClosetView.renderGrid();
        document.getElementById('closet-search').oninput = (e) => { closetFilters.search = e.target.value.toLowerCase(); render(); };
        document.getElementById('closet-sort').onchange = (e) => { closetFilters.sort = e.target.value; render(); };
        document.getElementById('closet-cat').onchange = (e) => { closetFilters.category = e.target.value; render(); };
        document.getElementById('closet-occ').onchange = (e) => { closetFilters.occasion = e.target.value; render(); };

        // Board Select Logic (Reuse)
        const bModal = document.getElementById('select-board-modal-closet');
        document.querySelector('.close-select-board').onclick = () => { bModal.classList.remove('active'); setTimeout(() => bModal.style.display = 'none', 300); };
        window.openBoardSelectCloset = async (iid, img) => {
            bModal.style.display = 'flex'; requestAnimationFrame(() => bModal.classList.add('active'));
            const list = document.getElementById('board-list-simple-closet');
            list.innerHTML = 'Loading...';
            try {
                const boards = await firestoreService.getBoards(user.uid);
                list.innerHTML = boards.map(b => `<div class="glass-panel" onclick="window.saveToBoardCloset('${b.id}', '${iid}', '${img}')" style="padding:10px; cursor:pointer;">${b.title}</div>`).join('');
            } catch (e) { list.innerHTML = "Error."; }
        };
        window.saveToBoardCloset = async (bid, iid, img) => {
            document.getElementById('select-board-modal-closet').click();
            await firestoreService.addPin(bid, { imageUrl: img, refId: iid });
            window.showToast("Pinned!", "📌");
        };

        await ClosetView.loadData();
    },

    loadData: async () => {
        const user = authService.currentUser;
        try {
            closetItems = await firestoreService.getCloset(user.uid);

            // Stats
            const totalValue = closetItems.reduce((sum, i) => sum + (i.price || 0), 0);
            document.getElementById('closet-stats').innerHTML = `
                <span>🧥 ${closetItems.length} items</span>
                <span>💰 Total Value: ~${Math.round(totalValue)}</span>
            `;

            ClosetView.renderGrid();
        } catch (e) { console.error(e); }
    },

    renderGrid: () => {
        const container = document.getElementById('closet-grid');
        let display = closetItems.filter(item => {
            if (closetFilters.search && !item.title.toLowerCase().includes(closetFilters.search)) return false;
            if (closetFilters.category !== 'All' && item.category !== closetFilters.category) return false;
            if (closetFilters.occasion !== 'All' && item.occasion !== closetFilters.occasion) return false;
            return true;
        });

        display.sort((a, b) => {
            if (closetFilters.sort === 'newest') return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
            if (closetFilters.sort === 'category') return a.category.localeCompare(b.category);
            return 0;
        });

        if (display.length === 0) { container.innerHTML = `<div class="empty-state">No items found.</div>`; return; }

        container.innerHTML = display.map(item => `
            <article class="glass-panel card card-closet" data-id="${item.id}">
                <div class="card-actions" style="position:absolute; top:10px; right:10px; z-index:10;">
                    <button class="card-action-btn edit-btn">✎</button>
                    <button class="card-action-btn return-btn">↺</button>
                </div>
                <button class="card-action-btn pin-btn" style="position:absolute; top:10px; left:10px; z-index:10;">📌</button>
                <div class="card-img-container"><img src="${item.imageUrl}" class="card-img"></div>
                <div class="card-content">
                    <h3>${item.title}</h3>
                    <div class="card-meta"><span>${item.category}</span>${item.occasion ? `<span class="gift-badge">${item.occasion}</span>` : ''}</div>
                </div>
            </article>
        `).join('');

        // Bind Actions
        container.querySelectorAll('.edit-btn').forEach(b => b.onclick = (e) => { e.stopPropagation(); addItemModal.open(closetItems.find(i => i.id === b.closest('.card').dataset.id)); });
        container.querySelectorAll('.return-btn').forEach(b => b.onclick = async (e) => {
            e.stopPropagation();
            if (confirm("Move back to wishlist?")) {
                await firestoreService.unmarkOwned(b.closest('.card').dataset.id);
                ClosetView.loadData();
            }
        });
        container.querySelectorAll('.pin-btn').forEach(b => b.onclick = (e) => {
            e.stopPropagation();
            const card = b.closest('.card');
            window.openBoardSelectCloset(card.dataset.id, card.querySelector('img').src);
        });
    }
};