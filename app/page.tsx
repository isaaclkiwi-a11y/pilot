"use client";

import { useMemo, useState } from "react";
import {
  Activity, ArrowDownRight, ArrowUpRight, Bell, BookOpen, CalendarDays,
  Check, ChevronDown, Clock3, Command, FileBarChart, GraduationCap,
  LayoutDashboard, MapPin, Menu, MoreHorizontal, Plus, Search, Settings,
  ShieldCheck, Users, X, CheckCircle2, CircleAlert, DoorOpen, ClipboardList
} from "lucide-react";

type PassStatus = "Active" | "Pending" | "Returned" | "Overdue";
type Pass = { id:number; student:string; initials:string; grade:string; from:string; to:string; reason:string; time:string; duration:number; status:PassStatus };

const initialPasses: Pass[] = [
  {id:1,student:"Jordan Mitchell",initials:"JM",grade:"10th",from:"Room 214",to:"Restroom",reason:"Restroom",time:"10:42 AM",duration:8,status:"Active"},
  {id:2,student:"Ava Thompson",initials:"AT",grade:"11th",from:"Room 108",to:"Counseling",reason:"Counselor visit",time:"10:39 AM",duration:15,status:"Pending"},
  {id:3,student:"Noah Williams",initials:"NW",grade:"9th",from:"Room 302",to:"Main Office",reason:"Office visit",time:"10:31 AM",duration:10,status:"Active"},
  {id:4,student:"Sofia Garcia",initials:"SG",grade:"12th",from:"Library",to:"Room 116",reason:"Class transition",time:"10:18 AM",duration:5,status:"Returned"},
  {id:5,student:"Ethan Brooks",initials:"EB",grade:"10th",from:"Room 205",to:"Nurse",reason:"Nurse visit",time:"10:05 AM",duration:20,status:"Overdue"},
];

const navGroups = [
  {label:"WORKSPACE",items:[["Overview",LayoutDashboard],["Hall passes",DoorOpen],["Students",GraduationCap],["Staff directory",Users]]},
  {label:"SCHOOL",items:[["Attendance",ClipboardList],["Schedule",CalendarDays],["Announcements",BookOpen]]},
  {label:"INSIGHTS",items:[["Analytics",FileBarChart],["Activity log",Activity],["Settings",Settings]]},
] as const;

function IconBadge({children, tone="blue"}:{children:React.ReactNode;tone?:string}) {
  return <span className={`icon-badge ${tone}`}>{children}</span>;
}
function Status({status}:{status:PassStatus}) {
  return <span className={`status status-${status.toLowerCase()}`}><i />{status}</span>;
}

