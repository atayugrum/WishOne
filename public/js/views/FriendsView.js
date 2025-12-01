/* public/js/views/FriendsView.js */
import { authService } from '../services/AuthService.js';
import { firestoreService } from '../services/FirestoreService.js';
import { FriendWishlistView } from './FriendWishlistView.js'; // For visiting

export const FriendsView = {
    render: async () => {
        return `
            <div class="view-header">
                <h1>Friends</h1>
            </div>
            
            <div class="auth-tabs" style="margin-bottom:20px;">
                <div class="auth-tab active" id="tab-my-friends">My Friends</div>
                <div class="auth-tab" id="tab-requests">Requests</div>
                <div class="auth-tab" id="tab-search">Find People</div>
            </div>

            <div id="friends-content" class="fade-in">
                <div class="loading-spinner">Loading...</div>
            </div>
        `;
    },

    afterRender: async () => {
        const user = authService.currentUser;
        if (!user) return;

        const container = document.getElementById('friends-content');
        
        // --- TABS LOGIC ---
        const tabs = {
            'tab-my-friends': () => renderMyFriends(),
            'tab-requests': () => renderRequests(),
            'tab-search': () => renderSearch()
        };

        Object.keys(tabs).forEach(id => {
            document.getElementById(id).onclick = () => {
                document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
                document.getElementById(id).classList.add('active');
                tabs[id]();
            };
        });

        // Default
        renderMyFriends();

        // --- SUB-VIEWS ---

        async function renderMyFriends() {
            container.innerHTML = '<div class="loading-spinner"></div>';
            const friends = await firestoreService.getFriends(user.uid);
            
            if (friends.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <span style="font-size:3rem;">👥</span>
                        <h3>No friends yet</h3>
                        <p>Go to "Find People" to add your friends!</p>
                    </div>`;
                return;
            }

            container.innerHTML = `<div class="list-group">${friends.map(f => `
                <div class="glass-panel list-item" style="display:flex; align-items:center; gap:12px; padding:12px;">
                    <img src="${f.avatarUrl || 'https://placehold.co/50'}" style="width:50px; height:50px; border-radius:50%; object-fit:cover;">
                    <div style="flex:1;">
                        <div style="font-weight:600;">${f.displayName}</div>
                        <div style="font-size:0.8rem; color:var(--text-tertiary);">@${f.username}</div>
                    </div>
                    <button class="btn-primary btn-visit" data-uid="${f.uid}" style="padding:6px 12px; font-size:0.85rem;">Visit</button>
                </div>
            `).join('')}</div>`;

            container.querySelectorAll('.btn-visit').forEach(btn => {
                btn.onclick = () => visitFriend(btn.dataset.uid);
            });
        }

        async function renderRequests() {
            container.innerHTML = '<div class="loading-spinner"></div>';
            const reqs = await firestoreService.getIncomingRequests(user.uid);
            
            if (reqs.length === 0) {
                container.innerHTML = `<div class="empty-state"><p>No pending requests.</p></div>`;
                return;
            }

            container.innerHTML = reqs.map(r => `
                <div class="glass-panel" style="padding:16px; margin-bottom:12px; display:flex; align-items:center; gap:12px;">
                    <img src="${r.fromPhoto || 'https://placehold.co/50'}" style="width:40px; height:40px; border-radius:50%;">
                    <div style="flex:1;">
                        <div><b>${r.fromName}</b></div>
                        <div style="font-size:0.8rem; color:var(--text-tertiary);">wants to be friends</div>
                    </div>
                    <button class="btn-primary btn-accept" data-uid="${r.fromUid}" style="background:#34C759;">✓</button>
                    <button class="btn-text btn-reject" data-uid="${r.fromUid}" style="color:#ff3b30;">✕</button>
                </div>
            `).join('');

            container.querySelectorAll('.btn-accept').forEach(btn => {
                btn.onclick = async () => {
                    await firestoreService.acceptFriendRequest(user.uid, btn.dataset.uid);
                    window.showToast('Friend added!');
                    renderRequests(); // Refresh
                };
            });

            container.querySelectorAll('.btn-reject').forEach(btn => {
                btn.onclick = async () => {
                    await firestoreService.rejectFriendRequest(user.uid, btn.dataset.uid);
                    renderRequests();
                };
            });
        }

        function renderSearch() {
            container.innerHTML = `
                <div style="margin-bottom:20px;">
                    <div class="glass-panel" style="display:flex; padding:8px 12px;">
                        <input id="user-search-input" placeholder="Search username..." style="border:none; background:transparent; width:100%; outline:none;">
                        <button id="btn-user-search">🔍</button>
                    </div>
                </div>
                <div id="search-results"></div>
            `;

            const input = document.getElementById('user-search-input');
            const btn = document.getElementById('btn-user-search');
            const results = document.getElementById('search-results');

            const doSearch = async () => {
                const term = input.value.trim();
                if (term.length < 3) return;
                results.innerHTML = '<div class="loading-spinner"></div>';
                
                try {
                    const users = await firestoreService.searchUsers(term);
                    // Filter out self
                    const filtered = users.filter(u => u.uid !== user.uid);

                    if (filtered.length === 0) {
                        results.innerHTML = `<p style="text-align:center; color:var(--text-tertiary);">No users found.</p>`;
                        return;
                    }

                    results.innerHTML = filtered.map(u => `
                        <div class="glass-panel" style="display:flex; align-items:center; gap:12px; padding:12px; margin-bottom:8px;">
                            <img src="${u.photoURL || 'https://placehold.co/50'}" style="width:40px; height:40px; border-radius:50%;">
                            <div style="flex:1;">
                                <div style="font-weight:600;">${u.displayName}</div>
                                <div style="font-size:0.8rem;">@${u.username}</div>
                            </div>
                            <button class="btn-primary btn-add-friend" data-username="${u.username}">+ Add</button>
                        </div>
                    `).join('');

                    results.querySelectorAll('.btn-add-friend').forEach(b => {
                        b.onclick = async () => {
                            try {
                                b.disabled = true;
                                b.innerText = '...';
                                await firestoreService.sendFriendRequest(user.uid, b.dataset.username);
                                b.innerText = 'Sent';
                                window.showToast('Request sent');
                            } catch (err) {
                                alert(err.message);
                                b.disabled = false;
                                b.innerText = '+ Add';
                            }
                        };
                    });

                } catch (e) { results.innerHTML = 'Error searching.'; }
            };

            btn.onclick = doSearch;
            input.onkeypress = (e) => { if (e.key === 'Enter') doSearch(); };
        }

        async function visitFriend(friendUid) {
            // Quick router switch hack for MVP
            const app = document.getElementById('app');
            app.innerHTML = await FriendWishlistView.render(friendUid);
            await FriendWishlistView.afterRender(friendUid);
        }
    }
};