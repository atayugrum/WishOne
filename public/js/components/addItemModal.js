// js/components/AddItemModal.js
import { firestoreService } from '../services/FirestoreService.js';
import { authService } from '../services/AuthService.js';
import { CATEGORIES } from '../config/categories.js'; // Import config

export class AddItemModal {
    constructor(onItemAdded) {
        this.onItemAdded = onItemAdded;
        this.overlay = null;
        this.selectedCategory = null; // State for selection
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
                        <input type="text" name="title" placeholder="e.g. Vintage Lamp" required autocomplete="off">
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

        // Global handler for category selection inside the modal
        window.selectCategory = (key) => {
            this.selectedCategory = key;
            this.selectedSubcategory = null; // Reset sub

            // Visual Update
            const pills = this.overlay.querySelectorAll('.cat-pill');
            pills.forEach(p => {
                if(p.dataset.cat === key) p.classList.add('selected');
                else p.classList.remove('selected');
            });

            // Update Hidden Input
            this.overlay.querySelector('#hidden-category').value = key;

            // Render Subcategories
            this.renderSubcategories(key);
        };

        window.selectSubcategory = (sub) => {
            this.selectedSubcategory = sub;
            this.overlay.querySelector('#hidden-subcategory').value = sub;
            
            const chips = this.overlay.querySelectorAll('.sub-chip');
            chips.forEach(c => {
                if(c.textContent === sub) c.classList.add('selected');
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
            
            // Get Category Config to store icon if needed, or just store key
            const itemData = {
                ownerId: user.uid,
                title: formData.get('title'),
                price: Number(formData.get('price')),
                currency: formData.get('currency'),
                category: formData.get('category'),
                subcategory: formData.get('subcategory') || null,
                priority: formData.get('priority'),
                imageUrl: formData.get('imageUrl') || null,
                
                // NEW FIELD
                targetDate: formData.get('targetDate') || null
            };

            try {
                await firestoreService.addItem(itemData);
                this.close();
                form.reset();
                this.resetSelection(); // Clear UI state
                if (this.onItemAdded) this.onItemAdded();
                import('../services/AIService.js').then(({ aiService }) => {
                   const reaction = aiService.getReaction(itemData);
                   if (window.aiCompanion) window.aiCompanion.say(reaction);
                });

            } catch (error) {
                console.error(error);
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