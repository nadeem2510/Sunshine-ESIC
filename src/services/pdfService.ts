import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { PatientRecord } from '../types';

/**
 * Service to generate PDFs for Sunshine Hospital
 */
export const pdfService = {
  /**
   * Generates a daily dashboard report
   */
  generateDashboardReport: (patients: PatientRecord[]) => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    const today = format(new Date(), 'dd MMM yyyy');

    // Header
    doc.setFontSize(22);
    doc.setTextColor(20, 20, 20);
    doc.text('SUNSHINE HOSPITAL', 14, 20);
    
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`Daily ESIC Patient Tracking Report - ${today}`, 14, 28);

    // Summary Table
    const tableData = patients.map((p, index) => [
      index + 1,
      p.name,
      p.category,
      p.tlcNo || '-',
      p.dispensary,
      format(new Date(p.dateOfAdmission), 'dd/MM/yy'),
      p.approvalStatus,
      p.daysApproved,
      format(new Date(p.extensionDate), 'dd/MM/yy'),
      p.reApprovalNeeded ? 'YES' : 'No',
      p.fileStatus
    ]);

    (doc as any).autoTable({
      startY: 35,
      head: [['#', 'Patient Name', 'Category', 'TLC No', 'Dispensary', 'DOA', 'Approval', 'Days', 'Ext. Date', 'Re-Appr.', 'File Status']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 50 },
        7: { textColor: [200, 0, 0], fontStyle: 'bold' } // Highlight Re-Approval Needed
      }
    });

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Page ${i} of ${pageCount} | Generated for Internal Administrative Reference`, 14, 200);
    }

    doc.save(`ESIC_Daily_Report_${today}.pdf`);
  },

  /**
   * Generates a single patient file report
   */
  generatePatientReport: (patient: PatientRecord) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const today = format(new Date(), 'dd MMM yyyy');

    // Header
    doc.setFontSize(24);
    doc.text('SUNSHINE HOSPITAL', 105, 30, { align: 'center' });
    doc.setFontSize(14);
    doc.text('Patient Admission Summary (ESIC)', 105, 40, { align: 'center' });
    
    doc.setLineWidth(0.5);
    doc.line(20, 45, 190, 45);

    // Patient Details
    doc.setFontSize(12);
    let y = 60;
    const lineHeight = 10;

    const details = [
      ['Patient Name:', patient.name],
      ['Mobile Number:', patient.mobileNo],
      ['Treatment Category:', patient.category],
      ['ESIC Dispensary:', patient.dispensary],
      ['TLC No (ESIC Auth):', patient.tlcNo || 'N/A'],
      ['Date of Admission:', format(new Date(patient.dateOfAdmission), 'dd MMMM yyyy')],
      ['Approval Status:', patient.approvalStatus],
      ['Days Approved:', String(patient.daysApproved)],
      ['Extension Date:', format(new Date(patient.extensionDate), 'dd MMMM yyyy')],
      ['Re-Approval Needed:', patient.reApprovalNeeded ? 'YES (High Priority)' : 'No'],
      ['File Status:', patient.fileStatus],
    ];

    details.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, 20, y);
      doc.setFont('helvetica', 'normal');
      doc.text(value, 80, y);
      y += lineHeight;
    });

    doc.setFontSize(10);
    doc.text(`Report Generated On: ${today}`, 20, 150);
    doc.text('Signature of Medical Superintendent', 130, 250);
    doc.line(130, 245, 190, 245);

    doc.save(`Patient_File_${patient.name.replace(/\s+/g, '_')}.pdf`);
  }
};
