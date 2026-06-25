import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabaseClient.js";

const COMPANY_NAME = "United Land Equity";

const STAGES = [
  { key: "range_accepted", label: "Range Accepted", staleEligible: true },
  { key: "first_call_missed", label: "First Call Missed", staleEligible: true },
  { key: "call_scheduled", label: "Call Scheduled", staleEligible: true },
  { key: "call_complete", label: "Call Complete", staleEligible: true },
  { key: "docusign_sent", label: "Docusign Sent", staleEligible: true },
  { key: "contract_signed", label: "Contract Signed", staleEligible: false },
  { key: "title_opened", label: "Title Opened", staleEligible: false },
  { key: "buyer_found", label: "Buyer Found", staleEligible: false },
  { key: "closed", label: "Closed", staleEligible: false },
];

const STALE_HOURS = 24;

const TEMP_COLORS = {
  HOT: { bg: "#3a1414", text: "#ff6b6b" },
  WARM: { bg: "#2a1f12", text: "#e8a33d" },
  LUKEWARM: { bg: "#1f2230", text: "#8a93ab" },
};

const NAV_TABS = ["Pipeline", "Calls Due", "Outreach", "Closed Deals", "DoubleFunder", "JV Pipeline", "EMD", "Dead"];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function daysFromNowISO(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function parseLowEnd(label) {
  if (!label || label === "—") return 0;
  const nums = label.match(/[\d,]+/g);
  return nums ? parseInt(nums[0].replace(/,/g, ""), 10) || 0 : 0;
}
function parseHighEnd(label) {
  if (!label || label === "—") return 0;
  const nums = label.match(/[\d,]+/g);
  return nums ? parseInt(nums[nums.length - 1].replace(/,/g, ""), 10) || 0 : 0;
}
function fmtMoney(n) {
  if (n >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `$${n}`;
}
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function daysUntil(iso) {
  const today = new Date(todayISO() + "T00:00:00");
  const target = new Date(iso + "T00:00:00");
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}
function hoursSince(isoTimestamp) {
  if (!isoTimestamp) return 0;
  return (Date.now() - new Date(isoTimestamp).getTime()) / (1000 * 60 * 60);
}
function isStale(lead) {
  const stage = STAGES.find((s) => s.key === lead.stage);
  if (!stage || !stage.staleEligible) return false;
  return hoursSince(lead.stageEnteredAt) >= STALE_HOURS;
}
function fmtTimeInStage(isoTimestamp) {
  const h = hoursSince(isoTimestamp);
  if (h < 1) return "<1h";
  if (h < 24) return `${Math.floor(h)}h`;
  return `${Math.floor(h / 24)}d`;
}

// --- Map between Supabase snake_case rows and the app's camelCase shape ---
function rowToLead(row) {
  return {
    id: row.id,
    name: row.name,
    temp: row.temp,
    location: row.location,
    parcelNumber: row.parcel_number,
    landInsightsUrl: row.land_insights_url,
    priceLabel: row.price_label,
    netLabel: row.net_label,
    stage: row.stage,
    stageEnteredAt: row.stage_entered_at,
    callDue: row.call_due,
    listed: row.listed,
  };
}
function leadToRow(lead) {
  return {
    name: lead.name,
    temp: lead.temp,
    location: lead.location,
    parcel_number: lead.parcelNumber || null,
    land_insights_url: lead.landInsightsUrl || null,
    price_label: lead.priceLabel,
    net_label: lead.netLabel,
    stage: lead.stage,
    stage_entered_at: lead.stageEnteredAt,
    call_due: lead.callDue,
    listed: lead.listed,
  };
}
function rowToEmd(row) {
  return {
    id: row.id,
    leadId: row.lead_id,
    amount: row.amount,
    pullByDate: row.pull_by_date,
    willClose: row.will_close,
    notes: row.notes,
  };
}
function emdToRow(emd) {
  return {
    lead_id: emd.leadId || null,
    amount: emd.amount,
    pull_by_date: emd.pullByDate,
    will_close: emd.willClose,
    notes: emd.notes || null,
  };
}

const inputStyle = {
  width: "100%", background: "#0f1115", border: "1px solid #2a2d35", borderRadius: 6,
  color: "#e8e6e1", padding: "8px 10px", fontSize: 13, boxSizing: "border-box", outline: "none",
};
const btnPrimary = { background: "#3a8a4f", color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const btnGhost = { background: "transparent", color: "#9aa0ab", border: "1px solid #2a2d35", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const btnDanger = { background: "#a3302d", color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" };

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11.5, color: "#8a8e98", marginBottom: 4, fontWeight: 600, letterSpacing: 0.3 }}>{label.toUpperCase()}</div>
      {children}
    </div>
  );
}

function ConfirmDeleteModal({ name, onConfirm, onCancel }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 }} onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#181a20", border: "1px solid #2a2d35", borderRadius: 10, padding: 24, width: 340, color: "#e8e6e1" }}>
        <h3 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 600 }}>Delete this lead?</h3>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "#9aa0ab", lineHeight: 1.5 }}>
          {name ? `"${name}"` : "This lead"} will be permanently removed. This can't be undone.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={btnGhost}>Cancel</button>
          <button onClick={onConfirm} style={btnDanger}>Delete lead</button>
        </div>
      </div>
    </div>
  );
}

