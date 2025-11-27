import { firestoreService } from '../services/FirestoreService.js';
import { authService } from '../services/AuthService.js';
import { apiCall } from '../config/api.js';
import { FEATURES } from '../config/limits.js';
import { premiumModal } from '../components/PremiumModal.js';

export const ComboView = {
    async render() {
        const user = authService.currentUser;
        if (!user) return `<div class="empty-state"><h2>Login Required</h2></div>`;

        const closetItems = await firestoreService.getCloset(user.uid);
        const savedCombos = await firestoreService.getCombos(user.uid);

        return `
            <div class="view-container">
                <div class="view-header">
                    <h1>Combo Builder</h1>
                    <div class="header-actions">
                        <button id="btn-ai-suggest" class="btn-magic">✨ AI Stylist</button>
                        <button id="btn-save-combo" class="btn-primary">Save Combo</button>
                    </div>
                </div>
                <div class="combo-layout">
                    <div class="combo-canvas" id="combo-canvas"><div class="canvas-placeholder">Drag items here</div></div>
                    <div class="combo-sidebar">
                        <div class="sidebar-section">
                            <h3>Your Closet</h3>
                            <div class="closet-grid-mini">
                                ${closetItems.map(item => `
                                    <div class="closet-item-mini" draggable="true" data-id="${item.id}" data-img="${item.imageUrl || 'https://placehold.co/100x100'}">
                                        <img src="${item.imageUrl || 'https://placehold.co/100x100'}" alt="${item.title}">
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        <div class="sidebar-section" style="margin-top: 32px;">
                            <h3>Saved Combos</h3>
                            <div class="saved-combos-list">
                                ${savedCombos.length > 0 ? savedCombos.map(combo => `<div class="saved-combo-card glass-panel" onclick='window.loadCombo(${JSON.stringify(combo)})'><span>${combo.title}</span><small>➔</small></div>`).join('') : '<p style="font-size:0.8rem; color:var(--text-secondary);">No saved combos.</p>'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div id="ai-modal" class="modal-overlay">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header"><h2>AI Outfit Suggestions</h2><button class="close-btn" id="close-ai-modal">&times;</button></div>
                    <div id="ai-results" class="ai-results-container"></div>
                </div>
            </div>
        `;
    },

    afterRender() {
        const canvas = document.getElementById('combo-canvas');
        if (!canvas) return;

        const draggables = document.querySelectorAll('.closet-item-mini');
        const saveBtn = document.getElementById('btn-save-combo');
        const aiBtn = document.getElementById('btn-ai-suggest');
        const aiModal = document.getElementById('ai-modal');
        const aiResults = document.getElementById('ai-results');
        const closeAiBtn = document.getElementById('close-ai-modal');

        draggables.forEach(draggable => {
            draggable.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', JSON.stringify({ id: draggable.dataset.id, img: draggable.dataset.img })));
        });
        canvas.addEventListener('dragover', (e) => { e.preventDefault(); canvas.classList.add('drag-over'); });
        canvas.addEventListener('dragleave', () => canvas.classList.remove('drag-over'));
        canvas.addEventListener('drop', (e) => {
            e.preventDefault(); canvas.classList.remove('drag-over');
            const placeholder = canvas.querySelector('.canvas-placeholder');
            if (placeholder) placeholder.remove();
            try {
                const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                this.addItemToCanvas(data.id, data.img, e.offsetX - 50, e.offsetY - 50);
            } catch (err) { console.error("Drop error", err); }
        });

        this.addItemToCanvas = (id, src, left, top, width = '100px') => {
            const img = document.createElement('img');
            img.src = src; img.className = 'canvas-item'; img.dataset.id = id;
            img.style.position = 'absolute'; img.style.left = `${left}px`; img.style.top = `${top}px`; img.style.width = width;
            this.makeDraggable(img);
            img.addEventListener('contextmenu', (ev) => { ev.preventDefault(); if (confirm("Remove item?")) img.remove(); });
            canvas.appendChild(img);
        };

        saveBtn.addEventListener('click', async () => {
            const title = prompt("Name your combo:");
            if (!title) return;
            const items = Array.from(canvas.querySelectorAll('.canvas-item')).map(img => ({ itemId: img.dataset.id, src: img.src, left: img.style.left, top: img.style.top, width: img.style.width }));
            if (items.length === 0) return alert("Canvas is empty!");
            saveBtn.textContent = "Saving..."; saveBtn.disabled = true;
            try {
                await firestoreService.saveCombo(authService.currentUser.uid, { title, items });
                alert("Combo saved!"); window.location.reload();
            } catch (error) { alert("Failed to save."); saveBtn.textContent = "Save Combo"; saveBtn.disabled = false; }
        });

        const closeAiModal = () => { aiModal.classList.remove('active'); setTimeout(() => aiModal.style.display = 'none', 300); };
        closeAiBtn.addEventListener('click', closeAiModal);

        aiBtn.addEventListener('click', async () => {
            if (!authService.canUseFeature(FEATURES.AI_COMBO)) {
                premiumModal.open();
                return;
            }

            aiModal.style.display = 'flex';
            requestAnimationFrame(() => aiModal.classList.add('active'));
            aiResults.innerHTML = `<div class="loading-spinner">Thinking like a stylist... 👗</div>`;

            try {
                const closetItems = await firestoreService.getCloset(authService.currentUser.uid);
                if (closetItems.length === 0) { aiResults.innerHTML = `<p style="text-align:center;">Empty closet!</p>`; return; }

                const data = await apiCall('/api/ai/combo-suggestions', 'POST', { closetItems });

                authService.trackFeatureUsage(FEATURES.AI_COMBO);

                if (data.combos && data.combos.length > 0) {
                    aiResults.innerHTML = data.combos.map((combo, index) => {
                        const thumbnails = combo.itemIds.map(id => {
                            const item = closetItems.find(i => i.id === id);
                            return item ? `<img src="${item.imageUrl}" style="width:40px; height:40px; border-radius:4px; object-fit:cover;">` : '';
                        }).join('');
                        return `<div class="ai-insight suggestion-card" data-index="${index}" style="cursor:pointer;"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;"><strong>${combo.name}</strong><div style="display:flex; gap:4px;">${thumbnails}</div></div><p style="font-size:0.9rem; color:var(--text-secondary); margin:0;">${combo.description}</p></div>`;
                    }).join('');

                    const cards = aiResults.querySelectorAll('.suggestion-card');
                    cards.forEach(card => {
                        card.addEventListener('click', () => {
                            const idx = card.getAttribute('data-index');
                            const combo = data.combos[idx];
                            canvas.innerHTML = '';
                            const placeholder = canvas.querySelector('.canvas-placeholder');
                            if (placeholder) placeholder.remove();
                            combo.itemIds.forEach((id, i) => {
                                const item = closetItems.find(it => it.id === id);
                                if (item) this.addItemToCanvas(id, item.imageUrl, 50 + (i * 120), 50);
                            });
                            closeAiModal();
                        });
                    });
                } else {
                    aiResults.innerHTML = `<p>${data.message || "No combos found."}</p>`;
                }
            } catch (error) {
                alert(`AI Failed: ${error.message}`);
            }
        });

        window.loadCombo = (combo) => {
            if (!confirm(`Load combo "${combo.title}"?`)) return;
            canvas.innerHTML = '';
            combo.items.forEach(item => {
                this.addItemToCanvas(item.itemId, item.src, parseFloat(item.left), parseFloat(item.top), item.width);
            });
        };
    },

    makeDraggable(element) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        element.onmousedown = dragMouseDown;
        function dragMouseDown(e) { e = e || window.event; e.preventDefault(); pos3 = e.clientX; pos4 = e.clientY; document.onmouseup = closeDragElement; document.onmousemove = elementDrag; }
        function elementDrag(e) { e = e || window.event; e.preventDefault(); pos1 = pos3 - e.clientX; pos2 = pos4 - e.clientY; pos3 = e.clientX; pos4 = e.clientY; element.style.top = (element.offsetTop - pos2) + "px"; element.style.left = (element.offsetLeft - pos1) + "px"; }
        function closeDragElement() { document.onmouseup = null; document.onmousemove = null; }
    }
};