/* public/js/views/InspoView.js */
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
                <div class="glass-panel board-card create-card" id="btn-create-board-trigger" style="display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:200px; border: 2px dashed rgba(0,0,0,0.1); background: rgba(255,255,255,0.4); cursor:pointer; transition:all 0.3s;">
                    <div style="font-size:3rem; color:var(--accent-color); margin-bottom:8px;">+</div>
                    <div style="font-weight:600; color:var(--text-secondary);">${i18n.t('inspo.create')}</div>
                </div>
                <div class="loading-spinner">${i18n.t('common.loading')}</div>
            </div>

            <div id="create-board-modal" class="modal-overlay" style="z-index: 1100;">
                <div class="modal-content">
                    <div class="modal-header"><h3>New Board</h3><button class="close-btn close-create-board">&times;</button></div>
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
                                <option value="unlisted">🌍 Unlisted (Link)</option>
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

        const showModal = (el) => { if (el) { el.style.display = 'flex'; void el.offsetWidth; el.classList.add('active'); } };
        const hideModal = (el) => { if (el) { el.classList.remove('active'); setTimeout(() => el.style.display = 'none', 300); } };

        // --- BOARD OVERVIEW ---
        if (!activeBoard) {
            const container = document.getElementById('boards-container');
            const createModal = document.getElementById('create-board-modal');
            const createForm = document.getElementById('create-board-form');
            const createTrigger = document.getElementById('btn-create-board-trigger');

            if (createTrigger) createTrigger.onclick = () => showModal(createModal);
            document.querySelectorAll('.close-create-board').forEach(b => b.onclick = () => hideModal(createModal));

            if (createForm) {
                createForm.onsubmit = async (e) => {
                    e.preventDefault();
                    const fd = new FormData(createForm);
                    try {
                        await firestoreService.createBoard(user.uid, fd.get('title'), null, fd.get('privacy'));
                        aiService.triggerReaction('create_board', { title: fd.get('title') });
                        hideModal(createModal);
                        InspoView.refresh();
                    } catch (err) { alert("Error creating board."); }
                };
            }

            try {
                // Pass user.uid to see own private boards
                const boards = await firestoreService.getBoards(user.uid, user.uid);
                
                const createCardHTML = createTrigger ? createTrigger.outerHTML : '';

                const boardCardsHTML = boards.map(board => {
                    const previews = board.previewImages || [];
                    if (previews.length === 0 && board.coverUrl) previews.push(board.coverUrl);
                    
                    let previewHTML = '';
                    if (previews.length === 0) {
                        previewHTML = `<div class="board-cover-placeholder"></div>`;
                    } else if (previews.length === 1) {
                        previewHTML = `<div class="board-cover" style="background-image:url('${previews[0]}');"></div>`;
                    } else {
                        const imgs = previews.slice(0, 4).map(url => `<div style="background-image:url('${url}');"></div>`).join('');
                        previewHTML = `<div class="board-preview-grid count-${previews.length}">${imgs}</div>`;
                    }

                    return `
                        <div class="glass-panel board-card" data-id="${board.id}">
                            ${previewHTML}
                            <div class="board-info">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <h3 style="margin:0; font-size:1.1rem;">${board.title}</h3>
                                    <span style="font-size:0.9rem;">
                                        ${board.privacy === 'private' ? '🔒' : (board.privacy === 'friends' ? '👥' : '🌍')}
                                    </span>
                                </div>
                                <p style="margin:4px 0 0; font-size:0.8rem; color:var(--text-tertiary);">${board.pinCount || 0} pins</p>
                            </div>
                        </div>
                    `;
                }).join('');

                container.innerHTML = createCardHTML + boardCardsHTML;

                document.getElementById('btn-create-board-trigger').onclick = () => showModal(createModal);

                container.querySelectorAll('.board-card:not(.create-card)').forEach(card => {
                    card.onclick = () => {
                        const board = boards.find(b => b.id === card.dataset.id);
                        if (board) { activeBoard = board; InspoView.refresh(); }
                    };
                });

            } catch (e) { console.error("Board load error", e); }
            return;
        }

        // --- BOARD DETAIL ---
        const backBtn = document.getElementById('btn-back-boards');
        const settingsBtn = document.getElementById('btn-board-settings');
        const aiBtn = document.getElementById('btn-ai-vibe');
        const settingsModal = document.getElementById('board-settings-modal');
        const addPinModal = document.getElementById('add-pin-modal');
        const aiContainer = document.getElementById('ai-suggestions-container');

        if (backBtn) backBtn.onclick = () => { activeBoard = null; InspoView.refresh(); };

        if (settingsBtn) settingsBtn.onclick = () => {
            document.getElementById('board-title-input').value = activeBoard.title;
            document.getElementById('board-cover-input').value = activeBoard.coverUrl;
            document.getElementById('board-privacy-input').value = activeBoard.privacy || 'private';
            showModal(settingsModal);
        };

        // Open Add Modal Function
        const openAddModal = () => {
            showModal(addPinModal);
            renderPinSource('wishlist');
        };

        // Load Data
        let pins = [], wishlist = [], closet = [];
        try {
            [pins, wishlist, closet] = await Promise.all([
                firestoreService.getPins(activeBoard.id),
                firestoreService.getWishlist(user.uid, user.uid),
                firestoreService.getCloset(user.uid)
            ]);
        } catch (e) { console.error(e); }

        const pinsGrid = document.getElementById('pins-grid');
        
        if (pinsGrid) {
            // ** 1. "Add Pin" Tile Template **
            // This tile sits inside the grid as the first item
            const addTileHTML = `
                <div class="glass-panel pin-item add-pin-tile" id="tile-add-pin" style="
                    display:flex; 
                    flex-direction:column; 
                    align-items:center; 
                    justify-content:center; 
                    aspect-ratio: 1; 
                    border: 2px dashed rgba(0,0,0,0.1); 
                    background: rgba(255,255,255,0.4); 
                    cursor:pointer; 
                    margin-bottom:16px; 
                    border-radius:16px;">
                    <div style="font-size:2.5rem; color:var(--accent-color); margin-bottom:4px;">+</div>
                    <div style="font-size:0.9rem; font-weight:600; color:var(--text-secondary);">Add Pin</div>
                </div>
            `;

            if (pins.length === 0) {
                // ** Empty State **
                // Center the message, but maybe still provide the add action clearly
                pinsGrid.style.display = 'flex';
                pinsGrid.style.flexDirection = 'column';
                pinsGrid.style.alignItems = 'center';
                pinsGrid.style.justifyContent = 'center';
                pinsGrid.style.minHeight = '50vh';
                
                pinsGrid.innerHTML = `
                    <div style="text-align:center; animation: fadeUp 0.5s ease-out;">
                        <div style="font-size:4rem; margin-bottom:16px;">🎨</div>
                        <h3 style="margin-bottom:8px;">Start your vision</h3>
                        <p style="color:var(--text-secondary); margin-bottom:24px;">This board is waiting for inspiration.</p>
                        <button class="btn-primary" id="btn-empty-add-main" style="padding:12px 32px;">+ Add First Pin</button>
                    </div>
                `;
                
                const emptyBtn = document.getElementById('btn-empty-add-main');
                if(emptyBtn) emptyBtn.onclick = openAddModal;

            } else {
                // ** Grid State **
                // Reset grid styles if coming from empty state
                pinsGrid.style.display = 'block'; 
                pinsGrid.style.minHeight = 'auto';

                const pinsHTML = pins.map((pin, idx) => `
                    <div class="glass-panel pin-item stagger-item" style="animation-delay:${Math.min(idx * 50, 500)}ms; margin-bottom:16px; border-radius:16px; overflow:hidden; position:relative;">
                        <img src="${pin.imageUrl}" style="width:100%; display:block;">
                        <div class="pin-actions">
                            ${pin.refId ? `<button class="icon-btn btn-view-link" data-id="${pin.refId}">🔗</button>` : ''}
                            <button class="icon-btn btn-delete-pin" data-id="${pin.id}">&times;</button>
                        </div>
                    </div>
                `).join('');

                // Prepend the Add Tile
                pinsGrid.innerHTML = addTileHTML + pinsHTML;

                // Bind Add Tile
                const addTile = document.getElementById('tile-add-pin');
                if(addTile) addTile.onclick = openAddModal;

                // Bind Actions
                pinsGrid.querySelectorAll('.btn-view-link').forEach(btn => {
                    btn.onclick = (e) => {
                        e.stopPropagation();
                        const item = [...wishlist, ...closet].find(i => i.id === btn.dataset.id);
                        if (item) addItemModal.open(item);
                    };
                });

                pinsGrid.querySelectorAll('.btn-delete-pin').forEach(btn => {
                    btn.onclick = async (e) => {
                        e.stopPropagation();
                        if (confirm("Remove this pin?")) {
                            await firestoreService.deletePin(activeBoard.id, btn.dataset.id);
                            InspoView.refresh();
                        }
                    };
                });
            }
        }

        // --- ADD PIN MODAL LOGIC ---
        const renderPinSource = (source) => {
            const grid = document.getElementById('pin-selection-grid');
            const urlInput = document.getElementById('pin-url-input-container');
            document.querySelectorAll('.pin-tab').forEach(t => t.classList.toggle('active', t.dataset.source === source));

            if (source === 'url') {
                grid.style.display = 'none';
                urlInput.style.display = 'flex';
            } else {
                grid.style.display = 'grid';
                urlInput.style.display = 'none';
                const items = source === 'wishlist' ? wishlist : closet;
                if (items.length === 0) {
                    grid.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:#999;">No items found.</p>`;
                    return;
                }
                grid.innerHTML = items.map(item => `
                    <div class="pin-candidate" data-id="${item.id}" data-img="${item.imageUrl}" style="background-image:url('${item.imageUrl}');"></div>
                `).join('');

                grid.querySelectorAll('.pin-candidate').forEach(el => {
                    el.onclick = async () => {
                        hideModal(addPinModal);
                        await firestoreService.addPin(activeBoard.id, { imageUrl: el.dataset.img, refId: el.dataset.id });
                        InspoView.refresh();
                    };
                });
            }
        };

        document.querySelectorAll('.pin-tab').forEach(tab => tab.onclick = () => renderPinSource(tab.dataset.source));

        const btnAddUrl = document.getElementById('btn-add-pin-url');
        if (btnAddUrl) {
            btnAddUrl.onclick = async () => {
                const url = document.getElementById('pin-url-input').value.trim();
                if (url) {
                    hideModal(addPinModal);
                    await firestoreService.addPin(activeBoard.id, url);
                    InspoView.refresh();
                }
            };
        }

        const settingsForm = document.getElementById('edit-board-form');
        if (settingsForm) {
            settingsForm.onsubmit = async (e) => {
                e.preventDefault();
                await firestoreService.updateBoard(activeBoard.id, {
                    title: document.getElementById('board-title-input').value,
                    coverUrl: document.getElementById('board-cover-input').value,
                    privacy: document.getElementById('board-privacy-input').value
                });
                hideModal(settingsModal);
                
                const updated = await firestoreService.getBoards(user.uid, user.uid);
                activeBoard = updated.find(b => b.id === activeBoard.id);
                InspoView.refresh();
            };
        }

        const deleteBtn = document.getElementById('btn-delete-board');
        if (deleteBtn) {
            deleteBtn.onclick = async () => {
                if (confirm("Delete this board?")) {
                    await firestoreService.deleteBoard(activeBoard.id);
                    activeBoard = null;
                    InspoView.refresh();
                }
            };
        }

        if (aiBtn) {
            aiBtn.onclick = async () => {
                if (!authService.canUseFeature(FEATURES.MAGIC_ADD)) { premiumModal.open(); return; }
                aiContainer.style.display = 'block';
                aiContainer.innerHTML = 'Thinking...';
                try {
                    const res = await apiCall('/api/ai/moodboard', 'POST', { title: activeBoard.title, existingPins: pins });
                    if (res.suggestions) {
                        aiContainer.innerHTML = res.suggestions.map(s => `<span class="tag">${s.name}</span>`).join(' ');
                    }
                } catch (e) { aiContainer.innerHTML = 'AI Error'; }
            };
        }

        document.querySelectorAll('.close-btn').forEach(btn => btn.onclick = (e) => hideModal(e.target.closest('.modal-overlay')));
    },

    refresh: async () => {
        const app = document.getElementById('app');
        app.innerHTML = await InspoView.render();
        await InspoView.afterRender();
    },

    renderBoardDetail: (board) => {
        return `
            <div class="view-header" style="
                position: sticky; 
                top: 0px; 
                z-index: 100; 
                background: rgba(255,255,255,0.9); 
                backdrop-filter: blur(10px); 
                margin: -20px -20px 24px -20px; 
                padding: 20px 20px;
                border-bottom: 1px solid rgba(0,0,0,0.05);
                display:flex; 
                justify-content:space-between; 
                align-items:center;">
                
                <div style="display:flex; align-items:center; gap:12px;">
                    <button class="btn-text" id="btn-back-boards" style="font-size:1.2rem;">←</button>
                    <div>
                        <h1 style="margin:0; font-size:1.5rem;">${board.title}</h1>
                        <span style="font-size:0.8rem; color:var(--text-secondary);">${board.privacy || 'private'}</span>
                    </div>
                </div>
                <div style="display:flex; gap:8px;">
                    <button class="btn-text" id="btn-board-settings" style="font-size:1.2rem;">⚙️</button>
                    <button class="btn-magic" id="btn-ai-vibe">✨ Ideas</button>
                </div>
            </div>

            <div id="ai-suggestions-container" class="glass-panel" style="display:none; padding:12px; margin-bottom:16px;"></div>

            <div id="pins-grid" class="masonry-grid inspo-masonry">
                <div class="loading-spinner">Loading pins...</div>
            </div>

            <div id="board-settings-modal" class="modal-overlay" style="z-index: 1100;">
                <div class="modal-content">
                    <div class="modal-header"><h3>Board Settings</h3><button class="close-btn">&times;</button></div>
                    <form id="edit-board-form">
                        <div class="form-group"><label>Title</label><input id="board-title-input" required></div>
                        <div class="form-group"><label>Cover URL</label><input id="board-cover-input"></div>
                        <div class="form-group"><label>Privacy</label>
                            <select id="board-privacy-input">
                                <option value="private">Private</option>
                                <option value="friends">Friends</option>
                                <option value="unlisted">Unlisted</option>
                            </select>
                        </div>
                        <button type="submit" class="btn-primary" style="width:100%;">Save</button>
                    </form>
                    <button id="btn-delete-board" class="btn-text" style="color:red; width:100%; margin-top:16px;">Delete Board</button>
                </div>
            </div>

            <div id="add-pin-modal" class="modal-overlay" style="z-index: 1100;">
                <div class="modal-content">
                    <div class="modal-header"><h3>Add Pin</h3><button class="close-btn">&times;</button></div>
                    <div class="auth-tabs compact-tabs" style="margin-bottom:12px;">
                        <div class="auth-tab pin-tab active" data-source="wishlist">Wishlist</div>
                        <div class="auth-tab pin-tab" data-source="closet">Closet</div>
                        <div class="auth-tab pin-tab" data-source="url">URL</div>
                    </div>
                    
                    <div id="pin-url-input-container" style="display:none; gap:8px; align-items:center;">
                        <input id="pin-url-input" placeholder="https://..." style="flex:1;">
                        <button class="btn-primary" id="btn-add-pin-url">Add</button>
                    </div>

                    <div id="pin-selection-grid" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; max-height:400px; overflow-y:auto;"></div>
                </div>
            </div>
        `;
    }
};