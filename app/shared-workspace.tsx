'use client';

import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {Activity,BookOpen,CalendarDays,Check,ClipboardCheck,Clock3,DoorOpen,Download,GraduationCap,LayoutDashboard,LogOut,Plus,RefreshCw,Settings,ShieldCheck,Trash2,Users,UserCog,Upload,Command,BarChart3,Menu,X,Search,ChevronRight} from 'lucide-react';
import {createClient} from '@/lib/supabase/client';
import LivePassCenter from './live-pass-center';
import SchoolDayTools,{CurrentClassCard} from './school-day-tools';
import QRCode from 'qrcode';

type Section='overview'|'passes'|'students'|'staff'|'classes'|'attendance'|'schedule'|'bells'|'substitutes'|'announcements'|'analytics'|'activity'|'settings';
type Student={id:string;student_number:string|null;first_name:string;last_name:string;grade_level:string|null;homeroom:string|null;status:string};
type Staff={id:string;user_id:string;display_name:string|null;job_title:string|null;room:string|null;status:string};
type School={id:string;name:string;timezone:string;status:string};
type EventRow={id:string;title:string;starts_at:string;ends_at:string|null;location:string|null;category:string|null;status:string;created_by:string};
type Announcement={id:string;title:string;body:string;audience:string;status:string;created_at:string;created_by:string};
type AttendanceRow={id:string;student_id:string;attendance_date:string;status:string;note:string|null};
type ClassRow={id:string;name:string;grade_level:string|null;room:string|null;period_label:string|null;status:string};
type AuditRow={id:number;event_type:string;target_type:string|null;target_id:string|null;details:Record<string,unknown>;created_at:string;actor_user_id:string|null};
const sections:{id:Section;label:string;icon:any;group:string}[]=[
 {id:'overview',label:'Overview',icon:LayoutDashboard,group:'WORKSPACE'},
 {id:'passes',label:'Hall passes',icon:DoorOpen,group:'WORKSPACE'},
 {id:'students',label:'Students',icon:GraduationCap,group:'WORKSPACE'},
 {id:'staff',label:'Staff directory',icon:Users,group:'WORKSPACE'},
 {id:'classes',label:'Classes & assignments',icon:BookOpen,group:'SCHOOL'},
 {id:'attendance',label:'Attendance',icon:ClipboardCheck,group:'SCHOOL'},
 {id:'schedule',label:'Schedule',icon:CalendarDays,group:'SCHOOL'},
 {id:'bells',label:'Bell schedule',icon:Clock3,group:'SCHOOL'},
 {id:'substitutes',label:'Substitute coverage',icon:UserCog,group:'SCHOOL'},
 {id:'announcements',label:'Announcements',icon:BookOpen,group:'SCHOOL'},
 {id:'analytics',label:'Analytics',icon:BarChart3,group:'INSIGHTS'},
 {id:'activity',label:'Audit history',icon:Activity,group:'INSIGHTS'},
 {id:'settings',label:'School settings',icon:Settings,group:'INSIGHTS'},
];
const dateForSchool=(timezone:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const inputCss:React.CSSProperties={width:'100%',boxSizing:'border-box',border:'1px solid #dfe4ed',borderRadius:9,padding:'10px 11px',background:'#fff',color:'#26334b',fontSize:13,minHeight:40};
const buttonCss=(primary=false):React.CSSProperties=>({display:'inline-flex',alignItems:'center',justifyContent:'center',gap:7,border:primary?'1px solid #536ac8':'1px solid #e0e5ee',borderRadius:9,padding:'10px 13px',background:primary?'#536ac8':'#fff',color:primary?'#fff':'#526078',fontWeight:750,fontSize:12,cursor:'pointer'});
const cardCss:React.CSSProperties={background:'#fff',border:'1px solid #e7eaf1',borderRadius:14,padding:18,boxShadow:'0 7px 24px rgba(30,45,75,.035)'};
const fieldCss:React.CSSProperties={display:'flex',flexDirection:'column',gap:6,fontSize:11,fontWeight:750,color:'#657188'};
const dateLabel=(v:string)=>new Date(v).toLocaleString([],{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});
function csvRows(text:string){const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(ch===','&&!quoted){row.push(cell.trim());cell='';}else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell.trim());if(row.some(Boolean))rows.push(row);row=[];cell='';}else cell+=ch;}row.push(cell.trim());if(row.some(Boolean))rows.push(row);return rows;}

