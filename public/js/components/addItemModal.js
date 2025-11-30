import { firestoreService } from '../services/FirestoreService.js';
import { authService } from '../services/AuthService.js';
import { CATEGORIES } from '../config/categories.js';
import { FEATURES } from '../config/limits.js';
import { premiumModal } from './PremiumModal.js';
import { i18n } from '../services/LocalizationService.js';
import { aiService } from '../services/AIService.js';

export class AddItemModal {
    constructor(onItemSaved) {
        this.onItemSaved = onItemSaved;
        this.overlay = null;
        this.uploadedBase64 = null; // [NEW] Store base64 internally
        this.render();
    }

    render() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'modal-overlay';

        const categoryGridHtml = Object.keys(CATEGORIES).map(key => {
            const cat = CATEGORIES[key];
            // [CHANGE] Removed onclick="window..."
            return `<div class="cat-pill" data-cat="${key}"><span class="cat-icon">${cat.icon}</span><span class="cat-name">${cat.label}</span></div>`;
        }).join('');

        this.overlay.innerHTML = `
            <div class="glass-panel modal-content">
                <div class="modal-header"><h2 id="modal-title">${i18n.t('modal.title')}</h2><button class="close-btn">&times;</button></div>
                
                <form id="add-item-form">
                    <div class="form-group">
                        <label>${i18n.t('modal.what')}</label>
                        <div style="display: flex; gap: 8px;">
                            <input type="text" name="title" id="input-title" placeholder="e.g. Vintage Lamp" required autocomplete="off" style="flex: 1;">
                            <button type="button" id="btn-magic-add" class="btn-magic" title="Auto-fill">
                                <span style="font-size: 1.1em;">✨</span>
                            </button>
                        </div>
                    </div>

                    <div id="magic-url-container" style="display:none; margin-bottom: 16px; animation: fadeSlideUp 0.3s var(--ease-spring);">
                        <div class="form-group">
                            <label>Product URL</label>
                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                <div style="display:flex; gap:8px;">
                                    <input type="url" id="magic-url-input" placeholder="https://..." style="flex: 1;">
                                    <button type="button" id="btn-fetch-magic" class="btn-primary" style="min-width: 80px;">${i18n.t('modal.fetch')}</button>
                                </div>
                                <p id="magic-error" style="color:#ff3b30; font-size:0.85rem; display:none; margin-top:4px;"></p>
                            </div>
                        </div>
                    </div>

                    <div id="ai-insight-box" style="display:none; background:rgba(100, 200, 255, 0.1); border:1px solid rgba(100, 200, 255, 0.3); padding:12px; border-radius:12px; margin-bottom:20px;">
                        <strong style="display:block; font-size:0.8rem; color:#007AFF; margin-bottom:4px;">🤖 AI Insight</strong>
                        <p id="ai-reason-text" style="font-size:0.9rem; color:var(--text-primary); margin:0; line-height:1.4;"></p>
                    </div>

                    <div class="form-row">
                        <div class="form-group" style="flex:2;"><label>${i18n.t('modal.price')}</label><input type="number" name="price" id="input-price" placeholder="0" step="0.01"></div>
                        <div class="form-group" style="flex:1;"><label>Currency</label><select name="currency" id="input-currency"><option value="TRY">TRY</option><option value="EUR">EUR</option><option value="USD">USD</option></select></div>
                    </div>
                    
                    <div class="form-group">
                        <label>${i18n.t('modal.occasion')}</label>
                        <select name="occasion" id="input-occasion">
                            <option value="">None</option>
                            <option value="Birthday">🎂 Birthday</option>
                            <option value="New Year">🎆 New Year</option>
                            <option value="Anniversary">💍 Anniversary</option>
                            <option value="Custom">✏️ Custom...</option>
                        </select>
                        <input type="text" id="input-custom-occasion" placeholder="${i18n.t('modal.occasion_custom')}" style="display:none; margin-top:8px;">
                    </div>

                    <div class="form-group">
                        <label>${i18n.t('modal.privacy')}</label>
                        <select name="visibility" id="input-visibility">
                            <option value="default">Default</option>
                            <option value="public">Public</option>
                            <option value="friends">Friends Only</option>
                            <option value="private">Private</option>
                        </select>
                    </div>

                    <div class="form-group"><label>${i18n.t('modal.category')}</label><div class="category-grid" id="category-grid">${categoryGridHtml}</div><input type="hidden" name="category" id="hidden-category" required>
                    <input type="hidden" name="subcategory" id="hidden-subcategory"></div>
                    
                    <div class="form-group" id="custom-cat-container" style="display:none;">
                        <label>${i18n.t('modal.customCategory')}</label>
                        <input type="text" id="input-custom-cat" placeholder="My Category Name">
                    </div>

                    <div class="form-group">
                        <label>${i18n.t('modal.priority')}</label>
                        <div class="priority-segmented-control">
                            <label><input type="radio" name="priority" value="Low" id="prio-low"><span>Low</span></label>
                            <label><input type="radio" name="priority" value="Medium" id="prio-med" checked><span>Med</span></label>
                            <label><input type="radio" name="priority" value="High" id="prio-high"><span>High</span></label>
                        </div>
                    </div>
                    
                    <div class="form-group"><label>Target Date</label><input type="date" name="targetDate" id="input-date" style="width: 100%;"></div>
                    
                    <div class="form-group">
                        <label>${i18n.t('modal.image')}</label>
                        <div style="display:flex; gap:8px; align-items:center;">
                            <input type="url" id="img-input" name="imageUrl" placeholder="https://..." style="flex:1;">
                            
                            <input type="file" id="img-upload" accept="image/*" style="display:none;">
                            <button type="button" class="btn-text" id="btn-trigger-upload" style="background:rgba(0,0,0,0.05); padding:10px; border-radius:12px;">📷</button>
                        </div>
                        <small id="file-name-display" style="display:none; color:var(--accent-color); margin-top:4px;"></small>
                        <div id="img-preview" style="width: 100%; height: 150px; margin-top: 10px; border-radius: 12px; background: #f0f0f0; background-size: cover; background-position: center; display: none; transition: background-image 0.3s;"></div>
                    </div>
                    
                    <div class="modal-actions">
                        <button type="button" class="btn-text close-trigger">${i18n.t('modal.cancel')}</button>
                        <button type="submit" class="btn-primary" id="btn-submit-wish">${i18n.t('modal.save')}</button>
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
        const imgUpload = this.overlay.querySelector('#img-upload');
        const btnUpload = this.overlay.querySelector('#btn-trigger-upload');
        const fileNameDisplay = this.overlay.querySelector('#file-name-display');
        const imgPreview = this.overlay.querySelector('#img-preview');
        const btnMagicAdd = this.overlay.querySelector('#btn-magic-add');
        const magicContainer = this.overlay.querySelector('#magic-url-container');
        const btnFetchMagic = this.overlay.querySelector('#btn-fetch-magic');
        const magicInput = this.overlay.querySelector('#magic-url-input');
        const categoryGrid = this.overlay.querySelector('#category-grid');
        const occasionSelect = this.overlay.querySelector('#input-occasion');

        // 1. Internal Logic Helpers
        const selectCategory = (key) => {
            const pills = this.overlay.querySelectorAll('.cat-pill');
            pills.forEach(p => p.classList.remove('selected'));

            const selected = this.overlay.querySelector(`.cat-pill[data-cat="${key}"]`);
            if (selected) selected.classList.add('selected');

            this.overlay.querySelector('#hidden-category').value = key;
            this.overlay.querySelector('#custom-cat-container').style.display = key === 'Custom' ? 'block' : 'none';
        };

        // 2. Event Listeners (No Global Pollution)

        // Category Selection
        categoryGrid.addEventListener('click', (e) => {
            const pill = e.target.closest('.cat-pill');
            if (pill) {
                selectCategory(pill.dataset.cat);
            }
        });

        // Occasion Change
        occasionSelect.addEventListener('change', (e) => {
            const customInput = document.getElementById('input-custom-occasion');
            customInput.style.display = e.target.value === 'Custom' ? 'block' : 'none';
        });

        // Toggle Magic Container
        btnMagicAdd.onclick = () => {
            const isHidden = magicContainer.style.display === 'none';
            magicContainer.style.display = isHidden ? 'block' : 'none';
            if (isHidden) magicInput.focus();
        };

        // Image Upload Handling
        btnUpload.onclick = () => imgUpload.click();

        imgUpload.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                // Check size (simple client-side check)
                if (file.size > 1024 * 1024) { // 1MB limit for Firestore base64
                    alert("Image too large. Please use a URL or an image under 1MB.");
                    imgUpload.value = '';
                    return;
                }

                const reader = new FileReader();
                reader.onload = (ev) => {
                    this.uploadedBase64 = ev.target.result; // Store internally
                    imgPreview.style.backgroundImage = `url('${this.uploadedBase64}')`;
                    imgPreview.style.display = 'block';

                    // UX Update
                    imgInput.value = '';
                    imgInput.disabled = true;
                    imgInput.placeholder = "(Image File Selected)";
                    fileNameDisplay.textContent = `Selected: ${file.name}`;
                    fileNameDisplay.style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        };

        // URL Image Preview
        imgInput.addEventListener('input', () => {
            if (imgInput.value) {
                // Reset upload state if user types URL
                this.uploadedBase64 = null;
                imgUpload.value = '';
                fileNameDisplay.style.display = 'none';

                imgPreview.style.display = 'block';
                imgPreview.style.backgroundImage = `url('${imgInput.value}')`;
            } else if (!this.uploadedBase64) {
                imgPreview.style.display = 'none';
            }
        });

        // Magic Fetch
        btnFetchMagic.addEventListener('click', async () => {
            if (!authService.canUseFeature(FEATURES.MAGIC_ADD)) { premiumModal.open(); return; }

            const url = magicInput.value.trim();
            if (!url) return;

            // Reset UI
            document.getElementById('magic-error').style.display = 'none';
            document.getElementById('ai-insight-box').style.display = 'none';
            btnFetchMagic.innerHTML = `...`;
            btnFetchMagic.disabled = true;

            if (window.aiCompanion) window.aiCompanion.setState('thinking');

            try {
                const { apiCall } = await import('../config/api.js');
                const metaData = await apiCall('/api/product/metadata', 'POST', { url });

                if (metaData.title) this.overlay.querySelector('#input-title').value = metaData.title;
                if (metaData.price !== null) this.overlay.querySelector('#input-price').value = metaData.price;
                if (metaData.currency) this.overlay.querySelector('#input-currency').value = metaData.currency;

                // Handle Image from AI
                if (metaData.imageUrl) {
                    imgInput.value = metaData.imageUrl;
                    imgInput.dispatchEvent(new Event('input'));
                }

                if (metaData.category) selectCategory(metaData.category);
                if (metaData.subcategory) this.overlay.querySelector('#hidden-subcategory').value = metaData.subcategory;

                if (metaData.priorityLevel) {
                    const pVal = metaData.priorityLevel.charAt(0).toUpperCase() + metaData.priorityLevel.slice(1).toLowerCase();
                    const radio = this.overlay.querySelector(`input[name="priority"][value="${pVal}"]`);
                    if (radio) radio.checked = true;
                }

                if (metaData.reason) {
                    document.getElementById('ai-insight-box').style.display = 'block';
                    document.getElementById('ai-reason-text').textContent = metaData.reason;
                }

                if (metaData.title) {
                    magicContainer.style.display = 'none';
                    if (window.aiCompanion) window.aiCompanion.say("Found it!", "magic", 2000);
                }

            } catch (error) {
                console.warn(error);
                document.getElementById('magic-error').textContent = "Could not read link.";
                document.getElementById('magic-error').style.display = 'block';
            } finally {
                btnFetchMagic.textContent = i18n.t('modal.fetch');
                btnFetchMagic.disabled = false;
            }
        });

        // Close Handlers
        this.overlay.querySelectorAll('.close-btn, .close-trigger').forEach(btn =>
            btn.addEventListener('click', () => this.close())
        );

        // Submit Handler
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = form.querySelector('button[type="submit"]');
            btn.textContent = i18n.t('common.saving'); btn.disabled = true;

            const formData = new FormData(form);
            let category = formData.get('category');
            if (category === 'Custom') {
                category = document.getElementById('input-custom-cat').value.trim() || 'Other';
            }

            let occasion = formData.get('occasion');
            if (occasion === 'Custom') {
                occasion = document.getElementById('input-custom-occasion').value.trim();
            }

            // Decide Image Source
            let finalImage = formData.get('imageUrl');
            if (this.uploadedBase64) {
                finalImage = this.uploadedBase64;
            }

            const itemData = {
                title: formData.get('title'),
                price: parseFloat(formData.get('price')) || 0,
                currency: formData.get('currency'),
                category: category,
                subcategory: formData.get('subcategory') || null,
                priority: formData.get('priority'),
                occasion: occasion || null,
                visibility: formData.get('visibility'),
                imageUrl: finalImage,
                targetDate: formData.get('targetDate') || null,
                ownerId: authService.currentUser.uid,
                originalUrl: magicInput.value || null
            };

            try {
                if (this.editingId) {
                    await firestoreService.updateItem(this.editingId, itemData);
                } else {
                    await firestoreService.addItem(itemData);
                    aiService.triggerReaction('add_wish', itemData);
                }
                this.close();
                if (this.onItemSaved) this.onItemSaved();
            } catch (e) {
                console.error(e);
                alert(i18n.t('common.error'));
            } finally {
                btn.textContent = i18n.t('modal.save'); btn.disabled = false;
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
        this.uploadedBase64 = null; // Reset upload

        // Reset UI Elements
        const imgInput = this.overlay.querySelector('#img-input');
        imgInput.disabled = false;
        imgInput.placeholder = "https://...";
        this.overlay.querySelector('#file-name-display').style.display = 'none';
        this.overlay.querySelector('#img-preview').style.display = 'none';
        this.overlay.querySelector('#custom-cat-container').style.display = 'none';
        document.getElementById('input-custom-occasion').style.display = 'none';
        document.getElementById('magic-url-container').style.display = 'none';
        document.getElementById('ai-insight-box').style.display = 'none';

        // Select Category Logic (Private helper inside bindEvents, so we simulate click or manual set)
        // Since we removed window.selectCategory, we need to manually reset pills
        const pills = this.overlay.querySelectorAll('.cat-pill');
        pills.forEach(p => p.classList.remove('selected'));

        if (itemToEdit) {
            // ... (Population logic - updated to match new structure) ...
            this.editingId = itemToEdit.id;
            this.overlay.querySelector('#modal-title').textContent = i18n.t('modal.editTitle');
            this.overlay.querySelector('#input-title').value = itemToEdit.title;
            this.overlay.querySelector('#input-price').value = itemToEdit.price;
            this.overlay.querySelector('#input-currency').value = itemToEdit.currency;

            if (itemToEdit.imageUrl) {
                imgInput.value = itemToEdit.imageUrl;
                this.overlay.querySelector('#img-preview').style.display = 'block';
                this.overlay.querySelector('#img-preview').style.backgroundImage = `url('${itemToEdit.imageUrl}')`;
            }

            // Trigger category selection visually
            if (itemToEdit.category) {
                const catEl = this.overlay.querySelector(`.cat-pill[data-cat="${itemToEdit.category}"]`);
                if (catEl) catEl.click();
                else {
                    // Custom category fallback logic would go here if needed
                }
            }

            // Priority
            const radio = this.overlay.querySelector(`input[name="priority"][value="${itemToEdit.priority}"]`);
            if (radio) radio.checked = true;
        }
    }
}