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
import { PatientRecord } from '../types';
import { handleFirestoreError } from '../lib/utils';

const COLLECTION_NAME = 'patients';

export const patientService = {
  /**
   * Listen to real-time updates for patients
   */
  subscribeToPatients: (callback: (patients: PatientRecord[]) => void): Unsubscribe => {
    const q = query(collection(db, COLLECTION_NAME), orderBy('extensionDate', 'asc'));
    
    return onSnapshot(q, (snapshot) => {
      const patients = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          // Convert Firestore Timestamps to ISO strings if they are objects
          createdAt: data.createdAt?.toDate?.() ? data.createdAt.toDate().toISOString() : data.createdAt,
          updatedAt: data.updatedAt?.toDate?.() ? data.updatedAt.toDate().toISOString() : data.updatedAt,
        };
      }) as PatientRecord[];
      callback(patients);
    }, (error) => {
      handleFirestoreError(error, 'list', COLLECTION_NAME, auth);
    });
  },

  /**
   * Add a new patient admission
   */
  addPatient: async (patient: Omit<PatientRecord, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...patient,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, 'create', COLLECTION_NAME, auth);
    }
  },

  /**
   * Update an existing patient record
   */
  updatePatient: async (id: string, updates: Partial<PatientRecord>) => {
    try {
      const patientRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(patientRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, 'update', `${COLLECTION_NAME}/${id}`, auth);
    }
  },

  /**
   * Delete a patient record
   */
  deletePatient: async (id: string) => {
    try {
      const patientRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(patientRef);
    } catch (error) {
      handleFirestoreError(error, 'delete', `${COLLECTION_NAME}/${id}`, auth);
    }
  }
};
