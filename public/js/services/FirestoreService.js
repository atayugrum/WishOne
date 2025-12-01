/* public/js/services/FirestoreService.js */
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
    writeBatch,
    startAt,
    endAt
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export class FirestoreService {

    constructor() {
        this.itemsCollection = collection(db, 'items');
    }

    // ... (Keep _transformItem and deleteUserData as is) ...
    _transformItem(doc) {
        const data = doc.data();
        let derivedStatus = data.status;
        if (!derivedStatus) {
            if (data.isOwned) derivedStatus = 'bought';
            else if (data.deleted) derivedStatus = 'archived';
            else derivedStatus = 'wish';
        }
        return {
            id: doc.id,
            ownerId: data.ownerId,
            title: data.title || 'Untitled Wish',
            description: data.description || '',
            price: Number(data.price) || 0,
            currency: data.currency || 'TRY',
            link: data.link || data.originalUrl || null,
            imageUrl: data.imageUrl || 'https://placehold.co/600x400/png',
            category: data.category || 'Other',
            subcategory: data.subcategory || null,
            lists: Array.isArray(data.lists) ? data.lists : [],
            status: derivedStatus,
            priority: data.priority || 'Medium',
            occasion: data.occasion || null,
            targetDate: data.targetDate || null,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt || data.lastUpdatedAt || null,
            deleted: data.deleted || false,
            originalUrl: data.originalUrl || data.link || null,
            isOwned: derivedStatus === 'bought',
            onSale: data.onSale || false,
            claimedBy: data.claimedBy || null,
            visibility: data.visibility || 'default'
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

    // --- ACTIVITY & STATS ---

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

    // [NEW] Get aggregate stats for profile
    async getUserStats(userId) {
        const q = query(this.itemsCollection, where("ownerId", "==", userId));
        const snap = await getDocs(q);
        let totalWishes = 0;
        let fulfilled = 0;
        snap.forEach(doc => {
            const data = doc.data();
            if (!data.deleted) {
                totalWishes++;
                if (data.isOwned || data.status === 'bought') fulfilled++;
            }
        });
        return { totalWishes, fulfilled };
    }

    // --- SOCIAL & PRIVACY ---

    async checkIsFriend(ownerId, viewerId) {
        if (!viewerId) return false;
        if (ownerId === viewerId) return true;
        try {
            const friendRef = doc(db, "users", ownerId, "friends", viewerId);
            const snap = await getDoc(friendRef);
            return snap.exists();
        } catch (e) { return false; }
    }

    async checkIsBlocked(userA, userB) {
        if (!userA || !userB) return false;
        const blockRef1 = doc(db, "users", userA, "blocked", userB);
        const snap1 = await getDoc(blockRef1);
        if (snap1.exists()) return true;
        const blockRef2 = doc(db, "users", userB, "blocked", userA);
        const snap2 = await getDoc(blockRef2);
        if (snap2.exists()) return true;
        return false;
    }

    // [UPDATED] Search users by username prefix
    async searchUsers(searchTerm) {
        if (!searchTerm || searchTerm.length < 3) return [];
        const term = searchTerm.toLowerCase();
        const usersRef = collection(db, "users");

        // Prefix search: name >= term AND name <= term + special_char
        const q = query(
            usersRef,
            where("username", ">=", term),
            where("username", "<=", term + '\uf8ff'),
            limit(10)
        );

        const snap = await getDocs(q);
        return snap.docs.map(doc => {
            const data = doc.data();
            return {
                uid: doc.id,
                displayName: data.displayName,
                username: data.username,
                photoURL: data.photoURL
            };
        });
    }

    // [UPDATED] Enforce Profile Visibility
    async getWishlist(userId, viewerId = null) {
        try {
            if (userId !== viewerId) {
                const isBlocked = await this.checkIsBlocked(userId, viewerId);
                if (isBlocked) throw new Error("Content unavailable.");
            }

            const [querySnapshot, ownerProfile] = await Promise.all([
                getDocs(query(this.itemsCollection, where("ownerId", "==", userId))),
                this.getUserProfile(userId)
            ]);

            // Check Profile Visibility
            const isFriend = await this.checkIsFriend(userId, viewerId);
            const profileVis = ownerProfile?.profileVisibility || (ownerProfile?.isPrivate ? 'friends_only' : 'public'); // Legacy compat

            // Spec G.1: If friends_only and not friend, return empty (or throw)
            if (userId !== viewerId && profileVis === 'friends_only' && !isFriend) {
                throw new Error("Private Profile");
            }

            let items = querySnapshot.docs.map(doc => this._transformItem(doc));

            if (userId === viewerId) return items.filter(i => !i.deleted);

            let defaultVis = ownerProfile?.defaultVisibility || 'public';

            return items.filter(item => {
                if (item.deleted || item.status === 'archived') return false;

                let vis = item.visibility || 'default';
                if (vis === 'default') vis = defaultVis;

                if (vis === 'private') return false;
                if (vis === 'friends' && !isFriend) return false;

                return ['wish', 'bought'].includes(item.status);
            });
        } catch (error) { throw error; }
    }

    // --- BOARDS & INSPO (Updated with Privacy) ---

    async getBoards(userId, viewerId = null) {
        const q = query(collection(db, 'boards'), where("ownerId", "==", userId), orderBy('createdAt', 'desc'));
        const [snap, ownerProfile] = await Promise.all([
            getDocs(q),
            this.getUserProfile(userId)
        ]);

        // Check Profile Level Privacy first
        if (viewerId && userId !== viewerId) {
            const isFriend = await this.checkIsFriend(userId, viewerId);
            const profileVis = ownerProfile?.profileVisibility || 'public';
            if (profileVis === 'friends_only' && !isFriend) return [];
        }

        const boards = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (userId === viewerId) return boards;

        // Filter by board privacy
        const isFriend = await this.checkIsFriend(userId, viewerId);
        return boards.filter(b => {
            if (b.privacy === 'private') return false;
            if (b.privacy === 'friends' && !isFriend) return false;
            return true;
        });
    }

    // ... (Keep addItem, updateItem, deleteItem, markAsOwned, unmarkOwned, getCloset, checkItemExists, createBoard, updateBoard, deleteBoard, addPin, deletePin, getPins, saveCombo, updateCombo, deleteCombo, getCombos as they were) ...

    async addItem(itemData) { const docRef = await addDoc(this.itemsCollection, { ...itemData, description: itemData.description || '', link: itemData.link || itemData.originalUrl || null, lists: itemData.lists || [], status: itemData.status || 'wish', priority: itemData.priority || 'Medium', createdAt: serverTimestamp(), updatedAt: serverTimestamp(), lastUpdatedAt: serverTimestamp(), deleted: false, isOwned: itemData.status === 'bought', claimedBy: null }); const type = itemData.status === 'bought' ? 'manifest' : 'add_wish'; this.addActivity(itemData.ownerId, type, { title: itemData.title }); return docRef.id; }
    async updateItem(itemId, updateData) { const itemRef = doc(db, 'items', itemId); if (updateData.status) updateData.isOwned = updateData.status === 'bought'; await updateDoc(itemRef, { ...updateData, updatedAt: serverTimestamp(), lastUpdatedAt: serverTimestamp() }); }
    async deleteItem(itemId) { const itemRef = doc(db, 'items', itemId); await updateDoc(itemRef, { deleted: true, status: 'archived', updatedAt: serverTimestamp() }); }
    async markAsOwned(itemId) { const itemRef = doc(db, 'items', itemId); const snap = await getDoc(itemRef); const title = snap.exists() ? snap.data().title : 'Item'; await updateDoc(itemRef, { isOwned: true, status: 'bought', purchasedAt: serverTimestamp(), updatedAt: serverTimestamp() }); this.addActivity(snap.data().ownerId, 'manifest', { title }); }
    async unmarkOwned(itemId) { const itemRef = doc(db, 'items', itemId); const snap = await getDoc(itemRef); if (snap.exists()) { this.addActivity(snap.data().ownerId, 'return_wish', { title: snap.data().title }); } await updateDoc(itemRef, { isOwned: false, status: 'wish', updatedAt: serverTimestamp() }); }
    async getCloset(userId) { const q = query(this.itemsCollection, where("ownerId", "==", userId)); const snap = await getDocs(q); const items = snap.docs.map(doc => this._transformItem(doc)); return items.filter(i => i.status === 'bought' && !i.deleted); }
    async checkItemExists(userId, url) { if (!url) return false; try { const q = query(this.itemsCollection, where("ownerId", "==", userId), where("originalUrl", "==", url)); const snap = await getDocs(q); const activeDocs = snap.docs.filter(d => !d.data().deleted); return activeDocs.length > 0; } catch (error) { return false; } }
    async createBoard(userId, title, coverUrl, privacy = 'private') { await addDoc(collection(db, 'boards'), { ownerId: userId, title, description: '', coverUrl: coverUrl || 'https://placehold.co/600x400/png?text=Vibe', privacy, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), pinCount: 0 }); this.addActivity(userId, 'create_board', { title }); }
    async updateBoard(boardId, data) { const ref = doc(db, 'boards', boardId); await updateDoc(ref, { ...data, updatedAt: serverTimestamp() }); }
    async deleteBoard(boardId) { const batch = writeBatch(db); const ref = doc(db, 'boards', boardId); const pinsQ = query(collection(db, 'boards', boardId, 'pins')); const pinsSnap = await getDocs(pinsQ); pinsSnap.forEach(p => batch.delete(p.ref)); batch.delete(ref); await batch.commit(); }
    async addPin(boardId, pinData) { const payload = { createdAt: serverTimestamp() }; if (typeof pinData === 'string') { payload.imageUrl = pinData; payload.refId = null; } else { payload.imageUrl = pinData.imageUrl; payload.refId = pinData.refId || null; } await addDoc(collection(db, 'boards', boardId, 'pins'), payload); }
    async deletePin(boardId, pinId) { await deleteDoc(doc(db, 'boards', boardId, 'pins', pinId)); }
    async getPins(boardId) { const q = query(collection(db, 'boards', boardId, 'pins'), orderBy('createdAt', 'desc')); const snap = await getDocs(q); return snap.docs.map(doc => ({ id: doc.id, ...doc.data() })); }
    async saveCombo(userId, comboData) { if (comboData.id) { const ref = doc(db, 'combos', comboData.id); const { id, ...data } = comboData; await updateDoc(ref, { ...data, updatedAt: serverTimestamp() }); } else { await addDoc(collection(db, 'combos'), { ownerId: userId, ...comboData, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), deleted: false }); this.addActivity(userId, 'create_combo', { title: comboData.title }); } }
    async updateCombo(comboId, data) { const ref = doc(db, 'combos', comboId); await updateDoc(ref, { ...data, updatedAt: serverTimestamp() }); }
    async deleteCombo(comboId) { const ref = doc(db, 'combos', comboId); await deleteDoc(ref); }
    async getCombos(userId) { const q = query(collection(db, 'combos'), where("ownerId", "==", userId), orderBy('updatedAt', 'desc')); const snap = await getDocs(q); return snap.docs.map(doc => ({ id: doc.id, ...doc.data() })); }


    // --- SOCIAL (Extended) ---

    // [UPDATED] Use username for internal logic if needed, but mostly uid
    async sendFriendRequest(myUid, friendUsername) {
        // Check if it's an email or username
        const isEmail = friendUsername.includes('@');
        const usersRef = collection(db, "users");
        let q;

        if (isEmail) {
            q = query(usersRef, where("email", "==", friendUsername));
        } else {
            q = query(usersRef, where("username", "==", friendUsername.toLowerCase()));
        }

        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) throw new Error("User not found.");
        const friendDoc = querySnapshot.docs[0];
        const friendId = friendDoc.id;

        if (friendId === myUid) throw new Error("Cannot add yourself.");
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

        // My Friend
        const myFriendRef = doc(db, "users", myUid, "friends", senderUid);
        batch.set(myFriendRef, {
            uid: senderUid,
            email: senderProfile.email,
            displayName: senderProfile.displayName,
            username: senderProfile.username || '',
            avatarUrl: senderProfile.photoURL,
            addedAt: serverTimestamp()
        });

        // Their Friend
        const theirFriendRef = doc(db, "users", senderUid, "friends", myUid);
        batch.set(theirFriendRef, {
            uid: myUid,
            email: myProfile.email,
            displayName: myProfile.displayName,
            username: myProfile.username || '',
            avatarUrl: myProfile.photoURL,
            addedAt: serverTimestamp()
        });

        const reqRef = doc(db, "users", myUid, "friend_requests", senderUid);
        batch.delete(reqRef);
        await batch.commit();
        this.addActivity(myUid, 'friend_add', { name: senderProfile.displayName });
    }

    // [NEW] Remove Friend
    async removeFriend(myUid, friendUid) {
        const batch = writeBatch(db);
        batch.delete(doc(db, "users", myUid, "friends", friendUid));
        batch.delete(doc(db, "users", friendUid, "friends", myUid));
        await batch.commit();
    }

    async rejectFriendRequest(myUid, senderUid) {
        await deleteDoc(doc(db, "users", myUid, "friend_requests", senderUid));
    }

    async getFriends(userId) {
        const friendsRef = collection(db, "users", userId, "friends");
        const snap = await getDocs(friendsRef);
        return snap.docs.map(doc => doc.data());
    }

    async blockUser(myUid, targetUid) {
        await setDoc(doc(db, "users", myUid, "blocked", targetUid), { blockedAt: serverTimestamp() });
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

    async exportAllData(userId) { const profile = await this.getUserProfile(userId); const qItems = query(this.itemsCollection, where("ownerId", "==", userId)); const itemsSnap = await getDocs(qItems); const items = itemsSnap.docs.map(d => this._transformItem(d)); const qBoards = query(collection(db, 'boards'), where("ownerId", "==", userId)); const boardsSnap = await getDocs(qBoards); const boards = boardsSnap.docs.map(d => ({ id: d.id, ...d.data() })); const qCombos = query(collection(db, 'combos'), where("ownerId", "==", userId)); const combosSnap = await getDocs(qCombos); const combos = combosSnap.docs.map(d => ({ id: d.id, ...d.data() })); return { profile, items, boards, combos, exportDate: new Date().toISOString(), app: "WishOne" }; }
}

export const firestoreService = new FirestoreService();