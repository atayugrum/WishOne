// js/services/AuthService.js
import { auth, googleProvider, db } from '../config/firebase-config.js';
import {
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
            // 1. Create Auth User
            const result = await createUserWithEmailAndPassword(auth, email, password);
            const user = result.user;

            // 2. Update Auth Profile (Display Name)
            await updateProfile(user, {
                displayName: fullName,
                photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`
            });

            // The init() listener will detect this and create the Firestore profile
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
                    // Basic heuristic for default username
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
        await setDoc(userRef, { plan: 'premium' }, { merge: true });
        if (this.userProfile) this.userProfile.plan = 'premium';
    }
}

export const authService = new AuthService();