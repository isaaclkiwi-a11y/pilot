'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';
import {BookOpen,CalendarClock,Check,Clock3,Plus,RefreshCw,UserRound,Users,X} from 'lucide-react';
import {createClient} from '@/lib/supabase/client';

type Mode='bells'|'substitutes'|'current';
type Schedule={id:string;name:string;is_default:boolean;status:string;effective_from:string|null;effective_to:string|null;days_of_week:number[]};
type Period={id:string;schedule_id:string;name:string;period_order:number;starts_at:string;ends_at:string;period_type:string};
type ClassRow={id:string;name:string;room:string|null;grade_level:string|null};
type Meeting={id:string;class_id:string;period_id:string;day_of_week:number;starts_on:string|null;ends_on:string|null};
type Membership={user_id:string;role:string;display_name:string};
type Coverage={id:string;teacher_user_id:string;substitute_user_id:string;starts_on:string;ends_on:string;status:string;notes:string|null;teacher_name:string;substitute_name:string};

function schoolClock(timezone:string){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:timezone,weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
 const get=(k:string)=>parts.find(p=>p.type===k)?.value||'0';
 const dayMap:Record<string,number>={Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:7};
 return {day:dayMap[get('weekday')]||1,minutes:Number(get('hour'))*60+Number(get('minute')),date:new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())};
}
const minutesOf=(t:string)=>{const [h,m]=t.split(':').map(Number);return h*60+m;};
const niceTime=(t:string)=>new Date('2000-01-01T'+t).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
const labelFor=(id:string,people:Membership[])=>people.find(p=>p.user_id===id)?.display_name||'Staff member';

function useSchoolDayData(schoolId:string,userId:string){
 const db=useMemo(()=>createClient(),[]);
 const [timezone,setTimezone]=useState('America/Chicago');
 const [schedules,setSchedules]=useState<Schedule[]>([]);
 const [periods,setPeriods]=useState<Period[]>([]);
 const [classes,setClasses]=useState<ClassRow[]>([]);
 const [meetings,setMeetings]=useState<Meeting[]>([]);
 const [assignments,setAssignments]=useState<{class_id:string;user_id:string}[]>([]);
 const [people,setPeople]=useState<Membership[]>([]);
 const [coverage,setCoverage]=useState<Coverage[]>([]);
 const [now,setNow]=useState(Date.now());
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const load=useCallback(async()=>{
  if(!schoolId)return;
  setError('');
  const [schoolR,scheduleR,periodR,classR,meetingR,assignmentR,membershipR,profileR,coverageR]=await Promise.all([
   db.from('schools').select('timezone').eq('id',schoolId).maybeSingle(),
   db.from('school_bell_schedules').select('id,name,is_default,status,effective_from,effective_to,days_of_week').eq('school_id',schoolId).order('name'),
   db.from('school_periods').select('id,schedule_id,name,period_order,starts_at,ends_at,period_type').eq('school_id',schoolId).order('period_order'),
   db.from('school_classes').select('id,name,room,grade_level').eq('school_id',schoolId).eq('status','active').order('name'),
   db.from('school_class_meetings').select('id,class_id,period_id,day_of_week,starts_on,ends_on').eq('school_id',schoolId),
   db.from('class_staff_assignments').select('class_id,user_id').eq('school_id',schoolId),
   db.from('school_memberships').select('user_id,role').eq('school_id',schoolId).eq('status','active'),
   db.from('school_staff_profiles').select('user_id,display_name').eq('school_id',schoolId),
   db.from('substitute_assignments').select('id,teacher_user_id,substitute_user_id,starts_on,ends_on,status,notes').eq('school_id',schoolId).order('starts_on',{ascending:false})
  ]);
  if(schoolR.data?.timezone)setTimezone(schoolR.data.timezone);
  const fail=[scheduleR,periodR,classR,meetingR,assignmentR,membershipR,profileR,coverageR].find(x=>x.error);
  if(fail){setError(fail.error.message);setLoading(false);return;}
  const profileMap=new Map((profileR.data||[]).map((p:any)=>[p.user_id,p.display_name||'Staff member']));
  const members=(membershipR.data||[]).map((m:any)=>({user_id:m.user_id,role:m.role,display_name:profileMap.get(m.user_id)||'Staff member'}));
  const memberNames=new Map<string,string>();members.forEach(m=>memberNames.set(m.user_id,m.display_name));profileMap.forEach((name:any,id:string)=>memberNames.set(id,String(name||'Staff member')));
  setSchedules(scheduleR.data||[]);setPeriods(periodR.data||[]);setClasses(classR.data||[]);
  setMeetings(meetingR.data||[]);setAssignments(assignmentR.data||[]);setPeople(members);
  setCoverage((coverageR.data||[]).map((c:any)=>({...c,teacher_name:memberNames.get(c.teacher_user_id)||'Teacher',substitute_name:memberNames.get(c.substitute_user_id)||'Substitute'})));
  setLoading(false);
 },[db,schoolId]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{const id=window.setInterval(()=>setNow(Date.now()),15000);return()=>window.clearInterval(id);},[]);
 const clock=schoolClock(timezone);
 const schedule=schedules.find(s=>s.is_default&&s.status==='active'&&s.days_of_week.includes(clock.day)&&(!s.effective_from||s.effective_from<=clock.date)&&(!s.effective_to||s.effective_to>=clock.date));
 const period=periods.find(p=>p.schedule_id===schedule?.id&&minutesOf(p.starts_at)<=clock.minutes&&minutesOf(p.ends_at)>clock.minutes);
 const activeCoverage=coverage.find(c=>c.substitute_user_id===userId&&c.status==='active'&&c.starts_on<=clock.date&&c.ends_on>=clock.date);
 const effectiveTeacher=activeCoverage?.teacher_user_id||userId;
 const classIds=assignments.filter(a=>a.user_id===effectiveTeacher).map(a=>a.class_id);
 const meeting=meetings.find(m=>classIds.includes(m.class_id)&&m.period_id===period?.id&&m.day_of_week===clock.day&&(!m.starts_on||m.starts_on<=clock.date)&&(!m.ends_on||m.ends_on>=clock.date));
 const currentClass=classes.find(c=>c.id===meeting?.class_id);
 return {db,timezone,schedules,periods,classes,meetings,assignments,people,coverage,clock,period,currentClass,activeCoverage,loading,error,load,setError};
}

