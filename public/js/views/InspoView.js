import { authService } from '../services/AuthService.js';
import { firestoreService } from '../services/FirestoreService.js';
import { apiCall } from '../config/api.js';
import { premiumModal } from '../components/PremiumModal.js';
import { FEATURES } from '../config/limits.js';
import { i18n } from '../services/LocalizationService.js';
import { aiService } from '../services/AIService.js'; // Import AI

let activeBoard = null;

export const InspoView = {
    render: async () => {
        const user = authService.currentUser;
        if (!user) return `<div class="empty-state">Login to dream.</div>`;

        if (activeBoard) {
            return await InspoView.renderBoardDetail(activeBoard);
        }

        const boards = await firestoreService.getBoards(user.uid);

        window.openBoard = (id, title) => {
            activeBoard = { id, title };
            const app = document.getElementById('app');
            InspoView.render().then(html => app.innerHTML = html);
        };

        window.createBoardPrompt = async () => {
            const title = prompt(i18n.t('inspo.create'));
            if (title) {
                await firestoreService.createBoard(user.uid, title, null);

                // AI Reaction: Creative mood
                aiService.triggerReaction('create_board', { title: title });

                const app = document.getElementById('app');
                InspoView.render().then(html => app.innerHTML = html);
            }
        };

        const createCard = `
            <div class="glass-panel board-card create-card" onclick="window.createBoardPrompt()">
                <div class="board-cover dashed-cover">+</div>
                <div class="board-info"><h3>${i18n.t('inspo.create')}</h3></div>
            </div>
        `;

        if (boards.length === 0) {
            setTimeout(() => {
                if (window.aiCompanion) window.aiCompanion.say("This is where your vision begins.", "presenting");
            }, 500);

            return `
                <div class="view-header">
                    <h1>${i18n.t('inspo.title')}</h1>
                    <p>${i18n.t('inspo.subtitle')}</p>
                </div>
                <div class="glass-panel empty-state-card">
                    <span class="empty-icon">🎨</span>
                    <h3 class="empty-title">${i18n.t('inspo.empty')}</h3>
                    <p class="empty-text">${i18n.t('inspo.empty_desc')}</p>
                    <button class="btn-primary" onclick="window.createBoardPrompt()">${i18n.t('inspo.create_btn')}</button>
                </div>
            `;
        }

        const gridContent = boards.map(board => `
            <div class="glass-panel board-card" onclick="window.openBoard('${board.id}', '${board.title}')">
                <div class="board-cover" style="background-image: url('${board.coverUrl}')"></div>
                <div class="board-info"><h3>${board.title}</h3></div>
            </div>
        `).join('');

        return `
            <div class="view-header">
                <h1>${i18n.t('inspo.title')}</h1>
                <p>${i18n.t('inspo.subtitle')}</p>
            </div>
            <div class="boards-grid">${createCard}${gridContent}</div>
        `;
    },

    renderBoardDetail: async (board) => {
        const [pins, wishlist] = await Promise.all([
            firestoreService.getPins(board.id),
            firestoreService.getWishlist(authService.currentUser.uid)
        ]);

        window.backToBoards = () => {
            activeBoard = null;
            const app = document.getElementById('app');
            InspoView.render().then(html => app.innerHTML = html);
        };

        window.openBoardSettings = () => {
            document.getElementById('board-settings-modal').classList.add('active');
        };

        window.handleUpdateBoard = async (e) => {
            e.preventDefault();
            const newTitle = document.getElementById('board-title-input').value;
            const newCover = document.getElementById('board-cover-input').value;
            await firestoreService.updateBoard(board.id, { title: newTitle, coverUrl: newCover });
            activeBoard.title = newTitle;
            document.getElementById('board-settings-modal').classList.remove('active');
            const app = document.getElementById('app');
            InspoView.render().then(html => app.innerHTML = html);
        };

        window.handleDeleteBoard = async () => {
            if (confirm(i18n.t('common.confirm'))) {
                await firestoreService.deleteBoard(board.id);
                window.backToBoards();
            }
        };

        window.openAddPin = () => { document.getElementById('add-pin-modal').classList.add('active'); };

        window.addPinFromUrl = async () => {
            const url = prompt(i18n.t('inspo.paste_url'));
            if (url) {
                await firestoreService.addPin(board.id, url);
                if (window.aiCompanion) window.aiCompanion.say("Nice pin!", "magic", 2000);
                const app = document.getElementById('app');
                InspoView.render().then(html => app.innerHTML = html);
            }
        };

        window.addPinFromWishlist = async (imgUrl) => {
            await firestoreService.addPin(board.id, imgUrl);
            document.getElementById('add-pin-modal').classList.remove('active');
            if (window.aiCompanion) window.aiCompanion.say("Added from wishlist!", "magic", 2000);
            const app = document.getElementById('app');
            InspoView.render().then(html => app.innerHTML = html);
        };

        window.handleAiVibeCheck = async () => {
            const container = document.getElementById('ai-suggestions-container');
            if (!authService.canUseFeature(FEATURES.MAGIC_ADD)) { premiumModal.open(); return; }

            container.innerHTML = `<div class="loading-spinner">${i18n.t('common.loading')}</div>`;
            container.style.display = 'block';

            if (window.aiCompanion) window.aiCompanion.say("Let me feel the vibe...", "thinking");

            try {
                const data = await apiCall('/api/ai/moodboard', 'POST', { title: board.title, existingPins: pins });
                if (data.suggestions) {
                    if (window.aiCompanion) window.aiCompanion.say("I have some ideas!", "presenting");

                    container.innerHTML = `
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                            <strong>${i18n.t('ai.suggestion')}</strong>
                            <button class="btn-text" onclick="document.getElementById('ai-suggestions-container').style.display='none'">&times;</button>
                        </div>
                        <div style="display:flex; gap:12px; flex-wrap:wrap;">
                            ${data.suggestions.map(s => `<div class="glass-panel" style="padding:12px; flex:1; min-width:150px; background:rgba(255,255,255,0.9);"><div style="font-weight:600;">${s.name}</div><div style="font-size:0.8rem; color:var(--text-secondary); margin-top:4px;">${s.why}</div></div>`).join('')}
                        </div>
                    `;
                }
            } catch (e) {
                container.innerHTML = `<p style="color:red">${i18n.t('ai.error')}</p>`;
                if (window.aiCompanion) window.aiCompanion.say("I'm drawing a blank.", "error");
            }
        };

        const pinsHtml = pins.length > 0 ? pins.map(pin => `<div class="pin-item"><img src="${pin.imageUrl}" loading="lazy"></div>`).join('') : `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-tertiary); padding: 40px;">No pins yet.</div>`;

        return `
            <div class="view-header" style="display:flex; align-items:center; justify-content:space-between;">
                <div style="display:flex; align-items:center; gap: 16px;">
                    <button class="btn-text" onclick="window.backToBoards()" style="font-size: 1.5rem;">←</button>
                    <div><h1>${board.title} <button onclick="window.openBoardSettings()" class="btn-text" style="font-size:1rem; opacity:0.5;">⚙️</button></h1><p>${i18n.t('inspo.visual_board')}</p></div>
                </div>
                <button class="btn-magic" onclick="window.handleAiVibeCheck()">${i18n.t('inspo.ai_ideas')}</button>
            </div>
            <div id="ai-suggestions-container" class="glass-panel" style="display:none; padding:16px; margin-bottom:24px; animation:fadeUp 0.3s;"></div>
            <div class="masonry-grid inspo-masonry">${pinsHtml}</div>
            <button class="fab-add" onclick="window.openAddPin()">+</button>

            <div id="board-settings-modal" class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header"><h3>${i18n.t('inspo.settings')}</h3><button class="close-btn" onclick="document.getElementById('board-settings-modal').classList.remove('active')">&times;</button></div>
                    <form onsubmit="window.handleUpdateBoard(event)">
                        <div class="form-group"><label>Title</label><input type="text" id="board-title-input" value="${board.title}" required></div>
                        <div class="form-group"><label>Cover URL</label><input type="url" id="board-cover-input" value="${board.coverUrl}"></div>
                        <button type="submit" class="btn-primary" style="width:100%;">${i18n.t('modal.save')}</button>
                    </form>
                    <button onclick="window.handleDeleteBoard()" class="btn-text" style="color:red; width:100%; margin-top:16px;">${i18n.t('common.delete')}</button>
                </div>
            </div>

            <div id="add-pin-modal" class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header"><h3>${i18n.t('inspo.add_pin')}</h3><button class="close-btn" onclick="document.getElementById('add-pin-modal').classList.remove('active')">&times;</button></div>
                    <button class="btn-primary" onclick="window.addPinFromUrl()" style="width:100%; margin-bottom:16px;">${i18n.t('inspo.paste_url')}</button>
                    <p style="margin-bottom:8px; font-weight:600; color:var(--text-secondary);">${i18n.t('inspo.from_wishlist')}</p>
                    <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; max-height:200px; overflow-y:auto;">
                        ${wishlist.map(item => `<div onclick="window.addPinFromWishlist('${item.imageUrl}')" style="cursor:pointer; border-radius:8px; overflow:hidden; aspect-ratio:1;"><img src="${item.imageUrl}" style="width:100%; height:100%; object-fit:cover;"></div>`).join('')}
                    </div>
                </div>
            </div>
        `;
    }
};