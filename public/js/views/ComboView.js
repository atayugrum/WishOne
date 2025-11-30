import { authService } from '../services/AuthService.js';
import { firestoreService } from '../services/FirestoreService.js';
import { apiCall } from '../config/api.js';
import { FEATURES } from '../config/limits.js';
import { premiumModal } from '../components/PremiumModal.js';
import { i18n } from '../services/LocalizationService.js';

let availableItems = [];
let canvasItems = [];
let draggedItem = null;

export const ComboView = {
    render: async () => {
        return `
            <div class="view-header" style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <h1>${i18n.t('nav.combos')}</h1>
                    <p>Mix & Match your style.</p>
                </div>
                <div>
                    <button class="btn-magic" id="btn-ai-combo">✨ AI Suggest</button>
                    <button class="btn-primary" id="btn-save-combo">💾 Save</button>
                </div>
            </div>

            <div class="combo-workspace" style="display:flex; gap:20px; height: calc(100vh - 200px); min-height: 500px;">
                
                <!-- Sidebar: Items -->
                <div class="combo-sidebar glass-panel" style="width:250px; display:flex; flex-direction:column; padding:16px;">
                    <div class="auth-tabs compact-tabs" style="margin-bottom:12px;">
                        <div class="auth-tab active" id="tab-closet">Closet</div>
                        <div class="auth-tab" id="tab-wishlist">Wishlist</div>
                    </div>
                    <input type="text" id="combo-search" placeholder="Search items..." style="width:100%; margin-bottom:12px; padding:8px; border-radius:8px; border:1px solid rgba(0,0,0,0.1);">
                    
                    <div id="combo-items-list" style="flex:1; overflow-y:auto; display:grid; grid-template-columns:1fr 1fr; gap:8px; align-content:start;">
                        <div class="loading-spinner">Loading...</div>
                    </div>
                </div>

                <!-- Canvas -->
                <div class="combo-canvas-container" style="flex:1; position:relative;">
                    <div id="combo-canvas" class="glass-panel" style="width:100%; height:100%; position:relative; overflow:hidden; background:rgba(255,255,255,0.8);">
                        <p class="canvas-placeholder" style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); opacity:0.3; pointer-events:none;">
                            Drag items here
                        </p>
                    </div>
                    <button id="btn-clear-canvas" style="position:absolute; bottom:16px; right:16px; padding:8px 12px; border-radius:8px; background:rgba(0,0,0,0.1); border:none; cursor:pointer;">Clear</button>
                </div>

            </div>
            
            <div id="saved-combos-list" style="margin-top:32px;">
                <h3>Saved Combos</h3>
                <div id="combos-grid" class="masonry-grid" style="margin-top:16px;"></div>
            </div>
        `;
    },

    afterRender: async () => {
        const user = authService.currentUser;
        if (!user) return;

        // Load Data
        let closet = [];
        let wishlist = [];

        try {
            [closet, wishlist] = await Promise.all([
                firestoreService.getCloset(user.uid),
                firestoreService.getWishlist(user.uid, user.uid)
            ]);
        } catch (e) { console.error(e); }

        const renderSidebar = (source) => {
            const list = document.getElementById('combo-items-list');
            const items = source === 'closet' ? closet : wishlist;
            const search = document.getElementById('combo-search').value.toLowerCase();

            const filtered = items.filter(i => i.title.toLowerCase().includes(search));

            list.innerHTML = filtered.map(item => `
                <div class="combo-item-thumb" draggable="true" data-id="${item.id}" style="cursor:grab;">
                    <img src="${item.imageUrl}" style="width:100%; aspect-ratio:1; object-fit:cover; border-radius:8px; pointer-events:none;">
                    <div style="font-size:0.7rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:4px;">${item.title}</div>
                </div>
            `).join('');

            // Drag Events
            list.querySelectorAll('.combo-item-thumb').forEach(el => {
                el.addEventListener('dragstart', (e) => {
                    const id = el.dataset.id;
                    const itemData = items.find(i => i.id === id);
                    e.dataTransfer.setData('text/plain', JSON.stringify(itemData));
                    draggedItem = itemData; // Fallback
                });
            });
        };

        // Tabs
        const tabCloset = document.getElementById('tab-closet');
        const tabWish = document.getElementById('tab-wishlist');

        tabCloset.onclick = () => {
            tabCloset.classList.add('active');
            tabWish.classList.remove('active');
            renderSidebar('closet');
        };
        tabWish.onclick = () => {
            tabWish.classList.add('active');
            tabCloset.classList.remove('active');
            renderSidebar('wishlist');
        };

        document.getElementById('combo-search').addEventListener('input', () => {
            renderSidebar(tabCloset.classList.contains('active') ? 'closet' : 'wishlist');
        });

        renderSidebar('closet');

        // Canvas Logic
        const canvas = document.getElementById('combo-canvas');

        canvas.addEventListener('dragover', (e) => e.preventDefault());
        canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            try {
                const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left - 50; // Center offset
                const y = e.clientY - rect.top - 50;

                addItemToCanvas(data, x, y);
            } catch (err) { console.error(err); }
        });

        function addItemToCanvas(item, x, y) {
            const el = document.createElement('div');
            el.className = 'canvas-item';
            el.style.position = 'absolute';
            el.style.left = `${x}px`;
            el.style.top = `${y}px`;
            el.style.width = '100px';
            el.style.cursor = 'move';

            el.innerHTML = `
                <img src="${item.imageUrl}" style="width:100%; border-radius:8px; box-shadow:0 4px 10px rgba(0,0,0,0.1);">
                <button class="remove-canvas-item" style="position:absolute; top:-5px; right:-5px; background:red; color:white; border-radius:50%; width:20px; height:20px; border:none; cursor:pointer; font-size:12px;">&times;</button>
            `;

            // Canvas Drag Logic (Moving items inside canvas)
            let isDragging = false;
            let startX, startY;

            el.onmousedown = (e) => {
                if (e.target.tagName === 'BUTTON') return;
                isDragging = true;
                startX = e.clientX - el.offsetLeft;
                startY = e.clientY - el.offsetTop;
                el.style.zIndex = 100;
            };

            window.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                el.style.left = `${e.clientX - startX}px`;
                el.style.top = `${e.clientY - startY}px`;
            });

            window.addEventListener('mouseup', () => {
                isDragging = false;
                el.style.zIndex = '';
            });

            el.querySelector('.remove-canvas-item').onclick = () => {
                el.remove();
                canvasItems = canvasItems.filter(i => i.id !== item.id); // Simple filter, assumes unique items for now
            };

            canvas.appendChild(el);
            canvasItems.push({ id: item.id, ...item });
            document.querySelector('.canvas-placeholder').style.display = 'none';
        }

        document.getElementById('btn-clear-canvas').onclick = () => {
            canvas.innerHTML = `<p class="canvas-placeholder" style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); opacity:0.3; pointer-events:none;">Drag items here</p>`;
            canvasItems = [];
        };

        // Save
        document.getElementById('btn-save-combo').onclick = async () => {
            if (canvasItems.length === 0) return alert("Canvas is empty.");
            const title = prompt("Name this combo:");
            if (!title) return;

            try {
                await firestoreService.saveCombo(user.uid, {
                    title,
                    items: canvasItems.map(i => i.id),
                    previewImage: canvasItems[0].imageUrl // Simple preview
                });
                window.showToast("Combo saved!", "💾");
                ComboView.loadSavedCombos(user.uid);
                document.getElementById('btn-clear-canvas').click();
            } catch (e) { alert("Error saving."); }
        };

        // AI Suggest
        document.getElementById('btn-ai-combo').onclick = async () => {
            if (!authService.canUseFeature(FEATURES.AI_COMBOS)) { premiumModal.open(); return; }

            const btn = document.getElementById('btn-ai-combo');
            btn.textContent = "Thinking...";

            try {
                // Send simplified list to AI
                const available = [...closet, ...wishlist].map(i => ({ id: i.id, title: i.title, category: i.category }));

                const data = await apiCall('/api/ai/combo-suggestions', 'POST', { items: available });

                if (data.suggestions && data.suggestions.length > 0) {
                    const suggestion = data.suggestions[0]; // Take first
                    document.getElementById('btn-clear-canvas').click();

                    // Place items in a grid on canvas
                    suggestion.itemIds.forEach((id, index) => {
                        const item = [...closet, ...wishlist].find(i => i.id === id);
                        if (item) {
                            addItemToCanvas(item, 50 + (index * 110), 50);
                        }
                    });
                    alert(`AI Suggestion: ${suggestion.name}\n${suggestion.reason}`);
                } else {
                    alert("AI couldn't find a good combo.");
                }
            } catch (e) {
                console.error(e);
                alert("AI error.");
            } finally {
                btn.textContent = "✨ AI Suggest";
            }
        };

        ComboView.loadSavedCombos(user.uid);
    },

    loadSavedCombos: async (uid) => {
        const grid = document.getElementById('combos-grid');
        if (!grid) return;
        try {
            const combos = await firestoreService.getCombos(uid);
            grid.innerHTML = combos.map(c => `
                <div class="glass-panel card">
                    <div style="height:150px; background:url('${c.previewImage}') center/cover; border-radius:12px 12px 0 0;"></div>
                    <div style="padding:12px;">
                        <h4>${c.title}</h4>
                        <p style="font-size:0.8rem; color:#666;">${c.items.length} items</p>
                    </div>
                    <button class="btn-text" onclick="window.deleteCombo('${c.id}')" style="color:red; position:absolute; bottom:10px; right:10px;">&times;</button>
                </div>
            `).join('');

            window.deleteCombo = async (id) => {
                if (confirm("Delete this combo?")) {
                    await firestoreService.deleteCombo(id);
                    ComboView.loadSavedCombos(uid);
                }
            };
        } catch (e) { console.error(e); }
    }
};