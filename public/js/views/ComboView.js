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

        return `
            <div class="view-container">
                <div class="view-header">
                    <h1>Combo Builder</h1>
                    <button id="btn-save-combo" class="btn-primary">Save Combo</button>
                </div>

                <div class="combo-layout">
                    <!-- Canvas Area -->
                    <div class="combo-canvas" id="combo-canvas">
                        <div class="canvas-placeholder">Drag items here</div>
                    </div>

                    <!-- Sidebar with Closet Items -->
                    <div class="combo-sidebar">
                        <h3>Your Closet</h3>
                        <div class="closet-grid-mini">
                            ${closetItems.map(item => `
                                <div class="closet-item-mini" draggable="true" data-id="${item.id}" data-img="${item.imageUrl}">
                                    <img src="${item.imageUrl}" alt="${item.title}">
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    afterRender() {
        const canvas = document.getElementById('combo-canvas');
        const draggables = document.querySelectorAll('.closet-item-mini');
        const saveBtn = document.getElementById('btn-save-combo');

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
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));

            // Remove placeholder
            const placeholder = canvas.querySelector('.canvas-placeholder');
            if (placeholder) placeholder.remove();

            // Create canvas item
            const img = document.createElement('img');
            img.src = data.img;
            img.className = 'canvas-item';
            img.style.position = 'absolute';
            img.style.left = `${e.offsetX - 50}px`;
            img.style.top = `${e.offsetY - 50}px`;
            img.style.width = '100px';

            // Basic drag within canvas (simplified)
            this.makeDraggable(img);

            canvas.appendChild(img);
        });

        saveBtn.addEventListener('click', () => {
            alert("Combo saving coming soon!");
        });
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
