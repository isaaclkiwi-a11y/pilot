'use client';

import {useEffect,useMemo,useState} from 'react';
import {CheckCircle2,Clock3,DoorOpen,LogOut,ShieldCheck,UserRound} from 'lucide-react';
import {useRouter} from 'next/navigation';
import {createClient} from '@/lib/supabase/client';

type Student={id:string;student_number:string|null;first_name:string;last_name:string;grade_level:string|null;homeroom:string|null};
type Pass={id:string;destination:string;status:string;requested_at:string;approved_at:string|null;expected_duration_minutes:number};
function remaining(pass:Pass,now:number){if(pass.status==='pending')return 'Waiting for staff approval';if(!pass.approved_at)return 'Timer unavailable';const end=new Date(pass.approved_at).getTime()+pass.expected_duration_minutes*60000;const left=end-now;if(left<=0){const n=Math.floor(Math.abs(left)/1000);return 'Overdue +'+Math.floor(n/60)+':'+String(n%60).padStart(2,'0');}const n=Math.floor(left/1000);return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');}
export default function KioskPage(){
 const db=useMemo(()=>createClient(),[]),router=useRouter();
 const [schoolName,setSchoolName]=useState('School kiosk'),[ready,setReady]=useState(false);
 const [studentNumber,setStudentNumber]=useState(''),[student,setStudent]=useState<Student|null>(null),[pass,setPass]=useState<Pass|null>(null);
 const [destination,setDestination]=useState('Restroom'),[duration,setDuration]=useState('5');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[now,setNow]=useState(Date.now());
 useEffect(()=>{async function init(){const {data:{user}}=await db.auth.getUser();if(!user){router.replace('/login');return;}const {data:membership}=await db.from('school_memberships').select('school_id,role').eq('user_id',user.id).eq('status','active').limit(1).maybeSingle();if(!membership||membership.role!=='kiosk'){router.replace('/app');return;}const {data:school}=await db.from('schools').select('name').eq('id',membership.school_id).maybeSingle();setSchoolName(school?.name||'School kiosk');setReady(true);}void init();},[db,router]);
 useEffect(()=>{const id=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(id);},[]);
 async function lookup(e?:React.FormEvent,preserveNotice=false){e?.preventDefault();setBusy(true);setError('');if(!preserveNotice)setNotice('');setStudent(null);setPass(null);const {data,error}=await db.rpc('get_school_kiosk_student',{p_student_number:studentNumber.trim()});if(error)setError(error.message);else if(!data?.found)setError('Student number not found. Check the number and try again.');else{setStudent(data.student as Student);setPass(data.pass as Pass|null);}setBusy(false);}
 async function createPass(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setNotice('');const {data,error}=await db.rpc('start_school_kiosk_pass',{p_student_number:studentNumber.trim(),p_destination:destination,p_duration_minutes:Number(duration)});if(error)setError(error.message);else{await lookup(undefined,true);setNotice('Pass request sent. Wait for staff approval before leaving class.');}setBusy(false);}
 async function endPass(){setBusy(true);setError('');setNotice('');const {data,error}=await db.rpc('end_school_kiosk_pass',{p_student_number:studentNumber.trim()});if(error)setError(error.message);else{setNotice('Pass ended. You are all set.');setPass(null);}setBusy(false);}
 function reset(){setStudent(null);setPass(null);setStudentNumber('');setError('');setNotice('');setDestination('Restroom');setDuration('5');}
 if(!ready)return <main style={page}><div style={panel}>Preparing secure school kiosk…</div></main>;
 return <main style={page}>
  <header style={header}><div style={{display:'flex',alignItems:'center',gap:10}}><span style={logo}>P</span><b style={{fontSize:21,letterSpacing:-.7}}>pilot<span style={{color:'#5269c8'}}>.</span></b><span style={school}>{schoolName}</span></div><button style={signout} onClick={async()=>{await db.auth.signOut();router.replace('/login');}}><LogOut size={15}/> Sign out</button></header>
  <div style={center}>
   <div style={kicker}><ShieldCheck size={15}/> SCHOOL HALL PASS KIOSK</div>
   {!student?<section style={panel}><div style={heroIcon}><UserRound size={28}/></div><h1>Enter your student number</h1><p style={sub}>Use the number printed on your school ID. Your details only appear after the number is verified.</p><form onSubmit={lookup} style={{display:'grid',gap:12}}><input autoFocus inputMode="numeric" autoComplete="off" value={studentNumber} onChange={e=>setStudentNumber(e.target.value)} placeholder="Student number" aria-label="Student number" style={studentInput}/><button disabled={busy||!studentNumber.trim()} style={primary}>{busy?'Checking…':'Continue'}</button></form></section>:<section style={panel}>
    <div style={verified}><CheckCircle2 size={15}/> STUDENT VERIFIED</div><h1 style={{marginTop:10}}>{student.first_name} {student.last_name}</h1><p style={sub}>{[student.grade_level?'Grade '+student.grade_level:null,student.homeroom].filter(Boolean).join(' · ')||'Student'}</p>
    {pass?.status==='active'?<div style={activeBox}><div style={kicker}><DoorOpen size={15}/> ACTIVE HALL PASS</div><b style={{fontSize:21,display:'block',marginTop:10}}>{pass.destination}</b><div style={timer}>{remaining(pass,now)}</div><p style={sub}>End your pass when you return to class.</p><button disabled={busy} onClick={()=>void endPass()} style={primary}>{busy?'Ending…':'End pass'}</button></div>:pass?.status==='pending'?<div style={pendingBox}><Clock3 size={18}/><div><b>Pass request pending</b><p style={sub}>A staff member needs to approve your request. Please wait for them.</p></div></div>:<form onSubmit={createPass} style={{display:'grid',gap:12,marginTop:18,textAlign:'left'}}><label style={field}>Where are you going?<select value={destination} onChange={e=>setDestination(e.target.value)} style={select}>{['Restroom','Water fountain','Main office','Counselor','Nurse','Library','Other'].map(x=><option key={x}>{x}</option>)}</select></label><label style={field}>Pass duration<select value={duration} onChange={e=>setDuration(e.target.value)} style={select}>{['5','10','15','20','30'].map(x=><option key={x} value={x}>{x} minutes</option>)}</select></label><button disabled={busy} style={primary}>{busy?'Creating…':'Create hall pass'}</button></form>}
    <button onClick={reset} style={resetButton}>Done · Return to kiosk</button>
   </section>}
   {error&&<div role="alert" style={errorBox}>{error}</div>}{notice&&<div role="status" style={successBox}>{notice}</div>}
   <p style={foot}><ShieldCheck size={13}/> Preview only: student-number entry is not secure identity verification. Do not use with real student records.</p>
  </div>
 </main>;
}
const page:React.CSSProperties={minHeight:'100vh',background:'#f4f6fb',color:'#26344e',fontFamily:'Inter,ui-sans-serif,system-ui'};
const header:React.CSSProperties={height:64,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 clamp(16px,4vw,44px)',background:'#fff',borderBottom:'1px solid #e7eaf1'};
const logo:React.CSSProperties={width:32,height:32,borderRadius:10,display:'grid',placeItems:'center',background:'#536ac8',color:'#fff',fontWeight:900};
const school:React.CSSProperties={fontSize:11,color:'#7d899e',borderLeft:'1px solid #e5e9f1',paddingLeft:12,marginLeft:5};
const signout:React.CSSProperties={display:'inline-flex',alignItems:'center',gap:7,border:'1px solid #e2e7ef',background:'#fff',color:'#6a768b',borderRadius:8,padding:'8px 10px',fontSize:11,cursor:'pointer'};
const center:React.CSSProperties={maxWidth:520,margin:'0 auto',padding:'48px 16px',display:'grid',gap:13};
const kicker:React.CSSProperties={display:'flex',alignItems:'center',justifyContent:'center',gap:7,fontSize:10,fontWeight:850,letterSpacing:1.1,color:'#667bc9'};
const panel:React.CSSProperties={background:'#fff',border:'1px solid #e7eaf1',borderRadius:17,padding:'28px clamp(18px,5vw,34px)',boxShadow:'0 12px 36px rgba(31,48,83,.06)',textAlign:'center'};
const heroIcon:React.CSSProperties={width:58,height:58,borderRadius:17,background:'#eef1fc',color:'#536ac8',display:'grid',placeItems:'center',margin:'0 auto 16px'};
const sub:React.CSSProperties={fontSize:12,color:'#7c8799',lineHeight:1.6,margin:'7px 0 18px'};
const studentInput:React.CSSProperties={height:56,border:'1px solid #dfe4ee',borderRadius:11,padding:'0 14px',fontSize:19,textAlign:'center',letterSpacing:1,outlineColor:'#9eaff0'};
const select:React.CSSProperties={height:43,border:'1px solid #dfe4ee',borderRadius:9,padding:'0 11px',background:'#fff',fontSize:12,color:'#34425b'};
const primary:React.CSSProperties={height:48,border:0,borderRadius:10,background:'#536ac8',color:'#fff',fontSize:13,fontWeight:850,cursor:'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center',gap:8};
const field:React.CSSProperties={display:'grid',gap:6,fontSize:11,fontWeight:750,color:'#657188'};
const verified:React.CSSProperties={display:'inline-flex',alignItems:'center',gap:6,fontSize:9,fontWeight:850,letterSpacing:.8,color:'#32815a',background:'#eaf7ef',padding:'6px 9px',borderRadius:6};
const activeBox:React.CSSProperties={background:'#f5f7fc',borderRadius:12,padding:16,marginTop:16};
const timer:React.CSSProperties={fontSize:42,fontWeight:900,letterSpacing:-1,fontVariantNumeric:'tabular-nums',color:'#2d3b57',margin:'12px 0'};
const pendingBox:React.CSSProperties={display:'flex',alignItems:'flex-start',gap:11,textAlign:'left',background:'#fff7e8',color:'#98712b',padding:14,borderRadius:10,marginTop:14};
const resetButton:React.CSSProperties={border:0,background:'transparent',color:'#7b879a',fontSize:11,fontWeight:750,padding:12,cursor:'pointer',marginTop:12};
const foot:React.CSSProperties={display:'flex',justifyContent:'center',alignItems:'center',gap:7,color:'#8b96a8',fontSize:10};
const errorBox:React.CSSProperties={background:'#fff0ee',color:'#b64d42',borderRadius:9,padding:11,fontSize:12,textAlign:'center'};
const successBox:React.CSSProperties={background:'#edf8f1',color:'#28734c',borderRadius:9,padding:11,fontSize:12,textAlign:'center'};