export function CurrentClassCard({schoolId,userId,role}:{schoolId:string;userId:string;role:string}){
 const d=useSchoolDayData(schoolId,userId);
 if(!['teacher','staff','substitute'].includes(role))return null;
 const name=d.activeCoverage?'Substitute coverage': 'Your current class';
 return <section style={card}>
  <div style={kicker}><CalendarClock size={15}/> RIGHT NOW</div>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
   <div><h2 style={title}>{name}</h2>{d.currentClass?<><b style={{fontSize:19,color:'#25334c'}}>{d.currentClass.name}</b><p style={muted}>{[d.currentClass.room,d.currentClass.grade_level,d.period?.name].filter(Boolean).join(' · ')}</p></>:<p style={muted}>{d.period?'No class is assigned to this period.':'No active class period right now.'}</p>}</div>
   <div style={timeBox}><b>{d.period?d.period.name:'Between periods'}</b><span>{d.period?niceTime(d.period.starts_at)+' – '+niceTime(d.period.ends_at):'School schedule'}</span></div>
  </div>
  {d.activeCoverage&&<p style={subNote}>Covering {d.activeCoverage.teacher_name} through {d.activeCoverage.ends_on}. Your access ends automatically after the assigned date.</p>}
  {d.error&&<p style={errorText}>{d.error}</p>}
 </section>;
}

