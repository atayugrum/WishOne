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

        return `
            <div class="view-header">
                <h1>${i18n.t('friends.title')}</h1>
                <p>${i18n.t('friends.subtitle')}</p>
            </div>

            <div style="max-width: 600px; margin: 0 auto;">
                <div class="glass-panel" style="padding: 24px; margin-bottom: 32px; display:flex; gap:12px; align-items:center;">
                    <input type="email" id="friend-email" placeholder="${i18n.t('friends.add_placeholder')}" style="flex:1; margin:0;">
                    <button id="btn-add-friend" class="btn-primary">${i18n.t('friends.add')}</button>
                </div>

                <div id="pending-requests-section" style="display:none; margin-bottom:32px;">
                    <h3 style="font-size:1rem; color:var(--accent-color); margin-bottom:12px;">💌 Pending Requests</h3>
                    <div id="requests-list"></div>
                </div>

                <div id="friends-list" class="friends-list">
                    <div class="loading-spinner">${i18n.t('common.loading')}</div>
                </div>
            </div>
        `;
    },

    afterRender: async () => {
        const user = authService.currentUser;
        if (!user) return;

        const listContainer = document.getElementById('friends-list');
        const requestsContainer = document.getElementById('pending-requests-section');
        const requestsList = document.getElementById('requests-list');
        const addBtn = document.getElementById('btn-add-friend');
        const emailInput = document.getElementById('friend-email');

        const refreshAll = async () => {
            await Promise.all([loadFriends(), loadRequests()]);
        };

        const loadRequests = async () => {
            try {
                const requests = await firestoreService.getIncomingRequests(user.uid);
                if (requests.length > 0) {
                    requestsContainer.style.display = 'block';
                    requestsList.innerHTML = requests.map(req => `
                        <div class="glass-panel" style="padding:12px; margin-bottom:10px; display:flex; align-items:center; justify-content:space-between;">
                            <div style="display:flex; align-items:center; gap:12px;">
                                <img src="${req.fromPhoto || 'https://placehold.co/100'}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">
                                <div>
                                    <div style="font-weight:600;">${req.fromName}</div>
                                    <div style="font-size:0.8rem; color:var(--text-secondary);">Wants to be friends</div>
                                </div>
                            </div>
                            <div style="display:flex; gap:8px;">
                                <button class="btn-primary" style="padding:6px 12px; font-size:0.8rem;" data-action="accept" data-uid="${req.fromUid}">Accept</button>
                                <button class="btn-text" style="color:#ff3b30; font-size:0.8rem;" data-action="reject" data-uid="${req.fromUid}">Ignore</button>
                            </div>
                        </div>
                    `).join('');
                } else {
                    requestsContainer.style.display = 'none';
                }
            } catch (e) { console.error(e); }
        };

        const loadFriends = async () => {
            try {
                const friends = await firestoreService.getFriends(user.uid);
                renderList(friends);
            } catch (e) {
                console.error(e);
                listContainer.innerHTML = `<p style="text-align:center; color:var(--text-secondary);">Error loading friends.</p>`;
            }
        };

        const renderList = (friends) => {
            if (friends.length === 0) {
                listContainer.innerHTML = `
                    <div class="glass-panel empty-state-card" style="margin-top:0;">
                        <span class="empty-icon">👋</span>
                        <h3 class="empty-title">${i18n.t('friends.empty')}</h3>
                    </div>`;
                return;
            }

            listContainer.innerHTML = friends.map(friend => `
                <div class="glass-panel friend-card" data-id="${friend.uid}" data-name="${friend.displayName}" style="cursor:pointer; display:flex; align-items:center; padding:16px; margin-bottom:16px; gap:16px; transition:transform 0.2s; position:relative;">
                    <img src="${friend.avatarUrl || 'https://placehold.co/100'}" style="width:50px; height:50px; border-radius:50%; object-fit:cover;">
                    <div style="flex:1;">
                        <h3 style="margin:0; font-size:1rem;">${friend.displayName}</h3>
                        <p style="margin:0; font-size:0.8rem; color:var(--text-secondary);">${friend.email}</p>
                    </div>
                    <button class="btn-text btn-compat" style="font-size:1.2rem;" title="${i18n.t('friends.compatibility')}">🔮</button>
                    <div style="font-size:1.2rem; color:var(--text-tertiary);">➔</div>
                </div>
            `).join('');

            listContainer.querySelectorAll('.friend-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    if (e.target.closest('.btn-compat')) {
                        e.stopPropagation();
                        handleCheckCompatibility(card, card.dataset.id, card.dataset.name);
                    } else {
                        sessionStorage.setItem('currentFriendId', card.dataset.id);
                        window.location.hash = '#/friend-wishlist';
                    }
                });
            });
        };

        const handleAddFriend = async () => {
            const email = emailInput.value.trim();
            if (!email) return;

            addBtn.innerHTML = `...`;
            addBtn.disabled = true;

            if (window.aiCompanion) window.aiCompanion.setState('thinking');

            try {
                // [UPDATE] Send Request instead of direct add
                await firestoreService.sendFriendRequest(user.uid, email);
                window.showToast("Request Sent!", "📨");
                emailInput.value = '';
                if (window.aiCompanion) window.aiCompanion.say("Request sent! Hope they accept.", "loving");
            } catch (error) {
                alert(error.message);
                if (window.aiCompanion) window.aiCompanion.say("Couldn't send request.", "error");
            } finally {
                addBtn.textContent = i18n.t('friends.add');
                addBtn.disabled = false;
            }
        };

        // Event Delegation for Requests
        requestsList.addEventListener('click', async (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            const action = btn.dataset.action;
            const uid = btn.dataset.uid;

            if (!action || !uid) return;

            btn.disabled = true;
            btn.textContent = "...";

            try {
                if (action === 'accept') {
                    await firestoreService.acceptFriendRequest(user.uid, uid);
                    window.showToast("Friend Added!", "🎉");
                    aiService.triggerReaction('friend_add', { name: 'Friend' });
                } else if (action === 'reject') {
                    await firestoreService.rejectFriendRequest(user.uid, uid);
                }
                await refreshAll();
            } catch (err) {
                console.error(err);
                alert("Action failed.");
            }
        });

        // Compatibility Logic (Unchanged but ensuring it's here)
        const handleCheckCompatibility = async (card, friendId, friendName) => {
            if (!authService.isPremium) { premiumModal.open(); return; }
            let resultDiv = card.nextElementSibling;
            if (!resultDiv || !resultDiv.classList.contains('compat-result')) {
                resultDiv = document.createElement('div');
                resultDiv.className = 'glass-panel compat-result';
                resultDiv.style.marginTop = '12px';
                card.after(resultDiv);
            }
            resultDiv.innerHTML = `<div class="loading-spinner">${i18n.t('friends.analyzing')}</div>`;
            if (window.aiCompanion) window.aiCompanion.say("Reading the stars...", "magic");

            try {
                const [myItems, friendItems] = await Promise.all([
                    firestoreService.getWishlist(user.uid),
                    firestoreService.getWishlist(friendId, user.uid)
                ]);
                const data = await apiCall('/api/ai/compatibility', 'POST', {
                    userItems: myItems, friendItems: friendItems, names: { user: 'You', friend: friendName }
                });
                if (window.aiCompanion) window.aiCompanion.say("The results are in!", "presenting");
                resultDiv.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <strong>${i18n.t('friends.compat_score')}: ${data.score}%</strong>
                        <button class="btn-text close-compat">&times;</button>
                    </div>
                    <p style="font-size:0.9rem; margin-top:8px;">${data.summary}</p>
                    <div style="margin-top:8px; display:flex; gap:4px; flex-wrap:wrap;">
                        ${data.sharedInterests.map(t => `<span class="tag" style="font-size:0.7rem;">${t}</span>`).join('')}
                    </div>`;
                resultDiv.querySelector('.close-compat').onclick = () => resultDiv.remove();
            } catch (error) {
                resultDiv.innerHTML = `<p style="color:red; font-size:0.8rem;">${i18n.t('ai.error')}</p>`;
                setTimeout(() => resultDiv.remove(), 2000);
            }
        };

        addBtn.addEventListener('click', handleAddFriend);
        refreshAll();
    }
};