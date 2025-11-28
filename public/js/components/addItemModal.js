import { firestoreService } from '../services/FirestoreService.js';
import { authService } from '../services/AuthService.js';
import { CATEGORIES } from '../config/categories.js';
import { FEATURES } from '../config/limits.js';
import { premiumModal } from './PremiumModal.js';

export class AddItemModal {
    constructor(onItemSaved) {
        this.onItemSaved = onItemSaved;
        this.overlay = null;
        this.render();
    }

    render() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'modal-overlay';

        const categoryGridHtml = Object.keys(CATEGORIES).map(key => {
            const cat = CATEGORIES[key];
            return `<div class="cat-pill" data-cat="${key}" onclick="window.selectCategory('${key}')"><span class="cat-icon">${cat.icon}</span><span class="cat-name">${key}</span></div>`;
        }).join('');

        this.overlay.innerHTML = `
            <div class="glass-panel modal-content">
                <div class="modal-header"><h2 id="modal-title">New Wish</h2><button class="close-btn">&times;</button></div>
                
                <form id="add-item-form">
                    <div class="form-group">
                        <label>What is it?</label>
                        <div style="display: flex; gap: 8px;">
                            <input type="text" name="title" id="input-title" placeholder="e.g. Vintage Lamp" required autocomplete="off" style="flex: 1;">
                            <button type="button" id="btn-magic-add" class="btn-magic" title="Auto-fill from URL">
                                <span style="font-size: 1.1em;">✨</span> Magic
                            </button>
                        </div>
                    </div>

                    <div id="magic-url-container" style="display:none; margin-bottom: 16px; animation: fadeSlideUp 0.3s var(--ease-spring);">
                        <div class="form-group">
                            <label>Product URL</label>
                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                <div style="display:flex; gap:8px;">
                                    <input type="url" id="magic-url-input" placeholder="https://..." style="flex: 1;">
                                    <button type="button" id="btn-fetch-magic" class="btn-primary" style="min-width: 80px;">Fetch</button>
                                </div>
                                <p id="magic-error" style="color:#ff3b30; font-size:0.85rem; display:none;"></p>
                                <p id="magic-warning" style="color:#FF9500; font-size:0.85rem; display:none;">⚠️ This link is already in your wishlist.</p>
                            </div>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group" style="flex:2;"><label>Price</label><input type="number" name="price" id="input-price" placeholder="0" required step="0.01"></div>
                        <div class="form-group" style="flex:1;"><label>Currency</label><select name="currency" id="input-currency"><option value="TRY">TRY</option><option value="EUR">EUR</option><option value="USD">USD</option></select></div>
                    </div>
                    
                    <div class="form-group">
                        <label>Occasion (Optional)</label>
                        <select name="occasion" id="input-occasion">
                            <option value="">None</option>
                            <option value="Birthday">🎂 Birthday</option>
                            <option value="New Year">🎄 New Year</option>
                            <option value="Anniversary">💖 Anniversary</option>
                            <option value="Graduation">🎓 Graduation</option>
                            <option value="Just Because">✨ Just Because</option>
                        </select>
                    </div>

                    <div class="form-group"><label>Category</label><div class="category-grid">${categoryGridHtml}</div><input type="hidden" name="category" id="hidden-category" required></div>
                    <div class="form-group" id="subcategory-container" style="display:none;"><label>Subcategory</label><div class="subcategory-scroll" id="subcategory-list"></div><input type="hidden" name="subcategory" id="hidden-subcategory"></div>
                    <div class="form-group">
                        <label>Priority</label>
                        <div id="ai-insight-box" class="ai-insight glass-panel" style="display:none;">
                            <div style="display:flex; align-items:flex-start; gap:8px;">
                                <span style="font-size:1.2rem;">✨</span>
                                <div><strong id="ai-insight-label" style="font-size:0.85rem; display:block; color:var(--accent-color);"></strong><span id="ai-insight-text" style="font-size:0.85rem; color:var(--text-secondary); line-height:1.4;"></span></div>
                                <button type="button" onclick="document.getElementById('ai-insight-box').style.display='none'" style="margin-left:auto; background:none; border:none; cursor:pointer;">&times;</button>
                            </div>
                        </div>
                        <div class="priority-segmented-control"><label><input type="radio" name="priority" value="Low"><span>Low</span></label><label><input type="radio" name="priority" value="Medium" checked><span>Med</span></label><label><input type="radio" name="priority" value="High"><span>High</span></label><label><input type="radio" name="priority" value="Must-have"><span>Must Have</span></label></div>
                    </div>
                    <div class="form-group"><label>Target Date</label><input type="date" name="targetDate" id="input-date" style="width: 100%;"></div>
                    <div class="form-group"><label>Image URL</label><input type="url" id="img-input" name="imageUrl" placeholder="https://..." ><div id="img-preview" style="width: 100%; height: 150px; margin-top: 10px; border-radius: 12px; background: #f0f0f0; background-size: cover; background-position: center; display: none; transition: background-image 0.3s;"></div></div>
                    
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
        const magicError = this.overlay.querySelector('#magic-error');
        const magicWarning = this.overlay.querySelector('#magic-warning');

        btnMagicAdd.addEventListener('click', () => {
            if (magicContainer.style.display === 'none') {
                magicContainer.style.display = 'block';
                magicInput.focus();
            } else {
                magicContainer.style.display = 'none';
            }
        });

        // Enhanced Fetch UX (Task 2.4)
        btnFetchMagic.addEventListener('click', async () => {
            if (!authService.canUseFeature(FEATURES.MAGIC_ADD)) {
                premiumModal.open();
                return;
            }

            const url = magicInput.value.trim();
            magicError.style.display = 'none';
            magicWarning.style.display = 'none';

            if (!url) {
                magicInput.style.borderColor = '#FF3B30';
                setTimeout(() => magicInput.style.borderColor = '', 2000);
                return;
            }

            // Safety Check: Duplicates
            const exists = await firestoreService.checkItemExists(authService.currentUser.uid, url);
            if (exists) {
                magicWarning.style.display = 'block';
                // We allow them to proceed, but warn them
            }

            try {
                btnFetchMagic.innerHTML = `<span class="spinner-small"></span>`;
                btnFetchMagic.disabled = true;

                const { apiCall } = await import('../config/api.js');
                const metaData = await apiCall('/api/product/metadata', 'POST', { url });

                if (metaData.error) throw new Error(metaData.error);
                authService.trackFeatureUsage(FEATURES.MAGIC_ADD);

                // Auto-fill...
                if (metaData.title) this.overlay.querySelector('#input-title').value = metaData.title;
                if (metaData.imageUrl) { imgInput.value = metaData.imageUrl; imgInput.dispatchEvent(new Event('input')); }
                if (metaData.price !== null) { const clean = Number(metaData.price); if (!isNaN(clean)) this.overlay.querySelector('#input-price').value = clean; }
                if (metaData.currency) this.overlay.querySelector('#input-currency').value = metaData.currency;

                // AI Data autofill
                if (metaData.category && window.selectCategory) {
                    window.selectCategory(metaData.category);
                    if (metaData.subcategory) {
                        setTimeout(() => {
                            const subChips = this.overlay.querySelectorAll('.sub-chip');
                            subChips.forEach(chip => {
                                if (chip.textContent === metaData.subcategory) chip.click();
                            });
                        }, 200);
                    }
                }

                // AI Insight
                if (metaData.priorityLabel && metaData.reason) {
                    const insightBox = this.overlay.querySelector('#ai-insight-box');
                    this.overlay.querySelector('#ai-insight-label').textContent = `AI Suggestion: ${metaData.priorityLabel}`;
                    this.overlay.querySelector('#ai-insight-text').textContent = metaData.reason;
                    insightBox.style.display = 'block';
                }

                // Don't close container immediately so they see the warning if it exists
                if (!exists) magicContainer.style.display = 'none';

            } catch (error) {
                console.error("Magic Fetch Error:", error);
                // Graceful Error (Task 2.4)
                magicError.textContent = "We couldn't read this link, but you can still add it manually.";
                magicError.style.display = 'block';
            } finally {
                btnFetchMagic.textContent = "Fetch";
                btnFetchMagic.disabled = false;
            }
        });

        const closeBtns = this.overlay.querySelectorAll('.close-btn, .close-trigger');
        closeBtns.forEach(btn => btn.addEventListener('click', () => this.close()));

        imgInput.addEventListener('input', () => {
            if (imgInput.value) {
                imgPreview.style.display = 'block';
                imgPreview.style.backgroundImage = `url('${imgInput.value}')`;
            } else {
                imgPreview.style.display = 'none';
            }
        });

        window.selectCategory = (key) => {
            const pills = this.overlay.querySelectorAll('.cat-pill');
            pills.forEach(p => p.classList.remove('selected'));
            const selected = this.overlay.querySelector(`.cat-pill[data-cat="${key}"]`);
            if (selected) selected.classList.add('selected');
            this.overlay.querySelector('#hidden-category').value = key;
        };

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = form.querySelector('button[type="submit"]');
            const originalText = btn.textContent;
            btn.textContent = "Saving...";
            btn.disabled = true;

            const formData = new FormData(form);
            const itemData = {
                title: formData.get('title'),
                price: parseFloat(formData.get('price')),
                currency: formData.get('currency'),
                category: formData.get('category'),
                subcategory: formData.get('subcategory') || null,
                priority: formData.get('priority'),
                occasion: formData.get('occasion') || null, // NEW
                imageUrl: formData.get('imageUrl'),
                targetDate: formData.get('targetDate') || null,
                ownerId: authService.currentUser.uid,
                originalUrl: magicInput.value || null
            };

            try {
                if (this.editingId) {
                    await firestoreService.updateItem(this.editingId, itemData);
                } else {
                    await firestoreService.addItem(itemData);
                    import('../services/AIService.js').then(({ aiService }) => {
                        aiService.getReaction(itemData).then(msg => {
                            if (window.aiCompanion) window.aiCompanion.say(msg);
                        });
                    });
                }

                this.close();
                if (this.onItemSaved) this.onItemSaved();
            } catch (e) {
                console.error(e);
                alert("Failed to save item.");
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        });
    }

    close() {
        this.overlay.classList.remove('active');
        setTimeout(() => this.overlay.style.display = 'none', 300);
    }

    open(itemToEdit = null) {
        this.overlay.style.display = 'flex';
        requestAnimationFrame(() => this.overlay.classList.add('active'));

        const form = this.overlay.querySelector('#add-item-form');
        form.reset();
        this.editingId = null;
        this.overlay.querySelector('#modal-title').textContent = "New Wish";
        this.overlay.querySelector('#btn-submit-wish').textContent = "Add to Wishlist";
        this.overlay.querySelector('#img-preview').style.display = 'none';
        this.overlay.querySelector('#magic-error').style.display = 'none';
        this.overlay.querySelector('#magic-warning').style.display = 'none';

        if (itemToEdit) {
            this.editingId = itemToEdit.id;
            this.overlay.querySelector('#modal-title').textContent = "Edit Wish";
            this.overlay.querySelector('#btn-submit-wish').textContent = "Save Changes";

            this.overlay.querySelector('#input-title').value = itemToEdit.title;
            this.overlay.querySelector('#input-price').value = itemToEdit.price;
            this.overlay.querySelector('#input-currency').value = itemToEdit.currency;
            this.overlay.querySelector('#img-input').value = itemToEdit.imageUrl;

            // Populate Occasion
            if (itemToEdit.occasion) this.overlay.querySelector('#input-occasion').value = itemToEdit.occasion;

            if (itemToEdit.targetDate) this.overlay.querySelector('#input-date').value = itemToEdit.targetDate;
            if (itemToEdit.imageUrl) {
                this.overlay.querySelector('#img-preview').style.display = 'block';
                this.overlay.querySelector('#img-preview').style.backgroundImage = `url('${itemToEdit.imageUrl}')`;
            }
            if (itemToEdit.category) window.selectCategory(itemToEdit.category);
        }
    }
}