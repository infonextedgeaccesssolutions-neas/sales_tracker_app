import { useState, useEffect, useRef, useCallback } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import * as XLSX from "xlsx";

const PRIMARY = "#1D9E75";
const STATUS_CONFIG = {
  Win:          { color: "#1D9E75", bg: "#E1F5EE", text: "#085041" },
  Loss:         { color: "#E24B4A", bg: "#FCEBEB", text: "#501313" },
  Negotiation:  { color: "#378ADD", bg: "#E6F1FB", text: "#042C53" },
  "On-bidding": { color: "#EF9F27", bg: "#FAEEDA", text: "#412402" },
  Revision:     { color: "#D4537E", bg: "#FBEAF0", text: "#4B1528" },
};
const STATUS_OPTIONS = ["Win", "Loss", "Negotiation", "On-bidding", "Revision"];

const fmtM = (n) => { const v = Number(n||0); return v>=1e6 ? "₱"+(v/1e6).toFixed(1)+"M" : v>=1e3 ? "₱"+(v/1e3).toFixed(0)+"K" : "₱"+v.toFixed(0); };
const fmtFull = (n) => "₱"+Number(n||0).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtPct = (n) => (Number(n||0)*100).toFixed(1)+"%";
const numVal = (v) => parseFloat(String(v).replace(/[^0-9.-]/g,""))||0;

const SEED_DATA = [
  {id:1,  status:"Revision",    proposal:"PCORP-001-26", cost:34000000,    markup:0.20, revisions:32000000,   winRate:0,   comments:"Serendra 2 Alveo"},
  {id:2,  status:"Loss",        proposal:"PCORP-002-26", cost:11586094.43, markup:0.25, revisions:0,          winRate:0,   comments:"Alveo"},
  {id:3,  status:"Negotiation", proposal:"PCORP-003-26", cost:7827388.53,  markup:0.25, revisions:3629947.46, winRate:0.7, comments:"ACEN"},
  {id:4,  status:"On-bidding",  proposal:"PCORP-004-26", cost:578970.77,   markup:0.25, revisions:0,          winRate:0.3, comments:""},
  {id:5,  status:"On-bidding",  proposal:"PCORP-005-26", cost:2671382.72,  markup:0.25, revisions:0,          winRate:0.5, comments:"ACEN"},
  {id:6,  status:"Negotiation", proposal:"PCORP-006-26", cost:3685582.20,  markup:0.25, revisions:0,          winRate:0.9, comments:"Park Terraces"},
  {id:7,  status:"On-bidding",  proposal:"PCORP-007-26", cost:67924931.44, markup:0.25, revisions:0,          winRate:0.1, comments:""},
  {id:8,  status:"On-bidding",  proposal:"PCORP-008-26", cost:11067983.77, markup:0.25, revisions:0,          winRate:0.1, comments:"ACEN"},
  {id:9,  status:"Win",         proposal:"PCORP-009-26", cost:1223040,     markup:0.10, revisions:1223040,    winRate:1.0, comments:"Manpower 1Yr / Jangho"},
  {id:10, status:"On-bidding",  proposal:"PCORP-010-26", cost:11477183.54, markup:0.25, revisions:9557337.23, winRate:0.1, comments:""},
  {id:11, status:"On-bidding",  proposal:"PCORP-011-26", cost:1382754.45,  markup:0.25, revisions:2382754.45, winRate:0.1, comments:""},
  {id:12, status:"Loss",        proposal:"PCORP-012-26", cost:4615637.72,  markup:0.25, revisions:0,          winRate:0,   comments:""},
];

let _id = SEED_DATA.length + 1;

function computeRow(r) {
  const mv = (r.cost||0)*(r.markup||0), isWin=r.status==="Win", isLoss=r.status==="Loss";
  return { ...r, markupValue:isWin?mv:0, totalRevenue:isWin?(r.cost||0)+mv:0, totalSold:isWin?1:0,
    totalSales:isWin?(r.cost||0)+mv:0, pipelineValue:(!isWin&&!isLoss)?(r.cost||0):0 };
}

function autoStatus(wr, rev) {
  if(wr>=1) return "Win"; if(wr>=0.6) return "Negotiation"; if(wr>0) return "On-bidding";
  if(rev>0) return "Revision"; return "Loss";
}

const blankRow = () => ({ id:_id++, status:"On-bidding", proposal:`PCORP-${String(_id).padStart(3,"0")}-26`,
  cost:0, markup:0.25, revisions:0, winRate:0.5, comments:"" });

function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ fontSize:10, fontWeight:500, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.5px", display:"block", marginBottom:5 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize:10, color:"var(--color-text-tertiary)", marginTop:3 }}>{hint}</div>}
    </div>
  );
}

function Input({ value, onChange, type="text", placeholder="" }) {
  return <input type={type} value={value??""} placeholder={placeholder} onChange={onChange}
    style={{ width:"100%", fontSize:13, padding:"9px 12px", borderRadius:8, border:"0.5px solid var(--color-border-secondary)",
      background:"var(--color-background-secondary)", color:"var(--color-text-primary)", boxSizing:"border-box" }} />;
}

