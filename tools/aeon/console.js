'use strict';
// Inspired by the upload's role mentions, group channels, handoff cards and drawer.
// All content is text nodes. No local simulation, credential storage or raw HTML.
const $ = id => document.getElementById(id);
let room = 'factory', current = null, selectedJob = '', busy = false, fingerprint = '', polling = false;
function node(tag, text, cls) {const el = document.createElement(tag); if(text !== undefined) el.textContent = text; if(cls) el.className = cls; return el;}
async function api(path, data) {
  const r = await fetch(path, {method: data === undefined ? 'GET':'POST', headers: data===undefined?{}:{'Content-Type':'application/json'}, body: data===undefined?undefined:JSON.stringify(data), credentials:'same-origin'});
  const result = await r.json();
  if(r.status===401) { $('login').hidden=false; $('app').hidden=true; }
  if(!r.ok) throw new Error(result.error || `Request failed (${r.status})`);
  return result;
}
function error(e) {$('error').textContent=e.message;}
function renderMessages(messages) {
  const mark = JSON.stringify(messages);
  if(mark===fingerprint) return;
  const stick = $('messages').scrollHeight-$('messages').scrollTop-$('messages').clientHeight<100;
  fingerprint=mark; const frag = document.createDocumentFragment();
  for(const m of messages) {
    const card=node('article',undefined,`message ${m.kind} ${m.state}`);
    const avatar=node('div',m.sender[0].toUpperCase(),`avatar ${m.sender}`);
    const body=node('div',undefined,'message-body'), head=node('div',undefined,'message-header');
    head.append(node('strong',m.sender==='operator'?'You':m.sender[0].toUpperCase()+m.sender.slice(1)));
    head.append(node('time',new Date(m.created).toLocaleString()));
    body.append(head,node('div',m.content,'message-content'));
    if(m.meta.source==='codex_execution') {
      const tokens=m.meta.usage.reduce((n,u)=>n+(u.input_tokens||0)+(u.output_tokens||0),0);
      body.append(node('div',`Codex executed · ${m.meta.elapsed_seconds}s · ${tokens} reported tokens · tools disabled · log ${m.meta.log_sha256.slice(0,12)}`,'message-meta'));
      const inspect=node('button','Inspect execution log','evidence-button');
      inspect.onclick=async()=>{try{const r=await api('/api/chat-evidence?turn='+m.meta.turn);$('evidence').textContent=`${r.verified?'HASH VERIFIED':'HASH MISMATCH'} · ${r.sha256}\n\n${r.content}`;$('evidence').parentElement.open=true;}catch(e){error(e);}};
      body.append(inspect);
    }
    card.append(avatar,body); frag.append(card);
  }
  $('messages').replaceChildren(frag);
  if(stick) $('messages').scrollTop=$('messages').scrollHeight;
}
function renderActions(actions) {
  $('actions').replaceChildren();
  for(const a of actions.filter(a=>a.state==='pending')) {
    const card=node('section',undefined,'action');
    card.append(node('strong','Confirm a real factory run'),node('pre',JSON.stringify(a.payload,null,2)));
    for(const [label,decision] of [['Confirm scoped run','approve'],['Reject','reject']]) {
      const btn=node('button',label,decision==='reject'?'quiet':'');
      btn.onclick=async()=>{btn.disabled=true; try {await api('/api/decision',{id:a.id,decision}); await refresh();} catch(e){error(e);btn.disabled=false;}};
      card.append(btn);
    }
    $('actions').append(card);
  }
}
function renderJob() {
  const j=current.jobs.find(j=>j.id===selectedJob); $('job').replaceChildren(); $('events').replaceChildren(); $('evidence-buttons').replaceChildren();
  if(!j) {$('job').append(node('p','No factory runs yet.'));return;}
  const summary=node('div',undefined,'job-summary');
  summary.append(node('strong',j.state.replaceAll('_',' ')),node('p',j.objective),node('small',`Model calls: ${j.calls}/${j.max_calls} · Budget: ${j.timeout_seconds}s`),node('p',`Candidate: ${j.candidate_sha || 'not yet created'}`));
  $('job').append(summary);
  for(const [i,s] of j.steps.entries()) {const card=node('div',undefined,`step ${s.state}`);card.append(node('span',`${i+1}. ${s.role}`),node('span',s.state));$('job').append(card);}
  for(const key of ['manifest','test','typecheck','build','visual','dependencies']) {
    const b=node('button',key,'evidence-button');
    b.onclick=async()=>{try{const r=await api(`/api/evidence?job=${encodeURIComponent(j.id)}&key=${key}`);$('evidence').textContent=`${r.verified?'HASH VERIFIED':'HASH MISMATCH'} · ${r.sha256}\n${r.truncated?'First 200 KB only\n':''}\n${r.content}`;$('evidence').parentElement.open=true;}catch(e){error(e);}};
    $('evidence-buttons').append(b);
  }
  for(const e of current.events.filter(e=>e.job===j.id).slice(-14)) {
    const card=node('div',undefined,'event');card.append(node('strong',e.kind.replaceAll('_',' ')),node('small',new Date(e.at).toLocaleString()),node('pre',JSON.stringify(e.detail,null,2)));$('events').append(card);
  }
}
async function refresh() {
  if(polling) return;
  polling=true;
  try {
    const s=await api('/api/state?room='+encodeURIComponent(room)); current=s;
    $('login').hidden=true;$('app').hidden=false;
    $('connection').textContent='Connected to AEON';$('status-dot').classList.add('connected');
    $('rooms').replaceChildren();
    for(const r of s.rooms) {const b=node('button','# '+r.name,r.id===room?'selected':'');b.dataset.roomId=r.id;b.onclick=()=>{room=r.id;fingerprint='';refresh();};$('rooms').append(b);}
    $('room-title').textContent=s.rooms.find(r=>r.id===room)?.name||room;
    renderMessages(s.messages);renderActions(s.actions);
    $('pending').replaceChildren();
    for(const t of s.turns.filter(t=>['queued','running'].includes(t.state)).reverse()) {
      const line=node('div',`@${t.role} · ${t.state} · turn ${t.id}`,'pending');
      if(t.state==='queued') {const b=node('button','Cancel queued turn','quiet');b.onclick=async()=>{try{await api('/api/cancel',{id:t.id});refresh();}catch(e){error(e);}};line.append(b);}
      $('pending').append(line);
    }
    if(!s.jobs.some(j=>j.id===selectedJob)) selectedJob=s.jobs[0]?.id||'';
    const choices=s.jobs.map(j=>`${j.id} ${j.state}`).join('|');
    if($('job-select').dataset.choices!==choices) {$('job-select').replaceChildren(); for(const j of s.jobs){const o=node('option',`${j.id} · ${j.state}`);o.value=j.id;$('job-select').append(o);}$('job-select').dataset.choices=choices;}
    $('job-select').value=selectedJob;renderJob();
    $('budget').textContent=`Per 24h · Chat: ${s.limits.chat_calls_used}/${s.limits.chat_calls_24h} · Runs: ${s.limits.factory_runs_used}/${s.limits.factory_runs_24h}`;
    $('observed').textContent='Observed '+new Date(s.observed_at).toLocaleString();
  } catch(e) {if(!$('app').hidden){$('connection').textContent='Connection lost · data may be stale';$('status-dot').classList.remove('connected');error(e);}}
  finally {polling=false;}
}
async function send(text) {
  if(busy) return;busy=true;$('send').disabled=true;$('error').textContent='';
  try {await api('/api/messages',{room,content:text,request_id:crypto.randomUUID()});$('message').value='';await refresh();}catch(e){error(e);}finally{busy=false;$('send').disabled=false;}
}
$('login-form').onsubmit=async e=>{e.preventDefault();try{await api('/api/login',{token:$('token').value});$('token').value='';$('login-error').textContent='';await refresh();}catch(err){$('login-error').textContent=err.message;}};
$('logout').onclick=async()=>{try{await api('/api/logout',{});$('app').hidden=true;$('login').hidden=false;}catch(e){error(e);}};
$('composer').onsubmit=e=>{e.preventDefault();send($('message').value);};
$('message').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();if($('message').value.trim())send($('message').value);}};
document.querySelectorAll('[data-role]').forEach(b=>{b.onclick=()=>{$('message').value='@'+b.dataset.role+' '+$('message').value;$('message').focus();};});
$('live-status').onclick=()=>send('/status');$('run').onclick=()=>send('/run');
$('job-select').onchange=()=>{selectedJob=$('job-select').value;renderJob();};
$('new-room').onclick=()=>{$('room-form').hidden=!$('room-form').hidden;$('room-name').focus();};
$('room-form').onsubmit=async e=>{e.preventDefault();try{const r=await api('/api/rooms',{name:$('room-name').value});room=r.id;$('room-name').value='';$('room-form').hidden=true;fingerprint='';await refresh();}catch(e){error(e);}};
refresh();setInterval(()=>{if(!$('app').hidden)refresh();},2000);
