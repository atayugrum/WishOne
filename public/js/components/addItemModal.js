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
        this.render();
    }

    render() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'modal-overlay';

        const categoryGridHtml = Object.keys(CATEGORIES).map(key => {
            const cat = CATEGORIES[key];
            return `<div class="cat-pill" data-cat="${key}" onclick="window.selectCategory('${key}')"><span class="cat-icon">${cat.icon}</span><span class="cat-name">${cat.label}</span></div>`;
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
                                <p id="magic-error" style="color:#ff3b30; font-size:0.85rem; display:none;"></p>
                            </div>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group" style="flex:2;"><label>${i18n.t('modal.price')}</label><input type="number" name="price" id="input-price" placeholder="0" required step="0.01"></div>
                        <div class="form-group" style="flex:1;"><label>Currency</label><select name="currency" id="input-currency"><option value="TRY">TRY</option><option value="EUR">EUR</option><option value="USD">USD</option></select></div>
                    </div>
                    
                    <div class="form-group">
                        <label>${i18n.t('modal.occasion')}</label>
                        <select name="occasion" id="input-occasion" onchange="window.handleOccasionChange(this)">
                            <option value="">None</option>
                            <option value="Birthday">🎂 Birthday</option>
                            <option value="New Year">🎄 New Year</option>
                            <option value="Anniversary">💖 Anniversary</option>
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

                    <div class="form-group"><label>${i18n.t('modal.category')}</label><div class="category-grid">${categoryGridHtml}</div><input type="hidden" name="category" id="hidden-category" required></div>
                    <div class="form-group" id="custom-cat-container" style="display:none;">
                        <label>${i18n.t('modal.customCategory')}</label>
                        <input type="text" id="input-custom-cat" placeholder="My Category Name">
                    </div>

                    <div class="form-group">
                        <label>${i18n.t('modal.priority')}</label>
                        <div class="priority-segmented-control"><label><input type="radio" name="priority" value="Low"><span>Low</span></label><label><input type="radio" name="priority" value="Medium" checked><span>Med</span></label><label><input type="radio" name="priority" value="High"><span>High</span></label></div>
                    </div>
                    
                    <div class="form-group"><label>Target Date</label><input type="date" name="targetDate" id="input-date" style="width: 100%;"></div>
                    
                    <div class="form-group">
                        <label>${i18n.t('modal.image')}</label>
                        <div style="display:flex; gap:8px;">
                            <input type="url" id="img-input" name="imageUrl" placeholder="https://..." style="flex:1;">
                            <label class="btn-primary" style="display:flex; align-items:center; cursor:pointer; font-size:0.8rem; padding:8px 12px;">
                                📷 <input type="file" id="img-upload" accept="image/*" style="display:none;" onchange="window.handleImageUpload(this)">
                            </label>
                        </div>
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
        const imgPreview = this.overlay.querySelector('#img-preview');
        const btnMagicAdd = this.overlay.querySelector('#btn-magic-add');
        const magicContainer = this.overlay.querySelector('#magic-url-container');
        const btnFetchMagic = this.overlay.querySelector('#btn-fetch-magic');
        const magicInput = this.overlay.querySelector('#magic-url-input');
        const customCatContainer = this.overlay.querySelector('#custom-cat-container');

        // Toggle Magic Container
        btnMagicAdd.onclick = () => {
            const isHidden = magicContainer.style.display === 'none';
            magicContainer.style.display = isHidden ? 'block' : 'none';
            if(isHidden) magicInput.focus();
        };

        // File Upload Handler (Base64)
        window.handleImageUpload = (input) => {
            const file = input.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    imgInput.value = e.target.result; // Set data URI as URL
                    imgPreview.style.backgroundImage = `url('${e.target.result}')`;
                    imgPreview.style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        };

        // Custom Occasion Handler
        window.handleOccasionChange = (select) => {
            const customInput = document.getElementById('input-custom-occasion');
            customInput.style.display = select.value === 'Custom' ? 'block' : 'none';
        };

        // Magic Fetch
        btnFetchMagic.addEventListener('click', async () => {
            if (!authService.canUseFeature(FEATURES.MAGIC_ADD)) { premiumModal.open(); return; }
            const url = magicInput.value.trim();
            if (!url) return;

            if(window.aiCompanion) window.aiCompanion.setState('thinking');
            try {
                btnFetchMagic.innerHTML = `...`; btnFetchMagic.disabled = true;
                const { apiCall } = await import('../config/api.js');
                const metaData = await apiCall('/api/product/metadata', 'POST', { url });
                
                if (metaData.title) this.overlay.querySelector('#input-title').value = metaData.title;
                if (metaData.imageUrl) { imgInput.value = metaData.imageUrl; imgInput.dispatchEvent(new Event('input')); }
                if (metaData.price !== null) this.overlay.querySelector('#input-price').value = metaData.price;
                if (metaData.currency) this.overlay.querySelector('#input-currency').value = metaData.currency;
                
                if (metaData.category && window.selectCategory) window.selectCategory(metaData.category);
                
                magicContainer.style.display = 'none';
                if(window.aiCompanion) window.aiCompanion.say("Found it!", "magic", 2000);
            } catch (error) {
                if(window.aiCompanion) window.aiCompanion.say("I couldn't read that link.", "error");
            } finally {
                btnFetchMagic.textContent = i18n.t('modal.fetch'); btnFetchMagic.disabled = false;
            }
        });

        const closeBtns = this.overlay.querySelectorAll('.close-btn, .close-trigger');
        closeBtns.forEach(btn => btn.addEventListener('click', () => this.close()));

        imgInput.addEventListener('input', () => {
            if (imgInput.value) {
                imgPreview.style.display = 'block';
                imgPreview.style.backgroundImage = `url('${imgInput.value}')`;
            } else { imgPreview.style.display = 'none'; }
        });

        window.selectCategory = (key) => {
             const pills = this.overlay.querySelectorAll('.cat-pill');
             pills.forEach(p => p.classList.remove('selected'));
             const selected = this.overlay.querySelector(`.cat-pill[data-cat="${key}"]`);
             if (selected) selected.classList.add('selected');
             this.overlay.querySelector('#hidden-category').value = key;
             customCatContainer.style.display = key === 'Custom' ? 'block' : 'none';
        };

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = form.querySelector('button[type="submit"]');
            btn.textContent = i18n.t('common.saving'); btn.disabled = true;

            const formData = new FormData(form);
            let category = formData.get('category');
            if (category === 'Custom') {
                const customName = document.getElementById('input-custom-cat').value.trim();
                if (customName) category = customName; 
            }

            let occasion = formData.get('occasion');
            if (occasion === 'Custom') {
                occasion = document.getElementById('input-custom-occasion').value.trim();
            }

            const itemData = {
                title: formData.get('title'),
                price: parseFloat(formData.get('price')),
                currency: formData.get('currency'),
                category: category,
                subcategory: formData.get('subcategory') || null,
                priority: formData.get('priority'),
                occasion: occasion || null,
                visibility: formData.get('visibility'),
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
                    aiService.triggerReaction('add_wish', itemData);
                }
                this.close();
                if (this.onItemSaved) this.onItemSaved();
            } catch (e) {
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
        this.overlay.querySelector('#modal-title').textContent = i18n.t('modal.title');
        this.overlay.querySelector('#btn-submit-wish').textContent = i18n.t('modal.save');
        this.overlay.querySelector('#img-preview').style.display = 'none';
        this.overlay.querySelector('#custom-cat-container').style.display = 'none';
        document.getElementById('input-custom-occasion').style.display = 'none';

        if (itemToEdit) {
            this.editingId = itemToEdit.id;
            this.overlay.querySelector('#modal-title').textContent = i18n.t('modal.editTitle');
            this.overlay.querySelector('#input-title').value = itemToEdit.title;
            this.overlay.querySelector('#input-price').value = itemToEdit.price;
            this.overlay.querySelector('#input-currency').value = itemToEdit.currency;
            this.overlay.querySelector('#img-input').value = itemToEdit.imageUrl;
            
            if (itemToEdit.occasion) {
                const occSelect = this.overlay.querySelector('#input-occasion');
                // Check if occasion is standard
                const standard = Array.from(occSelect.options).some(o => o.value === itemToEdit.occasion);
                if (standard) {
                    occSelect.value = itemToEdit.occasion;
                } else {
                    occSelect.value = 'Custom';
                    const custInput = document.getElementById('input-custom-occasion');
                    custInput.style.display = 'block';
                    custInput.value = itemToEdit.occasion;
                }
            }

            if (itemToEdit.visibility) this.overlay.querySelector('#input-visibility').value = itemToEdit.visibility;
            if (itemToEdit.targetDate) this.overlay.querySelector('#input-date').value = itemToEdit.targetDate;
            if (itemToEdit.imageUrl) {
                 this.overlay.querySelector('#img-preview').style.display = 'block';
                 this.overlay.querySelector('#img-preview').style.backgroundImage = `url('${itemToEdit.imageUrl}')`;
            }
            
            if (itemToEdit.category) {
                if (CATEGORIES[itemToEdit.category]) {
                    window.selectCategory(itemToEdit.category);
                } else {
                    window.selectCategory('Custom');
                    document.getElementById('input-custom-cat').value = itemToEdit.category;
                }
            }
        }
    }
}