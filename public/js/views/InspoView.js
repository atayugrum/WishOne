// js/views/InspoView.js
import { authService } from '../services/AuthService.js';
import { firestoreService } from '../services/FirestoreService.js';

let activeBoard = null; // State: Which board are we looking at?

export const InspoView = {
    render: async () => {
        const user = authService.currentUser;
        if (!user) return `<div class="empty-state">Login to dream.</div>`;

        // SCENARIO A: Showing a Specific Board (The Grid)
        if (activeBoard) {
            return await InspoView.renderBoardDetail(activeBoard);
        }

        // SCENARIO B: Dashboard (List of Boards)
        const boards = await firestoreService.getBoards(user.uid);
        
        // Define handlers
        window.openBoard = (id, title) => {
            activeBoard = { id, title }; // Set state
            // Re-render the view
            const app = document.getElementById('app');
            InspoView.render().then(html => app.innerHTML = html);
        };

        window.createBoardPrompt = async () => {
            const title = prompt("Name your new board:"); // Simple for now
            if(title) {
                await firestoreService.createBoard(user.uid, title, null);
                // Refresh
                const app = document.getElementById('app');
                InspoView.render().then(html => app.innerHTML = html);
            }
        };

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
                <div class="glass-panel board-card create-card" onclick="window.createBoardPrompt()">
                    <div class="board-cover dashed-cover">+</div>
                    <div class="board-info">
                        <h3>New Board</h3>
                    </div>
                </div>
                ${gridContent}
            </div>
        `;
    },

    // Sub-render function for the pins
    renderBoardDetail: async (board) => {
        const pins = await firestoreService.getPins(board.id);

        window.backToBoards = () => {
            activeBoard = null; // Clear state
            const app = document.getElementById('app');
            InspoView.render().then(html => app.innerHTML = html);
        };

        window.addPinPrompt = async () => {
            const url = prompt("Paste image URL:");
            if(url) {
                await firestoreService.addPin(board.id, url);
                // Refresh detail view
                window.openBoard(board.id, board.title);
            }
        };

        const pinsHtml = pins.map(pin => `
            <div class="pin-item">
                <img src="${pin.imageUrl}" loading="lazy">
            </div>
        `).join('');

        return `
            <div class="view-header" style="display:flex; align-items:center; gap: 16px;">
                <button class="btn-text" onclick="window.backToBoards()" style="font-size: 1.5rem;">←</button>
                <div>
                    <h1>${board.title}</h1>
                    <p>Visual Board</p>
                </div>
            </div>

            <div class="masonry-grid inspo-masonry">
                ${pinsHtml}
            </div>

            <button class="fab-add" onclick="window.addPinPrompt()">+</button>
        `;
    }
};