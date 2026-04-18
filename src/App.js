import { useState, useEffect, useRef } from "react";
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import * as XLSX from "xlsx";
import { supabase } from "./supabase";

// ─── Seed data (used only if DB is empty) ────────────────────────────────────
const SEED = [
  { cost:34000000,    markup:0.20, win_rate:0,   revisions:32000000,   comment:"Serendra 2 Alveo",    sort_order:1  },
  { cost:11586094.43, markup:0.25, win_rate:0,   revisions:0,          comment:"Alveo",               sort_order:2  },
  { cost:7827388.53,  markup:0.25, win_rate:0.7, revisions:3629947.46, comment:"ACEN",                sort_order:3  },
  { cost:578970.77,   markup:0.25, win_rate:0.3, revisions:0,          comment:"",                    sort_order:4  },
  { cost:2671382.72,  markup:0.25, win_rate:0.5, revisions:0,          comment:"ACEN",                sort_order:5  },
  { cost:3685582.20,  markup:0.25, win_rate:0.9, revisions:0,          comment:"Park Terraces",       sort_order:6  },
  { cost:67924931.44, markup:0.25, win_rate:0.1, revisions:0,          comment:"",                    sort_order:7  },
  { cost:11067983.77, markup:0.25, win_rate:0.1, revisions:0,          comment:"ACEN",                sort_order:8  },
  { cost:1223040,     markup:0.10, win_rate:1.0, revisions:1223040,    comment:"Manpower 1Yr/Jangho", sort_order:9  },
  { cost:11477183.54, markup:0.25, win_rate:0.1, revisions:9557337.23, comment:"",                    sort_order:10 },
  { cost:1382754.45,  markup:0.25, win_rate:0.1, revisions:2382754.45, comment:"",                    sort_order:11 },
  { cost:4615637.72,  markup:0.25, win_rate:0,   revisions:0,          comment:"Pending APMC",        sort_order:12 },
];

// ─── Config ───────────────────────────────────────────────────────────────────
const STATUS_CFG = {
  Win:         { bg:"#00B050", text:"#fff"     },
  Negotiation: { bg:"#FFC000", text:"#7a5800"  },
  "On-bidding":{ bg:"#2E75B6", text:"#fff"     },
  Revision:    { bg:"#ED7D31", text:"#fff"     },
  Loss:        { bg:"#C00000", text:"#fff"     },
};
const STATUS_ORDER  = ["Win","Negotiation","On-bidding","Revision","Loss"];
const CHART_COLORS  = { Win:"#00B050",Negotiation:"#FFC000","On-bidding":"#2E75B6",Revision:"#ED7D31",Loss:"#C00000" };
const LS_KEY        = "pcorp_tracker_v5";

// ─── Business logic ───────────────────────────────────────────────────────────
function getStatus(w, r) {
  w=parseFloat(w)||0; r=parseFloat(r)||0;
  if (w>=1)   return "Win";
  if (w>=0.6) return "Negotiation";
  if (w>0)    return "On-bidding";
  if (r>0)    return "Revision";
  return "Loss";
}

/** Normalize a DB row → UI row */
function fromDB(row, idx) {
  return {
    id:        row.id,
    sort:      row.sort_order ?? idx,
    cost:      parseFloat(row.cost)      ?? 0,
    markup:    parseFloat(row.markup)    ?? 0.25,
    winRate:   parseFloat(row.win_rate)  ?? 0,
    revisions: parseFloat(row.revisions) ?? 0,
    comment:   row.comment               ?? "",
  };
}

/** Normalize a UI row → DB row */
function toDB(row) {
  return {
    cost:      parseFloat(row.cost)      || 0,
    markup:    parseFloat(row.markup)    || 0.25,
    win_rate:  parseFloat(row.winRate)   || 0,
    revisions: parseFloat(row.revisions) || 0,
    comment:   row.comment               || "",
    sort_order: row.sort || 0,
  };
}

function compute(row, idx) {
  const cost=parseFloat(row.cost)||0, markup=parseFloat(row.markup)||0;
  const winRate=parseFloat(row.winRate)||0, revisions=parseFloat(row.revisions)||0;
  const status=getStatus(winRate, revisions);
  const mv=cost*markup, isWin=status==="Win", isLoss=status==="Loss";
  return {
    ...row,
    proposalNum: `PCORP-${String(idx+1).padStart(3,"0")}-26`,
    status, markupVal:mv,
    totalRevenue: isWin?cost+mv:0,
    totalSold:    isWin?1:0,
    totalSales:   isWin?cost+mv:0,
    pipeline:     !isWin&&!isLoss?cost+mv:0,
    lossRate:     1-winRate,
  };
}

// ─── Formatters ───────────────────────────────────────────────────────────────
const peso   = n=>"₱"+(parseFloat(n)||0).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2});
const pct    = n=>((parseFloat(n)||0)*100).toFixed(1)+"%";
const compact = v=>{
  const n=parseFloat(v)||0;
  if(n>=1e9) return "₱"+(n/1e9).toFixed(2)+"B";
  if(n>=1e6) return "₱"+(n/1e6).toFixed(2)+"M";
  if(n>=1e3) return "₱"+(n/1e3).toFixed(1)+"K";
  return "₱"+n.toFixed(0);
};