function Select({ value, onChange, options }) {
  return <select value={value} onChange={onChange}
    style={{ width:"100%", fontSize:13, padding:"9px 12px", borderRadius:8, border:"0.5px solid var(--color-border-secondary)",
      background:"var(--color-background-secondary)", color:"var(--color-text-primary)" }}>
    {options.map(o=><option key={o}>{o}</option>)}
  </select>;
}

function Badge({ status }) {
  const c = STATUS_CONFIG[status]||{bg:"#eee",text:"#333",color:"#999"};
  return <span style={{ fontSize:11, fontWeight:500, padding:"3px 9px", borderRadius:20, background:c.bg, color:c.text, display:"inline-block" }}>{status}</span>;
}

function Toast({ toast }) {
  if (!toast) return null;
  const ok = toast.type !== "danger";
  return (
    <div style={{ position:"absolute", top:14, left:"50%", transform:"translateX(-50%)", zIndex:200, padding:"10px 20px",
      borderRadius:20, background:ok?"#E1F5EE":"#FCEBEB", color:ok?"#085041":"#501313", fontSize:13, fontWeight:500,
      border:`0.5px solid ${ok?"#5DCAA5":"#F09595"}`, whiteSpace:"nowrap", boxShadow:"0 2px 16px rgba(0,0,0,0.13)" }}>
      {ok?"✓ ":"✗ "}{toast.msg}
    </div>
  );
}

function ProposalCard({ row, onEdit, onDelete }) {
  const c = STATUS_CONFIG[row.status]||{};
  return (
    <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)",
      borderRadius:12, overflow:"hidden", marginBottom:8 }}>
      <div style={{ borderLeft:`3px solid ${c.color||"#ccc"}`, padding:"12px 14px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:7 }}>
            <Badge status={row.status} />
            <span style={{ fontSize:13, fontWeight:500 }}>{row.proposal}</span>
          </div>
          <div style={{ display:"flex", gap:4 }}>
            <button onClick={()=>onEdit(row)} style={{ background:"var(--color-background-secondary)", border:"none",
              borderRadius:6, padding:"5px 11px", fontSize:12, cursor:"pointer", color:"var(--color-text-secondary)", fontWeight:500 }}>Edit</button>
            <button onClick={()=>onDelete(row.id)} style={{ background:"none", border:"none", padding:"5px 8px", cursor:"pointer",
              color:"var(--color-text-tertiary)", fontSize:15 }}>✕</button>
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:"6px 8px" }}>
          <Stat label="Cost" val={fmtM(row.cost)} />
          <Stat label="Markup" val={fmtPct(row.markup)} />
          <Stat label="Win Rate" val={fmtPct(row.winRate)} />
          {row.pipelineValue>0 && <Stat label="Pipeline" val={fmtM(row.pipelineValue)} color="#378ADD" />}
          {row.totalRevenue>0 && <Stat label="Revenue" val={fmtM(row.totalRevenue)} color="#1D9E75" />}
          {row.revisions>0 && <Stat label="Revisions" val={fmtM(row.revisions)} color={STATUS_CONFIG.Revision.color} />}
        </div>
        {row.comments && <div style={{ marginTop:8, fontSize:11, color:"var(--color-text-secondary)", borderTop:"0.5px solid var(--color-border-tertiary)", paddingTop:8 }}>💬 {row.comments}</div>}
      </div>
    </div>
  );
}

function Stat({ label, val, color }) {
  return <div><div style={{ fontSize:10, color:"var(--color-text-tertiary)", textTransform:"uppercase", letterSpacing:"0.3px" }}>{label}</div>
    <div style={{ fontSize:12, fontWeight:500, color:color||"var(--color-text-primary)" }}>{val}</div></div>;
}

function KpiCard({ label, val, color, sub }) {
  return (
    <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:10, padding:"12px 14px" }}>
      <div style={{ fontSize:10, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:21, fontWeight:500, color:color||"var(--color-text-primary)" }}>{val}</div>
      {sub && <div style={{ fontSize:10, color:"var(--color-text-tertiary)", marginTop:2 }}>{sub}</div>}
    </div>
  );
}

function NavBtn({ id, icon, label, active, onClick }) {
  return (
    <button onClick={onClick} style={{ flex:1, padding:"9px 4px", border:"none", background:"none", cursor:"pointer",
      display:"flex", flexDirection:"column", alignItems:"center", gap:3, color:active?"#1D9E75":"var(--color-text-secondary)",
      borderTop:active?"2px solid #1D9E75":"2px solid transparent", transition:"color 0.15s" }}>
      <span style={{ fontSize:id==="add"?19:15, lineHeight:1, fontWeight:id==="add"?500:400 }}>{icon}</span>
      <span style={{ fontSize:10, fontWeight:active?500:400 }}>{label}</span>
    </button>
  );
}