export default function SharedWorkspace({initialSection}:{initialSection?:Section}){
 const router=useRouter(),pathname=usePathname(),db=useMemo(()=>createClient(),[]);
 const path=(pathname.split('/')[1]||'overview') as Section;
 const current=initialSection||(sections.some(s=>s.id===path)?path:'overview');
 const [userId,setUserId]=useState('');
 const [schoolId,setSchoolId]=useState('');
 const [role,setRole]=useState('');
 const [school,setSchool]=useState<School|null>(null);
 const [students,setStudents]=useState<Student[]>([]);
 const [staff,setStaff]=useState<Staff[]>([]);
 const [events,setEvents]=useState<EventRow[]>([]);
 const [announcements,setAnnouncements]=useState<Announcement[]>([]);
 const [attendance,setAttendance]=useState<AttendanceRow[]>([]);
 const [classes,setClasses]=useState<ClassRow[]>([]);
 const [enrollments,setEnrollments]=useState<{id:string;class_id:string;student_id:string}[]>([]);
 const [assignments,setAssignments]=useState<{id:string;class_id:string;user_id:string}[]>([]);
 const [audit,setAudit]=useState<AuditRow[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [query,setQuery]=useState('');
 const [form,setForm]=useState<Record<string,string>>({});
 const [showForm,setShowForm]=useState('');
 const [issuedStudentQr,setIssuedStudentQr]=useState<{name:string;dataUrl:string}|null>(null);
 const [selectedClass,setSelectedClass]=useState('');
 const [selectedStudent,setSelectedStudent]=useState('');
 const [selectedStaff,setSelectedStaff]=useState('');
 const [mobileNavOpen,setMobileNavOpen]=useState(false);
 const [navSearch,setNavSearch]=useState('');
 const navSearchRef=useRef<HTMLInputElement>(null);
 useEffect(()=>{setMobileNavOpen(false);setNavSearch('');},[pathname]);
 useEffect(()=>{const onShortcut=(event:KeyboardEvent)=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();navSearchRef.current?.focus();}};window.addEventListener('keydown',onShortcut);return()=>window.removeEventListener('keydown',onShortcut);},[]);
 const navResults=sections.filter(s=>s.label.toLowerCase().includes(navSearch.toLowerCase()));

 const schoolToday=dateForSchool(school?.timezone||'America/Chicago');
 const isAdmin=['owner','school_admin','staff_admin'].includes(role);
 const isStaff=['owner','school_admin','staff_admin','teacher','staff','substitute'].includes(role);
 const canPublish=['owner','school_admin','staff_admin','teacher','staff'].includes(role);
 const title=sections.find(x=>x.id===current)?.label||'Overview';

 const load=useCallback(async()=>{
  setError('');
  const {data:{user},error:userError}=await db.auth.getUser();
  if(userError||!user){setError('Your session could not be verified. Please sign in again.');setLoading(false);return;}
  setUserId(user.id);
  const {data:membership,error:memberError}=await db.from('school_memberships').select('school_id,role').eq('user_id',user.id).eq('status','active').limit(1).maybeSingle();
  if(memberError||!membership){setError(memberError?.message||'No active school membership was found.');setLoading(false);return;}
  setSchoolId(membership.school_id);setRole(membership.role);
  const results=await Promise.all([
   db.from('schools').select('id,name,timezone,status').eq('id',membership.school_id).maybeSingle(),
   db.from('students').select('id,student_number,first_name,last_name,grade_level,homeroom,status').eq('school_id',membership.school_id).order('last_name').limit(2000),
   db.from('school_staff_profiles').select('id,user_id,display_name,job_title,room,status').eq('school_id',membership.school_id).order('display_name'),
   db.from('school_events').select('id,title,starts_at,ends_at,location,category,status,created_by').eq('school_id',membership.school_id).order('starts_at',{ascending:true}).limit(500),
   db.from('school_announcements').select('id,title,body,audience,status,created_at,created_by').eq('school_id',membership.school_id).order('created_at',{ascending:false}).limit(500),
   db.from('attendance_records').select('id,student_id,attendance_date,status,note').eq('school_id',membership.school_id).order('attendance_date',{ascending:false}).limit(3000),
   db.from('school_classes').select('id,name,grade_level,room,period_label,status').eq('school_id',membership.school_id).order('name'),
   db.from('class_enrollments').select('id,class_id,student_id').eq('school_id',membership.school_id).limit(5000),
   db.from('class_staff_assignments').select('id,class_id,user_id').eq('school_id',membership.school_id).limit(2000),
   isAdmin?db.from('audit_logs').select('id,event_type,target_type,target_id,details,created_at,actor_user_id').eq('school_id',membership.school_id).order('created_at',{ascending:false}).limit(500):Promise.resolve({data:[],error:null})
  ]);
  const [schoolR,studentsR,staffR,eventsR,annR,attR,classesR,enrollR,assignR,auditR]=results as any[];
  if(schoolR.error)setError(schoolR.error.message);else setSchool(schoolR.data);
  if(studentsR.error)setError(studentsR.error.message);else setStudents(studentsR.data||[]);
  if(staffR.error)setError(staffR.error.message);else setStaff(staffR.data||[]);
  if(eventsR.error)setError(eventsR.error.message);else setEvents(eventsR.data||[]);
  if(annR.error)setError(annR.error.message);else setAnnouncements(annR.data||[]);
  if(attR.error)setError(attR.error.message);else setAttendance(attR.data||[]);
  if(classesR.error)setError(classesR.error.message);else setClasses(classesR.data||[]);
  if(enrollR.error)setError(enrollR.error.message);else setEnrollments(enrollR.data||[]);
  if(assignR.error)setError(assignR.error.message);else setAssignments(assignR.data||[]);
  if(auditR.error&&isAdmin)setError(auditR.error.message);else setAudit(auditR.data||[]);
  setLoading(false);
 },[db,isAdmin]);

 useEffect(()=>{void load();},[load]);
 useEffect(()=>{
  if(!schoolId)return;
  const channel=db.channel('pilot-shared-workspace-'+schoolId)
   .on('postgres_changes',{event:'*',schema:'public',table:'students',filter:'school_id=eq.'+schoolId},()=>void load())
   .on('postgres_changes',{event:'*',schema:'public',table:'attendance_records',filter:'school_id=eq.'+schoolId},()=>void load())
   .on('postgres_changes',{event:'*',schema:'public',table:'school_events',filter:'school_id=eq.'+schoolId},()=>void load())
   .on('postgres_changes',{event:'*',schema:'public',table:'school_announcements',filter:'school_id=eq.'+schoolId},()=>void load())
   .on('postgres_changes',{event:'*',schema:'public',table:'school_classes',filter:'school_id=eq.'+schoolId},()=>void load())
   .subscribe();
  const fallback=window.setInterval(()=>void load(),45000);
  return()=>{void window.clearInterval(fallback);void db.removeChannel(channel);};
 },[db,schoolId,load]);

 const notify=(s:string)=>{setNotice(s);window.setTimeout(()=>setNotice(''),3200);};
 const updateForm=(key:string,value:string)=>setForm(v=>({...v,[key]:value}));
 const studentsFiltered=students.filter(s=>[s.first_name,s.last_name,s.student_number,s.grade_level,s.homeroom].join(' ').toLowerCase().includes(query.toLowerCase()));
 const staffFiltered=staff.filter(s=>[s.display_name,s.job_title,s.room].join(' ').toLowerCase().includes(query.toLowerCase()));
 const eventsFiltered=events.filter(e=>[e.title,e.location,e.category,e.starts_at].join(' ').toLowerCase().includes(query.toLowerCase()));
 const announcementsFiltered=announcements.filter(a=>[a.title,a.body,a.audience].join(' ').toLowerCase().includes(query.toLowerCase()));
 const activeStudents=students.filter(s=>s.status==='active');
 const todayAttendance=attendance.filter(a=>a.attendance_date===schoolToday);
 const setAttendanceStatus=async(studentId:string,status:string)=>{
  setBusy(true);setError('');
  const existing=attendance.find(a=>a.student_id===studentId&&a.attendance_date===schoolToday);
  const result=existing
   ?await db.from('attendance_records').update({status,note:existing.note||null,updated_by:userId}).eq('id',existing.id)
   :await db.from('attendance_records').insert({school_id:schoolId,student_id:studentId,attendance_date:schoolToday,status,note:null,created_by:userId,updated_by:userId});
  if(result.error)setError(result.error.message);else{notify('Attendance saved for the school.');await load();}
  setBusy(false);
 };
 const addStudent=async(e:React.FormEvent)=>{
  e.preventDefault();setBusy(true);setError('');setIssuedStudentQr(null);
  const parts=(form.name||'').trim().split(/\s+/);const first=parts.shift()||'',last=parts.join(' ');if(!last){setError('Enter the student’s first and last name.');setBusy(false);return;}
  const {data:student,error}=await db.from('students').insert({school_id:schoolId,first_name:first,last_name:last,student_number:(form.number||'').trim()||null,grade_level:form.grade||null,homeroom:(form.homeroom||'').trim()||null,status:'active',created_by:userId}).select('id').single();
  if(error){setError(error.message);setBusy(false);return;}
  const {data:credential,error:credentialError}=await db.functions.invoke('student-qr-admin',{body:{action:'issue',student_id:student.id}});
  if(credentialError||credential?.error){setError('Student was added, but QR creation failed: '+(credential?.error||credentialError?.message||'Unknown error')+'. Issue a QR from Student QR credentials.');}
  else{
   try{
    const dataUrl=await QRCode.toDataURL(window.location.origin+'/student/login#token='+encodeURIComponent(credential.token),{width:360,margin:2,errorCorrectionLevel:'H'});
    setIssuedStudentQr({name:credential.student_name||first+' '+last,dataUrl});
    notify('Student created and sign-in QR issued. Download or print the QR now.');
   }catch{setError('Student and QR credential were created, but the QR image could not be rendered. Use Student QR credentials to rotate and display a new code.');}
  }
  setShowForm('');setForm({});await load();setBusy(false);
 };
 const importStudents=async(file?:File)=>{
  if(!file)return;setBusy(true);setError('');
  const rows=csvRows(await file.text());if(rows.length<2){setError('CSV needs a header and at least one student row.');setBusy(false);return;}
  const headers=rows[0].map(x=>x.toLowerCase().replace(/[^a-z0-9]/g,''));
  const index=(...names:string[])=>headers.findIndex(x=>names.includes(x));
  const nameI=index('name','fullname','studentname'),idI=index('studentnumber','studentid','id'),gradeI=index('grade','gradelevel'),roomI=index('homeroom','room');
  if(nameI<0){setError('CSV must include a Name or Full Name column.');setBusy(false);return;}
  const seen=new Set(students.map(s=>(s.student_number||'').toLowerCase()));
  const rowsToInsert=rows.slice(1).flatMap(r=>{
   const name=(r[nameI]||'').trim(),parts=name.split(/\s+/),first=parts.shift()||'',last=parts.join(' '),number=idI>=0?(r[idI]||'').trim():null;
   if(!first||!last||(number&&seen.has(number.toLowerCase())))return[];
   if(number)seen.add(number.toLowerCase());
   return[{school_id:schoolId,first_name:first,last_name:last,student_number:number||null,grade_level:gradeI>=0?(r[gradeI]||'').trim()||null:null,homeroom:roomI>=0?(r[roomI]||'').trim()||null:null,status:'active',created_by:userId}];
  });
  if(!rowsToInsert.length){setError('No new valid student rows were found.');setBusy(false);return;}
  const {error}=await db.from('students').insert(rowsToInsert);
  if(error)setError(error.message);else{notify('Imported '+rowsToInsert.length+' students into the shared roster.');await load();}
  setBusy(false);
 };
 const toggleStudent=async(s:Student)=>{
  const next=s.status==='active'?'inactive':'active';
  const {error}=await db.from('students').update({status:next}).eq('id',s.id);
  if(error)setError(error.message);else{notify(next==='active'?'Student reactivated.':'Student marked inactive.');await load();}
 };
 const addClass=async(e:React.FormEvent)=>{
  e.preventDefault();setBusy(true);setError('');
  const {error}=await db.from('school_classes').insert({school_id:schoolId,name:form.className,grade_level:form.classGrade||null,room:form.classRoom||null,period_label:form.period||null,status:'active',created_by:userId});
  if(error)setError(error.message);else{setForm({});setShowForm('');notify('Class created.');await load();}
  setBusy(false);
 };
 const enrollStudent=async()=>{
  if(!selectedClass||!selectedStudent)return;setBusy(true);setError('');
  const {error}=await db.from('class_enrollments').insert({school_id:schoolId,class_id:selectedClass,student_id:selectedStudent,created_by:userId});
  if(error)setError(error.message);else{notify('Student enrolled in class.');await load();}
  setBusy(false);
 };
 const assignStaff=async()=>{
  if(!selectedClass||!selectedStaff)return;setBusy(true);setError('');
  const {error}=await db.from('class_staff_assignments').insert({school_id:schoolId,class_id:selectedClass,user_id:selectedStaff,assignment_type:'lead',created_by:userId});
  if(error)setError(error.message);else{notify('Staff member assigned to class.');await load();}
  setBusy(false);
 };
 const addEvent=async(e:React.FormEvent)=>{
  e.preventDefault();setBusy(true);setError('');
  const starts=new Date(form.startsAt),ends=form.endsAt?new Date(form.endsAt):null;
  if(Number.isNaN(starts.getTime())||(ends&&ends<=starts)){setError('Choose a valid event time range.');setBusy(false);return;}
  const {error}=await db.from('school_events').insert({school_id:schoolId,title:form.title,starts_at:starts.toISOString(),ends_at:ends?.toISOString()||null,location:form.location||null,category:form.category||'other',status:'scheduled',created_by:userId});
  if(error)setError(error.message);else{setShowForm('');setForm({});notify('School event added.');await load();}
  setBusy(false);
 };
 const addAnnouncement=async(e:React.FormEvent)=>{
  e.preventDefault();setBusy(true);setError('');
  const {error}=await db.from('school_announcements').insert({school_id:schoolId,title:form.title,body:form.body,audience:(form.audience||'everyone').toLowerCase(),status:'published',created_by:userId});
  if(error)setError(error.message);else{setShowForm('');setForm({});notify('Announcement published to the selected school audience.');await load();}
  setBusy(false);
 };
 const removeEvent=async(id:string)=>{const {error}=await db.from('school_events').delete().eq('id',id);if(error)setError(error.message);else{notify('Event removed.');await load();}};
 const removeAnnouncement=async(id:string)=>{const {error}=await db.from('school_announcements').delete().eq('id',id);if(error)setError(error.message);else{notify('Announcement removed.');await load();}};
 const saveSchool=async(e:React.FormEvent)=>{e.preventDefault();if(!school)return;setBusy(true);const {error}=await db.from('schools').update({name:form.schoolName||school.name,timezone:form.timezone||school.timezone}).eq('id',schoolId);if(error)setError(error.message);else{notify('School settings saved.');await load();}setBusy(false);};
 const exportStudents=()=>{
  const rows=[['Student Number','First Name','Last Name','Grade','Homeroom','Status'],...students.map(s=>[s.student_number||'',s.first_name,s.last_name,s.grade_level||'',s.homeroom||'',s.status])];
  const text=rows.map(r=>r.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(',')).join('\n');
  const url=URL.createObjectURL(new Blob([text],{type:'text/csv'}));const a=document.createElement('a');a.href=url;a.download='pilot-student-roster-'+schoolToday+'.csv';a.click();URL.revokeObjectURL(url);
 };
 const heading=(subtitle:string,action?:React.ReactNode)=><div className="pilot-page-heading"><div><span className="pilot-eyebrow">{(school?.name||'PILOT').toUpperCase()} <span>•</span> {role.replaceAll('_',' ').toUpperCase()}</span><h1>{current==='overview'?'Your school at a glance':title}</h1><p>{subtitle}</p></div>{action&&<div className="pilot-heading-actions">{action}</div>}</div>;
 const tableHead=(labels:string[])=><thead><tr>{labels.map(x=><th key={x} style={{textAlign:'left',fontSize:10,letterSpacing:.7,color:'#8b95a6',padding:'11px 10px',borderBottom:'1px solid #edf0f4',whiteSpace:'nowrap'}}>{x}</th>)}</tr></thead>;
 const cell:React.CSSProperties={padding:'12px 10px',fontSize:12,color:'#56637a',borderBottom:'1px solid #f0f2f6'};
 const filterInput=<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search records…" style={{...inputCss,maxWidth:320,marginBottom:13}}/>;

 return <div className="pilot-shell">
 {mobileNavOpen&&<button className="pilot-mobile-scrim" aria-label="Close navigation" onClick={()=>setMobileNavOpen(false)}/>}
 <aside className={`pilot-sidebar ${mobileNavOpen?'is-open':''}`}>
  <div className="pilot-brand"><span className="pilot-brand-mark"><Command size={18}/></span><span>pilot<span className="pilot-brand-period">.</span><small>SCHOOL OPERATIONS</small></span><button className="pilot-mobile-close" onClick={()=>setMobileNavOpen(false)} aria-label="Close menu"><X size={18}/></button></div>
  <div className="pilot-school-switch"><span className="pilot-school-icon"><ShieldCheck size={17}/></span><span><b>{school?.name||'School workspace'}</b><small>School workspace</small></span><ChevronRight size={15}/></div>
  <div className="pilot-nav-caption">YOUR WORKSPACE</div>
  <nav className="pilot-nav" aria-label="Main navigation">{['WORKSPACE','SCHOOL','INSIGHTS'].map(group=><div className="pilot-nav-group" key={group}><small>{group}</small>{sections.filter(x=>x.group===group).map(item=><button key={item.id} className={`pilot-nav-link ${current===item.id?'is-active':''}`} aria-current={current===item.id?'page':undefined} onClick={()=>{router.push(item.id==='overview'?'/app':'/'+item.id);setQuery('');setShowForm('');setMobileNavOpen(false);}}><item.icon size={17}/><span>{item.label}</span>{current===item.id&&<i/>}</button>)}</div>)}</nav>
  <div className="pilot-sidebar-bottom"><div className="pilot-sync-card"><span className="pilot-sync-indicator"/><div><b>Connected workspace</b><small>School data sync is enabled</small></div></div><div className="pilot-account"><span className="pilot-avatar">{role.slice(0,1).toUpperCase()||'P'}</span><div><b>{role.replaceAll('_',' ')||'School member'}</b><small>Signed in account</small></div><button onClick={async()=>{await db.auth.signOut();router.replace('/login');router.refresh();}} aria-label="Sign out" title="Sign out"><LogOut size={16}/></button></div></div>
 </aside>
 <main className="pilot-main">
  <header className="pilot-topbar"><div className="pilot-topbar-left"><button className="pilot-menu-button" onClick={()=>setMobileNavOpen(true)} aria-label="Open navigation"><Menu size={19}/></button><div className="pilot-breadcrumb"><span>Workspace</span><ChevronRight size={14}/><b>{title}</b></div></div>
   <div className="pilot-topbar-right"><label className="pilot-nav-search"><Search size={16}/><input ref={navSearchRef} aria-label="Find a page" placeholder="Jump to a page…" value={navSearch} onChange={e=>setNavSearch(e.target.value)}/><kbd>⌘ K</kbd></label>{navSearch&&<div className="pilot-search-results">{navResults.length?navResults.map(item=><button key={item.id} onClick={()=>{router.push(item.id==='overview'?'/app':'/'+item.id);setNavSearch('');}}><item.icon size={15}/>{item.label}<ChevronRight size={13}/></button>):<span>No matching pages</span>}</div>}<span className="pilot-top-date">{new Date().toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}</span><span className="pilot-top-avatar">{role.slice(0,1).toUpperCase()||'P'}</span></div>
  </header>
  <div className="pilot-content">{error&&<div role="alert" className="pilot-alert pilot-alert-error">{error}</div>}{notice&&<div role="status" className="pilot-alert pilot-alert-success"><Check size={15}/>{notice}</div>}
   {loading?<div className="pilot-loading"><span className="pilot-spinner"/><b>Loading database</b><small>Syncing your school data…</small></div>:!schoolId?<div className="pilot-empty-state">No active school membership was found. Contact a school administrator.</div>:<div className="pilot-page-enter" key={current}>
    <>
   {current==='overview'&&<>{heading('Loading database')}<CurrentClassCard schoolId={schoolId} userId={userId} role={role}/><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))',gap:12,marginBottom:17}}>{[
    ['Active students',activeStudents.length],['Staff profiles',staff.filter(x=>x.status==='active').length],['Classes',classes.filter(x=>x.status==='active').length],['Today present',todayAttendance.filter(x=>x.status==='present').length],['Announcements',announcements.filter(x=>x.status==='published').length]
   ].map(([label,value])=><div key={String(label)} style={cardCss}><small style={{color:'#8490a2'}}>{label}</small><b style={{display:'block',fontSize:28,marginTop:7,fontVariantNumeric:'tabular-nums'}}>{value}</b></div>)}</div><LivePassCenter/><div style={{...cardCss,marginTop:15}}><h2 style={{fontSize:16,margin:'0 0 12px'}}>Upcoming school events</h2>{events.filter(e=>e.status==='scheduled'&&new Date(e.starts_at)>=new Date()).slice(0,5).map(e=><div key={e.id} style={{padding:'10px 0',borderTop:'1px solid #eff1f5',display:'flex',justifyContent:'space-between',gap:12}}><b style={{fontSize:12}}>{e.title}</b><span style={{fontSize:11,color:'#778398'}}>{dateLabel(e.starts_at)}</span></div>)}{!events.length&&<p style={{color:'#8993a4',fontSize:12}}>No upcoming events have been added.</p>}</div></>}
   {current==='passes'&&<>{heading('Shared pass requests, approvals, countdowns, and overdue status.')}<LivePassCenter/></>}
   {current==='students'&&<>{heading('The official school roster, shared across authorized staff.',<div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button style={buttonCss()} onClick={exportStudents}><Download size={14}/> Export CSV</button>{isAdmin&&<label style={buttonCss() as React.CSSProperties}><Upload size={14}/> Import CSV<input type="file" accept=".csv,text/csv" hidden onChange={e=>void importStudents(e.target.files?.[0])}/></label>}{isAdmin&&<button style={buttonCss(true)} onClick={()=>{setForm({grade:'9'});setShowForm('student')}}><Plus size={14}/> Add student</button>}</div>)}{showForm==='student'&&<form onSubmit={addStudent} style={{...cardCss,display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:10,marginBottom:14}}><label style={fieldCss}>Full name<input required value={form.name||''} onChange={e=>updateForm('name',e.target.value)} style={inputCss}/></label><label style={fieldCss}>Student number<input value={form.number||''} onChange={e=>updateForm('number',e.target.value)} style={inputCss}/></label><label style={fieldCss}>Grade<input value={form.grade||''} onChange={e=>updateForm('grade',e.target.value)} style={inputCss}/></label><label style={fieldCss}>Homeroom<input value={form.homeroom||''} onChange={e=>updateForm('homeroom',e.target.value)} style={inputCss}/></label><div style={{display:'flex',alignItems:'end',gap:7}}><button disabled={busy} style={buttonCss(true)}>Save student</button><button type="button" style={buttonCss()} onClick={()=>setShowForm('')}>Cancel</button></div></form>}{issuedStudentQr&&<div style={{...cardCss,display:'flex',alignItems:'center',gap:18,flexWrap:'wrap',marginBottom:14}}><img src={issuedStudentQr.dataUrl} alt={'Student sign-in QR for '+issuedStudentQr.name} style={{width:180,height:180,objectFit:'contain',background:'#fff',padding:8,border:'1px solid #e7eaf1',borderRadius:12}}/><div style={{flex:1,minWidth:180}}><b style={{fontSize:15,color:'#26334b'}}>Student account created</b><p style={{fontSize:12,color:'#6d7890',lineHeight:1.6}}>A secure QR sign-in credential was issued for {issuedStudentQr.name}. Save or print this code and give it to the student. The code is shown only once.</p><a href={issuedStudentQr.dataUrl} download="pilot-student-qr.png" style={{...buttonCss(true),textDecoration:'none'}}>Download student QR</a><button type="button" onClick={()=>setIssuedStudentQr(null)} style={{...buttonCss(),marginLeft:8}}>Close</button></div></div>}{filterInput}<div style={{...cardCss,overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:700}}>{tableHead(['STUDENT','NUMBER','GRADE','HOMEROOM','STATUS','ACTION'])}<tbody>{studentsFiltered.map(s=><tr key={s.id}><td style={cell}><b>{s.first_name} {s.last_name}</b></td><td style={cell}>{s.student_number||'—'}</td><td style={cell}>{s.grade_level||'—'}</td><td style={cell}>{s.homeroom||'—'}</td><td style={cell}>{s.status}</td><td style={cell}>{isAdmin&&<button style={buttonCss()} onClick={()=>void toggleStudent(s)}>{s.status==='active'?'Archive':'Reactivate'}</button>}</td></tr>)}</tbody></table>{!studentsFiltered.length&&<p style={{padding:20,color:'#8b95a6',fontSize:12}}>No students match this search.</p>}</div></>}
   {current==='staff'&&<>{heading('Staff profiles and access roles. Use invitations to onboard new staff.',isAdmin?<button style={buttonCss(true)} onClick={()=>router.push('/staff/invitations')}><Plus size={14}/> Staff invitations</button>:undefined)}{filterInput}<div style={{...cardCss,overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:600}}>{tableHead(['NAME','JOB TITLE / ROLE','ROOM','STATUS'])}<tbody>{staffFiltered.map(s=><tr key={s.id}><td style={cell}><b>{s.display_name||'Staff member'}</b></td><td style={cell}>{s.job_title||'Staff'}</td><td style={cell}>{s.room||'—'}</td><td style={cell}>{s.status}</td></tr>)}</tbody></table>{!staffFiltered.length&&<p style={{padding:20,color:'#8b95a6',fontSize:12}}>No staff profiles found yet. New invite acceptances create staff profiles automatically.</p>}</div></>}
   {current==='classes'&&<>{heading('Organize classes, enroll students, and assign teachers.',isAdmin?<button style={buttonCss(true)} onClick={()=>{setForm({});setShowForm('class')}}><Plus size={14}/> Add class</button>:undefined)}{showForm==='class'&&<form onSubmit={addClass} style={{...cardCss,display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10,marginBottom:14}}><label style={fieldCss}>Class name<input required value={form.className||''} onChange={e=>updateForm('className',e.target.value)} style={inputCss}/></label><label style={fieldCss}>Grade<input value={form.classGrade||''} onChange={e=>updateForm('classGrade',e.target.value)} style={inputCss}/></label><label style={fieldCss}>Room<input value={form.classRoom||''} onChange={e=>updateForm('classRoom',e.target.value)} style={inputCss}/></label><label style={fieldCss}>Period<input value={form.period||''} onChange={e=>updateForm('period',e.target.value)} style={inputCss}/></label><div style={{display:'flex',alignItems:'end',gap:7}}><button style={buttonCss(true)}>Save class</button><button type="button" style={buttonCss()} onClick={()=>setShowForm('')}>Cancel</button></div></form>}{isAdmin&&<div style={{...cardCss,display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:10,marginBottom:14}}><label style={fieldCss}>Class<select value={selectedClass} onChange={e=>setSelectedClass(e.target.value)} style={inputCss}><option value="">Choose class</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label style={fieldCss}>Enroll student<select value={selectedStudent} onChange={e=>setSelectedStudent(e.target.value)} style={inputCss}><option value="">Choose student</option>{activeStudents.map(s=><option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}</select></label><div style={{display:'flex',alignItems:'end'}}><button disabled={busy||!selectedClass||!selectedStudent} style={buttonCss()} onClick={()=>void enrollStudent()}>Enroll</button></div><label style={fieldCss}>Assign teacher<select value={selectedStaff} onChange={e=>setSelectedStaff(e.target.value)} style={inputCss}><option value="">Choose staff</option>{staff.filter(s=>s.status==='active'&&['teacher','staff'].includes((s.job_title||'').toLowerCase())).map(s=><option key={s.user_id} value={s.user_id}>{s.display_name||s.job_title}</option>)}</select></label><div style={{display:'flex',alignItems:'end'}}><button disabled={busy||!selectedClass||!selectedStaff} style={buttonCss()} onClick={()=>void assignStaff()}>Assign staff</button></div></div>}<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:12}}>{classes.map(c=><article key={c.id} style={cardCss}><b style={{fontSize:15}}>{c.name}</b><p style={{margin:'6px 0',fontSize:11,color:'#7f8a9d'}}>{[c.grade_level,c.room,c.period_label].filter(Boolean).join(' · ')||'No class details'}</p><div style={{fontSize:11,color:'#68758a'}}>{enrollments.filter(e=>e.class_id===c.id).length} enrolled · {assignments.filter(a=>a.class_id===c.id).length} assigned staff</div></article>)}</div>{!classes.length&&<div style={cardCss}>No classes created yet.</div>}</>}
   {current==='attendance'&&<>{heading('Daily attendance records shared with authorized staff.')}<div style={{...cardCss,overflowX:'auto'}}><div style={{display:'flex',justifyContent:'space-between',gap:10,marginBottom:12}}><b style={{fontSize:14}}>Attendance · {schoolToday}</b><span style={{fontSize:11,color:'#7c8799'}}>{todayAttendance.length} records</span></div><table style={{width:'100%',borderCollapse:'collapse',minWidth:700}}>{tableHead(['STUDENT','GRADE','HOMEROOM','MARK ATTENDANCE'])}<tbody>{activeStudents.map(s=>{const record=todayAttendance.find(a=>a.student_id===s.id);return <tr key={s.id}><td style={cell}><b>{s.first_name} {s.last_name}</b><small style={{display:'block',color:'#929cad'}}>{s.student_number||''}</small></td><td style={cell}>{s.grade_level||'—'}</td><td style={cell}>{s.homeroom||'—'}</td><td style={cell}><div style={{display:'flex',gap:5,flexWrap:'wrap'}}>{['present','absent','tardy','excused'].map(st=><button key={st} disabled={!isStaff||busy} onClick={()=>void setAttendanceStatus(s.id,st)} style={{...buttonCss(record?.status===st),padding:'7px 8px',fontSize:10}}>{st}</button>)}</div></td></tr>})}</tbody></table>{!activeStudents.length&&<p style={{padding:18,color:'#8a95a5',fontSize:12}}>Add students to begin taking attendance.</p>}</div></>}
   {current==='bells'&&<>{heading('Set up periods and class times that drive the school day.')}<SchoolDayTools schoolId={schoolId} userId={userId} role={role} mode="bells"/></>}
   {current==='substitutes'&&<>{heading('Assign temporary classroom access to a substitute account.')}<SchoolDayTools schoolId={schoolId} userId={userId} role={role} mode="substitutes"/></>}
   {current==='schedule'&&<>{heading('School events, meetings, and activities.',canPublish?<button style={buttonCss(true)} onClick={()=>{setForm({startsAt:(()=>{const d=new Date(Date.now()+3600000);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16);})(),category:'class'});setShowForm('event')}}><Plus size={14}/> Add event</button>:undefined)}{showForm==='event'&&<form onSubmit={addEvent} style={{...cardCss,display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:10,marginBottom:14}}><label style={fieldCss}>Title<input required value={form.title||''} onChange={e=>updateForm('title',e.target.value)} style={inputCss}/></label><label style={fieldCss}>Starts<input required type="datetime-local" value={form.startsAt||''} onChange={e=>updateForm('startsAt',e.target.value)} style={inputCss}/></label><label style={fieldCss}>Ends<input type="datetime-local" value={form.endsAt||''} onChange={e=>updateForm('endsAt',e.target.value)} style={inputCss}/></label><label style={fieldCss}>Location<input value={form.location||''} onChange={e=>updateForm('location',e.target.value)} style={inputCss}/></label><label style={fieldCss}>Category<select value={form.category||'class'} onChange={e=>updateForm('category',e.target.value)} style={inputCss}>{['class','assembly','meeting','activity','deadline','other'].map(x=><option key={x}>{x}</option>)}</select></label><div style={{display:'flex',alignItems:'end',gap:7}}><button style={buttonCss(true)}>Save event</button><button type="button" style={buttonCss()} onClick={()=>setShowForm('')}>Cancel</button></div></form>}<div style={{...cardCss,overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:650}}>{tableHead(['EVENT','START','END','LOCATION','STATUS',''])}<tbody>{eventsFiltered.map(e=><tr key={e.id}><td style={cell}><b>{e.title}</b><small style={{display:'block',color:'#8c97a7'}}>{e.category||'Event'}</small></td><td style={cell}>{dateLabel(e.starts_at)}</td><td style={cell}>{e.ends_at?dateLabel(e.ends_at):'—'}</td><td style={cell}>{e.location||'—'}</td><td style={cell}>{e.status}</td><td style={cell}>{isAdmin||e.created_by===userId?<button style={buttonCss()} onClick={()=>void removeEvent(e.id)}><Trash2 size={13}/></button>:null}</td></tr>)}</tbody></table></div></>}
   {current==='announcements'&&<>{heading('Publish school updates to the right audience.',canPublish?<button style={buttonCss(true)} onClick={()=>{setForm({audience:'everyone'});setShowForm('announcement')}}><Plus size={14}/> New announcement</button>:undefined)}{showForm==='announcement'&&<form onSubmit={addAnnouncement} style={{...cardCss,display:'grid',gap:10,marginBottom:14}}><label style={fieldCss}>Title<input required value={form.title||''} onChange={e=>updateForm('title',e.target.value)} style={inputCss}/></label><label style={fieldCss}>Message<textarea required rows={4} value={form.body||''} onChange={e=>updateForm('body',e.target.value)} style={inputCss}/></label><label style={fieldCss}>Audience<select value={form.audience||'everyone'} onChange={e=>updateForm('audience',e.target.value)} style={inputCss}>{['everyone','staff','students','families'].map(x=><option key={x}>{x}</option>)}</select></label><div style={{display:'flex',gap:8}}><button style={buttonCss(true)}>Publish</button><button type="button" style={buttonCss()} onClick={()=>setShowForm('')}>Cancel</button></div></form>}<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:12}}>{announcementsFiltered.map(a=><article key={a.id} style={cardCss}><div style={{display:'flex',justifyContent:'space-between',gap:8}}><span style={{fontSize:10,fontWeight:800,color:'#536ac8'}}>{a.audience.toUpperCase()}</span>{(isAdmin||a.created_by===userId)&&<button onClick={()=>void removeAnnouncement(a.id)} style={{border:0,background:'transparent',color:'#9aa3b1'}}><Trash2 size={14}/></button>}</div><h3 style={{fontSize:16,margin:'9px 0 6px'}}>{a.title}</h3><p style={{fontSize:12,color:'#647188',lineHeight:1.6,whiteSpace:'pre-wrap'}}>{a.body}</p><small style={{color:'#909aaa'}}>{dateLabel(a.created_at)}</small></article>)}</div>{!announcementsFiltered.length&&<div style={cardCss}>No announcements are visible to this account.</div>}</>}
   {current==='analytics'&&<>{heading('Live totals from shared school records.')}<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}>{[
    ['Active students',activeStudents.length],['Classes',classes.length],['Attendance today',todayAttendance.length],['Present today',todayAttendance.filter(a=>a.status==='present').length],['Absent today',todayAttendance.filter(a=>a.status==='absent').length],['Upcoming events',events.filter(e=>e.status==='scheduled'&&new Date(e.starts_at)>=new Date()).length]
   ].map(([label,value])=><div key={String(label)} style={cardCss}><small style={{color:'#8490a2'}}>{label}</small><b style={{display:'block',fontSize:28,marginTop:8}}>{value}</b></div>)}</div></>}
   {current==='activity'&&<>{heading(isAdmin?'Audit history of changes to school records.':'Recent shared school activity is available to administrators.')}<div style={{...cardCss,overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:650}}>{tableHead(['EVENT','RECORD','RECORD ID','WHEN'])}<tbody>{audit.map(a=><tr key={a.id}><td style={cell}>{a.event_type}</td><td style={cell}>{a.target_type||'—'}</td><td style={cell}>{a.target_id||'—'}</td><td style={cell}>{dateLabel(a.created_at)}</td></tr>)}</tbody></table>{!audit.length&&<p style={{padding:18,color:'#8a95a5',fontSize:12}}>{isAdmin?'No audit records yet.':'Audit history is restricted to school administrators.'}</p>}</div></>}
   {current==='settings'&&<>{heading('Manage your school name and time zone.')}<form onSubmit={saveSchool} style={{...cardCss,maxWidth:620,display:'grid',gap:13}}><label style={fieldCss}>School name<input value={form.schoolName??school?.name??''} onChange={e=>updateForm('schoolName',e.target.value)} disabled={!isAdmin} style={inputCss}/></label><label style={fieldCss}>Time zone<select value={form.timezone??school?.timezone??'America/Chicago'} onChange={e=>updateForm('timezone',e.target.value)} disabled={!isAdmin} style={inputCss}>{['America/Chicago','America/New_York','America/Denver','America/Los_Angeles','America/Phoenix','America/Anchorage','Pacific/Honolulu'].map(x=><option key={x}>{x}</option>)}</select></label>{isAdmin?<button disabled={busy} style={{...buttonCss(true),justifySelf:'start'}}>Save school settings</button>:<p style={{fontSize:11,color:'#8792a3'}}>Only school administrators can edit these settings.</p>}</form></>}
   </>
   </div>}
  </div>
 </main>
 </div>;
}
