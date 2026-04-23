import * as XLSX from 'xlsx';
import { PatientRecord } from '../types';
import { format } from 'date-fns';

class ExcelService {
  exportPatientsToExcel(patients: PatientRecord[], fileName: string = 'Patient_Records') {
    const data = patients.map(p => ({
      'Patient Name': p.name,
      'Mobile No': p.mobileNo,
      'Category': p.category,
      'Dispensary': p.dispensary,
      'Date of Admission': format(new Date(p.dateOfAdmission), 'dd/MM/yyyy'),
      'Days Approved': p.daysApproved,
      'Extension Date': format(new Date(p.extensionDate), 'dd/MM/yyyy'),
      'Status': p.approvalStatus,
      'Re-Approval Needed': p.reApprovalNeeded ? 'Yes' : 'No',
      'Created At': format(new Date(p.createdAt), 'dd/MM/yyyy HH:mm'),
      'Extensions': p.extensions?.length || 0
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Patients');

    // Generate buffer and trigger download
    XLSX.writeFile(workbook, `${fileName}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
  }
}

export const excelService = new ExcelService();
