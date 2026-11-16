import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  FileDown, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Filter,
  Check,
  Share2,
  ShieldAlert,
  TrendingUp
} from 'lucide-react';
import { format, subDays, addDays } from 'date-fns';
import { useMedicine } from '../../context/MedicineContext';
import { useAuth } from '../../context/AuthContext';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import WeeklyComplianceChart from '../../components/charts/WeeklyComplianceChart';
import { generateDoctorReportPdf } from '../../services/pdfReportService';
import { apiFetch } from '../../config/apiConfig';
import { toast } from 'sonner';

export default function HistoryPage() {
  const navigate = useNavigate();
  const { medicines, getWeeklyCompliance, doseOccurrences, patientProfile } = useMedicine();
  const { currentUser } = useAuth();

  // Week navigation state
  const [weekOffset, setWeekOffset] = useState(0);
  const currentWeekStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + (weekOffset * 7));
    return d;
  }, [weekOffset]);

  const compliance = getWeeklyCompliance(currentWeekStart);

  // Filter state for logs
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'taken' | 'skipped' | 'missed'

  // PDF Export Modal State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportRangeDays, setExportRangeDays] = useState(30);
  const [includeMedicalInfo, setIncludeMedicalInfo] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // User medical profile for export
  const [medicalProfile, setMedicalProfile] = useState({
    allergies: patientProfile?.allergies || [],
    medicalInfo: {}
  });

  useEffect(() => {
    const loadMedical = async () => {
      try {
        const res = await apiFetch('/profile/medical');
        if (res && res.ok) {
          const data = await res.json();
          if (data.success) {
            setMedicalProfile({
              allergies: Array.isArray(data.allergies) ? data.allergies : (patientProfile?.allergies || []),
              medicalInfo: data.medicalInfo || {}
            });
          }
        }
      } catch (e) {
        console.warn('Could not load medical details for report:', e);
      }
    };
    loadMedical();
  }, [patientProfile]);

  // Aggregate recent occurrence history
  const recentDoseLogs = useMemo(() => {
    const list = [];
    const activeMeds = medicines.filter(m => m.status === 'Active');

    // Look back past 7 days
    for (let i = 0; i < 7; i++) {
      const d = subDays(new Date(), i);
      const dateStr = format(d, 'yyyy-MM-dd');
      const now = new Date();
      const isToday = dateStr === format(now, 'yyyy-MM-dd');

      activeMeds.forEach(med => {
        (med.timeSlots || []).forEach(slot => {
          const occKey = `${med.id}_${slot}_${dateStr}`;
          const occ = doseOccurrences ? doseOccurrences[occKey] : null;

          let status = occ?.status || 'pending';
          if (!occ && !isToday) {
            status = 'missed';
          }

          list.push({
            id: occKey,
            medName: med.name,
            dosage: med.dosage,
            slot,
            date: dateStr,
            displayDate: isToday ? 'Today' : format(d, 'EEE, MMM d'),
            status,
            takenAt: occ?.takenAt || null,
            skippedReason: occ?.reason || null
          });
        });
      });
    }

    if (statusFilter === 'ALL') return list;
    return list.filter(item => item.status === statusFilter);
  }, [medicines, doseOccurrences, statusFilter]);

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const result = await generateDoctorReportPdf({
        patient: {
          name: currentUser?.name || patientProfile?.name || 'Patient',
          email: currentUser?.email || patientProfile?.email || '',
          phoneNumber: currentUser?.phoneNumber || currentUser?.phone || patientProfile?.phone || '',
          dob: currentUser?.dob || patientProfile?.dob || '',
          gender: currentUser?.gender || patientProfile?.gender || '',
          id: currentUser?.id || patientProfile?.id || ''
        },
        medicalInfo: medicalProfile.medicalInfo,
        allergies: medicalProfile.allergies,
        medicines: medicines.filter(m => m.status === 'Active'),
        complianceData: compliance,
        dateRangeDays: exportRangeDays,
        includeMedicalInfo
      });

      if (result.success) {
        toast.success(`Report exported successfully (${result.fileName})`);
        setShowExportModal(false);
      }
    } catch (err) {
      console.error('[PDF Export Error]', err);
      toast.error('Failed to generate PDF report: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl text-[#7A8782] hover:text-[#202B28] hover:bg-white transition-colors cursor-pointer"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-base font-bold text-[#202B28]">Medication History</h2>
            <p className="text-xs text-[#7A8782]">Dose adherence & compliance logs</p>
          </div>
        </div>

        <Button
          size="sm"
          variant="primary"
          icon={FileDown}
          onClick={() => setShowExportModal(true)}
          className="shadow-xs"
        >
          Export PDF
        </Button>
      </div>

      {/* Full Weekly Compliance Chart with Week Controls */}
      <WeeklyComplianceChart
        weekStartDate={currentWeekStart}
        onPrevWeek={() => setWeekOffset(prev => prev - 1)}
        onNextWeek={() => setWeekOffset(prev => prev + 1)}
        compact={false}
      />

      {/* Summary KPI Counters */}
      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        <div className="bg-white p-2.5 rounded-2xl border border-gray-200">
          <span className="block text-base font-bold text-gray-800">{compliance.weekScheduled}</span>
          <span className="text-[10px] text-gray-400 font-semibold uppercase">Scheduled</span>
        </div>
        <div className="bg-emerald-50/70 p-2.5 rounded-2xl border border-emerald-200">
          <span className="block text-base font-bold text-emerald-700">{compliance.weekTaken}</span>
          <span className="text-[10px] text-emerald-600 font-semibold uppercase">Taken</span>
        </div>
        <div className="bg-amber-50/70 p-2.5 rounded-2xl border border-amber-200">
          <span className="block text-base font-bold text-amber-700">{compliance.weekSkipped}</span>
          <span className="text-[10px] text-amber-600 font-semibold uppercase">Skipped</span>
        </div>
        <div className="bg-rose-50/70 p-2.5 rounded-2xl border border-rose-200">
          <span className="block text-base font-bold text-rose-700">{compliance.weekMissed}</span>
          <span className="text-[10px] text-rose-600 font-semibold uppercase">Missed</span>
        </div>
      </div>

      {/* Dose Occurrence History Logs */}
      <Card className="space-y-3 bg-white">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-xs uppercase tracking-wider text-[#202B28] flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-[#238B78]" /> Recent Dose Logs (Past 7 Days)
          </h3>
          <span className="text-[11px] text-gray-400">
            {recentDoseLogs.length} doses
          </span>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          <Filter className="w-3.5 h-3.5 text-gray-400 shrink-0 ml-0.5" />
          {[
            { key: 'ALL', label: 'All Doses' },
            { key: 'taken', label: 'Taken' },
            { key: 'skipped', label: 'Skipped' },
            { key: 'missed', label: 'Missed' }
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-all shrink-0 ${
                statusFilter === f.key
                  ? 'bg-teal-600 text-white border-teal-600 font-semibold'
                  : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* List of Occurrence Logs */}
        <div className="space-y-2">
          {recentDoseLogs.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6 italic">No dose records matching filter.</p>
          ) : (
            recentDoseLogs.map(item => (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-[#F8FAF8] border border-[#E6ECE8] flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-gray-900">{item.medName}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    {item.dosage} · {item.slot} · {item.displayDate}
                  </div>
                </div>

                <div>
                  {item.status === 'taken' && (
                    <Badge variant="success" icon={CheckCircle2}>Taken</Badge>
                  )}
                  {item.status === 'skipped' && (
                    <Badge variant="warning" icon={XCircle}>Skipped</Badge>
                  )}
                  {item.status === 'missed' && (
                    <Badge variant="danger" icon={AlertCircle}>Missed</Badge>
                  )}
                  {item.status === 'pending' && (
                    <Badge variant="neutral">Pending</Badge>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* PDF Export Options Modal */}
      <Modal
        isOpen={showExportModal}
        onClose={() => { if (!isExporting) setShowExportModal(false); }}
        title="Export Doctor Report (PDF)"
      >
        <div className="space-y-4 text-xs text-gray-700">
          <p className="text-[11px] text-gray-500 leading-relaxed">
            Generate a clean, physician-ready PDF summary of your current prescriptions, dosages, documented allergies, and compliance statistics.
          </p>

          {/* Date Range Selection */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
              Report Time Range
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { days: 7, label: 'Past 7 Days' },
                { days: 30, label: 'Past 30 Days' },
                { days: 90, label: 'Past 90 Days' }
              ].map(opt => (
                <button
                  key={opt.days}
                  type="button"
                  onClick={() => setExportRangeDays(opt.days)}
                  className={`p-2.5 rounded-xl border text-center font-semibold transition-all ${
                    exportRangeDays === opt.days
                      ? 'bg-teal-50 border-teal-600 text-teal-900 shadow-xs'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Include Medical Info Checkbox */}
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-1">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={includeMedicalInfo}
                onChange={(e) => setIncludeMedicalInfo(e.target.checked)}
                className="w-4 h-4 rounded accent-teal-600"
              />
              <span className="font-semibold text-gray-800 text-xs">
                Include Allergies & Medical Information
              </span>
            </label>
            <p className="text-[10px] text-gray-500 pl-6">
              Attaches blood type, emergency contact, conditions, and documented drug allergies to the report.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              fullWidth
              disabled={isExporting}
              onClick={() => setShowExportModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              fullWidth
              disabled={isExporting}
              icon={FileDown}
              onClick={handleExportPdf}
            >
              {isExporting ? 'Generating PDF...' : 'Download / Share PDF'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
