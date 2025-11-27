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
            // The init listener will handle the DB saving, so we just return here
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
        // No reload needed, app.js handles it
    }

    // THIS IS THE FIXED PART
    init(callback) {
        onAuthStateChanged(auth, async (user) => {
            this.currentUser = user;
            
            if (user) {
                const userRef = doc(db, "users", user.uid);
                const snapshot = await getDoc(userRef);

                if (snapshot.exists()) {
                    // Profile exists, load it
                    this.userProfile = snapshot.data();
                } else {
                    // CRITICAL FIX: User logged in but has no DB profile. Create it now.
                    console.log("Creating missing profile for existing user...");
                    const newProfile = {
                        uid: user.uid,
                        email: user.email,
                        displayName: user.displayName,
                        photoURL: user.photoURL,
                        partnerId: null,
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
}

export const authService = new AuthService();