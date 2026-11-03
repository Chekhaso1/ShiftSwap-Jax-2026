
// ===== ShiftSwap session: keep login on refresh, sign out after 10 minutes inactive =====
const SHIFT_SESSION_KEY = "shiftSwapUser";
const SHIFT_ACTIVITY_KEY = "shiftSwapLastActivity";
const SHIFT_INACTIVITY_MS = 10 * 60 * 1000;
let shiftInactivityTimer = null;

function saveShiftSession(user) {
  localStorage.setItem(SHIFT_SESSION_KEY, JSON.stringify(user));
  localStorage.setItem(SHIFT_ACTIVITY_KEY, String(Date.now()));
  resetShiftInactivityTimer();
}

function getShiftSession() {
  try {
    const raw = localStorage.getItem(SHIFT_SESSION_KEY);
    if (!raw) return null;
    const last = Number(localStorage.getItem(SHIFT_ACTIVITY_KEY) || 0);
    if (!last || Date.now() - last >= SHIFT_INACTIVITY_MS) {
      clearShiftSession();
      return null;
    }
    return JSON.parse(raw);
  } catch (e) {
    clearShiftSession();
    return null;
  }
}

function touchShiftSession() {
  if (localStorage.getItem(SHIFT_SESSION_KEY)) {
    localStorage.setItem(SHIFT_ACTIVITY_KEY, String(Date.now()));
    resetShiftInactivityTimer();
  }
}

function clearShiftSession() {
  localStorage.removeItem(SHIFT_SESSION_KEY);
  localStorage.removeItem(SHIFT_ACTIVITY_KEY);
  if (shiftInactivityTimer) {
    clearTimeout(shiftInactivityTimer);
    shiftInactivityTimer = null;
  }
}

function resetShiftInactivityTimer() {
  if (!localStorage.getItem(SHIFT_SESSION_KEY)) return;
  if (shiftInactivityTimer) clearTimeout(shiftInactivityTimer);
  shiftInactivityTimer = setTimeout(() => {
    clearShiftSession();
    window.location.reload();
  }, SHIFT_INACTIVITY_MS);
}

["click", "keydown", "mousemove", "scroll", "touchstart"].forEach(eventName => {
  window.addEventListener(eventName, touchShiftSession, { passive: true });
});

window.addEventListener("load", () => {
  if (getShiftSession()) resetShiftInactivityTimer();
});

/*
  FRESH ShiftSwap
  IMPORTANT: replace the value below with your NEW Google Apps Script /exec URL.
*/
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxFcNiHq6kYWbknizPMpW7pejLLv_Gr0LDEgSNo01L_fjMwd2RS443luPHhJJyXHaG9Dw/exec";



// ===== Available Days: nearest upcoming date first =====
function sortAvailableDays(days) {
  return (Array.isArray(days) ? days.slice() : []).sort((a, b) => {
    const aDate = new Date(String(a.date || "").trim() + "T00:00:00");
    const bDate = new Date(String(b.date || "").trim() + "T00:00:00");
    const aTime = Number.isNaN(aDate.getTime()) ? Number.MAX_SAFE_INTEGER : aDate.getTime();
    const bTime = Number.isNaN(bDate.getTime()) ? Number.MAX_SAFE_INTEGER : bDate.getTime();
    return aTime - bTime;
  });
}

let currentUser=null, days=[], messages=[], month=new Date();
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function displayDate(v){
  const s=String(v||'').trim(); if(!s)return '';
  let d;
  const m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(m)d=new Date(+m[1],+m[2]-1,+m[3]); else d=new Date(s);
  if(isNaN(d))return s;
  return d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});
}
function dateKey(v){
  const s=String(v||'').trim(), m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m)return `${m[1]}-${m[2]}-${m[3]}`;
  const d=new Date(s); if(isNaN(d))return '';
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function toast(msg){$('toast').textContent=msg;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),2200)}

