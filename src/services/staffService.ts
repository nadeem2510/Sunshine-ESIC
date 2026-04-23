import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp,
  type Unsubscribe
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { Staff } from '../types';
import { handleFirestoreError } from '../lib/utils';

const COLLECTION_NAME = 'staff';

export const staffService = {
  /**
   * Listen to real-time updates for staff members
   */
  subscribeToStaff: (callback: (staff: Staff[]) => void): Unsubscribe => {
    const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
    
    return onSnapshot(q, (snapshot) => {
      const staffMembers = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate?.() ? data.createdAt.toDate().toISOString() : data.createdAt,
        };
      }) as Staff[];
      callback(staffMembers);
    }, (error) => {
      handleFirestoreError(error, 'list', COLLECTION_NAME, auth);
    });
  },

  /**
   * Add a new staff member
   */
  addStaff: async (staff: Omit<Staff, 'id' | 'createdAt'>) => {
    try {
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...staff,
        createdAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, 'create', COLLECTION_NAME, auth);
    }
  },

  /**
   * Update staff member role or details
   */
  updateStaff: async (id: string, updates: Partial<Staff>) => {
    try {
      const staffRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(staffRef, {
        ...updates,
      });
    } catch (error) {
      handleFirestoreError(error, 'update', `${COLLECTION_NAME}/${id}`, auth);
    }
  },

  /**
   * Remove a staff member
   */
  deleteStaff: async (id: string) => {
    try {
      const staffRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(staffRef);
    } catch (error) {
      handleFirestoreError(error, 'delete', `${COLLECTION_NAME}/${id}`, auth);
    }
  }
};
