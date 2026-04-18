import { useState, useEffect, useRef, useCallback } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import * as XLSX from "xlsx";

const STATUS_CONFIG = {
  Win:         { color: "#1D9E75", bg: "#E1F5EE", text: "#085041" },
  Loss:        { color: "#E24B4A", bg: "#FCEBEB", text: "#501313" },
  Negotiation: { color: "#378ADD", bg: "#E6F1FB", text: "#042C53" },
  "On-bidding":{ color: "#EF9F27", bg: "#FAEEDA", text: "#412402" },
  Revision:    { color: "#D4537E", bg: "#FBEAF0", text: "#4B1528" },
};
const STATUS_OPTIONS = ["Win", "Loss", "Negotiation", "On-bidding", "Revision"];

const fmt = (n) => "₱" + Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (n) => (Number(n || 0) * 100).toFixed(1) + "%";
const numVal = (v) => parseFloat(String(v).replace(/[^0-9.-]/g, "")) || 0;

const SEED_DATA = [
  { id: 1, status: "Revision",    proposal: "PCORP-001-26", cost: 34000000,    markup: 0.20, revisions: 32000000,   winRate: 0,   comments: "Serendra 2 Alveo" },
  { id: 2, status: "Loss",        proposal: "PCORP-002-26", cost: 11586094.43, markup: 0.25, revisions: 0,          winRate: 0,   comments: "Alveo" },
  { id: 3, status: "Negotiation", proposal: "PCORP-003-26", cost: 7827388.53,  markup: 0.25, revisions: 3629947.46, winRate: 0.7, comments: "ACEN" },
  { id: 4, status: "On-bidding",  proposal: "PCORP-004-26", cost: 578970.77,   markup: 0.25, revisions: 0,          winRate: 0.3, comments: "" },
  { id: 5, status: "On-bidding",  proposal: "PCORP-005-26", cost: 2671382.72,  markup: 0.25, revisions: 0,          winRate: 0.5, comments: "ACEN" },
  { id: 6, status: "Negotiation", proposal: "PCORP-006-26", cost: 3685582.20,  markup: 0.25, revisions: 0,          winRate: 0.9, comments: "Park Terraces" },
  { id: 7, status: "On-bidding",  proposal: "PCORP-007-26", cost: 67924931.44, markup: 0.25, revisions: 0,          winRate: 0.1, comments: "" },
  { id: 8, status: "On-bidding",  proposal: "PCORP-008-26", cost: 11067983.77, markup: 0.25, revisions: 0,          winRate: 0.1, comments: "ACEN" },
  { id: 9, status: "Win",         proposal: "PCORP-009-26", cost: 1223040,     markup: 0.10, revisions: 1223040,    winRate: 1.0, comments: "Manpower 1Yr / Jangho" },
  { id: 10,status: "On-bidding",  proposal: "PCORP-010-26", cost: 11477183.54, markup: 0.25, revisions: 9557337.23, winRate: 0.1, comments: "" },
  { id: 11,status: "On-bidding",  proposal: "PCORP-011-26", cost: 1382754.45,  markup: 0.25, revisions: 2382754.45, winRate: 0.1, comments: "" },
  { id: 12,status: "Loss",        proposal: "PCORP-012-26", cost: 4615637.72,  markup: 0.25, revisions: 0,          winRate: 0,   comments: "" },
];

function computeRow(r) {
  const markupVal = r.cost * r.markup;
  const isWin  = r.status === "Win";
  const isLoss = r.status === "Loss";
  return {
    ...r,
    markupValue:   isWin ? markupVal : 0,
    totalRevenue:  isWin ? r.cost + markupVal : 0,
    totalSold:     isWin ? 1 : 0,
    totalSales:    isWin ? r.cost + markupVal : 0,
    pipelineValue: (!isWin && !isLoss) ? r.cost : 0,
  };
}

function autoStatus(winRate, revisions) {
  if (winRate >= 1.0)  return "Win";
  if (winRate >= 0.6)  return "Negotiation";
  if (winRate > 0)     return "On-bidding";
  if (revisions > 0)   return "Revision";
  return "Loss";
}