export default function Home() {
  const [passes,setPasses] = useState(initialPasses);
  const [activeNav,setActiveNav] = useState("Overview");
  const [query,setQuery] = useState("");
  const [filter,setFilter] = useState("All passes");
  const [modal,setModal] = useState(false);
  const [notice,setNotice] = useState("");
  const [mobileOpen,setMobileOpen] = useState(false);
  const [student,setStudent] = useState("");
  const [destination,setDestination] = useState("Restroom");
  const [reason,setReason] = useState("Restroom");
  const [limit,setLimit] = useState("10");

  const visible = useMemo(()=>passes.filter(p=>
    (filter==="All passes" || p.status===filter) &&
    [p.student,p.to,p.from,p.reason].join(" ").toLowerCase().includes(query.toLowerCase())
  ),[passes,filter,query]);

  function toast(message:string){setNotice(message);window.setTimeout(()=>setNotice(""),2800);}
  function approve(id:number){setPasses(old=>old.map(p=>p.id===id?{...p,status:"Active"}:p));toast("Pass approved");}
  function deny(id:number){setPasses(old=>old.filter(p=>p.id!==id));toast("Pass denied");}
  function returned(id:number){setPasses(old=>old.map(p=>p.id===id?{...p,status:"Returned"}:p));toast("Student marked as returned");}
  function createPass(e:React.FormEvent){e.preventDefault();if(!student.trim())return;setPasses(old=>[{id:Math.max(0,...old.map(p=>p.id))+1,student:student.trim(),initials:student.trim().split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase(),grade:"—",from:"Classroom",to:destination,reason,time:"Just now",duration:Number(limit),status:"Pending"},...old]);setStudent("");setModal(false);toast("Pass request created");}

  const activeCount=passes.filter(p=>p.status==="Active"||p.status==="Overdue").length;
  const pending=passes.filter(p=>p.status==="Pending");
  const sections = ["Overview","Hall passes","Students","Staff directory","Attendance","Schedule","Announcements","Analytics","Activity log","Settings"];

  return <main className="app-shell">
    <aside className={`sidebar ${mobileOpen?"sidebar-open":""}`}>
      <div className="brand"><div className="brand-mark"><Command size={19}/></div><span>pilot<span className="brand-dot">.</span></span><button className="mobile-close" onClick={()=>setMobileOpen(false)}><X size={18}/></button></div>
      <div className="school-switch"><div className="school-avatar">N</div><div><b>Northstar High</b><small>School workspace</small></div><ChevronDown size={15}/></div>
      <nav>{navGroups.map(group=><div className="nav-group" key={group.label}><p>{group.label}</p>{group.items.map(([label,ItemIcon])=><button key={label} className={activeNav===label?"nav-item selected":"nav-item"} onClick={()=>{if(label==="Students"){window.location.href="/students";return;}setActiveNav(label);setMobileOpen(false);}}><ItemIcon size={17}/><span>{label}</span>{label==="Hall passes"&&<em>5</em>}</button>)}</div>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><ShieldCheck size={17}/></div><b>Everything in sync</b><p>Your school workspace is ready to go.</p><span>PROTOTYPE ENVIRONMENT</span></div><div className="profile"><div className="profile-avatar">AC</div><div><b>Alex Carter</b><small>School administrator</small></div><MoreHorizontal size={18}/></div></div>
    </aside>
    {mobileOpen&&<button className="scrim" onClick={()=>setMobileOpen(false)} aria-label="Close navigation"/>}
    <section className="main-area">
      <header className="topbar"><div className="crumb"><button className="hamburger" onClick={()=>setMobileOpen(true)}><Menu size={20}/></button><span>Workspace</span><b>/</b><strong>{activeNav}</strong></div><div className="top-actions"><span className="today">Thursday, November 5</span><button className="icon-button" onClick={()=>toast("You're all caught up")} aria-label="Notifications"><Bell size={18}/><i/></button><div className="top-avatar">AC</div></div></header>
      <div className="content">
        <div className="page-heading"><div><div className="eyebrow">THURSDAY, NOVEMBER 5, 2026</div><h1>{activeNav==="Overview"?"Good afternoon, Alex":activeNav}</h1><p>{activeNav==="Overview"?"Here's what's happening across your campus today.":"Your school workspace at a glance."}</p></div><button className="primary-button" onClick={()=>setModal(true)}><Plus size={17}/> Create pass</button></div>
        <div className="stat-grid">
          <article className="stat-card"><div className="stat-top"><span>Active passes</span><IconBadge><DoorOpen size={17}/></IconBadge></div><div className="stat-value">{activeCount.toString().padStart(2,"0")}<small className="trend"><ArrowUpRight size={13}/> Live</small></div><div className="stat-foot">Currently away from class</div></article>
          <article className="stat-card"><div className="stat-top"><span>Awaiting approval</span><IconBadge tone="amber"><Clock3 size={17}/></IconBadge></div><div className="stat-value">{pending.length.toString().padStart(2,"0")}</div><div className="stat-foot">Requests need your attention</div></article>
          <article className="stat-card"><div className="stat-top"><span>Passes today</span><IconBadge tone="violet"><ClipboardList size={17}/></IconBadge></div><div className="stat-value">{(passes.length+38).toString().padStart(2,"0")}<small className="trend muted"><ArrowUpRight size={13}/> 12%</small></div><div className="stat-foot">Compared to yesterday</div></article>
          <article className="stat-card"><div className="stat-top"><span>Avg. duration</span><IconBadge tone="green"><Activity size={17}/></IconBadge></div><div className="stat-value">8.4 <small className="unit">min</small></div><div className="stat-foot"><ArrowDownRight size={13} className="good"/> 1.2 min from last week</div></article>
        </div>
        <div className="dashboard-grid">
          <section className="panel pass-panel"><div className="panel-heading"><div><h2>Live pass activity</h2><p>Track student movement across campus</p></div><button className="text-button" onClick={()=>setActiveNav("Hall passes")}>View all <ArrowUpRight size={14}/></button></div>
            <div className="table-tools"><div className="search-box"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search students or locations..."/></div><select value={filter} onChange={e=>setFilter(e.target.value)}><option>All passes</option><option>Active</option><option>Pending</option><option>Returned</option><option>Overdue</option></select></div>
            <div className="table-wrap"><table><thead><tr><th>STUDENT</th><th>DESTINATION</th><th>TIME</th><th>STATUS</th><th/></tr></thead><tbody>{visible.map(p=><tr key={p.id}><td><div className="student-cell"><span className="student-avatar">{p.initials}</span><div><b>{p.student}</b><small>{p.grade} · {p.from}</small></div></div></td><td><div className="destination"><MapPin size={14}/>{p.to}</div></td><td><span className="time-cell">{p.time}</span></td><td><Status status={p.status}/></td><td><div className="row-actions">{p.status==="Pending"?<><button title="Approve" onClick={()=>approve(p.id)}><Check size={15}/></button><button title="Deny" onClick={()=>deny(p.id)}><X size={15}/></button></>:p.status==="Active"||p.status==="Overdue"?<button className="return-action" onClick={()=>returned(p.id)}>Mark returned</button>:<span className="done-icon"><CheckCircle2 size={16}/></span>}</div></td></tr>)}</tbody></table>{visible.length===0&&<div className="empty">No passes match that search.</div>}</div>
            <div className="panel-footer"><span>Showing {visible.length} of {passes.length} recent passes</span><span className="live-dot"><i/> Updates instantly in this demo</span></div>
          </section>
          <section className="panel approval-panel"><div className="panel-heading"><div><h2>Approval queue <span className="count-pill">{pending.length}</span></h2><p>Requests waiting for a response</p></div><button className="more-button" onClick={()=>toast("Approval queue options") }><MoreHorizontal size={19}/></button></div>
            {pending.length?pending.map(p=><div className="approval-item" key={p.id}><div className="student-avatar large">{p.initials}</div><div className="approval-info"><b>{p.student}</b><small>{p.reason} · {p.from}</small><span><MapPin size={12}/>{p.to} <i>·</i> {p.duration} min</span></div><div className="approval-actions"><button className="approve" onClick={()=>approve(p.id)}><Check size={15}/></button><button className="deny" onClick={()=>deny(p.id)}><X size={15}/></button></div></div>):<div className="approval-empty"><CheckCircle2 size={23}/><b>All caught up</b><span>No requests waiting for approval.</span></div>}
            <button className="queue-link" onClick={()=>setFilter("Pending")}>Open approval queue <ArrowUpRight size={14}/></button>
          </section>
        </div>
        <div className="bottom-grid"><section className="panel locations"><div className="panel-heading"><div><h2>Campus locations</h2><p>Active movement by destination</p></div><button className="more-button" onClick={()=>toast("Location management is coming soon")}><MoreHorizontal size={19}/></button></div>{[["Restroom",3,6],["Main Office",2,4],["Counseling",1,3],["Nurse",1,3]].map(([name,count,total])=><div className="location-row" key={name as string}><span><MapPin size={14}/>{name}</span><div className="location-bar"><i style={{width:`${Number(count)/Number(total)*100}%`}}/></div><b>{count}</b></div>)}<div className="location-note"><span className="live-dot"><i/> Live occupancy</span><span>Campus capacity overview</span></div></section>
          <section className="panel activity"><div className="panel-heading"><div><h2>Recent activity</h2><p>A quick look at what's changed</p></div><button className="text-button" onClick={()=>setActiveNav("Activity log")}>View log <ArrowUpRight size={14}/></button></div><div className="activity-list"><div><span className="activity-symbol approved"><Check size={14}/></span><p><b>Pass approved</b><small>Jordan Mitchell · Restroom</small></p><time>2m ago</time></div><div><span className="activity-symbol created"><Plus size={14}/></span><p><b>New pass created</b><small>Ava Thompson · Counseling</small></p><time>8m ago</time></div><div><span className="activity-symbol returned"><CheckCircle2 size={14}/></span><p><b>Student returned</b><small>Sofia Garcia · Room 116</small></p><time>14m ago</time></div></div></section></div>
        <div className="prototype-note"><ShieldCheck size={15}/> Pilot is a prototype. All displayed student records are fictional sample data.</div>
      </div>
    </section>
    {modal&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setModal(false)}}><form className="modal" onSubmit={createPass}><div className="modal-heading"><div><span className="eyebrow">NEW REQUEST</span><h2>Create a hall pass</h2><p>Enter the details to create a student pass.</p></div><button type="button" className="icon-button" onClick={()=>setModal(false)}><X size={18}/></button></div><label>Choose student<select autoFocus value={student} onChange={e=>setStudent(e.target.value)} required><option value="">Select a student from the roster</option>{[{id:"10021",name:"Jordan Mitchell",grade:"10th"},{id:"10022",name:"Ava Thompson",grade:"11th"},{id:"10023",name:"Noah Williams",grade:"9th"},{id:"10024",name:"Sofia Garcia",grade:"12th"},{id:"10025",name:"Ethan Brooks",grade:"10th"}].map(s=><option key={s.id} value={s.name}>{s.name} · {s.grade} · {s.id}</option>)}</select></label><label>Destination<select value={destination} onChange={e=>setDestination(e.target.value)}><option>Restroom</option><option>Main Office</option><option>Counseling</option><option>Nurse</option><option>Library</option></select></label><label>Reason<select value={reason} onChange={e=>setReason(e.target.value)}><option>Restroom</option><option>Counselor visit</option><option>Office visit</option><option>Nurse visit</option><option>Other</option></select></label><label>Time limit<select value={limit} onChange={e=>setLimit(e.target.value)}><option value="5">5 minutes</option><option value="10">10 minutes</option><option value="15">15 minutes</option><option value="20">20 minutes</option></select></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={()=>setModal(false)}>Cancel</button><button className="primary-button" type="submit"><Plus size={16}/> Create pass</button></div></form></div>}
    {notice&&<div className="toast"><CheckCircle2 size={17}/>{notice}</div>}
  </main>;
}
