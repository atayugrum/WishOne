import { authService } from '../services/AuthService.js';
import { firestoreService } from '../services/FirestoreService.js';
import { i18n } from '../services/LocalizationService.js';
import { apiCall } from '../config/api.js'; 
import { premiumModal } from '../components/PremiumModal.js';
import { aiService } from '../services/AIService.js'; 

export const FriendsView = {
    render: async () => {
        const user = authService.currentUser;
        if (!user) return `<div class="view-header"><h1>Login Required</h1></div>`;

        let friends = [];
        try {
            friends = await firestoreService.getFriends(user.uid);
        } catch (e) { console.error(e); }

        window.handleAddFriend = async () => {
            const emailInput = document.getElementById('friend-email');
            const btn = document.getElementById('btn-add-friend');
            const email = emailInput.value.trim();

            if (!email) return;

            try {
                btn.innerHTML = `<span class="spinner-small"></span>`;
                btn.disabled = true;
                
                if(window.aiCompanion) window.aiCompanion.setState('thinking');

                await firestoreService.addFriend(user.uid, email);
                
                aiService.triggerReaction('friend_add', { name: 'New Friend' });

                window.showToast("Friend added!", "👋");
                document.getElementById('app').innerHTML = await FriendsView.render();
            } catch (error) {
                alert(error.message);
                if(window.aiCompanion) window.aiCompanion.say("I couldn't find them.", "error");
                btn.textContent = i18n.t('friends.add');
                btn.disabled = false;
            }
        };

        window.handleViewFriend = (friendId) => {
            sessionStorage.setItem('currentFriendId', friendId);
            window.location.hash = '#/friend-wishlist';
        };

        window.handleCheckCompatibility = async (e, friendId, friendName) => {
            e.stopPropagation(); 
            if (!authService.isPremium) { premiumModal.open(); return; }

            const card = e.target.closest('.friend-card');
            const resultDiv = document.createElement('div');
            resultDiv.className = 'glass-panel';
            resultDiv.style.marginTop = '12px';
            resultDiv.innerHTML = `<div class="loading-spinner">${i18n.t('friends.analyzing')}</div>`;
            card.after(resultDiv);
            
            if(window.aiCompanion) window.aiCompanion.say("Reading the stars...", "magic");

            try {
                const [myItems, friendItems] = await Promise.all([
                    firestoreService.getWishlist(user.uid),
                    firestoreService.getWishlist(friendId)
                ]);

                const data = await apiCall('/api/ai/compatibility', 'POST', {
                    userItems: myItems,
                    friendItems: friendItems,
                    names: { user: 'You', friend: friendName }
                });

                if(window.aiCompanion) window.aiCompanion.say("The results are in!", "presenting");

                resultDiv.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <strong>${i18n.t('friends.compat_score')}: ${data.score}%</strong>
                        <button class="btn-text" onclick="this.parentElement.parentElement.remove()">&times;</button>
                    </div>
                    <p style="font-size:0.9rem; margin-top:8px;">${data.summary}</p>
                    <div style="margin-top:8px; display:flex; gap:4px; flex-wrap:wrap;">
                        ${data.sharedInterests.map(t => `<span class="tag" style="font-size:0.7rem;">${t}</span>`).join('')}
                    </div>
                `;
            } catch (error) {
                resultDiv.innerHTML = `<p style="color:red; font-size:0.8rem;">${i18n.t('ai.error')}</p>`;
                if(window.aiCompanion) window.aiCompanion.say("I got confused.", "error");
                setTimeout(() => resultDiv.remove(), 2000);
            }
        };

        const friendsListHtml = friends.length > 0
            ? friends.map(friend => `
                <div class="glass-panel friend-card" onclick="window.handleViewFriend('${friend.uid}')" style="cursor:pointer; display:flex; align-items:center; padding:16px; margin-bottom:16px; gap:16px; transition:transform 0.2s; position:relative;">
                    <img src="${friend.avatarUrl || 'https://placehold.co/100'}" style="width:50px; height:50px; border-radius:50%; object-fit:cover;">
                    <div style="flex:1;">
                        <h3 style="margin:0; font-size:1rem;">${friend.displayName}</h3>
                        <p style="margin:0; font-size:0.8rem; color:var(--text-secondary);">${friend.email}</p>
                    </div>
                    <button class="btn-text" onclick="window.handleCheckCompatibility(event, '${friend.uid}', '${friend.displayName}')" style="font-size:1.2rem;" title="${i18n.t('friends.compatibility')}">🔮</button>
                    <div style="font-size:1.2rem; color:var(--text-tertiary);">➔</div>
                </div>
            `).join('')
            : `
            <div class="glass-panel empty-state-card" style="margin-top:0;">
                <span class="empty-icon">👋</span>
                <h3 class="empty-title">${i18n.t('friends.empty')}</h3>
            </div>
            `;

        return `
            <div class="view-header">
                <h1>${i18n.t('friends.title')}</h1>
                <p>${i18n.t('friends.subtitle')}</p>
            </div>

            <div style="max-width: 600px; margin: 0 auto;">
                <div class="glass-panel" style="padding: 24px; margin-bottom: 32px; display:flex; gap:12px; align-items:center;">
                    <input type="email" id="friend-email" placeholder="${i18n.t('friends.add_placeholder')}" style="flex:1; margin:0;">
                    <button id="btn-add-friend" class="btn-primary" onclick="window.handleAddFriend()">${i18n.t('friends.add')}</button>
                </div>
                <div class="friends-list">${friendsListHtml}</div>
            </div>
        `;
    }
};