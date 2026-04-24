import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit,
  serverTimestamp,
  type Unsubscribe
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { ChatMessage } from '../types';
import { handleFirestoreError } from '../lib/utils';

const COLLECTION_NAME = 'messages';

export const chatService = {
  /**
   * Listen to real-time chat messages
   */
  subscribeToMessages: (callback: (messages: ChatMessage[]) => void): Unsubscribe => {
    const q = query(
      collection(db, COLLECTION_NAME), 
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    
    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate?.() 
            ? data.createdAt.toDate().toISOString() 
            : (data.createdAt || new Date().toISOString()),
        };
      }).reverse() as ChatMessage[];
      callback(messages);
    }, (error) => {
      handleFirestoreError(error, 'list', COLLECTION_NAME, auth);
    });
  },

  /**
   * Send a new chat message
   */
  sendMessage: async (message: Omit<ChatMessage, 'id' | 'createdAt'>) => {
    try {
      await addDoc(collection(db, COLLECTION_NAME), {
        ...message,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, 'create', COLLECTION_NAME, auth);
    }
  }
};
