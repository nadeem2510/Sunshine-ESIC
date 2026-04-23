/**
 * ESIC Patient Record Data Model
 */

export type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected';

export type FileStatus = 
  | 'Initial Stage' 
  | 'Documentation Pending' 
  | 'File Completed' 
  | 'Final Submission to ESIC';

export type Dispensary = 'Waluj' | 'Paithan' | 'Chikalthana' | 'CIDCO' | 'Other';

export interface PatientRecord {
  id: string;
  name: string;
  mobileNo: string; // 10 digits
  dispensary: Dispensary;
  dateOfAdmission: string; // ISO string
  approvalStatus: ApprovalStatus;
  daysApproved: number;
  extensionDate: string; // ISO string, auto-calculated but editable
  reApprovalNeeded: boolean;
  fileStatus: FileStatus;
  createdAt: string;
  updatedAt: string;
}

export type StaffRole = 'admin' | 'staff';

export interface Staff {
  id: string;
  email: string;
  displayName: string;
  role: StaffRole;
  createdAt: string;
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: {
    userId: string;
    email: string;
    emailVerified: boolean;
    isAnonymous: boolean;
    providerInfo: { providerId: string; displayName: string; email: string; }[];
  }
}
