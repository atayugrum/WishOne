/* public/js/components/addItemModal.js */
import { firestoreService } from '../services/FirestoreService.js';
import { CATEGORIES } from '../config/categories.js';
import { apiCall } from '../config/api.js';
import { i18n } from '../services/LocalizationService.js';
import { authService } from '../services/AuthService.js';

export class AddItemModal {
    constructor(onSaveCallback) {
        this.onSave = onSaveCallback;
        this.render();
        this.modal = document.getElementById('add-item-modal');
        this.form = document.getElementById('add-item-form');
        this.bindEvents();
        this.editingId = null;
    }

    render() {
        if (document.getElementById('add-item-modal')) return;

        const cats = Object.keys(CATEGORIES).map(c => `<option value="${c}">${c}</option>`).join('');
        const occasions = ['Birthday', 'Anniversary', 'New Year', 'Self-care', 'Vacation', 'Work', 'Party', 'Other']
            .map(o => `<option value="${o}">${o}</option>`).join('');

        const html = `
            <div id="add-item-modal" class="modal-overlay" style="z-index:1100;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 id="modal-title">${i18n.t('nav.add_wish')}</h3>
                        <button class="close-btn">&times;</button>
                    </div>
                    
                    <form id="add-item-form">
                        <div class="form-group" id="link-group">
                            <label>${i18n.t('ai.pasteLink')}</label>
                            <div style="display:flex; gap:8px;">
                                <input type="url" id="item-link" name="link" placeholder="https://trendyol.com/..." style="flex:1;">
                                <button type="button" id="btn-magic-fill" class="btn-magic">✨ Auto</button>
                            </div>
                            <small style="color:var(--text-tertiary); font-size:0.75rem;">Paste a link and click Auto to fill details.</small>
                        </div>

                        <div class="form-row">
                            <div class="form-group" style="flex:2;">
                                <label>Title</label>
                                <input type="text" name="title" required placeholder="Vintage Jacket">
                            </div>
                            <div class="form-group" style="flex:1;">
                                <label>Price</label>
                                <input type="number" name="price" placeholder="0.00">
                            </div>
                            <div class="form-group" style="width:80px;">
                                <label>Curr</label>
                                <select name="currency">
                                    <option value="TRY">TRY</option>
                                    <option value="USD">USD</option>
                                    <option value="EUR">EUR</option>
                                    <option value="GBP">GBP</option>
                                </select>
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label>Category</label>
                                <select name="category">${cats}</select>
                            </div>
                            <div class="form-group">
                                <label>Priority</label>
                                <select name="priority">
                                    <option value="Low">Low</option>
                                    <option value="Medium" selected>Medium</option>
                                    <option value="High">High</option>
                                </select>
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label>Occasion (Optional)</label>
                                <select name="occasion">
                                    <option value="">None</option>
                                    ${occasions}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Target Date</label>
                                <input type="date" name="targetDate">
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Image URL</label>
                            <div style="display:flex; gap:8px; align-items:center;">
                                <input type="text" name="imageUrl" id="input-image-url" placeholder="https://...">
                                <img id="preview-img" src="" style="width:40px; height:40px; border-radius:4px; object-fit:cover; display:none; background:#eee;">
                            </div>
                        </div>

                        <div class="form-group" style="margin-top:12px; display:flex; align-items:center; gap:8px;">
                            <input type="checkbox" id="check-is-owned" name="isOwned" style="width:auto; margin:0;">
                            <label for="check-is-owned" style="margin:0; font-weight:500;">I already own this item (Add to Closet)</label>
                        </div>

                        <button type="submit" class="btn-primary" style="width:100%; margin-top:16px;">
                            ${i18n.t('common.save')}
                        </button>
                    </form>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
    }

    bindEvents() {
        const closeBtn = this.modal.querySelector('.close-btn');
        closeBtn.onclick = () => this.close();

        this.modal.querySelector('#btn-magic-fill').onclick = async (e) => {
            const btn = e.target;
            const link = document.getElementById('item-link').value;
            if (!link) return;

            btn.disabled = true;
            btn.innerHTML = 'Thinking...';
            
            try {
                const data = await apiCall('/api/product/metadata', 'POST', { url: link });
                const f = this.form;
                if (data.title) f.title.value = data.title;
                if (data.price) f.price.value = data.price;
                if (data.currency) f.currency.value = data.currency;
                if (data.imageUrl) {
                    f.imageUrl.value = data.imageUrl;
                    this.updatePreview(data.imageUrl);
                }
                if (data.category) f.category.value = data.category;
                if (data.priorityLevel) f.priority.value = data.priorityLevel;
                
                window.showToast('Magic fill applied! ✨');
            } catch (err) {
                console.error(err);
                window.showToast('Could not fetch details.', 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = '✨ Auto';
            }
        };

        document.getElementById('input-image-url').onchange = (e) => this.updatePreview(e.target.value);

        this.form.onsubmit = async (e) => {
            e.preventDefault();
            const user = authService.currentUser;
            if (!user) return;

            const fd = new FormData(this.form);
            const isOwned = document.getElementById('check-is-owned').checked;
            
            const itemData = {
                ownerId: user.uid,
                title: fd.get('title'),
                price: parseFloat(fd.get('price')) || 0,
                currency: fd.get('currency'),
                category: fd.get('category'),
                priority: fd.get('priority'),
                occasion: fd.get('occasion') || null,
                targetDate: fd.get('targetDate') || null,
                imageUrl: fd.get('imageUrl'),
                link: fd.get('link'),
                // Logic: if checked, status is 'bought', else 'wish' (default)
                status: isOwned ? 'bought' : 'wish'
            };

            try {
                if (this.editingId) {
                    // When editing, we might want to preserve status unless explicitly changed.
                    // But here, let's allow the checkbox to override.
                    await firestoreService.updateItem(this.editingId, itemData);
                    window.showToast('Item updated');
                } else {
                    await firestoreService.addItem(itemData);
                    const msg = isOwned ? 'Added to Closet! 🧥' : 'Wish cast! ✨';
                    window.showToast(msg);
                }
                this.close();
                if (this.onSave) this.onSave();
            } catch (err) {
                console.error(err);
                alert("Error saving item.");
            }
        };
    }

    updatePreview(url) {
        const img = document.getElementById('preview-img');
        if (url) {
            img.src = url;
            img.style.display = 'block';
        } else {
            img.style.display = 'none';
        }
    }

    // Pass `initialStatus` to pre-check the "Owned" box
    open(item = null, initialStatus = 'wish') {
        this.editingId = item ? item.id : null;
        this.form.reset();
        this.updatePreview('');

        const modalTitle = document.getElementById('modal-title');
        const checkOwned = document.getElementById('check-is-owned');

        if (item) {
            modalTitle.textContent = "Edit Item";
            const f = this.form;
            f.title.value = item.title;
            f.price.value = item.price;
            f.currency.value = item.currency;
            f.category.value = item.category;
            f.priority.value = item.priority;
            f.occasion.value = item.occasion || '';
            f.targetDate.value = item.targetDate || '';
            f.imageUrl.value = item.imageUrl || '';
            f.link.value = item.link || '';
            this.updatePreview(item.imageUrl);
            
            // Set checkbox based on existing item status
            checkOwned.checked = (item.status === 'bought' || item.isOwned);
        } else {
            modalTitle.textContent = initialStatus === 'bought' ? "Add to Closet" : i18n.t('nav.add_wish');
            checkOwned.checked = (initialStatus === 'bought');
        }

        this.modal.style.display = 'flex';
        requestAnimationFrame(() => this.modal.classList.add('active'));
    }

    close() {
        this.modal.classList.remove('active');
        setTimeout(() => this.modal.style.display = 'none', 300);
    }
}