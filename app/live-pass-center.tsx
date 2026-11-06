'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';
import {createClient} from '@/lib/supabase/client';
import {AlertCircle,Check,Clock3,DoorOpen,Plus,RefreshCw,Search,X} from 'lucide-react';

type PassStatus='pending'|'active'|'overdue'|'returned'|'denied'|'cancelled';
type PassRow={
 pass_id:string;school_id:string;student_id:string;student_number:string|null;student_name:string;
 origin:string|null;destination:string;reason:string|null;status:string;display_status:PassStatus;
 requested_at:string;approved_at:string|null;expires_at:string|null;expected_duration_minutes:number;
 returned_at:string|null;ended_at:string|null;end_reason:string|null;server_now:string;
};
type StudentRow={student_id:string;student_number:string|null;first_name:string;last_name:string;grade_level:string|null;homeroom:string|null};
const fmtDate=(value:string)=>new Date(value).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
function timer(pass:PassRow,now:number){
 if(pass.display_status==='pending')return 'Waiting for approval';
 if(pass.display_status==='returned'||pass.display_status==='denied'||pass.display_status==='cancelled')return '—';
 if(!pass.expires_at)return 'Timer unavailable';
 const left=new Date(pass.expires_at).getTime()-now;
 if(left<=0){const elapsed=Math.floor(Math.abs(left)/1000);const mins=Math.floor(elapsed/60),secs=elapsed%60;return `Overdue +${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;}
 const secs=Math.floor(left/1000),hours=Math.floor(secs/3600),mins=Math.floor((secs%3600)/60),remain=secs%60;
 return hours>0?`${hours}:${String(mins).padStart(2,'0')}:${String(remain).padStart(2,'0')}`:`${String(mins).padStart(2,'0')}:${String(remain).padStart(2,'0')}`;
}
export default function LivePassCenter(){
 const db=useMemo(()=>createClient(),[]);
 const [passes,setPasses]=useState<PassRow[]>([]);
 const [students,setStudents]=useState<StudentRow[]>([]);
 const [role,setRole]=useState('');
 const [schoolId,setSchoolId]=useState('');
 const [serverOffset,setServerOffset]=useState(0);
 const [now,setNow]=useState(Date.now());
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState('');
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [query,setQuery]=useState('');
 const [filter,setFilter]=useState('active');
 const [showCreate,setShowCreate]=useState(false);
 const [studentId,setStudentId]=useState('');
 const [origin,setOrigin]=useState('');
 const [destination,setDestination]=useState('Restroom');
 const [reason,setReason]=useState('Restroom');
 const [duration,setDuration]=useState('10');

 const load=useCallback(async()=>{
  setError('');
  const requestStarted=Date.now();
  const {data:{user},error:userError}=await db.auth.getUser();
  if(userError||!user){setError('Your session could not be verified. Please sign in again.');setLoading(false);return;}
  const [monitor,time,members,studentList]=await Promise.all([
   db.rpc('get_school_hall_pass_monitor'),
   db.rpc('get_pilot_server_time'),
   db.from('school_memberships').select('school_id,role').eq('user_id',user.id).eq('status','active').limit(1).maybeSingle(),
   db.rpc('get_school_pass_students')
  ]);
  if(members.error||!members.data){setError(members.error?.message||'No active school membership was found.');setLoading(false);return;}
  setSchoolId(members.data.school_id);setRole(members.data.role);
  if(time.data)setServerOffset(new Date(time.data).getTime()-((requestStarted+Date.now())/2));
  if(monitor.error){setError(monitor.error.message);setPasses([]);}
  else setPasses((monitor.data||[]) as PassRow[]);
  if(studentList.error){setError(studentList.error.message);}
  else setStudents((studentList.data||[]) as StudentRow[]);
  setLoading(false);
 },[db]);

 useEffect(()=>{void load();},[load]);
 useEffect(()=>{const id=window.setInterval(()=>setNow(Date.now()),250);return()=>window.clearInterval(id);},[]);
 useEffect(()=>{
  if(!schoolId)return;
  const channel=db.channel('pilot-hall-pass-live-'+schoolId)
   .on('postgres_changes',{event:'*',schema:'public',table:'hall_passes',filter:'school_id=eq.'+schoolId},()=>{void load();})
   .subscribe();
  const fallback=window.setInterval(()=>{void load();},30000);
  return()=>{void window.clearInterval(fallback);void db.removeChannel(channel);};
 },[db,schoolId,load]);

 const serverNow=now+serverOffset;
 const rows=useMemo(()=>passes.map(p=>{
  const expired=p.status==='active'&&!!p.expires_at&&new Date(p.expires_at).getTime()<=serverNow;
  return {...p,display_status:expired?'overdue' as const:p.status as PassStatus};
 }).filter(p=>{
  const matches=filter==='all'||(filter==='active'&&(p.display_status==='active'||p.display_status==='overdue'))||p.display_status===filter;
  return matches&&[p.student_name,p.student_number,p.destination,p.origin,p.reason].join(' ').toLowerCase().includes(query.toLowerCase());
 }),[passes,filter,query,serverNow]);
 const counts={
  active:passes.filter(p=>p.status==='active'&&p.expires_at&&new Date(p.expires_at).getTime()>serverNow).length,
  overdue:passes.filter(p=>p.status==='active'&&p.expires_at&&new Date(p.expires_at).getTime()<=serverNow).length,
  pending:passes.filter(p=>p.status==='pending').length
 };
 async function createPass(e:React.FormEvent){
  e.preventDefault();setBusy('create');setError('');setNotice('');
  const {error}=await db.rpc('request_school_hall_pass',{p_student_id:studentId,p_origin:origin,p_destination:destination,p_reason:reason,p_duration_minutes:Number(duration)});
  if(error)setError(error.message);
  else{setNotice('Pass request saved to the shared school system.');setShowCreate(false);setStudentId('');setOrigin('');setDestination('Restroom');setReason('Restroom');await load();}
  setBusy('');
 }
 async function setStatus(pass:PassRow,status:'active'|'denied'|'returned'){
  setBusy(pass.pass_id);setError('');setNotice('');
  const update=status==='returned'?{status,returned_at:new Date().toISOString(),ended_at:new Date().toISOString(),ended_by:userId,end_reason:'Ended by staff'}:{status};
  const {error}=await db.from('hall_passes').update(update).eq('id',pass.pass_id);
  if(error)setError(error.message);
  else{setNotice(status==='active'?'Pass approved. Its shared countdown has started.':status==='returned'?'Pass ended.':'Pass denied.');await load();}
  setBusy('');
 }
 const canRequest=role!=='security'&&students.length>0;
 const canManage=['owner','school_admin','staff_admin','teacher','staff','substitute'].includes(role);
 return <section style={{background:'#fff',border:'1px solid #e5e9f1',borderRadius:16,padding:20,boxShadow:'0 8px 28px rgba(25,40,75,.04)'}}>
  <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:14,flexWrap:'wrap',marginBottom:18}}>
   <div><div style={{display:'flex',alignItems:'center',gap:8,color:'#5369c5',fontSize:11,fontWeight:800,letterSpacing:1}}><DoorOpen size={16}/> LIVE SCHOOL SYSTEM</div><h2 style={{fontSize:21,margin:'7px 0 4px'}}>Hall pass monitor</h2><p style={{fontSize:12,color:'#7b879a',margin:0}}>Shared across authorized accounts · countdown starts when a pass is approved</p></div>
   <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button onClick={()=>void load()} style={buttonStyle('secondary')}><RefreshCw size={14}/> Refresh</button>{canRequest&&<button onClick={()=>setShowCreate(v=>!v)} style={buttonStyle('primary')}><Plus size={15}/> New pass</button>}</div>
  </header>
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10,marginBottom:16}}>
   <Metric label="Active" value={counts.active}/><Metric label="Overdue" value={counts.overdue}/><Metric label="Pending" value={counts.pending}/>
  </div>
  {showCreate&&<form onSubmit={createPass} style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:11,padding:14,background:'#f7f8fc',borderRadius:12,marginBottom:16}}>
   <label style={fieldStyle}>Student<select required value={studentId} onChange={e=>setStudentId(e.target.value)} style={inputStyle}><option value="">Select student</option>{students.map(s=><option key={s.student_id} value={s.student_id}>{s.first_name} {s.last_name}{s.student_number?' · '+s.student_number:''}</option>)}</select></label>
   <label style={fieldStyle}>From<input value={origin} onChange={e=>setOrigin(e.target.value)} placeholder="Room or class" style={inputStyle}/></label>
   <label style={fieldStyle}>Destination<select value={destination} onChange={e=>setDestination(e.target.value)} style={inputStyle}>{['Restroom','Main Office','Counseling','Nurse','Library','Other'].map(x=><option key={x}>{x}</option>)}</select></label>
   <label style={fieldStyle}>Reason<input required value={reason} onChange={e=>setReason(e.target.value)} style={inputStyle}/></label>
   <label style={fieldStyle}>Time limit<select value={duration} onChange={e=>setDuration(e.target.value)} style={inputStyle}>{['5','10','15','20','30','45','60'].map(x=><option key={x} value={x}>{x} minutes</option>)}</select></label>
   <div style={{display:'flex',alignItems:'end',gap:8}}><button disabled={busy==='create'||!studentId} style={buttonStyle('primary')}>{busy==='create'?'Saving…':'Submit request'}</button><button type="button" onClick={()=>setShowCreate(false)} style={buttonStyle('secondary')}>Cancel</button></div>
  </form>}
  <div style={{display:'flex',gap:9,flexWrap:'wrap',marginBottom:14}}>
   <input aria-label="Search hall passes" placeholder="Search student or destination…" value={query} onChange={e=>setQuery(e.target.value)} style={{...inputStyle,flex:'1 1 230px'}}/>
   <select aria-label="Filter hall passes" value={filter} onChange={e=>setFilter(e.target.value)} style={{...inputStyle,width:'auto'}}><option value="active">Active + overdue</option><option value="pending">Pending</option><option value="returned">Ended</option><option value="denied">Denied</option><option value="cancelled">Cancelled</option><option value="all">All passes</option></select>
  </div>
  {error&&<div role="alert" style={{padding:11,borderRadius:9,background:'#fff1f0',color:'#ad3931',fontSize:12,marginBottom:12}}>{error}</div>}
  {notice&&<div role="status" style={{padding:11,borderRadius:9,background:'#eff8f2',color:'#28734c',fontSize:12,marginBottom:12}}>{notice}</div>}
  {loading?<div style={{padding:35,textAlign:'center',color:'#8490a2'}}>Loading shared passes…</div>:rows.length===0?<div style={{padding:35,textAlign:'center',color:'#8490a2'}}>No passes in this view.</div>:
   <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:820,textAlign:'left'}}><thead><tr>{['STUDENT','FROM','DESTINATION','REQUESTED','COUNTDOWN','STATUS','ACTIONS'].map(x=><th key={x} style={thStyle}>{x}</th>)}</tr></thead><tbody>{rows.map(p=><tr key={p.pass_id}>
    <td style={tdStyle}><b>{p.student_name}</b><small style={smallStyle}>{p.student_number||p.student_id}</small></td>
    <td style={tdStyle}>{p.origin||'—'}</td><td style={tdStyle}><b>{p.destination}</b><small style={smallStyle}>{p.reason||'No reason entered'}</small></td>
    <td style={tdStyle}>{fmtDate(p.requested_at)}</td>
    <td style={{...tdStyle,fontVariantNumeric:'tabular-nums',fontWeight:800,color:p.display_status==='overdue'?'#c04e42':p.status==='active'?'#327c58':'#69758a'}}>{timer(p,serverNow)}</td>
    <td style={tdStyle}><span style={statusStyle(p.display_status)}>{p.display_status==='returned'?'ENDED':p.display_status.toUpperCase()}</span></td>
    <td style={tdStyle}><div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{canManage&&p.status==='pending'&&<><button disabled={!!busy} onClick={()=>void setStatus(p,'active')} style={buttonStyle('good')}><Check size={13}/> Approve</button><button disabled={!!busy} onClick={()=>void setStatus(p,'denied')} style={buttonStyle('danger')}><X size={13}/> Deny</button></>}{canManage&&p.status==='active'&&<button disabled={!!busy} onClick={()=>void setStatus(p,'returned')} style={buttonStyle('secondary')}>End pass</button>}</div></td>
   </tr>)}</tbody></table></div>}
  <p style={{display:'flex',alignItems:'center',gap:7,fontSize:11,color:'#8490a2',margin:'14px 0 0'}}><Clock3 size={14}/> Countdown is synchronized to the database clock. Changes from other accounts appear through live updates.</p>
 </section>;
}
function Metric({label,value}:{label:string;value:number}){return <div style={{border:'1px solid #e8ebf2',borderRadius:11,padding:13}}><small style={{color:'#7e899b'}}>{label}</small><b style={{display:'block',fontSize:25,marginTop:5,fontVariantNumeric:'tabular-nums'}}>{value}</b></div>}
const fieldStyle:React.CSSProperties={display:'flex',flexDirection:'column',gap:6,fontSize:11,fontWeight:700,color:'#657188'};
const inputStyle:React.CSSProperties={border:'1px solid #dfe4ee',borderRadius:8,padding:'10px 11px',background:'#fff',color:'#26334b',minHeight:39,fontSize:12};
const thStyle:React.CSSProperties={padding:'10px 9px',fontSize:10,letterSpacing:.6,color:'#8a94a5',borderBottom:'1px solid #edf0f4',whiteSpace:'nowrap'};
const tdStyle:React.CSSProperties={padding:'12px 9px',fontSize:12,color:'#536078',borderBottom:'1px solid #f0f2f6',verticalAlign:'middle'};
const smallStyle:React.CSSProperties={display:'block',fontSize:10,color:'#929cad',marginTop:3};
const buttonStyle=(kind:'primary'|'secondary'|'good'|'danger'):React.CSSProperties=>({display:'inline-flex',alignItems:'center',justifyContent:'center',gap:6,border:kind==='primary'?'1px solid #5269c9':'1px solid #e1e6ef',borderRadius:8,padding:'9px 11px',fontSize:11,fontWeight:750,cursor:'pointer',background:kind==='primary'?'#5269c9':kind==='good'?'#edf8f1':kind==='danger'?'#fff0ee':'#fff',color:kind==='primary'?'#fff':kind==='good'?'#28734c':kind==='danger'?'#b64d42':'#5e6a80'});
const statusStyle=(s:string):React.CSSProperties=>({display:'inline-flex',borderRadius:6,padding:'5px 7px',fontSize:9,fontWeight:800,letterSpacing:.4,background:s==='overdue'?'#fff0ed':s==='active'?'#edf8f1':s==='pending'?'#fff7e8':'#f1f3f7',color:s==='overdue'?'#bd4d42':s==='active'?'#327c58':s==='pending'?'#a77a26':'#6f7a8e'});
