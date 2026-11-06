'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';
import {BookOpen,CalendarDays,Clock3,DoorOpen,GraduationCap,IdCard,LogOut,RefreshCw,ShieldCheck} from 'lucide-react';
import {useRouter} from 'next/navigation';
import {createClient} from '@/lib/supabase/client';

type Student={id:string;first_name:string;last_name:string;student_number:string|null;grade_level:string|null;homeroom:string|null};
type ClassRow={id:string;name:string;room:string|null};
type Period={id:string;schedule_id:string;name:string;period_order:number;starts_at:string;ends_at:string;period_type:string};
type Meeting={id:string;class_id:string;period_id:string;day_of_week:number;starts_on:string|null;ends_on:string|null};
type Pass={pass_id:string;destination:string;reason:string|null;status:string;display_status:string;requested_at:string;expires_at:string|null;expected_duration_minutes:number};
type Announcement={id:string;title:string;body:string;created_at:string};
type Attendance={id:string;attendance_date:string;status:string};
type Schedule={id:string;is_default:boolean;status:string;days_of_week:number[];effective_from:string|null;effective_to:string|null};
const weekdays:Record<string,number>={Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:7};
function schoolTime(timezone:string){const parts=new Intl.DateTimeFormat('en-US',{timeZone:timezone,weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());const get=(k:string)=>parts.find(p=>p.type===k)?.value||'0';return {day:weekdays[get('weekday')]||1,minute:Number(get('hour'))*60+Number(get('minute')),date:new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())};}
const mins=(t:string)=>{const [h,m]=t.split(':').map(Number);return h*60+m;};
const showTime=(t:string)=>new Date('2000-01-01T'+t).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
function countdown(pass:Pass,now:number){if(!pass.expires_at)return pass.status==='pending'?'Awaiting teacher approval':'—';const left=new Date(pass.expires_at).getTime()-now;if(left<=0){const n=Math.floor(Math.abs(left)/1000);return 'Overdue +'+Math.floor(n/60)+':'+String(n%60).padStart(2,'0');}const n=Math.floor(left/1000);return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');}

export default function StudentPortal(){
 const db=useMemo(()=>createClient(),[]),router=useRouter();
 const [student,setStudent]=useState<Student|null>(null),[schoolName,setSchoolName]=useState(''),[timezone,setTimezone]=useState('America/Chicago');
 const [classes,setClasses]=useState<ClassRow[]>([]),[periods,setPeriods]=useState<Period[]>([]),[meetings,setMeetings]=useState<Meeting[]>([]),[schedules,setSchedules]=useState<Schedule[]>([]);
 const [passes,setPasses]=useState<Pass[]>([]),[announcements,setAnnouncements]=useState<Announcement[]>([]),[attendance,setAttendance]=useState<Attendance[]>([]);
 const [now,setNow]=useState(Date.now()),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [destination,setDestination]=useState('Restroom'),[reason,setReason]=useState('Restroom'),[duration,setDuration]=useState('10'),[showRequest,setShowRequest]=useState(false);
 const load=useCallback(async()=>{
  setError('');
  const {data:{user},error:userError}=await db.auth.getUser();
  if(userError||!user){setError('Your sign-in session could not be verified.');setLoading(false);return;}
  const {data:membership,error:membershipError}=await db.from('school_memberships').select('school_id,role').eq('user_id',user.id).eq('status','active').limit(1).maybeSingle();
  if(membershipError||!membership||membership.role!=='student'){setError('This account does not have student portal access.');setLoading(false);return;}
  const schoolId=membership.school_id;
  const [studentR,schoolR,classR,periodR,meetingR,scheduleR,passR,announceR,attendanceR]=await Promise.all([
   db.from('students').select('id,first_name,last_name,student_number,grade_level,homeroom').eq('school_id',schoolId).eq('auth_user_id',user.id).maybeSingle(),
   db.from('schools').select('name,timezone').eq('id',schoolId).maybeSingle(),
   db.from('school_classes').select('id,name,room').eq('school_id',schoolId).eq('status','active'),
   db.from('school_periods').select('id,schedule_id,name,period_order,starts_at,ends_at,period_type').eq('school_id',schoolId).order('period_order'),
   db.from('school_class_meetings').select('id,class_id,period_id,day_of_week,starts_on,ends_on').eq('school_id',schoolId),
   db.from('school_bell_schedules').select('id,is_default,status,days_of_week,effective_from,effective_to').eq('school_id',schoolId).eq('status','active'),
   db.rpc('get_school_hall_pass_monitor'),
   db.from('school_announcements').select('id,title,body,created_at').eq('school_id',schoolId).eq('status','published').order('created_at',{ascending:false}).limit(10),
   db.from('attendance_records').select('id,attendance_date,status').eq('school_id',schoolId).order('attendance_date',{ascending:false}).limit(30)
  ]);
  const failed=[studentR,schoolR,classR,periodR,meetingR,scheduleR,passR,announceR,attendanceR].find(x=>x.error);
  if(failed?.error){setError(failed.error.message);setLoading(false);return;}
  if(!studentR.data){setError('Your student profile is not linked to this account yet. Please contact your school office.');setLoading(false);return;}
  setStudent(studentR.data);setSchoolName(schoolR.data?.name||'Your school');setTimezone(schoolR.data?.timezone||'America/Chicago');
  setClasses(classR.data||[]);setPeriods(periodR.data||[]);setMeetings(meetingR.data||[]);setSchedules(scheduleR.data||[]);
  setPasses((passR.data||[]) as Pass[]);setAnnouncements(announceR.data||[]);setAttendance(attendanceR.data||[]);
  setLoading(false);
 },[db]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{const id=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(id);},[]);
 const clock=schoolTime(timezone);
 const activeSchedule=schedules.find(s=>s.is_default&&s.days_of_week.includes(clock.day)&&(!s.effective_from||s.effective_from<=clock.date)&&(!s.effective_to||s.effective_to>=clock.date));
 const todayMeetings=meetings.filter(m=>m.day_of_week===clock.day&&(!m.starts_on||m.starts_on<=clock.date)&&(!m.ends_on||m.ends_on>=clock.date));
 const todaysPeriods=periods.filter(p=>p.schedule_id===activeSchedule?.id).map(p=>({...p,classInfo:classes.find(c=>c.id===todayMeetings.find(m=>m.period_id===p.id)?.class_id)}));
 const current=todaysPeriods.find(p=>mins(p.starts_at)<=clock.minute&&mins(p.ends_at)>clock.minute);
 const activePass=passes.find(p=>p.status==='pending'||p.status==='active'||p.display_status==='overdue');
 const requestPass=async(e:React.FormEvent)=>{e.preventDefault();if(!student)return;setBusy(true);setError('');setNotice('');const {error}=await db.rpc('request_school_hall_pass',{p_student_id:student.id,p_origin:student.homeroom||null,p_destination:destination,p_reason:reason,p_duration_minutes:Number(duration)});if(error)setError(error.message);else{setNotice('Your pass request was sent to your school. Wait for approval before leaving class.');setShowRequest(false);await load();}setBusy(false);};
 if(loading)return <main style={page}><div style={card}>Loading your student portal…</div></main>;
 if(!student)return <main style={page}><div style={card}><h1>Student portal unavailable</h1><p>{error||'Your student profile is not connected yet.'}</p><button style={primary} onClick={()=>router.push('/login')}>Back to sign in</button></div></main>;
 return <main style={page}>
  <header style={top}><div style={{display:'flex',alignItems:'center',gap:10}}><span style={brandMark}>P</span><b style={{fontSize:20,letterSpacing:-.7}}>pilot<span style={{color:'#536ac8'}}>.</span></b><span style={schoolTag}>{schoolName}</span></div><div style={{display:'flex',gap:8,alignItems:'center'}}><button style={iconButton} onClick={()=>void load()} aria-label="Refresh portal"><RefreshCw size={16}/></button><button style={iconButton} onClick={async()=>{await db.auth.signOut();router.replace('/login');}} aria-label="Sign out"><LogOut size={16}/></button></div></header>
  <div style={wrap}>
   <div style={welcome}><div><span style={eyebrow}>STUDENT HOME</span><h1>Hey, {student.first_name}.</h1><p>{new Date(clock.date+'T12:00:00').toLocaleDateString([],{weekday:'long',month:'long',day:'numeric'})} · Your school day at a glance.</p></div><div style={dayBadge}><Clock3 size={15}/><b>{new Intl.DateTimeFormat([],{timeZone:timezone,hour:'numeric',minute:'2-digit'}).format(new Date())}</b></div></div>
   {error&&<p role="alert" style={errorBox}>{error}</p>}{notice&&<p role="status" style={successBox}>{notice}</p>}
   <div className="student-grid" style={grid}>
    <section style={{...card,gridColumn:'span 2'}}>
     <div style={sectionTop}><div><span style={eyebrow}>YOUR DAY</span><h2>Current class</h2></div><CalendarDays size={19} color="#6479ca"/></div>
     {current?.classInfo?<><b style={{fontSize:22,color:'#26344e'}}>{current.classInfo.name}</b><p style={muted}>{[current.classInfo.room,current.name,showTime(current.starts_at)+' – '+showTime(current.ends_at)].filter(Boolean).join(' · ')}</p></>:<p style={muted}>{current?current.name+' · No class assigned for this period.':'You are between scheduled periods.'}</p>}
     <div style={scheduleList}>{todaysPeriods.map(p=><div key={p.id} style={{...periodRow,background:p.id===current?.id?'#f1f4ff':'transparent'}}><span><b>{p.name}</b><small>{p.classInfo?.name||p.period_type}</small></span><span>{showTime(p.starts_at)} – {showTime(p.ends_at)}</span></div>)}</div>
    </section>
    <section style={idCard}><div style={idTop}><IdCard size={17}/> DIGITAL STUDENT ID</div><div style={{fontSize:23,fontWeight:850,marginTop:24}}>{student.first_name} {student.last_name}</div><p style={{margin:'5px 0',opacity:.8,fontSize:12}}>{student.grade_level||'Student'} · {schoolName}</p><div style={idBottom}><span>STUDENT NUMBER</span><b>{student.student_number||'Not assigned'}</b></div><small style={{opacity:.7,display:'block',marginTop:12}}>Show this card to authorized school staff.</small></section>
    <section style={card}><div style={sectionTop}><div><span style={eyebrow}>HALL PASSES</span><h2>Your passes</h2></div><DoorOpen size={19} color="#6479ca"/></div>{activePass?<><b style={{fontSize:18}}>{activePass.destination}</b><p style={muted}>{activePass.status==='pending'?'Waiting for approval':countdown(activePass,now)}</p><span style={tagActive}>{activePass.display_status||activePass.status}</span></>:<p style={muted}>You don't have an active pass.</p>}<button disabled={!!activePass} style={primary} onClick={()=>setShowRequest(v=>!v)}><DoorOpen size={15}/> Request a hall pass</button>{showRequest&&<form onSubmit={requestPass} style={requestForm}><label style={field}>Destination<select value={destination} onChange={e=>setDestination(e.target.value)}>{['Restroom','Water fountain','Main office','Counselor','Nurse','Library','Other'].map(x=><option key={x}>{x}</option>)}</select></label><label style={field}>Reason<input required value={reason} onChange={e=>setReason(e.target.value)}/></label><label style={field}>Duration<select value={duration} onChange={e=>setDuration(e.target.value)}>{['5','10','15','20','30'].map(x=><option key={x}>{x}</option>)}</select></label><div style={{display:'flex',gap:8}}><button disabled={busy} style={primary}>{busy?'Sending…':'Send request'}</button><button type="button" style={secondary} onClick={()=>setShowRequest(false)}>Cancel</button></div></form>}</section>
    <section style={card}><div style={sectionTop}><div><span style={eyebrow}>ATTENDANCE</span><h2>Your record</h2></div><GraduationCap size={19} color="#6479ca"/></div><div style={{display:'flex',gap:9,flexWrap:'wrap'}}>{['present','tardy','absent','excused'].map(s=><div key={s} style={attendanceTile}><b>{attendance.filter(a=>a.status===s).length}</b><small>{s}</small></div>)}</div><p style={muted}>Recent attendance entries</p>{attendance.slice(0,5).map(a=><div key={a.id} style={simpleRow}><span>{new Date(a.attendance_date+'T12:00:00').toLocaleDateString([],{month:'short',day:'numeric'})}</span><b>{a.status}</b></div>)}</section>
    <section style={{...card,gridColumn:'span 2'}}><div style={sectionTop}><div><span style={eyebrow}>SCHOOL UPDATES</span><h2>Announcements</h2></div><BookOpen size={19} color="#6479ca"/></div>{announcements.length?announcements.map(a=><article key={a.id} style={announcement}><b>{a.title}</b><p>{a.body}</p><small>{new Date(a.created_at).toLocaleDateString()}</small></article>):<p style={muted}>No new announcements.</p>}</section>
   </div>
   <footer style={footer}><ShieldCheck size={14}/> Your student information is only visible to accounts with school-authorized access.</footer>
  </div>
 </main>;
}

const page:React.CSSProperties={minHeight:'100vh',background:'#f5f7fb',color:'#26344e',fontFamily:'Inter,ui-sans-serif,system-ui'};
const top:React.CSSProperties={height:64,background:'#fff',borderBottom:'1px solid #e8ebf2',display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0 clamp(16px,4vw,44px)'};
const brandMark:React.CSSProperties={width:32,height:32,borderRadius:10,background:'#536ac8',color:'#fff',display:'grid',placeItems:'center',fontWeight:900};
const schoolTag:React.CSSProperties={fontSize:11,color:'#7d899e',borderLeft:'1px solid #e6eaf1',paddingLeft:12,marginLeft:5};
const wrap:React.CSSProperties={maxWidth:1180,margin:'0 auto',padding:'28px 18px 40px'};
const welcome:React.CSSProperties={display:'flex',justifyContent:'space-between',alignItems:'center',gap:15,marginBottom:20};
const eyebrow:React.CSSProperties={fontSize:10,fontWeight:850,letterSpacing:1.2,color:'#8290a8'};
const dayBadge:React.CSSProperties={display:'flex',alignItems:'center',gap:8,background:'#fff',border:'1px solid #e7eaf1',borderRadius:10,padding:'10px 13px',fontSize:12};
const grid:React.CSSProperties={display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:14};
const card:React.CSSProperties={background:'#fff',border:'1px solid #e7eaf1',borderRadius:15,padding:19,boxShadow:'0 8px 26px rgba(30,45,75,.035)',minWidth:0};
const idCard:React.CSSProperties={...card,background:'linear-gradient(135deg,#536ac8,#384b9b)',color:'#fff',border:0};
const idTop:React.CSSProperties={display:'flex',alignItems:'center',gap:8,fontSize:10,fontWeight:850,letterSpacing:1};
const idBottom:React.CSSProperties={display:'grid',gap:4,marginTop:22,paddingTop:13,borderTop:'1px solid #ffffff40'};
const sectionTop:React.CSSProperties={display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:13};
const headingStyle:React.CSSProperties={fontSize:17,margin:'4px 0 0'};
const title:React.CSSProperties={fontSize:17,margin:'4px 0 0'};
const muted:React.CSSProperties={fontSize:12,color:'#7d899e',lineHeight:1.55,margin:'7px 0 12px'};
const scheduleList:React.CSSProperties={marginTop:14,borderTop:'1px solid #edf0f5'};
const periodRow:React.CSSProperties={display:'flex',justifyContent:'space-between',gap:12,padding:'9px 8px',borderBottom:'1px solid #f0f2f6',fontSize:11,color:'#69768c',borderRadius:7};
const periodTitle:React.CSSProperties={fontWeight:750};
const periodSub:React.CSSProperties={display:'block',fontSize:10,color:'#929cad',marginTop:3};
const iconButton:React.CSSProperties={width:34,height:34,border:'1px solid #e5e9f1',borderRadius:9,background:'#fff',color:'#66738b',display:'grid',placeItems:'center',cursor:'pointer'};
const primary:React.CSSProperties={display:'inline-flex',alignItems:'center',justifyContent:'center',gap:7,border:0,borderRadius:9,padding:'10px 13px',background:'#536ac8',color:'#fff',fontSize:11,fontWeight:800,cursor:'pointer'};
const secondary:React.CSSProperties={...primary,background:'#fff',border:'1px solid #e1e6ef',color:'#637089'};
const field:React.CSSProperties={display:'grid',gap:5,fontSize:11,fontWeight:700,color:'#647188'};
const requestForm:React.CSSProperties={display:'grid',gap:10,padding:12,background:'#f7f8fc',borderRadius:10,marginTop:12};
const tagActive:React.CSSProperties={display:'inline-flex',background:'#edf8f1',color:'#327c58',padding:'5px 8px',borderRadius:6,fontSize:9,fontWeight:850,textTransform:'uppercase'};
const attendanceTile:React.CSSProperties={flex:'1 1 70px',background:'#f6f8fc',borderRadius:9,padding:10,display:'grid',gap:4};
const simpleRow:React.CSSProperties={display:'flex',justifyContent:'space-between',padding:'8px 0',borderTop:'1px solid #f0f2f6',fontSize:11,color:'#748096'};
const announcement:React.CSSProperties={padding:'12px 0',borderTop:'1px solid #f0f2f6'};
const footer:React.CSSProperties={display:'flex',alignItems:'center',gap:7,fontSize:10,color:'#8793a6',marginTop:19};
const errorBox:React.CSSProperties={padding:12,background:'#fff0ee',color:'#b64d42',borderRadius:9,fontSize:12};
const successBox:React.CSSProperties={padding:12,background:'#edf8f1',color:'#28734c',borderRadius:9,fontSize:12};
