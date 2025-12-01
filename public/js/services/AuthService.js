import {
    getAuth,
    signInWithPopup,
    GoogleAuthProvider,
    signOut,
    onAuthStateChanged,
    deleteUser
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from '../config/firebase-config.js';
import { LIMITS } from '../config/limits.js';

class AuthService {
    constructor() {
        this.auth = getAuth();
        this.provider = new GoogleAuthProvider();
        this.currentUser = null;
        this.userProfile = null;
    }

    // Main App Init Listener
    init(callback) {
        onAuthStateChanged(this.auth, async (user) => {
            this.currentUser = user;
            if (user) {
                this.userProfile = await this._fetchOrCreateProfile(user);
            } else {
                this.userProfile = null;
            }
            callback(this.currentUser, this.userProfile);
        });
    }

    // [FIX] Expose raw listener for other services (SettingsService)
    onAuthStateChanged(callback) {
        return onAuthStateChanged(this.auth, callback);
    }

    async loginWithGoogle() {
        try {
            const result = await signInWithPopup(this.auth, this.provider);
            return result.user;
        } catch (error) {
            console.error("Login failed", error);
            throw error;
        }
    }

    async logout() {
        await signOut(this.auth);
        window.location.reload();
    }

    async _fetchOrCreateProfile(user) {
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);

        if (snap.exists()) {
            return snap.data();
        } else {
            // Create new profile
            const newProfile = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                username: user.email.split('@')[0] + Math.floor(Math.random() * 1000), // Temp username
                createdAt: serverTimestamp(),
                isProfileComplete: false,
                userLevel: 1,
                premium: false, // Default to free
                usage: {
                    ai_planner: 0,
                    magic_add: 0,
                    ai_combos: 0
                }
            };
            await setDoc(userRef, newProfile);
            return newProfile;
        }
    }

    // --- Feature Limits (AI) ---

    canUseFeature(featureName) {
        if (!this.userProfile) return false;
        if (this.userProfile.premium) return true; // Premium has no limits

        const limit = LIMITS[featureName]; // e.g. 5
        const current = this.userProfile.usage?.[featureName] || 0;

        return current < limit;
    }

    async trackFeatureUsage(featureName) {
        if (!this.currentUser || this.userProfile.premium) return;

        const current = this.userProfile.usage?.[featureName] || 0;
        const newVal = current + 1;

        // Update local
        if (!this.userProfile.usage) this.userProfile.usage = {};
        this.userProfile.usage[featureName] = newVal;

        // Update DB
        const userRef = doc(db, "users", this.currentUser.uid);
        await updateDoc(userRef, {
            [`usage.${featureName}`]: newVal
        });
    }

    async deleteUserAccount() {
        if (!this.currentUser) return;
        try {
            await deleteUser(this.currentUser);
        } catch (error) {
            console.error("Delete user failed", error);
            // Re-auth usually required here, but keeping MVP simple
            throw error;
        }
    }

    get isPremium() {
        return this.userProfile?.premium === true;
    }
}

export const authService = new AuthService();