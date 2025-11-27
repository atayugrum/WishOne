import { auth, googleProvider, db } from '../config/firebase-config.js';
import {
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { FEATURE_LIMITS } from '../config/limits.js';

export class AuthService {
    constructor() {
        this.currentUser = null;
        this.userProfile = null;
    }

    async login() {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            return result.user;
        } catch (error) {
            console.error("Google Login failed:", error);
            throw error;
        }
    }

    async loginWithEmail(email, password) {
        try {
            const result = await signInWithEmailAndPassword(auth, email, password);
            return result.user;
        } catch (error) {
            console.error("Email Login failed:", error);
            throw error;
        }
    }

    async registerWithEmail(email, password, fullName) {
        try {
            const result = await createUserWithEmailAndPassword(auth, email, password);
            const user = result.user;

            await updateProfile(user, {
                displayName: fullName,
                photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`
            });

            return user;
        } catch (error) {
            console.error("Registration failed:", error);
            throw error;
        }
    }

    async logout() {
        await signOut(auth);
        this.currentUser = null;
        this.userProfile = null;
        localStorage.clear(); // Clear usage logs on logout
    }

    init(callback) {
        onAuthStateChanged(auth, async (user) => {
            this.currentUser = user;

            if (user) {
                const userRef = doc(db, "users", user.uid);
                const snapshot = await getDoc(userRef);

                if (snapshot.exists()) {
                    this.userProfile = snapshot.data();
                } else {
                    console.log("Creating new user profile...");
                    const baseUsername = user.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
                    const displayName = user.displayName || 'User';

                    const newProfile = {
                        uid: user.uid,
                        email: user.email,
                        displayName: displayName,
                        photoURL: user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}`,
                        username: baseUsername,
                        firstName: displayName.split(' ')[0],
                        lastName: displayName.split(' ').slice(1).join(' '),
                        plan: 'free',
                        friends: [],
                        phoneNumber: null,
                        dateOfBirth: null,
                        createdAt: new Date()
                    };
                    await setDoc(userRef, newProfile);
                    this.userProfile = newProfile;
                }
            } else {
                this.userProfile = null;
            }

            callback(user);
        });
    }

    get isPremium() {
        return this.userProfile?.plan === 'premium';
    }

    async upgradeToPremium() {
        if (!this.currentUser) return;
        const userRef = doc(db, "users", this.currentUser.uid);
        // Mock Payment Success
        await updateDoc(userRef, {
            plan: 'premium',
            planSince: new Date()
        });
        if (this.userProfile) {
            this.userProfile.plan = 'premium';
        }
    }

    // --- USAGE LIMITS ---

    _getUsageKey(feature) {
        const today = new Date().toISOString().split('T')[0];
        return `limit_${feature}_${this.currentUser?.uid}_${today}`;
    }

    canUseFeature(feature) {
        if (this.isPremium) return true;

        const key = this._getUsageKey(feature);
        const count = parseInt(localStorage.getItem(key) || '0');
        const limit = FEATURE_LIMITS[feature.toUpperCase()] || 0;

        return count < limit;
    }

    trackFeatureUsage(feature) {
        if (this.isPremium) return;

        const key = this._getUsageKey(feature);
        const count = parseInt(localStorage.getItem(key) || '0');
        localStorage.setItem(key, count + 1);
        console.log(`tracked usage for ${feature}: ${count + 1}`);
    }

    getRemainingUsage(feature) {
        if (this.isPremium) return Infinity;
        const key = this._getUsageKey(feature);
        const count = parseInt(localStorage.getItem(key) || '0');
        const limit = FEATURE_LIMITS[feature.toUpperCase()] || 0;
        return Math.max(0, limit - count);
    }
}

export const authService = new AuthService();