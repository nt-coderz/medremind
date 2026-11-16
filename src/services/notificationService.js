import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

/**
 * Hash string to positive integer ID (max 32-bit positive integer for Android Notification IDs)
 */
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 2147483647;
}

/**
 * Parse arbitrary time format into 24-hour { hours, minutes }
 * Handles "07:05 AM", "1:35 PM", "11:45 PM", "14:30", "Morning (8:00 AM)", etc.
 */
export function parseArbitraryTime(timeStr) {
  if (!timeStr) return { hours: 8, minutes: 0 };
  const clean = timeStr.trim();

  // Pattern: 1-2 digits : 2 digits optional AM/PM
  const match = clean.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const ampm = match[3] ? match[3].toUpperCase() : null;
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    return { hours: Math.min(23, Math.max(0, hours)), minutes: Math.min(59, Math.max(0, minutes)) };
  }

  // Fallbacks for named periods
  const lower = clean.toLowerCase();
  if (lower.includes('morning')) return { hours: 8, minutes: 0 };
  if (lower.includes('afternoon') || lower.includes('lunch')) return { hours: 13, minutes: 0 };
  if (lower.includes('evening')) return { hours: 18, minutes: 0 };
  if (lower.includes('night') || lower.includes('bedtime')) return { hours: 22, minutes: 0 };

  return { hours: 8, minutes: 0 };
}

/**
 * Initialize Android High-Importance Notification Channel with Custom Alarm Sound & Vibration
 */
let channelsInitialized = false;
let notificationActionHandler = null;

export function setNotificationActionHandler(handler) {
  notificationActionHandler = typeof handler === 'function' ? handler : null;
}

export async function initNotificationChannels() {
  if (channelsInitialized) return true;
  if (!Capacitor.isNativePlatform()) return true;

  if (Capacitor.isNativePlatform()) {
    try {
      // Create a private high-importance channel using the system default sound.
      await LocalNotifications.createChannel({
        id: 'medremind_alarms_private',
        name: 'Medication Reminders & Alarms',
        description: 'Medication dose reminders with system sound and vibration',
        importance: 5, // IMPORTANCE_HIGH (heads-up priority; system Do Not Disturb still applies)
        vibration: true,
        visibility: 0, // VISIBILITY_PRIVATE (hide medication details on the lock screen)
        lights: true,
        lightColor: '#238B78'
      });

      // Register Notification Action Buttons (Take, Snooze, Skip)
      await LocalNotifications.registerActionTypes({
        types: [
          {
            id: 'MED_REMINDER_ACTIONS',
            actions: [
              { id: 'TAKE', title: 'Take Now', foreground: true },
              { id: 'SNOOZE_10', title: 'Snooze (10m)', foreground: true },
              { id: 'SKIP', title: 'Skip Dose', destructive: true, foreground: true }
            ]
          }
        ]
      });

      // Register listener for action button interactions
      await LocalNotifications.addListener('localNotificationActionPerformed', async (action) => {
        console.log('[Notification Action Received]', action.actionId);
        try {
          await notificationActionHandler?.(action);
        } catch (error) {
          console.error('[Notifications] Action handler failed:', error);
        }
      });

      channelsInitialized = true;
      console.log('[Notifications] medremind_alarms_private channel and actions initialized successfully.');
      return true;
    } catch (e) {
      console.error('[Notifications] Channel initialization failed:', e);
      return false;
    }
  }
  return true;
}

/**
 * Request notification permissions across Android and Web
 */
export async function requestNotificationPermission() {
  if (Capacitor.isNativePlatform()) {
    try {
      const current = await LocalNotifications.checkPermissions();
      if (current.display === 'granted') return true;
      const status = await LocalNotifications.requestPermissions();
      return status.display === 'granted';
    } catch (e) {
      console.warn('Native notification permission error:', e);
      return false;
    }
  } else if ('Notification' in window) {
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  }
  return true;
}

/**
 * Schedule a rolling 14-day queue of one-shot reminders for a medication time.
 * One-shot alarms can be exact on Android; repeating alarms are inexact on Android.
 * The queue is refreshed when the app starts or returns to the foreground.
 */
const SCHEDULE_HORIZON_DAYS = 14;

export async function getAlarmPermissionStatus() {
  if (!Capacitor.isNativePlatform()) {
    return { display: 'unsupported', exactAlarm: 'unsupported' };
  }
  try {
    const permission = await LocalNotifications.checkPermissions();
    let exactAlarm = 'unsupported';
    if (Capacitor.getPlatform() === 'android') {
      const exact = await LocalNotifications.checkExactNotificationSetting();
      exactAlarm = exact.exact_alarm;
    }
    return { display: permission.display, exactAlarm };
  } catch (error) {
    console.warn('[Notifications] Could not read alarm permission status:', error);
    return { display: 'unknown', exactAlarm: 'unknown' };
  }
}

export async function openExactAlarmSettings() {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return { exact_alarm: 'unsupported' };
  }
  return LocalNotifications.changeExactNotificationSetting();
}

