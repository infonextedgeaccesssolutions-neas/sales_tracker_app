import { useState, useEffect, useCallback, useRef } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

const INITIAL_DATA = [
  { id: 1, cost: 34000000,    markup: 0.20, winRate: 0,   revisions: 32000000,   comment: "Serendra 2 Alveo" },
  { id: 2, cost: 11586094.43, markup: 0.25, winRate: 0,   revisions: 0,          comment: "Alveo" },
  { id: 3, cost: 7827388.53,  markup: 0.25, winRate: 0.7, revisions: 3629947.46, comment: "ACEN" },
  { id: 4, cost: 578970.77,   markup: 0.25, winRate: 0.3, revisions: 0,          comment: "" },
  { id: 5, cost: 2671382.72,  markup: 0.25, winRate: 0.5, revisions: 0,          comment: "ACEN" },
  { id: 6, cost: 3685582.20,  markup: 0.25, winRate: 0.9, revisions: 0,          comment: "Park Terraces" },
  { id: 7, cost: 67924931.44, markup: 0.25, winRate: 0.1, revisions: 0,          comment: "" },
  { id: 8, cost: 11067983.77, markup: 0.25, winRate: 0.1, revisions: 0,          comment: "ACEN" },
  { id: 9, cost: 1223040,     markup: 0.10, winRate: 1.0, revisions: 1223040,    comment: "Manpower 1Yr / Jangho" },
  { id: 10, cost: 11477183.54, markup: 0.25, winRate: 0.1, revisions: 9557337.23, comment: "" },
  { id: 11, cost: 1382754.45,  markup: 0.25, winRate: 0.1, revisions: 2382754.45, comment: "" },
  { id: 12, cost: 4615637.72,  markup: 0.25, winRate: 0,   revisions: 0,           comment: "Pending APMC" },
];

const STATUS_CFG = {
  Win:         { bg: "#00B050", text: "#fff", dot: "#00B050" },
  Negotiation: { bg: "#FFC000", text: "#7a5800", dot: "#FFC000" },
  "On-bidding":{ bg: "#2E75B6", text: "#fff", dot: "#2E75B6" },
  Revision:    { bg: "#ED7D31", text: "#fff", dot: "#ED7D31" },
  Loss:        { bg: "#C00000", text: "#fff", dot: "#C00000" },
};
const STATUS_ORDER = ["Win","Negotiation","On-bidding","Revision","Loss"];

function getStatus(winRate, revisions) {
  const w = parseFloat(winRate) || 0;
  const r = parseFloat(revisions) || 0;
  if (w >= 1)   return "Win";
  if (w >= 0.6) return "Negotiation";
  if (w > 0)    return "On-bidding";
  if (r > 0)    return "Revision";
  return "Loss";
}

function compute(row, idx, allRows) {
  const cost        = parseFloat(row.cost)      || 0;
  const markup      = parseFloat(row.markup)    || 0;
  const winRate     = parseFloat(row.winRate)   || 0;
  const revisions   = parseFloat(row.revisions) || 0;
  const status      = getStatus(winRate, revisions);
  const markupVal   = cost * markup;
  const isWin       = status === "Win";
  const isLoss      = status === "Loss";
  const proposalNum = `PCORP-${String(idx + 1).padStart(3, "0")}-26`;
  return {
    ...row,
    proposalNum,
    status,
    markupVal,
    totalRevenue: isWin ? cost + markupVal : 0,
    totalSold:    isWin ? 1 : 0,
    totalSales:   isWin ? cost + markupVal : 0,
    pipeline:     !isWin && !isLoss ? cost + markupVal : 0,
    lossRate:     1 - winRate,
  };
}

