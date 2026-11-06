"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowLeft, FileSpreadsheet, Plus, Search, Upload, Users, X } from "lucide-react";

type Student = { id: string; name: string; grade: string; homeroom: string };

function parseCSV(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"') {
      if (quoted && input[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === "," && !quoted) { row.push(cell.trim()); cell = ""; }
    else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
      row = []; cell = "";
    } else cell += ch;
  }
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
  return rows;
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([
    { id: "10021", name: "Jordan Mitchell", grade: "10th", homeroom: "Room 214" },
    { id: "10022", name: "Ava Thompson", grade: "11th", homeroom: "Room 108" },
    { id: "10023", name: "Noah Williams", grade: "9th", homeroom: "Room 302" },
    { id: "10024", name: "Sofia Garcia", grade: "12th", homeroom: "Library" },
    { id: "10025", name: "Ethan Brooks", grade: "10th", homeroom: "Room 205" },
  ]);
  const [search, setSearch] = useState("");
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [fileName, setFileName] = useState("");
  const [columns, setColumns] = useState({ name: "", id: "", grade: "", homeroom: "" });
  const [newStudent, setNewStudent] = useState({ name: "", id: "", grade: "9th", homeroom: "" });
  const [showAdd, setShowAdd] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const headers = csvRows[0] || [];
  const mapped = useMemo(() => csvRows.slice(1).map(row => ({
    name: row[Number(columns.name)] || "", id: row[Number(columns.id)] || "",
    grade: row[Number(columns.grade)] || "", homeroom: row[Number(columns.homeroom)] || "",
  })), [csvRows, columns]);
  const valid = mapped.filter(row => row.name.trim() && row.id.trim());
  const duplicates = valid.filter(row => students.some(s => s.id.toLowerCase() === row.id.trim().toLowerCase() || s.name.toLowerCase() === row.name.trim().toLowerCase())).length;
  const visible = students.filter(s => [s.name, s.id, s.grade, s.homeroom].join(" ").toLowerCase().includes(search.toLowerCase()));

  function loadFile(file?: File) {
    if (!file) return;
    setFileName(file.name);
    file.text().then(text => {
      const rows = parseCSV(text);
      if (rows.length < 2) { alert("Add a header row and at least one student row."); return; }
      setCsvRows(rows);
      const normalized = rows[0].map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
      const find = (names: string[]) => {
        const index = normalized.findIndex(h => names.includes(h));
        return index < 0 ? "" : String(index);
      };
      setColumns({
        name: find(["name", "studentname", "fullname"]),
        id: find(["studentid", "id", "localid"]),
        grade: find(["grade", "gradeyear", "year"]),
        homeroom: find(["homeroom", "room", "advisor"]),
      });
    });
  }

  function importRows() {
    const additions = valid.filter(row => !students.some(s => s.id.toLowerCase() === row.id.trim().toLowerCase() || s.name.toLowerCase() === row.name.trim().toLowerCase()))
      .map(row => ({ id: row.id.trim(), name: row.name.trim(), grade: row.grade.trim() || "Not assigned", homeroom: row.homeroom.trim() || "Not assigned" }));
    setStudents(old => [...old, ...additions]);
    setCsvRows([]);
    setFileName("");
  }

  function addOne(e: React.FormEvent) {
    e.preventDefault();
    if (students.some(s => s.id === newStudent.id.trim() || s.name.toLowerCase() === newStudent.name.trim().toLowerCase())) {
      alert("That student ID or name already exists."); return;
    }
    setStudents(old => [...old, { ...newStudent, id: newStudent.id.trim(), name: newStudent.name.trim(), homeroom: newStudent.homeroom.trim() || "Not assigned" }]);
    setNewStudent({ name: "", id: "", grade: "9th", homeroom: "" }); setShowAdd(false);
  }

  return <main className="roster-page">
    <header className="roster-top"><a href="/">← Back to Pilot</a><span>pilot<span style={{color:"#4169e1"}}>.</span></span><span>Northstar High · Demo workspace</span></header>
    <section className="roster-content">
      <div className="roster-title"><div><div className="roster-kicker">SCHOOL WORKSPACE / DIRECTORY</div><h1>Student roster</h1><p>Manage students and import a school roster from a CSV spreadsheet.</p></div>
        <div className="roster-buttons"><button className="roster-secondary" onClick={() => fileRef.current?.click()}><Upload size={16}/> Import CSV</button><button className="roster-primary" onClick={() => setShowAdd(true)}><Plus size={16}/> Add student</button><input ref={fileRef} hidden type="file" accept=".csv,text/csv" onChange={e => loadFile(e.target.files?.[0])}/></div>
      </div>
      <div className="roster-metrics"><div><Users size={18}/><b>{students.length}</b><span>Students in demo roster</span></div><div><FileSpreadsheet size={18}/><b>CSV</b><span>Spreadsheet import supported</span></div></div>
      <div className="roster-list"><div className="roster-list-head"><h2>All students</h2><div className="roster-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search students..."/></div></div>
        <div className="roster-table-scroll"><table><thead><tr><th>STUDENT</th><th>STUDENT ID</th><th>GRADE</th><th>HOMEROOM</th><th>STATUS</th></tr></thead><tbody>{visible.map(s=><tr key={s.id}><td><b>{s.name}</b></td><td>{s.id}</td><td>{s.grade}</td><td>{s.homeroom}</td><td><span className="roster-active">Active</span></td></tr>)}</tbody></table>{!visible.length&&<p className="roster-empty">No students found.</p>}</div>
        <footer>{visible.length} students shown · Fictional sample records only</footer>
      </div>
      <p className="roster-warning">Pilot is currently a prototype. Changes are held in this page's temporary browser state and are not saved to a school database. Do not upload real student information.</p>
    </section>
    {showAdd&&<div className="roster-overlay"><form className="roster-modal" onSubmit={addOne}><button type="button" className="roster-x" onClick={()=>setShowAdd(false)}><X/></button><h2>Add student</h2><p>Add a student to the demo roster.</p><label>Full name<input required value={newStudent.name} onChange={e=>setNewStudent(v=>({...v,name:e.target.value}))}/></label><label>Student ID<input required value={newStudent.id} onChange={e=>setNewStudent(v=>({...v,id:e.target.value}))}/></label><label>Grade<select value={newStudent.grade} onChange={e=>setNewStudent(v=>({...v,grade:e.target.value}))}>{["6th","7th","8th","9th","10th","11th","12th"].map(g=><option key={g}>{g}</option>)}</select></label><label>Homeroom<input value={newStudent.homeroom} onChange={e=>setNewStudent(v=>({...v,homeroom:e.target.value}))}/></label><button className="roster-primary" type="submit">Add student</button></form></div>}
    {csvRows.length>0&&<div className="roster-overlay"><div className="roster-modal roster-import"><button className="roster-x" onClick={()=>setCsvRows([])}><X/></button><div className="roster-kicker">CSV IMPORT · {fileName}</div><h2>Review your spreadsheet</h2><p>Match spreadsheet columns to Pilot fields before importing.</p><div className="roster-mapping">{([["name","Student name",true],["id","Student ID",true],["grade","Grade",false],["homeroom","Homeroom",false]] as const).map(([key,label,required])=><label key={key}>{label}{required?" *":""}<select value={columns[key]} onChange={e=>setColumns(old=>({...old,[key]:e.target.value}))}><option value="">{required?"Choose a column":"Skip field"}</option>{headers.map((h,i)=><option key={i} value={String(i)}>{h}</option>)}</select></label>)}</div><div className="roster-import-stats"><span><b>{valid.length}</b> usable rows</span><span><b>{duplicates}</b> duplicates skipped</span><span><b>{mapped.length-valid.length}</b> incomplete</span></div><div className="roster-table-scroll"><table><thead><tr><th>NAME</th><th>ID</th><th>GRADE</th><th>HOMEROOM</th></tr></thead><tbody>{mapped.slice(0,5).map((r,i)=><tr key={i}><td>{r.name||"Missing"}</td><td>{r.id||"Missing"}</td><td>{r.grade||"—"}</td><td>{r.homeroom||"—"}</td></tr>)}</tbody></table></div><p className="roster-warning">Rows without a name or ID are skipped. Duplicate IDs or names are skipped. This demo does not write to a database.</p><div className="roster-modal-actions"><button className="roster-secondary" onClick={()=>setCsvRows([])}>Cancel</button><button className="roster-primary" disabled={!columns.name||!columns.id||valid.length===0} onClick={importRows}>Import {valid.length-duplicates} students</button></div></div></div>}
  </main>;
}
