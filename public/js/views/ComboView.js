import { firestoreService } from '../services/FirestoreService.js';
import { authService } from '../services/AuthService.js';

export const ComboView = {
    async render() {
        const user = authService.currentUser;
        if (!user) return `
            <div class="empty-state">
                <h2>Login Required</h2>
                <p>Please login to create combos.</p>
            </div>
        `;

        // Fetch owned items (closet)
        const closetItems = await firestoreService.getCloset(user.uid);
        // Fetch existing combos
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
                    <div class="combo-canvas" id="combo-canvas">
                        <div class="canvas-placeholder">Drag items here</div>
                    </div>

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
                                ${savedCombos.length > 0 ? savedCombos.map(combo => `
                                    <div class="saved-combo-card glass-panel" onclick='window.loadCombo(${JSON.stringify(combo)})'>
                                        <span>${combo.title}</span>
                                        <small>➔</small>
                                    </div>
                                `).join('') : '<p style="font-size:0.8rem; color:var(--text-secondary);">No saved combos.</p>'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- AI Suggestions Modal -->
            <div id="ai-modal" class="modal-overlay">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h2>AI Outfit Suggestions</h2>
                        <button class="close-btn" onclick="document.getElementById('ai-modal').classList.remove('active')">&times;</button>
                    </div>
                    <div id="ai-results" class="ai-results-container">
                        <!-- Results will be injected here -->
                        <div class="loading-spinner">Thinking...</div>
                    </div>
                </div>
            </div>
        `;
    },

    afterRender() {
        const canvas = document.getElementById('combo-canvas');
        if (!canvas) return; // Guard clause for logged-out state

        const draggables = document.querySelectorAll('.closet-item-mini');
        const saveBtn = document.getElementById('btn-save-combo');
        const aiBtn = document.getElementById('btn-ai-suggest');
        const aiModal = document.getElementById('ai-modal');
        const aiResults = document.getElementById('ai-results');

        // Drag & Drop Logic
        draggables.forEach(draggable => {
            draggable.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify({
                    id: draggable.dataset.id,
                    img: draggable.dataset.img
                }));
            });
        });

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

            // Remove placeholder
            const placeholder = canvas.querySelector('.canvas-placeholder');
            if (placeholder) placeholder.remove();

            try {
                const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                this.addItemToCanvas(data.id, data.img, e.offsetX - 50, e.offsetY - 50);
            } catch (err) {
                console.error("Drop error", err);
            }
        });

        // Helper to add item
        this.addItemToCanvas = (id, src, left, top, width = '100px') => {
            const img = document.createElement('img');
            img.src = src;
            img.className = 'canvas-item';
            img.dataset.id = id;
            img.style.position = 'absolute';
            img.style.left = `${left}px`;
            img.style.top = `${top}px`;
            img.style.width = width;

            this.makeDraggable(img);
            img.addEventListener('contextmenu', (ev) => {
                ev.preventDefault();
                if (confirm("Remove item?")) img.remove();
            });

            canvas.appendChild(img);
        };

        // Save Logic
        saveBtn.addEventListener('click', async () => {
            const title = prompt("Name your combo:");
            if (!title) return;

            const items = Array.from(canvas.querySelectorAll('.canvas-item')).map(img => ({
                itemId: img.dataset.id,
                src: img.src,
                left: img.style.left,
                top: img.style.top,
                width: img.style.width
            }));

            if (items.length === 0) return alert("Canvas is empty!");

            saveBtn.textContent = "Saving...";
            saveBtn.disabled = true;

            try {
                await firestoreService.saveCombo(authService.currentUser.uid, {
                    title,
                    items
                });
                alert("Combo saved!");
                window.location.reload();
            } catch (error) {
                console.error(error);
                alert("Failed to save.");
                saveBtn.textContent = "Save Combo";
                saveBtn.disabled = false;
            }
        });

        // AI Suggestion Logic
        aiBtn.addEventListener('click', async () => {
            console.log("AI Stylist button clicked"); // DEBUG

            // Free vs Premium Check
            if (!authService.isPremium) {
                const usage = parseInt(sessionStorage.getItem('ai_combo_usage') || '0');
                if (usage >= 1) {
                    alert("Unlimited AI outfit suggestions are available with Premium.");
                    return;
                }
                sessionStorage.setItem('ai_combo_usage', usage + 1);
            }

            aiModal.classList.add('active');
            aiResults.innerHTML = `<div style="text-align:center; padding:20px;">Thinking like a stylist... 👗</div>`;

            try {
                const closetItems = await firestoreService.getCloset(authService.currentUser.uid);
                console.log("Closet items found:", closetItems.length); // DEBUG

                if (closetItems.length === 0) {
                    aiResults.innerHTML = `<p style="text-align:center;">Your closet is empty! Add items to your closet first.</p>`;
                    return;
                }

                console.log("Sending request to AI endpoint..."); // DEBUG
                const response = await fetch('http://localhost:3001/api/ai/combo-suggestions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ closetItems })
                });

                console.log("AI Response status:", response.status); // DEBUG

                if (!response.ok) {
                    throw new Error(`Server Error: ${response.status}`);
                }

                const data = await response.json();
                console.log("AI Data received:", data); // DEBUG

                if (data.combos && data.combos.length > 0) {
                    aiResults.innerHTML = data.combos.map(combo => {
                        // Find item images
                        const thumbnails = combo.itemIds.map(id => {
                            const item = closetItems.find(i => i.id === id);
                            return item ? `<img src="${item.imageUrl || 'https://placehold.co/40x40'}" style="width:40px; height:40px; border-radius:4px; object-fit:cover;">` : '';
                        }).join('');

                        return `
                            <div class="ai-insight" style="cursor:pointer;" onclick='window.loadAiCombo(${JSON.stringify(combo)})'>
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                                    <strong>${combo.name}</strong>
                                    <div style="display:flex; gap:4px;">${thumbnails}</div>
                                </div>
                                <p style="font-size:0.9rem; color:var(--text-secondary); margin:0;">${combo.description}</p>
                                <small style="color:var(--accent-color); display:block; margin-top:4px;">Click to Load</small>
                            </div>
                        `;
                    }).join('');
                } else {
                    aiResults.innerHTML = `<p>${data.message || "No combos found. Try adding more items!"}</p>`;
                }

            } catch (error) {
                console.error("AI Stylist Error:", error);
                aiResults.innerHTML = `<p style="color:red; text-align:center;">AI Error: ${error.message}<br><small>Check console for details.</small></p>`;
            }
        });

        // Global Load Handlers
        window.loadCombo = (combo) => {
            if (!confirm(`Load combo "${combo.title}"? This will clear current canvas.`)) return;
            canvas.innerHTML = '';
            const placeholder = canvas.querySelector('.canvas-placeholder');
            if (placeholder) placeholder.remove();

            combo.items.forEach(item => {
                this.addItemToCanvas(item.itemId, item.src, parseFloat(item.left), parseFloat(item.top), item.width);
            });
        };

        window.loadAiCombo = async (combo) => {
            if (!confirm(`Load "${combo.name}"?`)) return;
            canvas.innerHTML = '';
            const placeholder = canvas.querySelector('.canvas-placeholder');
            if (placeholder) placeholder.remove();

            const closetItems = await firestoreService.getCloset(authService.currentUser.uid);

            combo.itemIds.forEach((id, index) => {
                const item = closetItems.find(i => i.id === id);
                if (item) {
                    // Stagger items on canvas
                    this.addItemToCanvas(id, item.imageUrl, 50 + (index * 120), 50);
                }
            });
            aiModal.classList.remove('active');
        };
    },

    makeDraggable(element) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        element.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            e = e || window.event;
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }
};