let _nextId = SEED_DATA.length + 1;
const newRow = () => ({
  id: _nextId++,
  status: "On-bidding",
  proposal: `PCORP-${String(_nextId).padStart(3,"0")}-26`,
  cost: 0, markup: 0.25, revisions: 0, winRate: 0.5, comments: "",
});

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [rows, setRows] = useState(SEED_DATA);
  const [editCell, setEditCell] = useState(null);
  const [editVal, setEditVal] = useState("");
  const [toast, setToast] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [filterStatus, setFilterStatus] = useState("All");
  const fileRef = useRef();
  const editRef = useRef();

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get("sales_rows");
        if (r?.value) setRows(JSON.parse(r.value));
      } catch {}
    })();
  }, []);

  const saveRows = useCallback(async (newRows) => {
    setRows(newRows);
    try { await window.storage.set("sales_rows", JSON.stringify(newRows)); } catch {}
  }, []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const computed = rows.map(computeRow);
  const filtered = filterStatus === "All" ? computed : computed.filter(r => r.status === filterStatus);

  const totalCost      = computed.reduce((s, r) => s + (r.cost || 0), 0);
  const totalRevenue   = computed.reduce((s, r) => s + r.totalRevenue, 0);
  const totalSales     = computed.reduce((s, r) => s + r.totalSales, 0);
  const totalPipeline  = computed.reduce((s, r) => s + r.pipelineValue, 0);
  const totalRevisions = computed.reduce((s, r) => s + (r.revisions || 0), 0);
  const totalSold      = computed.reduce((s, r) => s + r.totalSold, 0);
  const avgMarkup      = rows.length ? rows.reduce((s, r) => s + (r.markup || 0), 0) / rows.length : 0;
  const winCount       = computed.filter(r => r.status === "Win").length;
  const winRate        = rows.length ? winCount / rows.length : 0;

  const statusCount = STATUS_OPTIONS.map(s => ({ name: s, value: computed.filter(r => r.status === s).length, color: STATUS_CONFIG[s].color }));

  const startEdit = (id, field, val) => {
    setEditCell({ id, field });
    setEditVal(String(val));
    setTimeout(() => editRef.current?.select(), 20);
  };

  const commitEdit = () => {
    if (!editCell) return;
    const { id, field } = editCell;
    setRows(prev => {
      const next = prev.map(r => {
        if (r.id !== id) return r;
        let upd = { ...r };
        if (field === "status")   upd.status   = editVal;
        else if (field === "comments") upd.comments = editVal;
        else if (field === "proposal") upd.proposal = editVal;
        else {
          const n = numVal(editVal);
          upd[field] = n;
          if (field === "winRate" || field === "revisions") {
            upd.status = autoStatus(field === "winRate" ? n : r.winRate, field === "revisions" ? n : r.revisions);
          }
        }
        return upd;
      });
      saveRows(next);
      return next;
    });
    setEditCell(null);
  };

  const addRow = () => {
    const r = newRow();
    const next = [...rows, r];
    saveRows(next);
    showToast("Row added");
  };

  const deleteRow = (id) => {
    const next = rows.filter(r => r.id !== id);
    saveRows(next);
    showToast("Row deleted", "danger");
  };

  const parseAndImport = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array" });
        const ws = wb.Sheets["SALES TRACKER"] || wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        const headerRow = raw.findIndex(r => String(r[0]).toLowerCase().includes("status"));
        if (headerRow < 0) { showToast("Could not find header row", "danger"); return; }
        const dataRows = raw.slice(headerRow + 1);
        const imported = [];
        let idx = _nextId;
        for (const r of dataRows) {
          const status = String(r[0] || "").trim();
          if (!STATUS_OPTIONS.includes(status)) continue;
          imported.push({
            id: idx++,
            status,
            proposal: String(r[1] || ""),
            cost: numVal(r[2]),
            markup: numVal(r[3]),
            revisions: numVal(r[7]),
            winRate: numVal(r[8]),
            comments: String(r[12] || ""),
          });
        }
        _nextId = idx;
        if (imported.length === 0) { showToast("No valid rows found", "danger"); return; }
        saveRows(imported);
        showToast(`Imported ${imported.length} rows`);
        setTab("tracker");
      } catch (err) {
        showToast("Import failed: " + err.message, "danger");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const exportXlsx = () => {
    const header = ["Status","Proposal #","Cost Proposal (₱)","Markup %","Markup Value (₱)","Total Revenue (₱)","Total Sold","Revisions (₱)","Win Rate","Loss Rate","Total Sales (₱)","Pipeline Value (₱)","Comments"];
    const data = computed.map(r => [r.status, r.proposal, r.cost, r.markup, r.markupValue, r.totalRevenue, r.totalSold, r.revisions, r.winRate, 1 - r.winRate, r.totalSales, r.pipelineValue, r.comments]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
    ws["!cols"] = header.map((h, i) => ({ wch: i === 0 ? 14 : i === 1 ? 16 : i === 12 ? 22 : 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SALES TRACKER");
    const dash = [
      ["SALES DASHBOARD — FY 2026"],
      [],
      ["Total Proposals","Won","Negotiation","On-bidding","Revision","Lost","Win Rate %"],
      [rows.length, winCount, computed.filter(r=>r.status==="Negotiation").length, computed.filter(r=>r.status==="On-bidding").length, computed.filter(r=>r.status==="Revision").length, computed.filter(r=>r.status==="Loss").length, winRate],
      [],
      ["Total Cost (₱)","Total Revenue (₱)","Total Sales (₱)","Pipeline Value (₱)","Total Revisions (₱)","Total Sold","Avg Markup"],
      [totalCost, totalRevenue, totalSales, totalPipeline, totalRevisions, totalSold, avgMarkup],
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(dash);
    XLSX.utils.book_append_sheet(wb, ws2, "DASHBOARD");
    XLSX.writeFile(wb, "SALES_TRACKER_EXPORT.xlsx");
    showToast("Exported successfully");
  };

  const Cell2 = ({ id, field, val, type = "number", className = "" }) => {
    const isEditing = editCell?.id === id && editCell?.field === field;
    if (isEditing) {
      if (field === "status") return (
        <select ref={editRef} value={editVal} onChange={e => setEditVal(e.target.value)}
          onBlur={commitEdit} autoFocus style={{ fontSize: 12, padding: "2px 4px", border: "1.5px solid #378ADD", borderRadius: 4, background: "var(--color-background-primary)", color: "var(--color-text-primary)", width: "100%" }}>
          {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
        </select>
      );
      return (
        <input ref={editRef} type="text" value={editVal}
          onChange={e => setEditVal(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditCell(null); }}
          style={{ fontSize: 12, padding: "2px 6px", border: "1.5px solid #378ADD", borderRadius: 4, background: "var(--color-background-primary)", color: "var(--color-text-primary)", width: "100%", minWidth: 80 }} />
      );
    }
    const display = type === "currency" ? fmt(val) : type === "pct" ? fmtPct(val) : val;
    return (
      <span onClick={() => startEdit(id, field, val)} title="Click to edit"
        className={className}
        style={{ cursor: "pointer", display: "block", padding: "2px 4px", borderRadius: 4, transition: "background 0.15s" }}
        onMouseEnter={e => e.currentTarget.style.background = "var(--color-background-secondary)"}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
        {display || <span style={{ color: "var(--color-text-tertiary)", fontStyle: "italic" }}>—</span>}
      </span>
    );
  };

  const kpiCards = [
    { label: "Total Proposals", val: rows.length, format: "int" },
    { label: "Total Won",       val: winCount, format: "int", color: STATUS_CONFIG.Win.color },
    { label: "Win Rate",        val: fmtPct(winRate), format: "str", color: STATUS_CONFIG.Win.color },
    { label: "Pipeline Value",  val: fmt(totalPipeline), format: "str", color: "#378ADD" },
    { label: "Total Revenue",   val: fmt(totalRevenue), format: "str", color: STATUS_CONFIG.Win.color },
    { label: "Total Revisions", val: fmt(totalRevisions), format: "str", color: STATUS_CONFIG.Revision.color },
    { label: "Total Cost",      val: fmt(totalCost), format: "str" },
    { label: "Avg Markup",      val: fmtPct(avgMarkup), format: "str" },
  ];

  const pipelineBar = computed
    .filter(r => r.pipelineValue > 0)
    .sort((a, b) => b.pipelineValue - a.pipelineValue)
    .slice(0, 8)
    .map(r => ({ name: r.proposal.replace("PCORP-","").replace("-26",""), value: Math.round(r.pipelineValue / 1e6 * 100) / 100, color: STATUS_CONFIG[r.status]?.color || "#888" }));

  const S = {
    wrap: { fontFamily: "var(--font-sans), system-ui, sans-serif", minHeight: "100vh", background: "var(--color-background-tertiary)", color: "var(--color-text-primary)" },
    header: { background: "var(--color-background-primary)", borderBottom: "0.5px solid var(--color-border-tertiary)", padding: "0 24px", display: "flex", alignItems: "center", gap: 24, height: 56 },
    logo: { fontWeight: 500, fontSize: 15, letterSpacing: "-0.3px" },
    tab: (active) => ({ padding: "0 4px", height: 56, display: "flex", alignItems: "center", fontSize: 13, cursor: "pointer", borderBottom: active ? "2px solid var(--color-text-primary)" : "2px solid transparent", color: active ? "var(--color-text-primary)" : "var(--color-text-secondary)", fontWeight: active ? 500 : 400, transition: "all 0.15s", background: "none", border: "none", borderBottom: active ? "2px solid var(--color-text-primary)" : "2px solid transparent" }),
    main: { padding: 24, maxWidth: 1200, margin: "0 auto" },
    card: { background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "20px 24px" },
    kpiGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 },
    kpi: { background: "var(--color-background-secondary)", borderRadius: 8, padding: "14px 16px" },
    kpiLabel: { fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" },
    kpiVal: { fontSize: 20, fontWeight: 500 },
    btn: (variant = "default") => ({
      padding: "7px 14px", borderRadius: 6, fontSize: 13, cursor: "pointer", fontWeight: 400,
      background: variant === "primary" ? "#1D9E75" : variant === "danger" ? "var(--color-background-danger)" : "var(--color-background-secondary)",
      color: variant === "primary" ? "#fff" : variant === "danger" ? "var(--color-text-danger)" : "var(--color-text-primary)",
      border: "0.5px solid " + (variant === "primary" ? "#1D9E75" : "var(--color-border-secondary)"),
    }),
    badge: (status) => ({
      display: "inline-block", padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 500,
      background: STATUS_CONFIG[status]?.bg || "#eee",
      color: STATUS_CONFIG[status]?.text || "#333",
    }),
    th: { fontSize: 11, fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.4px", padding: "8px 10px", textAlign: "left", borderBottom: "0.5px solid var(--color-border-tertiary)", whiteSpace: "nowrap" },
    td: { fontSize: 12, padding: "7px 10px", borderBottom: "0.5px solid var(--color-border-tertiary)", verticalAlign: "middle" },
  };

  return (
    <div style={S.wrap}>
      <h2 className="sr-only">Sales Tracker FY 2026 — Dashboard and Data Entry</h2>

      {toast && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, padding: "10px 18px", borderRadius: 8, background: toast.type === "danger" ? "var(--color-background-danger)" : "var(--color-background-success)", color: toast.type === "danger" ? "var(--color-text-danger)" : "var(--color-text-success)", fontSize: 13, border: "0.5px solid", borderColor: toast.type === "danger" ? "var(--color-border-danger)" : "var(--color-border-success)", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
          {toast.msg}
        </div>
      )}

      <div style={S.header}>
        <span style={S.logo}>📊 Sales Tracker <span style={{ color: "var(--color-text-tertiary)", fontSize: 12 }}>FY 2026</span></span>
        <div style={{ flex: 1, display: "flex", gap: 4 }}>
          {[["dashboard","Dashboard"],["tracker","Tracker"],["import","Import / Export"]].map(([id, label]) => (
            <button key={id} style={S.tab(tab === id)} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
        <button style={S.btn("primary")} onClick={exportXlsx}>↓ Export Excel</button>
      </div>

      <div style={S.main}>

        {tab === "dashboard" && (
          <>
            <div style={S.kpiGrid}>
              {kpiCards.map(k => (
                <div key={k.label} style={S.kpi}>
                  <div style={S.kpiLabel}>{k.label}</div>
                  <div style={{ ...S.kpiVal, color: k.color || "var(--color-text-primary)" }}>{k.val}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16 }}>
              <div style={S.card}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 16 }}>Status breakdown</div>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                  <ResponsiveContainer width={220} height={180}>
                    <PieChart>
                      <Pie data={statusCount.filter(s => s.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40} paddingAngle={2}>
                        {statusCount.filter(s => s.value > 0).map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v, n) => [v + " proposals", n]} contentStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {statusCount.map(s => (
                    <div key={s.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color }} />
                        <span style={{ color: "var(--color-text-secondary)" }}>{s.name}</span>
                      </div>
                      <span style={{ fontWeight: 500 }}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={S.card}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 16 }}>Pipeline value by proposal (₱M)</div>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={pipelineBar} margin={{ top: 4, right: 16, bottom: 20, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} angle={-30} textAnchor="end" />
                    <YAxis tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} tickFormatter={v => `₱${v}M`} />
                    <Tooltip formatter={(v) => [`₱${v}M`, "Pipeline"]} contentStyle={{ fontSize: 12 }} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {pipelineBar.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}

        {tab === "tracker" && (
          <div style={S.card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>Sales Tracker</span>
                <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>{rows.length} proposals</span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ fontSize: 12, padding: "6px 10px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)" }}>
                  <option>All</option>
                  {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                </select>
                <button style={S.btn("primary")} onClick={addRow}>+ Add Row</button>
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", minWidth: 900 }}>
                <colgroup>
                  <col style={{ width: 110 }} /><col style={{ width: 120 }} /><col style={{ width: 130 }} />
                  <col style={{ width: 75 }} /><col style={{ width: 120 }} /><col style={{ width: 130 }} />
                  <col style={{ width: 75 }} /><col style={{ width: 130 }} /><col style={{ width: 130 }} />
                  <col style={{ width: 50 }} />
                </colgroup>
                <thead>
                  <tr>
                    {["Status","Proposal #","Cost (₱)","Markup","Revisions (₱)","Revenue (₱)","Win Rate","Pipeline (₱)","Comments",""].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id} style={{ transition: "background 0.1s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "var(--color-background-secondary)"}
                      onMouseLeave={e => e.currentTarget.style.background = ""}>
                      <td style={S.td}>
                        {editCell?.id === r.id && editCell?.field === "status"
                          ? <Cell2 id={r.id} field="status" val={r.status} />
                          : <span style={S.badge(r.status)} onClick={() => startEdit(r.id, "status", r.status)} title="Click to edit" className="cursor-pointer">{r.status}</span>
                        }
                      </td>
                      <td style={S.td}><Cell2 id={r.id} field="proposal" val={r.proposal} type="text" /></td>
                      <td style={S.td}><Cell2 id={r.id} field="cost" val={r.cost} type="currency" /></td>
                      <td style={S.td}><Cell2 id={r.id} field="markup" val={r.markup} type="pct" /></td>
                      <td style={S.td}><Cell2 id={r.id} field="revisions" val={r.revisions} type="currency" /></td>
                      <td style={{ ...S.td, color: r.totalRevenue > 0 ? STATUS_CONFIG.Win.color : "var(--color-text-tertiary)" }}>{fmt(r.totalRevenue)}</td>
                      <td style={S.td}><Cell2 id={r.id} field="winRate" val={r.winRate} type="pct" /></td>
                      <td style={{ ...S.td, color: r.pipelineValue > 0 ? "#378ADD" : "var(--color-text-tertiary)" }}>{fmt(r.pipelineValue)}</td>
                      <td style={S.td}><Cell2 id={r.id} field="comments" val={r.comments} type="text" /></td>
                      <td style={S.td}>
                        <button onClick={() => deleteRow(r.id)} title="Delete row" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-tertiary)", fontSize: 14, padding: "2px 4px", borderRadius: 4 }}
                          onMouseEnter={e => e.currentTarget.style.color = "var(--color-text-danger)"}
                          onMouseLeave={e => e.currentTarget.style.color = "var(--color-text-tertiary)"}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: "var(--color-background-secondary)" }}>
                    <td colSpan={2} style={{ ...S.td, fontWeight: 500, fontSize: 11, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.4px" }}>TOTALS</td>
                    <td style={{ ...S.td, fontWeight: 500, fontSize: 12 }}>{fmt(totalCost)}</td>
                    <td style={S.td}></td>
                    <td style={{ ...S.td, fontWeight: 500, fontSize: 12 }}>{fmt(totalRevisions)}</td>
                    <td style={{ ...S.td, fontWeight: 500, fontSize: 12, color: STATUS_CONFIG.Win.color }}>{fmt(totalRevenue)}</td>
                    <td style={S.td}></td>
                    <td style={{ ...S.td, fontWeight: 500, fontSize: 12, color: "#378ADD" }}>{fmt(totalPipeline)}</td>
                    <td colSpan={2} style={S.td}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div style={{ marginTop: 12, fontSize: 11, color: "var(--color-text-tertiary)" }}>💡 Click any cell to edit. Win Rate changes auto-update Status. Revenue and Pipeline are computed automatically.</div>
          </div>
        )}

        {tab === "import" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={S.card}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Import Excel</div>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 16 }}>Upload your SALES_TRACKER .xlsx file. Data auto-connects to the dashboard.</div>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) parseAndImport(f); }}
                onClick={() => fileRef.current?.click()}
                style={{ border: `2px dashed ${dragOver ? "#378ADD" : "var(--color-border-secondary)"}`, borderRadius: 10, padding: "40px 24px", textAlign: "center", cursor: "pointer", background: dragOver ? "var(--color-background-info)" : "var(--color-background-secondary)", transition: "all 0.2s" }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>📂</div>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Drag & drop your Excel file</div>
                <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>or click to browse · .xlsx, .xls</div>
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) parseAndImport(e.target.files[0]); }} />
              <div style={{ marginTop: 12, fontSize: 11, color: "var(--color-text-tertiary)" }}>Expected sheet name: "SALES TRACKER". Header row must contain "Status" column.</div>
            </div>

            <div style={S.card}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Export Excel</div>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 20 }}>Download the current tracker as a fully formatted .xlsx file with Sales Tracker and Dashboard sheets.</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "12px 14px" }}>
                  <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Includes</div>
                  {["SALES TRACKER sheet with all proposals","DASHBOARD sheet with summary stats","All computed fields (Revenue, Pipeline, etc.)"].map(i => (
                    <div key={i} style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "flex", gap: 6, marginBottom: 2 }}>
                      <span style={{ color: STATUS_CONFIG.Win.color }}>✓</span> {i}
                    </div>
                  ))}
                </div>
                <button style={{ ...S.btn("primary"), padding: "10px 20px", fontSize: 13 }} onClick={exportXlsx}>↓ Download SALES_TRACKER_EXPORT.xlsx</button>
              </div>
              <div style={{ marginTop: 20, borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Current summary</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {[["Proposals", rows.length], ["Won", winCount], ["Win Rate", fmtPct(winRate)], ["Pipeline", fmt(totalPipeline)]].map(([l, v]) => (
                    <div key={l} style={{ fontSize: 12 }}>
                      <span style={{ color: "var(--color-text-secondary)" }}>{l}: </span>
                      <span style={{ fontWeight: 500 }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
