// js/components/AddItemModal.js
import { firestoreService } from '../services/FirestoreService.js';
import { authService } from '../services/AuthService.js';
import { CATEGORIES } from '../config/categories.js';

export class AddItemModal {
    constructor(onItemSaved) {
        this.onItemSaved = onItemSaved;
        this.overlay = null;
        this.selectedCategory = null;
        this.selectedSubcategory = null;
        this.editingId = null;
        this.render();
    }

    render() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'modal-overlay';

        const categoryGridHtml = Object.keys(CATEGORIES).map(key => {
            const cat = CATEGORIES[key];
            return `
                <div class="cat-pill" data-cat="${key}" onclick="window.selectCategory('${key}')">
                    <span class="cat-icon">${cat.icon}</span>
                    <span class="cat-name">${key}</span>
                </div>
            `;
        }).join('');

        this.overlay.innerHTML = `
            <div class="glass-panel modal-content">
                <div class="modal-header">
                    <h2 id="modal-title">New Wish</h2>
                    <button class="close-btn">&times;</button>
                </div>
                
                <form id="add-item-form">
                    <div class="form-group">
                        <label>What is it?</label>
                        <div style="display: flex; gap: 8px;">
                            <input type="text" name="title" id="input-title" placeholder="e.g. Vintage Lamp" required autocomplete="off" style="flex: 1;">
                            <button type="button" id="btn-magic-add" class="btn-magic" title="Auto-fill from URL">✨ Magic</button>
                        </div>
                    </div>

                    <div id="magic-url-container" style="display:none; margin-bottom: 16px;">
                        <div class="form-group">
                            <label>Product URL</label>
                            <div style="display: flex; gap: 8px;">
                                <input type="url" id="magic-url-input" placeholder="https://..." style="flex: 1;">
                                <button type="button" id="btn-fetch-magic" class="btn-primary">Fetch</button>
                            </div>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group" style="flex: 2;">
                            <label>Price</label>
                            <input type="number" name="price" id="input-price" placeholder="0" required step="0.01">
                        </div>
                        <div class="form-group" style="flex: 1;">
                            <label>Currency</label>
                            <select name="currency" id="input-currency">
                                <option value="TRY">TRY (₺)</option>
                                <option value="EUR">EUR (€)</option>
                                <option value="USD">USD ($)</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Category</label>
                        <div class="category-grid">
                            ${categoryGridHtml}
                        </div>
                        <input type="hidden" name="category" id="hidden-category" required>
                    </div>

                    <div class="form-group" id="subcategory-container" style="display:none;">
                        <label>Subcategory</label>
                        <div class="subcategory-scroll" id="subcategory-list"></div>
                        <input type="hidden" name="subcategory" id="hidden-subcategory">
                    </div>

                    <div class="form-group">
                        <label>Priority</label>
                        
                        <div id="ai-insight-box" class="ai-insight glass-panel" style="display:none;">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <span style="font-size:1.2rem;">🤖</span>
                                <div>
                                    <strong style="font-size:0.8rem; display:block; color:var(--accent-color);">AI Suggestion</strong>
                                    <span id="ai-insight-text" style="font-size:0.8rem; color:var(--text-secondary);"></span>
                                </div>
                                <button type="button" onclick="document.getElementById('ai-insight-box').style.display='none'" style="margin-left:auto; background:none; border:none; cursor:pointer; font-size:1.2rem;">&times;</button>
                            </div>
                        </div>

                        <div class="priority-segmented-control">
                            <label><input type="radio" name="priority" value="Low"><span>Low</span></label>
                            <label><input type="radio" name="priority" value="Medium" checked><span>Med</span></label>
                            <label><input type="radio" name="priority" value="High"><span>High</span></label>
                            <label><input type="radio" name="priority" value="Must-have"><span>Must Have</span></label>
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Target Date (Optional)</label>
                        <input type="date" name="targetDate" id="input-date" style="width: 100%;">
                    </div>

                    <div class="form-group">
                        <label>Image URL</label>
                        <input type="url" id="img-input" name="imageUrl" placeholder="https://..." >
                        <div id="img-preview" style="width: 100%; height: 150px; margin-top: 10px; border-radius: 12px; background: #f0f0f0; background-size: cover; background-position: center; display: none;"></div>
                    </div>

                    <div class="modal-actions">
                        <button type="button" class="btn-text close-trigger">Cancel</button>
                        <button type="submit" class="btn-primary" id="btn-submit-wish">Add to Wishlist</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(this.overlay);
        this.bindEvents();
    }

    bindEvents() {
        const form = this.overlay.querySelector('#add-item-form');
        const imgInput = this.overlay.querySelector('#img-input');
        const imgPreview = this.overlay.querySelector('#img-preview');
        const btnMagicAdd = this.overlay.querySelector('#btn-magic-add');
        const magicContainer = this.overlay.querySelector('#magic-url-container');
        const btnFetchMagic = this.overlay.querySelector('#btn-fetch-magic');
        const magicInput = this.overlay.querySelector('#magic-url-input');
        const aiBox = this.overlay.querySelector('#ai-insight-box');
        const aiText = this.overlay.querySelector('#ai-insight-text');

        btnMagicAdd.addEventListener('click', () => {
            magicContainer.style.display = magicContainer.style.display === 'none' ? 'block' : 'none';
            if (magicContainer.style.display === 'block') magicInput.focus();
        });

        // FETCH LOGIC
        btnFetchMagic.addEventListener('click', async () => {
            const url = magicInput.value.trim();
            if (!url) return alert("Please enter a URL.");

            try {
                btnFetchMagic.textContent = "✨...";
                btnFetchMagic.disabled = true;
                aiBox.style.display = 'none'; // Hide previous insight

                const { apiCall } = await import('../config/api.js');
                const metaData = await apiCall('/api/product/metadata', 'POST', { url });

                if (metaData.error) throw new Error(metaData.error);

                // Auto-fill
                if (metaData.title) this.overlay.querySelector('#input-title').value = metaData.title;

                if (metaData.imageUrl) {
                    imgInput.value = metaData.imageUrl;
                    imgInput.dispatchEvent(new Event('input'));
                }

                if (metaData.price !== null) {
                    const cleanPrice = Number(metaData.price);
                    if (!isNaN(cleanPrice)) {
                        this.overlay.querySelector('#input-price').value = cleanPrice;
                    }
                }

                if (metaData.currency) this.overlay.querySelector('#input-currency').value = metaData.currency;

                // Priority Recommendation Popup
                if (metaData.priorityLevel) {
                    const map = {
                        'LOW': 'Low',
                        'MEDIUM': 'Medium',
                        'HIGH': 'High',
                        'MUST_HAVE': 'Must-have'
                    };
                    const val = map[metaData.priorityLevel] || 'Medium';

                    const radio = this.overlay.querySelector(`input[name="priority"][value="${val}"]`);
                    if (radio) radio.checked = true;

                    if (metaData.reason) {
                        const label = metaData.priorityLabel || val;
                        aiText.innerHTML = `<strong style="color:var(--accent-color)">${label}:</strong> ${metaData.reason}`;
                        aiBox.style.display = 'block';
                    }
                }

                // Category & Subcategory Selection
                if (metaData.category) {
                    const catKey = Object.keys(CATEGORIES).find(k => k.toLowerCase() === metaData.category.toLowerCase()) || 'Other';

                    window.selectCategory(catKey);

                    if (metaData.subcategory && CATEGORIES[catKey]?.subcategories) {
                        const targetSub = metaData.subcategory;
                        const exactSub = CATEGORIES[catKey].subcategories.find(s => s.toLowerCase() === targetSub.toLowerCase());

                        if (exactSub) {
                            window.selectSubcategory(exactSub);
                        }
                    }
                }

                magicContainer.style.display = 'none';

            } catch (error) {
                alert("Could not fetch details. Please fill manually.");
                console.error("Magic Add Failed:", error);
            } finally {
                btnFetchMagic.textContent = "Fetch";
                btnFetchMagic.disabled = false;
            }
        });

        // Global Handlers
        window.selectCategory = (key) => {
            this.selectedCategory = key;
            this.selectedSubcategory = null;
            const pills = this.overlay.querySelectorAll('.cat-pill');
            pills.forEach(p => {
                if (p.dataset.cat === key) p.classList.add('selected');
                else p.classList.remove('selected');
            });
            this.overlay.querySelector('#hidden-category').value = key;
            this.renderSubcategories(key);
        };

        window.selectSubcategory = (sub) => {
            this.selectedSubcategory = sub;
            this.overlay.querySelector('#hidden-subcategory').value = sub;
            const chips = this.overlay.querySelectorAll('.sub-chip');
            chips.forEach(c => {
                if (c.textContent.trim() === sub) c.classList.add('selected');
                else c.classList.remove('selected');
            });
        };

        const closeBtns = this.overlay.querySelectorAll('.close-btn, .close-trigger');
        closeBtns.forEach(btn => btn.addEventListener('click', () => this.close()));

        imgInput.addEventListener('input', () => {
            const url = imgInput.value;
            if (url) {
                imgPreview.style.display = 'block';
                imgPreview.style.backgroundImage = `url('${url}')`;
            } else {
                imgPreview.style.display = 'none';
            }
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const user = authService.currentUser;
            if (!user) return alert("Login required");

            const btn = form.querySelector('button[type="submit"]');
            btn.textContent = "Saving...";
            btn.disabled = true;

            const formData = new FormData(form);
            const currentPrice = parseFloat(formData.get('price')) || 0;
            const urlValue = document.getElementById('magic-url-input').value.trim() || null;
            let sourceSite = null;
            if (urlValue) { try { sourceSite = new URL(urlValue).hostname.replace('www.', ''); } catch (e) { } }

            const itemData = {
                title: formData.get('title'),
                price: currentPrice,
                currency: formData.get('currency'),
                category: formData.get('category'),
                subcategory: formData.get('subcategory') || null,
                priority: formData.get('priority'),
                targetDate: formData.get('targetDate') || null,
                imageUrl: formData.get('imageUrl') || null,
                url: urlValue,
                sourceSite: sourceSite
            };

            try {
                if (this.editingId) {
                    await firestoreService.updateItem(this.editingId, {
                        ...itemData,
                        lastPrice: currentPrice,
                        priceLastCheckedAt: new Date().toISOString()
                    });
                } else {
                    itemData.ownerId = user.uid;
                    itemData.originalPrice = currentPrice;
                    itemData.lastPrice = currentPrice;
                    itemData.priceLastCheckedAt = new Date().toISOString();
                    itemData.onSale = false;
                    await firestoreService.addItem(itemData);

                    import('../services/AIService.js').then(({ aiService }) => {
                        const reaction = aiService.getLocalReaction(itemData);
                        if (window.aiCompanion) window.aiCompanion.say(reaction);
                    });
                }
                this.close();
                form.reset();
                this.resetSelection();
                if (this.onItemSaved) this.onItemSaved();
            } catch (error) {
                console.error("Save Error:", error);
                alert("Failed to save.");
            } finally {
                btn.textContent = "Add to Wishlist";
                btn.disabled = false;
            }
        });
    }

    renderSubcategories(key) {
        const container = this.overlay.querySelector('#subcategory-container');
        const list = this.overlay.querySelector('#subcategory-list');
        const data = CATEGORIES[key];
        if (!data || !data.subcategories) {
            container.style.display = 'none';
            return;
        }
        container.style.display = 'block';
        list.innerHTML = data.subcategories.map(sub => `
            <div class="sub-chip" onclick="window.selectSubcategory('${sub}')">
                ${sub}
            </div>
        `).join('');
    }

    resetSelection() {
        this.selectedCategory = null;
        this.selectedSubcategory = null;
        this.editingId = null;
        this.overlay.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
        this.overlay.querySelector('#subcategory-container').style.display = 'none';
        this.overlay.querySelector('#img-preview').style.display = 'none';
        this.overlay.querySelector('#magic-url-container').style.display = 'none';
        this.overlay.querySelector('#ai-insight-box').style.display = 'none';
    }

    open(itemToEdit = null) {
        const form = this.overlay.querySelector('#add-item-form');
        const modalTitle = this.overlay.querySelector('#modal-title');
        const submitBtn = this.overlay.querySelector('#btn-submit-wish');
        const magicInput = this.overlay.querySelector('#magic-url-input');
        const aiBox = this.overlay.querySelector('#ai-insight-box');

        aiBox.style.display = 'none';

        if (itemToEdit) {
            this.editingId = itemToEdit.id;
            modalTitle.textContent = "Edit Wish";
            submitBtn.textContent = "Save Changes";
            this.overlay.querySelector('#input-title').value = itemToEdit.title;
            this.overlay.querySelector('#input-price').value = itemToEdit.price;
            this.overlay.querySelector('#input-currency').value = itemToEdit.currency;
            this.overlay.querySelector('#input-date').value = itemToEdit.targetDate || '';

            if (itemToEdit.url) {
                magicInput.value = itemToEdit.url;
                this.overlay.querySelector('#magic-url-container').style.display = 'block';
            } else {
                magicInput.value = '';
            }

            if (itemToEdit.imageUrl) {
                this.overlay.querySelector('#img-input').value = itemToEdit.imageUrl;
                this.overlay.querySelector('#img-input').dispatchEvent(new Event('input'));
            }

            const radio = this.overlay.querySelector(`input[name="priority"][value="${itemToEdit.priority}"]`);
            if (radio) radio.checked = true;

            if (itemToEdit.category) {
                window.selectCategory(itemToEdit.category);
                if (itemToEdit.subcategory) {
                    // Slight delay to ensure subcategories rendered
                    setTimeout(() => window.selectSubcategory(itemToEdit.subcategory), 0);
                }
            }
        } else {
            this.resetSelection();
            this.overlay.querySelector('#add-item-form').reset();
            this.editingId = null;
            modalTitle.textContent = "New Wish";
            submitBtn.textContent = "Add to Wishlist";
            magicInput.value = '';
        }

        this.overlay.style.display = 'flex';
        requestAnimationFrame(() => this.overlay.classList.add('active'));
    }

    close() {
        this.overlay.classList.remove('active');
        setTimeout(() => this.overlay.style.display = 'none', 300);
    }
}