const peso = (n) => "₱" + (parseFloat(n)||0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct  = (n) => ((parseFloat(n)||0)*100).toFixed(1) + "%";
const num  = (n) => (parseFloat(n)||0).toLocaleString("en-PH");

let nextId = 100;

export default function App() {
  const [tab, setTab]           = useState("dashboard");
  const [rows, setRows]         = useState(INITIAL_DATA);
  const [editingCell, setEditingCell] = useState(null);
  const [showAdd, setShowAdd]   = useState(false);
  const [loaded, setLoaded]     = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const saveTimer = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const result = await window.storage.get("sales_tracker_rows");
        if (result && result.value) {
          const parsed = JSON.parse(result.value);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setRows(parsed);
            nextId = Math.max(...parsed.map(r => r.id)) + 1;
          }
        }
      } catch(e) {}
      setLoaded(true);
    })();
  }, []);

  const persist = useCallback((newRows) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await window.storage.set("sales_tracker_rows", JSON.stringify(newRows));
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus(""), 2000);
      } catch(e) { setSaveStatus("error"); }
    }, 600);
  }, []);

  const updateRows = (newRows) => { setRows(newRows); persist(newRows); };

  const computed = rows.map((r, i) => compute(r, i, rows));

  const totals = computed.reduce((acc, r) => ({
    cost:     acc.cost     + (r.cost||0),
    markupVal:acc.markupVal+ (r.markupVal||0),
    totalRevenue: acc.totalRevenue + r.totalRevenue,
    totalSold:    acc.totalSold    + r.totalSold,
    revisions:    acc.revisions    + (parseFloat(r.revisions)||0),
    totalSales:   acc.totalSales   + r.totalSales,
    pipeline:     acc.pipeline     + r.pipeline,
  }), { cost:0, markupVal:0, totalRevenue:0, totalSold:0, revisions:0, totalSales:0, pipeline:0 });

  const statusCounts = STATUS_ORDER.map(s => ({
    name: s,
    count: computed.filter(r => r.status === s).length,
    cost:  computed.filter(r => r.status === s).reduce((a,r) => a+(r.cost||0), 0),
  }));

  const winRate = computed.length ? (computed.filter(r => r.status === "Win").length / computed.length) : 0;

  const filtered = filterStatus === "All" ? computed : computed.filter(r => r.status === filterStatus);

  function updateCell(id, field, val) {
    updateRows(rows.map(r => r.id === id ? { ...r, [field]: val } : r));
  }
  function deleteRow(id) {
    if (!window.confirm("Delete this proposal?")) return;
    updateRows(rows.filter(r => r.id !== id));
  }
  function addRow(form) {
    const newRow = { id: nextId++, cost: parseFloat(form.cost)||0, markup: parseFloat(form.markup)||0.25, winRate: parseFloat(form.winRate)||0, revisions: parseFloat(form.revisions)||0, comment: form.comment||"" };
    updateRows([...rows, newRow]);
    setShowAdd(false);
  }

  if (!loaded) return <div style={{padding:"2rem",textAlign:"center",color:"var(--color-text-secondary)"}}>Loading…</div>;

  return (
    <div style={{fontFamily:"var(--font-sans)",minHeight:"100vh",background:"var(--color-background-tertiary)"}}>
      <Header saveStatus={saveStatus} />
      <TabNav tab={tab} setTab={setTab} />

      {tab === "dashboard" && <Dashboard computed={computed} totals={totals} statusCounts={statusCounts} winRate={winRate} />}
      {tab === "tracker"   && (
        <TrackerView
          computed={computed} rows={rows}
          editingCell={editingCell} setEditingCell={setEditingCell}
          updateCell={updateCell} deleteRow={deleteRow}
          filterStatus={filterStatus} setFilterStatus={setFilterStatus}
          filtered={filtered} totals={totals}
          onAdd={() => setShowAdd(true)}
        />
      )}

      {showAdd && <AddModal onSave={addRow} onClose={() => setShowAdd(false)} nextNum={rows.length + 1} />}
    </div>
  );
}

