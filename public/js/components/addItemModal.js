// js/components/AddItemModal.js
import { firestoreService } from '../services/FirestoreService.js';
import { authService } from '../services/AuthService.js';
import { CATEGORIES } from '../config/categories.js';

export class AddItemModal {
    constructor(onItemAdded) {
        this.onItemAdded = onItemAdded;
        this.overlay = null;
        this.selectedCategory = null;
        this.selectedSubcategory = null;
        this.render();
    }

    render() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'modal-overlay';

        // Generate Category Grid HTML
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
                    <h2>New Wish</h2>
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

                    <!-- Magic Add URL Input (Hidden initially) -->
                    <div id="magic-url-container" style="display:none; margin-bottom: 16px;">
                        <div class="form-group">
                            <label>Paste Product URL</label>
                            <div style="display: flex; gap: 8px;">
                                <input type="url" id="magic-url-input" placeholder="https://..." style="flex: 1;">
                                <button type="button" id="btn-fetch-magic" class="btn-primary">Fetch</button>
                            </div>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group" style="flex: 2;">
                            <label>Price</label>
                            <input type="number" name="price" placeholder="0" required>
                        </div>
                        <div class="form-group" style="flex: 1;">
                            <label>Currency</label>
                            <select name="currency">
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
                        <div class="subcategory-scroll" id="subcategory-list">
                            </div>
                        <input type="hidden" name="subcategory" id="hidden-subcategory">
                    </div>

                    <div class="form-group">
                        <label>Priority</label>
                        <div class="priority-segmented-control">
                            <label><input type="radio" name="priority" value="Low"><span>Low</span></label>
                            <label><input type="radio" name="priority" value="Medium" checked><span>Med</span></label>
                            <label><input type="radio" name="priority" value="High"><span>High</span></label>
                            <label><input type="radio" name="priority" value="Must-have"><span>Must Have</span></label>
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Target Date (Optional)</label>
                        <input type="date" name="targetDate" style="width: 100%;">
                    </div>

                    <div class="form-group">
                        <label>Image URL</label>
                        <input type="url" id="img-input" name="imageUrl" placeholder="https://..." >
                        <div id="img-preview" style="width: 100%; height: 150px; margin-top: 10px; border-radius: 12px; background: #f0f0f0; background-size: cover; background-position: center; display: none;"></div>
                    </div>

                    <div class="modal-actions">
                        <button type="button" class="btn-text close-trigger">Cancel</button>
                        <button type="submit" class="btn-primary">Add to Wishlist</button>
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

        // Magic Add Elements
        const btnMagicAdd = this.overlay.querySelector('#btn-magic-add');
        const magicContainer = this.overlay.querySelector('#magic-url-container');
        const btnFetchMagic = this.overlay.querySelector('#btn-fetch-magic');
        const magicInput = this.overlay.querySelector('#magic-url-input');

        // Toggle Magic Input
        btnMagicAdd.addEventListener('click', () => {
            magicContainer.style.display = magicContainer.style.display === 'none' ? 'block' : 'none';
        });

        // Fetch Logic
        btnFetchMagic.addEventListener('click', async () => {
            const url = magicInput.value.trim();
            if (!url) return;

            try {
                btnFetchMagic.textContent = "✨...";
                btnFetchMagic.disabled = true;

                const { apiCall } = await import('../config/api.js');

                // 1. Get Metadata (Scraping)
                const metaData = await apiCall('/api/product/metadata', 'POST', { url });

                // Auto-fill basic data
                if (metaData.title) this.overlay.querySelector('#input-title').value = metaData.title;
                if (metaData.imageUrl) {
                    imgInput.value = metaData.imageUrl;
                    imgInput.dispatchEvent(new Event('input'));
                }

                // 2. Get AI Suggestions (Category, Price, Priority)
                if (metaData.title || metaData.description) {
                    btnFetchMagic.textContent = "🧠...";
                    const aiData = await apiCall('/api/ai/suggestion', 'POST', {
                        title: metaData.title,
                        description: metaData.description || metaData.title,
                        url: url
                    });

                    // Apply AI Suggestions
                    if (aiData.category) {
                        // Find matching category key (case-insensitive)
                        const catKey = Object.keys(CATEGORIES).find(k => k.toLowerCase() === aiData.category.toLowerCase()) || 'Other';
                        window.selectCategory(catKey);

                        // Select subcategory if available
                        if (aiData.subcategory && CATEGORIES[catKey]?.subcategories) {
                            // Wait for render
                            setTimeout(() => {
                                const sub = aiData.subcategory;
                                // Try to find close match or exact
                                const exactSub = CATEGORIES[catKey].subcategories.find(s => s.toLowerCase() === sub.toLowerCase());
                                if (exactSub) window.selectSubcategory(exactSub);
                            }, 100);
                        }
                    }

                    if (aiData.priceEstimate) {
                        this.overlay.querySelector('input[name="price"]').value = aiData.priceEstimate;
                    }

                    if (aiData.currency) {
                        this.overlay.querySelector('select[name="currency"]').value = aiData.currency;
                    }
                }

                magicContainer.style.display = 'none';

            } catch (error) {
                alert("Could not fetch details. Try entering manually.");
                console.error(error);
            } finally {
                btnFetchMagic.textContent = "Fetch";
                btnFetchMagic.disabled = false;
            }
        });