function jsonp(params){
  return new Promise((resolve,reject)=>{
    if(!WEB_APP_URL || WEB_APP_URL.includes('PASTE_YOUR')){
      reject(new Error('The new Apps Script Web App URL has not been added to app.js.'));
      return;
    }
    const cb='sscb_'+Date.now()+'_'+Math.random().toString(36).slice(2);
    const script=document.createElement('script');
    let finished=false;
    const cleanup=()=>{clearTimeout(timer);script.remove();try{delete window[cb]}catch(e){}};
    const timer=setTimeout(()=>{if(finished)return;finished=true;cleanup();reject(new Error('Google connection timed out.'))},15000);
    window[cb]=data=>{if(finished)return;finished=true;cleanup();resolve(data)};
    script.onerror=()=>{if(finished)return;finished=true;cleanup();reject(new Error('Google Sheets connection failed.'))};
    const q=new URLSearchParams({...params,callback:cb,_:Date.now()});
    script.src=WEB_APP_URL+'?'+q.toString();
    document.head.appendChild(script);
  });
}
const api=(action,extra={})=>jsonp({action,code:currentUser?.code||'',...extra});

function showLogin(){
  $('loginScreen').classList.remove('hidden');$('app').classList.add('hidden');
  $('loginCode').value='';$('loginCode').focus();
}
function unlock(){
  $('loginScreen').classList.add('hidden');$('app').classList.remove('hidden');
  $('currentUser').textContent=`👤 ${currentUser.name}`;
  if(typeof addAdminTabForUser === 'function') addAdminTabForUser();
  load();
}
async function login(code){
  const clean=String(code||'').replace(/\D/g,'').slice(0,6);
  if(clean.length!==6)throw new Error('Enter exactly 6 digits.');
  const r=await jsonp({action:'login',code:clean});
  if(!r?.ok)throw new Error(r?.error||'Invalid employee code.');
  currentUser=r.user;
  saveShiftSession(currentUser);
  unlock();
}
$('loginCode').addEventListener('input',e=>e.target.value=e.target.value.replace(/\D/g,'').slice(0,6));
$('loginForm').addEventListener('submit',async e=>{
  e.preventDefault();$('loginError').textContent='';
  try{await login($('loginCode').value)}
  catch(err){$('loginError').textContent=err.message}
});
$('logout').onclick=()=>{clearShiftSession();currentUser=null;days=[];messages=[];showLogin()};

let shiftLoadPromise=null;
let shiftListCache=null;
let shiftListCacheAt=0;
const SHIFT_CLIENT_CACHE_MS=2500;

async function load(force=false){
  if(!force && shiftListCache && (Date.now()-shiftListCacheAt)<SHIFT_CLIENT_CACHE_MS){
    days=sortAvailableDays(shiftListCache.days||[]);
    messages=shiftListCache.messages||[];
    renderAll();
    return;
  }

  if(shiftLoadPromise && !force){
    return shiftLoadPromise;
  }

  shiftLoadPromise=(async()=>{
    try{
      const r=await api('list');
      if(!r.ok)throw Error(r.error);
      shiftListCache={
        days:Array.isArray(r.days)?r.days:[],
        messages:Array.isArray(r.messages)?r.messages:[]
      };
      shiftListCacheAt=Date.now();
      days=sortAvailableDays(shiftListCache.days);
      messages=shiftListCache.messages;
      renderAll();
    }catch(e){
      toast(e.message||'Unable to load ShiftSwap');
      throw e;
    }finally{
      shiftLoadPromise=null;
    }
  })();

  return shiftLoadPromise;
}


// Populate shift time selectors in 15-minute military-time increments.
function populateMilitaryTimes(){
  const options=[];
  for(let minutes=0; minutes<24*60; minutes+=15){
    const hh=String(Math.floor(minutes/60)).padStart(2,'0');
    const mm=String(minutes%60).padStart(2,'0');
    const value=`${hh}:${mm}`;
    options.push(`<option value="${value}">${value}</option>`);
  }
  const start=$('dayStartTime'), end=$('dayEndTime');
  if(start && end && !start.options.length){
    start.innerHTML=options.join('');
    end.innerHTML=options.join('');
    start.value='07:00';
    end.value='15:00';
  }
}
populateMilitaryTimes();