export default function SchoolDayTools({schoolId,userId,role,mode}:{schoolId:string;userId:string;role:string;mode:Mode}){
 const d=useSchoolDayData(schoolId,userId);
 const admin=['owner','school_admin','staff_admin'].includes(role);
 const [scheduleName,setScheduleName]=useState('Regular Bell Schedule');
 const [defaultSchedule,setDefaultSchedule]=useState(true);
 const [scheduleId,setScheduleId]=useState('');
 const [periodName,setPeriodName]=useState('');
 const [periodOrder,setPeriodOrder]=useState('1');
 const [startsAt,setStartsAt]=useState('08:00');
 const [endsAt,setEndsAt]=useState('08:50');
 const [periodType,setPeriodType]=useState('class');
 const [meetingClass,setMeetingClass]=useState('');
 const [meetingPeriod,setMeetingPeriod]=useState('');
 const [meetingDay,setMeetingDay]=useState('1');
 const [teacherId,setTeacherId]=useState('');
 const [substituteId,setSubstituteId]=useState('');
 const [startsOn,setStartsOn]=useState(d.clock.date);
 const [endsOn,setEndsOn]=useState(d.clock.date);
 const [notes,setNotes]=useState('');
 const [busy,setBusy]=useState('');
 const [notice,setNotice]=useState('');
 const [formError,setFormError]=useState('');
 const activeSchedule=d.schedules.find(s=>s.is_default&&s.status==='active');
 const teachers=d.people.filter(p=>p.role==='teacher');
 const substitutes=d.people.filter(p=>p.role==='substitute');
 const canEdit=admin;
 async function saveSchedule(e:React.FormEvent){
  e.preventDefault();setBusy('schedule');setFormError('');setNotice('');
  if(defaultSchedule){const {error}=await d.db.from('school_bell_schedules').update({is_default:false}).eq('school_id',schoolId).eq('is_default',true);if(error){setFormError(error.message);setBusy('');return;}}
  const {error}=await d.db.from('school_bell_schedules').insert({school_id:schoolId,name:scheduleName.trim(),is_default:defaultSchedule,status:'active',created_by:userId});
  if(error)setFormError(error.message);else{setNotice('Bell schedule created. Add its periods and class meetings below.');await d.load();}
  setBusy('');
 }
 async function savePeriod(e:React.FormEvent){
  e.preventDefault();setBusy('period');setFormError('');setNotice('');
  const target=scheduleId||activeSchedule?.id;
  if(!target){setFormError('Create a bell schedule first.');setBusy('');return;}
  if(endsAt<=startsAt){setFormError('The period end must be after its start.');setBusy('');return;}
  const {error}=await d.db.from('school_periods').insert({school_id:schoolId,schedule_id:target,name:periodName.trim(),period_order:Number(periodOrder),starts_at:startsAt,ends_at:endsAt,period_type:periodType});
  if(error)setFormError(error.message);else{setNotice('Period added to the bell schedule.');setPeriodName('');await d.load();}
  setBusy('');
 }
 async function saveMeeting(e:React.FormEvent){
  e.preventDefault();setBusy('meeting');setFormError('');setNotice('');
  const {error}=await d.db.from('school_class_meetings').insert({school_id:schoolId,class_id:meetingClass,period_id:meetingPeriod,day_of_week:Number(meetingDay),created_by:userId});
  if(error)setFormError(error.message);else{setNotice('Class linked to its period.');await d.load();}
  setBusy('');
 }
 async function saveCoverage(e:React.FormEvent){
  e.preventDefault();setBusy('coverage');setFormError('');setNotice('');
  if(!teacherId||!substituteId||teacherId===substituteId){setFormError('Choose a teacher and a different substitute account.');setBusy('');return;}
  if(endsOn<startsOn){setFormError('The end date cannot be before the start date.');setBusy('');return;}
  const {error}=await d.db.from('substitute_assignments').insert({school_id:schoolId,teacher_user_id:teacherId,substitute_user_id:substituteId,starts_on:startsOn,ends_on:endsOn,notes:notes.trim()||null,created_by:userId});
  if(error)setFormError(error.message);else{setNotice('Substitute coverage is active for the selected dates.');setNotes('');await d.load();}
  setBusy('');
 }
 async function endCoverage(id:string){
  setBusy(id);setFormError('');setNotice('');
  const {error}=await d.db.from('substitute_assignments').update({status:'ended',ended_by:userId,ended_at:new Date().toISOString()}).eq('id',id);
  if(error)setFormError(error.message);else{setNotice('Substitute access ended.');await d.load();}
  setBusy('');
 }
 if(d.loading)return <section style={card}>Loading school-day settings…</section>;
 return <div style={{display:'grid',gap:15}}>
  <CurrentClassCard schoolId={schoolId} userId={userId} role={role}/>
  {mode==='bells'&&<section style={card}>
   <div style={kicker}><Clock3 size={15}/> BELL SCHEDULE</div><h2 style={title}>Periods that run the school day</h2><p style={muted}>Set real start and end times, then attach each class to a period and weekday. The current-class view updates automatically using the school's time zone.</p>
   {admin&&<form onSubmit={saveSchedule} style={formGrid}><label style={field}>Schedule name<input required value={scheduleName} onChange={e=>setScheduleName(e.target.value)}/></label><label style={field}>Make default<select value={defaultSchedule?'yes':'no'} onChange={e=>setDefaultSchedule(e.target.value==='yes')}><option value="yes">Yes, use for the school</option><option value="no">No, keep as alternate</option></select></label><button disabled={busy==='schedule'} style={primary}><Plus size={14}/> Create schedule</button></form>}
   <div style={listHead}><b>Schedules</b><button onClick={()=>void d.load()} style={secondary}><RefreshCw size={13}/> Refresh</button></div>
   {d.schedules.length?d.schedules.map(s=><div key={s.id} style={row}><div><b>{s.name}</b><small>{s.status}{s.is_default?' · Default schedule':''}</small></div><span style={s.is_default?tagActive:tag}>{s.is_default?'DEFAULT':'ALTERNATE'}</span></div>):<p style={muted}>No bell schedules yet.</p>}
   {admin&&<><h3 style={subTitle}>Add a period</h3><form onSubmit={savePeriod} style={formGrid}><label style={field}>Schedule<select required value={scheduleId||activeSchedule?.id||''} onChange={e=>setScheduleId(e.target.value)}><option value="">Choose schedule</option>{d.schedules.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label style={field}>Period name<input required value={periodName} onChange={e=>setPeriodName(e.target.value)} placeholder="Period 1"/></label><label style={field}>Order<input required type="number" min="1" max="30" value={periodOrder} onChange={e=>setPeriodOrder(e.target.value)}/></label><label style={field}>Starts<input required type="time" value={startsAt} onChange={e=>setStartsAt(e.target.value)}/></label><label style={field}>Ends<input required type="time" value={endsAt} onChange={e=>setEndsAt(e.target.value)}/></label><label style={field}>Type<select value={periodType} onChange={e=>setPeriodType(e.target.value)}>{['class','passing','lunch','advisory','assembly','other'].map(x=><option key={x}>{x}</option>)}</select></label><button disabled={busy==='period'} style={primary}><Plus size={14}/> Add period</button></form>
   <h3 style={subTitle}>Connect classes to periods</h3><form onSubmit={saveMeeting} style={formGrid}><label style={field}>Class<select required value={meetingClass} onChange={e=>setMeetingClass(e.target.value)}><option value="">Choose class</option>{d.classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label style={field}>Period<select required value={meetingPeriod} onChange={e=>setMeetingPeriod(e.target.value)}><option value="">Choose period</option>{d.periods.map(p=><option key={p.id} value={p.id}>{p.name} · {niceTime(p.starts_at)}</option>)}</select></label><label style={field}>Day<select value={meetingDay} onChange={e=>setMeetingDay(e.target.value)}>{[['1','Monday'],['2','Tuesday'],['3','Wednesday'],['4','Thursday'],['5','Friday'],['6','Saturday'],['7','Sunday']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><button disabled={busy==='meeting'} style={primary}><Plus size={14}/> Link class</button></form></>}
   <div style={listHead}><b>Periods</b><span style={mutedSmall}>{d.periods.length} total</span></div>
   {d.periods.map(p=><div key={p.id} style={row}><div><b>{p.name}</b><small>{niceTime(p.starts_at)} – {niceTime(p.ends_at)} · {p.period_type}</small></div><span style={tag}>#{p.period_order}</span></div>)}
  </section>}
  {mode==='substitutes'&&<section style={card}>
   <div style={kicker}><Users size={15}/> SUBSTITUTE MODE</div><h2 style={title}>Temporary teacher coverage</h2><p style={muted}>Assign a substitute account to a teacher for a school-day date range. The substitute inherits that teacher's assigned classes during the coverage window. Access expires automatically after the final school day.</p>
   {admin?<form onSubmit={saveCoverage} style={formGrid}>
    <label style={field}>Teacher<select required value={teacherId} onChange={e=>setTeacherId(e.target.value)}><option value="">Select teacher</option>{teachers.map(p=><option key={p.user_id} value={p.user_id}>{p.display_name}</option>)}</select></label>
    <label style={field}>Substitute account<select required value={substituteId} onChange={e=>setSubstituteId(e.target.value)}><option value="">Select substitute</option>{substitutes.map(p=><option key={p.user_id} value={p.user_id}>{p.display_name}</option>)}</select></label>
    <label style={field}>First day<input required type="date" value={startsOn} onChange={e=>setStartsOn(e.target.value)}/></label>
    <label style={field}>Last day<input required type="date" value={endsOn} onChange={e=>setEndsOn(e.target.value)}/></label>
    <label style={{...field,gridColumn:'1/-1'}}>Substitute instructions<textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Room, lesson notes, and important class instructions"/></label>
    <button disabled={busy==='coverage'||!teachers.length||!substitutes.length} style={primary}><Plus size={14}/> Assign substitute</button>
   </form>:<p style={muted}>Only school administrators can assign substitute coverage.</p>}
   <div style={listHead}><b>Coverage assignments</b><span style={mutedSmall}>{d.coverage.length} records</span></div>
   {d.coverage.length?d.coverage.map(c=><div key={c.id} style={row}><div><b>{c.substitute_name} covering {c.teacher_name}</b><small>{c.starts_on===c.ends_on?c.starts_on:c.starts_on+' to '+c.ends_on}{c.notes?' · '+c.notes:''}</small></div><div style={{display:'flex',alignItems:'center',gap:8}}><span style={c.status==='active'?tagActive:tag}>{c.status}</span>{admin&&c.status==='active'&&<button disabled={busy===c.id} onClick={()=>void endCoverage(c.id)} style={secondary}><X size={13}/> End coverage</button>}</div></div>):<p style={muted}>No substitute coverage has been assigned.</p>}
  </section>}
  {formError&&<p role="alert" style={errorText}>{formError}</p>}{d.error&&<p role="alert" style={errorText}>{d.error}</p>}{notice&&<p role="status" style={successText}>{notice}</p>}
 </div>;
}

const card:React.CSSProperties={background:'#fff',border:'1px solid #e7eaf1',borderRadius:15,padding:20,boxShadow:'0 8px 26px rgba(30,45,75,.035)'};
const kicker:React.CSSProperties={display:'flex',alignItems:'center',gap:8,color:'#586fc7',fontSize:10,fontWeight:850,letterSpacing:1.1};
const title:React.CSSProperties={fontSize:20,letterSpacing:-.5,margin:'9px 0 5px',color:'#25334c'};
const muted:React.CSSProperties={fontSize:12,lineHeight:1.6,color:'#7c8799',margin:'0 0 14px'};
const mutedSmall:React.CSSProperties={fontSize:11,color:'#8b95a6'};
const subTitle:React.CSSProperties={fontSize:14,margin:'22px 0 10px',color:'#35425a'};
const field:React.CSSProperties={display:'grid',gap:6,fontSize:11,fontWeight:750,color:'#657188'};
const formGrid:React.CSSProperties={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:11,padding:14,background:'#f7f8fc',borderRadius:12,margin:'14px 0'};
const inputBase:React.CSSProperties={border:'1px solid #dfe4ee',borderRadius:8,padding:'10px 11px',background:'#fff',color:'#26334b',minHeight:39,fontSize:12};
const primary:React.CSSProperties={...inputBase,display:'inline-flex',alignItems:'center',justifyContent:'center',gap:7,background:'#5269c9',borderColor:'#5269c9',color:'#fff',fontWeight:800,cursor:'pointer'};
const secondary:React.CSSProperties={...inputBase,display:'inline-flex',alignItems:'center',justifyContent:'center',gap:7,minHeight:32,padding:'7px 10px',fontSize:10,cursor:'pointer'};
const row:React.CSSProperties={display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,padding:'12px 0',borderTop:'1px solid #eff1f5',fontSize:12,color:'#43516a'};
const listHead:React.CSSProperties={display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:17,marginBottom:8,fontSize:12,color:'#3c4960'};
const tag:React.CSSProperties={background:'#f0f2f7',color:'#758197',padding:'5px 8px',borderRadius:6,fontSize:9,fontWeight:800,textTransform:'uppercase'};
const tagActive:React.CSSProperties={...tag,background:'#eaf7ef',color:'#32805a'};
const timeBox:React.CSSProperties={display:'grid',gap:4,background:'#f5f7fc',borderRadius:10,padding:'11px 14px',fontSize:12,color:'#475675'};
const subNote:React.CSSProperties={fontSize:11,color:'#5369bd',background:'#f2f5ff',borderRadius:8,padding:10,margin:'12px 0 0'};
const errorText:React.CSSProperties={fontSize:12,color:'#b64d42',background:'#fff0ee',borderRadius:8,padding:10,margin:0};
const successText:React.CSSProperties={fontSize:12,color:'#28734c',background:'#edf8f1',borderRadius:8,padding:10,margin:0};
