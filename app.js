
/*
  FRESH ShiftSwap
  IMPORTANT: replace the value below with your NEW Google Apps Script /exec URL.
*/
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyYLHsL4Wa2FOHWvTCZ3D-884d2bm_5F7CJMEcDpuEqJfkk6IHEWgrDNkUzhkNoig1YJA/exec";

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
  load();
}
async function login(code){
  const clean=String(code||'').replace(/\D/g,'').slice(0,6);
  if(clean.length!==6)throw new Error('Enter exactly 6 digits.');
  const r=await jsonp({action:'login',code:clean});
  if(!r?.ok)throw new Error(r?.error||'Invalid employee code.');
  // Intentionally NOT stored in localStorage/sessionStorage.
  // A full page reload always requires the employee to enter the code again.
  currentUser=r.user; unlock();
}
$('loginCode').addEventListener('input',e=>e.target.value=e.target.value.replace(/\D/g,'').slice(0,6));
$('loginForm').addEventListener('submit',async e=>{
  e.preventDefault();$('loginError').textContent='';
  try{await login($('loginCode').value)}
  catch(err){$('loginError').textContent=err.message}
});
$('logout').onclick=()=>{currentUser=null;days=[];messages=[];showLogin()};

async function load(){
  try{
    const r=await api('list'); if(!r.ok)throw Error(r.error);
    days=Array.isArray(r.days)?r.days:[];messages=Array.isArray(r.messages)?r.messages:[];
    renderAll();
  }catch(e){toast(e.message||'Unable to load ShiftSwap')}
}
function card(d){
  const taken=String(d.status).toLowerCase()==='taken';
  return `<div class="day-card ${taken?'taken':''}">
    <h3>📅 ${esc(displayDate(d.date))}</h3>
    ${d.note?`<p>${esc(d.note)}</p>`:''}
    ${taken?`<p>Taken by <b>${esc(d.pickedUpBy)}</b></p>`:''}
    <span class="status-pill ${taken?'taken-pill':'available-pill'}">${taken?'Taken':'Available'}</span>
    ${!taken?`<div class="card-actions"><button class="primary grab-btn" onclick="pickDay('${esc(d.id)}')">Pick Up</button></div>`:''}
  </div>`;
}
function renderAll(){
  const av=days.filter(d=>String(d.status).toLowerCase()!=='taken');
  const tk=days.filter(d=>String(d.status).toLowerCase()==='taken');
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
  try{const r=await api('pickDay',{id});if(!r.ok)throw Error(r.error);toast('Day picked up.');await load()}catch(e){alert(e.message)}
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
$('closeModal').onclick=()=>{$('modal').classList.add('hidden')};
$('modal').addEventListener('click',e=>{if(e.target.id==='modal')$('modal').classList.add('hidden')});
$('dayForm').onsubmit=async e=>{
  e.preventDefault();
  try{const r=await api('addDay',{date:$('dayDate').value,note:$('dayNote').value.trim()});if(!r.ok)throw Error(r.error);e.target.reset();$('modal').classList.add('hidden');toast('Available day posted.');await load()}catch(x){alert(x.message)}
};
$('messageForm').onsubmit=async e=>{
  e.preventDefault();
  try{const r=await api('addMessage',{message:$('messageText').value.trim()});if(!r.ok)throw Error(r.error);e.target.reset();toast('Message posted.');await load()}catch(x){alert(x.message)}
};
showLogin();
