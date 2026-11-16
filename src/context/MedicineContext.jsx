import React, { createContext, useContext, useState, useEffect } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { format } from 'date-fns';
import { 
  scheduleMedicationDoseNotification,
  cancelMedicationNotifications,
  cancelAllMedicationNotifications, 
  snoozeNotification, 
  parseArbitraryTime,
  setNotificationActionHandler
} from '../services/notificationService';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';

const MedicineContext = createContext(null);

export function MedicineProvider({ children }) {
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const { currentUser } = useAuth();
  const storageScope = currentUser?.id || null;
  const [loadedStorageScope, setLoadedStorageScope] = useState(null);

  const [medicines, setMedicines] = useState([]);
  const [doseLogs, setDoseLogs] = useState({});
  const [patientProfile, setPatientProfile] = useState({
    bloodType: 'Not specified',
    allergies: [],
    emergencyContact: null,
    settings: {
      soundEnabled: true,
      doseReminders: true,
      quietHoursStart: '23:00',
      quietHoursEnd: '07:00'
    }
  });
  const [notifications, setNotifications] = useState([]);

  // Load each patient's local health data from a separate namespace.
  // Legacy global keys are deliberately not migrated because they have no
  // trustworthy owner and could expose one account's data to another.
  useEffect(() => {
    setLoadedStorageScope(null);
    if (!storageScope) {
      setMedicines([]);
      setDoseLogs({});
      setPatientProfile({
        bloodType: 'Not specified',
        allergies: [],
        emergencyContact: null,
        settings: {
          soundEnabled: true,
          doseReminders: true,
          quietHoursStart: '23:00',
          quietHoursEnd: '07:00'
        }
      });
      setNotifications([]);
      setLoadedStorageScope(null);
      return;
    }

    const readScoped = (key, fallback) => {
      try {
        const value = localStorage.getItem(`${key}:${storageScope}`);
        return value ? JSON.parse(value) : fallback;
      } catch {
        return fallback;
      }
    };

    const savedMedicines = readScoped('medremind_medicines', []);
    setMedicines(Array.isArray(savedMedicines)
      ? savedMedicines.filter(m => m.userId !== 'USR-e87f3b14-9a2c-4d5e-88f1-209471ab5e82' || !['med-1', 'med-2', 'med-3', 'med-4'].includes(m.id))
      : []);
    const savedDoseLogs = readScoped('medremind_dose_logs', {});
    setDoseLogs(savedDoseLogs && typeof savedDoseLogs === 'object' ? savedDoseLogs : {});
    const savedProfile = readScoped('medremind_patient_profile', null);
    setPatientProfile(savedProfile && savedProfile.name !== 'Alex Morgan'
      ? savedProfile
      : {
          bloodType: 'Not specified',
          allergies: [],
          emergencyContact: null,
          settings: {
            soundEnabled: true,
            doseReminders: true,
            quietHoursStart: '23:00',
            quietHoursEnd: '07:00'
          }
        });
    const savedNotifications = readScoped('medremind_notifications', []);
    setNotifications(Array.isArray(savedNotifications)
      ? savedNotifications.filter(n => !['notif-1', 'notif-2'].includes(n.id))
      : []);
    setLoadedStorageScope(storageScope);
  }, [storageScope]);

  // Clear in-memory health data and pending alarms on explicit sign-out or invalid session.
  useEffect(() => {
    const handleSessionInvalidated = () => {
      setMedicines([]);
      setDoseLogs({});
      setPatientProfile({
        bloodType: 'Not specified',
        allergies: [],
        emergencyContact: null,
        settings: {
          soundEnabled: true,
          doseReminders: true,
          quietHoursStart: '23:00',
          quietHoursEnd: '07:00'
        }
      });
      setNotifications([]);
      cancelAllMedicationNotifications();
    };
    window.addEventListener('medremind:session-invalidated', handleSessionInvalidated);
    return () => window.removeEventListener('medremind:session-invalidated', handleSessionInvalidated);
  }, []);

  // Persist only after the current account's namespace has finished loading.
  useEffect(() => {
    if (!storageScope || loadedStorageScope !== storageScope) return;
    localStorage.setItem(`medremind_medicines:${storageScope}`, JSON.stringify(medicines));
  }, [medicines, storageScope, loadedStorageScope]);

  useEffect(() => {
    if (!storageScope || loadedStorageScope !== storageScope) return;
    localStorage.setItem(`medremind_dose_logs:${storageScope}`, JSON.stringify(doseLogs));
  }, [doseLogs, storageScope, loadedStorageScope]);

  useEffect(() => {
    if (!storageScope || loadedStorageScope !== storageScope) return;
    localStorage.setItem(`medremind_patient_profile:${storageScope}`, JSON.stringify(patientProfile));
  }, [patientProfile, storageScope, loadedStorageScope]);

  useEffect(() => {
    if (!storageScope || loadedStorageScope !== storageScope) return;
    localStorage.setItem(`medremind_notifications:${storageScope}`, JSON.stringify(notifications));
  }, [notifications, storageScope, loadedStorageScope]);

  // Dose Tracking Actions with Future Dose Safeguard
  const recordDose = (medId, timeSlot, status, scheduledTime = null) => {
    // Strictly block recording future doses
    const now = new Date();
    const timeStr = scheduledTime || timeSlot;
    if (timeStr) {
      const { hours, minutes } = parseArbitraryTime(timeStr);
      const scheduledDateTime = new Date();
      scheduledDateTime.setHours(hours, minutes, 0, 0);

      // Grace margin of 60 seconds
      if (scheduledDateTime.getTime() - now.getTime() > 60000) {
        toast.error('Dose cannot be recorded before its scheduled time.');
        return false;
      }
    }

    const timestamp = format(new Date(), 'hh:mm a');
    setDoseLogs(prev => {
      const dayLogs = prev[todayKey] || {};
      return {
        ...prev,
        [todayKey]: {
          ...dayLogs,
          [`${medId}_${timeSlot}`]: { status, timestamp }
        }
      };
    });

    // If dose skipped, record notification
    if (status === 'skipped') {
      const med = medicines.find(m => m.id === medId);
      addNotification({
        title: `Dose Skipped: ${med ? med.name : 'Medication'}`,
        message: `${patientProfile.name} recorded the ${timeSlot} dose as skipped.`,
        type: "warning"
      });
    }
    return true;
  };

  const resetDose = (medId, timeSlot) => {
    setDoseLogs(prev => {
      const dayLogs = { ...(prev[todayKey] || {}) };
      delete dayLogs[`${medId}_${timeSlot}`];
      return {
        ...prev,
        [todayKey]: dayLogs
      };
    });
  };

  const getDoseStatus = (medId, timeSlot, dateStr = todayKey) => {
    const day = doseLogs[dateStr];
    if (!day) return null;
    return day[`${medId}_${timeSlot}`] || null;
  };

  // Medicine Management (Active/Inactive Toggle & History Preservation)
  const toggleMedicineActive = (id) => {
    setMedicines(prev => prev.map(m => {
      if (m.id === id) {
        const nextStatus = m.status === 'Inactive' ? 'Active' : 'Inactive';
        if (nextStatus === 'Inactive') {
          cancelMedicationNotifications(m.id);
          addNotification({
            title: `Medication Inactive: ${m.name}`,
            message: `${m.name} has been paused. Pending alarms have been cancelled. History is preserved.`,
            type: "info"
          });
        } else {
          // Reactivate alarms for all time slots
          const slots = m.times && m.times.length > 0 ? m.times : (m.timeSlots || ['08:00 AM']);
          slots.forEach(t => scheduleMedicationDoseNotification({ ...m, status: 'Active' }, t, m.id));
          addNotification({
            title: `Medication Reactivated: ${m.name}`,
            message: `${m.name} is active. Daily reminders have been rescheduled.`,
            type: "info"
          });
        }
        return { ...m, status: nextStatus };
      }
      return m;
    }));
  };

  const snoozeReminder = async (medId, timeSlot, minutes = 10) => {
    const med = medicines.find(m => m.id === medId);
    if (!med || med.status === 'Inactive') return;
    await snoozeNotification(med, timeSlot, minutes);
    toast.info(`Reminder for ${med.name} snoozed for ${minutes} minutes.`);
  };

  const updatePatientProfile = (updates) => {
    setPatientProfile(prev => {
      const updated = { ...prev, ...updates };
      try {
        if (storageScope && loadedStorageScope === storageScope) {
          localStorage.setItem(`medremind_patient_profile:${storageScope}`, JSON.stringify(updated));
        }
      } catch (e) {
        console.warn('LocalStorage save failed:', e);
      }
      return updated;
    });
  };

  const addMedicine = (medData) => {
    const newMed = {
      ...medData,
      id: `med-${Date.now()}`,
      status: "Active"
    };
    setMedicines(prev => [newMed, ...prev]);
    addNotification({
      title: "New Medicine Added",
      message: `${newMed.name} ${newMed.dosage} is now active on your schedule.`,
      type: "info"
    });
    // Schedule native reminders for arbitrary time slots
    const slots = newMed.times && newMed.times.length > 0 ? newMed.times : (newMed.timeSlots || ['08:00 AM']);
    slots.forEach(t => scheduleMedicationDoseNotification(newMed, t, newMed.id));
    return newMed;
  };

  const updateMedicine = (id, updatedData) => {
    setMedicines(prev => prev.map(m => {
      if (m.id === id) {
        const updated = { ...m, ...updatedData };
        if (updated.status === 'Active') {
          cancelMedicationNotifications(m.id);
          const slots = updated.times && updated.times.length > 0 ? updated.times : (updated.timeSlots || ['08:00 AM']);
          slots.forEach(t => scheduleMedicationDoseNotification(updated, t, updated.id));
        }
        return updated;
      }
      return m;
    }));
  };

  const deleteMedicine = (id) => {
    cancelMedicationNotifications(id);
    setMedicines(prev => prev.filter(m => m.id !== id));
  };

  // Prescription Approval Action with Intelligent Duplicate Prevention
  const approvePrescription = (extracted) => {
    const brand = (extracted.brandName || extracted.medicineName || '').trim();
    const generic = (extracted.genericIngredient || extracted.medicineName || '').trim();
    const strength = (extracted.strength || extracted.dosage || '').toLowerCase().replace(/\s+/g, '');

    // Check if duplicate of an existing active medicine in local state
    const existingIdx = medicines.findIndex(m => {
      const mBrand = (m.brandName || m.name || '').toLowerCase().trim();
      const mGeneric = (m.genericIngredient || m.name || '').toLowerCase().trim();
      const mStrength = (m.strength || m.dosage || '').toLowerCase().replace(/\s+/g, '');

      const isSameMed = (
        brand.toLowerCase() === mBrand ||
        brand.toLowerCase() === mGeneric ||
        generic.toLowerCase() === mBrand ||
        generic.toLowerCase() === mGeneric
      );

      return isSameMed && (!strength || !mStrength || strength === mStrength || mStrength.includes(strength));
    });

    if (existingIdx !== -1) {
      // Update existing routine instead of creating redundant duplicate!
      const existingMed = medicines[existingIdx];
      const updatedMed = {
        ...existingMed,
        instructions: extracted.instructions || existingMed.instructions,
        frequency: extracted.frequency || existingMed.frequency,
        timeSlots: extracted.timeSlots && extracted.timeSlots.length > 0 ? extracted.timeSlots : existingMed.timeSlots,
        times: extracted.times && extracted.times.length > 0 ? extracted.times : existingMed.times,
        morningDose: extracted.morningDose !== undefined ? extracted.morningDose : existingMed.morningDose,
        afternoonDose: extracted.afternoonDose !== undefined ? extracted.afternoonDose : existingMed.afternoonDose,
        nightDose: extracted.nightDose !== undefined ? extracted.nightDose : existingMed.nightDose,
        lastUpdated: format(new Date(), 'yyyy-MM-dd HH:mm')
      };

      setMedicines(prev => prev.map((m, i) => i === existingIdx ? updatedMed : m));
      addNotification({
        title: "Medication Routine Updated",
        message: `Existing routine for ${updatedMed.name} was updated without creating a duplicate.`,
        type: "info"
      });

      // Reschedule reminders
      if (updatedMed.times && Array.isArray(updatedMed.times)) {
        updatedMed.times.forEach(t => scheduleMedicationDoseNotification(updatedMed, t, updatedMed.id));
      }
      return updatedMed;
    }

    // New medication
    const approvedMed = {
      id: `med-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: brand,
      brandName: brand,
      genericIngredient: generic,
      dosage: extracted.dosage || '1 Tablet',
      strength: extracted.strength || 'As Prescribed',
      form: extracted.form || "Tablet",
      frequency: extracted.frequency,
      morningDose: extracted.morningDose,
      afternoonDose: extracted.afternoonDose,
      nightDose: extracted.nightDose,
      timeSlots: extracted.timeSlots && extracted.timeSlots.length > 0 ? extracted.timeSlots : ["Morning (8:00 AM)"],
      times: extracted.times && extracted.times.length > 0 ? extracted.times : ["08:00"],
      status: "Active",
      instructions: extracted.instructions || "Take as directed by doctor.",
      prescribedBy: extracted.doctor || "Verified from Prescription Scan",
      startDate: format(new Date(), 'yyyy-MM-dd'),
      duration: extracted.duration || "7 days",
      refillsRemaining: extracted.refills || 0,
      pillCount: 30,
      color: "#238B78"
    };

    setMedicines(prev => [approvedMed, ...prev]);
    addNotification({
      title: "Prescription Approved & Scheduled",
      message: `${approvedMed.name} (${approvedMed.genericIngredient}) has been verified and added to your daily schedule.`,
      type: "success"
    });
    // Schedule native reminders for approved prescription
    if (approvedMed.times && Array.isArray(approvedMed.times)) {
      approvedMed.times.forEach(t => scheduleMedicationDoseNotification(approvedMed, t, approvedMed.id));
    }
    return approvedMed;
  };

  const addNotification = (notif) => {
    const newNotif = {
      id: `notif-${Date.now()}`,
      time: format(new Date(), 'hh:mm a'),
      read: false,
      ...notif
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const markNotificationRead = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  // Notification actions update the same local dose ledger used by the Schedule screen.
  useEffect(() => {
    if (!storageScope || loadedStorageScope !== storageScope) {
      setNotificationActionHandler(null);
      return () => setNotificationActionHandler(null);
    }
    setNotificationActionHandler(async (action) => {
      const extra = action.notification?.extra || {};
      const med = medicines.find(item => item.id === extra.medicineId);
      if (!med || med.status === 'Inactive') return;

      const timeSlot = extra.timeSlot || med.timeSlots?.[0] || extra.scheduledTime || 'Dose';
      if (action.actionId === 'SNOOZE_10') {
        await snoozeNotification(med, timeSlot, 10, extra.occurrenceDate || todayKey);
        return;
      }
      if (action.actionId !== 'TAKE' && action.actionId !== 'SKIP') return;

      const scheduledTime = extra.scheduledTime || timeSlot;
      const occurrenceDate = /^\d{4}-\d{2}-\d{2}$/.test(extra.occurrenceDate || '')
        ? extra.occurrenceDate
        : todayKey;
      const { hours, minutes } = parseArbitraryTime(scheduledTime);
      const dueAt = new Date(occurrenceDate + 'T00:00:00');
      dueAt.setHours(hours, minutes, 0, 0);
      if (Number.isNaN(dueAt.getTime()) || dueAt.getTime() - Date.now() > 60000) return;

      const status = action.actionId === 'TAKE' ? 'taken' : 'skipped';
      const timestamp = format(new Date(), 'hh:mm a');
      setDoseLogs(prev => ({
        ...prev,
        [occurrenceDate]: {
          ...(prev[occurrenceDate] || {}),
          [`${med.id}_${timeSlot}`]: { status, timestamp }
        }
      }));

      const notif = {
        id: `notif-${Date.now()}`,
        time: timestamp,
        read: false,
        title: status === 'taken' ? `Dose Taken: ${med.name}` : `Dose Skipped: ${med.name}`,
        message: `${med.name} was marked as ${status} from its reminder notification.`,
        type: status === 'taken' ? 'success' : 'warning'
      };
      setNotifications(prev => [notif, ...prev]);
    });

    return () => setNotificationActionHandler(null);
  }, [medicines, todayKey, storageScope, loadedStorageScope]);

  // Rebuild a rolling queue on app launch and whenever the app returns to foreground.
  useEffect(() => {
    let disposed = false;
    let refreshing = false;
    let appStateListener = null;

    const refreshAlarmQueue = async () => {
      if (disposed || refreshing || !Capacitor.isNativePlatform()) return;
      refreshing = true;
      try {
        if (!storageScope) {
          if (!localStorage.getItem('medremind_auth_token')) {
            await cancelAllMedicationNotifications();
          }
          return;
        }
        if (loadedStorageScope !== storageScope) {
          if (loadedStorageScope) {
            for (const med of medicines) {
              await cancelMedicationNotifications(med.id);
            }
          }
          return;
        }
        for (const med of medicines) {
          await cancelMedicationNotifications(med.id, { includeSnoozes: false });
        }
        for (const med of medicines.filter(item => item.status === 'Active')) {
          const slots = med.times?.length ? med.times : (med.timeSlots || ['08:00 AM']);
          for (const time of slots) {
            if (disposed) return;
            await scheduleMedicationDoseNotification(med, time, med.id);
          }
        }
      } catch (error) {
        console.error('[Alarm Service] Failed to refresh reminder queue:', error);
      } finally {
        refreshing = false;
      }
    };

    refreshAlarmQueue();
    if (Capacitor.isNativePlatform()) {
      App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) refreshAlarmQueue();
      }).then(listener => {
        if (disposed) listener.remove();
        else appStateListener = listener;
      }).catch(error => console.warn('[Alarm Service] App-state listener failed:', error));
    }

    return () => {
      disposed = true;
      appStateListener?.remove();
    };
  }, [medicines, storageScope, loadedStorageScope]);

  // Metrics computation for dashboard
  const getTodayMetrics = () => {
    let totalDoses = 0;
    let takenDoses = 0;
    let skippedDoses = 0;

    medicines.filter(m => m.status === 'Active').forEach(med => {
      (med.timeSlots || []).forEach(slot => {
        totalDoses += 1;
        const status = getDoseStatus(med.id, slot);
        if (status?.status === 'taken') takenDoses += 1;
        if (status?.status === 'skipped') skippedDoses += 1;
      });
    });

    const pendingDoses = Math.max(0, totalDoses - takenDoses - skippedDoses);
    // When no doses are scheduled today, adherence is null (never fake 100%)
    const adherencePercent = totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : null;

    return {
      totalDoses,
      takenDoses,
      skippedDoses,
      pendingDoses,
      adherencePercent
    };
  };

  /**
   * ITEM 8 Helper: getWeeklyCompliance(weekStartDate)
   * Calculates per-day compliance for a 7-day period starting on weekStartDate.
   * Categorizes scheduled doses into:
   * - taken: dose recorded as 'taken'
   * - skipped: dose recorded as 'skipped'
   * - missed: dose whose scheduled time has passed with no status (not future)
   */
  const getWeeklyCompliance = (weekStartDate) => {
    const startDate = weekStartDate instanceof Date ? weekStartDate : new Date(weekStartDate);
    const days = [];
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');

    let weekTaken = 0;
    let weekSkipped = 0;
    let weekMissed = 0;
    let weekScheduled = 0;

    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const dateStr = format(d, 'yyyy-MM-dd');
      const isFutureDay = dateStr > todayStr;
      const isToday = dateStr === todayStr;

      let dayTotal = 0;
      let dayTaken = 0;
      let daySkipped = 0;
      let dayMissed = 0;

      medicines.filter(m => m.status === 'Active').forEach(med => {
        (med.timeSlots || []).forEach(slot => {
          dayTotal += 1;
          const status = getDoseStatus(med.id, slot, dateStr);

          if (status?.status === 'taken') {
            dayTaken += 1;
          } else if (status?.status === 'skipped') {
            daySkipped += 1;
          } else if (!isFutureDay) {
            // Day is today or in the past
            if (isToday) {
              const { hours, minutes } = parseArbitraryTime(slot);
              const schedTime = new Date();
              schedTime.setHours(hours, minutes, 0, 0);
              if (now.getTime() >= schedTime.getTime()) {
                dayMissed += 1;
              }
            } else {
              // Past day with no record is missed
              dayMissed += 1;
            }
          }
        });
      });

      const dayAdherence = (dayTaken + daySkipped + dayMissed) > 0
        ? Math.round((dayTaken / (dayTaken + daySkipped + dayMissed)) * 100)
        : null;

      days.push({
        date: dateStr,
        dayLabel: format(d, 'EEE'),
        dayNumber: format(d, 'd'),
        total: dayTotal,
        taken: dayTaken,
        skipped: daySkipped,
        missed: dayMissed,
        adherencePercent: dayAdherence
      });

      weekTaken += dayTaken;
      weekSkipped += daySkipped;
      weekMissed += dayMissed;
      weekScheduled += (dayTaken + daySkipped + dayMissed);
    }

    const overallAdherence = weekScheduled > 0
      ? Math.round((weekTaken / weekScheduled) * 100)
      : null;

    return {
      days,
      weekTaken,
      weekSkipped,
      weekMissed,
      weekScheduled,
      overallAdherence
    };
  };

  return (
    <MedicineContext.Provider value={{
      medicines,
      doseLogs,
      patientProfile,
      updatePatientProfile,
      notifications,
      recordDose,
      resetDose,
      getDoseStatus,
      addMedicine,
      updateMedicine,
      deleteMedicine,
      toggleMedicineActive,
      snoozeReminder,
      approvePrescription,
      addNotification,
      markNotificationRead,
      getTodayMetrics,
      getWeeklyCompliance
    }}>
      {children}
    </MedicineContext.Provider>
  );
}

export function useMedicine() {
  const context = useContext(MedicineContext);
  if (!context) {
    throw new Error('useMedicine must be used within a MedicineProvider');
  }
  return context;
}
