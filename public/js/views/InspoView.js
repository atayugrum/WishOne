import { authService } from '../services/AuthService.js';
import { firestoreService } from '../services/FirestoreService.js';
import { apiCall } from '../config/api.js';
import { premiumModal } from '../components/PremiumModal.js';
import { FEATURES } from '../config/limits.js';
import { i18n } from '../services/LocalizationService.js';
import { aiService } from '../services/AIService.js';
import { AddItemModal } from '../components/addItemModal.js';

let activeBoard = null;
let addItemModal = null;

export const InspoView = {
    render: async () => {
        const user = authService.currentUser;
        if (!user) return `<div class="empty-state">Login to dream.</div>`;

        if (activeBoard) {
            return InspoView.renderBoardDetail(activeBoard);
        }

        return `
            <div class="view-header">
                <h1>${i18n.t('inspo.title')}</h1>
                <p>${i18n.t('inspo.subtitle')}</p>
            </div>
            <div id="boards-container" class="boards-grid">
                <div class="glass-panel board-card create-card" id="btn-create-board-trigger">
                    <div class="board-cover dashed-cover">+</div>
                    <div class="board-info"><h3>${i18n.t('inspo.create')}</h3></div>
                </div>
                <div class="loading-spinner">${i18n.t('common.loading')}</div>
            </div>

            <div id="create-board-modal" class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header"><h3>${i18n.t('inspo.create')}</h3><button class="close-btn close-create-board">&times;</button></div>
                    <form id="create-board-form">
                        <div class="form-group">
                            <label>Title</label>
                            <input type="text" name="title" required placeholder="Summer Vibes">
                        </div>
                        <div class="form-group">
                            <label>Privacy</label>
                            <select name="privacy">
                                <option value="private">🔒 Private</option>
                                <option value="friends">👥 Friends Only</option>
                                <option value="public">🌍 Public / Unlisted</option>
                            </select>
                        </div>
                        <button type="submit" class="btn-primary" style="width:100%;">Create Board</button>
                    </form>
                </div>
            </div>
        `;
    },

    afterRender: async () => {
        const user = authService.currentUser;
        if (!user) return;

        if (!addItemModal) addItemModal = new AddItemModal(() => {
            window.showToast(i18n.t('common.success'), "✨");
        });

        // --- BOARD LIST LOGIC ---
        if (!activeBoard) {
            const container = document.getElementById('boards-container');
            const createBtnTrigger = document.getElementById('btn-create-board-trigger');
            const createModal = document.getElementById('create-board-modal');
            const createForm = document.getElementById('create-board-form');

            // Open Modal
            if (createBtnTrigger) {
                createBtnTrigger.addEventListener('click', () => {
                    createModal.style.display = 'flex';
                    requestAnimationFrame(() => createModal.classList.add('active'));
                });
            }

            // Close Modal
            document.querySelectorAll('.close-create-board').forEach(el => {
                el.onclick = () => {
                    createModal.classList.remove('active');
                    setTimeout(() => createModal.style.display = 'none', 300);
                }
            });

            // Handle Create
            if (createForm) {
                createForm.onsubmit = async (e) => {
                    e.preventDefault();
                    const formData = new FormData(createForm);
                    const title = formData.get('title');
                    const privacy = formData.get('privacy');

                    try {
                        await firestoreService.createBoard(user.uid, title, null, privacy);
                        aiService.triggerReaction('create_board', { title: title });
                        createModal.classList.remove('active');
                        setTimeout(() => createModal.style.display = 'none', 300);
                        InspoView.refresh();
                    } catch (err) {
                        alert("Error creating board.");
                    }
                };
            }

            try {
                const boards = await firestoreService.getBoards(user.uid);

                const boardCards = boards.map(board => `
                    <div class="glass-panel board-card" data-id="${board.id}">
                        <div class="board-cover" style="background-image: url('${board.coverUrl}')"></div>
                        <div class="board-info">
                            <div style="display:flex; justify-content:space-between;">
                                <h3>${board.title}</h3>
                                <span style="font-size:0.8rem; opacity:0.6;">${board.privacy === 'private' ? '🔒' : (board.privacy === 'friends' ? '👥' : '🌍')}</span>
                            </div>
                        </div>
                    </div>
                `).join('');

                if (container && createBtnTrigger) {
                    container.innerHTML = createBtnTrigger.outerHTML + boardCards;

                    // Re-bind Trigger
                    document.getElementById('btn-create-board-trigger').addEventListener('click', () => {
                        createModal.style.display = 'flex';
                        requestAnimationFrame(() => createModal.classList.add('active'));
                    });
                }

                container.querySelectorAll('.board-card:not(.create-card)').forEach(card => {
                    card.addEventListener('click', () => {
                        const board = boards.find(b => b.id === card.dataset.id);
                        if (board) {
                            activeBoard = board;
                            InspoView.refresh();
                        }
                    });
                });

            } catch (e) { console.error(e); }
            return;
        }

        // --- BOARD DETAIL LOGIC ---
        const backBtn = document.getElementById('btn-back-boards');
        const settingsBtn = document.getElementById('btn-board-settings');
        const aiBtn = document.getElementById('btn-ai-vibe');
        const fabAdd = document.getElementById('fab-add-pin');
        const addPinModal = document.getElementById('add-pin-modal');
        const aiContainer = document.getElementById('ai-suggestions-container');
        const settingsModal = document.getElementById('board-settings-modal');

        if (backBtn) backBtn.onclick = () => { activeBoard = null; InspoView.refresh(); };

        if (settingsBtn) settingsBtn.onclick = () => {
            settingsModal.classList.add('active');
            document.getElementById('board-title-input').value = activeBoard.title;
            document.getElementById('board-cover-input').value = activeBoard.coverUrl;
            // Select privacy
            const privacySelect = document.getElementById('board-privacy-input');
            if (privacySelect) privacySelect.value = activeBoard.privacy || 'private';
        };

        const openAddModal = () => {
            addPinModal.classList.add('active');
            const grid = document.getElementById('pin-selection-grid');
            if (grid && !grid.hasChildNodes()) {
                grid.innerHTML = `<div class="loading-spinner">${i18n.t('common.loading')}</div>`;
            }
        };

        if (fabAdd) fabAdd.onclick = openAddModal;

        const [pins, wishlist, closet] = await Promise.all([
            firestoreService.getPins(activeBoard.id),
            firestoreService.getWishlist(user.uid, user.uid),
            firestoreService.getCloset(user.uid)
        ]);

        const pinsGrid = document.getElementById('pins-grid');
        if (pinsGrid) {
            if (pins.length > 0) {
                pinsGrid.innerHTML = pins.map(pin => `
                    <div class="pin-item glass-panel" style="position:relative; overflow:hidden; border-radius:12px; margin-bottom:16px; break-inside: avoid;">
                        <img src="${pin.imageUrl}" loading="lazy" style="width:100%; display:block;">
                        <div class="pin-actions" style="position:absolute; top:10px; right:10px; opacity:0; transition:0.2s; display:flex; gap:8px;">
                             <button class="icon-btn btn-make-wish" data-img="${pin.imageUrl}" title="Make Wish" style="background:rgba(255,255,255,0.9); border-radius:50%; width:36px; height:36px; font-size:1rem; box-shadow:0 4px 10px rgba(0,0,0,0.1);">✨</button>
                        </div>
                    </div>
                `).join('');

                const style = document.createElement('style');
                style.innerHTML = `.pin-item:hover .pin-actions { opacity: 1; }`;
                document.head.appendChild(style);

                pinsGrid.querySelectorAll('.btn-make-wish').forEach(btn => {
                    btn.onclick = (e) => {
                        e.stopPropagation();
                        addItemModal.open({ imageUrl: btn.dataset.img, title: '', price: '' });
                    };
                });

            } else {
                pinsGrid.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; color: var(--text-tertiary); padding: 40px; display:flex; flex-direction:column; align-items:center; gap:16px;">
                        <p>No pins yet.</p>
                        <button class="btn-primary" id="btn-empty-add">${i18n.t('inspo.add_pin')}</button>
                    </div>
                `;
                document.getElementById('btn-empty-add').onclick = openAddModal;
            }
        }

        const pinContainer = document.getElementById('pin-selection-grid');
        const urlContainer = document.getElementById('pin-url-input-container');

        renderPinSource('wishlist');

        document.querySelectorAll('.pin-tab').forEach(tab => {
            tab.onclick = () => {
                document.querySelectorAll('.pin-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                renderPinSource(tab.dataset.source);
            };
        });

        function renderPinSource(source) {
            urlContainer.style.display = 'none';
            pinContainer.style.display = 'grid';
            pinContainer.innerHTML = '';

            if (source === 'url') {
                urlContainer.style.display = 'flex';
                pinContainer.style.display = 'none';
            } else if (source === 'wishlist') {
                renderItems(wishlist);
            } else if (source === 'closet') {
                renderItems(closet);
            }
        }

        function renderItems(items) {
            if (items.length === 0) {
                pinContainer.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:var(--text-tertiary);">No items found.</p>`;
                return;
            }
            pinContainer.innerHTML = items.map(item => `
                <div class="pin-candidate" data-img="${item.imageUrl}" style="cursor:pointer; border-radius:8px; overflow:hidden; aspect-ratio:1; position:relative; border:1px solid rgba(0,0,0,0.1);">
                    <img src="${item.imageUrl}" style="width:100%; height:100%; object-fit:cover;">
                    <div style="position:absolute; bottom:0; left:0; right:0; background:rgba(255,255,255,0.8); padding:4px; font-size:0.7rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.title}</div>
                </div>
            `).join('');

            pinContainer.querySelectorAll('.pin-candidate').forEach(el => {
                el.onclick = () => addPin(el.dataset.img);
            });
        }

        const btnAddUrl = document.getElementById('btn-add-pin-url');
        if (btnAddUrl) {
            btnAddUrl.onclick = async () => {
                const url = document.getElementById('pin-url-input').value.trim();
                if (url) await addPin(url);
            };
        }

        async function addPin(imageUrl) {
            addPinModal.classList.remove('active');
            await firestoreService.addPin(activeBoard.id, imageUrl);
            if (window.aiCompanion) window.aiCompanion.say("Added to board!", "magic");
            InspoView.refresh();
        }

        const editForm = document.getElementById('edit-board-form');
        if (editForm) {
            editForm.onsubmit = async (e) => {
                e.preventDefault();
                const newTitle = document.getElementById('board-title-input').value;
                const newCover = document.getElementById('board-cover-input').value;
                const newPrivacy = document.getElementById('board-privacy-input').value;

                await firestoreService.updateBoard(activeBoard.id, { title: newTitle, coverUrl: newCover, privacy: newPrivacy });

                activeBoard.title = newTitle;
                activeBoard.coverUrl = newCover;
                activeBoard.privacy = newPrivacy;

                settingsModal.classList.remove('active');
                InspoView.refresh();
            };
        }

        const coverUpload = document.getElementById('board-cover-upload');
        const coverInput = document.getElementById('board-cover-input');
        const triggerCover = document.getElementById('btn-trigger-cover');

        if (triggerCover) triggerCover.onclick = () => coverUpload.click();

        if (coverUpload) {
            coverUpload.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        coverInput.value = ev.target.result;
                    };
                    reader.readAsDataURL(file);
                }
            };
        }

        const btnDelete = document.getElementById('btn-delete-board');
        if (btnDelete) {
            btnDelete.onclick = async () => {
                if (confirm(i18n.t('common.confirm'))) {
                    await firestoreService.deleteBoard(activeBoard.id);
                    activeBoard = null;
                    InspoView.refresh();
                }
            };
        }

        if (aiBtn) {
            aiBtn.onclick = async () => {
                if (!authService.canUseFeature(FEATURES.MAGIC_ADD)) { premiumModal.open(); return; }
                aiContainer.innerHTML = `<div class="loading-spinner">${i18n.t('common.loading')}</div>`;
                aiContainer.style.display = 'block';
                if (window.aiCompanion) window.aiCompanion.say("Feeling the vibe...", "thinking");

                try {
                    const data = await apiCall('/api/ai/moodboard', 'POST', { title: activeBoard.title, existingPins: pins });
                    if (data.suggestions) {
                        if (window.aiCompanion) window.aiCompanion.say("Try these ideas!", "presenting");
                        aiContainer.innerHTML = `
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                                <strong>${i18n.t('ai.suggestion')}</strong>
                                <button class="btn-text close-ai">&times;</button>
                            </div>
                            <div style="display:flex; gap:12px; flex-wrap:wrap;">
                                ${data.suggestions.map(s => `<div class="glass-panel" style="padding:12px; flex:1; min-width:150px; background:rgba(255,255,255,0.9);"><div style="font-weight:600;">${s.name}</div><div style="font-size:0.8rem; color:var(--text-secondary); margin-top:4px;">${s.why}</div></div>`).join('')}
                            </div>
                        `;
                        aiContainer.querySelector('.close-ai').onclick = () => aiContainer.style.display = 'none';
                    }
                } catch (e) {
                    aiContainer.innerHTML = `<p style="color:red">${i18n.t('ai.error')}</p>`;
                    setTimeout(() => aiContainer.style.display = 'none', 2000);
                }
            };
        }

        document.querySelectorAll('.close-btn').forEach(btn => {
            btn.onclick = (e) => e.target.closest('.modal-overlay').classList.remove('active');
        });
    },

    refresh: async () => {
        const app = document.getElementById('app');
        app.innerHTML = await InspoView.render();
        await InspoView.afterRender();
    },

    renderBoardDetail: (board) => {
        return `
            <div class="view-header" style="display:flex; align-items:center; justify-content:space-between;">
                <div style="display:flex; align-items:center; gap: 16px;">
                    <button class="btn-text" id="btn-back-boards" style="font-size: 1.5rem;">←</button>
                    <div>
                        <h1>${board.title} <button id="btn-board-settings" class="btn-text" style="font-size:1rem; opacity:0.5;">⚙️</button></h1>
                        <p>${i18n.t('inspo.visual_board')} <span style="font-size:0.8rem; margin-left:8px; opacity:0.6;">${board.privacy === 'private' ? '🔒 Private' : (board.privacy === 'friends' ? '👥 Friends' : '🌍 Public')}</span></p>
                    </div>
                </div>
                <button class="btn-magic" id="btn-ai-vibe">${i18n.t('inspo.ai_ideas')}</button>
            </div>

            <div id="ai-suggestions-container" class="glass-panel" style="display:none; padding:16px; margin-bottom:24px; animation:fadeUp 0.3s;"></div>
            
            <div class="masonry-grid inspo-masonry" id="pins-grid">
                <div class="loading-spinner">${i18n.t('common.loading')}</div>
            </div>
            
            <button class="fab-add" id="fab-add-pin">+</button>

            <div id="board-settings-modal" class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header"><h3>${i18n.t('inspo.settings')}</h3><button class="close-btn">&times;</button></div>
                    <form id="edit-board-form">
                        <div class="form-group"><label>Title</label><input type="text" id="board-title-input" required></div>
                        <div class="form-group">
                            <label>Cover Image</label>
                            <div style="display:flex; gap:8px;">
                                <input type="text" id="board-cover-input" placeholder="https://..." style="flex:1;">
                                <input type="file" id="board-cover-upload" accept="image/*" style="display:none;">
                                <button type="button" class="btn-primary" id="btn-trigger-cover">📷</button>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Privacy</label>
                            <select id="board-privacy-input">
                                <option value="private">🔒 Private</option>
                                <option value="friends">👥 Friends Only</option>
                                <option value="public">🌍 Public / Unlisted</option>
                            </select>
                        </div>
                        <button type="submit" class="btn-primary" style="width:100%;">${i18n.t('modal.save')}</button>
                    </form>
                    <button id="btn-delete-board" class="btn-text" style="color:red; width:100%; margin-top:16px;">${i18n.t('common.delete')}</button>
                </div>
            </div>

            <div id="add-pin-modal" class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header"><h3>${i18n.t('inspo.add_pin')}</h3><button class="close-btn">&times;</button></div>
                    
                    <div class="auth-tabs compact-tabs" style="margin-bottom:16px;">
                        <div class="auth-tab pin-tab active" data-source="wishlist">Wishlist</div>
                        <div class="auth-tab pin-tab" data-source="closet">Closet</div>
                        <div class="auth-tab pin-tab" data-source="url">URL</div>
                    </div>

                    <div id="pin-url-input-container" style="display:none; gap:8px;">
                        <input type="url" id="pin-url-input" placeholder="https://..." style="flex:1;">
                        <button class="btn-primary" id="btn-add-pin-url">Add</button>
                    </div>

                    <div id="pin-selection-grid" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; max-height:300px; overflow-y:auto;"></div>
                </div>
            </div>
        `;
    }
};