function BottomSheet({ title, onClose, children }) {
  return (
    <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.38)", display:"flex", flexDirection:"column",
      justifyContent:"flex-end", zIndex:100 }} onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={{ background:"var(--color-background-primary)", borderRadius:"14px 14px 0 0", maxHeight:"82%", display:"flex", flexDirection:"column" }}
        onClick={e=>e.stopPropagation()}>
        <div style={{ padding:"14px 16px 10px", borderBottom:"0.5px solid var(--color-border-tertiary)",
          display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
          <span style={{ fontSize:14, fontWeight:500 }}>{title}</span>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:18, cursor:"pointer", color:"var(--color-text-secondary)", lineHeight:1 }}>✕</button>
        </div>
        <div style={{ overflowY:"auto", flex:1 }}>{children}</div>
      </div>
    </div>
  );
}

function RowForm({ row, onChange, onSave, onCancel, isNew }) {
  const c = computeRow(row);
  const update = (k,v) => { const u={...row,[k]:v}; if(k==="winRate"||k==="revisions") u.status=autoStatus(k==="winRate"?v:row.winRate,k==="revisions"?v:row.revisions); onChange(u); };
  return (
    <div style={{ padding:"16px 16px 8px" }}>
      <Field label="Proposal #"><Input value={row.proposal} onChange={e=>update("proposal",e.target.value)} /></Field>
      <Field label="Status"><Select value={row.status} onChange={e=>update("status",e.target.value)} options={STATUS_OPTIONS} /></Field>
      <Field label="Cost Proposal (₱)"><Input type="number" value={row.cost} onChange={e=>update("cost",numVal(e.target.value))} /></Field>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <Field label="Markup % (e.g. 0.25)"><Input type="number" value={row.markup} onChange={e=>update("markup",numVal(e.target.value))} /></Field>
        <Field label="Win Rate (0–1)"><Input type="number" value={row.winRate} onChange={e=>update("winRate",numVal(e.target.value))} /></Field>
      </div>
      <Field label="Revisions (₱)"><Input type="number" value={row.revisions} onChange={e=>update("revisions",numVal(e.target.value))} /></Field>
      <Field label="Comments"><Input value={row.comments} onChange={e=>update("comments",e.target.value)} /></Field>

      <div style={{ background:"var(--color-background-secondary)", borderRadius:8, padding:"10px 12px", marginBottom:14 }}>
        <div style={{ fontSize:10, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.4px", marginBottom:7 }}>Computed preview</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"5px 12px", fontSize:12 }}>
          <div><span style={{ color:"var(--color-text-tertiary)" }}>Auto Status: </span><span style={{ fontWeight:500, color:STATUS_CONFIG[row.status]?.color }}>{row.status}</span></div>
          <div><span style={{ color:"var(--color-text-tertiary)" }}>Revenue: </span><span style={{ fontWeight:500, color:"#1D9E75" }}>{fmtM(c.totalRevenue)}</span></div>
          <div><span style={{ color:"var(--color-text-tertiary)" }}>Pipeline: </span><span style={{ fontWeight:500, color:"#378ADD" }}>{fmtM(c.pipelineValue)}</span></div>
          <div><span style={{ color:"var(--color-text-tertiary)" }}>Markup Val: </span><span style={{ fontWeight:500 }}>{fmtM(c.markupValue)}</span></div>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, paddingBottom:16 }}>
        <button onClick={onCancel} style={{ padding:"11px", borderRadius:9, fontSize:14, cursor:"pointer",
          background:"var(--color-background-secondary)", border:"0.5px solid var(--color-border-secondary)", color:"var(--color-text-secondary)" }}>Cancel</button>
        <button onClick={()=>onSave(row)} style={{ padding:"11px", borderRadius:9, fontSize:14, cursor:"pointer",
          background:"#1D9E75", color:"#fff", border:"none", fontWeight:500 }}>{isNew?"Add Proposal":"Save Changes"}</button>
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [rows, setRows] = useState(SEED_DATA);
  const [editRow, setEditRow] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [filterStatus, setFilterStatus] = useState("All");
  const [toast, setToast] = useState(null);
  const [gsConfig, setGsConfig] = useState({ id:"", apiKey:"", csvUrl:"", sheetName:"SALES TRACKER" });
  const [syncStatus, setSyncStatus] = useState("idle");
  const [autoSync, setAutoSync] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const fileRef = useRef();
  const syncTimerRef = useRef();

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get("sales_rows_v2");
        if (r?.value) setRows(JSON.parse(r.value));
        const g = await window.storage.get("gs_config_v2");
        if (g?.value) setGsConfig(JSON.parse(g.value));
      } catch {}
    })();
  }, []);

  const saveRows = useCallback(async (next) => {
    setRows(next);
    try { await window.storage.set("sales_rows_v2", JSON.stringify(next)); } catch {}
  }, []);

  const saveGs = async (cfg) => {
    setGsConfig(cfg);
    try { await window.storage.set("gs_config_v2", JSON.stringify(cfg)); } catch {}
  };

  const showToast = (msg, type="success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    clearInterval(syncTimerRef.current);
    if (autoSync && (gsConfig.id || gsConfig.csvUrl)) {
      syncTimerRef.current = setInterval(pullFromSheets, 30000);
    }
    return () => clearInterval(syncTimerRef.current);
  }, [autoSync, gsConfig]);

  const computed = rows.map(computeRow);
  const filtered = filterStatus === "All" ? computed : computed.filter(r => r.status === filterStatus);

  const stats = {
    n:       rows.length,
    cost:    computed.reduce((s,r)=>s+(r.cost||0),0),
    rev:     computed.reduce((s,r)=>s+r.totalRevenue,0),
    pipe:    computed.reduce((s,r)=>s+r.pipelineValue,0),
    revise:  computed.reduce((s,r)=>s+(r.revisions||0),0),
    wins:    computed.filter(r=>r.status==="Win").length,
    wr:      rows.length ? computed.filter(r=>r.status==="Win").length/rows.length : 0,
    markup:  rows.length ? rows.reduce((s,r)=>s+(r.markup||0),0)/rows.length : 0,
  };

  const statusCounts = STATUS_OPTIONS.map(s => ({
    name:s, value:computed.filter(r=>r.status===s).length, color:STATUS_CONFIG[s].color
  }));

  const pipeData = computed.filter(r=>r.pipelineValue>0).sort((a,b)=>b.pipelineValue-a.pipelineValue).slice(0,6)
    .map(r => ({ name:r.proposal.replace("PCORP-","#").replace("-26",""), val:+(r.pipelineValue/1e6).toFixed(2), color:STATUS_CONFIG[r.status]?.color }));

  async function pullFromSheets() {
    const { id, apiKey, csvUrl, sheetName } = gsConfig;
    if (!id && !csvUrl) { showToast("Configure Google Sheets first", "danger"); return; }
    setSyncStatus("pulling"); setSpinning(true);
    try {
      let values;
      if (csvUrl) {
        const resp = await fetch(csvUrl);
        if (!resp.ok) throw new Error("Failed to fetch CSV");
        const text = await resp.text();
        const wb = XLSX.read(text, { type:"string" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        values = XLSX.utils.sheet_to_json(ws, { header:1, defval:"" });
      } else {
        const range = encodeURIComponent(`${sheetName||"SALES TRACKER"}!A:M`);
        const resp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${range}?key=${apiKey}`);
        const data = await resp.json();
        if (data.error) throw new Error(data.error.message);
        values = data.values || [];
      }
      const hi = values.findIndex(r => String(r[0]).toLowerCase().trim() === "status");
      if (hi < 0) throw new Error("Status header not found");
      let idx = _id;
      const imported = values.slice(hi+1).filter(r=>STATUS_OPTIONS.includes(String(r[0]).trim())).map(r => ({
        id:idx++, status:String(r[0]).trim(), proposal:String(r[1]||""), cost:numVal(r[2]),
        markup:numVal(r[3]), revisions:numVal(r[7]), winRate:numVal(r[8]), comments:String(r[12]||"")
      }));
      _id = idx;
      saveRows(imported);
      setSyncStatus("success"); setSpinning(false);
      showToast(`Pulled ${imported.length} rows`);
      setTimeout(()=>setSyncStatus("idle"),3000);
    } catch (err) {
      setSyncStatus("error"); setSpinning(false);
      showToast("Pull failed: " + err.message, "danger");
      setTimeout(()=>setSyncStatus("idle"),4000);
    }
  }

  async function pushToSheets() {
    const { id, apiKey, sheetName } = gsConfig;
    if (!id || !apiKey) { showToast("Enter Sheet ID and API Key", "danger"); return; }
    setSyncStatus("pushing"); setSpinning(true);
    try {
      const header = ["Status","Proposal #","Cost Proposal (₱)","Markup %","Markup Value (₱)","Total Revenue (₱)","Total Sold","Revisions (₱)","Win Rate","Loss Rate","Total Sales (₱)","Pipeline Value (₱)","Comments"];
      const data = computed.map(r=>[r.status,r.proposal,r.cost,r.markup,r.markupValue,r.totalRevenue,r.totalSold,r.revisions,r.winRate,1-r.winRate,r.totalSales,r.pipelineValue,r.comments]);
      const range = `${sheetName||"SALES TRACKER"}!A5:M${5+data.length}`;
      const resp = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED&key=${apiKey}`,
        { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ range, majorDimension:"ROWS", values:[header,...data] }) }
      );
      const result = await resp.json();
      if (result.error) {
        const msg = result.error.code===403 ? "Permission denied. Sheet must be publicly editable or use OAuth." : result.error.message;
        throw new Error(msg);
      }
      setSyncStatus("success"); setSpinning(false);
      showToast("Pushed to Google Sheets");
      setTimeout(()=>setSyncStatus("idle"),3000);
    } catch (err) {
      setSyncStatus("error"); setSpinning(false);
      showToast(err.message, "danger");
      setTimeout(()=>setSyncStatus("idle"),4000);
    }
  }

  function parseAndImport(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type:"array" });
        const ws = wb.Sheets["SALES TRACKER"] || wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { header:1, defval:"" });
        const hi = raw.findIndex(r=>String(r[0]).toLowerCase().includes("status"));
        if (hi<0) { showToast("Header not found","danger"); return; }
        let idx=_id;
        const imported = raw.slice(hi+1).filter(r=>STATUS_OPTIONS.includes(String(r[0]).trim()))
          .map(r=>({id:idx++,status:String(r[0]).trim(),proposal:String(r[1]||""),cost:numVal(r[2]),markup:numVal(r[3]),revisions:numVal(r[7]),winRate:numVal(r[8]),comments:String(r[12]||"")}));
        _id=idx;
        saveRows(imported);
        showToast(`Imported ${imported.length} rows`);
        setTab("tracker");
      } catch(err) { showToast("Import failed: "+err.message,"danger"); }
    };
    reader.readAsArrayBuffer(file);
  }

  function exportXlsx() {
    const header = ["Status","Proposal #","Cost Proposal (₱)","Markup %","Markup Value (₱)","Total Revenue (₱)","Total Sold","Revisions (₱)","Win Rate","Loss Rate","Total Sales (₱)","Pipeline Value (₱)","Comments"];
    const data = computed.map(r=>[r.status,r.proposal,r.cost,r.markup,r.markupValue,r.totalRevenue,r.totalSold,r.revisions,r.winRate,1-r.winRate,r.totalSales,r.pipelineValue,r.comments]);
    const ws = XLSX.utils.aoa_to_sheet([header,...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SALES TRACKER");
    const dash = [
      ["SALES DASHBOARD — FY 2026"],[""],
      ["Total Proposals","Won","Win Rate","Pipeline Value","Total Revenue","Total Cost"],
      [stats.n,stats.wins,stats.wr,stats.pipe,stats.rev,stats.cost],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dash), "DASHBOARD");
    XLSX.writeFile(wb,"SALES_TRACKER_EXPORT.xlsx");
    showToast("Exported successfully");
  }

  function openEdit(row) { setEditRow({...row}); setIsNew(false); setShowForm(true); }
  function openAdd()     { setEditRow(blankRow()); setIsNew(true); setShowForm(true); }
  function closeForm()   { setShowForm(false); setEditRow(null); }

  function saveRow(row) {
    if (isNew) { saveRows([...rows, row]); showToast("Proposal added"); }
    else       { saveRows(rows.map(r=>r.id===row.id?row:r)); showToast("Saved"); }
    closeForm();
  }

  const syncColor = syncStatus==="success"?"#1D9E75":syncStatus==="error"?"#E24B4A":syncStatus==="idle"?"var(--color-text-secondary)":"#EF9F27";

  const TABS_NAV = [
    { id:"dashboard", icon:"◫", label:"Dash" },
    { id:"tracker",   icon:"≡",  label:"Tracker" },
    { id:"add",       icon:"+",  label:"Add" },
    { id:"sheets",    icon:"⇅",  label:"Sheets" },
    { id:"export",    icon:"↓",  label:"Export" },
  ];

  return (
    <div style={{ fontFamily:"var(--font-sans),system-ui,sans-serif", display:"flex", flexDirection:"column",
      minHeight:700, background:"var(--color-background-tertiary)", position:"relative" }}>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}} .spinning{display:inline-block;animation:spin 0.8s linear infinite}`}</style>

      <Toast toast={toast} />

      {/* Header */}
      <div style={{ background:"var(--color-background-primary)", padding:"11px 16px", display:"flex",
        alignItems:"center", justifyContent:"space-between", borderBottom:"0.5px solid var(--color-border-tertiary)", flexShrink:0 }}>
        <div>
          <div style={{ fontWeight:500, fontSize:15 }}>Sales Tracker <span style={{ fontWeight:400, color:"var(--color-text-tertiary)" }}>FY 2026</span></div>
          <div style={{ fontSize:10, color:"var(--color-text-tertiary)", marginTop:1 }}>{rows.length} proposals · {fmtM(stats.pipe)} pipeline</div>
        </div>
        <div style={{ display:"flex", gap:7 }}>
          {(gsConfig.id || gsConfig.csvUrl) && (
            <button onClick={pullFromSheets} style={{ background:"none", border:`0.5px solid ${syncColor}`, borderRadius:7,
              padding:"5px 11px", fontSize:12, cursor:"pointer", color:syncColor, display:"flex", alignItems:"center", gap:5, fontWeight:500 }}>
              <span className={spinning?"spinning":""}>{syncStatus==="success"?"✓":syncStatus==="error"?"✗":"⇅"}</span>
              {syncStatus==="pulling"?"Pulling…":syncStatus==="pushing"?"Pushing…":"Sync"}
            </button>
          )}
          <button onClick={exportXlsx} style={{ background:"#1D9E75", color:"#fff", border:"none", borderRadius:7,
            padding:"5px 13px", fontSize:12, cursor:"pointer", fontWeight:500 }}>↓ Export</button>
        </div>
      </div>

      {/* Main scroll area */}
      <div style={{ flex:1, overflowY:"auto", paddingBottom:4 }}>

        {/* DASHBOARD */}
        {tab === "dashboard" && (
          <div style={{ padding:12 }}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10, marginBottom:12 }}>
              <KpiCard label="Proposals"    val={stats.n}            />
              <KpiCard label="Win Rate"     val={fmtPct(stats.wr)}   color="#1D9E75" sub={`${stats.wins} won`} />
              <KpiCard label="Pipeline"     val={fmtM(stats.pipe)}   color="#378ADD" />
              <KpiCard label="Revenue"      val={fmtM(stats.rev)}    color="#1D9E75" />
              <KpiCard label="Total Cost"   val={fmtM(stats.cost)}   />
              <KpiCard label="Avg Markup"   val={fmtPct(stats.markup)} color="var(--color-text-secondary)" />
            </div>

            {/* Status chips — tap to filter */}
            <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:10, padding:"12px 14px", marginBottom:12 }}>
              <div style={{ fontSize:11, fontWeight:500, color:"var(--color-text-secondary)", marginBottom:9 }}>TAP TO FILTER BY STATUS</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {statusCounts.map(s => (
                  <div key={s.name} onClick={()=>{ setFilterStatus(s.name); setTab("tracker"); }}
                    style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 11px", borderRadius:20,
                      background:STATUS_CONFIG[s.name].bg, cursor:"pointer", userSelect:"none" }}>
                    <span style={{ fontSize:11, fontWeight:500, color:STATUS_CONFIG[s.name].text }}>{s.name}</span>
                    <span style={{ fontSize:11, fontWeight:700, color:STATUS_CONFIG[s.name].color,
                      background:"rgba(0,0,0,0.07)", borderRadius:20, padding:"1px 6px" }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Donut chart */}
            <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:10, padding:"12px 14px", marginBottom:12 }}>
              <div style={{ fontSize:11, fontWeight:500, color:"var(--color-text-secondary)", marginBottom:8 }}>STATUS DISTRIBUTION</div>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <ResponsiveContainer width={140} height={140}>
                  <PieChart>
                    <Pie data={statusCounts.filter(s=>s.value>0)} dataKey="value" cx="50%" cy="50%" outerRadius={62} innerRadius={32} paddingAngle={2}>
                      {statusCounts.filter(s=>s.value>0).map(e=><Cell key={e.name} fill={e.color} />)}
                    </Pie>
                    <Tooltip formatter={(v,n)=>[v,n]} contentStyle={{ fontSize:11 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex:1, display:"flex", flexDirection:"column", gap:5 }}>
                  {statusCounts.filter(s=>s.value>0).map(s=>(
                    <div key={s.name} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", fontSize:12 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <span style={{ width:9, height:9, borderRadius:2, background:s.color, display:"inline-block" }} />
                        <span style={{ color:"var(--color-text-secondary)" }}>{s.name}</span>
                      </div>
                      <span style={{ fontWeight:500, color:s.color }}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bar chart */}
            {pipeData.length > 0 && (
              <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:10, padding:"12px 14px" }}>
                <div style={{ fontSize:11, fontWeight:500, color:"var(--color-text-secondary)", marginBottom:8 }}>PIPELINE BY PROPOSAL (₱M)</div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={pipeData} margin={{ top:4, right:4, left:-20, bottom:16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize:10, fill:"var(--color-text-secondary)" }} />
                    <YAxis tick={{ fontSize:10, fill:"var(--color-text-secondary)" }} tickFormatter={v=>`${v}M`} />
                    <Tooltip formatter={(v)=>[`₱${v}M`,"Pipeline"]} contentStyle={{ fontSize:11 }} />
                    <Bar dataKey="val" radius={[4,4,0,0]}>
                      {pipeData.map((e,i)=><Cell key={i} fill={e.color}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* TRACKER */}
        {tab === "tracker" && (
          <div style={{ padding:12 }}>
            {/* Filter pills */}
            <div style={{ display:"flex", gap:6, overflowX:"auto", marginBottom:12, paddingBottom:2 }}>
              {["All",...STATUS_OPTIONS].map(s => (
                <button key={s} onClick={()=>setFilterStatus(s)} style={{ flexShrink:0, padding:"6px 14px", borderRadius:20,
                  fontSize:12, cursor:"pointer", fontWeight:filterStatus===s?500:400, whiteSpace:"nowrap",
                  background:filterStatus===s ? (s==="All"?"var(--color-text-primary)":STATUS_CONFIG[s].bg) : "var(--color-background-primary)",
                  color:filterStatus===s ? (s==="All"?"var(--color-background-primary)":STATUS_CONFIG[s].text) : "var(--color-text-secondary)",
                  border:`0.5px solid ${filterStatus===s ? (s==="All"?"var(--color-text-primary)":STATUS_CONFIG[s].color) : "var(--color-border-secondary)"}` }}>
                  {s}
                </button>
              ))}
            </div>

            {filtered.map(r => <ProposalCard key={r.id} row={r} onEdit={openEdit} onDelete={id=>{ saveRows(rows.filter(r=>r.id!==id)); showToast("Deleted","danger"); }} />)}

            {filtered.length === 0 && (
              <div style={{ textAlign:"center", padding:"40px 20px", color:"var(--color-text-tertiary)", fontSize:13 }}>
                No proposals{filterStatus!=="All"?` with status "${filterStatus}"`:""}
              </div>
            )}

            {/* Summary footer */}
            <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:10, padding:"12px 14px", marginTop:4 }}>
              <div style={{ fontSize:11, fontWeight:500, color:"var(--color-text-secondary)", marginBottom:8 }}>{filtered.length} PROPOSAL{filtered.length!==1?"S":""} SHOWN</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"5px 12px", fontSize:12 }}>
                <div><span style={{ color:"var(--color-text-tertiary)" }}>Cost </span><span style={{ fontWeight:500 }}>{fmtM(filtered.reduce((s,r)=>s+(r.cost||0),0))}</span></div>
                <div><span style={{ color:"var(--color-text-tertiary)" }}>Revenue </span><span style={{ fontWeight:500,color:"#1D9E75" }}>{fmtM(filtered.reduce((s,r)=>s+r.totalRevenue,0))}</span></div>
                <div><span style={{ color:"var(--color-text-tertiary)" }}>Pipeline </span><span style={{ fontWeight:500,color:"#378ADD" }}>{fmtM(filtered.reduce((s,r)=>s+r.pipelineValue,0))}</span></div>
                <div><span style={{ color:"var(--color-text-tertiary)" }}>Revisions </span><span style={{ fontWeight:500 }}>{fmtM(filtered.reduce((s,r)=>s+(r.revisions||0),0))}</span></div>
              </div>
            </div>
          </div>
        )}

        {/* GOOGLE SHEETS */}
        {tab === "sheets" && (
          <div style={{ padding:12 }}>
            {/* Connection status */}
            <div style={{ borderRadius:10, padding:"11px 14px", marginBottom:12, display:"flex", alignItems:"center", gap:9,
              background:syncStatus==="success"?"#E1F5EE":syncStatus==="error"?"#FCEBEB":"var(--color-background-secondary)",
              border:`0.5px solid ${syncStatus==="success"?"#5DCAA5":syncStatus==="error"?"#F09595":"var(--color-border-tertiary)"}` }}>
              <span style={{ fontSize:18, color:syncColor, lineHeight:1 }} className={spinning?"spinning":""}>{syncStatus==="success"?"✓":syncStatus==="error"?"✗":syncStatus==="idle"?"⇅":"⟳"}</span>
              <span style={{ fontSize:12, color:syncStatus==="success"?"#085041":syncStatus==="error"?"#501313":"var(--color-text-secondary)" }}>
                {syncStatus==="pulling"?"Pulling from Google Sheets…":syncStatus==="pushing"?"Pushing to Google Sheets…":syncStatus==="success"?"Synced successfully":syncStatus==="error"?"Sync failed — check config below":"Not connected"}
              </span>
            </div>

            <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:10, padding:"16px", marginBottom:12 }}>
              <div style={{ fontSize:13, fontWeight:500, marginBottom:14 }}>Google Sheets Connection</div>

              <Field label="Spreadsheet ID" hint="From URL: spreadsheets/d/[ID]/edit">
                <Input value={gsConfig.id} placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms" onChange={e=>saveGs({...gsConfig,id:e.target.value})} />
              </Field>
              <Field label="API Key" hint="Create at console.cloud.google.com → Enable Sheets API → Credentials">
                <input type="password" value={gsConfig.apiKey||""} placeholder="AIzaSy…" onChange={e=>saveGs({...gsConfig,apiKey:e.target.value})}
                  style={{ width:"100%",fontSize:13,padding:"9px 12px",borderRadius:8,border:"0.5px solid var(--color-border-secondary)",background:"var(--color-background-secondary)",color:"var(--color-text-primary)",boxSizing:"border-box" }} />
              </Field>
              <Field label="Sheet Tab Name">
                <Input value={gsConfig.sheetName} placeholder="SALES TRACKER" onChange={e=>saveGs({...gsConfig,sheetName:e.target.value})} />
              </Field>
              <Field label="OR: Published CSV URL (read-only, no API key needed)" hint="File → Share → Publish to web → Select sheet → CSV format">
                <Input value={gsConfig.csvUrl} placeholder="https://docs.google.com/spreadsheets/d/.../export?format=csv&gid=0" onChange={e=>saveGs({...gsConfig,csvUrl:e.target.value})} />
              </Field>

              <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", background:"var(--color-background-secondary)", borderRadius:8, marginBottom:14, cursor:"pointer" }}
                onClick={()=>setAutoSync(!autoSync)}>
                <div style={{ width:36, height:20, borderRadius:10, background:autoSync?"#1D9E75":"var(--color-border-secondary)", position:"relative", transition:"background 0.2s", flexShrink:0 }}>
                  <div style={{ width:16, height:16, borderRadius:8, background:"#fff", position:"absolute", top:2, left:autoSync?18:2, transition:"left 0.2s", boxShadow:"0 1px 4px rgba(0,0,0,0.2)" }} />
                </div>
                <div>
                  <div style={{ fontSize:12, fontWeight:500 }}>Auto-sync every 30 seconds</div>
                  <div style={{ fontSize:10, color:"var(--color-text-tertiary)" }}>Pulls latest data from your sheet automatically</div>
                </div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                <button onClick={pullFromSheets} disabled={!gsConfig.id&&!gsConfig.csvUrl} style={{ padding:"11px", borderRadius:9, fontSize:14, cursor:"pointer",
                  background:"var(--color-background-secondary)", border:"0.5px solid var(--color-border-secondary)", color:"var(--color-text-primary)",
                  opacity:(!gsConfig.id&&!gsConfig.csvUrl)?0.45:1 }}>↓ Pull from Sheets</button>
                <button onClick={pushToSheets} disabled={!gsConfig.id||!gsConfig.apiKey} style={{ padding:"11px", borderRadius:9, fontSize:14, cursor:"pointer",
                  background:"#1D9E75", color:"#fff", border:"none", fontWeight:500,
                  opacity:(!gsConfig.id||!gsConfig.apiKey)?0.45:1 }}>↑ Push to Sheets</button>
              </div>
            </div>

            <div style={{ background:"var(--color-background-secondary)", borderRadius:10, padding:"12px 14px" }}>
              <div style={{ fontSize:11, fontWeight:500, marginBottom:6 }}>QUICK SETUP GUIDE</div>
              {[
                "Open your Google Sheet",
                "Share → Anyone with link can view",
                "Go to console.cloud.google.com → Enable Sheets API",
                "Create an API Key under Credentials",
                "Copy the Sheet ID from the URL",
                "Paste both above and tap Pull",
                "For push/write: sheet must be publicly editable",
              ].map((s,i) => (
                <div key={i} style={{ display:"flex", gap:8, marginBottom:5, fontSize:11, color:"var(--color-text-secondary)" }}>
                  <span style={{ color:"#1D9E75", fontWeight:700, flexShrink:0 }}>{i+1}.</span>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* EXPORT / IMPORT */}
        {tab === "export" && (
          <div style={{ padding:12 }}>
            <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:10, padding:"16px", marginBottom:12 }}>
              <div style={{ fontSize:13, fontWeight:500, marginBottom:4 }}>Import Excel</div>
              <div style={{ fontSize:12, color:"var(--color-text-secondary)", marginBottom:12 }}>Upload your SALES_TRACKER .xlsx — auto-parses and connects to the dashboard.</div>
              <div onClick={()=>fileRef.current?.click()} style={{ border:"2px dashed var(--color-border-secondary)", borderRadius:10,
                padding:"28px 16px", textAlign:"center", cursor:"pointer", background:"var(--color-background-secondary)" }}>
                <div style={{ fontSize:28, marginBottom:7 }}>📂</div>
                <div style={{ fontSize:13, fontWeight:500, marginBottom:3 }}>Tap to upload Excel file</div>
                <div style={{ fontSize:11, color:"var(--color-text-tertiary)" }}>.xlsx or .xls · Requires "Status" header row</div>
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display:"none" }} onChange={e=>{if(e.target.files[0])parseAndImport(e.target.files[0]);}} />
            </div>

            <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:10, padding:"16px" }}>
              <div style={{ fontSize:13, fontWeight:500, marginBottom:4 }}>Export to Excel</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"6px 10px", marginBottom:14, fontSize:12 }}>
                <Stat label="Proposals" val={stats.n} />
                <Stat label="Pipeline"  val={fmtM(stats.pipe)}   color="#378ADD" />
                <Stat label="Win Rate"  val={fmtPct(stats.wr)}   color="#1D9E75" />
              </div>
              <button onClick={exportXlsx} style={{ width:"100%", padding:"13px", borderRadius:9, fontSize:14,
                cursor:"pointer", background:"#1D9E75", color:"#fff", border:"none", fontWeight:500 }}>
                ↓ Download SALES_TRACKER_EXPORT.xlsx
              </button>
              <div style={{ fontSize:10, color:"var(--color-text-tertiary)", marginTop:6, textAlign:"center" }}>Includes SALES TRACKER + DASHBOARD sheets</div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <div style={{ background:"var(--color-background-primary)", borderTop:"0.5px solid var(--color-border-tertiary)",
        display:"flex", flexShrink:0 }}>
        {TABS_NAV.map(t => (
          <NavBtn key={t.id} id={t.id} icon={t.icon} label={t.label}
            active={t.id!=="add" && tab===t.id}
            onClick={()=>{ if(t.id==="add") openAdd(); else setTab(t.id); }} />
        ))}
      </div>

      {/* Add/Edit Bottom Sheet */}
      {showForm && editRow && (
        <BottomSheet title={isNew?"New Proposal":"Edit Proposal"} onClose={closeForm}>
          <RowForm row={editRow} onChange={setEditRow} onSave={saveRow} onCancel={closeForm} isNew={isNew} />
        </BottomSheet>
      )}
    </div>
  );
}
