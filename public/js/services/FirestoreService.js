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
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export class FirestoreService {

    constructor() {
        this.itemsCollection = collection(db, 'items');
    }

    // Helper: Clean data
    _transformItem(doc) {
        const data = doc.data();
        return {
            id: doc.id,
            title: data.title,
            price: data.price,
            currency: data.currency || 'TRY',
            category: data.category,
            priority: data.priority || 'Medium',
            imageUrl: data.imageUrl || 'https://placehold.co/600x400/png',
            claimedBy: data.claimedBy || null,
            ...data
        };
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
                isOwned: false,
                claimedBy: null
            });
            return docRef.id;
        } catch (e) {
            console.error("Error adding document: ", e);
            throw e;
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

    // 4. FRIEND MANAGEMENT (Replaces Partner)
    async addFriend(myUid, friendEmail) {
        // 1. Find friend by email
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", friendEmail));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            throw new Error("User not found. Ask them to join WishOne!");
        }

        const friendDoc = querySnapshot.docs[0];
        const friendId = friendDoc.id;
        const friendData = friendDoc.data();

        if (friendId === myUid) {
            throw new Error("You cannot add yourself as a friend!");
        }

        // 2. Add to MY friends collection (subcollection)
        // users/{myUid}/friends/{friendId}
        const myFriendRef = doc(db, "users", myUid, "friends", friendId);
        await setDoc(myFriendRef, {
            uid: friendId,
            email: friendData.email,
            displayName: friendData.displayName || "Friend",
            avatarUrl: friendData.avatarUrl || null,
            addedAt: serverTimestamp()
        });

        // 3. Add ME to THEIR friends collection (reciprocal for now)
        const myProfile = await this.getUserProfile(myUid);
        const theirFriendRef = doc(db, "users", friendId, "friends", myUid);
        await setDoc(theirFriendRef, {
            uid: myUid,
            email: myProfile.email,
            displayName: myProfile.displayName,
            avatarUrl: myProfile.avatarUrl || null,
            addedAt: serverTimestamp()
        });

        return friendData;
    }

    async getFriends(userId) {
        const friendsRef = collection(db, "users", userId, "friends");
        const snap = await getDocs(friendsRef);
        return snap.docs.map(doc => doc.data());
    }

    // 5. Get User Profile
    async getUserProfile(uid) {
        const docRef = doc(db, "users", uid);
        const snap = await getDoc(docRef);
        return snap.exists() ? snap.data() : null;
    }

    // 6. CLAIM / UNCLAIM ITEM
    async toggleClaimItem(itemId, userId, currentClaimedBy) {
        const itemRef = doc(db, 'items', itemId);

        // If I already claimed it -> Unclaim it (set to null)
        if (currentClaimedBy === userId) {
            await updateDoc(itemRef, { claimedBy: null });
            return "unclaimed";
        }
        // If nobody claimed it -> Claim it
        else if (!currentClaimedBy) {
            await updateDoc(itemRef, { claimedBy: userId });
            return "claimed";
        }
        // If someone else claimed it -> Error
        else {
            throw new Error("This item is already reserved by someone else!");
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
    }

    async getBoards(userId) {
        const q = query(collection(db, 'boards'), where("ownerId", "==", userId));
        const snap = await getDocs(q);
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    // 8. PIN MANAGEMENT (Images inside boards)
    async addPin(boardId, imageUrl) {
        // Add image to sub-collection 'pins'
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
        await updateDoc(itemRef, {
            isOwned: true,
            purchasedAt: serverTimestamp() // Optional: remember when you got it
        });
    }

    // 9. GET CLOSET ITEMS (Only owned stuff)
    async getCloset(userId) {
        // Query: Owner is me AND isOwned is true
        const q = query(
            this.itemsCollection,
            where("ownerId", "==", userId),
            where("isOwned", "==", true)
        );
        const snap = await getDocs(q);
        return snap.docs.map(doc => this._transformItem(doc));
    }
}

export const firestoreService = new FirestoreService();