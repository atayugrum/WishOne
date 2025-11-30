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
        let derivedStatus = data.status;
        if (!derivedStatus) {
            derivedStatus = data.isOwned ? 'bought' : 'wish';
        }

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
            status: derivedStatus,
            isOwned: data.isOwned || false,
            targetDate: data.targetDate || null,
            deleted: data.deleted || false,
            ...data
        };
    }

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

    async checkIsFriend(ownerId, viewerId) {
        if (!viewerId) return false;
        if (ownerId === viewerId) return true;
        try {
            const friendRef = doc(db, "users", ownerId, "friends", viewerId);
            const snap = await getDoc(friendRef);
            return snap.exists();
        } catch (e) { return false; }
    }

    // [UPDATED] Check Block Status
    async checkIsBlocked(userA, userB) {
        if (!userA || !userB) return false;
        // Check if A blocked B
        const blockRef1 = doc(db, "users", userA, "blocked", userB);
        const snap1 = await getDoc(blockRef1);
        if (snap1.exists()) return true;

        // Check if B blocked A
        const blockRef2 = doc(db, "users", userB, "blocked", userA);
        const snap2 = await getDoc(blockRef2);
        if (snap2.exists()) return true;

        return false;
    }

    async getWishlist(userId, viewerId = null) {
        try {
            // [NEW] Safety Check
            if (userId !== viewerId) {
                const isBlocked = await this.checkIsBlocked(userId, viewerId);
                if (isBlocked) throw new Error("Content unavailable.");
            }

            const q = query(this.itemsCollection, where("ownerId", "==", userId));
            const [querySnapshot, ownerProfile] = await Promise.all([
                getDocs(q),
                this.getUserProfile(userId)
            ]);

            let items = querySnapshot.docs.map(doc => this._transformItem(doc));

            if (userId === viewerId) {
                return items.filter(i => !i.deleted);
            }

            const isFriend = await this.checkIsFriend(userId, viewerId);

            let defaultVis = 'public';
            if (ownerProfile) {
                if (ownerProfile.defaultVisibility) defaultVis = ownerProfile.defaultVisibility;
                else if (ownerProfile.isPrivate) defaultVis = 'private';
            }

            return items.filter(item => {
                if (item.deleted) return false;

                let vis = item.visibility || 'default';
                if (vis === 'default') vis = defaultVis;

                if (vis === 'private') return false;
                if (vis === 'friends') return isFriend;
                return item.status === 'wish';
            });
        } catch (error) { throw error; }
    }

    async addItem(itemData) {
        const docRef = await addDoc(this.itemsCollection, {
            ...itemData,
            status: itemData.status || 'wish',
            createdAt: serverTimestamp(),
            lastUpdatedAt: serverTimestamp(),
            isOwned: itemData.isOwned || false,
            claimedBy: null,
            deleted: false
        });
        const type = itemData.status === 'bought' ? 'manifest' : 'add_wish';
        this.addActivity(itemData.ownerId, type, { title: itemData.title });
        return docRef.id;
    }

    async updateItem(itemId, updateData) {
        const itemRef = doc(db, 'items', itemId);
        await updateDoc(itemRef, { ...updateData, lastUpdatedAt: serverTimestamp() });
    }

    async checkItemExists(userId, url) {
        if (!url) return false;
        try {
            const q = query(this.itemsCollection, where("ownerId", "==", userId), where("originalUrl", "==", url));
            const snap = await getDocs(q);
            const activeDocs = snap.docs.filter(d => !d.data().deleted);
            return activeDocs.length > 0;
        } catch (error) { return false; }
    }

    async deleteItem(itemId) {
        const itemRef = doc(db, 'items', itemId);
        await updateDoc(itemRef, { deleted: true, status: 'archived' });
    }

    async sendFriendRequest(myUid, friendEmail) {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", friendEmail));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) throw new Error("User not found.");
        const friendDoc = querySnapshot.docs[0];
        const friendId = friendDoc.id;
        if (friendId === myUid) throw new Error("Cannot add yourself.");

        // Block check
        if (await this.checkIsBlocked(myUid, friendId)) throw new Error("Cannot add this user.");

        const existingFriend = await getDoc(doc(db, "users", myUid, "friends", friendId));
        if (existingFriend.exists()) throw new Error("Already friends.");
        const outgoingReq = await getDoc(doc(db, "users", friendId, "friend_requests", myUid));
        if (outgoingReq.exists()) throw new Error("Request already sent.");
        const myProfile = await this.getUserProfile(myUid);
        await setDoc(doc(db, "users", friendId, "friend_requests", myUid), {
            fromUid: myUid,
            fromName: myProfile.displayName,
            fromEmail: myProfile.email,
            fromPhoto: myProfile.photoURL,
            timestamp: serverTimestamp()
        });
        return friendDoc.data();
    }

    async getIncomingRequests(userId) {
        const q = query(collection(db, "users", userId, "friend_requests"), orderBy("timestamp", "desc"));
        const snap = await getDocs(q);
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async acceptFriendRequest(myUid, senderUid) {
        const senderProfile = await this.getUserProfile(senderUid);
        const myProfile = await this.getUserProfile(myUid);
        const batch = writeBatch(db);
        const myFriendRef = doc(db, "users", myUid, "friends", senderUid);
        batch.set(myFriendRef, {
            uid: senderUid,
            email: senderProfile.email,
            displayName: senderProfile.displayName,
            avatarUrl: senderProfile.photoURL,
            addedAt: serverTimestamp()
        });
        const theirFriendRef = doc(db, "users", senderUid, "friends", myUid);
        batch.set(theirFriendRef, {
            uid: myUid,
            email: myProfile.email,
            displayName: myProfile.displayName,
            avatarUrl: myProfile.avatarUrl,
            addedAt: serverTimestamp()
        });
        const reqRef = doc(db, "users", myUid, "friend_requests", senderUid);
        batch.delete(reqRef);
        await batch.commit();
        this.addActivity(myUid, 'friend_add', { name: senderProfile.displayName });
    }

    async rejectFriendRequest(myUid, senderUid) {
        await deleteDoc(doc(db, "users", myUid, "friend_requests", senderUid));
    }

    async getFriends(userId) {
        const friendsRef = collection(db, "users", userId, "friends");
        const snap = await getDocs(friendsRef);
        return snap.docs.map(doc => doc.data());
    }

    // [NEW] Block User
    async blockUser(myUid, targetUid) {
        // 1. Add to blocked collection
        await setDoc(doc(db, "users", myUid, "blocked", targetUid), {
            blockedAt: serverTimestamp()
        });

        // 2. Remove friendship if exists
        const batch = writeBatch(db);
        batch.delete(doc(db, "users", myUid, "friends", targetUid));
        batch.delete(doc(db, "users", targetUid, "friends", myUid));
        await batch.commit();
    }

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

    async toggleClaimItem(itemId, userId, currentClaimedBy) {
        const itemRef = doc(db, 'items', itemId);
        if (currentClaimedBy === userId) { await updateDoc(itemRef, { claimedBy: null }); return "unclaimed"; }
        else if (!currentClaimedBy) { await updateDoc(itemRef, { claimedBy: userId }); return "claimed"; }
        else throw new Error("Reserved.");
    }

    async createBoard(userId, title, coverUrl, privacy = 'private') {
        await addDoc(collection(db, 'boards'), {
            ownerId: userId,
            title,
            coverUrl: coverUrl || 'https://placehold.co/600x400/png?text=Vibe',
            privacy,
            createdAt: serverTimestamp(),
            pinCount: 0
        });
        this.addActivity(userId, 'create_board', { title });
    }

    async updateBoard(boardId, data) { const ref = doc(db, 'boards', boardId); await updateDoc(ref, data); }
    async deleteBoard(boardId) { const ref = doc(db, 'boards', boardId); await deleteDoc(ref); }
    async getBoards(userId) { const q = query(collection(db, 'boards'), where("ownerId", "==", userId)); const snap = await getDocs(q); return snap.docs.map(doc => ({ id: doc.id, ...doc.data() })); }
    async addPin(boardId, imageUrl) { await addDoc(collection(db, 'boards', boardId, 'pins'), { imageUrl, createdAt: serverTimestamp() }); }
    async getPins(boardId) { const q = query(collection(db, 'boards', boardId, 'pins')); const snap = await getDocs(q); return snap.docs.map(doc => ({ id: doc.id, ...doc.data() })); }

    async markAsOwned(itemId) {
        const itemRef = doc(db, 'items', itemId);
        const snap = await getDoc(itemRef);
        const title = snap.exists() ? snap.data().title : 'Item';
        await updateDoc(itemRef, {
            isOwned: true,
            status: 'bought',
            purchasedAt: serverTimestamp()
        });
        this.addActivity(snap.data().ownerId, 'manifest', { title });
    }

    async unmarkOwned(itemId) {
        const itemRef = doc(db, 'items', itemId);
        const snap = await getDoc(itemRef);
        if (snap.exists()) {
            this.addActivity(snap.data().ownerId, 'return_wish', { title: snap.data().title });
        }
        await updateDoc(itemRef, {
            isOwned: false,
            status: 'wish'
        });
    }

    async getCloset(userId) {
        const q = query(this.itemsCollection, where("ownerId", "==", userId));
        const snap = await getDocs(q);
        const items = snap.docs.map(doc => this._transformItem(doc));
        return items.filter(i => i.status === 'bought' && !i.deleted);
    }

    async saveCombo(userId, comboData) {
        await addDoc(collection(db, 'combos'), { ownerId: userId, ...comboData, createdAt: serverTimestamp() });
        this.addActivity(userId, 'create_combo', { title: comboData.title });
    }
    async deleteCombo(comboId) { const ref = doc(db, 'combos', comboId); await deleteDoc(ref); }
    async getCombos(userId) { const q = query(collection(db, 'combos'), where("ownerId", "==", userId)); const snap = await getDocs(q); return snap.docs.map(doc => ({ id: doc.id, ...doc.data() })); }

    async exportAllData(userId) {
        const profile = await this.getUserProfile(userId);

        const qItems = query(this.itemsCollection, where("ownerId", "==", userId));
        const itemsSnap = await getDocs(qItems);
        const items = itemsSnap.docs.map(d => this._transformItem(d));

        const qBoards = query(collection(db, 'boards'), where("ownerId", "==", userId));
        const boardsSnap = await getDocs(qBoards);
        const boards = boardsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const qCombos = query(collection(db, 'combos'), where("ownerId", "==", userId));
        const combosSnap = await getDocs(qCombos);
        const combos = combosSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        return {
            profile,
            items,
            boards,
            combos,
            exportDate: new Date().toISOString(),
            app: "WishOne"
        };
    }
}

export const firestoreService = new FirestoreService();