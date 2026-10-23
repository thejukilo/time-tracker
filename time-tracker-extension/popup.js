const TIMER_KEY = 'timeTrackerTimer';
const el = id => document.getElementById(id);
const state = { bootstrap: null, timer: null };

function apiUrl(action) {
  const joiner = TIME_TRACKER_WEB_APP_URL.includes('?') ? '&' : '?';
  return `${TIME_TRACKER_WEB_APP_URL}${joiner}api=${encodeURIComponent(action)}`;
}
function notice(message) { const box = el('notice'); box.textContent = message; box.hidden = !message; }
function dateKey(timestamp) { const date = new Date(timestamp); return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
function formatElapsed(milliseconds) { const seconds = Math.max(0, Math.floor(milliseconds / 1000)); const h = String(Math.floor(seconds / 3600)).padStart(2,'0'); const m = String(Math.floor((seconds % 3600) / 60)).padStart(2,'0'); const s = String(seconds % 60).padStart(2,'0'); return `${h}:${m}:${s}`; }
function setOptions(select, items, placeholder) { select.innerHTML = `<option value="" disabled>${placeholder}</option>` + items.map(item => `<option value="${item.id}">${item.name}</option>`).join(''); }
function selectedCategory() { return state.bootstrap.options.categories.find(item => item.id === el('category').value); }
function refreshConditionalFields() { const category = selectedCategory(); const project = el('projectWrap'), instrument = el('instrumentWrap'); project.hidden = !(category && category.requires_project); instrument.hidden = !(category && category.requires_instrument); }
function readTask() { return { departmentId: el('department').value, categoryId: el('category').value, projectId: el('project').value || '', instrumentId: el('instrument').value || '' }; }
function applyTask(task) { if (!task) return; el('department').value = task.departmentId || ''; el('category').value = task.categoryId || ''; refreshConditionalFields(); el('project').value = task.projectId || ''; el('instrument').value = task.instrumentId || ''; }
function updateTimer() { const timer = state.timer; const running = timer && timer.startedAt; el('elapsed').textContent = running ? formatElapsed(Date.now() - timer.startedAt) : '00:00:00'; el('timerStatus').textContent = running ? `Tracking since ${new Date(timer.startedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}` : 'Choose a task, then start'; el('startStop').textContent = running ? 'Stop timer' : 'Start timer'; if (running) requestAnimationFrame(updateTimer); }
async function getStoredTimer() { return new Promise(resolve => chrome.storage.local.get(TIMER_KEY, data => resolve(data[TIMER_KEY] || null))); }
async function storeTimer(timer) { return new Promise(resolve => chrome.storage.local.set({ [TIMER_KEY]: timer }, resolve)); }
async function clearTimer() { return new Promise(resolve => chrome.storage.local.remove(TIMER_KEY, resolve)); }
async function loadBootstrap() {
  const response = await fetch(apiUrl('timerBootstrap'), { credentials: 'include' });
  const result = await response.json();
  if (!result.ok) throw new Error(result.error || 'Unable to load Time Tracker options.');
  state.bootstrap = result.data;
  el('identity').textContent = result.data.email;
  setOptions(el('department'), result.data.options.departments, 'Select department');
  setOptions(el('category'), result.data.options.categories, 'Select category');
  setOptions(el('project'), result.data.options.projects, 'No project selected');
  setOptions(el('instrument'), result.data.options.instruments, 'No instrument selected');
  el('entryForm').hidden = false;
}
async function startStop() {
  if (state.timer && state.timer.startedAt) {
    const timer = state.timer;
    const hours = Math.max(.01, Math.round(((Date.now() - timer.startedAt) / 3600000) * 100) / 100);
    state.timer = { ...timer, startedAt: null, stoppedAt: Date.now(), hours };
    await storeTimer(state.timer);
    el('hours').value = hours;
    updateTimer();
    notice('Timer stopped. Review the hours and save the entry.');
    return;
  }
  const task = readTask();
  if (!task.departmentId || !task.categoryId) return notice('Select a department and category before starting.');
  state.timer = { startedAt: Date.now(), task, workDate: dateKey(Date.now()) };
  await storeTimer(state.timer);
  notice(''); updateTimer();
}
async function saveEntry(event) {
  event.preventDefault();
  if (!state.timer || state.timer.startedAt) return notice('Stop the timer before saving.');
  const hours = Number(el('hours').value);
  if (!Number.isFinite(hours) || hours <= 0) return notice('Enter a valid duration.');
  const entry = { ...state.timer.task, startDate: state.timer.workDate, endDate: state.timer.workDate, hours, dailyHours: [{ workDate: state.timer.workDate, hours }] };
  const body = new URLSearchParams({ api: 'timerSave', entry: JSON.stringify(entry) });
  el('save').disabled = true; el('save').textContent = 'Saving…';
  try {
    const response = await fetch(TIME_TRACKER_WEB_APP_URL, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body });
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || 'Unable to save entry.');
    await clearTimer(); state.timer = null; el('hours').value = ''; notice('Time entry saved.'); updateTimer();
  } catch (error) { notice(error.message || 'Unable to save entry.'); }
  finally { el('save').disabled = false; el('save').textContent = 'Save entry'; }
}
async function initialise() {
  if (!TIME_TRACKER_WEB_APP_URL || TIME_TRACKER_WEB_APP_URL.includes('PASTE_YOUR')) { el('setup').hidden = false; return; }
  try {
    await loadBootstrap();
    state.timer = await getStoredTimer();
    if (state.timer) { applyTask(state.timer.task); if (!state.timer.startedAt) el('hours').value = state.timer.hours || ''; }
    el('category').addEventListener('change', refreshConditionalFields);
    el('startStop').addEventListener('click', startStop);
    el('entryForm').addEventListener('submit', saveEntry);
    el('discard').addEventListener('click', async () => { await clearTimer(); state.timer = null; el('hours').value = ''; notice('Timer discarded.'); updateTimer(); });
    updateTimer();
  } catch (error) { notice(error.message || 'Unable to connect. Confirm you are signed in and the web app URL is correct.'); }
}
initialise();
