import { auth, googleProvider, db } from '../config/firebase-config.js';
import {
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    updateProfile,
    deleteUser
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, getDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { FEATURE_LIMITS } from '../config/limits.js';

export class AuthService {
    constructor() {
        this.currentUser = null;
        this.userProfile = null;
        this.onAuthCallback = null;
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
        localStorage.clear(); 
    }

    async deleteUserAccount() {
        if (!this.currentUser) return;
        try {
            await deleteUser(this.currentUser);
            this.currentUser = null;
            this.userProfile = null;
            localStorage.clear();
        } catch (error) {
            console.error("Delete Account failed:", error);
            throw error;
        }
    }

    async completeProfile(data) {
        if (!this.currentUser) throw new Error("No user");
        const userRef = doc(db, "users", this.currentUser.uid);
        await updateDoc(userRef, {
            username: data.username,
            birthday: data.birthday,
            isProfileComplete: true
        });
        this.userProfile.username = data.username;
        this.userProfile.birthday = data.birthday;
        this.userProfile.isProfileComplete = true;
    }

    init(callback) {
        this.onAuthCallback = callback;
        onAuthStateChanged(auth, async (user) => {
            this.currentUser = user;

            if (user) {
                try {
                    const userRef = doc(db, "users", user.uid);
                    const snapshot = await getDoc(userRef);

                    if (snapshot.exists()) {
                        this.userProfile = snapshot.data();
                    } else {
                        console.log("Creating new user profile...");
                        const displayName = user.displayName || 'User';
                        const newProfile = {
                            uid: user.uid,
                            email: user.email,
                            displayName: displayName,
                            photoURL: user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}`,
                            plan: 'free',
                            friends: [],
                            isPrivate: false,
                            createdAt: new Date(),
                            isProfileComplete: false
                        };
                        await setDoc(userRef, newProfile);
                        this.userProfile = newProfile;
                    }
                } catch (error) {
                    console.error("Error fetching profile:", error);
                    // Fallback: allow login but maybe restricted features
                    this.userProfile = null; 
                }
            } else {
                this.userProfile = null;
            }

            // CRITICAL FIX: Always call the callback, even if profile fetch failed
            callback(user, this.userProfile);
        });
    }

    get isPremium() {
        return this.userProfile?.plan === 'premium';
    }

    async upgradeToPremium() {
        if (!this.currentUser) return;
        const userRef = doc(db, "users", this.currentUser.uid);
        await updateDoc(userRef, {
            plan: 'premium',
            planSince: new Date()
        });
        if (this.userProfile) {
            this.userProfile.plan = 'premium';
        }
    }

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
    }
}

export const authService = new AuthService();