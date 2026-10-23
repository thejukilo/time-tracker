const TIMER_KEY = 'timeTrackerTimer';

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('timerHeartbeat', { periodInMinutes: 1 });
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name !== 'timerHeartbeat') return;
  chrome.storage.local.get(TIMER_KEY, ({ [TIMER_KEY]: timer }) => {
    if (timer && timer.startedAt) chrome.action.setBadgeText({ text: 'ON' });
    else chrome.action.setBadgeText({ text: '' });
  });
});
