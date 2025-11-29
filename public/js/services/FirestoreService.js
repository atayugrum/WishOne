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
    limit,
    writeBatch
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
            visibility: data.visibility || 'default',
            ...data
        };
    }

    // --- USER MANAGEMENT ---
    async deleteUserData(userId) {
        const batch = writeBatch(db);
        const itemsQ = query(this.itemsCollection, where("ownerId", "==", userId));
        const itemsSnap = await getDocs(itemsQ);
        itemsSnap.forEach(doc => batch.delete(doc.ref));
        const boardsQ = query(collection(db, 'boards'), where("ownerId", "==", userId));
        const boardsSnap = await getDocs(boardsQ);
        boardsSnap.forEach(doc => batch.delete(doc.ref));
        const combosQ = query(collection(db, 'combos'), where("ownerId", "==", userId));
        const combosSnap = await getDocs(combosQ);
        combosSnap.forEach(doc => batch.delete(doc.ref));
        const userRef = doc(db, 'users', userId);
        batch.delete(userRef);
        await batch.commit();
    }

    // --- ACTIVITY LOG ---
    async addActivity(userId, type, details) {
        try {
            await addDoc(collection(db, 'users', userId, 'activities'), {
                type,
                details,
                createdAt: serverTimestamp()
            });
        } catch (e) { console.warn("Log failed", e); }
    }

    async getRecentActivities(userId) {
        try {
            const q = query(collection(db, 'users', userId, 'activities'), orderBy('createdAt', 'desc'), limit(10));
            const snap = await getDocs(q);
            return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (e) { return []; }
    }

    // 1. Get Wishlist
    async getWishlist(userId, viewerId = null) {
        try {
            const q = query(this.itemsCollection, where("ownerId", "==", userId), where("isOwned", "==", false));
            const querySnapshot = await getDocs(q);
            let items = querySnapshot.docs.map(doc => this._transformItem(doc));
            if (userId !== viewerId) {
                items = items.filter(item => {
                    if (item.visibility === 'private') return false;
                    return true;
                });
            }
            return items;
        } catch (error) { throw error; }
    }

    // 2. Add Item
    async addItem(itemData) {
        const docRef = await addDoc(this.itemsCollection, { ...itemData, createdAt: serverTimestamp(), lastUpdatedAt: serverTimestamp(), isOwned: false, claimedBy: null });
        this.addActivity(itemData.ownerId, 'add_wish', { title: itemData.title });
        return docRef.id;
    }

    async updateItem(itemId, updateData) {
        const itemRef = doc(db, 'items', itemId);
        await updateDoc(itemRef, { ...updateData, lastUpdatedAt: serverTimestamp() });
    }

    async checkItemExists(userId, url) {
        if (!url) return false;
        try {
            const q = query(this.itemsCollection, where("ownerId", "==", userId), where("originalUrl", "==", url), where("isOwned", "==", false));
            const snap = await getDocs(q);
            return !snap.empty;
        } catch (error) { return false; }
    }

    async deleteItem(itemId) {
        const itemRef = doc(db, 'items', itemId);
        await deleteDoc(itemRef);
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
        await setDoc(myFriendRef, { uid: friendId, email: friendData.email, displayName: friendData.displayName || "Friend", avatarUrl: friendData.avatarUrl || null, addedAt: serverTimestamp() });
        const myProfile = await this.getUserProfile(myUid);
        const theirFriendRef = doc(db, "users", friendId, "friends", myUid);
        await setDoc(theirFriendRef, { uid: myUid, email: myProfile.email, displayName: myProfile.displayName, avatarUrl: myProfile.avatarUrl || null, addedAt: serverTimestamp() });
        this.addActivity(myUid, 'friend_add', { name: friendData.displayName });
        return friendData;
    }

    async getFriends(userId) {
        const friendsRef = collection(db, "users", userId, "friends");
        const snap = await getDocs(friendsRef);
        return snap.docs.map(doc => doc.data());
    }

    // 5. User Profile
    async getUserProfile(uid) {
        const docRef = doc(db, "users", uid);
        const snap = await getDoc(docRef);
        return snap.exists() ? snap.data() : null;
    }

    async updateUserProfile(uid, data) {
        const userRef = doc(db, "users", uid);
        await updateDoc(userRef, data);
    }

    async checkUsernameUnique(username) {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("username", "==", username));
        const snap = await getDocs(q);
        return snap.empty;
    }

    // 6. Claim
    async toggleClaimItem(itemId, userId, currentClaimedBy) {
        const itemRef = doc(db, 'items', itemId);
        if (currentClaimedBy === userId) { await updateDoc(itemRef, { claimedBy: null }); return "unclaimed"; }
        else if (!currentClaimedBy) { await updateDoc(itemRef, { claimedBy: userId }); return "claimed"; }
        else throw new Error("Reserved.");
    }

    // 7. BOARD MANAGEMENT
    async createBoard(userId, title, coverUrl) {
        await addDoc(collection(db, 'boards'), { ownerId: userId, title, coverUrl: coverUrl || 'https://placehold.co/600x400/png?text=Vibe', createdAt: serverTimestamp(), pinCount: 0 });
        this.addActivity(userId, 'create_board', { title });
    }

    async updateBoard(boardId, data) { const ref = doc(db, 'boards', boardId); await updateDoc(ref, data); }
    async deleteBoard(boardId) { const ref = doc(db, 'boards', boardId); await deleteDoc(ref); }
    async getBoards(userId) { const q = query(collection(db, 'boards'), where("ownerId", "==", userId)); const snap = await getDocs(q); return snap.docs.map(doc => ({ id: doc.id, ...doc.data() })); }
    async addPin(boardId, imageUrl) { await addDoc(collection(db, 'boards', boardId, 'pins'), { imageUrl, createdAt: serverTimestamp() }); }
    async getPins(boardId) { const q = query(collection(db, 'boards', boardId, 'pins')); const snap = await getDocs(q); return snap.docs.map(doc => ({ id: doc.id, ...doc.data() })); }

    // 8. CLOSET MANAGEMENT
    async markAsOwned(itemId) {
        const itemRef = doc(db, 'items', itemId);
        const snap = await getDoc(itemRef);
        const title = snap.exists() ? snap.data().title : 'Item';
        await updateDoc(itemRef, { isOwned: true, purchasedAt: serverTimestamp() });
        this.addActivity(snap.data().ownerId, 'manifest', { title });
    }

    async unmarkOwned(itemId) {
        const itemRef = doc(db, 'items', itemId);
        const snap = await getDoc(itemRef);
        // Log "moved back" action
        if (snap.exists()) {
            this.addActivity(snap.data().ownerId, 'return_wish', { title: snap.data().title });
        }
        await updateDoc(itemRef, { isOwned: false });
    }

    async getCloset(userId) {
        const q = query(this.itemsCollection, where("ownerId", "==", userId), where("isOwned", "==", true));
        const snap = await getDocs(q);
        return snap.docs.map(doc => this._transformItem(doc));
    }

    // 9. COMBOS
    async saveCombo(userId, comboData) {
        await addDoc(collection(db, 'combos'), { ownerId: userId, ...comboData, createdAt: serverTimestamp() });
        this.addActivity(userId, 'create_combo', { title: comboData.title });
    }
    async deleteCombo(comboId) { const ref = doc(db, 'combos', comboId); await deleteDoc(ref); }
    async getCombos(userId) { const q = query(collection(db, 'combos'), where("ownerId", "==", userId)); const snap = await getDocs(q); return snap.docs.map(doc => ({ id: doc.id, ...doc.data() })); }
}

export const firestoreService = new FirestoreService();