function LeadCard({ lead, onDragStart, onClick }) {
  const tc = TEMP_COLORS[lead.temp] || TEMP_COLORS.WARM;
  const stale = isStale(lead);
  const flags = [];
  flags.push({ label: fmtTimeInStage(lead.stageEnteredAt), kind: "neutral" });
  if (stale) flags.push({ label: "stale", kind: "stale" });
  if (lead.callDue) flags.push({ label: "call due", kind: "calldue" });
  if (lead.listed) flags.push({ label: "listed", kind: "listed" });

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead.id)}
      onClick={() => onClick(lead)}
      style={{
        background: "#15171c", border: `1px solid ${stale || lead.callDue ? "#5a2020" : "#2a2d35"}`,
        borderRadius: 6, padding: "10px 12px", marginBottom: 10, cursor: "grab",
        boxShadow: stale ? "inset 2px 0 0 #b03a3a" : "none",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        <span style={{ color: "#e8e6e1", fontWeight: 600, fontSize: 13.5, lineHeight: 1.3, paddingRight: 6 }}>{lead.name}</span>
        <span style={{ background: tc.bg, color: tc.text, fontSize: 9.5, fontWeight: 700, padding: "2px 6px", borderRadius: 4, whiteSpace: "nowrap", letterSpacing: 0.3 }}>{lead.temp}</span>
      </div>
      <div style={{ color: "#6b6f78", fontSize: 11, marginBottom: 6 }}>{lead.location}</div>
      {lead.parcelNumber && <div style={{ color: "#5a5d66", fontSize: 10.5, marginBottom: 6 }}>Parcel {lead.parcelNumber}</div>}
      <div style={{ color: "#e8e6e1", fontSize: 14.5, fontWeight: 600, marginBottom: 2 }}>{lead.priceLabel}</div>
      <div style={{ color: "#5fb87a", fontSize: 11.5, marginBottom: 8 }}>{lead.netLabel}</div>
      {lead.landInsightsUrl && (
        <a href={lead.landInsightsUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ display: "inline-block", color: "#5b9bd5", fontSize: 11, marginBottom: 8, textDecoration: "none" }}>
          Land Insights ↗
        </a>
      )}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {flags.map((f, i) => (
          <span key={i} style={{
            fontSize: 10, padding: "2px 6px", borderRadius: 4, fontWeight: 600,
            background: f.kind === "stale" || f.kind === "calldue" ? "#5a1f1f" : f.kind === "listed" ? "#1f3a2a" : "#262a32",
            color: f.kind === "stale" || f.kind === "calldue" ? "#ff8a8a" : f.kind === "listed" ? "#7fd99a" : "#9aa0ab",
          }}>{f.label}</span>
        ))}
      </div>
    </div>
  );
}

