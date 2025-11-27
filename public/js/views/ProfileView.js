// js/views/ProfileView.js
import { authService } from '../services/AuthService.js';
import { firestoreService } from '../services/FirestoreService.js';

export const ProfileView = {
    render: async () => {
        const user = authService.currentUser;
        const profile = authService.userProfile;

        if (!user || !profile) return `<div class="empty-state">Please login first.</div>`;

        window.handleLogout = async () => {
            if (confirm("Are you sure you want to log out?")) {
                await authService.logout();
                window.location.reload();
            }
        };

        window.handleSaveProfile = async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-save-profile');
            const usernameInput = document.getElementById('input-username');
            const newUsername = usernameInput.value.trim();

            btn.textContent = "Saving...";
            btn.disabled = true;

            try {
                // 1. Check Username Uniqueness (if changed)
                if (newUsername !== profile.username) {
                    const isUnique = await firestoreService.checkUsernameUnique(newUsername);
                    if (!isUnique) {
                        alert("Username is already taken. Please choose another.");
                        btn.textContent = "Save Changes";
                        btn.disabled = false;
                        return;
                    }
                }

                // 2. Update Profile
                const updates = {
                    username: newUsername,
                    displayName: document.getElementById('input-name').value.trim(),
                    phoneNumber: document.getElementById('input-phone').value.trim() || null,
                    dateOfBirth: document.getElementById('input-dob').value || null
                };

                await firestoreService.updateUserProfile(user.uid, updates);

                // Update local state
                authService.userProfile = { ...authService.userProfile, ...updates };

                alert("Profile updated successfully.");

            } catch (error) {
                console.error("Profile update failed:", error);
                alert("Failed to update profile.");
            } finally {
                btn.textContent = "Save Changes";
                btn.disabled = false;
            }
        };

        return `
            <div class="view-header">
                <h1>My Profile</h1>
                <p>Manage your account settings</p>
            </div>

            <div class="glass-panel" style="max-width: 600px; margin: 0 auto; padding: 32px;">
                <div style="display: flex; flex-direction: column; align-items: center; margin-bottom: 32px;">
                    <img src="${profile.photoURL}" style="width: 100px; height: 100px; border-radius: 50%; border: 4px solid white; box-shadow: 0 4px 15px rgba(0,0,0,0.1); margin-bottom: 16px;">
                    <div style="text-align: center;">
                        <span class="tag" style="background: ${profile.plan === 'premium' ? '#FFD700' : '#E0E0E0'}; color: ${profile.plan === 'premium' ? '#5a4a00' : '#555'}; border:none;">
                            ${profile.plan === 'premium' ? '👑 Premium Member' : 'Free Member'}
                        </span>
                        <p style="margin-top: 8px; color: var(--text-secondary);">${profile.email}</p>
                    </div>
                </div>

                <form onsubmit="window.handleSaveProfile(event)">
                    <div class="form-group">
                        <label>Display Name</label>
                        <input type="text" id="input-name" value="${profile.displayName || ''}" required>
                    </div>

                    <div class="form-group">
                        <label>Username (Unique)</label>
                        <input type="text" id="input-username" value="${profile.username || ''}" required pattern="[a-zA-Z0-9_]+" title="Letters, numbers, and underscores only">
                    </div>

                    <div class="form-row">
                        <div class="form-group" style="flex: 1;">
                            <label>Phone Number</label>
                            <input type="tel" id="input-phone" value="${profile.phoneNumber || ''}" placeholder="+1 234...">
                        </div>
                        <div class="form-group" style="flex: 1;">
                            <label>Date of Birth</label>
                            <input type="date" id="input-dob" value="${profile.dateOfBirth || ''}">
                        </div>
                    </div>

                    <div style="display: flex; gap: 16px; margin-top: 24px;">
                        <button type="button" class="btn-text" onclick="window.handleLogout()" style="color: #ff3b30;">Log Out</button>
                        <button type="submit" id="btn-save-profile" class="btn-primary" style="margin-left: auto;">Save Changes</button>
                    </div>
                </form>
            </div>
        `;
    }
};