// ─── Excel helpers ────────────────────────────────────────────────────────────
function parseExcel(buffer) {
  const wb   = XLSX.read(buffer,{type:"array"});
  const name = wb.SheetNames.find(n=>n.toUpperCase().includes("SALES")||n.toUpperCase().includes("TRACKER"))||wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name],{defval:""});
  if (!rows.length) return [];
  const keys=Object.keys(rows[0]);
  const find=(...aliases)=>{
    for(const a of aliases){const m=keys.find(k=>k.toLowerCase().trim()===a);if(m)return m;}
    for(const a of aliases){const m=keys.find(k=>k.toLowerCase().includes(a.split(" ")[0]));if(m)return m;}
    return null;
  };
  const cC=find("cost proposal","cost proposal (₱)","cost","amount");
  const mC=find("markup %","markup","markup%","percentage");
  const wC=find("win rate","winrate","win_rate","winning rate");
  const rC=find("revisions (₱)","revisions","revision");
  const cmC=find("comments","comment","notes","remarks");
  return rows
    .filter(r=>(parseFloat(r[cC])||0)>0)
    .map((r,i)=>({
      cost:      parseFloat(r[cC])||0,
      markup:    parseFloat(r[mC])||0.25,
      winRate:   parseFloat(r[wC])||0,
      revisions: parseFloat(r[rC])||0,
      comment:   r[cmC]?String(r[cmC]):"",
      sort:      i+1,
    }));
}

function exportToExcel(computed, filename="SALES_TRACKER_EXPORT.xlsx") {
  const wb=XLSX.utils.book_new();
  const ws1=XLSX.utils.json_to_sheet(computed.map(r=>({
    "Proposal #":r.proposalNum,"Status":r.status,
    "Cost Proposal (₱)":parseFloat(r.cost)||0,"Markup %":parseFloat(r.markup)||0,
    "Markup Value (₱)":r.markupVal,"Total Revenue (₱)":r.totalRevenue,
    "Total Sold":r.totalSold,"Revisions (₱)":parseFloat(r.revisions)||0,
    "Win Rate":parseFloat(r.winRate)||0,"Loss Rate":r.lossRate,
    "Total Sales (₱)":r.totalSales,"Pipeline Value (₱)":r.pipeline,
    "Comments":r.comment||"",
  })));
  ws1["!cols"]=[{wch:14},{wch:14},{wch:20},{wch:10},{wch:18},{wch:18},{wch:12},{wch:16},{wch:10},{wch:10},{wch:18},{wch:18},{wch:24}];
  XLSX.utils.book_append_sheet(wb,ws1,"SALES TRACKER");
  const ws2=XLSX.utils.json_to_sheet(STATUS_ORDER.map(s=>{
    const g=computed.filter(r=>r.status===s);
    return{"Status":s,"Count":g.length,"Total Cost (₱)":g.reduce((a,r)=>a+(r.cost||0),0),"Total Revenue (₱)":g.reduce((a,r)=>a+r.totalRevenue,0),"Pipeline (₱)":g.reduce((a,r)=>a+r.pipeline,0)};
  }));
  XLSX.utils.book_append_sheet(wb,ws2,"DASHBOARD");
  XLSX.writeFile(wb,filename);
}

// ─── Shared UI ────────────────────────────────────────────────────────────────
const S = {
  primary:"#1F3864", green:"#00B050", red:"#C00000",
  orange:"#ED7D31", yellow:"#FFC000", blue:"#2E75B6",
  bg:"#f0f2f5", card:"#fff", border:"#e8e8e8",
  text:"#1a1a1a", muted:"#888",
};

function StatusBadge({status}) {
  const sc=STATUS_CFG[status]||{bg:"#888",text:"#fff"};
  return <span style={{background:sc.bg,color:sc.text,borderRadius:100,padding:"3px 10px",fontSize:11,fontWeight:700,whiteSpace:"nowrap",display:"inline-block",letterSpacing:"0.4px"}}>{status}</span>;
}

function KpiCard({label,value,sub,color,onClick}) {
  return (
    <div onClick={onClick} style={{background:S.card,borderRadius:12,padding:"14px 16px",borderTop:`3px solid ${color||S.primary}`,flex:1,minWidth:120,cursor:onClick?"pointer":"default",transition:"transform 0.1s",userSelect:"none"}}
      onMouseEnter={e=>{if(onClick)e.currentTarget.style.transform="scale(1.02)";}}
      onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
      <div style={{fontSize:10,color:S.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:"0.6px",fontWeight:600}}>{label}</div>
      <div style={{fontSize:22,fontWeight:700,color:S.text,lineHeight:1.1}}>{value}</div>
      {sub&&<div style={{fontSize:11,color:S.muted,marginTop:4}}>{sub}</div>}
    </div>
  );
}