function LeadFormModal({ initial, onClose, onSave, title, saveLabel, onRequestDelete }) {
  const [form, setForm] = useState(initial || { name: "", location: "", temp: "WARM", parcelNumber: "", landInsightsUrl: "", priceLabel: "", netLabel: "", stage: "range_accepted", callDue: false, listed: false });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#181a20", border: "1px solid #2a2d35", borderRadius: 10, padding: 24, width: 400, color: "#e8e6e1", maxHeight: "85vh", overflowY: "auto" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600 }}>{title}</h3>
        <Field label="Name"><input style={inputStyle} value={form.name} onChange={set("name")} placeholder="Owner name" /></Field>
        <Field label="Location"><input style={inputStyle} value={form.location} onChange={set("location")} placeholder="County, State" /></Field>
        <Field label="Parcel number"><input style={inputStyle} value={form.parcelNumber} onChange={set("parcelNumber")} placeholder="e.g. 0123-45-678" /></Field>
        <Field label="Land Insights link"><input style={inputStyle} value={form.landInsightsUrl} onChange={set("landInsightsUrl")} placeholder="https://landinsights.com/..." /></Field>
        <Field label="Temperature">
          <select style={inputStyle} value={form.temp} onChange={set("temp")}>
            <option value="HOT">HOT</option><option value="WARM">WARM</option><option value="LUKEWARM">LUKEWARM</option>
          </select>
        </Field>
        <Field label="Price / offer range"><input style={inputStyle} value={form.priceLabel} onChange={set("priceLabel")} placeholder="$20,000–$30,000" /></Field>
        <Field label="Est. net profit"><input style={inputStyle} value={form.netLabel} onChange={set("netLabel")} placeholder="$8k–$15k est." /></Field>
        <Field label="Stage">
          <select style={inputStyle} value={form.stage} onChange={set("stage")}>
            {STAGES.map((s) => (<option key={s.key} value={s.key}>{s.label}</option>))}
          </select>
        </Field>
        {initial && (
          <div style={{ display: "flex", gap: 16, margin: "14px 0 4px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#9aa0ab" }}>
              <input type="checkbox" checked={form.callDue} onChange={(e) => setForm({ ...form, callDue: e.target.checked })} /> Call due
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#9aa0ab" }}>
              <input type="checkbox" checked={form.listed} onChange={(e) => setForm({ ...form, listed: e.target.checked })} /> Listed
            </label>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
          {onRequestDelete && <button onClick={() => onRequestDelete(form)} style={{ ...btnGhost, color: "#e0746f", borderColor: "#5a2020", marginRight: "auto" }}>Delete</button>}
          <button onClick={onClose} style={btnGhost}>Cancel</button>
          <button
            onClick={() => {
              if (!form.name.trim()) return;
              const stageChanged = initial && initial.stage !== form.stage;
              onSave({ ...form, id: form.id, priceLabel: form.priceLabel || "—", netLabel: form.netLabel || "—", stageEnteredAt: stageChanged || !initial ? new Date().toISOString() : form.stageEnteredAt });
            }}
            style={btnPrimary}
          >
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, color, borderRight }) {
  return (
    <div style={{ padding: "14px 20px", borderRight: borderRight ? "1px solid #1e2027" : "none" }}>
      <div style={{ fontSize: 10.5, color: "#6b6f78", fontWeight: 600, letterSpacing: 0.5, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || "#e8e6e1", marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 10.5, color: "#5a5d66" }}>{sub}</div>
    </div>
  );
}

function PipelineView({ leads, onDragStart, onDrop, dragOverStage, setDragOverStage, onCardClick }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "16px 20px", overflowX: "auto", minHeight: 500 }}>
      {STAGES.map((stage) => {
        const stageLeads = leads.filter((l) => l.stage === stage.key);
        return (
          <div key={stage.key} onDragOver={(e) => { e.preventDefault(); setDragOverStage(stage.key); }} onDragLeave={() => setDragOverStage(null)} onDrop={(e) => onDrop(e, stage.key)}
            style={{ minWidth: 230, width: 230, flexShrink: 0, background: dragOverStage === stage.key ? "#13151a" : "transparent", borderRadius: 8, transition: "background 0.15s" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 4px", marginBottom: 8, borderBottom: "1px solid #1e2027", paddingBottom: 10 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: stageLeads.length ? "#5a5d66" : "#2a2d35" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#9aa0ab", letterSpacing: 0.4, flex: 1 }}>{stage.label.toUpperCase()}</span>
              <span style={{ fontSize: 11, color: "#5a5d66", fontWeight: 600 }}>{stageLeads.length}</span>
            </div>
            <div style={{ minHeight: 60 }}>
              {stageLeads.length === 0 && <div style={{ color: "#3a3d45", fontSize: 18, textAlign: "center", padding: "8px 0" }}>—</div>}
              {stageLeads.map((lead) => (<LeadCard key={lead.id} lead={lead} onDragStart={onDragStart} onClick={onCardClick} />))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CallsDueView({ leads, onCardClick }) {
  const due = leads.filter((l) => l.callDue && l.stage !== "closed");
  return (
    <div style={{ padding: "20px" }}>
      <div style={{ fontSize: 13, color: "#9aa0ab", marginBottom: 16 }}>{due.length} lead{due.length === 1 ? "" : "s"} need a call</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 12 }}>
        {due.map((lead) => {
          const stage = STAGES.find((s) => s.key === lead.stage);
          return (
            <div key={lead.id}>
              <div style={{ fontSize: 10, color: "#5a5d66", fontWeight: 600, marginBottom: 4, letterSpacing: 0.4 }}>{stage?.label.toUpperCase()}</div>
              <LeadCard lead={lead} onDragStart={() => {}} onClick={onCardClick} />
            </div>
          );
        })}
        {due.length === 0 && <div style={{ color: "#5a5d66", fontSize: 13 }}>No calls due right now.</div>}
      </div>
    </div>
  );
}

function ClosedDealsView({ leads }) {
  const closed = leads.filter((l) => l.stage === "closed");
  const totalNet = closed.reduce((s, l) => s + parseHighEnd(l.netLabel), 0);
  return (
    <div style={{ padding: "20px" }}>
      <div style={{ display: "flex", gap: 24, marginBottom: 20 }}>
        <div><div style={{ fontSize: 10.5, color: "#6b6f78", fontWeight: 600, letterSpacing: 0.5, marginBottom: 4 }}>TOTAL DEALS CLOSED</div><div style={{ fontSize: 22, fontWeight: 700 }}>{closed.length}</div></div>
        <div><div style={{ fontSize: 10.5, color: "#6b6f78", fontWeight: 600, letterSpacing: 0.5, marginBottom: 4 }}>TOTAL NET PROFIT</div><div style={{ fontSize: 22, fontWeight: 700, color: "#5fb87a" }}>{fmtMoney(totalNet)}</div></div>
      </div>
      <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
        <thead><tr style={{ borderBottom: "1px solid #1e2027" }}>{["Name", "Location", "Sale price", "Net profit"].map((h) => (<th key={h} style={{ textAlign: "left", padding: "8px 6px", color: "#6b6f78", fontWeight: 600, fontSize: 11, letterSpacing: 0.3 }}>{h.toUpperCase()}</th>))}</tr></thead>
        <tbody>{closed.map((l) => (<tr key={l.id} style={{ borderBottom: "1px solid #1a1c22" }}><td style={{ padding: "10px 6px", fontWeight: 600 }}>{l.name}</td><td style={{ padding: "10px 6px", color: "#9aa0ab" }}>{l.location}</td><td style={{ padding: "10px 6px" }}>{l.priceLabel}</td><td style={{ padding: "10px 6px", color: "#5fb87a" }}>{l.netLabel}</td></tr>))}</tbody>
      </table>
    </div>
  );
}

function PlaceholderView({ label }) {
  return <div style={{ padding: "60px 20px", textAlign: "center", color: "#5a5d66" }}><div style={{ fontSize: 14 }}>{label} isn't built out yet.</div></div>;
}

function OutreachView({ outreach, onLogToday }) {
  const [quickAdd, setQuickAdd] = useState("");
  const sorted = useMemo(() => [...outreach].sort((a, b) => (a.date < b.date ? 1 : -1)), [outreach]);
  const todayCount = useMemo(() => sorted.find((o) => o.date === todayISO())?.sent || 0, [sorted]);
  const weekTotal = useMemo(() => { const cutoff = daysAgoISO(6); return outreach.filter((o) => o.date >= cutoff).reduce((s, o) => s + o.sent, 0); }, [outreach]);
  const monthTotal = useMemo(() => { const cutoff = daysAgoISO(29); return outreach.filter((o) => o.date >= cutoff).reduce((s, o) => s + o.sent, 0); }, [outreach]);
  const last14 = useMemo(() => { const days = Array.from({ length: 14 }, (_, i) => daysAgoISO(13 - i)); return days.map((d) => ({ date: d, sent: outreach.find((o) => o.date === d)?.sent || 0 })); }, [outreach]);
  const maxSent = Math.max(1, ...last14.map((d) => d.sent));

  return (
    <div style={{ padding: "20px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        <div style={{ background: "#15171c", border: "1px solid #1e2027", borderRadius: 8, padding: "14px 16px" }}><div style={{ fontSize: 10.5, color: "#6b6f78", fontWeight: 600, letterSpacing: 0.5, marginBottom: 6 }}>OFFERS SENT TODAY</div><div style={{ fontSize: 24, fontWeight: 700 }}>{todayCount}</div></div>
        <div style={{ background: "#15171c", border: "1px solid #1e2027", borderRadius: 8, padding: "14px 16px" }}><div style={{ fontSize: 10.5, color: "#6b6f78", fontWeight: 600, letterSpacing: 0.5, marginBottom: 6 }}>LAST 7 DAYS</div><div style={{ fontSize: 24, fontWeight: 700 }}>{weekTotal}</div></div>
        <div style={{ background: "#15171c", border: "1px solid #1e2027", borderRadius: 8, padding: "14px 16px" }}><div style={{ fontSize: 10.5, color: "#6b6f78", fontWeight: 600, letterSpacing: 0.5, marginBottom: 6 }}>LAST 30 DAYS</div><div style={{ fontSize: 24, fontWeight: 700 }}>{monthTotal}</div></div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <input type="number" placeholder="Offers sent today" style={{ ...inputStyle, width: 180 }} value={quickAdd} onChange={(e) => setQuickAdd(e.target.value)} />
        <button style={btnPrimary} onClick={() => { const n = parseInt(quickAdd, 10); if (!n) return; onLogToday(n); setQuickAdd(""); }}>Log offers</button>
        <span style={{ fontSize: 12, color: "#5a5d66" }}>Adds to today's total</span>
      </div>
      <div style={{ fontSize: 11, color: "#6b6f78", fontWeight: 600, letterSpacing: 0.4, marginBottom: 10 }}>LAST 14 DAYS</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 140, marginBottom: 8 }}>
        {last14.map((d) => (<div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}><div style={{ fontSize: 10, color: "#9aa0ab" }}>{d.sent || ""}</div><div style={{ width: "100%", background: d.date === todayISO() ? "#3a8a4f" : "#2a2d35", borderRadius: 3, height: `${Math.max(4, (d.sent / maxSent) * 100)}px` }} /></div>))}
      </div>
      <div style={{ display: "flex", gap: 6 }}>{last14.map((d) => (<div key={d.date} style={{ flex: 1, textAlign: "center", fontSize: 9, color: "#5a5d66" }}>{fmtDate(d.date).split(" ")[1]}</div>))}</div>
    </div>
  );
}

function EMDFormModal({ initial, eligibleLeads, onClose, onSave, onRequestDelete }) {
  const [form, setForm] = useState(initial || { leadId: eligibleLeads[0]?.id || "", amount: "", pullByDate: daysFromNowISO(7), willClose: true, notes: "" });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#181a20", border: "1px solid #2a2d35", borderRadius: 10, padding: 24, width: 380, color: "#e8e6e1" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600 }}>{initial ? "Edit EMD" : "New EMD"}</h3>
        <Field label="Linked lead">
          <select style={inputStyle} value={form.leadId} onChange={(e) => setForm({ ...form, leadId: parseInt(e.target.value, 10) })}>
            <option value="">— none —</option>
            {eligibleLeads.map((l) => (<option key={l.id} value={l.id}>{l.name} ({l.location})</option>))}
          </select>
        </Field>
        <Field label="EMD amount ($)"><input type="number" style={inputStyle} value={form.amount} onChange={set("amount")} placeholder="1000" /></Field>
        <Field label="Pull-by deadline"><input type="date" style={inputStyle} value={form.pullByDate} onChange={set("pullByDate")} /></Field>
        <Field label="Is this deal on track to close?">
          <select style={inputStyle} value={form.willClose ? "yes" : "no"} onChange={(e) => setForm({ ...form, willClose: e.target.value === "yes" })}>
            <option value="yes">Yes, on track to close</option><option value="no">No, may not close</option>
          </select>
        </Field>
        <Field label="Notes"><input style={inputStyle} value={form.notes} onChange={set("notes")} placeholder="Why it might fall through, etc." /></Field>
        <div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
          {onRequestDelete && <button onClick={() => onRequestDelete(form)} style={{ ...btnGhost, color: "#e0746f", borderColor: "#5a2020", marginRight: "auto" }}>Delete</button>}
          <button onClick={onClose} style={btnGhost}>Cancel</button>
          <button onClick={() => { if (!form.amount || !form.pullByDate) return; onSave({ ...form, id: form.id, amount: parseFloat(form.amount) || 0, leadId: form.leadId ? parseInt(form.leadId, 10) : null }); }} style={btnPrimary}>
            {initial ? "Save changes" : "Add EMD"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EMDView({ emds, leads, onAdd, onUpdate, onDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const eligibleLeads = leads.filter((l) => ["title_opened", "buyer_found", "contract_signed", "closed"].includes(l.stage));

  const enriched = emds.map((e) => {
    const lead = leads.find((l) => l.id === e.leadId);
    const dUntil = daysUntil(e.pullByDate);
    let risk = "ok";
    if (!e.willClose) { if (dUntil < 0) risk = "overdue"; else if (dUntil <= 3) risk = "urgent"; else risk = "watch"; }
    return { ...e, lead, daysUntil: dUntil, risk };
  });
  const totalAtRisk = enriched.filter((e) => !e.willClose).reduce((s, e) => s + (e.amount || 0), 0);
  const totalHeld = enriched.reduce((s, e) => s + (e.amount || 0), 0);
  const riskStyle = {
    overdue: { bg: "#3a1414", text: "#ff6b6b", label: "Overdue — pull now" },
    urgent: { bg: "#3a2a14", text: "#e8a33d", label: "Pull soon" },
    watch: { bg: "#1f2230", text: "#8a93ab", label: "Watching" },
    ok: { bg: "#1f3a2a", text: "#7fd99a", label: "On track to close" },
  };

  return (
    <div style={{ padding: "20px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        <div style={{ background: "#15171c", border: "1px solid #1e2027", borderRadius: 8, padding: "14px 16px" }}><div style={{ fontSize: 10.5, color: "#6b6f78", fontWeight: 600, letterSpacing: 0.5, marginBottom: 6 }}>TOTAL EMD HELD</div><div style={{ fontSize: 24, fontWeight: 700 }}>${totalHeld.toLocaleString()}</div></div>
        <div style={{ background: "#15171c", border: "1px solid #1e2027", borderRadius: 8, padding: "14px 16px" }}><div style={{ fontSize: 10.5, color: "#6b6f78", fontWeight: 600, letterSpacing: 0.5, marginBottom: 6 }}>AT RISK (NOT CLOSING)</div><div style={{ fontSize: 24, fontWeight: 700, color: totalAtRisk ? "#ff6b6b" : "#e8e6e1" }}>${totalAtRisk.toLocaleString()}</div></div>
        <div style={{ background: "#15171c", border: "1px solid #1e2027", borderRadius: 8, padding: "14px 16px" }}><div style={{ fontSize: 10.5, color: "#6b6f78", fontWeight: 600, letterSpacing: 0.5, marginBottom: 6 }}>OVERDUE PULLS</div><div style={{ fontSize: 24, fontWeight: 700, color: enriched.some((e) => e.risk === "overdue") ? "#ff6b6b" : "#e8e6e1" }}>{enriched.filter((e) => e.risk === "overdue").length}</div></div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}><button style={btnPrimary} onClick={() => setShowForm(true)}>+ New EMD</button></div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {enriched.length === 0 && <div style={{ color: "#5a5d66", fontSize: 13 }}>No EMDs tracked yet.</div>}
        {enriched.sort((a, b) => a.daysUntil - b.daysUntil).map((e) => {
          const rs = riskStyle[e.risk];
          return (
            <div key={e.id} onClick={() => setEditing(e)} style={{ background: "#15171c", border: "1px solid #2a2d35", borderRadius: 8, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{e.lead ? e.lead.name : "Unlinked lead"}</div>
                <div style={{ fontSize: 11.5, color: "#6b6f78" }}>{e.lead?.location || "—"} · ${Number(e.amount || 0).toLocaleString()} EMD</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, color: "#9aa0ab", marginBottom: 4 }}>Pull-by {fmtDate(e.pullByDate)} ({e.daysUntil >= 0 ? `${e.daysUntil}d left` : `${Math.abs(e.daysUntil)}d overdue`})</div>
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 4, background: rs.bg, color: rs.text }}>{rs.label}</span>
              </div>
            </div>
          );
        })}
      </div>
      {showForm && <EMDFormModal eligibleLeads={eligibleLeads} onClose={() => setShowForm(false)} onSave={(emd) => { onAdd(emd); setShowForm(false); }} />}
      {editing && <EMDFormModal initial={editing} eligibleLeads={eligibleLeads} onClose={() => setEditing(null)} onSave={(emd) => { onUpdate(emd); setEditing(null); }} onRequestDelete={(emd) => setConfirmDeleteId(emd.id)} />}
      {confirmDeleteId && <ConfirmDeleteModal name={enriched.find((e) => e.id === confirmDeleteId)?.lead?.name || "this EMD"} onConfirm={() => { onDelete(confirmDeleteId); setConfirmDeleteId(null); setEditing(null); }} onCancel={() => setConfirmDeleteId(null)} />}
    </div>
  );
}

export default function App() {
  const [leads, setLeads] = useState([]);
  const [outreach, setOutreach] = useState([]);
  const [emds, setEmds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const [activeTab, setActiveTab] = useState("Pipeline");
  const [showNewLead, setShowNewLead] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  const [confirmDeleteLead, setConfirmDeleteLead] = useState(null);
  const [, forceTick] = useState(0);

  // Initial load
  useEffect(() => {
    (async () => {
      try {
        const [leadsRes, emdsRes, outreachRes] = await Promise.all([
          supabase.from("leads").select("*").order("id"),
          supabase.from("emds").select("*").order("id"),
          supabase.from("outreach_log").select("*").order("log_date"),
        ]);
        if (leadsRes.error) throw leadsRes.error;
        if (emdsRes.error) throw emdsRes.error;
        if (outreachRes.error) throw outreachRes.error;

        setLeads(leadsRes.data.map(rowToLead));
        setEmds(emdsRes.data.map(rowToEmd));
        setOutreach(outreachRes.data.map((r) => ({ id: r.id, date: r.log_date, sent: r.sent })));
      } catch (err) {
        console.error(err);
        setErrorMsg("Couldn't load data from Supabase. Check your .env file and that the schema has been run — see README.md.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => forceTick((n) => n + 1), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const metrics = useMemo(() => {
    const active = leads.filter((l) => l.stage !== "closed");
    const preStages = ["range_accepted", "first_call_missed", "call_scheduled", "call_complete"];
    const preLeads = leads.filter((l) => preStages.includes(l.stage));
    const preLow = preLeads.reduce((s, l) => s + parseLowEnd(l.priceLabel), 0);
    const preHigh = preLeads.reduce((s, l) => s + parseHighEnd(l.priceLabel), 0);
    const pendingSig = leads.filter((l) => l.stage === "docusign_sent");
    const pendingSigNet = pendingSig.reduce((s, l) => s + parseHighEnd(l.netLabel), 0);
    const postStages = ["contract_signed", "title_opened", "buyer_found"];
    const postLeads = leads.filter((l) => postStages.includes(l.stage));
    const postNet = postLeads.reduce((s, l) => s + parseHighEnd(l.netLabel), 0);
    return { activeCount: active.length, preLow, preHigh, preCount: preLeads.length, pendingSigNet, postNet, postCount: postLeads.length, closedThisMonth: 0, avgDays: 43 };
  }, [leads]);

  const callsDueCount = leads.filter((l) => l.callDue && l.stage !== "closed").length;
  const emdAtRiskCount = emds.filter((e) => !e.willClose).length;

  const onDragStart = (e, id) => e.dataTransfer.setData("text/plain", String(id));
  const onDrop = async (e, stageKey) => {
    e.preventDefault();
    setDragOverStage(null);
    const id = parseInt(e.dataTransfer.getData("text/plain"), 10);
    const lead = leads.find((l) => l.id === id);
    if (!lead || lead.stage === stageKey) return;
    const stageEnteredAt = new Date().toISOString();
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, stage: stageKey, stageEnteredAt } : l)));
    const { error } = await supabase.from("leads").update({ stage: stageKey, stage_entered_at: stageEnteredAt }).eq("id", id);
    if (error) { console.error(error); setErrorMsg("Failed to save the stage change — check your connection."); }
  };

  const updateLead = async (updated) => {
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    const { error } = await supabase.from("leads").update(leadToRow(updated)).eq("id", updated.id);
    if (error) { console.error(error); setErrorMsg("Failed to save lead changes."); }
  };

  const deleteLead = async (id) => {
    setLeads((prev) => prev.filter((l) => l.id !== id));
    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (error) { console.error(error); setErrorMsg("Failed to delete the lead."); }
  };

  const addLead = async (lead) => {
    const row = leadToRow({ ...lead, stageEnteredAt: new Date().toISOString() });
    const { data, error } = await supabase.from("leads").insert(row).select().single();
    if (error) { console.error(error); setErrorMsg("Failed to add the new lead."); return; }
    setLeads((prev) => [...prev, rowToLead(data)]);
    setShowNewLead(false);
  };

  const logOutreachToday = async (n) => {
    const today = todayISO();
    const existing = outreach.find((o) => o.date === today);
    if (existing) {
      const newSent = existing.sent + n;
      setOutreach((prev) => prev.map((o) => (o.date === today ? { ...o, sent: newSent } : o)));
      const { error } = await supabase.from("outreach_log").update({ sent: newSent }).eq("log_date", today);
      if (error) console.error(error);
    } else {
      const { data, error } = await supabase.from("outreach_log").insert({ log_date: today, sent: n }).select().single();
      if (error) { console.error(error); return; }
      setOutreach((prev) => [...prev, { id: data.id, date: data.log_date, sent: data.sent }]);
    }
  };

  const addEmd = async (emd) => {
    const { data, error } = await supabase.from("emds").insert(emdToRow(emd)).select().single();
    if (error) { console.error(error); setErrorMsg("Failed to add the EMD."); return; }
    setEmds((prev) => [...prev, rowToEmd(data)]);
  };
  const updateEmd = async (emd) => {
    setEmds((prev) => prev.map((e) => (e.id === emd.id ? emd : e)));
    const { error } = await supabase.from("emds").update(emdToRow(emd)).eq("id", emd.id);
    if (error) { console.error(error); setErrorMsg("Failed to save EMD changes."); }
  };
  const deleteEmd = async (id) => {
    setEmds((prev) => prev.filter((e) => e.id !== id));
    const { error } = await supabase.from("emds").delete().eq("id", id);
    if (error) { console.error(error); setErrorMsg("Failed to delete the EMD."); }
  };

  if (loading) {
    return <div style={{ background: "#0b0c0f", color: "#9aa0ab", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif" }}>Loading…</div>;
  }

  return (
    <div style={{ fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif", background: "#0b0c0f", minHeight: "100vh", color: "#e8e6e1", position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid #1e2027", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 22, height: 22, background: "#e8e6e1", clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)" }} />
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: 0.5 }}>{COMPANY_NAME.toUpperCase()}</span>
          <span style={{ color: "#4a4d56", fontSize: 14 }}>/</span>
          <span style={{ color: "#9aa0ab", fontSize: 14 }}>CRM</span>
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {NAV_TABS.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ background: activeTab === tab ? "#1e2027" : "transparent", border: "none", color: activeTab === tab ? "#e8e6e1" : "#8a8e98", fontSize: 13, fontWeight: 500, padding: "7px 12px", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              {tab}
              {tab === "Calls Due" && callsDueCount > 0 && <span style={{ background: "#c0392b", color: "#fff", fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 9 }}>{callsDueCount}</span>}
              {tab === "EMD" && emdAtRiskCount > 0 && <span style={{ background: "#c0392b", color: "#fff", fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 9 }}>{emdAtRiskCount}</span>}
            </button>
          ))}
        </div>
        <button onClick={() => setShowNewLead(true)} style={{ background: "#e8e6e1", color: "#0b0c0f", border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ New Lead</button>
      </div>

      {activeTab === "Pipeline" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", borderBottom: "1px solid #1e2027", overflowX: "auto" }}>
            <MetricCard label="ACTIVE LEADS" value={metrics.activeCount} sub="in pipeline" borderRight />
            <MetricCard label="PRE-CONTRACT" value={`${fmtMoney(metrics.preLow)} – ${fmtMoney(metrics.preHigh)}`} sub={`${metrics.preCount} leads (est. profit range)`} borderRight />
            <MetricCard label="PENDING SIGNATURE" value={fmtMoney(metrics.pendingSigNet)} sub="est. profit in DocuSign" color="#e8a33d" borderRight />
            <MetricCard label="POST-CONTRACT" value={fmtMoney(metrics.postNet)} sub={`${metrics.postCount} leads (est. spread)`} color="#5fb87a" borderRight />
            <MetricCard label="CLOSED THIS MONTH" value={metrics.closedThisMonth} sub="deals" borderRight />
            <MetricCard label="AVG DAYS TO CLOSE" value={`${metrics.avgDays}d`} sub="range accepted → closed" />
          </div>
          <PipelineView leads={leads} onDragStart={onDragStart} onDrop={onDrop} dragOverStage={dragOverStage} setDragOverStage={setDragOverStage} onCardClick={setSelectedLead} />
        </>
      )}
      {activeTab === "Calls Due" && <CallsDueView leads={leads} onCardClick={setSelectedLead} />}
      {activeTab === "Outreach" && <OutreachView outreach={outreach} onLogToday={logOutreachToday} />}
      {activeTab === "Closed Deals" && <ClosedDealsView leads={leads} />}
      {activeTab === "EMD" && <EMDView emds={emds} leads={leads} onAdd={addEmd} onUpdate={updateEmd} onDelete={deleteEmd} />}
      {["DoubleFunder", "JV Pipeline", "Dead"].includes(activeTab) && <PlaceholderView label={activeTab} />}

      {showNewLead && <LeadFormModal title="New lead" saveLabel="Add lead" onClose={() => setShowNewLead(false)} onSave={addLead} />}
      {selectedLead && !confirmDeleteLead && (
        <LeadFormModal title="Edit lead" saveLabel="Save changes" initial={selectedLead} onClose={() => setSelectedLead(null)} onSave={(l) => { updateLead(l); setSelectedLead(null); }} onRequestDelete={(l) => setConfirmDeleteLead(l)} />
      )}
      {confirmDeleteLead && (
        <ConfirmDeleteModal name={confirmDeleteLead.name} onConfirm={() => { deleteLead(confirmDeleteLead.id); setConfirmDeleteLead(null); setSelectedLead(null); }} onCancel={() => setConfirmDeleteLead(null)} />
      )}
      {errorMsg && (
        <div onClick={() => setErrorMsg(null)} style={{ position: "fixed", bottom: 16, right: 20, background: "#3a1414", color: "#ff8a8a", fontSize: 12, padding: "8px 14px", borderRadius: 6, border: "1px solid #5a2020", cursor: "pointer", maxWidth: 320 }}>
          {errorMsg} (click to dismiss)
        </div>
      )}
    </div>
  );
}
