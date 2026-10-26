const TIMER_KEY = 'timeTrackerTimer';
const BOOTSTRAP_KEY = 'timeTrackerBootstrapCache';
const el = id => document.getElementById(id);
const state = { bootstrap: null, timer: null };
const WEB_APP_URL = typeof TIME_TRACKER_WEB_APP_URL === 'string' ? TIME_TRACKER_WEB_APP_URL.trim() : '';

function apiUrl(action) {
  const joiner = WEB_APP_URL.includes('?') ? '&' : '?';
  return `${WEB_APP_URL}${joiner}api=${encodeURIComponent(action)}`;
}
function notice(message) { const box = el('notice'); box.textContent = message; box.hidden = !message; }
function storageGet(key) { return new Promise(resolve => chrome.storage.local.get(key, data => resolve(data[key] || null))); }
function storageSet(data) { return new Promise(resolve => chrome.storage.local.set(data, resolve)); }
function storageRemove(key) { return new Promise(resolve => chrome.storage.local.remove(key, resolve)); }
async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  catch (error) {
    if (error.name === 'AbortError') throw new Error('Connection timed out. Check your connection and try Sync again.');
    throw error;
  } finally { clearTimeout(timeout); }
}
function dateKey(timestamp) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function formatElapsed(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}
function setOptions(select, items, placeholder) {
  select.replaceChildren(new Option(placeholder, '', true, true));
  select.options[0].disabled = true;
  items.forEach(item => select.add(new Option(item.name, item.id)));
}
function selectedCategory() {
  return (state.bootstrap?.options?.categories || []).find(item => item.id === el('category').value);
}
function refreshConditionalFields() {
  const category = selectedCategory();
  const showProject = Boolean(category?.requires_project);
  const showInstrument = Boolean(category?.requires_instrument);
  el('projectWrap').hidden = !showProject;
  el('instrumentWrap').hidden = !showInstrument;
  if (!showProject) el('project').value = '';
  if (!showInstrument) el('instrument').value = '';
}
function readTask() {
  return { departmentId: el('department').value, categoryId: el('category').value, projectId: el('project').value || '', instrumentId: el('instrument').value || '' };
}
function applyTask(task) {
  if (!task) return;
  el('department').value = task.departmentId || '';
  el('category').value = task.categoryId || '';
  el('project').value = task.projectId || '';
  el('instrument').value = task.instrumentId || '';
  refreshConditionalFields();
}
function updateTimer() {
  const running = state.timer?.startedAt;
  el('elapsed').textContent = running ? formatElapsed(Date.now() - state.timer.startedAt) : '00:00:00';
  el('timerStatus').textContent = running ? `Tracking since ${new Date(state.timer.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Choose a task, then start or enter hours manually';
  el('startStop').textContent = running ? 'Stop timer' : 'Start timer';
  if (running) requestAnimationFrame(updateTimer);
}
function updateSyncLabel(syncedAt) {
  el('syncMeta').textContent = syncedAt ? `Last synced ${new Date(syncedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}` : 'Not synced yet';
}
function renderBootstrap(bootstrap, syncedAt) {
  state.bootstrap = bootstrap;
  el('identity').textContent = bootstrap.email;
  setOptions(el('department'), bootstrap.options.departments, 'Select department');
  setOptions(el('category'), bootstrap.options.categories, 'Select category');
  setOptions(el('project'), bootstrap.options.projects, 'No project selected');
  setOptions(el('instrument'), bootstrap.options.instruments, 'No instrument selected');
  updateSyncLabel(syncedAt);
  el('tracker').hidden = false;
  el('entryForm').hidden = false;
  if (state.timer) applyTask(state.timer.task);
  else refreshConditionalFields();
}
async function getBootstrapFromServer() {
  const response = await fetchWithTimeout(apiUrl('timerBootstrap'), { credentials: 'include' });
  if (!response.ok) throw new Error(`The Time Tracker service returned ${response.status}.`);
  const raw = await response.text();
  let result;
  try { result = JSON.parse(raw); }
  catch (_) { throw new Error('The web-app URL returned a web page instead of the timer API. Confirm the deployed /exec URL.'); }
  if (!result.ok) throw new Error(result.error || 'Unable to load Time Tracker options.');
  return result.data;
}
async function syncReferenceData() {
  const syncButton = el('sync');
  syncButton.disabled = true;
  syncButton.textContent = 'Syncing…';
  try {
    const bootstrap = await getBootstrapFromServer();
    const cache = { data: bootstrap, syncedAt: Date.now() };
    await storageSet({ [BOOTSTRAP_KEY]: cache });
    renderBootstrap(cache.data, cache.syncedAt);
    notice('Lists updated.');
  } catch (error) {
    notice(error.message || 'Unable to sync lists.');
    if (!state.bootstrap) el('identity').textContent = 'Sync required';
  } finally {
    syncButton.disabled = false;
    syncButton.textContent = 'Sync now';
  }
}
async function startStop() {
  if (state.timer?.startedAt) {
    const hours = Math.max(.01, Math.round(((Date.now() - state.timer.startedAt) / 3600000) * 100) / 100);
    state.timer = { ...state.timer, startedAt: null, stoppedAt: Date.now(), hours };
    await storageSet({ [TIMER_KEY]: state.timer });
    el('hours').value = hours;
    updateTimer();
    notice('Timer stopped. Review the hours and save the entry.');
    return;
  }
  const task = readTask();
  if (!task.departmentId || !task.categoryId) return notice('Select a department and category before starting.');
  state.timer = { startedAt: Date.now(), task, workDate: dateKey(Date.now()) };
  await storageSet({ [TIMER_KEY]: state.timer });
  notice('');
  updateTimer();
}
async function saveEntry(event) {
  event.preventDefault();
  if (state.timer?.startedAt) return notice('Stop the timer before saving.');
  const hours = Number(el('hours').value);
  if (!Number.isFinite(hours) || hours <= 0) return notice('Enter a valid duration.');
  const task = state.timer?.task || readTask();
  if (!task.departmentId || !task.categoryId) return notice('Select a department and category before saving.');
  const workDate = state.timer?.workDate || dateKey(Date.now());
  const entry = { ...task, startDate: workDate, endDate: workDate, hours, dailyHours: [{ workDate, hours }] };
  const body = new URLSearchParams({ api: 'timerSave', entry: JSON.stringify(entry) });
  el('save').disabled = true;
  el('save').textContent = 'Saving…';
  try {
    const response = await fetchWithTimeout(WEB_APP_URL, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body });
    const raw = await response.text();
    const result = JSON.parse(raw);
    if (!result.ok) throw new Error(result.error || 'Unable to save entry.');
    await storageRemove(TIMER_KEY);
    state.timer = null;
    el('hours').value = '';
    notice('Time entry saved.');
    updateTimer();
  } catch (error) { notice(error.message || 'Unable to save entry.'); }
  finally {
    el('save').disabled = false;
    el('save').textContent = 'Save entry';
  }
}
function wireEvents() {
  el('category').addEventListener('change', refreshConditionalFields);
  el('startStop').addEventListener('click', startStop);
  el('sync').addEventListener('click', syncReferenceData);
  el('entryForm').addEventListener('submit', saveEntry);
  el('discard').addEventListener('click', async () => {
    await storageRemove(TIMER_KEY);
    state.timer = null;
    el('hours').value = '';
    notice('Timer discarded.');
    updateTimer();
  });
}
async function initialise() {
  wireEvents();
  if (!WEB_APP_URL || WEB_APP_URL.includes('PASTE_YOUR')) {
    el('identity').textContent = 'Setup required';
    el('setup').hidden = false;
    return;
  }
  state.timer = await storageGet(TIMER_KEY);
  const cache = await storageGet(BOOTSTRAP_KEY);
  if (cache?.data) renderBootstrap(cache.data, cache.syncedAt);
  else await syncReferenceData();
  if (state.timer && !state.timer.startedAt) el('hours').value = state.timer.hours || '';
  updateTimer();
}
initialise();