function card(d){
  const taken=String(d.status).toLowerCase()==='taken';
  // Accept both the Apps Script API names and the Google Sheet column names.
  function formatMilitaryTime(value) {
  if (value === null || value === undefined || value === '') return '';

  const text = String(value).trim();

  // Handle full date strings returned by Google Sheets.
  const match = text.match(/(\d{1,2}):(\d{2})/);
  if (match) {
    return match[1].padStart(2, '0') + match[2];
  }

  // Handle simple HH:mm values.
  const simple = text.match(/^(\d{1,2})(\d{2})$/);
  if (simple) return simple[1].padStart(2, '0') + simple[2];

  return text;
}
  const startTime=formatMilitaryTime(d.startTime ?? d.StartTime ?? d.start_time ?? d.start ?? '');
  const endTime=formatMilitaryTime(d.endTime ?? d.EndTime ?? d.end_time ?? d.end ?? '');
  const hasTime=String(startTime).trim()!=='' || String(endTime).trim()!=='';
  return `<div class="day-card ${taken?'taken':''}">
    <div class="shift-date"><span class="line-icon">▦</span><strong>${esc(displayDate(d.date))}</strong></div>
    ${hasTime?`<p class="shift-hours"><span class="line-icon clock-icon">◷</span><span><strong>Time slot:</strong> ${esc(startTime||'--:--')} – ${esc(endTime||'--:--')}</span></p>`:''}
    <p class="posted-by"><span class="line-icon">♙</span><span><strong>Posted by:</strong> ${esc(d.name||'Officer')}</span></p>
    ${d.note?`<p class="shift-note">${esc(d.note)}</p>`:''}
    ${taken?`<p class="taken-by">Taken by <b>${esc(d.pickedUpBy)}</b></p><span class="status-pill taken-pill">Taken</span>`:`<span class="status-pill available-pill">Available</span><div class="card-actions"><button class="primary grab-btn" onclick="pickDay('${esc(d.id)}')">Pick Up</button></div>`}
  </div>`;
}
function renderAll(){
  days=sortAvailableDays(days);
  const av=days.filter(d=>String(d.status).toLowerCase()!=='taken');
  const tk=sortAvailableDays(days.filter(d=>String(d.status).toLowerCase()==='taken'));
  $('availableCount').textContent=`${av.length} Available`;$('takenCount').textContent=`${tk.length} Taken`;
  $('availableList').innerHTML=av.map(card).join('')||'<div class="empty">No available days.</div>';
  $('takenList').innerHTML=tk.map(card).join('')||'<div class="empty">No picked-up days yet.</div>';
  $('grabList').innerHTML=av.map(card).join('')||'<div class="empty">No days to grab right now.</div>';
  $('messagesList').innerHTML=messages.map(m=>`<div class="message"><b>${esc(m.name)}</b><p>${esc(m.message)}</p><small>${esc(m.createdAt)}</small></div>`).join('')||'<div class="message">No messages yet.</div>';
  $('statAvailable').textContent=av.length;$('statTaken').textContent=tk.length;
  $('statEmployees').textContent=new Set(days.map(d=>d.name).filter(Boolean)).size;
  renderCalendar();
}
async function pickDay(id){
  if(!confirm('Pick up this day?'))return;
  try{const r=await api('pickDay',{id});if(!r.ok)throw Error(r.error);toast('Day picked up.');await load(true)}catch(e){alert(e.message)}
}
function renderCalendar(){
  const y=month.getFullYear(),m=month.getMonth(),first=new Date(y,m,1),off=(first.getDay()+6)%7,last=new Date(y,m+1,0).getDate();
  $('monthTitle').textContent=month.toLocaleString('en-US',{month:'long',year:'numeric'});
  let h='';
  for(let i=0;i<42;i++){
    const n=i-off+1,d=n<1?new Date(y,m-1,new Date(y,m,0).getDate()+n):n>last?new Date(y,m+1,n-last):new Date(y,m,n);
    const key=dateKey(d.toISOString().slice(0,10)), matching=days.filter(x=>dateKey(x.date)===key);
    const hasT=matching.some(x=>String(x.status).toLowerCase()==='taken'),hasA=matching.some(x=>String(x.status).toLowerCase()!=='taken');
    const cls=hasT&&!hasA?'taken-day':hasA&&!hasT?'available-day':hasT&&hasA?'mixed-day':'';
    h+=`<div class="day ${cls}"><b>${d.getDate()}</b>${matching.map(x=>String(x.status).toLowerCase()==='taken'?'<div class="event event-taken">🔴 Taken</div>':'<div class="event event-available">🟢 Days to Grab</div>').join('')}</div>`;
  }
  $('calendarGrid').innerHTML=h;
}
$('prevMonth').onclick=()=>{month.setMonth(month.getMonth()-1);renderCalendar()};
$('nextMonth').onclick=()=>{month.setMonth(month.getMonth()+1);renderCalendar()};

