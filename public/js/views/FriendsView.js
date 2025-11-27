import { authService } from '../services/AuthService.js';
import { firestoreService } from '../services/FirestoreService.js';
import { i18n } from '../services/LocalizationService.js';

export const FriendsView = {
    render: async () => {
        const user = authService.currentUser;
        if (!user) return `<div class="view-header"><h1>Login Required</h1></div>`;

        // 1. Fetch Friends
        let friends = [];
        try {
            friends = await firestoreService.getFriends(user.uid);
        } catch (e) {
            console.error("Error fetching friends:", e);
        }

        window.handleAddFriend = async () => {
            const emailInput = document.getElementById('friend-email');
            const btn = document.getElementById('btn-add-friend');
            const email = emailInput.value.trim();

            if (!email) return;

            try {
                btn.textContent = "Adding...";
                btn.disabled = true;
                await firestoreService.addFriend(user.uid, email);
                alert("Friend added!");
                // Refresh view
                const newContent = await FriendsView.render();
                document.getElementById('app').innerHTML = newContent;
            } catch (error) {
                alert(error.message);
                btn.textContent = "Add Friend";
                btn.disabled = false;
            }
        };

        window.handleViewFriend = (friendId) => {
            sessionStorage.setItem('currentFriendId', friendId);
            window.location.hash = '#/friend-wishlist';
        };

        const friendsListHtml = friends.length > 0
            ? friends.map(friend => `
                <div class="glass-panel friend-card" onclick="window.handleViewFriend('${friend.uid}')" style="cursor:pointer; display:flex; align-items:center; padding:16px; margin-bottom:16px; gap:16px; transition:transform 0.2s;">
                    <img src="${friend.avatarUrl || 'https://placehold.co/100'}" style="width:50px; height:50px; border-radius:50%; object-fit:cover;">
                    <div>
                        <h3 style="margin:0; font-size:1rem;">${friend.displayName}</h3>
                        <p style="margin:0; font-size:0.8rem; color:var(--text-secondary);">${friend.email}</p>
                    </div>
                    <div style="margin-left:auto; font-size:1.2rem;">➔</div>
                </div>
            `).join('')
            : `<div class="empty-state">No friends yet. Add someone!</div>`;

        return `
            <div class="view-header">
                <h1>${i18n.t('nav.friends') || 'Friends'}</h1>
                <p>Connect with others to see their wishes.</p>
            </div>

            <div style="max-width: 600px; margin: 0 auto;">
                <!-- Add Friend Section -->
                <div class="glass-panel" style="padding: 24px; margin-bottom: 32px; display:flex; gap:12px; align-items:center;">
                    <input type="email" id="friend-email" placeholder="Friend's Email" style="flex:1; margin:0;">
                    <button id="btn-add-friend" class="btn-primary" onclick="window.handleAddFriend()">Add Friend</button>
                </div>

                <!-- Friends List -->
                <div class="friends-list">
                    ${friendsListHtml}
                </div>
            </div>
        `;
    }
};
