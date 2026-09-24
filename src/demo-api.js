// Static demonstration adapter. No Python execution or server writes occur here.
let snapshotPromise;
const key='socsure-pages-review-v1';
async function snapshot(){
 if(!snapshotPromise)snapshotPromise=fetch(new URL('demo-snapshot.json',document.baseURI)).then(r=>{if(!r.ok)throw Error('Demo data could not be loaded. Open the published website, not index.html directly.');return r.json()}).catch(e=>{snapshotPromise=null;throw e});
 return snapshotPromise;
}
function events(){try{const x=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(x)?x.filter(e=>e&&typeof e.finding_id==='string'):[]}catch{return []}}
function writeEvents(value){try{localStorage.setItem(key,JSON.stringify(value))}catch{throw Error('Browser storage is unavailable. Allow site storage to save a demonstration decision.')}}
function decorate(s){const ev=events().filter(e=>e.version===s.dataset_version);const map=new Map(ev.map(e=>[e.finding_id,e]));return {...s,decision_events:ev,findings:s.findings.map(f=>({...f,decision:map.get(f.finding_id)?.decision||'Unreviewed',notes:map.get(f.finding_id)?.notes||''}))}}
export function selectPack(findings,budget){
 const groups=new Map();
 [...findings].sort((a,b)=>b.priority_score-a.priority_score).forEach(f=>{const k=JSON.stringify([f.finding_type,f.entity_id]);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(f)});
 const selected=[],used=new Set();
 while(selected.length<budget&&[...groups.values()].some(g=>g.length)){
  for(const g of groups.values()){
   while(g.length){const f=g.shift();const identity=f.case_id||`${f.entity_id}:${f.period}:${f.finding_type}`;if(used.has(identity))continue;used.add(identity);selected.push({...f,selection_reason:`Highest remaining priority in ${f.finding_type} for ${f.entity_name}; adds category/entity coverage.`});break}
   if(selected.length===budget)break;
  }
 }
 return selected;
}
export async function api(path,options={}){
 const s=decorate(await snapshot());const u=new URL(path,'https://demo.invalid');
 if(u.pathname==='/state'){const {records,...state}=s;return state}
 if(u.pathname==='/demo/download')return s.records;
 if(u.pathname==='/demo'){writeEvents([]);return {reset:true}}
 if(u.pathname==='/review'){
  const budget=Number(u.searchParams.get('budget')||20);if(![10,20,50].includes(budget))throw Error('Budget must be 10, 20 or 50');const period=u.searchParams.get('period');
  const eligible=s.findings.filter(f=>(!period||f.period===period)&&f.decision==='Unreviewed'&&f.finding_type!=='Peer baseline only');const selected=selectPack(eligible,budget);
  return {selected,available:eligible.length,budget,selected_count:selected.length,review_reduction:eligible.length?Math.round(1000*(1-selected.length/eligible.length))/10:0};
 }
 const match=u.pathname.match(/^\/findings\/([^/]+)\/(evidence|decision)$/);
 if(match){const f=s.findings.find(f=>f.finding_id===match[1]);if(!f)throw Error('Finding not found');
  if(match[2]==='decision'){
   if(options.method!=='POST')throw Error('Decision requires POST');const body=JSON.parse(options.body||'{}');if(!['Confirm','Dismiss','Needs more context'].includes(body.decision)||typeof body.notes!=='string'||body.notes.length>4000)throw Error('Invalid decision');
   const ev=events();ev.push({event_id:ev.length+1,finding_id:f.finding_id,version:s.dataset_version,run_id:s.run_id,timestamp:new Date().toISOString(),decision:body.decision,notes:body.notes});writeEvents(ev);return {saved:true,browser_only:true};
  }
  const r=s.records;const cid=f.case_id;const ids=new Set(f.input_record_ids);
  return {finding:f,cases:r.cases.filter(x=>x.case_id===cid),alerts:r.alerts.filter(x=>ids.has(x.alert_id)),assets:r.assets.filter(x=>x.asset_id===f.asset_id||(!cid&&x.entity_id===f.entity_id)),actions:r.actions.filter(x=>x.case_id===cid),escalations:r.escalations.filter(x=>x.case_id===cid)};
 }
 if(u.pathname==='/audit/export')return {demo_mode:'Precomputed synthetic analysis; decisions stored only in this browser',run_id:s.run_id,dataset_version:s.dataset_version,analysis_timestamp:s.analysis_timestamp,rules:s.rules,model:s.model,findings:s.findings,decisions:s.decision_events};
 throw Error('This operation requires the offline Python application. The website displays precomputed synthetic analysis.');
}
