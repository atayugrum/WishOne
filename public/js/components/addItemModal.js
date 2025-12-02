/* public/js/components/addItemModal.js */
import { firestoreService } from '../services/FirestoreService.js';
import { aiService } from '../services/AIService.js';
import { authService } from '../services/AuthService.js';
import { CATEGORIES } from '../config/categories.js';

export class AddItemModal {
    constructor(onSaveCallback) {
        this.onSave = onSaveCallback;
        this.modal = null;
        this.currentStep = 1;
        this.fetchedData = null;
        this.editingId = null;
        this.render(); 
    }

    render() {
        // Ensure we don't create duplicate modals
        const existing = document.getElementById('add-wish-modal');
        if(existing) existing.remove();

        const html = `
            <div id="add-wish-modal" class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 id="modal-title">Add New Wish</h3>
                        <button class="close-btn">&times;</button>
                    </div>

                    <!-- Step 1: URL -->
                    <div id="step-1" class="modal-step">
                        <div class="url-input-container">
                            <div style="font-size:2.5rem; margin-bottom:16px;">🔗</div>
                            <h4 style="margin-bottom:12px;">Paste Product Link</h4>
                            <input type="url" id="input-url-step1" placeholder="https://..." autocomplete="off">
                            <button id="btn-fetch-magic" class="btn-magic" style="width:100%; justify-content:center; margin-top:16px;">
                                ✨ Magic Fetch
                            </button>
                            <div style="margin-top:20px; font-size:0.9rem; color:var(--text-tertiary);">
                                or <span id="btn-skip-manual" style="text-decoration:underline; cursor:pointer; color:var(--text-secondary); font-weight:600;">enter manually</span>
                            </div>
                        </div>
                    </div>

                    <!-- Step 2: Details -->
                    <div id="step-2" class="modal-step" style="display:none;">
                        <div class="fetched-preview">
                            <img id="preview-img" class="fetched-img" src="https://placehold.co/150">
                            <div style="flex:1; min-width:0;">
                                <label style="font-size:0.8rem; margin-bottom:4px;">Product Title</label>
                                <input type="text" id="input-title" placeholder="Item Name" style="font-weight:600; margin-bottom:8px;">
                                
                                <!-- IMPROVED PRICE ROW -->
                                <div class="price-row">
                                    <input type="number" id="input-price" placeholder="0.00">
                                    <select id="input-currency">
                                        <option value="TRY">TRY</option>
                                        <option value="USD">USD</option>
                                        <option value="EUR">EUR</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Category & Priority</label>
                            <div style="display:flex; gap:12px;">
                                <select id="input-category" style="flex:1;">
                                    ${Object.keys(CATEGORIES).map(c => `<option value="${c}">${c}</option>`).join('')}
                                </select>
                                <select id="input-priority" style="flex:1;">
                                    <option value="High">🔥 High</option>
                                    <option value="Medium" selected>Medium</option>
                                    <option value="Low">Low</option>
                                </select>
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Occasion (Optional)</label>
                            <input type="text" id="input-occasion" list="occasions-list" placeholder="e.g. Birthday" autocomplete="off">
                            <datalist id="occasions-list"></datalist>
                        </div>

                        <div class="form-group">
                            <label>Target Date (Optional)</label>
                            <input type="date" id="input-date">
                        </div>

                        <div style="display:flex; gap:12px; margin-top:32px;">
                            <button id="btn-back-step1" class="btn-text" style="flex:1;">Back</button>
                            <button id="btn-save-final" class="btn-primary" style="flex:2;">Save Wish</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', html);
        this.modal = document.getElementById('add-wish-modal');
        this.bindEvents();
    }

    bindEvents() {
        this.modal.querySelector('.close-btn').onclick = () => this.close();
        
        // Step 1: Fetch Logic
        document.getElementById('btn-fetch-magic').onclick = async () => {
            const url = document.getElementById('input-url-step1').value.trim();
            if(!url) return alert("Please paste a URL.");
            
            const btn = document.getElementById('btn-fetch-magic');
            btn.innerHTML = "🔮 Reading...";
            btn.disabled = true;

            try {
                const data = await aiService.getProductMetadata(url);
                this.populateForm(data);
                this.goToStep(2);
            } catch(e) {
                console.error(e);
                this.populateForm({ url }); // Proceed with URL only
                this.goToStep(2);
            } finally {
                btn.innerHTML = "✨ Magic Fetch";
                btn.disabled = false;
            }
        };

        document.getElementById('btn-skip-manual').onclick = () => {
            this.populateForm({});
            this.goToStep(2);
        };

        document.getElementById('btn-back-step1').onclick = () => this.goToStep(1);

        // Step 2: Save Logic
        document.getElementById('btn-save-final').onclick = () => this.save();
    }

    populateForm(data) {
        document.getElementById('input-title').value = data.title || '';
        document.getElementById('input-price').value = data.price || '';
        document.getElementById('input-currency').value = data.currency || 'TRY';
        document.getElementById('preview-img').src = data.imageUrl || 'https://placehold.co/150';
        
        if(data.category) document.getElementById('input-category').value = data.category;
        
        this.fetchedData = data;
    }

    goToStep(step) {
        document.getElementById('step-1').style.display = step === 1 ? 'block' : 'none';
        document.getElementById('step-2').style.display = step === 2 ? 'block' : 'none';
        const title = document.getElementById('modal-title');
        title.innerText = step === 1 ? "Add New Wish" : "Wish Details";
    }

    open(item = null) {
        this.modal.style.display = 'flex';
        requestAnimationFrame(() => this.modal.classList.add('active'));
        if(item) {
            this.editingId = item.id;
            this.populateForm(item);
            if(item.occasion) document.getElementById('input-occasion').value = item.occasion;
            if(item.targetDate) document.getElementById('input-date').value = item.targetDate;
            this.goToStep(2);
        } else {
            this.editingId = null;
            document.getElementById('input-url-step1').value = '';
            this.goToStep(1);
        }
    }

    close() {
        this.modal.classList.remove('active');
        setTimeout(() => this.modal.style.display = 'none', 300);
    }

    async save() {
        const user = authService.currentUser;
        if(!user) return;

        const title = document.getElementById('input-title').value;
        if(!title) return alert("Title is required");

        const itemData = {
            ownerId: user.uid,
            title,
            price: parseFloat(document.getElementById('input-price').value) || 0,
            currency: document.getElementById('input-currency').value,
            category: document.getElementById('input-category').value,
            priority: document.getElementById('input-priority').value,
            occasion: document.getElementById('input-occasion').value.trim() || null,
            targetDate: document.getElementById('input-date').value || null,
            imageUrl: document.getElementById('preview-img').src,
            link: this.fetchedData?.url || null,
            status: 'wish'
        };

        const btn = document.getElementById('btn-save-final');
        const originalText = btn.innerText;
        btn.innerText = "Saving...";
        btn.disabled = true;

        try {
            if(this.editingId) {
                await firestoreService.updateItem(this.editingId, itemData);
            } else {
                await firestoreService.addItem(itemData);
            }
            this.close();
            if(this.onSave) this.onSave();
            window.showToast("Wish saved successfully!", "✨");
        } catch(e) {
            console.error(e);
            alert("Error saving wish.");
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    }
}