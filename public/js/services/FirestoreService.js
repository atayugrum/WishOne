// js/services/FirestoreService.js
import { db } from '../config/firebase-config.js';
import { 
    collection, 
    getDocs, 
    addDoc, 
    deleteDoc, 
    updateDoc, // <--- THIS WAS MISSING
    doc, 
    getDoc,    // Used for profile fetching
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
            // Added: where("isOwned", "==", false)
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

    // 4. LINK PARTNER (The function causing the error)
    async linkPartner(myUid, partnerEmail) {
        // Find partner by email
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", partnerEmail));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            throw new Error("User not found. Ask them to login to WishOne first!");
        }

        const partnerDoc = querySnapshot.docs[0];
        const partnerId = partnerDoc.id;

        // Check if trying to link to self
        if (partnerId === myUid) {
            throw new Error("You cannot link to yourself!");
        }

        // Update MY profile
        await updateDoc(doc(db, "users", myUid), {
            partnerId: partnerId
        });

        // Update THEIR profile
        await updateDoc(doc(db, "users", partnerId), {
            partnerId: myUid
        });

        return partnerDoc.data();
    }

    // 5. Get User Profile
    async getUserProfile(uid) {
        const docRef = doc(db, "users", uid);
        const snap = await getDoc(docRef);
        return snap.exists() ? snap.data() : null;
    }

    // 5. CLAIM / UNCLAIM ITEM
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

    // 6. BOARD MANAGEMENT
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

    // 7. PIN MANAGEMENT (Images inside boards)
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