function Header({ saveStatus }) {
  return (
    <div style={{background:"#1F3864",padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div>
        <div style={{color:"#fff",fontWeight:500,fontSize:"17px",letterSpacing:"0.3px"}}>PCORP Sales Tracker</div>
        <div style={{color:"rgba(255,255,255,0.6)",fontSize:"12px"}}>FY 2026</div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
        {saveStatus === "saved" && <span style={{color:"#00B050",fontSize:"12px"}}>✓ Saved</span>}
        {saveStatus === "error" && <span style={{color:"#ff6b6b",fontSize:"12px"}}>Save failed</span>}
        <div style={{width:"8px",height:"8px",borderRadius:"50%",background:"#00B050"}} />
        <span style={{color:"rgba(255,255,255,0.7)",fontSize:"12px"}}>Live</span>
      </div>
    </div>
  );
}

function TabNav({ tab, setTab }) {
  const tabs = [
    { id:"dashboard", label:"Dashboard" },
    { id:"tracker",   label:"Tracker" },
  ];
  return (
    <div style={{background:"var(--color-background-primary)",borderBottom:"0.5px solid var(--color-border-tertiary)",display:"flex",gap:0}}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => setTab(t.id)} style={{
          padding:"12px 24px",border:"none",borderBottom: tab===t.id ? "2px solid #1F3864" : "2px solid transparent",
          background:"transparent",cursor:"pointer",fontSize:"14px",fontWeight:tab===t.id?500:400,
          color: tab===t.id ? "#1F3864" : "var(--color-text-secondary)"
        }}>{t.label}</button>
      ))}
    </div>
  );
}

function KpiCard({ label, value, sub, color }) {
  return (
    <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1rem 1.25rem",borderTop:`3px solid ${color||"#1F3864"}`}}>
      <div style={{fontSize:"12px",color:"var(--color-text-secondary)",marginBottom:"6px"}}>{label}</div>
      <div style={{fontSize:"22px",fontWeight:500,color:"var(--color-text-primary)",lineHeight:1}}>{value}</div>
      {sub && <div style={{fontSize:"11px",color:"var(--color-text-secondary)",marginTop:"4px"}}>{sub}</div>}
    </div>
  );
}

const CHART_COLORS = { Win:"#00B050", Negotiation:"#FFC000", "On-bidding":"#2E75B6", Revision:"#ED7D31", Loss:"#C00000" };

const TooltipPeso = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",padding:"8px 12px",fontSize:"13px"}}>
      <div style={{fontWeight:500}}>{payload[0].name}</div>
      <div>{peso(payload[0].value)}</div>
    </div>
  );
};

const TooltipCount = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",padding:"8px 12px",fontSize:"13px"}}>
      <div style={{fontWeight:500}}>{payload[0].name || payload[0].payload?.name}</div>
      <div>{payload[0].value} proposals</div>
    </div>
  );
};

