import { authService } from '../services/AuthService.js';
import { firestoreService } from '../services/FirestoreService.js';
import { i18n } from '../services/LocalizationService.js';
import { apiCall } from '../config/api.js';
import { premiumModal } from '../components/PremiumModal.js';
import { FEATURES } from '../config/limits.js';
import { aiService } from '../services/AIService.js';

export const ComboView = {
    render: async () => {
        const user = authService.currentUser;
        if (!user) return `<div class="empty-state">Login required.</div>`;

        return `
            <div class="view-header" style="display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <h1>${i18n.t('combos.title')}</h1>
                    <div style="position:relative;">
                        <input type="file" id="combo-cover-upload" accept="image/*" style="display:none;">
                        <button class="icon-btn" id="btn-set-cover" title="Set Cover Image" style="background:rgba(0,0,0,0.05); border-radius:50%; width:40px; height:40px;">📷</button>
                        <img id="combo-cover-preview" style="width:40px; height:40px; border-radius:50%; position:absolute; top:0; left:0; object-fit:cover; display:none; border:2px solid var(--accent-color);">
                    </div>
                </div>
                <div style="display:flex; gap:12px;">
                    <button class="btn-magic" id="btn-ai-stylist">✨ Stylist</button>
                    <button class="btn-primary" id="btn-save-combo">${i18n.t('combos.save')}</button>
                </div>
            </div>
            
            <div class="combo-layout">
                <div class="combo-canvas glass-panel" id="combo-canvas">
                    <div class="canvas-placeholder">${i18n.t('combos.drag_text')}</div>
                    <div id="canvas-items-container" style="display:flex; flex-wrap:wrap; gap:16px; padding:20px; width:100%; height:100%; align-content: flex-start;"></div>
                </div>
                
                <div class="combo-sidebar glass-panel" style="padding:16px; display:flex; flex-direction:column; gap:20px;">
                    <div style="display:flex; gap:8px;">
                        <label class="btn-text" style="background:rgba(0,0,0,0.05); padding:8px 12px; border-radius:8px; cursor:pointer; font-size:0.8rem; flex:1; text-align:center;">
                            + Upload Image
                            <input type="file" id="sidebar-upload" accept="image/*" style="display:none;">
                        </label>
                    </div>

                    <div id="sidebar-content" style="max-height: 60vh; overflow-y: auto; padding-right:4px;">
                        <div class="loading-spinner">${i18n.t('common.loading')}</div>
                    </div>
                </div>
            </div>

            <div style="margin-top: 40px;">
                <h3 style="margin-bottom: 16px;">${i18n.t('combos.saved_section') || 'Saved Combos'}</h3>
                <div id="saved-combos-grid" class="masonry-grid"></div>
            </div>

            <div id="stylist-modal" class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>🤖 AI Stylist</h3>
                        <button class="close-btn" onclick="document.getElementById('stylist-modal').classList.remove('active')">&times;</button>
                    </div>
                    <div id="stylist-results"></div>
                </div>
            </div>
        `;
    },

    afterRender: async () => {
        const user = authService.currentUser;
        if (!user) return;

        const sidebarContent = document.getElementById('sidebar-content');
        const canvas = document.getElementById('combo-canvas');
        const canvasContainer = document.getElementById('canvas-items-container');
        const placeholder = canvas.querySelector('.canvas-placeholder');
        const savedGrid = document.getElementById('saved-combos-grid');

        // [NEW] Elements
        const sidebarUpload = document.getElementById('sidebar-upload');
        const coverUpload = document.getElementById('combo-cover-upload');
        const btnSetCover = document.getElementById('btn-set-cover');
        const coverPreview = document.getElementById('combo-cover-preview');

        let allItems = [];
        let currentCanvasItems = [];
        let editingComboId = null; // Track edit state
        let customCoverUrl = null; // Track custom cover

        // --- 1. Load Data ---
        try {
            const [closetItems, wishlistItems, savedCombos] = await Promise.all([
                firestoreService.getCloset(user.uid),
                firestoreService.getWishlist(user.uid, user.uid),
                firestoreService.getCombos(user.uid)
            ]);

            allItems = [...closetItems, ...wishlistItems];
            renderSidebar(closetItems, wishlistItems);
            renderSavedCombos(savedCombos);
        } catch (e) {
            console.error(e);
            sidebarContent.innerHTML = `<p style="color:var(--text-secondary)">Error loading items.</p>`;
        }

        // --- 2. Render Functions ---
        function renderSidebar(closet, wishlist) {
            let html = '';
            // Wishlist
            if (wishlist.length > 0) {
                html += `<h4 style="font-size:0.85rem; text-transform:uppercase; color:var(--text-secondary); margin-bottom:8px; letter-spacing:1px;">${i18n.t('nav.home') || 'Wishlist'}</h4>`;
                html += `<div class="closet-grid-mini" style="margin-bottom:20px;">` + wishlist.map(item => renderMiniItem(item)).join('') + `</div>`;
            }
            // Closet
            if (closet.length > 0) {
                html += `<h4 style="font-size:0.85rem; text-transform:uppercase; color:var(--text-secondary); margin-bottom:8px; letter-spacing:1px;">${i18n.t('nav.closet') || 'Closet'}</h4>`;
                html += `<div class="closet-grid-mini">` + closet.map(item => renderMiniItem(item)).join('') + `</div>`;
            }
            if (!html) html = `<p style="font-size:0.8rem;">No items found.</p>`;

            sidebarContent.innerHTML = html;

            // Re-bind Drag
            document.querySelectorAll('.closet-item-mini').forEach(el => el.addEventListener('dragstart', handleDragStart));
        }

        function renderMiniItem(item) {
            return `
                <div class="closet-item-mini" draggable="true" data-id="${item.id}" style="cursor: grab; position:relative;">
                    <img src="${item.imageUrl}" style="width:100%; height:100%; object-fit:cover; pointer-events:none;">
                    ${item.isOwned ? '<span style="position:absolute; bottom:2px; right:2px; font-size:0.7rem;">🧥</span>' : ''}
                </div>
            `;
        }

        function renderSavedCombos(combos) {
            if (combos.length === 0) {
                savedGrid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color:var(--text-tertiary);">No saved combos yet.</div>`;
                return;
            }

            savedGrid.innerHTML = combos.map(combo => {
                const cover = combo.coverImageUrl || (combo.previewImages && combo.previewImages[0]);
                return `
                <div class="glass-panel card" style="padding: 16px; position:relative;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <h4 style="margin:0; font-size:1rem;">${combo.title}</h4>
                        <div style="display:flex; gap:8px;">
                            <button class="btn-text" onclick="window.editCombo('${combo.id}')" style="color:var(--accent-color);">✎</button>
                            <button class="btn-text" onclick="window.deleteCombo('${combo.id}')" style="color:#ff3b30;">&times;</button>
                        </div>
                    </div>
                    <div style="height:150px; background:#f0f0f0; border-radius:12px; overflow:hidden;">
                        <img src="${cover}" style="width:100%; height:100%; object-fit:cover;">
                    </div>
                </div>
            `}).join('');
        }

        // --- 3. Interaction Logic ---

        // Sidebar Upload
        sidebarUpload.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    // Create temp item
                    const tempItem = {
                        id: `temp_${Date.now()}`,
                        title: 'Upload',
                        imageUrl: ev.target.result,
                        category: 'Upload'
                    };
                    // Add to allItems so drag works
                    allItems.push(tempItem);
                    // Force add to canvas
                    addToCanvas(tempItem);
                };
                reader.readAsDataURL(file);
            }
        };

        // Set Cover Logic
        btnSetCover.onclick = () => coverUpload.click();
        coverUpload.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    customCoverUrl = ev.target.result;
                    coverPreview.src = customCoverUrl;
                    coverPreview.style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        };

        // Edit Combo Logic
        window.editCombo = async (id) => {
            const combo = (await firestoreService.getCombos(user.uid)).find(c => c.id === id);
            if (!combo) return;

            editingComboId = combo.id;
            customCoverUrl = combo.coverImageUrl;

            // Restore Items
            currentCanvasItems = [];
            combo.itemIds.forEach(itemId => {
                const item = allItems.find(i => i.id === itemId);
                if (item) currentCanvasItems.push(item);
                // Note: Uploads without permanent ID might be lost in this simplified logic 
                // unless we saved them to storage. For now, we assume wishlist/closet items.
            });

            // Update UI
            renderCanvas();
            document.getElementById('btn-save-combo').textContent = "Update Combo";

            if (customCoverUrl) {
                coverPreview.src = customCoverUrl;
                coverPreview.style.display = 'block';
            }

            window.scrollTo({ top: 0, behavior: 'smooth' });
        };

        window.deleteCombo = async (id) => {
            if (confirm(i18n.t('common.confirm'))) {
                await firestoreService.deleteCombo(id);
                const combos = await firestoreService.getCombos(user.uid);
                renderSavedCombos(combos);
            }
        };

        // Drag & Drop
        function handleDragStart(e) {
            const id = e.target.dataset.id;
            const item = allItems.find(i => i.id === id);
            if (item) {
                e.dataTransfer.setData('text/plain', JSON.stringify(item));
                e.dataTransfer.effectAllowed = 'copy';
            }
        }

        canvas.addEventListener('dragover', (e) => { e.preventDefault(); canvas.classList.add('drag-over'); });
        canvas.addEventListener('dragleave', () => { canvas.classList.remove('drag-over'); });
        canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            canvas.classList.remove('drag-over');
            try {
                const data = e.dataTransfer.getData('text/plain');
                if (!data) return;
                const item = JSON.parse(data);
                addToCanvas(item);
            } catch (err) { console.warn("Invalid drop", err); }
        });

        function addToCanvas(item) {
            if (currentCanvasItems.find(i => i.id === item.id)) return;
            currentCanvasItems.push(item);
            renderCanvas();
        }

        window.removeFromCanvas = (id) => {
            currentCanvasItems = currentCanvasItems.filter(i => i.id !== id);
            renderCanvas();
        };

        function renderCanvas() {
            if (currentCanvasItems.length > 0) placeholder.style.display = 'none';
            else placeholder.style.display = 'block';

            canvasContainer.innerHTML = currentCanvasItems.map(item => `
                <div class="canvas-item" style="position:relative; width:100px; height:100px; cursor:default;">
                    <img src="${item.imageUrl}" style="width:100%; height:100%; object-fit:cover; border-radius:12px; box-shadow:0 4px 10px rgba(0,0,0,0.1);">
                    <button onclick="window.removeFromCanvas('${item.id}')" style="position:absolute; top:-8px; right:-8px; background:white; color:#ff3b30; border:1px solid #ff3b30; border-radius:50%; width:24px; height:24px; cursor:pointer; font-weight:bold; display:flex; align-items:center; justify-content:center;">&times;</button>
                </div>
            `).join('');
        }

        // Save Combo
        document.getElementById('btn-save-combo').addEventListener('click', async () => {
            if (currentCanvasItems.length < 2) return alert("Add at least 2 items.");

            const title = prompt("Name this outfit:", editingComboId ? "Updated Look" : "My Vibe");
            if (!title) return;

            const btn = document.getElementById('btn-save-combo');
            btn.textContent = i18n.t('common.saving');
            btn.disabled = true;

            try {
                // If editing, delete old one first (simple update logic)
                if (editingComboId) {
                    await firestoreService.deleteCombo(editingComboId);
                }

                const comboData = {
                    title,
                    itemIds: currentCanvasItems.map(i => i.id),
                    previewImages: currentCanvasItems.map(i => i.imageUrl).slice(0, 4),
                    coverImageUrl: customCoverUrl || null // Save custom cover
                };

                await firestoreService.saveCombo(user.uid, comboData);
                aiService.triggerReaction('create_combo', { title });

                alert(i18n.t('common.success'));

                // Reset
                currentCanvasItems = [];
                editingComboId = null;
                customCoverUrl = null;
                coverPreview.style.display = 'none';
                btn.textContent = i18n.t('combos.save');
                renderCanvas();

                const combos = await firestoreService.getCombos(user.uid);
                renderSavedCombos(combos);

            } catch (err) {
                console.error(err);
                alert(i18n.t('common.error'));
            } finally {
                btn.disabled = false;
            }
        });

        // Stylist Logic (Unchanged from previous robust version)
        document.getElementById('btn-ai-stylist').addEventListener('click', async () => {
            if (!authService.canUseFeature(FEATURES.AI_COMBO)) { premiumModal.open(); return; }
            if (allItems.length < 2) return alert("Add more items first!");

            const modal = document.getElementById('stylist-modal');
            const results = document.getElementById('stylist-results');
            modal.style.display = 'flex';
            requestAnimationFrame(() => modal.classList.add('active'));
            results.innerHTML = `<div class="loading-spinner">${i18n.t('common.loading')}</div>`;

            if (window.aiCompanion) window.aiCompanion.say("Let me see what works...", "thinking");

            try {
                const data = await apiCall('/api/ai/combo-suggestions', 'POST', { closetItems: allItems });
                authService.trackFeatureUsage(FEATURES.AI_COMBO);

                if (data.combos && data.combos.length > 0) {
                    if (window.aiCompanion) window.aiCompanion.say("I love these looks!", "celebrating");
                    results.innerHTML = data.combos.map((combo, idx) => `
                        <div class="glass-panel" style="padding:16px; margin-bottom:12px; cursor:pointer;" onclick="window.applyAiCombo(${idx})">
                            <div style="font-weight:700; font-size:1.1rem; margin-bottom:4px;">${combo.name}</div>
                            <p style="font-size:0.9rem; color:var(--text-secondary);">${combo.description}</p>
                            <div style="display:flex; gap:8px; margin-top:8px;">
                                ${combo.itemIds.map(id => {
                        const item = allItems.find(i => i.id === id);
                        return item ? `<img src="${item.imageUrl}" style="width:40px; height:40px; border-radius:8px; object-fit:cover;">` : '';
                    }).join('')}
                            </div>
                        </div>
                    `).join('');

                    window.applyAiCombo = (idx) => {
                        const combo = data.combos[idx];
                        currentCanvasItems = combo.itemIds.map(id => allItems.find(i => i.id === id)).filter(Boolean);
                        renderCanvas();
                        modal.classList.remove('active');
                        setTimeout(() => modal.style.display = 'none', 300);
                        if (window.aiCompanion) window.aiCompanion.say("Try it on!", "magic");
                    };
                } else {
                    results.innerHTML = `<p style="text-align:center;">No matches found.</p>`;
                }
            } catch (error) {
                results.innerHTML = `<p style="color:red; text-align:center;">${i18n.t('ai.error')}</p>`;
            }
        });
    }
};