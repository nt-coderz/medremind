/**
 * MedRemind Doctor Medical Report & Compliance PDF Export Service
 * Built with jsPDF, jspdf-autotable, and Capacitor Filesystem & Share plugins.
 * Works seamlessly in native Capacitor Android build and standard web browsers.
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { format } from 'date-fns';

export async function generateDoctorReportPdf({
  patient,
  medicalInfo = {},
  allergies = [],
  medicines = [],
  complianceData,
  dateRangeDays = 30,
  includeMedicalInfo = true
}) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const generatedDate = format(new Date(), 'dd MMM yyyy, hh:mm a');

  // --- Document Header ---
  doc.setFillColor(35, 139, 120); // MedRemind Teal (#238B78)
  doc.rect(0, 0, pageWidth, 54, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('MedRemind — Patient Medication & Adherence Report', 36, 34);

  // --- Patient Demographics Card ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(32, 43, 40);
  doc.text('Patient Demographics', 36, 78);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(70, 80, 75);

  const name = patient?.name || 'Patient';
  const email = patient?.email || '—';
  const phone = patient?.phoneNumber || patient?.phone || '—';
  const dob = patient?.dob || '—';
  const gender = patient?.gender || '—';
  const patientId = patient?.id ? `${patient.id.slice(0, 18)}...` : '—';

  doc.text(`Full Name: ${name}`, 36, 94);
  doc.text(`Date of Birth: ${dob}`, 36, 108);
  doc.text(`Gender: ${gender}`, 36, 122);

  doc.text(`Contact: ${phone}`, 240, 94);
  doc.text(`Email: ${email}`, 240, 108);
  doc.text(`Patient ID: ${patientId}`, 240, 122);

  doc.text(`Report Period: Past ${dateRangeDays} Days`, 430, 94);
  doc.text(`Generated: ${format(new Date(), 'dd-MMM-yyyy')}`, 430, 108);

  let currentY = 138;

  // --- Medical Info & Allergies (If Enabled) ---
  if (includeMedicalInfo) {
    doc.setDrawColor(230, 236, 232);
    doc.setLineWidth(0.8);
    doc.line(36, currentY, pageWidth - 36, currentY);
    currentY += 16;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(32, 43, 40);
    doc.text('Clinical Summary & Documented Allergies', 36, currentY);
    currentY += 16;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(70, 80, 75);

    const allergyText = allergies.length > 0 ? allergies.join(', ') : 'None documented';
    const bloodType = medicalInfo.bloodType || 'Unknown';
    const conditions = Array.isArray(medicalInfo.conditions) 
      ? medicalInfo.conditions.join(', ') 
      : (medicalInfo.conditions || 'None reported');
    const doctor = medicalInfo.primaryDoctor 
      ? `${medicalInfo.primaryDoctor} ${medicalInfo.doctorPhone ? `(${medicalInfo.doctorPhone})` : ''}` 
      : 'None recorded';
    const emergency = medicalInfo.emergencyContactName 
      ? `${medicalInfo.emergencyContactName} (${medicalInfo.emergencyContactRelation || 'Contact'}) - ${medicalInfo.emergencyContactPhone || ''}` 
      : 'None recorded';

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(190, 24, 93); // Rose color for allergies
    doc.text(`Documented Allergies: ${allergyText}`, 36, currentY);
    currentY += 14;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(70, 80, 75);
    doc.text(`Blood Group: ${bloodType}   |   Height/Weight: ${medicalInfo.height || '—'} / ${medicalInfo.weight || '—'}`, 36, currentY);
    currentY += 14;

    doc.text(`Chronic Conditions: ${conditions}`, 36, currentY);
    currentY += 14;

    doc.text(`Primary Physician: ${doctor}`, 36, currentY);
    currentY += 14;

    doc.text(`Emergency Contact: ${emergency}`, 36, currentY);
    currentY += 18;
  }

  // --- Active Medications Table ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(32, 43, 40);
  doc.text('Current Active Medications & Daily Timings', 36, currentY);
  currentY += 8;

  const medRows = medicines.map((m, idx) => [
    idx + 1,
    m.name || 'Unnamed',
    m.genericIngredient || m.name || '—',
    m.dosage || '1 Tab',
    m.frequency || 'Daily',
    (m.timeSlots || []).join(', ') || 'Morning',
    m.instructions || 'Take with water'
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['#', 'Brand Name', 'Generic Ingredient', 'Dosage', 'Frequency', 'Times', 'Instructions']],
    body: medRows.length > 0 ? medRows : [['—', 'No active medications', '—', '—', '—', '—', '—']],
    theme: 'striped',
    headStyles: {
      fillColor: [35, 139, 120],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold'
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [32, 43, 40]
    },
    margin: { left: 36, right: 36 }
  });

  currentY = doc.lastAutoTable.finalY + 20;

  // --- Compliance & Adherence Statistics Table ---
  if (currentY > pageHeight - 160) {
    doc.addPage();
    currentY = 40;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(32, 43, 40);
  doc.text('Dose Adherence Summary', 36, currentY);
  currentY += 8;

  const totalSched = complianceData?.weekScheduled || 0;
  const takenCount = complianceData?.weekTaken || 0;
  const skippedCount = complianceData?.weekSkipped || 0;
  const missedCount = complianceData?.weekMissed || 0;
  const adherence = complianceData?.overallAdherence !== null ? `${complianceData.overallAdherence}%` : 'N/A';

  autoTable(doc, {
    startY: currentY,
    head: [['Total Scheduled Doses', 'Doses Taken', 'Doses Skipped', 'Doses Missed (Past Due)', 'Overall Adherence Rate']],
    body: [[
      totalSched.toString(),
      takenCount.toString(),
      skippedCount.toString(),
      missedCount.toString(),
      adherence
    ]],
    theme: 'grid',
    headStyles: {
      fillColor: [60, 75, 70],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold'
    },
    bodyStyles: {
      fontSize: 9,
      fontStyle: 'bold',
      halign: 'center',
      textColor: [32, 43, 40]
    },
    margin: { left: 36, right: 36 }
  });

  currentY = doc.lastAutoTable.finalY + 16;

  // --- Clinical Disclaimer Box ---
  if (currentY > pageHeight - 100) {
    doc.addPage();
    currentY = 40;
  }

  doc.setFillColor(248, 250, 248);
  doc.setDrawColor(200, 215, 205);
  doc.roundedRect(36, currentY, pageWidth - 72, 48, 4, 4, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(35, 139, 120);
  doc.text('NOTICE FOR PHYSICIAN / CLINICIAN', 46, currentY + 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(80, 95, 90);
  doc.text(
    'This report contains patient-recorded adherence logs and medication schedules recorded via the MedRemind application. It is provided for informational collaboration during clinical consultations and does not constitute a certified medical chart.',
    46,
    currentY + 28,
    { maxWidth: pageWidth - 92 }
  );

  // --- Add Page Numbers & Standardized Footer to All Pages ---
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(140, 150, 145);
    const footerText = `Generated by MedRemind on ${generatedDate}. Patient-recorded data, not a medical record. Page ${i} of ${totalPages}`;
    doc.text(footerText, pageWidth / 2, pageHeight - 20, { align: 'center' });
  }

  // --- Platform-Specific Output Handling (Capacitor Native vs Web Browser) ---
  const fileName = `MedRemind-Report-${patient?.name ? patient.name.replace(/\s+/g, '_') : 'Patient'}-${format(new Date(), 'yyyyMMdd')}.pdf`;

  if (Capacitor.isNativePlatform()) {
    try {
      // Get base64 representation without data URI prefix
      const base64Data = doc.output('datauristring').split(',')[1];
      
      const writeResult = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache
      });

      await Share.share({
        title: 'MedRemind Medication & Adherence Report',
        text: `Medication report for ${name} generated on ${generatedDate}`,
        url: writeResult.uri,
        dialogTitle: 'Share Doctor PDF Report'
      });

      return { success: true, method: 'capacitor_native', fileName };
    } catch (nativeErr) {
      console.warn('[PDF Service] Capacitor Native Share failed, falling back to blob save:', nativeErr);
      doc.save(fileName);
      return { success: true, method: 'browser_fallback', fileName };
    }
  } else {
    // Web browser download
    doc.save(fileName);
    return { success: true, method: 'browser_download', fileName };
  }
}