        // Global handler for category selection inside the modal
        window.selectCategory = (key) => {
            this.selectedCategory = key;
            this.selectedSubcategory = null;

            // Visual Update
            const pills = this.overlay.querySelectorAll('.cat-pill');
            pills.forEach(p => {
                if (p.dataset.cat === key) p.classList.add('selected');
                else p.classList.remove('selected');
            });

            // Update Hidden Input
            this.overlay.querySelector('#hidden-category').value = key;

            // Render Subcategories
            this.renderSubcategories(key);
        };

        // Fix: Ensure this is globally available and handles the click
        window.selectSubcategory = (sub) => {
            this.selectedSubcategory = sub;
            this.overlay.querySelector('#hidden-subcategory').value = sub;

            const chips = this.overlay.querySelectorAll('.sub-chip');
            chips.forEach(c => {
                // Use trim() to avoid whitespace mismatches
                if (c.textContent.trim() === sub) c.classList.add('selected');
                else c.classList.remove('selected');
            });
        };

        // Close Logic
        const closeBtns = this.overlay.querySelectorAll('.close-btn, .close-trigger');
        closeBtns.forEach(btn => btn.addEventListener('click', () => this.close()));

        // Image Preview Logic
        imgInput.addEventListener('input', () => {
            const url = imgInput.value;
            if (url) {
                imgPreview.style.display = 'block';
                imgPreview.style.backgroundImage = `url('${url}')`;
            } else {
                imgPreview.style.display = 'none';
            }
        });

        // Submit Logic
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const user = authService.currentUser;
            if (!user) return alert("Login required");

            const btn = form.querySelector('button[type="submit"]');
            btn.textContent = "Saving...";
            btn.disabled = true;

            const formData = new FormData(form);

            const itemData = {
                ownerId: user.uid,
                title: formData.get('title'),
                price: parseFloat(formData.get('price')) || 0,
                currency: formData.get('currency'),
                category: formData.get('category'),
                subcategory: formData.get('subcategory') || null,
                priority: formData.get('priority'),
                targetDate: formData.get('targetDate') || null,
                imageUrl: formData.get('imageUrl') || null,

                // Price Tracking Fields
                url: document.getElementById('magic-url-input').value || null,
                sourceSite: document.getElementById('magic-url-input').value ? new URL(document.getElementById('magic-url-input').value).hostname : null,
                originalPrice: parseFloat(formData.get('price')) || 0,
                lastPrice: parseFloat(formData.get('price')) || 0,
                priceLastCheckedAt: new Date().toISOString(),
                onSale: false
            };

            try {
                await firestoreService.addItem(itemData);
                this.close();
                form.reset();
                this.resetSelection();
                if (this.onItemAdded) this.onItemAdded();
            } catch (error) {
                console.error("Add Item Error:", error);
                alert("Failed to save wish. Please try again.");
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
        this.overlay.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
        this.overlay.querySelector('#subcategory-container').style.display = 'none';
        this.overlay.querySelector('#img-preview').style.display = 'none';
    }

    open() {
        this.overlay.style.display = 'flex';
        requestAnimationFrame(() => {
            this.overlay.classList.add('active');
        });
    }

    close() {
        this.overlay.classList.remove('active');
        setTimeout(() => {
            this.overlay.style.display = 'none';
        }, 300);
    }
}