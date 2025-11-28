// js/services/FirestoreService.js
import { db } from '../config/firebase-config.js';
import {
    collection,
    getDocs,
    addDoc,
    deleteDoc,
    updateDoc,
    setDoc,
    doc,
    getDoc,
    query,
    where,
    serverTimestamp,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export class FirestoreService {

    constructor() {
        this.itemsCollection = collection(db, 'items');
    }

    _transformItem(doc) {
        const data = doc.data();
        return {
            id: doc.id,
            title: data.title,
            price: data.price,
            currency: data.currency || 'TRY',
            category: data.category,
            subcategory: data.subcategory || null,
            priority: data.priority || 'Medium',
            occasion: data.occasion || null,
            imageUrl: data.imageUrl || 'https://placehold.co/600x400/png',
            claimedBy: data.claimedBy || null,
            originalUrl: data.originalUrl || null,
            onSale: data.onSale || false,
            ...data
        };
    }

    // --- ACTIVITY LOG (Task 3.3) ---
    async addActivity(userId, type, details) {
        try {
            await addDoc(collection(db, 'users', userId, 'activities'), {
                type, // 'add_wish', 'manifest', 'friend_add'
                details, // e.g., item title, friend name
                createdAt: serverTimestamp()
            });
        } catch (e) {
            console.warn("Failed to log activity:", e);
        }
    }

    async getRecentActivities(userId) {
        try {
            const q = query(
                collection(db, 'users', userId, 'activities'),
                orderBy('createdAt', 'desc'),
                limit(10)
            );
            const snap = await getDocs(q);
            return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (e) {
            console.warn("Failed to fetch activities:", e);
            return [];
        }
    }

    // 1. Get Wishlist
    async getWishlist(userId) {
        try {
            const q = query(
                this.itemsCollection,
                where("ownerId", "==", userId),
                where("isOwned", "==", false)
            );
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) return [];
            return querySnapshot.docs.map(doc => this._transformItem(doc));
        } catch (error) {
            console.error("Error fetching wishlist:", error);
            throw error;
        }
    }

    // 2. Add Item
    async addItem(itemData) {
        try {
            const docRef = await addDoc(this.itemsCollection, {
                ...itemData,
                createdAt: serverTimestamp(),
                lastUpdatedAt: serverTimestamp(),
                isOwned: false,
                claimedBy: null
            });
            // Log Activity
            this.addActivity(itemData.ownerId, 'add_wish', { title: itemData.title });
            return docRef.id;
        } catch (e) {
            console.error("Error adding document: ", e);
            throw e;
        }
    }

    // 2.5 Update Item
    async updateItem(itemId, updateData) {
        try {
            const itemRef = doc(db, 'items', itemId);
            await updateDoc(itemRef, {
                ...updateData,
                lastUpdatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error updating item:", error);
            throw error;
        }
    }

    async checkItemExists(userId, url) {
        if (!url) return false;
        try {
            const q = query(
                this.itemsCollection,
                where("ownerId", "==", userId),
                where("originalUrl", "==", url),
                where("isOwned", "==", false)
            );
            const snap = await getDocs(q);
            return !snap.empty;
        } catch (error) {
            return false;
        }
    }

    // 3. Delete Item
    async deleteItem(itemId) {
        try {
            const itemRef = doc(db, 'items', itemId);
            await deleteDoc(itemRef);
        } catch (error) {
            console.error("Error deleting item:", error);
            throw error;
        }
    }

    // 4. FRIEND MANAGEMENT
    async addFriend(myUid, friendEmail) {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", friendEmail));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) throw new Error("User not found.");

        const friendDoc = querySnapshot.docs[0];
        const friendId = friendDoc.id;
        const friendData = friendDoc.data();

        if (friendId === myUid) throw new Error("Cannot add yourself.");

        const myFriendRef = doc(db, "users", myUid, "friends", friendId);
        await setDoc(myFriendRef, {
            uid: friendId,
            email: friendData.email,
            displayName: friendData.displayName || "Friend",
            avatarUrl: friendData.avatarUrl || null,
            addedAt: serverTimestamp()
        });

        const myProfile = await this.getUserProfile(myUid);
        const theirFriendRef = doc(db, "users", friendId, "friends", myUid);
        await setDoc(theirFriendRef, {
            uid: myUid,
            email: myProfile.email,
            displayName: myProfile.displayName,
            avatarUrl: myProfile.avatarUrl || null,
            addedAt: serverTimestamp()
        });

        // Log Activity
        this.addActivity(myUid, 'friend_add', { name: friendData.displayName });

        return friendData;
    }

    async getFriends(userId) {
        const friendsRef = collection(db, "users", userId, "friends");
        const snap = await getDocs(friendsRef);
        return snap.docs.map(doc => doc.data());
    }

    // 5. User Profile Management
    async getUserProfile(uid) {
        const docRef = doc(db, "users", uid);
        const snap = await getDoc(docRef);
        return snap.exists() ? snap.data() : null;
    }

    async updateUserProfile(uid, data) {
        const userRef = doc(db, "users", uid);
        await updateDoc(userRef, data);
    }

    // 6. CLAIM / UNCLAIM ITEM
    async toggleClaimItem(itemId, userId, currentClaimedBy) {
        const itemRef = doc(db, 'items', itemId);
        if (currentClaimedBy === userId) {
            await updateDoc(itemRef, { claimedBy: null });
            return "unclaimed";
        }
        else if (!currentClaimedBy) {
            await updateDoc(itemRef, { claimedBy: userId });
            return "claimed";
        }
        else {
            throw new Error("Already reserved!");
        }
    }

    // 7. BOARD MANAGEMENT
    async createBoard(userId, title, coverUrl) {
        const boardData = {
            ownerId: userId,
            title: title,
            coverUrl: coverUrl || 'https://placehold.co/600x400/png?text=Vibe',
            createdAt: serverTimestamp(),
            pinCount: 0
        };
        await addDoc(collection(db, 'boards'), boardData);
        this.addActivity(userId, 'create_board', { title });
    }

    async getBoards(userId) {
        const q = query(collection(db, 'boards'), where("ownerId", "==", userId));
        const snap = await getDocs(q);
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    // 8. PIN MANAGEMENT
    async addPin(boardId, imageUrl) {
        await addDoc(collection(db, 'boards', boardId, 'pins'), {
            imageUrl: imageUrl,
            createdAt: serverTimestamp()
        });
    }

    async getPins(boardId) {
        const q = query(collection(db, 'boards', boardId, 'pins'));
        const snap = await getDocs(q);
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async markAsOwned(itemId) {
        const itemRef = doc(db, 'items', itemId);

        // Fetch item title for log before update (optional, but cleaner)
        const snap = await getDoc(itemRef);
        const title = snap.exists() ? snap.data().title : 'Item';

        await updateDoc(itemRef, {
            isOwned: true,
            purchasedAt: serverTimestamp()
        });

        // Log Activity
        this.addActivity(snap.data().ownerId, 'manifest', { title });
    }

    async getCloset(userId) {
        const q = query(
            this.itemsCollection,
            where("ownerId", "==", userId),
            where("isOwned", "==", true)
        );
        const snap = await getDocs(q);
        return snap.docs.map(doc => this._transformItem(doc));
    }

    // 10. COMBO MANAGEMENT
    async saveCombo(userId, comboData) {
        try {
            const docRef = await addDoc(collection(db, 'combos'), {
                ownerId: userId,
                ...comboData,
                createdAt: serverTimestamp()
            });
            this.addActivity(userId, 'create_combo', { title: comboData.title });
            return docRef.id;
        } catch (error) {
            console.error("Error saving combo:", error);
            throw error;
        }
    }

    async getCombos(userId) {
        try {
            const q = query(collection(db, 'combos'), where("ownerId", "==", userId));
            const snap = await getDocs(q);
            return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error fetching combos:", error);
            throw error;
        }
    }
}

export const firestoreService = new FirestoreService();