document.querySelectorAll('.tab').forEach(btn=>btn.onclick=()=>{
  document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));btn.classList.add('active');
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));$(btn.dataset.tab).classList.add('active');
});
$('postDayBtn').onclick=()=>{$('modal').classList.remove('hidden');$('dayDate').focus()};
$('welcomePostBtn').onclick=()=>{$('modal').classList.remove('hidden');$('dayDate').focus()};
$('closeModal').onclick=()=>{$('modal').classList.add('hidden')};
$('modal').addEventListener('click',e=>{if(e.target.id==='modal')$('modal').classList.add('hidden')});
$('dayForm').onsubmit=async e=>{
  e.preventDefault();
  try{const r=await api('addDay',{date:$('dayDate').value,startTime:$('dayStartTime').value,endTime:$('dayEndTime').value,note:$('dayNote').value.trim()});if(!r.ok)throw Error(r.error);e.target.reset();$('modal').classList.add('hidden');toast('Available day posted.');await load(true)}catch(x){alert(x.message)}
};
$('messageForm').onsubmit=async e=>{
  e.preventDefault();
  try{const r=await api('addMessage',{message:$('messageText').value.trim()});if(!r.ok)throw Error(r.error);e.target.reset();toast('Message posted.');await load(true)}catch(x){alert(x.message)}
};

// ===== Administrator-only monthly reports =====
function isAdminUser(){
  return String(currentUser?.role || '').trim().toLowerCase() === 'admin';
}

function addAdminTabForUser(){
  const nav = document.querySelector('.tabs');
  const main = document.querySelector('main');
  if(!nav || !main || !isAdminUser()) return;

  if(!$('adminTabButton')){
    const btn = document.createElement('button');
    btn.id = 'adminTabButton';
    btn.className = 'tab';
    btn.dataset.tab = 'adminReports';
    btn.textContent = '🔒 Admin Reports';
    nav.appendChild(btn);

    const section = document.createElement('section');
    section.id = 'adminReports';
    section.className = 'tab-panel';
    section.innerHTML = `
      <div class="admin-report-head">
        <div>
          <div class="welcome-kicker">PRIVATE ADMINISTRATOR AREA</div>
          <h2>Monthly ShiftSwap Reports</h2>
          <p>Requests, accepted shifts, employee activity, and timestamps.</p>
        </div>
        <div class="admin-report-controls">
          <label for="adminReportMonth">Month</label>
          <input id="adminReportMonth" type="month">
          <button id="adminRefreshBtn" class="primary" type="button">Refresh report</button>
          <button id="adminCsvBtn" type="button">Download CSV</button>
        </div>
      </div>
      <div id="adminReportError" class="login-error" role="alert"></div>
      <div class="stats-grid admin-report-stats">
        <div class="stat-card"><strong id="adminTotal">0</strong><span>Total Requests</span></div>
        <div class="stat-card"><strong id="adminAccepted">0</strong><span>Accepted</span></div>
        <div class="stat-card"><strong id="adminAvailable">0</strong><span>Available</span></div>
        <div class="stat-card"><strong id="adminEmployees">0</strong><span>Employees</span></div>
      </div>
      <div class="admin-report-card">
        <h3>Monthly activity</h3>
        <p class="admin-muted">Shift requests posted and accepted in the selected month.</p>
        <div id="adminMonthlyChart" class="admin-chart"></div>
      </div>
      <div class="admin-report-card">
        <h3>Employee activity</h3>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Employee</th><th>Requests posted</th><th>Shifts accepted</th></tr></thead>
            <tbody id="adminEmployeeRows"><tr><td colspan="3">No report loaded.</td></tr></tbody>
          </table>
        </div>
      </div>
      <div class="admin-report-card">
        <h3>Shift request details</h3>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Posted by</th><th>Shift date</th><th>Time slot</th><th>Posted timestamp</th><th>Status</th><th>Accepted by</th><th>Accepted timestamp</th></tr></thead>
            <tbody id="adminDetailRows"><tr><td colspan="7">No report loaded.</td></tr></tbody>
          </table>
        </div>
      </div>`;
    main.appendChild(section);

    btn.addEventListener('click', () => openAdminReports());
    $('adminRefreshBtn').addEventListener('click', () => loadAdminReport(true));
    $('adminCsvBtn').addEventListener('click', downloadAdminCsv);
    $('adminReportMonth').addEventListener('change', () => renderAdminReport());
    $('adminReportMonth').value = new Date().toISOString().slice(0,7);
  }
}