function Dashboard({ computed, totals, statusCounts, winRate }) {
  const pieData = statusCounts.filter(s => s.count > 0).map(s => ({ name: s.name, value: s.count }));

  return (
    <div style={{padding:"20px",maxWidth:"1100px",margin:"0 auto"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:"12px",marginBottom:"20px"}}>
        <KpiCard label="Total Proposals" value={computed.length} color="#1F3864" />
        <KpiCard label="Won" value={computed.filter(r=>r.status==="Win").length} color="#00B050" sub={pct(winRate) + " win rate"} />
        <KpiCard label="Negotiation" value={computed.filter(r=>r.status==="Negotiation").length} color="#FFC000" />
        <KpiCard label="On-bidding" value={computed.filter(r=>r.status==="On-bidding").length} color="#2E75B6" />
        <KpiCard label="Revision" value={computed.filter(r=>r.status==="Revision").length} color="#ED7D31" />
        <KpiCard label="Loss" value={computed.filter(r=>r.status==="Loss").length} color="#C00000" />
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:"12px",marginBottom:"24px"}}>
        <KpiCard label="Total Cost" value={peso(totals.cost)} color="#1F3864" />
        <KpiCard label="Total Revenue" value={peso(totals.totalRevenue)} color="#00B050" />
        <KpiCard label="Total Sales" value={peso(totals.totalSales)} color="#17375E" />
        <KpiCard label="Pipeline Value" value={peso(totals.pipeline)} color="#2E75B6" />
        <KpiCard label="Total Revisions" value={peso(totals.revisions)} color="#ED7D31" />
        <KpiCard label="Total Sold" value={num(totals.totalSold)} color="#375623" />
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:"20px",marginBottom:"24px"}}>
        <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1.25rem"}}>
          <div style={{fontSize:"14px",fontWeight:500,marginBottom:"16px",color:"var(--color-text-primary)"}}>Proposals by status</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                {pieData.map((entry,i) => <Cell key={i} fill={CHART_COLORS[entry.name]||"#888"} />)}
              </Pie>
              <Tooltip content={<TooltipCount />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1.25rem"}}>
          <div style={{fontSize:"14px",fontWeight:500,marginBottom:"16px",color:"var(--color-text-primary)"}}>Cost proposal by status (₱)</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={statusCounts} margin={{left:10,right:10,top:5,bottom:5}}>
              <XAxis dataKey="name" tick={{fontSize:11}} />
              <YAxis tickFormatter={v => "₱"+Intl.NumberFormat("en",{notation:"compact"}).format(v)} tick={{fontSize:11}} />
              <Tooltip content={<TooltipPeso />} />
              <Bar dataKey="cost" name="Cost" radius={[4,4,0,0]}>
                {statusCounts.map((s,i) => <Cell key={i} fill={CHART_COLORS[s.name]||"#888"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",overflow:"hidden"}}>
        <div style={{padding:"1rem 1.25rem",borderBottom:"0.5px solid var(--color-border-tertiary)"}}>
          <span style={{fontSize:"14px",fontWeight:500,color:"var(--color-text-primary)"}}>Status summary</span>
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:"13px"}}>
            <thead>
              <tr style={{background:"var(--color-background-secondary)"}}>
                {["Status","Count","Total Cost","Total Revenue","Pipeline Value"].map(h => (
                  <th key={h} style={{padding:"10px 16px",textAlign:"left",fontWeight:500,color:"var(--color-text-secondary)",whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {statusCounts.map((s,i) => {
                const sc = STATUS_CFG[s.name];
                const rev = computed.filter(r=>r.status===s.name).reduce((a,r)=>a+r.totalRevenue,0);
                const pip = computed.filter(r=>r.status===s.name).reduce((a,r)=>a+r.pipeline,0);
                return (
                  <tr key={s.name} style={{borderTop:"0.5px solid var(--color-border-tertiary)"}}>
                    <td style={{padding:"10px 16px"}}>
                      <span style={{background:sc.bg,color:sc.text,borderRadius:"100px",padding:"2px 10px",fontSize:"12px",fontWeight:500}}>{s.name}</span>
                    </td>
                    <td style={{padding:"10px 16px",fontWeight:500}}>{s.count}</td>
                    <td style={{padding:"10px 16px"}}>{peso(s.cost)}</td>
                    <td style={{padding:"10px 16px"}}>{peso(rev)}</td>
                    <td style={{padding:"10px 16px"}}>{peso(pip)}</td>
                  </tr>
                );
              })}
              <tr style={{borderTop:"1px solid var(--color-border-primary)",background:"var(--color-background-secondary)"}}>
                <td style={{padding:"10px 16px",fontWeight:500}}>Total</td>
                <td style={{padding:"10px 16px",fontWeight:500}}>{computed.length}</td>
                <td style={{padding:"10px 16px",fontWeight:500}}>{peso(totals.cost)}</td>
                <td style={{padding:"10px 16px",fontWeight:500}}>{peso(totals.totalRevenue)}</td>
                <td style={{padding:"10px 16px",fontWeight:500}}>{peso(totals.pipeline)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const sc = STATUS_CFG[status] || { bg:"#888", text:"#fff" };
  return (
    <span style={{background:sc.bg,color:sc.text,borderRadius:"100px",padding:"3px 10px",fontSize:"12px",fontWeight:500,whiteSpace:"nowrap",display:"inline-block"}}>
      {status}
    </span>
  );
}

function EditableCell({ value, field, rowId, type="text", onSave, style={} }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal]         = useState(value);
  const inputRef              = useRef();

  useEffect(() => { setVal(value); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  function commit() {
    setEditing(false);
    const parsed = type === "number" ? (parseFloat(val)||0) : val;
    onSave(rowId, field, parsed);
  }

  if (!editing) {
    return (
      <td onClick={() => setEditing(true)} style={{cursor:"pointer",padding:"8px 12px",whiteSpace:"nowrap",...style}} title="Click to edit">
        {style.display === "formatted" ? value : value}
      </td>
    );
  }
  return (
    <td style={{padding:"4px 6px"}}>
      <input ref={inputRef} type={type==="number"?"number":"text"} value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={commit} onKeyDown={e => { if(e.key==="Enter") commit(); if(e.key==="Escape") setEditing(false); }}
        style={{width:"100%",minWidth:"80px",border:"1.5px solid #1F3864",borderRadius:"4px",padding:"4px 6px",fontSize:"13px",background:"var(--color-background-primary)",color:"var(--color-text-primary)"}}
        step={type==="number"?".01":undefined}
      />
    </td>
  );
}

function TrackerView({ computed, rows, updateCell, deleteRow, filterStatus, setFilterStatus, filtered, totals, onAdd }) {
  const cols = [
    { label:"#",               w:40 },
    { label:"Proposal #",      w:120 },
    { label:"Status",          w:120 },
    { label:"Cost Proposal",   w:150 },
    { label:"Markup %",        w:90 },
    { label:"Markup Value",    w:140 },
    { label:"Win Rate",        w:90 },
    { label:"Loss Rate",       w:90 },
    { label:"Total Revenue",   w:145 },
    { label:"Total Sold",      w:90 },
    { label:"Revisions",       w:135 },
    { label:"Total Sales",     w:145 },
    { label:"Pipeline",        w:140 },
    { label:"Comments",        w:160 },
    { label:"",                w:50 },
  ];

  return (
    <div style={{padding:"16px 20px",maxWidth:"1400px",margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px",flexWrap:"wrap",gap:"10px"}}>
        <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
          {["All",...STATUS_ORDER].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{
              padding:"5px 12px",borderRadius:"100px",fontSize:"12px",fontWeight:500,cursor:"pointer",
              border: filterStatus===s ? "1.5px solid #1F3864" : "0.5px solid var(--color-border-secondary)",
              background: filterStatus===s ? "#1F3864" : "var(--color-background-primary)",
              color: filterStatus===s ? "#fff" : "var(--color-text-secondary)"
            }}>{s}</button>
          ))}
        </div>
        <button onClick={onAdd} style={{
          padding:"8px 18px",background:"#1F3864",color:"#fff",border:"none",borderRadius:"var(--border-radius-md)",
          cursor:"pointer",fontSize:"13px",fontWeight:500,display:"flex",alignItems:"center",gap:"6px"
        }}>+ Add proposal</button>
      </div>

      <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",overflow:"hidden"}}>
        <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:"13px",tableLayout:"fixed",minWidth:"1200px"}}>
            <colgroup>{cols.map((c,i)=><col key={i} style={{width:c.w}} />)}</colgroup>
            <thead>
              <tr style={{background:"#1F3864"}}>
                {cols.map((c,i)=>(
                  <th key={i} style={{padding:"10px 12px",textAlign:"left",fontWeight:500,color:"rgba(255,255,255,0.9)",whiteSpace:"nowrap",fontSize:"12px"}}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const bg = i%2===0 ? "var(--color-background-primary)" : "var(--color-background-secondary)";
                const tdStyle = {padding:"8px 12px",color:"var(--color-text-primary)",background:bg,whiteSpace:"nowrap"};
                const inputStyle = {color:"#0000CC",background:bg};
                return (
                  <tr key={r.id} style={{borderTop:"0.5px solid var(--color-border-tertiary)"}}>
                    <td style={{...tdStyle,color:"var(--color-text-secondary)",fontSize:"12px"}}>{i+1}</td>
                    <td style={{...tdStyle,fontWeight:500}}>{r.proposalNum}</td>
                    <td style={{...tdStyle}}><StatusBadge status={r.status} /></td>

                    <EditableCell value={r.cost}      field="cost"      rowId={r.id} type="number" onSave={updateCell} style={{...tdStyle,...inputStyle}} />
                    <EditableCell value={r.markup}    field="markup"    rowId={r.id} type="number" onSave={updateCell} style={{...tdStyle,...inputStyle}} />

                    <td style={{...tdStyle}}>{peso(r.markupVal)}</td>

                    <EditableCell value={r.winRate}   field="winRate"   rowId={r.id} type="number" onSave={updateCell} style={{...tdStyle,...inputStyle}} />

                    <td style={{...tdStyle}}>{pct(r.lossRate)}</td>
                    <td style={{...tdStyle}}>{peso(r.totalRevenue)}</td>
                    <td style={{...tdStyle,textAlign:"center"}}>{r.totalSold}</td>

                    <EditableCell value={r.revisions} field="revisions" rowId={r.id} type="number" onSave={updateCell} style={{...tdStyle,...inputStyle}} />

                    <td style={{...tdStyle}}>{peso(r.totalSales)}</td>
                    <td style={{...tdStyle}}>{peso(r.pipeline)}</td>

                    <EditableCell value={r.comment}   field="comment"   rowId={r.id} type="text"   onSave={updateCell} style={{...tdStyle,overflow:"hidden",textOverflow:"ellipsis",maxWidth:"160px"}} />

                    <td style={{...tdStyle,textAlign:"center"}}>
                      <button onClick={() => deleteRow(r.id)} title="Delete" style={{
                        background:"none",border:"none",cursor:"pointer",color:"#C00000",fontSize:"15px",padding:"2px 6px",borderRadius:"4px"
                      }}>✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{background:"#1F3864",borderTop:"1px solid rgba(255,255,255,0.2)"}}>
                <td colSpan={3} style={{padding:"10px 12px",color:"#fff",fontWeight:500,fontSize:"12px"}}>TOTALS ({filtered.length} rows)</td>
                <td style={{padding:"10px 12px",color:"#fff",fontWeight:500,fontSize:"12px"}}>{peso(filtered.reduce((a,r)=>a+(r.cost||0),0))}</td>
                <td />
                <td style={{padding:"10px 12px",color:"#fff",fontWeight:500,fontSize:"12px"}}>{peso(filtered.reduce((a,r)=>a+r.markupVal,0))}</td>
                <td /><td />
                <td style={{padding:"10px 12px",color:"#fff",fontWeight:500,fontSize:"12px"}}>{peso(filtered.reduce((a,r)=>a+r.totalRevenue,0))}</td>
                <td style={{padding:"10px 12px",color:"#fff",fontWeight:500,fontSize:"12px",textAlign:"center"}}>{filtered.reduce((a,r)=>a+r.totalSold,0)}</td>
                <td style={{padding:"10px 12px",color:"#fff",fontWeight:500,fontSize:"12px"}}>{peso(filtered.reduce((a,r)=>a+(parseFloat(r.revisions)||0),0))}</td>
                <td style={{padding:"10px 12px",color:"#fff",fontWeight:500,fontSize:"12px"}}>{peso(filtered.reduce((a,r)=>a+r.totalSales,0))}</td>
                <td style={{padding:"10px 12px",color:"#fff",fontWeight:500,fontSize:"12px"}}>{peso(filtered.reduce((a,r)=>a+r.pipeline,0))}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>

        <div style={{padding:"10px 16px",background:"var(--color-background-secondary)",borderTop:"0.5px solid var(--color-border-tertiary)",fontSize:"12px",color:"var(--color-text-secondary)",display:"flex",gap:"20px",flexWrap:"wrap"}}>
          <span style={{color:"#0000CC",fontWeight:500}}>Blue cells</span> = editable inputs &nbsp;·&nbsp; Click any blue cell to edit &nbsp;·&nbsp; Status auto-updates from Win Rate &amp; Revisions
          <span style={{marginLeft:"auto"}}>
            Win Rate: 1.0→Win &nbsp;|&nbsp; ≥0.6→Negotiation &nbsp;|&nbsp; &gt;0→On-bidding &nbsp;|&nbsp; 0+Rev&gt;0→Revision &nbsp;|&nbsp; 0→Loss
          </span>
        </div>
      </div>
    </div>
  );
}

function AddModal({ onSave, onClose, nextNum }) {
  const [form, setForm] = useState({ cost:"", markup:"0.25", winRate:"0", revisions:"0", comment:"" });
  const preview = getStatus(parseFloat(form.winRate)||0, parseFloat(form.revisions)||0);
  const sc = STATUS_CFG[preview];

  function submit(e) {
    e.preventDefault();
    if (!form.cost) return alert("Cost Proposal is required.");
    onSave(form);
  }

  const inputStyle = {width:"100%",padding:"8px 10px",border:"0.5px solid var(--color-border-secondary)",borderRadius:"var(--border-radius-md)",fontSize:"14px",background:"var(--color-background-primary)",color:"var(--color-text-primary)",boxSizing:"border-box"};
  const labelStyle = {display:"block",fontSize:"12px",color:"var(--color-text-secondary)",marginBottom:"5px"};

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999,padding:"20px"}}>
      <div style={{background:"var(--color-background-primary)",borderRadius:"var(--border-radius-lg)",border:"0.5px solid var(--color-border-tertiary)",width:"100%",maxWidth:"460px",overflow:"hidden"}}>
        <div style={{background:"#1F3864",padding:"16px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{color:"#fff",fontWeight:500}}>New proposal — PCORP-{String(nextNum).padStart(3,"0")}-26</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"rgba(255,255,255,0.7)",fontSize:"18px",cursor:"pointer",lineHeight:1}}>✕</button>
        </div>
        <form onSubmit={submit} style={{padding:"20px",display:"flex",flexDirection:"column",gap:"14px"}}>
          <div>
            <label style={labelStyle}>Cost Proposal (₱) *</label>
            <input type="number" placeholder="e.g. 5000000" value={form.cost} onChange={e=>setForm(f=>({...f,cost:e.target.value}))} style={{...inputStyle,borderColor:"#1F3864"}} required />
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
            <div>
              <label style={labelStyle}>Markup % (0–1)</label>
              <input type="number" step="0.01" min="0" max="1" value={form.markup} onChange={e=>setForm(f=>({...f,markup:e.target.value}))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Win Rate (0–1)</label>
              <input type="number" step="0.01" min="0" max="1" value={form.winRate} onChange={e=>setForm(f=>({...f,winRate:e.target.value}))} style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Revisions (₱)</label>
            <input type="number" value={form.revisions} onChange={e=>setForm(f=>({...f,revisions:e.target.value}))} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Comments</label>
            <input type="text" value={form.comment} onChange={e=>setForm(f=>({...f,comment:e.target.value}))} style={inputStyle} placeholder="Client name, notes…" />
          </div>

          <div style={{background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)",padding:"10px 14px",display:"flex",alignItems:"center",gap:"10px",border:"0.5px solid var(--color-border-tertiary)"}}>
            <span style={{fontSize:"12px",color:"var(--color-text-secondary)"}}>Auto status:</span>
            <StatusBadge status={preview} />
            <span style={{fontSize:"12px",color:"var(--color-text-secondary)",marginLeft:"auto"}}>
              {form.cost ? `Markup: ${peso((parseFloat(form.cost)||0)*(parseFloat(form.markup)||0))}` : "Enter cost to preview"}
            </span>
          </div>

          <div style={{display:"flex",gap:"10px",justifyContent:"flex-end",marginTop:"4px"}}>
            <button type="button" onClick={onClose} style={{padding:"9px 20px",border:"0.5px solid var(--color-border-secondary)",borderRadius:"var(--border-radius-md)",background:"transparent",cursor:"pointer",fontSize:"14px",color:"var(--color-text-secondary)"}}>Cancel</button>
            <button type="submit" style={{padding:"9px 24px",background:"#1F3864",color:"#fff",border:"none",borderRadius:"var(--border-radius-md)",cursor:"pointer",fontSize:"14px",fontWeight:500}}>Add proposal</button>
          </div>
        </form>
      </div>
    </div>
  );
}
