/**
 * notifications.js — Browser Notifications for task reminders.
 *
 * HONEST LIMITATION (read this before relying on it):
 * The Notifications API can only fire while this app is open in a tab
 * (or, on some desktop browsers, briefly after). There is no background
 * push here — that requires a server + the Push API + a paid/hosted
 * push service, which is out of scope for a backend-free v1. Reminders
 * scheduled here use `setTimeout`, so they only fire if the browser tab
 * is open (or, on Chrome/Edge desktop with the PWA installed, while the
 * app process is running). We are upfront about this in Settings and
 * do not claim reminders work "in the background" on iOS Safari, where
 * web push support is minimal even when installed to the home screen.
 */

const Notifications = (() => {
  let scheduledTimers = new Map(); // taskId -> timeoutId

  function isSupported() {
    return 'Notification' in window;
  }

  function permission() {
    if (!isSupported()) return 'unsupported';
    return Notification.permission; // 'default' | 'granted' | 'denied'
  }

  async function requestPermission() {
    if (!isSupported()) return 'unsupported';
    try {
      const result = await Notification.requestPermission();
      return result;
    } catch (e) {
      console.warn('Notification permission request failed', e);
      return 'denied';
    }
  }

  function fire(title, options) {
    if (!isSupported() || Notification.permission !== 'granted') return;
    try {
      // Prefer showing via the service worker so the notification can
      // survive if it fires right as the tab is backgrounded.
      if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then((reg) => {
          if (reg.showNotification) {
            reg.showNotification(title, options);
          } else {
            new Notification(title, options);
          }
        }).catch(() => new Notification(title, options));
      } else {
        new Notification(title, options);
      }
    } catch (e) {
      console.warn('Failed to show notification', e);
    }
  }

  function minutesForReminder(reminder, customMinutes) {
    switch (reminder) {
      case 'at-time': return 0;
      case '10-min': return 10;
      case '30-min': return 30;
      case '1-hour': return 60;
      case 'custom': return typeof customMinutes === 'number' ? customMinutes : 0;
      default: return null; // 'none'
    }
  }

  /** Cancel any pending timer for a given task. */
  function cancel(taskId) {
    const id = scheduledTimers.get(taskId);
    if (id) {
      clearTimeout(id);
      scheduledTimers.delete(taskId);
    }
  }

  /**
   * Schedule (or reschedule) an in-session reminder for a task.
   * Only schedules if the reminder time is in the future and within the
   * next 24 hours (longer setTimeout delays are unreliable in browsers).
   */
  function schedule(task, settings) {
    cancel(task.id);

    if (!settings.notificationsEnabled) return;
    if (!task.date || task.completed) return;
    if (!task.reminder || task.reminder === 'none') return;
    if (permission() !== 'granted') return;

    const minutesBefore = minutesForReminder(task.reminder, task.reminderCustomMinutes);
    if (minutesBefore === null) return;

    const taskDateTime = combineDateAndTime(task.date, task.time);
    if (!taskDateTime) return;

    const fireAt = new Date(taskDateTime.getTime() - minutesBefore * 60000);
    const delay = fireAt.getTime() - Date.now();

    const ONE_DAY = 24 * 60 * 60 * 1000;
    if (delay <= 0 || delay > ONE_DAY) return; // too soon in the past, or too far out to trust setTimeout

    const timeoutId = setTimeout(() => {
      fire(task.title, {
        body: task.time ? `Scheduled for ${task.time}` : "Today's task",
        icon: './icons/icon-192.png',
        badge: './icons/icon-192.png',
        tag: task.id,
      });
      scheduledTimers.delete(task.id);
    }, delay);

    scheduledTimers.set(task.id, timeoutId);
  }

  function combineDateAndTime(dateStr, timeStr) {
    if (!dateStr) return null;
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return null;
    if (timeStr) {
      const [hh, mm] = timeStr.split(':').map(Number);
      return new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0);
    }
    return new Date(y, m - 1, d, 9, 0, 0, 0); // default 9am if no time set
  }

  /** Re-schedule reminders for a whole list of tasks (call after data loads). */
  function scheduleAll(tasks, settings) {
    scheduledTimers.forEach((id) => clearTimeout(id));
    scheduledTimers.clear();
    if (!settings.notificationsEnabled) return;
    tasks.forEach((t) => schedule(t, settings));
  }

  return {
    isSupported,
    permission,
    requestPermission,
    schedule,
    scheduleAll,
    cancel,
    fire,
  };
})();

window.Notifications = Notifications;
