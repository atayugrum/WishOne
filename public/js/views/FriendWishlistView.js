/* public/js/views/FriendWishlistView.js */
import { authService } from '../services/AuthService.js';
import { firestoreService } from '../services/FirestoreService.js';
import { FriendsView } from './FriendsView.js';

export const FriendWishlistView = {
    render: async (friendUid) => {
        return `
            <div class="view-header" style="display:flex; align-items:center; gap:12px;">
                <button class="btn-text" id="btn-back-friends" style="font-size:1.2rem;">←</button>
                <h1 id="friend-name-header">Loading...</h1>
            </div>
            
            <div id="friend-profile-card" class="glass-panel" style="padding:16px; margin-bottom:24px; display:flex; align-items:center; gap:16px;">
                <div class="skeleton-img" style="width:60px; height:60px; border-radius:50%;"></div>
                <div class="skeleton-text" style="width:150px;"></div>
            </div>

            <div class="auth-tabs" style="margin-bottom:20px;">
                <div class="auth-tab active" id="tab-f-wishlist">Wishlist</div>
                <div class="auth-tab" id="tab-f-boards">Boards</div>
            </div>

            <div id="friend-content" class="masonry-grid"></div>
        `;
    },

    afterRender: async (friendUid) => {
        const user = authService.currentUser;
        
        document.getElementById('btn-back-friends').onclick = async () => {
            // Go back to Friends List
            const app = document.getElementById('app');
            app.innerHTML = await FriendsView.render();
            await FriendsView.afterRender();
        };

        try {
            const profile = await firestoreService.getUserProfile(friendUid);
            document.getElementById('friend-name-header').innerText = profile.displayName;
            document.getElementById('friend-profile-card').innerHTML = `
                <img src="${profile.photoURL || 'https://placehold.co/60'}" style="width:60px; height:60px; border-radius:50%; object-fit:cover;">
                <div>
                    <h2 style="margin:0; font-size:1.2rem;">${profile.displayName}</h2>
                    <p style="margin:0; color:var(--text-tertiary);">@${profile.username}</p>
                    <p style="margin:4px 0 0; font-size:0.9rem;">${profile.bio || ''}</p>
                </div>
            `;

            const loadWishlist = async () => {
                const container = document.getElementById('friend-content');
                container.innerHTML = '<div class="loading-spinner"></div>';
                try {
                    // Pass friendUid as owner, user.uid as viewer
                    const items = await firestoreService.getWishlist(friendUid, user.uid);
                    
                    if (items.length === 0) {
                        container.innerHTML = `<div class="empty-state">No public wishes found.</div>`;
                        return;
                    }

                    container.innerHTML = items.map(item => `
                        <article class="glass-panel card ${item.status === 'bought' ? 'card-owned' : ''}">
                             <div class="card-img-container">
                                <img src="${item.imageUrl}" class="card-img">
                            </div>
                            <div class="card-content">
                                <h3>${item.title}</h3>
                                <div class="card-meta">
                                    <span class="tag">${item.category}</span>
                                    <span class="price">${item.price} ${item.currency}</span>
                                </div>
                                ${item.status === 'bought' ? '<span class="tag tag-urgent" style="margin-top:8px;">Bought</span>' : ''}
                            </div>
                        </article>
                    `).join('');
                } catch (e) {
                    container.innerHTML = `<div class="empty-state">${e.message}</div>`;
                }
            };

            const loadBoards = async () => {
                const container = document.getElementById('friend-content');
                container.innerHTML = '<div class="loading-spinner"></div>';
                try {
                    const boards = await firestoreService.getBoards(friendUid, user.uid);
                    
                    if (boards.length === 0) {
                        container.innerHTML = `<div class="empty-state">No public boards found.</div>`;
                        return;
                    }

                    container.innerHTML = boards.map(board => `
                        <div class="glass-panel board-card">
                            <div class="board-cover" style="background-image:url('${board.coverUrl}');"></div>
                            <div class="board-info">
                                <h3>${board.title}</h3>
                                <p>${board.pinCount || 0} pins</p>
                            </div>
                        </div>
                    `).join('');
                } catch (e) {
                    container.innerHTML = `<div class="empty-state">${e.message}</div>`;
                }
            };

            // Bind Tabs
            document.getElementById('tab-f-wishlist').onclick = (e) => {
                document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                loadWishlist();
            };
            document.getElementById('tab-f-boards').onclick = (e) => {
                document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                loadBoards();
            };

            // Init
            loadWishlist();

        } catch (e) { console.error(e); }
    }
};