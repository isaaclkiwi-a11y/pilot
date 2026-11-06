'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';
import {createClient} from '@/lib/supabase/client';
import {Activity,AlertCircle,ArrowLeft,CheckCircle2,Clock3,DoorOpen,RefreshCw,Search,ShieldCheck,UserRound} from 'lucide-react';
import Link from 'next/link';

type PassRow={
 pass_id:string;
 student_id:string;
 student_number:string|null;
 student_name:string;
 origin:string|null;
 destination:string;
 reason:string|null;
 status:'pending'|'active'|'returned'|'denied'|'cancelled';
 requested_at:string;
 expected_duration_minutes:number;
 ended_at:string|null;
 end_reason:string|null;
};
const dateTime=(value:string)=>new Date(value).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
const isOverdue=(pass:PassRow)=>pass.status==='active'&&Date.now()>new Date(pass.requested_at).getTime()+pass.expected_duration_minutes*60_000;

export default function SecurityConsole({schoolName,role}:{schoolName:string;role:string}){
 const db=useMemo(()=>createClient(),[]);
 const [passes,setPasses]=useState<PassRow[]>([]);
 const [loading,setLoading]=useState(true);
 const [refreshing,setRefreshing]=useState(false);
 const [busyId,setBusyId]=useState('');
 const [query,setQuery]=useState('');
 const [filter,setFilter]=useState('active');
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');

 const load=useCallback(async()=>{
  setError('');
  const {data,error}=await db.rpc('security_list_school_passes');
  if(error){setError(error.message);setPasses([]);}
  else setPasses((data||[]) as PassRow[]);
  setLoading(false);
  setRefreshing(false);
 },[db]);

 useEffect(()=>{void load();},[load]);

 const active=passes.filter(p=>p.status==='active');
 const overdue=active.filter(isOverdue);
 const visible=passes.filter(p=>{
  const status=isOverdue(p)?'overdue':p.status;
  const matchesStatus=filter==='all'||(filter==='active'&&(p.status==='active'||status==='overdue'))||status===filter;
  const matchesQuery=[p.student_name,p.student_number,p.student_id,p.destination,p.origin,p.reason].join(' ').toLowerCase().includes(query.toLowerCase());
  return matchesStatus&&matchesQuery;
 });

 async function endPass(pass:PassRow){
  const reason=window.prompt('Why is security ending this pass?','Ended by school security');
  if(reason===null)return;
  if(!window.confirm('End '+pass.student_name+'’s pass to '+pass.destination+'?'))return;
  setBusyId(pass.pass_id);setError('');setNotice('');
  const {error}=await db.rpc('security_end_hall_pass',{p_pass_id:pass.pass_id,p_reason:reason.trim()||'Ended by school security'});
  if(error)setError(error.message);
  else{setNotice('Pass ended. The action is recorded in the school audit history.');await load();}
  setBusyId('');
 }

 return <main style={{minHeight:'100vh',background:'#f6f7fb',color:'#172033',padding:'28px 4vw'}}>
  <div style={{maxWidth:1240,margin:'0 auto'}}>
   <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,flexWrap:'wrap',marginBottom:26}}>
    <div>
     <div style={{display:'flex',alignItems:'center',gap:9,color:'#4863c7',fontSize:12,fontWeight:800,letterSpacing:1.2}}><ShieldCheck size={17}/> PILOT · CAMPUS SECURITY</div>
     <h1 style={{fontSize:32,letterSpacing:-1,margin:'8px 0 4px'}}>Pass oversight</h1>
     <p style={{color:'#707b90',margin:0,fontSize:13}}>{schoolName} · School-wide hall pass activity</p>
    </div>
    <div style={{display:'flex',gap:9,alignItems:'center'}}>
     <span style={{border:'1px solid #dce3f3',background:'#fff',borderRadius:30,padding:'8px 12px',fontSize:11,color:'#5267b5',fontWeight:700}}>{role.replaceAll('_',' ')}</span>
     <button onClick={()=>{setRefreshing(true);void load();}} disabled={refreshing} style={{display:'inline-flex',alignItems:'center',gap:7,border:'1px solid #e1e5ed',background:'#fff',borderRadius:9,padding:'9px 12px',color:'#536078',fontWeight:650}}><RefreshCw size={15}/>{refreshing?'Refreshing…':'Refresh'}</button>
    </div>
   </header>
   <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:13,marginBottom:18}}>
    {[
     {label:'Active passes',value:active.length,icon:<DoorOpen size={18}/>},
     {label:'Overdue passes',value:overdue.length,icon:<AlertCircle size={18}/>},
     {label:'Pending requests',value:passes.filter(p=>p.status==='pending').length,icon:<Clock3 size={18}/>},
     {label:'Returned passes',value:passes.filter(p=>p.status==='returned').length,icon:<CheckCircle2 size={18}/>}
    ].map(card=><div key={card.label} style={{background:'#fff',border:'1px solid #e6e9f0',borderRadius:13,padding:17}}>
     <div style={{display:'flex',justifyContent:'space-between',color:'#7b879a',fontSize:12}}>{card.label}<span style={{color:'#536bc8'}}>{card.icon}</span></div>
     <strong style={{display:'block',fontSize:28,marginTop:9}}>{card.value}</strong>
    </div>)}
   </section>
   <section style={{background:'#fff',border:'1px solid #e6e9f0',borderRadius:14,padding:18}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap',marginBottom:15}}>
     <div><h2 style={{fontSize:17,margin:'0 0 4px'}}>School pass monitor</h2><p style={{fontSize:12,color:'#818b9c',margin:0}}>View passes across the entire school. Ending a pass is recorded for accountability.</p></div>
     <span style={{fontSize:11,color:'#8993a4'}}>{visible.length} shown</span>
    </div>
    <div style={{display:'flex',gap:9,flexWrap:'wrap',marginBottom:14}}>
     <div style={{display:'flex',alignItems:'center',gap:8,border:'1px solid #e3e7ef',borderRadius:9,padding:'0 10px',flex:'1 1 230px',minHeight:39,color:'#98a1b0'}}><Search size={15}/><input aria-label="Search passes" placeholder="Search student, destination, reason…" value={query} onChange={e=>setQuery(e.target.value)} style={{border:0,outline:0,width:'100%',color:'#26334b'}}/></div>
     <select aria-label="Filter pass status" value={filter} onChange={e=>setFilter(e.target.value)} style={{border:'1px solid #e3e7ef',borderRadius:9,padding:'0 11px',minHeight:39,background:'#fff',color:'#526078'}}>
      <option value="active">Active + overdue</option><option value="pending">Pending</option><option value="returned">Ended / returned</option><option value="denied">Denied</option><option value="cancelled">Cancelled</option><option value="all">All statuses</option>
     </select>
    </div>
    {error&&<div role="alert" style={{background:'#fff2f1',color:'#ad3931',border:'1px solid #f0d1ce',borderRadius:9,padding:12,marginBottom:12}}>{error}</div>}
    {notice&&<div role="status" style={{background:'#eef8f2',color:'#28734c',border:'1px solid #d6eddf',borderRadius:9,padding:12,marginBottom:12}}>{notice}</div>}
    {loading?<div style={{padding:35,textAlign:'center',color:'#8993a4'}}>Loading school passes…</div>:visible.length===0?<div style={{padding:38,textAlign:'center',color:'#8993a4'}}><Activity size={22}/><p>No passes match this view.</p></div>:
     <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',textAlign:'left',minWidth:780}}>
      <thead><tr>{['STUDENT','FROM','DESTINATION','REQUESTED','STATUS','ACTION'].map(x=><th key={x} style={{padding:'11px 9px',fontSize:10,letterSpacing:.7,color:'#8993a4',borderBottom:'1px solid #edf0f4'}}>{x}</th>)}</tr></thead>
      <tbody>{visible.map(p=><tr key={p.pass_id}>
       <td style={{padding:'13px 9px',borderBottom:'1px solid #f0f2f6'}}><strong style={{display:'block',fontSize:12}}>{p.student_name}</strong><small style={{color:'#8b95a5'}}>{p.student_number||p.student_id}</small></td>
       <td style={{padding:'13px 9px',fontSize:12,color:'#657188',borderBottom:'1px solid #f0f2f6'}}>{p.origin||'Not listed'}</td>
       <td style={{padding:'13px 9px',fontSize:12,color:'#33415b',borderBottom:'1px solid #f0f2f6'}}><strong>{p.destination}</strong><small style={{display:'block',color:'#8b95a5',marginTop:3}}>{p.reason||'No reason provided'}</small></td>
       <td style={{padding:'13px 9px',fontSize:11,color:'#657188',borderBottom:'1px solid #f0f2f6'}}>{dateTime(p.requested_at)}</td>
       <td style={{padding:'13px 9px',borderBottom:'1px solid #f0f2f6'}}><span style={{display:'inline-flex',padding:'5px 8px',borderRadius:6,fontSize:10,fontWeight:700,background:isOverdue(p)?'#fff0ed':p.status==='active'?'#edf8f1':'#f1f3f7',color:isOverdue(p)?'#c15d4e':p.status==='active'?'#3b9467':'#6f7a8e'}}>{isOverdue(p)?'Overdue':p.status}</span></td>
       <td style={{padding:'13px 9px',borderBottom:'1px solid #f0f2f6'}}>{p.status==='active'?<button onClick={()=>void endPass(p)} disabled={busyId===p.pass_id} style={{border:0,borderRadius:7,padding:'7px 10px',background:'#fff0ee',color:'#b64d42',fontSize:11,fontWeight:700,opacity:busyId===p.pass_id ? 0.5 : 1}}>{busyId===p.pass_id?'Ending…':'End pass'}</button>:<span style={{color:'#a0a8b5',fontSize:10}}>No action</span>}</td>
      </tr>)}</tbody>
     </table></div>}
   </section>
   <footer style={{display:'flex',alignItems:'center',gap:7,color:'#8a94a5',fontSize:11,marginTop:16}}><UserRound size={14}/> Security access is limited to school-wide pass oversight. Student records and administrative settings remain restricted.</footer>
   <div style={{marginTop:16}}><Link href="/login" style={{color:'#65718a',fontSize:12,textDecoration:'none'}}><ArrowLeft size={14} style={{verticalAlign:'middle',marginRight:6}}/> Sign in with another account</Link></div>
  </div>
 </main>;
}
