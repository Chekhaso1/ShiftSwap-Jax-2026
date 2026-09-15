
/*
  ShiftSwap FRESH START
  This script should be created FROM the NEW Google Sheet:
  Extensions -> Apps Script.
  It intentionally uses getActiveSpreadsheet() so there is NO spreadsheet ID to mistype.
*/

const ACCESS_CODE_LENGTH = 6;

function doGet(e) {
  const p=(e&&e.parameter)||{};
  let result;
  try {
    result=handle(p);
  } catch(err) {
    result={ok:false,error:String(err)};
  }

  const cb=String(p.callback||'').trim();
  if(cb && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(cb)) {
    return ContentService.createTextOutput(cb+'('+JSON.stringify(result)+');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e){
  let p={};
  try{p=JSON.parse((e&&e.postData&&e.postData.contents)||'{}')}catch(err){}
  return ContentService.createTextOutput(JSON.stringify(handle(p)))
    .setMimeType(ContentService.MimeType.JSON);
}

function handle(p){
  ensureSheets();
  const action=String(p.action||'');
  if(!action)return {ok:true,service:'ShiftSwap Fresh 2026'};

  if(action==='login'){
    const code=normalizeCode(p.code);
    if(!/^\d{6}$/.test(code))return {ok:false,error:'Enter exactly 6 digits.'};
    const user=findUser(code);
    if(!user)return {ok:false,error:'Invalid employee code.'};
    return {ok:true,user:user};
  }

  const code=normalizeCode(p.code);
  if(!/^\d{6}$/.test(code))return {ok:false,error:'Employee login required.'};
  const user=findUser(code);
  if(!user)return {ok:false,error:'Invalid employee code.'};

  if(action==='list')return {ok:true,days:getDays(),messages:getMessages()};

  if(action==='addDay'){
    if(!p.date)return {ok:false,error:'Date is required.'};
    const lock=LockService.getScriptLock();
    lock.waitLock(8000);
    try{
      const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Days');
      sh.appendRow([Utilities.getUuid(),user.name,String(p.date).trim(),String(p.note||'').trim(),'available','',new Date(),'']);
      SpreadsheetApp.flush();
      return {ok:true,message:'Day added'};
    } finally { lock.releaseLock(); }
  }

  if(action==='pickDay'){
    if(!p.id)return {ok:false,error:'Day ID is required.'};
    const lock=LockService.getScriptLock();
    lock.waitLock(8000);
    try{
      const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Days');
      const values=sh.getDataRange().getValues();
      for(let i=1;i<values.length;i++){
        if(String(values[i][0])===String(p.id)){
          if(String(values[i][4]).toLowerCase()!=='available')return {ok:false,error:'This day has already been picked up.'};
          sh.getRange(i+1,5,1,4).setValues([['taken',user.name,values[i][6]||new Date(),new Date()]]);
          SpreadsheetApp.flush();
          return {ok:true,message:'Day picked up'};
        }
      }
      return {ok:false,error:'Day not found.'};
    } finally { lock.releaseLock(); }
  }

  if(action==='addMessage'){
    const msg=String(p.message||'').trim();
    if(!msg)return {ok:false,error:'Message is required.'};
    const lock=LockService.getScriptLock();
    lock.waitLock(8000);
    try{
      const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Messages');
      sh.appendRow([Utilities.getUuid(),user.name,msg,new Date()]);
      SpreadsheetApp.flush();
      return {ok:true,message:'Message added'};
    } finally { lock.releaseLock(); }
  }

  return {ok:false,error:'Unknown action'};
}

function normalizeCode(v){
  return String(v??'').trim().replace(/\D/g,'').slice(0,6).padStart(6,'0');
}

function findUser(code){
  const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  if(!sh || sh.getLastRow()<2)return null;
  const v=sh.getRange(2,1,sh.getLastRow()-1,3).getDisplayValues();
  for(let i=0;i<v.length;i++){
    const rowCode=String(v[i][0]||'').trim().replace(/\D/g,'').padStart(6,'0');
    const name=String(v[i][1]||'').trim();
    const active=['yes','true','1','active'].includes(String(v[i][2]||'').trim().toLowerCase());
    if(rowCode===code && name && active)return {code:code,name:name,active:true};
  }
  return null;
}

function ensureSheets(){
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  if(!ss.getSheetByName('Days') || !ss.getSheetByName('Messages') || !ss.getSheetByName('Users')){
    setupSheets();
  }
}

function setupSheets(){
  const ss=SpreadsheetApp.getActiveSpreadsheet();

  let d=ss.getSheetByName('Days');
  if(!d)d=ss.insertSheet('Days');
  if(d.getLastRow()===0)d.appendRow(['ID','Name','Date','Note','Status','PickedUpBy','CreatedAt','PickedUpAt']);
  d.setFrozenRows(1);

  let m=ss.getSheetByName('Messages');
  if(!m)m=ss.insertSheet('Messages');
  if(m.getLastRow()===0)m.appendRow(['ID','Name','Message','CreatedAt']);
  m.setFrozenRows(1);

  let u=ss.getSheetByName('Users');
  if(!u){
    u=ss.insertSheet('Users');
    u.appendRow(['Code','Employee Name','Active']);
    u.appendRow(['583214','Administrator','Yes']);
  } else if(u.getLastRow()===0){
    u.appendRow(['Code','Employee Name','Active']);
    u.appendRow(['583214','Administrator','Yes']);
  }
  u.setFrozenRows(1);
  u.getRange('A:A').setNumberFormat('@');
}

function getDays(){
  const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Days');
  if(sh.getLastRow()<=1)return [];
  return sh.getRange(2,1,sh.getLastRow()-1,8).getValues().filter(r=>r[0]).map(r=>({
    id:String(r[0]),name:String(r[1]||''),date:formatDate(r[2]),note:String(r[3]||''),
    status:String(r[4]||'available'),pickedUpBy:String(r[5]||''),
    createdAt:formatDateTime(r[6]),pickedUpAt:formatDateTime(r[7])
  }));
}
function getMessages(){
  const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Messages');
  if(sh.getLastRow()<=1)return [];
  return sh.getRange(2,1,sh.getLastRow()-1,4).getValues().filter(r=>r[0]).reverse().map(r=>({
    id:String(r[0]),name:String(r[1]||''),message:String(r[2]||''),createdAt:formatDateTime(r[3])
  }));
}
function formatDate(v){
  if(v instanceof Date&&!isNaN(v))return Utilities.formatDate(v,Session.getScriptTimeZone(),'yyyy-MM-dd');
  return String(v||'').trim();
}
function formatDateTime(v){
  if(v instanceof Date&&!isNaN(v))return Utilities.formatDate(v,Session.getScriptTimeZone(),'MM/dd/yyyy h:mm a');
  return String(v||'').trim();
}
