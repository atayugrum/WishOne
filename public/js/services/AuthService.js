// js/services/AuthService.js
import { auth, googleProvider, db } from '../config/firebase-config.js';
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
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
            console.error("Login failed:", error);
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
                    const newProfile = {
                        uid: user.uid,
                        email: user.email,
                        displayName: user.displayName,
                        photoURL: user.photoURL,
                        username: user.email.split('@')[0],
                        firstName: user.displayName ? user.displayName.split(' ')[0] : 'User',
                        lastName: user.displayName ? user.displayName.split(' ').slice(1).join(' ') : '',
                        plan: 'free',
                        friends: [],
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