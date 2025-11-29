import { firestoreService } from '../services/FirestoreService.js';
import { authService } from '../services/AuthService.js';
import { apiCall } from '../config/api.js';
import { FEATURES } from '../config/limits.js';
import { premiumModal } from '../components/PremiumModal.js';
import { i18n } from '../services/LocalizationService.js';
import { aiService } from '../services/AIService.js'; // Import AI

export const ComboView = {
    async render() {
        const user = authService.currentUser;
        if (!user) return `<div class="empty-state"><h2>Login Required</h2></div>`;

        const closetItems = await firestoreService.getCloset(user.uid);
        const savedCombos = await firestoreService.getCombos(user.uid);

        const closetGridHtml = closetItems.length > 0
            ? `<div class="closet-grid-mini">${closetItems.map(item => `<div class="closet-item-mini" draggable="true" data-id="${item.id}" data-img="${item.imageUrl || 'https://placehold.co/100x100'}"><img src="${item.imageUrl || 'https://placehold.co/100x100'}" alt="${item.title}"></div>`).join('')}</div>`
            : `<div style="padding:16px; text-align:center; color:var(--text-secondary); font-size:0.9rem; border:1px dashed rgba(0,0,0,0.1); border-radius:12px;">${i18n.t('combos.empty_closet')}</div>`;

        return `
            <div class="view-container">
                <div class="view-header">
                    <h1>${i18n.t('combos.title')}</h1>
                    <div class="header-actions">
                        <button id="btn-ai-suggest" class="btn-magic" ${closetItems.length === 0 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>✨ AI</button>
                        <button id="btn-save-combo" class="btn-primary">${i18n.t('combos.save')}</button>
                    </div>
                </div>
                
                <div id="canvas-controls" class="glass-panel" style="display:none; position:fixed; bottom:20px; left:50%; transform:translateX(-50%); z-index:100; padding:8px 16px; align-items:center; gap:12px;">
                    <span style="font-size:0.8rem; font-weight:600;">${i18n.t('combos.selected_item')}</span>
                    <button class="btn-text" onclick="window.resizeItem(10)">+</button>
                    <button class="btn-text" onclick="window.resizeItem(-10)">-</button>
                    <button class="btn-text" onclick="window.deleteActiveItem()" style="color:red;">${i18n.t('combos.trash')}</button>
                </div>

                <div class="combo-layout">
                    <div class="combo-canvas" id="combo-canvas">
                        <div class="canvas-placeholder"><span style="font-size:2rem;">👕</span><br>${i18n.t('combos.drag_text')}</div>
                    </div>
                    <div class="combo-sidebar">
                        <div class="sidebar-section"><h3>${i18n.t('combos.closet_section')}</h3>${closetGridHtml}</div>
                        <div class="sidebar-section" style="margin-top: 32px;">
                            <h3>${i18n.t('combos.saved_section')}</h3>
                            <div class="saved-combos-list">
                                ${savedCombos.length > 0 ? savedCombos.map(combo => `<div class="saved-combo-card glass-panel" style="display:flex; justify-content:space-between;"><span onclick='window.loadCombo(${JSON.stringify(combo)})' style="flex:1;">${combo.title}</span><button class="btn-text" onclick="window.deleteCombo('${combo.id}')" style="color:red; font-size:1.2rem;">&times;</button></div>`).join('') : '<p style="font-size:0.8rem; color:var(--text-secondary);">No saved combos.</p>'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div id="ai-modal" class="modal-overlay">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header"><h2>${i18n.t('ai.suggestion')}</h2><button class="close-btn" id="close-ai-modal">&times;</button></div>
                    <div id="ai-results" class="ai-results-container"></div>
                </div>
            </div>
        `;
    },

    afterRender() {
        const canvas = document.getElementById('combo-canvas');
        if (!canvas) return;

        let activeItem = null;

        const setActiveItem = (img) => {
            if (activeItem) activeItem.style.border = 'none';
            activeItem = img;
            if (activeItem) {
                activeItem.style.border = '2px solid var(--accent-color)';
                document.getElementById('canvas-controls').style.display = 'flex';
            } else {
                document.getElementById('canvas-controls').style.display = 'none';
            }
        };

        window.resizeItem = (delta) => {
            if (activeItem) {
                const currentWidth = parseInt(activeItem.style.width || '100');
                activeItem.style.width = `${Math.max(50, currentWidth + delta)}px`;
            }
        };

        window.deleteActiveItem = () => {
            if (activeItem) { activeItem.remove(); setActiveItem(null); }
        };

        window.deleteCombo = async (id) => {
            if (confirm(i18n.t('common.confirm'))) {
                await firestoreService.deleteCombo(id);
                const app = document.getElementById('app');
                ComboView.render().then(html => { app.innerHTML = html; ComboView.afterRender(); });
            }
        };

        const draggables = document.querySelectorAll('.closet-item-mini');
        draggables.forEach(d => d.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', JSON.stringify({ id: d.dataset.id, img: d.dataset.img }))));

        canvas.addEventListener('dragover', (e) => { e.preventDefault(); canvas.classList.add('drag-over'); });
        canvas.addEventListener('dragleave', () => canvas.classList.remove('drag-over'));
        canvas.addEventListener('drop', (e) => {
            e.preventDefault(); canvas.classList.remove('drag-over');
            const placeholder = canvas.querySelector('.canvas-placeholder');
            if (placeholder) placeholder.remove();
            try {
                const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                this.addItemToCanvas(data.id, data.img, e.offsetX - 50, e.offsetY - 50);
            } catch (err) { console.error(err); }
        });

        canvas.addEventListener('click', (e) => { if (e.target === canvas) setActiveItem(null); });

        this.addItemToCanvas = (id, src, left, top, width = '100px') => {
            const img = document.createElement('img');
            img.src = src; img.className = 'canvas-item'; img.dataset.id = id;
            img.style.position = 'absolute'; img.style.left = `${left}px`; img.style.top = `${top}px`; img.style.width = width;
            img.addEventListener('mousedown', (e) => { e.stopPropagation(); setActiveItem(img); this.dragElement(e, img); });
            canvas.appendChild(img);
        };

        document.getElementById('btn-save-combo').addEventListener('click', async () => {
            const title = prompt(i18n.t('combos.save'));
            if (!title) return;
            const items = Array.from(canvas.querySelectorAll('.canvas-item')).map(img => ({ itemId: img.dataset.id, src: img.src, left: img.style.left, top: img.style.top, width: img.style.width }));
            if (items.length === 0) return alert("Empty");

            // AI Reaction: Stylish mood
            aiService.triggerReaction('create_combo', { title: title });

            await firestoreService.saveCombo(authService.currentUser.uid, { title, items });
            alert(i18n.t('common.success'));
            const app = document.getElementById('app');
            ComboView.render().then(html => { app.innerHTML = html; ComboView.afterRender(); });
        });

        window.loadCombo = (combo) => {
            canvas.innerHTML = '';
            combo.items.forEach(item => this.addItemToCanvas(item.itemId, item.src, parseFloat(item.left), parseFloat(item.top), item.width));
        };

        const aiBtn = document.getElementById('btn-ai-suggest');
        const aiModal = document.getElementById('ai-modal');
        const aiResults = document.getElementById('ai-results');
        document.getElementById('close-ai-modal').addEventListener('click', () => { aiModal.classList.remove('active'); setTimeout(() => aiModal.style.display = 'none', 300); });

        aiBtn.addEventListener('click', async () => {
            if (!authService.canUseFeature(FEATURES.AI_COMBO)) { premiumModal.open(); return; }
            aiModal.style.display = 'flex'; requestAnimationFrame(() => aiModal.classList.add('active'));
            aiResults.innerHTML = `<div class="loading-spinner">${i18n.t('common.loading')}</div>`;

            if (window.aiCompanion) window.aiCompanion.say("Let's style you up!", "dancing");

            try {
                const closetItems = await firestoreService.getCloset(authService.currentUser.uid);
                const data = await apiCall('/api/ai/combo-suggestions', 'POST', { closetItems });
                authService.trackFeatureUsage(FEATURES.AI_COMBO);

                if (data.combos) {
                    if (window.aiCompanion) window.aiCompanion.say("Try these looks!", "presenting");

                    aiResults.innerHTML = data.combos.map((combo, i) => `<div class="glass-panel" onclick="window.applyAiCombo(${i})" style="margin-bottom:10px; cursor:pointer;"><strong>${combo.name}</strong><br><small>${combo.description}</small></div>`).join('');
                    window.applyAiCombo = (idx) => {
                        const c = data.combos[idx];
                        canvas.innerHTML = '';
                        c.itemIds.forEach((id, k) => { const it = closetItems.find(x => x.id === id); if (it) this.addItemToCanvas(id, it.imageUrl, 50 + (k * 120), 50); });
                        document.getElementById('close-ai-modal').click();
                    };
                }
            } catch (e) {
                aiResults.innerHTML = i18n.t('ai.error');
                if (window.aiCompanion) window.aiCompanion.say("I need more clothes to work with.", "error");
            }
        });
    },

    dragElement(e, elmnt) {
        e.preventDefault();
        let pos1 = 0, pos2 = 0, pos3 = e.clientX, pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
        function elementDrag(e) { e.preventDefault(); pos1 = pos3 - e.clientX; pos2 = pos4 - e.clientY; pos3 = e.clientX; pos4 = e.clientY; elmnt.style.top = (elmnt.offsetTop - pos2) + "px"; elmnt.style.left = (elmnt.offsetLeft - pos1) + "px"; }
        function closeDragElement() { document.onmouseup = null; document.onmousemove = null; }
    }
};