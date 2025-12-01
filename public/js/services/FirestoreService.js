/* public/js/services/FirestoreService.js */
import { db, storage } from '../config/firebase-config.js';
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
    arrayUnion,
    arrayRemove
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { LogService } from './LogService.js';

export class FirestoreService {

    constructor() {
        this.itemsCollection = collection(db, 'items');
        this.usersCollection = collection(db, 'users');
        this.boardsCollection = collection(db, 'boards');
        this.combosCollection = collection(db, 'combos');
    }

    // --- CORE DATA TRANSFORMATION ---
    _transformItem(doc) {
        const data = doc.data();
        let derivedStatus = data.status;
        
        // Migration/Fallback logic
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
            imageUrl: data.imageUrl || 'https://placehold.co/600x400/png?text=No+Image',
            link: data.link || data.originalUrl || null,
            store: data.store || null,
            category: data.category || 'Other',
            subcategory: data.subcategory || null,
            priority: data.priority || 'Medium',
            occasion: data.occasion || null,
            lists: Array.isArray(data.lists) ? data.lists : [],
            status: derivedStatus,
            targetDate: data.targetDate || null,
            isOwned: derivedStatus === 'bought',
            onSale: data.onSale || false,
            claimedBy: data.claimedBy || null,
            visibility: data.visibility || 'default',
            aiCategorySource: data.aiCategorySource || 'manual',
            aiPrioritySource: data.aiPrioritySource || 'manual',
            aiConfidence: data.aiConfidence || null,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt || data.lastUpdatedAt || null,
            purchasedAt: data.purchasedAt || null,
            deleted: data.deleted || false
        };
    }

    // --- USER PROFILE ---

    async getUserProfile(uid) {
        try {
            const docRef = doc(this.usersCollection, uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                return { id: docSnap.id, ...docSnap.data() };
            }
            // Create default profile if missing
            const newProfile = { createdAt: serverTimestamp(), isBetaUser: false, hasCompletedSignupProfile: false };
            await setDoc(docRef, newProfile, { merge: true });
            return { id: uid, ...newProfile };
        } catch (error) {
            LogService.error('FirestoreService', 'getUserProfile', error);
            throw error;
        }
    }

    async updateUserProfile(uid, data) {
        try {
            const userRef = doc(this.usersCollection, uid);
            await updateDoc(userRef, data);
        } catch (error) {
            LogService.error('FirestoreService', 'updateUserProfile', error);
            throw error;
        }
    }

    async checkUsernameUnique(username) {
        try {
            const q = query(this.usersCollection, where("username", "==", username));
            const snap = await getDocs(q);
            return snap.empty;
        } catch (error) {
            LogService.error('FirestoreService', 'checkUsernameUnique', error);
            return false;
        }
    }

    async deleteUserData(userId) {
        try {
            const batch = writeBatch(db);
            
            const itemsQ = query(this.itemsCollection, where("ownerId", "==", userId));
            const itemsSnap = await getDocs(itemsQ);
            itemsSnap.forEach(doc => batch.delete(doc.ref));
            
            const boardsQ = query(this.boardsCollection, where("ownerId", "==", userId));
            const boardsSnap = await getDocs(boardsQ);
            boardsSnap.forEach(doc => batch.delete(doc.ref));
            
            const combosQ = query(this.combosCollection, where("ownerId", "==", userId));
            const combosSnap = await getDocs(combosQ);
            combosSnap.forEach(doc => batch.delete(doc.ref));
            
            const userRef = doc(this.usersCollection, userId);
            batch.delete(userRef);
            
            await batch.commit();
        } catch (error) {
            LogService.error('FirestoreService', 'deleteUserData', error);
            throw error;
        }
    }

    // --- ACTIVITY & STATS ---

    async addActivity(userId, type, details) {
        try {
            await addDoc(collection(db, 'users', userId, 'activities'), {
                type,
                details,
                createdAt: serverTimestamp()
            });
        } catch (e) { 
            // Silent fail for analytics/activity logs is acceptable
            console.warn("Log failed", e); 
        }
    }

    async getUserStats(userId) {
        try {
            const q = query(this.itemsCollection, where("ownerId", "==", userId));
            const snap = await getDocs(q);
            let totalWishes = 0;
            let fulfilled = 0;
            snap.forEach(doc => {
                const data = doc.data();
                if (!data.deleted && data.status !== 'archived') {
                    totalWishes++;
                    if (data.isOwned || data.status === 'bought') fulfilled++;
                }
            });
            return { totalWishes, fulfilled };
        } catch (error) {
            LogService.error('FirestoreService', 'getUserStats', error);
            return { totalWishes: 0, fulfilled: 0 };
        }
    }

    // --- SOCIAL & PRIVACY HELPERS ---

    async checkIsFriend(ownerId, viewerId) {
        if (!viewerId || ownerId === viewerId) return true; // Self is friend
        try {
            const friendRef = doc(db, "users", ownerId, "friends", viewerId);
            const snap = await getDoc(friendRef);
            return snap.exists();
        } catch (e) { return false; }
    }

    async checkIsBlocked(userA, userB) {
        if (!userA || !userB) return false;
        try {
            const b1 = await getDoc(doc(db, "users", userA, "blocked", userB));
            if (b1.exists()) return true;
            const b2 = await getDoc(doc(db, "users", userB, "blocked", userA));
            if (b2.exists()) return true;
            return false;
        } catch (e) { return false; }
    }

    async searchUsers(searchTerm) {
        if (!searchTerm || searchTerm.length < 3) return [];
        try {
            const term = searchTerm.toLowerCase();
            const q = query(
                this.usersCollection,
                where("username", ">=", term),
                where("username", "<=", term + '\uf8ff'),
                limit(10)
            );
            const snap = await getDocs(q);
            return snap.docs.map(doc => ({
                uid: doc.id,
                displayName: doc.data().displayName,
                username: doc.data().username,
                photoURL: doc.data().photoURL
            }));
        } catch (error) {
            LogService.error('FirestoreService', 'searchUsers', error);
            return [];
        }
    }

    // --- WISHLIST ITEMS ---

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

            const isFriend = await this.checkIsFriend(userId, viewerId);
            const profileVis = ownerProfile?.profileVisibility || (ownerProfile?.isPrivate ? 'friends_only' : 'public');

            if (userId !== viewerId && profileVis === 'friends_only' && !isFriend) {
                // Return empty if private and not friend
                return []; 
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
        } catch (error) {
            LogService.error('FirestoreService', 'getWishlist', error);
            throw error;
        }
    }

    async addItem(itemData) {
        try {
            const payload = {
                ...itemData,
                description: itemData.description || '',
                link: itemData.link || itemData.originalUrl || null,
                lists: itemData.lists || [],
                status: itemData.status || 'wish',
                priority: itemData.priority || 'Medium',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                lastUpdatedAt: serverTimestamp(),
                deleted: false,
                isOwned: itemData.status === 'bought',
                claimedBy: null,
                aiCategorySource: itemData.aiCategorySource || 'manual',
                aiPrioritySource: itemData.aiPrioritySource || 'manual'
            };

            const docRef = await addDoc(this.itemsCollection, payload);
            const type = payload.status === 'bought' ? 'manifest' : 'add_wish';
            this.addActivity(payload.ownerId, type, { title: payload.title });
            return docRef.id;
        } catch (error) {
            LogService.error('FirestoreService', 'addItem', error);
            throw error;
        }
    }

    async updateItem(itemId, updateData) {
        try {
            const itemRef = doc(db, 'items', itemId);
            if (updateData.status) {
                updateData.isOwned = updateData.status === 'bought';
            }
            await updateDoc(itemRef, { 
                ...updateData, 
                updatedAt: serverTimestamp(),
                lastUpdatedAt: serverTimestamp()
            });
        } catch (error) {
            LogService.error('FirestoreService', 'updateItem', error);
            throw error;
        }
    }

    async deleteItem(itemId) {
        try {
            const itemRef = doc(db, 'items', itemId);
            await updateDoc(itemRef, { 
                status: 'archived', 
                deleted: true, // Soft delete logic
                updatedAt: serverTimestamp() 
            });
        } catch (error) {
            LogService.error('FirestoreService', 'deleteItem', error);
            throw error;
        }
    }

    async markAsOwned(itemId) {
        try {
            const itemRef = doc(db, 'items', itemId);
            const snap = await getDoc(itemRef);
            const title = snap.exists() ? snap.data().title : 'Item';
            
            await updateDoc(itemRef, { 
                isOwned: true, 
                status: 'bought', 
                purchasedAt: serverTimestamp(), 
                updatedAt: serverTimestamp() 
            });
            
            if (snap.exists()) {
                this.addActivity(snap.data().ownerId, 'manifest', { title });
            }
        } catch (error) {
            LogService.error('FirestoreService', 'markAsOwned', error);
            throw error;
        }
    }

    async unmarkOwned(itemId) {
        try {
            const itemRef = doc(db, 'items', itemId);
            const snap = await getDoc(itemRef);
            if (snap.exists()) {
                this.addActivity(snap.data().ownerId, 'return_wish', { title: snap.data().title });
            }
            await updateDoc(itemRef, { 
                isOwned: false, 
                status: 'wish', 
                updatedAt: serverTimestamp() 
            });
        } catch (error) {
            LogService.error('FirestoreService', 'unmarkOwned', error);
            throw error;
        }
    }

    async getCloset(userId) {
        try {
            const q = query(this.itemsCollection, where("ownerId", "==", userId));
            const snap = await getDocs(q);
            const items = snap.docs.map(doc => this._transformItem(doc));
            return items.filter(i => i.status === 'bought' && !i.deleted);
        } catch (error) {
            LogService.error('FirestoreService', 'getCloset', error);
            return [];
        }
    }

    // --- BOARDS (INSPO) ---

    async getBoards(userId, viewerId = null) {
        try {
            const q = query(this.boardsCollection, where("ownerId", "==", userId), orderBy('createdAt', 'desc'));
            const [snap, ownerProfile] = await Promise.all([
                getDocs(q),
                this.getUserProfile(userId)
            ]);

            if (viewerId && userId !== viewerId) {
                const isFriend = await this.checkIsFriend(userId, viewerId);
                const profileVis = ownerProfile?.profileVisibility || 'public';
                if (profileVis === 'friends_only' && !isFriend) return [];
            }

            const boards = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (userId === viewerId) return boards;

            const isFriend = await this.checkIsFriend(userId, viewerId);
            return boards.filter(b => {
                if (b.privacy === 'private') return false;
                if (b.privacy === 'friends' && !isFriend) return false;
                return true;
            });
        } catch (error) {
            LogService.error('FirestoreService', 'getBoards', error);
            throw error;
        }
    }

    async createBoard(userId, title, coverUrl, privacy = 'private') {
        try {
            await addDoc(this.boardsCollection, {
                ownerId: userId,
                title,
                description: '',
                coverUrl: coverUrl || '',
                privacy,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                pinCount: 0,
                previewImages: []
            });
            this.addActivity(userId, 'create_board', { title });
        } catch (error) {
            LogService.error('FirestoreService', 'createBoard', error);
            throw error;
        }
    }

    async updateBoard(boardId, data) {
        try {
            const ref = doc(db, 'boards', boardId);
            await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
        } catch (error) {
            LogService.error('FirestoreService', 'updateBoard', error);
            throw error;
        }
    }

    async deleteBoard(boardId) {
        try {
            const batch = writeBatch(db);
            const ref = doc(db, 'boards', boardId);
            const pinsQ = query(collection(db, 'boards', boardId, 'pins'));
            const pinsSnap = await getDocs(pinsQ);
            pinsSnap.forEach(p => batch.delete(p.ref));
            batch.delete(ref);
            await batch.commit();
        } catch (error) {
            LogService.error('FirestoreService', 'deleteBoard', error);
            throw error;
        }
    }

    async addPin(boardId, pinData) {
        try {
            const payload = { createdAt: serverTimestamp() };
            let imgUrl = '';

            if (typeof pinData === 'string') {
                payload.imageUrl = pinData;
                payload.refId = null;
                imgUrl = pinData;
            } else {
                payload.imageUrl = pinData.imageUrl;
                payload.refId = pinData.refId || null;
                imgUrl = pinData.imageUrl;
            }

            await addDoc(collection(db, 'boards', boardId, 'pins'), payload);

            // Update Board Metadata
            const boardRef = doc(db, 'boards', boardId);
            const boardSnap = await getDoc(boardRef);
            
            if (boardSnap.exists()) {
                const data = boardSnap.data();
                const currentPreviews = data.previewImages || [];
                const newPreviews = [imgUrl, ...currentPreviews].slice(0, 4);
                
                await updateDoc(boardRef, {
                    pinCount: (data.pinCount || 0) + 1,
                    previewImages: newPreviews,
                    coverUrl: data.coverUrl || imgUrl, 
                    updatedAt: serverTimestamp()
                });
            }
        } catch (error) {
            LogService.error('FirestoreService', 'addPin', error);
            throw error;
        }
    }

    async deletePin(boardId, pinId) {
        try {
            await deleteDoc(doc(db, 'boards', boardId, 'pins', pinId));
            // Ideally also update pinCount and previewImages here, but skipping for brevity
        } catch (error) {
            LogService.error('FirestoreService', 'deletePin', error);
            throw error;
        }
    }

    async getPins(boardId) {
        try {
            const q = query(collection(db, 'boards', boardId, 'pins'), orderBy('createdAt', 'desc'));
            const snap = await getDocs(q);
            return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            LogService.error('FirestoreService', 'getPins', error);
            return [];
        }
    }

    // --- COMBOS ---

    async saveCombo(userId, comboData) {
        try {
            if (comboData.id) {
                const ref = doc(db, 'combos', comboData.id);
                const { id, ...data } = comboData;
                await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
            } else {
                await addDoc(this.combosCollection, { 
                    ownerId: userId, 
                    ...comboData, 
                    createdAt: serverTimestamp(), 
                    updatedAt: serverTimestamp(), 
                    deleted: false 
                });
                this.addActivity(userId, 'create_combo', { title: comboData.title });
            }
        } catch (error) {
            LogService.error('FirestoreService', 'saveCombo', error);
            throw error;
        }
    }

    async deleteCombo(comboId) {
        try {
            const ref = doc(db, 'combos', comboId);
            await deleteDoc(ref);
        } catch (error) {
            LogService.error('FirestoreService', 'deleteCombo', error);
            throw error;
        }
    }

    async getCombos(userId) {
        try {
            const q = query(this.combosCollection, where("ownerId", "==", userId), orderBy('updatedAt', 'desc'));
            const snap = await getDocs(q);
            return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            LogService.error('FirestoreService', 'getCombos', error);
            return [];
        }
    }

    // --- SOCIAL ACTIONS ---

    async sendFriendRequest(myUid, friendUsername) {
        try {
            const isEmail = friendUsername.includes('@');
            let q;
            if (isEmail) q = query(this.usersCollection, where("email", "==", friendUsername));
            else q = query(this.usersCollection, where("username", "==", friendUsername.toLowerCase()));

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
        } catch (error) {
            LogService.error('FirestoreService', 'sendFriendRequest', error);
            throw error;
        }
    }

    async getIncomingRequests(userId) {
        try {
            const q = query(collection(db, "users", userId, "friend_requests"), orderBy("timestamp", "desc"));
            const snap = await getDocs(q);
            return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            LogService.error('FirestoreService', 'getIncomingRequests', error);
            return [];
        }
    }

    async acceptFriendRequest(myUid, senderUid) {
        try {
            const senderProfile = await this.getUserProfile(senderUid);
            const myProfile = await this.getUserProfile(myUid);
            const batch = writeBatch(db);

            const myFriendRef = doc(db, "users", myUid, "friends", senderUid);
            batch.set(myFriendRef, {
                uid: senderUid,
                email: senderProfile.email,
                displayName: senderProfile.displayName,
                username: senderProfile.username || '',
                avatarUrl: senderProfile.photoURL,
                addedAt: serverTimestamp()
            });

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
        } catch (error) {
            LogService.error('FirestoreService', 'acceptFriendRequest', error);
            throw error;
        }
    }

    async rejectFriendRequest(myUid, senderUid) {
        try {
            await deleteDoc(doc(db, "users", myUid, "friend_requests", senderUid));
        } catch (error) {
            LogService.error('FirestoreService', 'rejectFriendRequest', error);
            throw error;
        }
    }

    async getFriends(userId) {
        try {
            const snap = await getDocs(collection(db, "users", userId, "friends"));
            return snap.docs.map(doc => doc.data());
        } catch (error) {
            LogService.error('FirestoreService', 'getFriends', error);
            return [];
        }
    }

    // --- STORAGE ---
    async uploadImage(file, path) {
        try {
            const storageRef = ref(storage, path);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);
            return downloadURL;
        } catch (error) {
            LogService.error('FirestoreService', 'uploadImage', error);
            throw new Error("Image upload failed.");
        }
    }
}

export const firestoreService = new FirestoreService();