export async function scheduleMedicationDoseNotification(medicine, timeStr, scheduleId) {
  if (!medicine || medicine.status === 'Inactive') return { success: false, reason: 'inactive' };
  if (!Capacitor.isNativePlatform()) return { success: true, native: false };

  const channelReady = await initNotificationChannels();
  if (!channelReady) return { success: false, reason: 'channel_initialization_failed' };

  const hasPerm = await requestNotificationPermission();
  if (!hasPerm) return { success: false, reason: 'notification_permission_denied' };

  const { hours, minutes } = parseArbitraryTime(timeStr);
  const now = new Date();
  const matchingSlot = (medicine.timeSlots || []).find(slot => {
    const parsed = parseArbitraryTime(slot);
    return parsed.hours === hours && parsed.minutes === minutes;
  }) || timeStr;
  const permissionStatus = await getAlarmPermissionStatus();
  const useExactAlarm = Capacitor.getPlatform() !== 'android' || permissionStatus.exactAlarm === 'granted';
  const notifications = [];

  for (let dayOffset = 0; dayOffset < SCHEDULE_HORIZON_DAYS; dayOffset++) {
    const scheduledDate = new Date();
    scheduledDate.setDate(now.getDate() + dayOffset);
    scheduledDate.setHours(hours, minutes, 0, 0);
    if (scheduledDate.getTime() <= now.getTime()) continue;

    const dateKey = [
      scheduledDate.getFullYear(),
      String(scheduledDate.getMonth() + 1).padStart(2, '0'),
      String(scheduledDate.getDate()).padStart(2, '0')
    ].join('-');
    const notifId = hashCode(`${medicine.id || medicine.name}_${timeStr}_${dateKey}`);
    notifications.push({
      id: notifId,
      title: `Medication Reminder: ${medicine.name}`,
      body: `Scheduled for ${timeStr} • ${medicine.dosage || '1 dose'}${medicine.instructions ? ` • ${medicine.instructions}` : ''}`,
      schedule: {
        at: scheduledDate,
        allowWhileIdle: true
      },
      isExactNotification: useExactAlarm,
      channelId: 'medremind_alarms_private',
      actionTypeId: 'MED_REMINDER_ACTIONS',
      extra: {
        medicineId: medicine.id,
        medicineName: medicine.name,
        medicine,
        timeSlot: matchingSlot,
        scheduledTime: timeStr,
        scheduleId: scheduleId || notifId,
        occurrenceDate: dateKey
      }
    });
  }

  if (notifications.length === 0) return { success: true, scheduled: 0 };

  try {
    const result = await LocalNotifications.schedule({ notifications });
    const permissionStatus = await getAlarmPermissionStatus();
    return {
      success: true,
      scheduled: notifications.length,
      exactAlarm: permissionStatus.exactAlarm,
      usedExactAlarm: useExactAlarm,
      warning: result.warning || null
    };
  } catch (error) {
    console.error('[Alarm Service] Failed to schedule medication reminders:', error);
    return { success: false, reason: error.message || 'schedule_failed' };
  }
}

/**
 * Snooze a reminder by 5, 10, or 15 minutes
 * Cancels existing snooze duplicate before rescheduling
 */
export async function snoozeNotification(medicine, timeSlot, minutes = 10, occurrenceDate = null) {
  if (!medicine || medicine.status === 'Inactive') {
    return;
  }

  await initNotificationChannels();

  const snoozeId = hashCode(`snooze_${medicine.id || medicine.name}_${timeSlot}`);
  const snoozeDate = new Date(Date.now() + minutes * 60 * 1000);

  if (Capacitor.isNativePlatform()) {
    try {
      // Cancel previous snooze for this medicine/slot to prevent duplicates
      await LocalNotifications.cancel({ notifications: [{ id: snoozeId }] }).catch(() => {});

      await LocalNotifications.schedule({
        notifications: [
          {
            id: snoozeId,
            title: `Snoozed Reminder: ${medicine.name}`,
            body: `Snoozed for ${minutes}m • ${medicine.dosage || '1 dose'} is due now.`,
            schedule: { 
              at: snoozeDate,
              allowWhileIdle: true
            },
            channelId: 'medremind_alarms_private',
            actionTypeId: 'MED_REMINDER_ACTIONS',
            extra: {
              medicineId: medicine.id,
              medicine,
              timeSlot,
              isSnooze: true,
              occurrenceDate: occurrenceDate || [snoozeDate.getFullYear(), String(snoozeDate.getMonth() + 1).padStart(2, '0'), String(snoozeDate.getDate()).padStart(2, '0')].join('-')
            }
          }
        ]
      });
      console.log(`[Alarm Service] Snoozed medication reminder to ${snoozeDate.toLocaleTimeString()}`);
    } catch (e) {
      console.error('Error scheduling snooze notification:', e);
    }
  }
}

/**
 * Cancel all scheduled notifications for a specific medicine (used when deactivated or deleted)
 */
export async function cancelMedicationNotifications(medicineId, { includeSnoozes = true } = {}) {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const pending = await LocalNotifications.getPending();
    if (pending && pending.notifications) {
      const toCancel = pending.notifications.filter(n => {
        return n.extra?.medicineId === medicineId && (includeSnoozes || !n.extra?.isSnooze);
      });

      if (toCancel.length > 0) {
        await LocalNotifications.cancel({
          notifications: toCancel.map(n => ({ id: n.id }))
        });
        console.log(`[Alarm Service] Cancelled ${toCancel.length} notification(s) for medicine ${medicineId}`);
      }
    }
  } catch (err) {
    console.warn('Error cancelling medication notifications:', err);
  }
}

export async function cancelAllMedicationNotifications() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.cancelAll();
  } catch (error) {
    console.warn('[Notifications] Could not clear pending notifications:', error);
  }
}

/**
 * Send an immediate test or urgent alert notification
 */
export async function sendImmediateNotification(title, body) {
  await initNotificationChannels();

  if (Capacitor.isNativePlatform()) {
    try {
      const hasPerm = await requestNotificationPermission();
      if (!hasPerm) return;

      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.floor(Math.random() * 900000) + 100000,
            title,
            body,
            schedule: { at: new Date(Date.now() + 500) },
            channelId: 'medremind_alarms_private',
          }
        ]
      });
    } catch (e) {
      console.warn('Native immediate notification error:', e);
    }
  } else if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}
