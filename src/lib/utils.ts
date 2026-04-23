import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges class names with tailwind-merge
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a Firestore error for logging/display
 */
export function handleFirestoreError(
  error: any,
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write',
  path: string | null = null,
  auth: any = null
) {
  const errorInfo = {
    error: error.message || 'Unknown Firestore error',
    operationType,
    path,
    authInfo: auth ? {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      providerInfo: auth.currentUser?.providerData.map((p: any) => ({
        providerId: p.providerId,
        displayName: p.displayName,
        email: p.email
      }))
    } : null
  };
  
  const errorString = JSON.stringify(errorInfo);
  console.error('Firestore Error:', errorString);
  throw new Error(errorString);
}
