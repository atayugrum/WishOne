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
                <h1>${i18n.t('combos.title')}</h1>
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
                
                <div class="combo-sidebar glass-panel" style="padding:16px;">
                    <h3 style="margin-bottom: 12px; font-size: 1rem;">${i18n.t('combos.closet_section')}</h3>
                    <div id="sidebar-content" class="closet-grid-mini" style="max-height: 60vh; overflow-y: auto;">
                        <div class="loading-spinner">${i18n.t('common.loading')}</div>
                    </div>
                </div>
            </div>

            <!-- Saved Combos Section -->
            <div style="margin-top: 40px;">
                <h3 style="margin-bottom: 16px;">${i18n.t('combos.saved_section') || 'Saved Combos'}</h3>
                <div id="saved-combos-grid" class="masonry-grid">
                    <!-- Saved combos injected here -->
                </div>
            </div>

            <!-- AI Suggestions Modal -->
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

        let closetItems = [];
        let currentCanvasItems = []; // Stores full item objects

        // --- 1. Load Data (Closet & Saved Combos) ---
        try {
            const [items, savedCombos] = await Promise.all([
                firestoreService.getCloset(user.uid),
                firestoreService.getCombos(user.uid)
            ]);
            closetItems = items;
            renderSidebar(closetItems);
            renderSavedCombos(savedCombos);
        } catch (e) {
            console.error(e);
            sidebarContent.innerHTML = `<p style="color:var(--text-secondary)">Error loading data.</p>`;
        }

        function renderSidebar(items) {
            if (items.length === 0) {
                sidebarContent.innerHTML = `<p style="font-size:0.8rem; color:var(--text-secondary);">${i18n.t('combos.empty_closet')}</p>`;
                return;
            }
            sidebarContent.innerHTML = items.map(item => `
                <div class="closet-item-mini" draggable="true" data-id="${item.id}" style="cursor: grab;">
                    <img src="${item.imageUrl}" style="width:100%; height:100%; object-fit:cover; pointer-events:none;">
                </div>
            `).join('');

            // Bind Drag Events
            document.querySelectorAll('.closet-item-mini').forEach(el => {
                el.addEventListener('dragstart', handleDragStart);
            });
        }

        function renderSavedCombos(combos) {
            if (combos.length === 0) {
                savedGrid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color:var(--text-tertiary);">No saved combos yet.</div>`;
                return;
            }

            savedGrid.innerHTML = combos.map(combo => `
                <div class="glass-panel card" style="padding: 16px; position:relative;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <h4 style="margin:0; font-size:1rem;">${combo.title}</h4>
                        <button class="btn-text" onclick="window.deleteCombo('${combo.id}')" style="color:#ff3b30; font-size:1.2rem;">&times;</button>
                    </div>
                    <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:4px; border-radius:12px; overflow:hidden;">
                        ${combo.previewImages.map(img => `<img src="${img}" style="width:100%; aspect-ratio:1; object-fit:cover;">`).join('')}
                    </div>
                </div>
            `).join('');
        }

        window.deleteCombo = async (id) => {
            if (confirm(i18n.t('common.confirm'))) {
                await firestoreService.deleteCombo(id);
                // Refresh list
                const combos = await firestoreService.getCombos(user.uid);
                renderSavedCombos(combos);
            }
        };

        // --- 2. Drag & Drop Handlers ---
        function handleDragStart(e) {
            const id = e.target.dataset.id;
            const item = closetItems.find(i => i.id === id);
            if (item) {
                e.dataTransfer.setData('text/plain', JSON.stringify(item));
                e.dataTransfer.effectAllowed = 'copy';
            }
        }

        canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            canvas.classList.add('drag-over');
        });

        canvas.addEventListener('dragleave', () => {
            canvas.classList.remove('drag-over');
        });

        canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            canvas.classList.remove('drag-over');
            try {
                const data = e.dataTransfer.getData('text/plain');
                if (!data) return;
                const item = JSON.parse(data);
                addToCanvas(item);
            } catch (err) {
                console.warn("Invalid drop data", err);
            }
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
            if (currentCanvasItems.length > 0) {
                placeholder.style.display = 'none';
            } else {
                placeholder.style.display = 'block';
            }

            canvasContainer.innerHTML = currentCanvasItems.map(item => `
                <div class="canvas-item" style="position:relative; width:100px; height:100px; cursor:default;">
                    <img src="${item.imageUrl}" style="width:100%; height:100%; object-fit:cover; border-radius:12px; box-shadow:0 4px 10px rgba(0,0,0,0.1);">
                    <button onclick="window.removeFromCanvas('${item.id}')" style="position:absolute; top:-8px; right:-8px; background:white; color:#ff3b30; border:1px solid #ff3b30; border-radius:50%; width:24px; height:24px; cursor:pointer; font-weight:bold; display:flex; align-items:center; justify-content:center;">&times;</button>
                </div>
            `).join('');
        }

        // --- 3. Actions ---

        // Save Combo
        document.getElementById('btn-save-combo').addEventListener('click', async () => {
            if (currentCanvasItems.length < 2) return alert("Add at least 2 items to make a combo.");

            const title = prompt("Name this outfit:", "My Vibe");
            if (!title) return;

            const btn = document.getElementById('btn-save-combo');
            btn.textContent = i18n.t('common.saving');
            btn.disabled = true;

            try {
                const comboData = {
                    title,
                    itemIds: currentCanvasItems.map(i => i.id),
                    previewImages: currentCanvasItems.map(i => i.imageUrl).slice(0, 4)
                };
                await firestoreService.saveCombo(user.uid, comboData);
                aiService.triggerReaction('create_combo', { title });

                alert(i18n.t('common.success'));

                // Clear canvas & Refresh Saved List
                currentCanvasItems = [];
                renderCanvas();
                const combos = await firestoreService.getCombos(user.uid);
                renderSavedCombos(combos);

            } catch (err) {
                console.error(err);
                alert(i18n.t('common.error'));
            } finally {
                btn.textContent = i18n.t('combos.save');
                btn.disabled = false;
            }
        });

        // AI Stylist
        document.getElementById('btn-ai-stylist').addEventListener('click', async () => {
            if (!authService.canUseFeature(FEATURES.AI_COMBO)) { premiumModal.open(); return; }
            if (closetItems.length < 2) return alert("Add more items to your closet first!");

            const modal = document.getElementById('stylist-modal');
            const results = document.getElementById('stylist-results');

            modal.style.display = 'flex';
            requestAnimationFrame(() => modal.classList.add('active'));

            results.innerHTML = `<div class="loading-spinner">${i18n.t('common.loading')}</div>`;
            if (window.aiCompanion) window.aiCompanion.say("Let me see what works...", "thinking");

            try {
                const data = await apiCall('/api/ai/combo-suggestions', 'POST', { closetItems });
                authService.trackFeatureUsage(FEATURES.AI_COMBO);

                if (data.combos && data.combos.length > 0) {
                    if (window.aiCompanion) window.aiCompanion.say("I love these looks!", "celebrating");

                    results.innerHTML = data.combos.map((combo, idx) => `
                        <div class="glass-panel" style="padding:16px; margin-bottom:12px; cursor:pointer; border:1px solid transparent; transition:0.2s;" 
                             onclick="window.applyAiCombo(${idx})">
                            <div style="font-weight:700; font-size:1.1rem; margin-bottom:4px; color:var(--text-primary);">${combo.name}</div>
                            <p style="font-size:0.9rem; color:var(--text-secondary); margin-bottom:8px;">${combo.description}</p>
                            <div style="display:flex; gap:8px;">
                                ${combo.itemIds.map(id => {
                        const item = closetItems.find(i => i.id === id);
                        return item ? `<img src="${item.imageUrl}" style="width:50px; height:50px; border-radius:8px; object-fit:cover; border:1px solid rgba(0,0,0,0.1);">` : '';
                    }).join('')}
                            </div>
                        </div>
                    `).join('');

                    // Helper to apply combo
                    window.applyAiCombo = (idx) => {
                        const combo = data.combos[idx];
                        currentCanvasItems = combo.itemIds.map(id => closetItems.find(i => i.id === id)).filter(Boolean);
                        renderCanvas();

                        modal.classList.remove('active');
                        setTimeout(() => modal.style.display = 'none', 300);

                        if (window.aiCompanion) window.aiCompanion.say("Try it on!", "magic");
                    };

                } else {
                    results.innerHTML = `<p style="text-align:center; color:var(--text-secondary);">I couldn't find a match this time. Try adding more items!</p>`;
                }
            } catch (error) {
                console.error(error);
                results.innerHTML = `<p style="color:#ff3b30; text-align:center;">${i18n.t('ai.error')}</p>`;
                if (window.aiCompanion) window.aiCompanion.say("I'm feeling a bit dizzy.", "error");
            }
        });
    }
};