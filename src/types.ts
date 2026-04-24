/**
 * ESIC Patient Record Data Model
 */

export type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected' | 'Discharged';

export type PatientCategory = 'Surgical' | 'Medical Management' | 'Maternity' | 'Other';

export type FileStatus = 
  | 'Initial Stage' 
  | 'Documentation Pending' 
  | 'File Completed' 
  | 'Final Submission to ESIC';

export type Dispensary = 'Waluj' | 'Waluj DCBO' | 'Paithan';

export interface PatientExtension {
  additionalDays: number;
  reason: string;
  createdAt: string;
}

export interface PatientRecord {
  id: string;
  name: string;
  mobileNo: string; // 10 digits
  category: PatientCategory;
  dispensary: Dispensary;
  dateOfAdmission: string; // ISO string
  tlcNo?: string; // Authorized by ESIC
  approvalStatus: ApprovalStatus;
  daysApproved: number;
  extensionDate: string; // ISO string, auto-calculated but editable
  reApprovalNeeded: boolean;
  extensions?: PatientExtension[];
  isDischarged?: boolean;
  dischargedAt?: string;
  dischargeReason?: string;
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

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: StaffRole;
  text: string;
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