function Spinner() {
  return <span style={{display:"inline-block",width:14,height:14,border:"2px solid rgba(255,255,255,0.4)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>
}

function SyncDot({status}) {
  const colors={online:"#4ade80",offline:"#fb923c",syncing:"#60a5fa"};
  const labels={online:"Live",offline:"Offline",syncing:"Syncing"};
  return (
    <div style={{display:"flex",alignItems:"center",gap:5}}>
      <div style={{width:7,height:7,borderRadius:"50%",background:colors[status]||"#888",
        animation:status==="syncing"?"pulse 1s infinite":"none"}}/>
      <span style={{color:"rgba(255,255,255,0.65)",fontSize:11}}>{labels[status]||status}</span>
    </div>
  );
}

// ─── Inline editable cell ─────────────────────────────────────────────────────
function EditableCell({value,field,rowId,type,onSave,fmt}) {
  const[editing,setEditing]=useState(false);
  const[val,setVal]=useState(value);
  const ref=useRef();
  useEffect(()=>setVal(value),[value]);
  useEffect(()=>{if(editing)ref.current?.select();},[editing]);
  function commit(){setEditing(false);onSave(rowId,field,type==="number"?(parseFloat(val)||0):val);}
  if(!editing) return <td onClick={()=>setEditing(true)} style={{padding:"9px 10px",cursor:"pointer",color:"#0a5599",fontWeight:600,whiteSpace:"nowrap",maxWidth:140,overflow:"hidden",textOverflow:"ellipsis"}} title="Tap to edit">{fmt?fmt(value):value}</td>;
  return(
    <td style={{padding:"4px 5px"}}>
      <input ref={ref} type={type==="number"?"number":"text"} value={val}
        onChange={e=>setVal(e.target.value)} onBlur={commit}
        onKeyDown={e=>{if(e.key==="Enter")commit();if(e.key==="Escape")setEditing(false);}}
        style={{width:"100%",minWidth:72,border:"2px solid "+S.primary,borderRadius:6,padding:"5px 7px",fontSize:13,outline:"none",background:"#fff"}}
        step={type==="number"?"any":undefined}/>
    </td>
  );
}

function ChartTip({active,payload}) {
  if(!active||!payload?.length) return null;
  const d=payload[0];
  return <div style={{background:"#fff",border:"1px solid #e0e0e0",borderRadius:8,padding:"8px 12px",fontSize:12,boxShadow:"0 2px 10px rgba(0,0,0,0.12)"}}><div style={{fontWeight:700,marginBottom:2}}>{d.name||d.payload?.name}</div><div>{typeof d.value==="number"&&d.value>999?compact(d.value):d.value}</div></div>;
}

// ─── Import Modal ─────────────────────────────────────────────────────────────
function ImportModal({onImport,onClose}) {
  const[drag,setDrag]=useState(false);
  const[file,setFile]=useState(null);
  const[preview,setPreview]=useState(null);
  const[mode,setMode]=useState("replace");
  const[err,setErr]=useState("");
  const[loading,setLoading]=useState(false);

  function handleFile(f){
    if(!f) return;
    const ext=f.name.split(".").pop().toLowerCase();
    if(!["xlsx","xls","csv"].includes(ext)){setErr("Please upload .xlsx, .xls, or .csv");return;}
    setFile(f);setErr("");setLoading(true);
    const reader=new FileReader();
    reader.onload=e=>{
      try{
        const rows=parseExcel(new Uint8Array(e.target.result));
        if(!rows.length){setErr("No data found. Ensure the file has a 'Cost Proposal' column.");setLoading(false);return;}
        setPreview(rows);
      }catch(ex){setErr("Could not read file: "+ex.message);}
      setLoading(false);
    };
    reader.readAsArrayBuffer(f);
  }

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:16}}>
      <div style={{background:"#fff",borderRadius:18,width:"100%",maxWidth:520,maxHeight:"90vh",overflow:"auto",boxShadow:"0 24px 80px rgba(0,0,0,0.3)"}}>
        <div style={{background:S.primary,padding:"16px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",borderRadius:"18px 18px 0 0"}}>
          <div>
            <div style={{color:"#fff",fontWeight:700,fontSize:15}}>Import Excel / CSV</div>
            <div style={{color:"rgba(255,255,255,0.55)",fontSize:11,marginTop:2}}>Upload your SALES_TRACKER.xlsx or any compatible file</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"rgba(255,255,255,0.6)",fontSize:22,cursor:"pointer"}}>✕</button>
        </div>
        <div style={{padding:20}}>
          <div
            onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)}
            onDrop={e=>{e.preventDefault();setDrag(false);handleFile(e.dataTransfer.files[0]);}}
            onClick={()=>document.getElementById("xl-inp").click()}
            style={{border:`2px dashed ${drag?"#1F3864":"#c8d6e5"}`,borderRadius:14,padding:"28px 20px",textAlign:"center",background:drag?"#f0f4ff":"#fafbfd",cursor:"pointer",marginBottom:16,transition:"all 0.15s"}}>
            <div style={{fontSize:40,marginBottom:8}}>📂</div>
            <div style={{fontWeight:700,fontSize:14,color:"#333",marginBottom:4}}>{file?file.name:"Drag & drop your Excel file here"}</div>
            <div style={{fontSize:12,color:"#aaa"}}>{file?`${(file.size/1024).toFixed(1)} KB · click to change`:"or tap to browse · .xlsx .xls .csv"}</div>
            <input id="xl-inp" type="file" accept=".xlsx,.xls,.csv" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>
          </div>

          {err&&<div style={{background:"#fff5f5",border:"1px solid #fca5a5",borderRadius:8,padding:"10px 14px",fontSize:13,color:S.red,marginBottom:14}}>⚠ {err}</div>}
          {loading&&<div style={{textAlign:"center",color:S.muted,fontSize:13,marginBottom:14}}>Parsing…</div>}

          {preview&&!loading&&(
            <>
              <div style={{background:"#f0f9f0",border:"1px solid #bbf7d0",borderRadius:8,padding:"10px 14px",fontSize:13,color:"#166534",marginBottom:14,display:"flex",alignItems:"center",gap:8}}>
                ✅ <span>Found <strong>{preview.length} proposals</strong> — dashboard updates automatically on import</span>
              </div>
              <div style={{overflowX:"auto",marginBottom:14,borderRadius:8,border:"1px solid "+S.border,maxHeight:160,overflowY:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead><tr style={{background:S.primary,position:"sticky",top:0}}>{["#","Status","Cost","Markup%","Win Rate","Comment"].map(h=><th key={h} style={{padding:"7px 10px",color:"#fff",fontWeight:600,textAlign:"left",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                  <tbody>
                    {preview.map((r,i)=>{const c=compute({...r,winRate:r.winRate,revisions:r.revisions},i);return(
                      <tr key={i} style={{borderTop:"0.5px solid #f0f0f0",background:i%2?"#fafafa":"#fff"}}>
                        <td style={{padding:"6px 10px",fontWeight:600,fontSize:11}}>PCORP-{String(i+1).padStart(3,"0")}-26</td>
                        <td style={{padding:"6px 10px"}}><StatusBadge status={c.status}/></td>
                        <td style={{padding:"6px 10px"}}>{compact(r.cost)}</td>
                        <td style={{padding:"6px 10px"}}>{pct(r.markup)}</td>
                        <td style={{padding:"6px 10px"}}>{pct(r.winRate)}</td>
                        <td style={{padding:"6px 10px",maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.comment}</td>
                      </tr>
                    );})}
                  </tbody>
                </table>
              </div>
              <div style={{marginBottom:16}}>
                <div style={{fontSize:12,fontWeight:700,color:"#444",marginBottom:8}}>Import mode</div>
                <div style={{display:"flex",gap:10}}>
                  {[{val:"replace",label:"Replace all",desc:"Overwrite existing data"},{val:"append",label:"Append rows",desc:"Add to existing data"}].map(m=>(
                    <label key={m.val} style={{flex:1,border:`2px solid ${mode===m.val?S.primary:"#e0e0e0"}`,borderRadius:10,padding:"10px 14px",cursor:"pointer",background:mode===m.val?"#f0f4ff":"#fff"}}>
                      <input type="radio" name="imode" value={m.val} checked={mode===m.val} onChange={()=>setMode(m.val)} style={{marginRight:6}}/>
                      <span style={{fontWeight:700,fontSize:13}}>{m.label}</span>
                      <div style={{fontSize:11,color:S.muted,marginTop:3,marginLeft:18}}>{m.desc}</div>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <button onClick={onClose} style={{padding:"10px 22px",border:"1px solid #ddd",borderRadius:8,background:"#fff",cursor:"pointer",fontSize:14,color:"#555"}}>Cancel</button>
            <button onClick={()=>preview&&onImport(preview,mode,file?.name)} disabled={!preview}
              style={{padding:"10px 24px",background:preview?S.primary:"#9ca3af",color:"#fff",border:"none",borderRadius:8,cursor:preview?"pointer":"not-allowed",fontSize:14,fontWeight:700}}>
              Import {preview?`${preview.length} rows`:""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Add Proposal Modal ───────────────────────────────────────────────────────
function AddModal({onSave,onClose,nextNum}) {
  const[form,setForm]=useState({cost:"",markup:"0.25",winRate:"0",revisions:"0",comment:""});
  const[saving,setSaving]=useState(false);
  const preview=getStatus(parseFloat(form.winRate)||0,parseFloat(form.revisions)||0);
  const mk=(parseFloat(form.cost)||0)*(parseFloat(form.markup)||0);
  const inp={display:"block",width:"100%",padding:"10px 12px",border:"1px solid #dde",borderRadius:9,fontSize:14,outline:"none",boxSizing:"border-box"};
  const lbl={display:"block",fontSize:12,color:"#555",marginBottom:5,fontWeight:600};
  async function submit(e){
    e.preventDefault();if(!form.cost){alert("Cost is required");return;}
    setSaving(true);await onSave(form);setSaving(false);
  }
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:16}}>
      <div style={{background:"#fff",borderRadius:16,width:"100%",maxWidth:440,overflow:"hidden",boxShadow:"0 20px 60px rgba(0,0,0,0.25)"}}>
        <div style={{background:S.primary,padding:"16px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{color:"#fff",fontWeight:700,fontSize:15}}>New proposal — PCORP-{String(nextNum).padStart(3,"0")}-26</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"rgba(255,255,255,0.7)",fontSize:22,cursor:"pointer",lineHeight:1}}>✕</button>
        </div>
        <form onSubmit={submit} style={{padding:20,display:"flex",flexDirection:"column",gap:14}}>
          <div><label style={lbl}>Cost Proposal (₱) *</label><input type="number" placeholder="e.g. 5000000" value={form.cost} onChange={e=>setForm(f=>({...f,cost:e.target.value}))} style={{...inp,borderColor:S.primary}} required/></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><label style={lbl}>Markup % (0–1)</label><input type="number" step="0.01" min="0" max="1" value={form.markup} onChange={e=>setForm(f=>({...f,markup:e.target.value}))} style={inp}/></div>
            <div><label style={lbl}>Win Rate (0–1)</label><input type="number" step="0.01" min="0" max="1" value={form.winRate} onChange={e=>setForm(f=>({...f,winRate:e.target.value}))} style={inp}/></div>
          </div>
          <div><label style={lbl}>Revisions (₱) <span style={{color:S.muted,fontWeight:400}}>— triggers Revision status</span></label><input type="number" value={form.revisions} onChange={e=>setForm(f=>({...f,revisions:e.target.value}))} style={inp}/></div>
          <div><label style={lbl}>Comments</label><input type="text" value={form.comment} onChange={e=>setForm(f=>({...f,comment:e.target.value}))} style={inp} placeholder="Client name, notes…"/></div>
          <div style={{background:"#f5f7fa",borderRadius:10,padding:"11px 14px",display:"flex",alignItems:"center",gap:12,border:"0.5px solid #e0e0e0"}}>
            <span style={{fontSize:12,color:S.muted}}>Auto status:</span>
            <StatusBadge status={preview}/>
            {form.cost&&<span style={{fontSize:12,color:S.muted,marginLeft:"auto"}}>Markup: {peso(mk)}</span>}
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:4}}>
            <button type="button" onClick={onClose} style={{padding:"10px 22px",border:"1px solid #ddd",borderRadius:9,background:"#fff",cursor:"pointer",fontSize:14,color:"#555"}}>Cancel</button>
            <button type="submit" disabled={saving} style={{padding:"10px 26px",background:S.primary,color:"#fff",border:"none",borderRadius:9,cursor:"pointer",fontSize:14,fontWeight:700,display:"flex",alignItems:"center",gap:8}}>
              {saving?<Spinner/>:null} Add proposal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({computed,totals,statusCounts,winRate,lastImport,setFilterAndGo}) {
  const pieData=statusCounts.filter(s=>s.count>0).map(s=>({name:s.name,value:s.count}));
  return(
    <div style={{padding:16,maxWidth:1100,margin:"0 auto"}}>
      {lastImport&&(
        <div style={{background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:10,padding:"10px 16px",marginBottom:16,fontSize:13,color:"#0369a1",display:"flex",alignItems:"center",gap:8}}>
          🔄 Last import: <strong>{lastImport.filename}</strong> — {lastImport.count} proposals · {lastImport.time}
        </div>
      )}

      {/* Count KPIs — clickable to filter tracker */}
      <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:14}}>
        <KpiCard label="Total Proposals" value={computed.length} color={S.primary} onClick={()=>setFilterAndGo("All")}/>
        <KpiCard label="Won" value={computed.filter(r=>r.status==="Win").length} color={S.green} sub={pct(winRate)+" win rate"} onClick={()=>setFilterAndGo("Win")}/>
        <KpiCard label="Negotiation" value={computed.filter(r=>r.status==="Negotiation").length} color={S.yellow} onClick={()=>setFilterAndGo("Negotiation")}/>
        <KpiCard label="On-bidding" value={computed.filter(r=>r.status==="On-bidding").length} color={S.blue} onClick={()=>setFilterAndGo("On-bidding")}/>
        <KpiCard label="Revision" value={computed.filter(r=>r.status==="Revision").length} color={S.orange} onClick={()=>setFilterAndGo("Revision")}/>
        <KpiCard label="Loss" value={computed.filter(r=>r.status==="Loss").length} color={S.red} onClick={()=>setFilterAndGo("Loss")}/>
      </div>

      {/* Financial KPIs */}
      <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:20}}>
        <KpiCard label="Total Cost" value={compact(totals.cost)} color={S.primary}/>
        <KpiCard label="Total Revenue" value={compact(totals.totalRevenue)} color={S.green}/>
        <KpiCard label="Total Sales" value={compact(totals.totalSales)} color="#17375E"/>
        <KpiCard label="Pipeline" value={compact(totals.pipeline)} color={S.blue}/>
        <KpiCard label="Revisions" value={compact(totals.revisions)} color={S.orange}/>
        <KpiCard label="Total Sold" value={totals.totalSold} color="#375623"/>
      </div>

      {/* Charts */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16,marginBottom:20}}>
        <div style={{background:S.card,borderRadius:14,padding:"16px 20px",border:"0.5px solid "+S.border}}>
          <div style={{fontSize:13,fontWeight:700,color:"#333",marginBottom:14}}>Proposals by status</div>
          <ResponsiveContainer width="100%" height={210}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={78} dataKey="value"
                label={({name,percent})=>percent>0.04?`${name} ${(percent*100).toFixed(0)}%`:""}
                labelLine={false} fontSize={11}>
                {pieData.map((e,i)=><Cell key={i} fill={CHART_COLORS[e.name]||"#888"}/>)}
              </Pie>
              <Tooltip content={<ChartTip/>}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div style={{background:S.card,borderRadius:14,padding:"16px 20px",border:"0.5px solid "+S.border}}>
          <div style={{fontSize:13,fontWeight:700,color:"#333",marginBottom:14}}>Cost proposal by status (₱)</div>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={statusCounts} margin={{left:0,right:10,top:5,bottom:5}}>
              <XAxis dataKey="name" tick={{fontSize:10}} interval={0}/>
              <YAxis tickFormatter={v=>compact(v)} tick={{fontSize:10}} width={60}/>
              <Tooltip content={<ChartTip/>}/>
              <Bar dataKey="cost" name="Cost" radius={[4,4,0,0]}>{statusCounts.map((s,i)=><Cell key={i} fill={CHART_COLORS[s.name]||"#888"}/>)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Summary table */}
      <div style={{background:S.card,borderRadius:14,border:"0.5px solid "+S.border,overflow:"hidden"}}>
        <div style={{padding:"12px 16px",background:S.primary,color:"#fff",fontSize:13,fontWeight:700}}>Status summary</div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr style={{background:"#f7f9fc"}}>{["Status","Count","Total Cost","Total Revenue","Pipeline"].map(h=><th key={h} style={{padding:"9px 14px",textAlign:"left",fontWeight:700,color:"#555",whiteSpace:"nowrap",fontSize:12}}>{h}</th>)}</tr></thead>
            <tbody>
              {statusCounts.map((s,i)=>{
                const rev=computed.filter(r=>r.status===s.name).reduce((a,r)=>a+r.totalRevenue,0);
                const pip=computed.filter(r=>r.status===s.name).reduce((a,r)=>a+r.pipeline,0);
                return(<tr key={s.name} style={{borderTop:"0.5px solid #f0f0f0",background:i%2?"#fafafa":"#fff"}}>
                  <td style={{padding:"9px 14px"}}><StatusBadge status={s.name}/></td>
                  <td style={{padding:"9px 14px",fontWeight:700}}>{s.count}</td>
                  <td style={{padding:"9px 14px"}}>{peso(s.cost)}</td>
                  <td style={{padding:"9px 14px"}}>{peso(rev)}</td>
                  <td style={{padding:"9px 14px"}}>{peso(pip)}</td>
                </tr>);
              })}
              <tr style={{background:S.primary}}>
                <td style={{padding:"9px 14px",color:"#fff",fontWeight:700}}>Total</td>
                <td style={{padding:"9px 14px",color:"#fff",fontWeight:700}}>{computed.length}</td>
                <td style={{padding:"9px 14px",color:"#fff",fontWeight:700}}>{peso(totals.cost)}</td>
                <td style={{padding:"9px 14px",color:"#fff",fontWeight:700}}>{peso(totals.totalRevenue)}</td>
                <td style={{padding:"9px 14px",color:"#fff",fontWeight:700}}>{peso(totals.pipeline)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Tracker View ─────────────────────────────────────────────────────────────
function TrackerView({computed,updateCell,deleteRow,filterStatus,setFilterStatus,filtered,totals,onAdd,onImport,onExport}) {
  return(
    <div style={{padding:"12px 14px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {["All",...STATUS_ORDER].map(s=>(
            <button key={s} onClick={()=>setFilterStatus(s)} style={{padding:"5px 12px",borderRadius:100,fontSize:12,fontWeight:700,cursor:"pointer",border:filterStatus===s?"2px solid "+S.primary:"1px solid #ddd",background:filterStatus===s?S.primary:"#fff",color:filterStatus===s?"#fff":"#555",transition:"all 0.15s"}}>{s}</button>
          ))}
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button onClick={onImport} style={{padding:"8px 14px",background:"#fff",color:S.primary,border:"2px solid "+S.primary,borderRadius:9,cursor:"pointer",fontSize:13,fontWeight:700}}>⬆ Import</button>
          <button onClick={onExport} style={{padding:"8px 14px",background:"#fff",color:"#375623",border:"2px solid #375623",borderRadius:9,cursor:"pointer",fontSize:13,fontWeight:700}}>⬇ Export</button>
          <button onClick={onAdd} style={{padding:"8px 18px",background:S.primary,color:"#fff",border:"none",borderRadius:9,cursor:"pointer",fontSize:13,fontWeight:700}}>+ Add proposal</button>
        </div>
      </div>

      <div style={{background:S.card,borderRadius:14,border:"0.5px solid "+S.border,overflow:"hidden"}}>
        <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
          <table style={{borderCollapse:"collapse",fontSize:13,minWidth:1100}}>
            <thead>
              <tr style={{background:S.primary}}>
                {["#","Proposal #","Status","Cost ✎","Markup% ✎","Markup Val","Win Rate ✎","Loss Rate","Total Revenue","Sold","Revisions ✎","Total Sales","Pipeline","Comments ✎",""].map((h,i)=>(
                  <th key={i} style={{padding:"10px 10px",textAlign:"left",fontWeight:700,color:"rgba(255,255,255,0.92)",whiteSpace:"nowrap",fontSize:11}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r,i)=>{
                const bg=i%2===0?"#fff":"#f9fbfd";
                const td={padding:"9px 10px",background:bg,whiteSpace:"nowrap",color:S.text};
                return(
                  <tr key={r.id} style={{borderTop:"0.5px solid #f0f0f0"}}>
                    <td style={{...td,color:S.muted,fontSize:11,width:30}}>{i+1}</td>
                    <td style={{...td,fontWeight:700,fontSize:12}}>{r.proposalNum}</td>
                    <td style={td}><StatusBadge status={r.status}/></td>
                    <EditableCell value={r.cost}      field="cost"      rowId={r.id} type="number" onSave={updateCell} fmt={peso}/>
                    <EditableCell value={r.markup}    field="markup"    rowId={r.id} type="number" onSave={updateCell} fmt={pct}/>
                    <td style={td}>{peso(r.markupVal)}</td>
                    <EditableCell value={r.winRate}   field="winRate"   rowId={r.id} type="number" onSave={updateCell} fmt={pct}/>
                    <td style={td}>{pct(r.lossRate)}</td>
                    <td style={td}>{peso(r.totalRevenue)}</td>
                    <td style={{...td,textAlign:"center"}}>{r.totalSold}</td>
                    <EditableCell value={r.revisions} field="revisions" rowId={r.id} type="number" onSave={updateCell} fmt={peso}/>
                    <td style={td}>{peso(r.totalSales)}</td>
                    <td style={td}>{peso(r.pipeline)}</td>
                    <EditableCell value={r.comment}   field="comment"   rowId={r.id} type="text"   onSave={updateCell}/>
                    <td style={{...td,textAlign:"center"}}>
                      <button onClick={()=>deleteRow(r.id)} style={{background:"none",border:"none",cursor:"pointer",color:S.red,fontSize:15,padding:"2px 6px",borderRadius:5}}>✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{background:S.primary}}>
                <td colSpan={3} style={{padding:"10px 10px",color:"#fff",fontWeight:700,fontSize:12}}>TOTALS ({filtered.length})</td>
                <td style={{padding:"10px 10px",color:"#fff",fontWeight:700,fontSize:12}}>{peso(filtered.reduce((a,r)=>a+(r.cost||0),0))}</td>
                <td/><td style={{padding:"10px 10px",color:"#fff",fontWeight:700,fontSize:12}}>{peso(filtered.reduce((a,r)=>a+r.markupVal,0))}</td>
                <td/><td/>
                <td style={{padding:"10px 10px",color:"#fff",fontWeight:700,fontSize:12}}>{peso(filtered.reduce((a,r)=>a+r.totalRevenue,0))}</td>
                <td style={{padding:"10px 10px",color:"#fff",fontWeight:700,fontSize:12,textAlign:"center"}}>{filtered.reduce((a,r)=>a+r.totalSold,0)}</td>
                <td style={{padding:"10px 10px",color:"#fff",fontWeight:700,fontSize:12}}>{peso(filtered.reduce((a,r)=>a+(parseFloat(r.revisions)||0),0))}</td>
                <td style={{padding:"10px 10px",color:"#fff",fontWeight:700,fontSize:12}}>{peso(filtered.reduce((a,r)=>a+r.totalSales,0))}</td>
                <td style={{padding:"10px 10px",color:"#fff",fontWeight:700,fontSize:12}}>{peso(filtered.reduce((a,r)=>a+r.pipeline,0))}</td>
                <td colSpan={2}/>
              </tr>
            </tfoot>
          </table>
        </div>
        <div style={{padding:"8px 14px",background:"#f5f7fa",borderTop:"0.5px solid "+S.border,fontSize:11,color:S.muted,display:"flex",gap:14,flexWrap:"wrap"}}>
          <span><span style={{color:"#0a5599",fontWeight:700}}>✎</span> = tap/click to edit · Enter to save · Esc to cancel</span>
          <span>Status: 1.0→Win · ≥0.6→Negotiation · &gt;0→On-bidding · Rev&gt;0→Revision · 0→Loss</span>
        </div>
      </div>
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab,          setTab]          = useState("dashboard");
  const [rows,         setRows]         = useState([]);
  const [showAdd,      setShowAdd]      = useState(false);
  const [showImport,   setShowImport]   = useState(false);
  const [filterStatus, setFilterStatus] = useState("All");
  const [syncStatus,   setSyncStatus]   = useState("online"); // online|offline|syncing
  const [lastImport,   setLastImport]   = useState(null);
  const [loaded,       setLoaded]       = useState(false);
  const [onlineMode,   setOnlineMode]   = useState(true);     // true = Supabase, false = localStorage

  // ── Check if Supabase is configured ──────────────────────────────────────
  const supabaseConfigured =
    process.env.REACT_APP_SUPABASE_URL &&
    process.env.REACT_APP_SUPABASE_URL !== "https://YOUR_PROJECT.supabase.co";

  // ── Load data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (supabaseConfigured) {
      loadFromSupabase();
    } else {
      loadFromLocalStorage();
      setOnlineMode(false);
      setSyncStatus("offline");
    }
  }, []); // eslint-disable-line

  async function loadFromSupabase() {
    try {
      const { data, error } = await supabase
        .from("proposals")
        .select("*")
        .order("sort_order", { ascending: true });

      if (error) throw error;

      if (data.length === 0) {
        // Seed the database on first run
        await supabase.from("proposals").insert(SEED);
        const { data: seeded } = await supabase.from("proposals").select("*").order("sort_order");
        setRows(seeded.map(fromDB));
      } else {
        setRows(data.map(fromDB));
      }
      setSyncStatus("online");
    } catch (err) {
      console.warn("Supabase unavailable, falling back to localStorage", err);
      loadFromLocalStorage();
      setOnlineMode(false);
      setSyncStatus("offline");
    }
    setLoaded(true);
  }

  function loadFromLocalStorage() {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        const d = JSON.parse(saved);
        if (d.rows?.length) {
          setRows(d.rows);
          if (d.lastImport) setLastImport(d.lastImport);
        } else {
          setRows(SEED.map((r,i)=>({...r,id:i+1,winRate:r.win_rate})));
        }
      } else {
        setRows(SEED.map((r,i)=>({...r,id:i+1,winRate:r.win_rate})));
      }
    } catch {}
    setLoaded(true);
  }

  // ── Real-time subscription (Supabase) ─────────────────────────────────────
  useEffect(() => {
    if (!supabaseConfigured || !onlineMode) return;

    const channel = supabase
      .channel("proposals_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "proposals" },
        (payload) => {
          setSyncStatus("syncing");
          if (payload.eventType === "INSERT") {
            setRows(prev => [...prev, fromDB(payload.new, prev.length)].sort((a,b)=>a.sort-b.sort));
          } else if (payload.eventType === "UPDATE") {
            setRows(prev => prev.map(r => r.id === payload.new.id ? fromDB(payload.new, 0) : r));
          } else if (payload.eventType === "DELETE") {
            setRows(prev => prev.filter(r => r.id !== payload.old.id));
          }
          setTimeout(() => setSyncStatus("online"), 800);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [supabaseConfigured, onlineMode]);

  // ── Persist to localStorage (always, as backup) ───────────────────────────
  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(LS_KEY, JSON.stringify({ rows, lastImport }));
  }, [rows, loaded, lastImport]);

  // ── CRUD operations ───────────────────────────────────────────────────────
  async function updateCell(id, field, val) {
    // Optimistic local update first
    setRows(prev => prev.map(r => r.id===id ? {...r,[field]:val} : r));

    if (onlineMode && supabaseConfigured) {
      setSyncStatus("syncing");
      const dbField = field==="winRate"?"win_rate":field;
      const { error } = await supabase.from("proposals").update({ [dbField]: val }).eq("id", id);
      if (error) console.error("Update error:", error);
      setTimeout(() => setSyncStatus("online"), 600);
    }
  }

  async function deleteRow(id) {
    if (!window.confirm("Delete this proposal?")) return;
    setRows(prev => prev.filter(r => r.id !== id));
    if (onlineMode && supabaseConfigured) {
      setSyncStatus("syncing");
      await supabase.from("proposals").delete().eq("id", id);
      setTimeout(() => setSyncStatus("online"), 600);
    }
  }

  async function addRow(form) {
    const newRow = {
      cost:      parseFloat(form.cost)||0,
      markup:    parseFloat(form.markup)||0.25,
      winRate:   parseFloat(form.winRate)||0,
      revisions: parseFloat(form.revisions)||0,
      comment:   form.comment||"",
      sort:      rows.length + 1,
    };

    if (onlineMode && supabaseConfigured) {
      setSyncStatus("syncing");
      const { data, error } = await supabase.from("proposals").insert([toDB(newRow)]).select().single();
      if (!error && data) {
        setRows(prev => [...prev, fromDB(data, prev.length)]);
      }
      setTimeout(() => setSyncStatus("online"), 600);
    } else {
      const tempId = Date.now();
      setRows(prev => [...prev, {...newRow, id: tempId}]);
    }
    setShowAdd(false);
  }

  async function handleImport(data, mode, filename) {
    const info = { filename: filename||"Excel file", count: data.length, time: new Date().toLocaleString("en-PH") };

    if (onlineMode && supabaseConfigured) {
      setSyncStatus("syncing");
      if (mode === "replace") {
        await supabase.from("proposals").delete().neq("id", 0); // delete all
      }
      const insertRows = data.map((r,i) => ({ ...toDB(r), sort_order: (mode==="append"?rows.length:0)+i+1 }));
      const { data: inserted } = await supabase.from("proposals").insert(insertRows).select();
      if (inserted) {
        const newRows = mode==="append" ? [...rows, ...inserted.map(fromDB)] : inserted.map(fromDB);
        setRows(newRows.sort((a,b)=>a.sort-b.sort));
      }
      setTimeout(() => setSyncStatus("online"), 800);
    } else {
      const importedRows = data.map((r,i) => ({...r, id: Date.now()+i, winRate: r.winRate||0}));
      setRows(mode==="append" ? [...rows, ...importedRows] : importedRows);
    }

    setLastImport(info);
    setShowImport(false);
    setTab("dashboard");
  }

  function handleExport() {
    exportToExcel(computed, `SALES_TRACKER_EXPORT_${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  function setFilterAndGo(status) {
    setFilterStatus(status);
    setTab("tracker");
  }

  // ── Derived data ──────────────────────────────────────────────────────────
  const computed = rows.map((r,i) => compute(r,i));
  const totals   = computed.reduce((acc,r) => ({
    cost:acc.cost+(r.cost||0), markupVal:acc.markupVal+r.markupVal,
    totalRevenue:acc.totalRevenue+r.totalRevenue, totalSold:acc.totalSold+r.totalSold,
    revisions:acc.revisions+(parseFloat(r.revisions)||0),
    totalSales:acc.totalSales+r.totalSales, pipeline:acc.pipeline+r.pipeline,
  }), {cost:0,markupVal:0,totalRevenue:0,totalSold:0,revisions:0,totalSales:0,pipeline:0});

  const statusCounts = STATUS_ORDER.map(s => ({
    name:s, count:computed.filter(r=>r.status===s).length,
    cost:computed.filter(r=>r.status===s).reduce((a,r)=>a+(r.cost||0),0),
  }));
  const winRate  = computed.length ? computed.filter(r=>r.status==="Win").length/computed.length : 0;
  const filtered = filterStatus==="All" ? computed : computed.filter(r=>r.status===filterStatus);

  if (!loaded) return (
    <div style={{minHeight:"100vh",background:S.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}>
      <div style={{textAlign:"center"}}>
        <div style={{width:40,height:40,border:"3px solid #e0e0e0",borderTopColor:S.primary,borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 16px"}}/>
        <div style={{color:S.muted,fontSize:14}}>Loading sales tracker…</div>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:S.bg,fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @media (max-width:600px) {
          .desktop-only { display:none!important; }
          .mobile-full  { width:100%!important; }
        }
        * { -webkit-tap-highlight-color: transparent; }
        input, button { font-family: inherit; }
      `}</style>

      {/* ── Header ── */}
      <div style={{background:S.primary,padding:"12px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8,position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 12px rgba(0,0,0,0.2)"}}>
        <div>
          <div style={{color:"#fff",fontWeight:800,fontSize:16,letterSpacing:"0.2px"}}>PCORP Sales Tracker</div>
          <div style={{color:"rgba(255,255,255,0.5)",fontSize:11}}>FY 2026 · {computed.length} proposals</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          {!supabaseConfigured&&(
            <span style={{background:"rgba(255,193,7,0.25)",color:"#FFD966",fontSize:11,padding:"3px 10px",borderRadius:100,fontWeight:600,border:"1px solid rgba(255,193,7,0.3)"}}>Offline mode</span>
          )}
          <button onClick={()=>setShowImport(true)} style={{padding:"6px 14px",background:"rgba(255,255,255,0.15)",color:"#fff",border:"1px solid rgba(255,255,255,0.3)",borderRadius:7,cursor:"pointer",fontSize:12,fontWeight:700}}>⬆ Import</button>
          <button onClick={handleExport} style={{padding:"6px 14px",background:"rgba(255,255,255,0.15)",color:"#fff",border:"1px solid rgba(255,255,255,0.3)",borderRadius:7,cursor:"pointer",fontSize:12,fontWeight:700}}>⬇ Export</button>
          <SyncDot status={syncStatus}/>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{background:"#fff",borderBottom:"1px solid "+S.border,display:"flex",position:"sticky",top:49,zIndex:99}}>
        {[{id:"dashboard",label:"📊 Dashboard"},{id:"tracker",label:"📋 Tracker"}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            padding:"12px 20px",border:"none",cursor:"pointer",fontSize:13,fontWeight:700,
            background:"transparent",
            borderBottom:tab===t.id?"2.5px solid "+S.primary:"2.5px solid transparent",
            color:tab===t.id?S.primary:"#888",transition:"all 0.15s",
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── Content ── */}
      {tab==="dashboard"&&<Dashboard computed={computed} totals={totals} statusCounts={statusCounts} winRate={winRate} lastImport={lastImport} setFilterAndGo={setFilterAndGo}/>}
      {tab==="tracker"&&<TrackerView computed={computed} rows={rows} updateCell={updateCell} deleteRow={deleteRow} filterStatus={filterStatus} setFilterStatus={setFilterStatus} filtered={filtered} totals={totals} onAdd={()=>setShowAdd(true)} onImport={()=>setShowImport(true)} onExport={handleExport}/>}

      {showAdd&&<AddModal onSave={addRow} onClose={()=>setShowAdd(false)} nextNum={rows.length+1}/>}
      {showImport&&<ImportModal onImport={handleImport} onClose={()=>setShowImport(false)}/>}
    </div>
  );
}
