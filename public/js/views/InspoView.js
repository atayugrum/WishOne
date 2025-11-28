// js/views/InspoView.js
import { authService } from '../services/AuthService.js';
import { firestoreService } from '../services/FirestoreService.js';
import { apiCall } from '../config/api.js';
import { premiumModal } from '../components/PremiumModal.js';
import { FEATURES } from '../config/limits.js';

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
            const title = prompt("Name your new board:");
            if (title) {
                await firestoreService.createBoard(user.uid, title, null);
                const app = document.getElementById('app');
                InspoView.render().then(html => app.innerHTML = html);
            }
        };

        const createCard = `
            <div class="glass-panel board-card create-card" onclick="window.createBoardPrompt()">
                <div class="board-cover dashed-cover">+</div>
                <div class="board-info">
                    <h3>New Board</h3>
                </div>
            </div>
        `;

        if (boards.length === 0) {
            return `
                <div class="view-header">
                    <h1>Inspo Boards</h1>
                    <p>Moods, vibes, and visions.</p>
                </div>
                
                <div class="glass-panel empty-state-card">
                    <span class="empty-icon">🎨</span>
                    <h3 class="empty-title">Create Your Vision</h3>
                    <p class="empty-text">Collect ideas and organize your aesthetic here.</p>
                    <button class="btn-primary" onclick="window.createBoardPrompt()">+ Create First Board</button>
                </div>
            `;
        }

        const gridContent = boards.map(board => `
            <div class="glass-panel board-card" onclick="window.openBoard('${board.id}', '${board.title}')">
                <div class="board-cover" style="background-image: url('${board.coverUrl}')"></div>
                <div class="board-info">
                    <h3>${board.title}</h3>
                    <p>Open Board →</p>
                </div>
            </div>
        `).join('');

        return `
            <div class="view-header">
                <h1>Inspo Boards</h1>
                <p>Moods, vibes, and visions.</p>
            </div>
            
            <div class="boards-grid">
                ${createCard}
                ${gridContent}
            </div>
        `;
    },

    renderBoardDetail: async (board) => {
        const pins = await firestoreService.getPins(board.id);

        window.backToBoards = () => {
            activeBoard = null;
            const app = document.getElementById('app');
            InspoView.render().then(html => app.innerHTML = html);
        };

        window.addPinPrompt = async () => {
            const url = prompt("Paste image URL:");
            if (url) {
                await firestoreService.addPin(board.id, url);
                window.openBoard(board.id, board.title);
            }
        };

        // Task 4.1: AI Vibe Check Logic
        window.handleAiVibeCheck = async () => {
            const container = document.getElementById('ai-suggestions-container');

            if (!authService.canUseFeature(FEATURES.MAGIC_ADD)) { // Reuse limit for now
                premiumModal.open();
                return;
            }

            container.innerHTML = `<div class="loading-spinner">Analyzing vibe...</div>`;
            container.style.display = 'block';

            try {
                const data = await apiCall('/api/ai/moodboard', 'POST', {
                    title: board.title,
                    existingPins: pins // Send context
                });

                if (data.suggestions) {
                    container.innerHTML = `
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                            <strong>AI Ideas for "${board.title}"</strong>
                            <button class="btn-text" onclick="document.getElementById('ai-suggestions-container').style.display='none'">&times;</button>
                        </div>
                        <div style="display:flex; gap:12px; flex-wrap:wrap;">
                            ${data.suggestions.map(s => `
                                <div class="glass-panel" style="padding:12px; flex:1; min-width:150px; background:rgba(255,255,255,0.9);">
                                    <div style="font-weight:600;">${s.name}</div>
                                    <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:4px;">${s.why}</div>
                                </div>
                            `).join('')}
                        </div>
                    `;
                }
            } catch (e) {
                container.innerHTML = `<p style="color:red">AI unavailable.</p>`;
                setTimeout(() => container.style.display = 'none', 2000);
            }
        };

        const pinsHtml = pins.length > 0
            ? pins.map(pin => `
                <div class="pin-item">
                    <img src="${pin.imageUrl}" loading="lazy">
                </div>`).join('')
            : `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-tertiary); padding: 40px;">No pins yet. Add your first vibe!</div>`;

        return `
            <div class="view-header" style="display:flex; align-items:center; justify-content:space-between;">
                <div style="display:flex; align-items:center; gap: 16px;">
                    <button class="btn-text" onclick="window.backToBoards()" style="font-size: 1.5rem;">←</button>
                    <div>
                        <h1>${board.title}</h1>
                        <p>Visual Board</p>
                    </div>
                </div>
                <button class="btn-magic" onclick="window.handleAiVibeCheck()">✨ Ideas</button>
            </div>

            <div id="ai-suggestions-container" class="glass-panel" style="display:none; padding:16px; margin-bottom:24px; animation:fadeUp 0.3s;"></div>

            <div class="masonry-grid inspo-masonry">
                ${pinsHtml}
            </div>

            <button class="fab-add" onclick="window.addPinPrompt()">+</button>
        `;
    }
};