let adminReportDays = [];
let adminReportLoaded = false;

function adminMonthKey(dateValue){
  const s = String(dateValue || '').trim();
  const m = s.match(/^(\d{4})-(\d{2})/);
  if(m) return `${m[1]}-${m[2]}`;
  const d = new Date(s);
  if(Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function adminEsc(value){ return esc(value == null ? '' : String(value)); }

// Display shift times in the same compact 24-hour military format as the board (e.g. 0400-0900).
function adminMilitaryTime(value){
  const raw = String(value ?? '').trim();
  if(!raw) return '';
  if(/^\d{4}$/.test(raw)) return raw;
  const match = raw.match(/^(\d{1,2}):?(\d{2})(?:\s*(AM|PM))?$/i);
  if(!match) return raw.replace(/:/g,'').replace(/\s*(AM|PM)$/i,'');
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = (match[3] || '').toUpperCase();
  if(minute > 59 || hour > 24 || (meridiem && (hour < 1 || hour > 12))) return raw;
  if(meridiem === 'AM' && hour === 12) hour = 0;
  if(meridiem === 'PM' && hour !== 12) hour += 12;
  return String(hour).padStart(2,'0') + String(minute).padStart(2,'0');
}

function openAdminReports(){
  if(!isAdminUser()){
    toast('Administrator access required.');
    return;
  }
  document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
  $('adminTabButton')?.classList.add('active');
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  $('adminReports')?.classList.add('active');
  loadAdminReport(false);
}

async function loadAdminReport(force){
  if(!isAdminUser()){
    toast('Administrator access required.');
    return;
  }
  const errorBox = $('adminReportError');
  if(errorBox) errorBox.textContent = '';
  try{
    const r = await api('adminReport');
    if(!r?.ok) throw new Error(r?.error || 'Unable to load administrator report.');
    adminReportDays = Array.isArray(r.report) ? r.report : [];
    adminReportLoaded = true;
    renderAdminReport();
  }catch(err){
    if(errorBox) errorBox.textContent = err.message || 'Unable to load report.';
  }
}

function renderAdminReport(){
  if(!adminReportLoaded) return;
  const selectedMonth = $('adminReportMonth')?.value || new Date().toISOString().slice(0,7);
  const postedRows = adminReportDays.filter(d => adminMonthKey(d.createdAt) === selectedMonth);
  const acceptedRows = adminReportDays.filter(d =>
    String(d.status||'').toLowerCase() === 'taken' &&
    adminMonthKey(d.pickedUpAt) === selectedMonth
  );
  const rows = adminReportDays.filter(d =>
    adminMonthKey(d.createdAt) === selectedMonth ||
    adminMonthKey(d.pickedUpAt) === selectedMonth
  );
  const accepted = acceptedRows;
  const available = postedRows.filter(d => String(d.status||'').toLowerCase() !== 'taken');
  const employeeNames = new Set([
    ...postedRows.map(d=>d.name),
    ...acceptedRows.map(d=>d.pickedUpBy)
  ].filter(Boolean));

  $('adminTotal').textContent = postedRows.length;
  $('adminAccepted').textContent = accepted.length;
  $('adminAvailable').textContent = available.length;
  $('adminEmployees').textContent = employeeNames.size;

  const employeeMap = {};
  rows.forEach(d=>{
    const poster = d.name || 'Unknown';
    if(!employeeMap[poster]) employeeMap[poster] = {posted:0,accepted:0};
    employeeMap[poster].posted++;
    if(String(d.status||'').toLowerCase()==='taken') employeeMap[poster].accepted++;
    const picker = d.pickedUpBy || '';
    if(picker){
      if(!employeeMap[picker]) employeeMap[picker] = {posted:0,accepted:0};
      employeeMap[picker].accepted++;
    }
  });
  const employeeRows = Object.entries(employeeMap).sort((a,b)=>a[0].localeCompare(b[0]));
  $('adminEmployeeRows').innerHTML = employeeRows.length
    ? employeeRows.map(([name,v])=>`<tr><td>${adminEsc(name)}</td><td>${v.posted}</td><td>${v.accepted}</td></tr>`).join('')
    : '<tr><td colspan="3">No activity for this month.</td></tr>';

  const postedByDay = {};
  const acceptedByDay = {};
  rows.forEach(d=>{
    const day = String(d.createdAt||'').slice(0,10);
    if(day) postedByDay[day] = (postedByDay[day]||0)+1;
    if(String(d.status||'').toLowerCase()==='taken' && d.pickedUpAt){
      const acceptedDay = String(d.pickedUpAt).slice(0,10);
      acceptedByDay[acceptedDay] = (acceptedByDay[acceptedDay]||0)+1;
    }
  });
  const keys = [...new Set([...Object.keys(postedByDay),...Object.keys(acceptedByDay)])].sort();
  const max = Math.max(1,...keys.map(k=>Math.max(postedByDay[k]||0,acceptedByDay[k]||0)));
  $('adminMonthlyChart').innerHTML = keys.length ? keys.map(k=>{
    const p=postedByDay[k]||0, a=acceptedByDay[k]||0;
    return `<div class="admin-chart-row"><span>${adminEsc(k)}</span><div class="admin-chart-bars"><div class="admin-bar posted" style="width:${p/max*100}%"><b>${p}</b></div><div class="admin-bar accepted" style="width:${a/max*100}%"><b>${a}</b></div></div></div>`;
  }).join('') : '<p>No activity recorded for this month.</p>';

  $('adminDetailRows').innerHTML = rows.length ? rows.slice().sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).map(d=>{
    const start=adminMilitaryTime(d.startTime ?? d.StartTime ?? d.start_time ?? d.start ?? '');
    const end=adminMilitaryTime(d.endTime ?? d.EndTime ?? d.end_time ?? d.end ?? '');
    const timeSlot = start || end ? `${start || '----'}-${end || '----'}` : '—';
    return `<tr><td>${adminEsc(d.name)}</td><td>${adminEsc(d.date)}</td><td>${adminEsc(timeSlot)}</td><td>${adminEsc(d.createdAt)}</td><td>${adminEsc(d.status)}</td><td>${adminEsc(d.pickedUpBy)}</td><td>${adminEsc(d.pickedUpAt)}</td></tr>`;
  }).join('') : '<tr><td colspan="7">No requests posted in this month.</td></tr>';
}

function downloadAdminCsv(){
  if(!isAdminUser() || !adminReportLoaded) return;
  const monthValue = $('adminReportMonth')?.value || '';
  const rows = adminReportDays.filter(d=>adminMonthKey(d.createdAt)===monthValue || adminMonthKey(d.pickedUpAt)===monthValue);
  const cols = ['Employee','Shift Date','Start Time','End Time','Request Timestamp','Status','Accepted By','Acceptance Timestamp'];
  const csvCell = v => '"' + String(v??'').replace(/"/g,'""') + '"';
  const lines = [cols.map(csvCell).join(',')];
  rows.forEach(d=>lines.push([
    d.name,d.date,d.startTime,d.endTime,d.createdAt,d.status,d.pickedUpBy,d.pickedUpAt
  ].map(csvCell).join(',')));
  const blob = new Blob([lines.join('\r\n')],{type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download=`ShiftSwap_Report_${monthValue||'month'}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

const restoredUser=getShiftSession();
if(restoredUser){ currentUser=restoredUser; unlock(); } else { showLogin(); }
