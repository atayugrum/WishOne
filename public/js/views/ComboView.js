/* public/js/views/ComboView.js */
import { authService } from '../services/AuthService.js';
import { firestoreService } from '../services/FirestoreService.js';
import { aiService } from '../services/AIService.js'; // [NEW]
import { FEATURES } from '../config/limits.js';
import { premiumModal } from '../components/PremiumModal.js';
import { i18n } from '../services/LocalizationService.js';

// --- STATE ---
let canvasItems = [];
let draggedItem = null;
let currentComboId = null;
let mode = 'overview';
let nextZIndex = 100;

export const ComboView = {
    render: async () => {
        return `
            <div id="combo-wrapper" style="width:100%; height:100%;"></div>
        `;
    },

    afterRender: async () => {
        const user = authService.currentUser;
        if (!user) {
            document.getElementById('combo-wrapper').innerHTML = `<div class="empty-state">Login to create combos.</div>`;
            return;
        }

        await ComboView.renderOverview(user.uid);
    },

    // --- VIEW 1: OVERVIEW ---
    renderOverview: async (uid) => {
        const wrapper = document.getElementById('combo-wrapper');
        mode = 'overview';
        currentComboId = null;

        wrapper.innerHTML = `
            <div class="view-header" style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <h1>${i18n.t('nav.combos')}</h1>
                    <p>Your saved outfits & sets.</p>
                </div>
                <button class="btn-primary" id="btn-new-combo">+ New Combo</button>
            </div>
            <div id="combos-grid" class="masonry-grid" style="margin-top:24px;">
                <div class="loading-spinner">${i18n.t('common.loading')}</div>
            </div>
        `;

        document.getElementById('btn-new-combo').onclick = () => ComboView.renderEditor(uid);

        try {
            const combos = await firestoreService.getCombos(uid);
            const grid = document.getElementById('combos-grid');

            if (combos.length === 0) {
                grid.innerHTML = `
                    <div class="glass-panel empty-state-card" style="grid-column:1/-1;">
                        <span class="empty-icon">🎨</span>
                        <h3>No combos yet</h3>
                        <p>Create your first outfit or set.</p>
                    </div>`;
                return;
            }

            grid.innerHTML = combos.map(c => `
                <div class="glass-panel card combo-card" data-id="${c.id}" style="cursor:pointer;">
                    <div style="height:160px; background:url('${c.previewImage || 'https://placehold.co/400x300/png?text=Combo'}') center/cover; border-radius:12px 12px 0 0;"></div>
                    <div style="padding:16px;">
                        <h3 style="margin-bottom:4px;">${c.title}</h3>
                        <p style="font-size:0.8rem; color:var(--text-secondary);">${c.items ? c.items.length : 0} items</p>
                    </div>
                    <button class="card-action-btn delete-btn" style="top:10px; right:10px;" onclick="window.deleteCombo('${c.id}', event)">&times;</button>
                </div>
            `).join('');

            grid.querySelectorAll('.combo-card').forEach(card => {
                card.onclick = (e) => {
                    if (e.target.classList.contains('delete-btn')) return;
                    const combo = combos.find(c => c.id === card.dataset.id);
                    if (combo) ComboView.renderEditor(uid, combo);
                };
            });

            window.deleteCombo = async (id, e) => {
                e.stopPropagation();
                if (confirm("Delete this combo?")) {
                    await firestoreService.deleteCombo(id);
                    ComboView.renderOverview(uid);
                }
            };

        } catch (e) { console.error(e); }
    },

    // --- VIEW 2: EDITOR ---
    renderEditor: async (uid, existingCombo = null) => {
        mode = 'editor';
        currentComboId = existingCombo ? existingCombo.id : null;
        canvasItems = existingCombo ? (existingCombo.items || []) : [];

        // Data Migration check
        if (canvasItems.length > 0 && typeof canvasItems[0] === 'string') canvasItems = [];

        const wrapper = document.getElementById('combo-wrapper');
        wrapper.innerHTML = `
            <div class="view-header" style="display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <button class="btn-text" id="btn-back-overview" style="font-size:1.2rem;">←</button>
                    <div>
                        <h1 id="editor-title" contenteditable="true" style="border-bottom:1px dashed #ccc; cursor:text;">
                            ${existingCombo ? existingCombo.title : 'Untitled Combo'}
                        </h1>
                    </div>
                </div>
                <div class="btn-group">
                    <button class="btn-magic" id="btn-ai-combo">✨ AI Suggest</button>
                    <button class="btn-primary" id="btn-save-combo">💾 Save</button>
                </div>
            </div>

            <div class="combo-workspace">
                <!-- Sidebar -->
                <div class="combo-sidebar glass-panel">
                    <div class="auth-tabs compact-tabs" style="margin-bottom:12px;">
                        <div class="auth-tab active" id="tab-closet">Closet</div>
                        <div class="auth-tab" id="tab-wishlist">Wishlist</div>
                    </div>
                    <input type="text" id="combo-search" placeholder="Search..." class="sidebar-search">
                    <div id="combo-items-list" class="sidebar-grid">
                        <div class="loading-spinner">Loading...</div>
                    </div>
                </div>

                <!-- Canvas -->
                <div class="combo-canvas-container">
                    <div id="combo-canvas" class="combo-canvas">
                        ${canvasItems.length === 0 ? `<p class="canvas-placeholder">Drag items here</p>` : ''}
                    </div>
                    <div class="canvas-controls">
                        <button id="btn-clear-canvas" class="btn-text" style="background:white; padding:6px 12px; border-radius:8px; font-size:0.8rem;">Clear</button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('btn-back-overview').onclick = () => ComboView.renderOverview(uid);

        // Load Sidebar Data
        let closet = [], wishlist = [];
        try {
            [closet, wishlist] = await Promise.all([
                firestoreService.getCloset(uid),
                firestoreService.getWishlist(uid, uid)
            ]);
        } catch (e) { console.error(e); }

        const renderSidebar = (source) => {
            const list = document.getElementById('combo-items-list');
            const items = source === 'closet' ? closet : wishlist;
            const search = document.getElementById('combo-search').value.toLowerCase();
            const filtered = items.filter(i => i.title.toLowerCase().includes(search));

            list.innerHTML = filtered.map(item => `
                <div class="combo-item-thumb" draggable="true" data-id="${item.id}">
                    <img src="${item.imageUrl}" style="pointer-events:none;">
                    <div class="caption">${item.title}</div>
                </div>
            `).join('');

            list.querySelectorAll('.combo-item-thumb').forEach(el => {
                el.addEventListener('dragstart', (e) => {
                    const id = el.dataset.id;
                    const itemData = items.find(i => i.id === id);
                    e.dataTransfer.setData('text/plain', JSON.stringify(itemData));
                    draggedItem = itemData;
                    el.style.opacity = '0.5';
                });
                el.addEventListener('dragend', (e) => { el.style.opacity = '1'; });
            });
        };

        const tabCloset = document.getElementById('tab-closet');
        const tabWish = document.getElementById('tab-wishlist');

        tabCloset.onclick = () => { tabCloset.classList.add('active'); tabWish.classList.remove('active'); renderSidebar('closet'); };
        tabWish.onclick = () => { tabWish.classList.add('active'); tabCloset.classList.remove('active'); renderSidebar('wishlist'); };
        document.getElementById('combo-search').addEventListener('input', () => { renderSidebar(tabCloset.classList.contains('active') ? 'closet' : 'wishlist'); });

        renderSidebar('closet');

        // --- CANVAS LOGIC ---
        const canvas = document.getElementById('combo-canvas');

        if (canvasItems.length > 0) {
            canvasItems.forEach(item => {
                if (!item.x) { item.x = 50; item.y = 50; }
                renderCanvasItem(item);
            });
        }

        canvas.addEventListener('dragover', (e) => e.preventDefault());
        canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            try {
                const raw = e.dataTransfer.getData('text/plain');
                if (!raw) return;
                const data = JSON.parse(raw);

                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left - 50;
                const y = e.clientY - rect.top - 50;

                const newItem = { id: data.id, title: data.title, imageUrl: data.imageUrl, x, y, zIndex: nextZIndex++, scale: 1 };
                canvasItems.push(newItem);
                renderCanvasItem(newItem, true);
                document.querySelector('.canvas-placeholder')?.remove();
            } catch (err) { console.error(err); }
        });

        function renderCanvasItem(item, animate = false) {
            const el = document.createElement('div');
            el.className = 'canvas-item';
            el.dataset.id = item.id;
            if (animate) el.classList.add('anim-drop');

            el.style.left = `${item.x}px`;
            el.style.top = `${item.y}px`;
            el.style.zIndex = item.zIndex || 1;

            el.innerHTML = `
                <img src="${item.imageUrl}">
                <div class="canvas-controls-overlay">
                    <button class="ctrl-btn delete" title="Remove">&times;</button>
                    <button class="ctrl-btn front" title="Bring to Front">↑</button>
                </div>
            `;

            let isDragging = false;
            let startX, startY;

            el.onmousedown = (e) => {
                if (e.target.tagName === 'BUTTON') return;
                isDragging = true;
                startX = e.clientX - el.offsetLeft;
                startY = e.clientY - el.offsetTop;
                document.querySelectorAll('.canvas-item').forEach(i => i.classList.remove('selected'));
                el.classList.add('selected');
            };

            window.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                const newX = e.clientX - startX;
                const newY = e.clientY - startY;
                el.style.left = `${newX}px`;
                el.style.top = `${newY}px`;
                item.x = newX;
                item.y = newY;
            });

            window.addEventListener('mouseup', () => { if (isDragging) isDragging = false; });

            el.querySelector('.delete').onclick = () => {
                el.classList.add('anim-delete');
                setTimeout(() => el.remove(), 200);
                canvasItems = canvasItems.filter(i => i !== item);
            };
            el.querySelector('.front').onclick = () => {
                item.zIndex = nextZIndex++;
                el.style.zIndex = item.zIndex;
            };

            canvas.appendChild(el);
        }

        document.getElementById('btn-clear-canvas').onclick = () => {
            if (confirm("Clear canvas?")) {
                canvas.innerHTML = `<p class="canvas-placeholder">Drag items here</p>`;
                canvasItems = [];
            }
        };

        // --- AI OUTFIT GENERATOR (NEW) ---
        document.getElementById('btn-ai-combo').onclick = async () => {
            if (!authService.canUseFeature(FEATURES.AI_COMBOS)) { premiumModal.open(); return; }

            const btn = document.getElementById('btn-ai-combo');
            btn.innerHTML = `<div class="ai-loading-bar" style="width:20px;"></div>`;
            btn.disabled = true;

            try {
                // Send simplified list to AI to save tokens
                const available = [...closet, ...wishlist].map(i => ({ id: i.id, title: i.title, category: i.category }));

                const data = await aiService.getComboSuggestions(available);

                if (data.suggestions && data.suggestions.length > 0) {
                    const suggestion = data.suggestions[0]; // Take first suggestion

                    // Clear & Populate
                    canvas.innerHTML = '';
                    canvasItems = [];

                    // Smart Placement Grid
                    suggestion.itemIds.forEach((id, index) => {
                        const item = [...closet, ...wishlist].find(i => i.id === id);
                        if (item) {
                            const newItem = {
                                id: item.id,
                                title: item.title,
                                imageUrl: item.imageUrl,
                                x: 60 + (index * 140), // Stagger horizontally
                                y: 80 + (index % 2 * 60), // Stagger vertically
                                zIndex: index + 1,
                                scale: 1
                            };
                            canvasItems.push(newItem);
                            renderCanvasItem(newItem, true);
                        }
                    });

                    document.getElementById('editor-title').innerText = suggestion.name;
                    window.showToast("AI Outfit Generated!", "✨");
                } else {
                    alert("AI couldn't find a good combo.");
                }
            } catch (e) {
                console.error(e);
                alert("AI service busy.");
            } finally {
                btn.innerText = "✨ AI Suggest";
                btn.disabled = false;
            }
        };

        document.getElementById('btn-save-combo').onclick = async () => {
            if (canvasItems.length === 0) return alert("Canvas is empty.");
            const title = document.getElementById('editor-title').innerText.trim();
            const btn = document.getElementById('btn-save-combo');
            btn.textContent = "Saving...";
            try {
                const comboData = {
                    id: currentComboId,
                    title,
                    items: canvasItems,
                    previewImage: canvasItems[0].imageUrl
                };
                await firestoreService.saveCombo(uid, comboData);
                window.showToast("Saved!", "💾");
                ComboView.renderOverview(uid);
            } catch (e) { alert("Error saving."); } finally { btn.textContent = "💾 Save"; }
        };
    }
};