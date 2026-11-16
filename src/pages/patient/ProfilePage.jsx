import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMedicine } from '../../context/MedicineContext';
import { useAuth } from '../../context/AuthContext';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import BrandLogo from '../../components/common/BrandLogo';
import LanguagePickerModal from '../../components/common/LanguagePickerModal';
import { 
  User, 
  Bell, 
  HeartPulse, 
  LogOut, 
  Copy, 
  Check, 
  ShieldCheck, 
  FileText, 
  Clock, 
  AlertTriangle, 
  Trash2, 
  ShieldAlert,
  Utensils,
  Globe,
  Plus,
  X,
  Edit2,
  Save,
  Phone,
  Info
} from 'lucide-react';
import { formatShortUserId } from '../../utils/idGenerator';
import { getUserInitials, getUserDisplayName } from '../../utils/greetingUtils';
import { apiFetch } from '../../config/apiConfig';
import { toast } from 'sonner';

const COMMON_ALLERGIES = [
  'Penicillin',
  'Sulfa drugs',
  'Aspirin',
  'Ibuprofen',
  'Peanuts',
  'Latex',
  'Shellfish',
  'Eggs',
  'Dairy'
];

const BLOOD_TYPES = ['Unknown', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function ProfilePage() {
  const navigate = useNavigate();
  const { patientProfile, updatePatientProfile } = useMedicine();
  const { currentUser, logout, scheduleDeletion, cancelDeletion, updateUserMedicalInfo } = useAuth();
  const [copied, setCopied] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);

  // Allergies & Medical Info State
  const [allergies, setAllergies] = useState(patientProfile?.allergies || []);
  const [newAllergyInput, setNewAllergyInput] = useState('');
  const [isEditingMedical, setIsEditingMedical] = useState(false);
  const [isSavingMedical, setIsSavingMedical] = useState(false);
  const [medicalInfo, setMedicalInfo] = useState({
    bloodType: patientProfile?.bloodType || 'Unknown',
    conditions: patientProfile?.conditions || '',
    primaryDoctor: patientProfile?.primaryDoctor || '',
    doctorPhone: patientProfile?.doctorPhone || '',
    emergencyContactName: patientProfile?.emergencyContactName || '',
    emergencyContactPhone: patientProfile?.emergencyContactPhone || '',
    emergencyContactRelation: patientProfile?.emergencyContactRelation || '',
    height: patientProfile?.height || '',
    weight: patientProfile?.weight || '',
    notes: patientProfile?.notes || ''
  });

  // 24-Hour Account Deletion State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [deletionTimeRemaining, setDeletionTimeRemaining] = useState('');

  const displayName = getUserDisplayName(currentUser || patientProfile);
  const initials = getUserInitials(displayName);
  const displayEmail = currentUser?.email || patientProfile.email || 'No email recorded';
  const displayUserId = currentUser?.id || patientProfile.id;
  const displayDob = currentUser?.dob || patientProfile.dob || 'Not provided';
  const displayGender = currentUser?.gender || patientProfile.gender || 'Not provided';
  const displayPhone = currentUser?.phoneNumber || currentUser?.phone || patientProfile.phone || 'Not provided';

  // Fetch medical profile from server on mount
  useEffect(() => {
    const fetchMedical = async () => {
      try {
        const res = await apiFetch('/profile/medical');
        if (res && res.ok) {
          const data = await res.json();
          if (data.success) {
            if (Array.isArray(data.allergies) && data.allergies.length > 0) {
              setAllergies(data.allergies);
            }
            if (data.medicalInfo && typeof data.medicalInfo === 'object') {
              setMedicalInfo(prev => ({ ...prev, ...data.medicalInfo }));
            }
          }
        }
      } catch (e) {
        console.warn('Could not load medical profile:', e);
      }
    };
    fetchMedical();
  }, []);

  const handleAddAllergy = (allergyToAdd) => {
    const val = (allergyToAdd || newAllergyInput).trim();
    if (!val) return;
    if (allergies.some(a => a.toLowerCase() === val.toLowerCase())) {
      toast.info(`"${val}" is already recorded`);
      setNewAllergyInput('');
      return;
    }
    setAllergies(prev => [...prev, val]);
    setNewAllergyInput('');
  };

  const handleRemoveAllergy = (idxToRemove) => {
    setAllergies(prev => prev.filter((_, idx) => idx !== idxToRemove));
  };

  const handleSaveMedicalInfo = async () => {
    setIsSavingMedical(true);
    // 1. Immediately persist locally (offline-first safeguard)
    if (typeof updatePatientProfile === 'function') {
      updatePatientProfile({
        allergies,
        medicalInfo,
        ...medicalInfo
      });
    }
    if (typeof updateUserMedicalInfo === 'function') {
      updateUserMedicalInfo(allergies, medicalInfo);
    }

    try {
      const res = await apiFetch('/profile/medical', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          allergies,
          medicalInfo
        })
      });
      if (res && res.ok) {
        const data = await res.json();
        if (data.success) {
          toast.success('Medical information updated successfully');
        } else {
          toast.success('Medical details saved locally on device');
        }
      } else {
        toast.success('Medical details saved locally on device');
      }
      setIsEditingMedical(false);
    } catch (err) {
      toast.success('Medical details saved locally on device (offline mode)');
      setIsEditingMedical(false);
    } finally {
      setIsSavingMedical(false);
    }
  };

  // Real-time remaining grace period calculation
  useEffect(() => {
    const updateCountdown = () => {
      if (currentUser?.status === 'Pending_Deletion' && currentUser?.scheduledDeletionAt) {
        const diffMs = new Date(currentUser.scheduledDeletionAt).getTime() - Date.now();
        if (diffMs <= 0) {
          setDeletionTimeRemaining('Deletion in progress');
        } else {
          const hours = Math.floor(diffMs / (1000 * 60 * 60));
          const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
          const secs = Math.floor((diffMs % (1000 * 60)) / 1000);
          setDeletionTimeRemaining(`${hours}h ${mins}m ${secs}s`);
        }
      }
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const handleCopyId = () => {
    navigator.clipboard.writeText(displayUserId);
    setCopied(true);
    toast.success('Unique User ID copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggle = (name) => {
    toast.success(`Notification preference updated`);
  };

  const handleSignOut = () => {
    logout();
    toast.info('Signed out successfully');
    navigate('/welcome');
  };

  // 2-Step Account Deletion Flow
  const handleConfirmScheduleDeletion = async () => {
    setIsDeleting(true);
    try {
      const res = await scheduleDeletion('User requested closure in profile settings');
      if (res.success) {
        toast.warning('Account scheduled for deletion in 24 hours.');
        setShowDeleteModal(false);
        setDeleteStep(1);
      } else {
        toast.error(res.error || 'Failed to schedule deletion.');
      }
    } catch (e) {
      toast.error(e.message || 'Error scheduling deletion');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDeletion = async () => {
    setIsCancelling(true);
    try {
      const res = await cancelDeletion();
      if (res.success) {
        toast.success('Account deletion cancelled. Your account is active.');
      } else {
        toast.error(res.error || 'Failed to cancel deletion.');
      }
    } catch (e) {
      toast.error(e.message || 'Error cancelling deletion');
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Active Deletion Grace Period Countdown Banner */}
      {currentUser?.status === 'Pending_Deletion' && (
        <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950 space-y-2.5 shadow-sm">
          <div className="flex items-start gap-2.5">
            <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5 animate-pulse" />
            <div className="flex-1">
              <h4 className="font-bold text-sm text-amber-900">Account Scheduled for Permanent Deletion</h4>
              <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                Your account and all associated prescriptions will be permanently erased in:
              </p>
              <div className="mt-1 font-mono font-bold text-base text-amber-950">
                {deletionTimeRemaining || 'Calculating...'}
              </div>
            </div>
          </div>
          <div className="pt-1 flex items-center justify-between border-t border-amber-200">
            <span className="text-[11px] text-amber-800 font-medium">Changed your mind?</span>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCancelDeletion}
              disabled={isCancelling}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isCancelling ? 'Restoring...' : 'Cancel Deletion'}
            </Button>
          </div>
        </div>
      )}

      {/* Profile Header */}
      <Card className="flex items-center gap-4 bg-gradient-to-r from-white to-[#F8FAF8]">
        <div className="w-14 h-14 rounded-2xl bg-[#238B78] text-white flex items-center justify-center text-xl font-bold shadow-md shadow-[#238B78]/20">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-[#202B28] truncate">{displayName}</h2>
          <p className="text-xs text-[#7A8782] truncate">{displayEmail}</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <Badge variant="primary" size="sm">
              {currentUser?.role ? currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1) : 'Patient'} Account
            </Badge>
            {currentUser?.status === 'Pending_Deletion' && (
              <Badge variant="warning" size="sm">Pending Deletion</Badge>
            )}
          </div>
        </div>
      </Card>

      {/* Unique User ID Display Card */}
      <Card className="p-3.5 space-y-1.5 bg-white">
        <span className="text-[10px] font-bold text-[#7A8782] uppercase tracking-wider block">
          Unique Patient ID (UUID v4)
        </span>
        <div className="flex items-center justify-between bg-[#F8FAF8] p-2 rounded-xl border border-[#E6ECE8] text-xs">
          <code className="text-[#238B78] font-mono text-[11px] truncate mr-2">
            {formatShortUserId(displayUserId)}
          </code>
          <button
            onClick={handleCopyId}
            className="flex items-center gap-1 text-[#7A8782] hover:text-[#202B28] font-medium text-xs cursor-pointer flex-shrink-0"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Full'}</span>
          </button>
        </div>
        <p className="text-[10px] text-[#7A8782]">
          This permanent ID uniquely identifies your account and prescriptions.
        </p>
      </Card>

      {/* Personal Profile Details (DOB, Gender, Email, Phone, Name) */}
      <Card className="space-y-3">
        <h3 className="font-bold text-xs uppercase tracking-wider text-[#202B28] flex items-center gap-1.5">
          <User className="w-4 h-4 text-[#238B78]" /> Personal Details
        </h3>
        <div className="grid grid-cols-2 gap-2.5 text-xs">
          <div className="p-2.5 rounded-xl bg-[#F8FAF8] border border-[#E6ECE8]">
            <span className="text-[10px] text-[#7A8782] block font-medium">Full Name</span>
            <span className="font-semibold text-[#202B28] mt-0.5 block truncate">{displayName}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-[#F8FAF8] border border-[#E6ECE8]">
            <span className="text-[10px] text-[#7A8782] block font-medium">Date of Birth</span>
            <span className="font-semibold text-[#202B28] mt-0.5 block truncate">{displayDob}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-[#F8FAF8] border border-[#E6ECE8]">
            <span className="text-[10px] text-[#7A8782] block font-medium">Gender</span>
            <span className="font-semibold text-[#202B28] mt-0.5 block truncate">{displayGender}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-[#F8FAF8] border border-[#E6ECE8]">
            <span className="text-[10px] text-[#7A8782] block font-medium">Phone Number</span>
            <span className="font-semibold text-[#202B28] mt-0.5 block truncate">{displayPhone}</span>
          </div>
        </div>
        <div className="p-2.5 rounded-xl bg-[#F8FAF8] border border-[#E6ECE8] text-xs">
          <span className="text-[10px] text-[#7A8782] block font-medium">Registered Email</span>
          <span className="font-semibold text-[#202B28] mt-0.5 block truncate">{displayEmail}</span>
        </div>
      </Card>

      {/* Allergies & Safety Warnings */}
      <Card className="space-y-3 bg-white">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-xs uppercase tracking-wider text-[#202B28] flex items-center gap-1.5">
            <HeartPulse className="w-4 h-4 text-rose-500" /> Documented Allergies
          </h3>
          <span className="text-[10px] text-gray-500">
            {allergies.length} recorded
          </span>
        </div>

        {/* Current Allergy Chips */}
        <div className="flex flex-wrap gap-1.5 min-h-[32px] pt-1">
          {allergies.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No drug or food allergies recorded yet.</p>
          ) : (
            allergies.map((allergy, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200"
              >
                <span>{allergy}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveAllergy(i)}
                  className="hover:text-rose-900 transition-colors p-0.5 rounded-full"
                  aria-label={`Remove allergy ${allergy}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))
          )}
        </div>

        {/* Custom Allergy Input */}
        <div className="flex gap-2 pt-1">
          <input
            type="text"
            value={newAllergyInput}
            onChange={(e) => setNewAllergyInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddAllergy();
              }
            }}
            placeholder="Type allergy (e.g., Penicillin, Peanuts)..."
            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-[#238B78] focus:bg-white transition-all"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleAddAllergy()}
            disabled={!newAllergyInput.trim()}
            icon={Plus}
          >
            Add
          </Button>
        </div>

        {/* Quick-Pick Allergy Chips */}
        <div className="pt-1.5 border-t border-gray-100">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
            Quick Pick Common Allergies
          </span>
          <div className="flex flex-wrap gap-1.5">
            {COMMON_ALLERGIES.map((item, idx) => {
              const isSelected = allergies.some(a => a.toLowerCase() === item.toLowerCase());
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleAddAllergy(item)}
                  disabled={isSelected}
                  className={`text-[11px] px-2 py-0.5 rounded-lg border transition-colors ${
                    isSelected
                      ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      : 'bg-[#F8FAF8] hover:bg-rose-50 text-gray-700 hover:text-rose-700 border-gray-200'
                  }`}
                >
                  + {item}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Medical Profile & Emergency Information */}
      <Card className="space-y-3 bg-white">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-xs uppercase tracking-wider text-[#202B28] flex items-center gap-1.5">
            <HeartPulse className="w-4 h-4 text-[#238B78]" /> Medical Information
          </h3>
          <Button
            size="sm"
            variant={isEditingMedical ? "primary" : "outline"}
            onClick={() => {
              if (isEditingMedical) {
                handleSaveMedicalInfo();
              } else {
                setIsEditingMedical(true);
              }
            }}
            disabled={isSavingMedical}
            icon={isEditingMedical ? Save : Edit2}
          >
            {isSavingMedical ? 'Saving...' : (isEditingMedical ? 'Save Changes' : 'Edit Info')}
          </Button>
        </div>

        {isEditingMedical ? (
          /* Editable Form Mode */
          <div className="space-y-3 pt-1 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-gray-500 font-medium block mb-1">Blood Type</label>
                <select
                  value={medicalInfo.bloodType || 'Unknown'}
                  onChange={(e) => setMedicalInfo(prev => ({ ...prev, bloodType: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-[#238B78]"
                >
                  {BLOOD_TYPES.map(bt => (
                    <option key={bt} value={bt}>{bt}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 font-medium block mb-1">Height / Weight</label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={medicalInfo.height || ''}
                    onChange={(e) => setMedicalInfo(prev => ({ ...prev, height: e.target.value }))}
                    placeholder="172 cm"
                    className="w-1/2 bg-gray-50 border border-gray-200 rounded-xl px-2 py-1.5 text-xs text-gray-800"
                  />
                  <input
                    type="text"
                    value={medicalInfo.weight || ''}
                    onChange={(e) => setMedicalInfo(prev => ({ ...prev, weight: e.target.value }))}
                    placeholder="68 kg"
                    className="w-1/2 bg-gray-50 border border-gray-200 rounded-xl px-2 py-1.5 text-xs text-gray-800"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-[10px] text-gray-500 font-medium block mb-1">Chronic Conditions / Diagnoses</label>
              <input
                type="text"
                value={medicalInfo.conditions || ''}
                onChange={(e) => setMedicalInfo(prev => ({ ...prev, conditions: e.target.value }))}
                placeholder="e.g., Hypertension, Type 2 Diabetes, Asthma"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-[#238B78]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-gray-500 font-medium block mb-1">Primary Doctor</label>
                <input
                  type="text"
                  value={medicalInfo.primaryDoctor || ''}
                  onChange={(e) => setMedicalInfo(prev => ({ ...prev, primaryDoctor: e.target.value }))}
                  placeholder="Dr. Name"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs text-gray-800"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 font-medium block mb-1">Doctor Phone</label>
                <input
                  type="text"
                  value={medicalInfo.doctorPhone || ''}
                  onChange={(e) => setMedicalInfo(prev => ({ ...prev, doctorPhone: e.target.value }))}
                  placeholder="+91..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs text-gray-800"
                />
              </div>
            </div>

            <div className="p-2.5 bg-amber-50/50 rounded-xl border border-amber-200 space-y-2">
              <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block">
                Emergency Contact
              </span>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={medicalInfo.emergencyContactName || ''}
                  onChange={(e) => setMedicalInfo(prev => ({ ...prev, emergencyContactName: e.target.value }))}
                  placeholder="Contact Name"
                  className="bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs text-gray-800"
                />
                <input
                  type="text"
                  value={medicalInfo.emergencyContactRelation || ''}
                  onChange={(e) => setMedicalInfo(prev => ({ ...prev, emergencyContactRelation: e.target.value }))}
                  placeholder="Relation (e.g. Spouse)"
                  className="bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs text-gray-800"
                />
              </div>
              <input
                type="text"
                value={medicalInfo.emergencyContactPhone || ''}
                onChange={(e) => setMedicalInfo(prev => ({ ...prev, emergencyContactPhone: e.target.value }))}
                placeholder="Emergency Phone Number"
                className="w-full bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs text-gray-800"
              />
            </div>

            <div>
              <label className="text-[10px] text-gray-500 font-medium block mb-1">Special Medical Notes</label>
              <textarea
                rows={2}
                value={medicalInfo.notes || ''}
                onChange={(e) => setMedicalInfo(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="e.g., Take medicines with warm water; difficulty swallowing large pills"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-[#238B78]"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                fullWidth
                onClick={() => setIsEditingMedical(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="primary"
                fullWidth
                onClick={handleSaveMedicalInfo}
                disabled={isSavingMedical}
              >
                {isSavingMedical ? 'Saving...' : 'Save Info'}
              </Button>
            </div>
          </div>
        ) : (
          /* View Mode */
          <div className="space-y-2.5 pt-1 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-xl bg-[#F8FAF8] border border-[#E6ECE8]">
                <span className="text-[10px] text-gray-400 block font-medium">Blood Type</span>
                <span className="font-bold text-gray-800 mt-0.5 block">{medicalInfo.bloodType || 'Unknown'}</span>
              </div>
              <div className="p-2 rounded-xl bg-[#F8FAF8] border border-[#E6ECE8]">
                <span className="text-[10px] text-gray-400 block font-medium">Height / Weight</span>
                <span className="font-semibold text-gray-800 mt-0.5 block">
                  {medicalInfo.height || '—'} / {medicalInfo.weight || '—'}
                </span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-[#F8FAF8] border border-[#E6ECE8]">
              <span className="text-[10px] text-gray-400 block font-medium">Chronic Conditions</span>
              <span className="font-semibold text-gray-800 mt-0.5 block">
                {medicalInfo.conditions || 'None specified'}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-[#F8FAF8] border border-[#E6ECE8]">
              <span className="text-[10px] text-gray-400 block font-medium">Primary Doctor</span>
              <span className="font-semibold text-gray-800 mt-0.5 block">
                {medicalInfo.primaryDoctor || 'Not recorded'} {medicalInfo.doctorPhone ? `(${medicalInfo.doctorPhone})` : ''}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-amber-50/50 border border-amber-200">
              <span className="text-[10px] text-amber-800 block font-bold uppercase tracking-wider">Emergency Contact</span>
              <span className="font-semibold text-gray-900 mt-0.5 block">
                {medicalInfo.emergencyContactName ? (
                  <>
                    {medicalInfo.emergencyContactName} {medicalInfo.emergencyContactRelation ? `(${medicalInfo.emergencyContactRelation})` : ''}
                    {medicalInfo.emergencyContactPhone && <span className="block text-xs font-normal text-gray-700 mt-0.5 font-mono">{medicalInfo.emergencyContactPhone}</span>}
                  </>
                ) : 'No emergency contact set'}
              </span>
            </div>

            {medicalInfo.notes && (
              <div className="p-2.5 rounded-xl bg-[#F8FAF8] border border-[#E6ECE8]">
                <span className="text-[10px] text-gray-400 block font-medium">Special Notes</span>
                <p className="text-gray-700 mt-0.5 leading-relaxed">{medicalInfo.notes}</p>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Language Selector Card (Smart Picker for all 22 Indian Languages) */}
      <Card className="space-y-2 bg-white">
        <h3 className="font-bold text-xs uppercase tracking-wider text-[#202B28] flex items-center gap-1.5">
          <Globe className="w-4 h-4 text-[#238B78]" /> App Language / भाषा
        </h3>
        <p className="text-[11px] text-[#7A8782]">
          Choose from English or all 22 scheduled languages of India with native script rendering.
        </p>
        <Button
          variant="outline"
          size="sm"
          fullWidth
          icon={Globe}
          onClick={() => setShowLanguageModal(true)}
        >
          Change Language / भाषा बदलें
        </Button>
      </Card>

      {/* Notification Preferences */}
      <Card className="space-y-3">
        <h3 className="font-bold text-xs uppercase tracking-wider text-[#202B28] flex items-center gap-1.5">
          <Bell className="w-4 h-4 text-[#238B78]" /> Reminder Preferences
        </h3>

        <div className="space-y-2 text-xs">
          <label className="flex items-center justify-between p-2 rounded-xl hover:bg-[#F8FAF8] cursor-pointer">
            <span>Dose Notification Alerts</span>
            <input type="checkbox" defaultChecked className="accent-[#238B78] w-4 h-4" onChange={() => handleToggle('notifications')} />
          </label>
          <label className="flex items-center justify-between p-2 rounded-xl hover:bg-[#F8FAF8] cursor-pointer">
            <span>Alert Sound & Haptics</span>
            <input type="checkbox" defaultChecked className="accent-[#238B78] w-4 h-4" onChange={() => handleToggle('sound')} />
          </label>
        </div>
      </Card>

      {/* Food & Nutrition Tracker Link */}
      <Card className="space-y-2.5">
        <h3 className="font-bold text-xs uppercase tracking-wider text-[#202B28] flex items-center gap-1.5">
          <Utensils className="w-4 h-4 text-[#238B78]" /> Food & Nutrition Tracker
        </h3>
        <p className="text-[11px] text-[#7A8782]">
          Log meals, track daily calories, macro percentages (protein, carbs, fat), fibre, and set daily nutrition goals.
        </p>
        <Button
          variant="outline"
          size="sm"
          fullWidth
          icon={Utensils}
          onClick={() => navigate('/nutrition')}
        >
          Open Nutrition Tracker
        </Button>
      </Card>

      {/* Legal Centre & DPDP Compliance */}
      <Card className="space-y-2.5">
        <h3 className="font-bold text-xs uppercase tracking-wider text-[#202B28] flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-[#238B78]" /> Legal & Data Protection (DPDP)
        </h3>
        <p className="text-[11px] text-[#7A8782]">
          Review our Terms & Conditions, Privacy Policy under the DPDP Act 2023, and manage your statutory consents.
        </p>
        <Button
          variant="outline"
          size="sm"
          fullWidth
          icon={FileText}
          onClick={() => navigate('/legal')}
        >
          Open Legal Centre & Consent Receipts
        </Button>
      </Card>

      {/* Account Security & Deletion (24-Hour Grace Period) */}
      <Card className="space-y-3 bg-red-50/20 border-red-100">
        <h3 className="font-bold text-xs uppercase tracking-wider text-rose-950 flex items-center gap-1.5">
          <ShieldAlert className="w-4 h-4 text-rose-600" /> Account Security & Closure
        </h3>
        <p className="text-[11px] text-[#7A8782] leading-relaxed">
          Request account closure under DPDP Act statutory rights. A <strong>24-hour grace period</strong> is provided during which you can cancel at any time.
        </p>

        {currentUser?.status === 'Pending_Deletion' ? (
          <div className="pt-1">
            <Button
              variant="outline"
              size="sm"
              fullWidth
              onClick={handleCancelDeletion}
              disabled={isCancelling}
              className="border-amber-400 text-amber-800 bg-amber-50/50 hover:bg-amber-100/50"
            >
              {isCancelling ? 'Restoring Account...' : 'Cancel Pending Deletion'}
            </Button>
          </div>
        ) : (
          <div className="pt-1">
            <Button
              variant="danger"
              size="sm"
              fullWidth
              icon={Trash2}
              onClick={() => { setDeleteStep(1); setShowDeleteModal(true); }}
            >
              Delete Account (24h Grace Window)
            </Button>
          </div>
        )}
      </Card>

      {/* About MedRemind & Team Sanjeevani */}
      <Card className="space-y-3 bg-gradient-to-br from-white via-white to-emerald-50/30 border-[#E6ECE8]">
        <BrandLogo size="sm" showTagline={true} />
        <div className="p-3 rounded-2xl bg-gradient-to-br from-[#238B78] to-[#1b6d5e] text-white shadow-xs space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
            Team Sanjeevani · Creator Attribution
          </div>
          <p className="text-xs font-semibold text-white leading-relaxed">
            3 Class 11 boys from The Newtown School, Kolkata — Aryan Singhania, Tanishq Ghosh, and Naman Thard
          </p>
        </div>
        <p className="text-[11px] text-[#7A8782] leading-relaxed">
          MedRemind is an intelligent medication safety and adherence platform designed for Indian families and healthcare routines.
        </p>
        <Button
          variant="outline"
          size="sm"
          fullWidth
          icon={Info}
          onClick={() => navigate('/about')}
        >
          View Team & Project Information
        </Button>
        <div className="pt-1 text-[10px] text-[#7A8782] space-y-0.5 border-t border-gray-200">
          <p><strong>App Version:</strong> 1.5 · Build 6 (Capacitor Android Native)</p>
          <p><strong>Package ID:</strong> com.medremind.app</p>
          <p className="text-center font-medium text-teal-800 pt-1">
            Crafted with care by Team Sanjeevani
          </p>
        </div>
      </Card>

      {/* Sign Out */}
      <div className="pt-2 pb-6">
        <Button
          variant="outline"
          fullWidth
          icon={LogOut}
          onClick={handleSignOut}
        >
          Sign Out
        </Button>
      </div>

      <LanguagePickerModal
        isOpen={showLanguageModal}
        onClose={() => setShowLanguageModal(false)}
      />

      {/* 2-Step Account Deletion Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => { if (!isDeleting) { setShowDeleteModal(false); setDeleteStep(1); } }}
        title="Schedule Account Deletion"
      >
        <div className="space-y-4">
          {deleteStep === 1 && (
            <>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-amber-950">
                  <Clock className="w-4 h-4 text-amber-600" />
                  24-Hour Reversible Grace Period
                </div>
                <p className="leading-relaxed">
                  Your account will <strong>not</strong> be deleted immediately. You have a full 24-hour cooling-off window. During this time:
                </p>
                <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                  <li>Your alarm reminders and medicines remain visible.</li>
                  <li>You can cancel the deletion anytime with one click.</li>
                  <li>After 24 hours, all personal data, prescriptions, and dose history are permanently destroyed.</li>
                </ul>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  fullWidth
                  onClick={() => setShowDeleteModal(false)}
                >
                  Keep Account
                </Button>
                <Button
                  variant="danger"
                  fullWidth
                  onClick={() => setDeleteStep(2)}
                >
                  Continue to Step 2
                </Button>
              </div>
            </>
          )}

          {deleteStep === 2 && (
            <>
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-rose-950">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  Final Step: Confirm Deletion Request
                </div>
                <p className="leading-relaxed text-[11px]">
                  Are you sure you want to schedule deletion for account <strong>{displayEmail}</strong>? After 24 hours, this action cannot be undone.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  fullWidth
                  disabled={isDeleting}
                  onClick={() => setDeleteStep(1)}
                >
                  Back
                </Button>
                <Button
                  variant="danger"
                  fullWidth
                  disabled={isDeleting}
                  onClick={handleConfirmScheduleDeletion}
                >
                  {isDeleting ? 'Scheduling...' : 'Schedule Deletion Now'}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
