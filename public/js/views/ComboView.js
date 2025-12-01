/* public/js/views/ComboView.js */
import { authService } from '../services/AuthService.js';
import { firestoreService } from '../services/FirestoreService.js';
import { aiService } from '../services/AIService.js';
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
            <div id="combo-wrapper" style="width:100%; height:100%; display:flex; flex-direction:column;"></div>
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
            <div class="view-header" style="flex-shrink:0;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <h1>${i18n.t('nav.combos')}</h1>
                        <p>Your saved outfits & sets.</p>
                    </div>
                    <button class="btn-primary" id="btn-new-combo">+ New Combo</button>
                </div>
            </div>
            <div id="combos-grid" class="masonry-grid" style="margin-top:24px; flex:1; overflow-y:auto; padding-bottom:40px;">
                <div class="loading-spinner">${i18n.t('common.loading')}</div>
            </div>
        `;

        document.getElementById('btn-new-combo').onclick = () => ComboView.renderEditor(uid);

        try {
            const combos = await firestoreService.getCombos(uid);
            const grid = document.getElementById('combos-grid');

            if (combos.length === 0) {
                grid.innerHTML = `
                    <div class="glass-panel empty-state-card" style="grid-column:1/-1; margin:auto;">
                        <span class="empty-icon">🎨</span>
                        <h3>No combos yet</h3>
                        <p>Create your first outfit or set.</p>
                        <button class="btn-text" onclick="document.getElementById('btn-new-combo').click()">Start Creating</button>
                    </div>`;
                return;
            }

            grid.innerHTML = combos.map(c => `
                <div class="glass-panel card combo-card" data-id="${c.id}" style="cursor:pointer; position:relative;">
                    <div style="height:200px; background:url('${c.previewImage || 'https://placehold.co/400x300/png?text=Combo'}') center/cover; border-radius:12px 12px 0 0; background-color:#f5f5f7;"></div>
                    <div style="padding:16px;">
                        <h3 style="margin-bottom:4px;">${c.title}</h3>
                        <p style="font-size:0.8rem; color:var(--text-secondary);">${c.items ? c.items.length : 0} items</p>
                    </div>
                    <button class="card-action-btn delete-btn" style="top:10px; right:10px; opacity:0; transition:opacity 0.2s;" onclick="window.deleteCombo('${c.id}', event)">&times;</button>
                </div>
            `).join('');

            // Inject styles for hover effect on delete button
            const style = document.createElement('style');
            style.innerHTML = `.combo-card:hover .delete-btn { opacity: 1 !important; }`;
            grid.appendChild(style);

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
            <div class="view-header" style="flex-shrink:0; display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <button class="btn-text" id="btn-back-overview" style="font-size:1.5rem; line-height:1;">←</button>
                    <div>
                        <h1 id="editor-title" contenteditable="true" style="border-bottom:1px dashed transparent; cursor:text; transition:border-color 0.2s;">
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
                <div class="combo-sidebar glass-panel">
                    <div class="auth-tabs compact-tabs" style="margin-bottom:12px;">
                        <div class="auth-tab active" id="tab-closet">Closet</div>
                        <div class="auth-tab" id="tab-wishlist">Wishlist</div>
                    </div>
                    <input type="text" id="combo-search" placeholder="Search items..." class="sidebar-search">
                    <div id="combo-items-list" class="sidebar-grid">
                        <div class="loading-spinner">Loading...</div>
                    </div>
                </div>

                <div class="combo-canvas-container">
                    <div id="combo-canvas" class="combo-canvas">
                        ${canvasItems.length === 0 ? `<p class="canvas-placeholder">Drag items here or click +</p>` : ''}
                    </div>
                    <div class="canvas-controls">
                        <button id="btn-clear-canvas" class="btn-text glass-panel" style="padding:8px 16px; border-radius:20px; font-size:0.85rem;">Clear Canvas</button>
                    </div>
                </div>
            </div>
        `;

        // Focus title on click
        const titleInput = document.getElementById('editor-title');
        titleInput.onfocus = () => titleInput.style.borderBottomColor = '#ccc';
        titleInput.onblur = () => titleInput.style.borderBottomColor = 'transparent';

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

            if (filtered.length === 0) {
                list.innerHTML = `<p style="text-align:center; color:var(--text-tertiary); padding:20px;">No items found.</p>`;
                return;
            }

            list.innerHTML = filtered.map(item => `
                <div class="combo-item-thumb" draggable="true" data-id="${item.id}" title="${item.title}">
                    <img src="${item.imageUrl}" style="pointer-events:none;">
                    <div class="plus-overlay">+</div>
                </div>
            `).join('');

            // Bind Events (Drag & Click)
            list.querySelectorAll('.combo-item-thumb').forEach(el => {
                const id = el.dataset.id;
                const itemData = items.find(i => i.id === id);

                // Drag
                el.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', JSON.stringify(itemData));
                    draggedItem = itemData;
                    el.style.opacity = '0.5';
                });
                el.addEventListener('dragend', (e) => { el.style.opacity = '1'; });

                // Click (Fallback for Mobile/Easy use)
                el.addEventListener('click', () => {
                   addToCanvas(itemData);
                });
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

        // Initial Render
        if (canvasItems.length > 0) {
            canvasItems.forEach(item => {
                // Ensure legacy items have positions
                if (item.x === undefined) item.x = 100;
                if (item.y === undefined) item.y = 100;
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
                const x = e.clientX - rect.left - 50; // Center offset
                const y = e.clientY - rect.top - 50;

                addToCanvas(data, x, y);
            } catch (err) { console.error(err); }
        });

        function addToCanvas(data, x = null, y = null) {
            document.querySelector('.canvas-placeholder')?.remove();
            
            // Default center if no coords (e.g. via click)
            if (x === null) {
                x = canvas.clientWidth / 2 - 60;
                y = canvas.clientHeight / 2 - 60;
                // Slight stagger for multiple clicks
                x += (Math.random() * 40 - 20);
                y += (Math.random() * 40 - 20);
            }

            const newItem = { 
                id: data.id, 
                title: data.title, 
                imageUrl: data.imageUrl, 
                x: Math.max(0, x), 
                y: Math.max(0, y), 
                zIndex: nextZIndex++, 
                scale: 1 
            };
            
            canvasItems.push(newItem);
            renderCanvasItem(newItem, true);
        }

        function renderCanvasItem(item, animate = false) {
            const el = document.createElement('div');
            el.className = 'canvas-item glass-panel';
            if (animate) el.classList.add('anim-drop');

            // Apply State
            el.style.left = `${item.x}px`;
            el.style.top = `${item.y}px`;
            el.style.zIndex = item.zIndex || 1;

            el.innerHTML = `
                <img src="${item.imageUrl}" draggable="false">
                <div class="canvas-controls-overlay">
                    <button class="ctrl-btn front" title="Bring to Front">↑</button>
                    <button class="ctrl-btn delete" title="Remove">&times;</button>
                </div>
            `;

            // Dragging Logic
            let isDragging = false;
            let startX, startY;

            el.onmousedown = (e) => {
                if (e.target.tagName === 'BUTTON') return;
                isDragging = true;
                
                // Calculate offset from top-left of element
                const rect = el.getBoundingClientRect();
                startX = e.clientX - rect.left;
                startY = e.clientY - rect.top;

                // Bring to front temporarily while dragging
                document.querySelectorAll('.canvas-item').forEach(i => i.classList.remove('selected'));
                el.classList.add('selected');
            };

            window.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                
                const canvasRect = canvas.getBoundingClientRect();
                let newX = e.clientX - canvasRect.left - startX;
                let newY = e.clientY - canvasRect.top - startY;

                // Simple boundaries
                newX = Math.max(-50, Math.min(newX, canvas.clientWidth - 50));
                newY = Math.max(-50, Math.min(newY, canvas.clientHeight - 50));

                el.style.left = `${newX}px`;
                el.style.top = `${newY}px`;
                item.x = newX;
                item.y = newY;
            });

            window.addEventListener('mouseup', () => { if (isDragging) isDragging = false; });

            // Controls
            el.querySelector('.delete').onclick = () => {
                el.style.transform = 'scale(0.8)';
                el.style.opacity = '0';
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
            if (canvasItems.length > 0 && confirm("Clear canvas?")) {
                canvas.innerHTML = `<p class="canvas-placeholder">Drag items here or click +</p>`;
                canvasItems = [];
            }
        };

        // --- AI OUTFIT GENERATOR ---
        document.getElementById('btn-ai-combo').onclick = async () => {
            if (!authService.canUseFeature(FEATURES.AI_COMBOS)) { premiumModal.open(); return; }

            const btn = document.getElementById('btn-ai-combo');
            const originalText = btn.innerHTML;
            btn.innerHTML = `Thinking...`;
            btn.disabled = true;

            try {
                // Prepare context
                const available = [...closet, ...wishlist].map(i => ({ id: i.id, title: i.title, category: i.category }));
                
                const data = await aiService.getComboSuggestions(available);

                if (data.combos && data.combos.length > 0) {
                    const suggestion = data.combos[0]; // Take first suggestion

                    // Clear & Populate
                    canvas.innerHTML = '';
                    canvasItems = [];

                    // Layout Algorithm
                    suggestion.itemIds.forEach((id, index) => {
                        const item = [...closet, ...wishlist].find(i => i.id === id);
                        if (item) {
                            addToCanvas(item, 100 + (index * 120), 100 + (index % 2 * 50));
                        }
                    });

                    if (suggestion.name) document.getElementById('editor-title').innerText = suggestion.name;
                    window.showToast("Outfit Generated! ✨", "AI");
                } else {
                    alert("AI couldn't find a matching outfit.");
                }
            } catch (e) {
                console.error(e);
                alert("AI service unavailable.");
            } finally {
                btn.innerHTML = originalText;
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
                    // Use the first item image as preview for now
                    previewImage: canvasItems[0].imageUrl
                };
                await firestoreService.saveCombo(uid, comboData);
                window.showToast("Saved!", "💾");
                ComboView.renderOverview(uid);
            } catch (e) { alert("Error saving."); } finally { btn.textContent = "💾 Save"; }
        };
    }
};