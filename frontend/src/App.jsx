
import React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { BriefcaseBusiness, Search, Plus, ArrowUpRight, Clock3, CalendarDays, Trash2, Pencil, X, Check, ChevronDown, Sparkles, LayoutDashboard, CircleHelp } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const STATUSES = ['Applied', 'Interview', 'Offer', 'Rejected', 'Hired'];
const FLOW = { Applied: ['Interview', 'Rejected'], Interview: ['Offer', 'Rejected'], Offer: ['Hired', 'Rejected'], Rejected: [], Hired: [] };
const blank = () => ({ companyName: '', jobRole: '', jobType: 'Full-time', appliedDate: new Date().toISOString().slice(0, 10), expectedSalary: '', notes: '' });
const date = value => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const money = value => value ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value) : '—';

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, { headers: { 'Content-Type': 'application/json' }, ...options });
  const result = await response.json();
  if (!result.success) throw new Error(result.message || 'Request failed');
  return result.data;
}

function App() {  
  const [apps, setApps] = useState([]); const [counts, setCounts] = useState({});
  const [search, setSearch] = useState(''); const [filter, setFilter] = useState('All');
  const [modal, setModal] = useState(null); const [form, setForm] = useState(blank());
  const [selected, setSelected] = useState(null); const [toast, setToast] = useState(''); const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const params = new URLSearchParams(); if (filter !== 'All') params.set('status', filter); if (search.trim()) params.set('company', search.trim());
      const [items, totals] = await Promise.all([request(`/applications?${params}`), request('/applications/counts')]);
      setApps(items); setCounts(totals);
    } catch (err) { setToast(err.message); }
  }, [filter, search]);
  useEffect(() => { const timer = setTimeout(refresh, 200); return () => clearTimeout(timer); }, [refresh]);
  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(''), 3500); return () => clearTimeout(timer); } }, [toast]);
  const total = useMemo(() => Object.values(counts).reduce((a, b) => a + b, 0), [counts]);

  const openCreate = () => { setForm(blank()); setModal({ mode: 'create' }); };
  const openEdit = app => { setForm({ companyName: app.companyName, jobRole: app.jobRole, jobType: app.jobType, appliedDate: app.appliedDate.slice(0, 10), expectedSalary: app.expectedSalary ?? '', notes: app.notes || '' }); setModal({ mode: 'edit', app }); };
  const submit = async event => {
    event.preventDefault(); setBusy(true);
    try {
      const body = { ...form, expectedSalary: form.expectedSalary === '' ? null : Number(form.expectedSalary) };
      await request(modal.mode === 'create' ? '/applications' : `/applications/${modal.app._id}`, { method: modal.mode === 'create' ? 'POST' : 'PUT', body: JSON.stringify(body) });
      setModal(null); setToast(modal.mode === 'create' ? 'Application added to your tracker' : 'Application updated'); refresh();
    } catch (err) { setToast(err.message); } finally { setBusy(false); }
  };
  const changeStatus = async (app, status) => {
    try { await request(`/applications/${app._id}/status`, { method: 'PATCH', body: JSON.stringify({ status, note: status === 'Interview' ? 'Interview stage' : '' }) }); setToast(`Moved to ${status}`); refresh(); if (selected?._id === app._id) setSelected(await request(`/applications/${app._id}`)); }
    catch (err) { setToast(err.message); }
  };
  const remove = async app => {
    if (!window.confirm(`Delete ${app.jobRole} at ${app.companyName}?`)) return;
    try { await request(`/applications/${app._id}`, { method: 'DELETE' }); setToast('Application deleted'); setSelected(null); refresh(); }
    catch (err) { setToast(err.message); }
  };

  return <div className="app-shell">
    <aside className="rail"><div className="brand-mark"><BriefcaseBusiness size={21}/></div><div className="rail-active"><LayoutDashboard size={19}/></div><div className="rail-bottom"><CircleHelp size={19}/><div className="avatar">JD</div></div></aside>
    <main className="main">
      <header className="topbar"><div className="crumb">Workspace <span>/</span> <b>Applications</b></div><div className="user"><span>Good morning, Jordan</span><div className="avatar">JD</div></div></header>
      <div className="content">
        <div className="welcome"><div><div className="eyebrow"><Sparkles size={13}/> YOUR CAREER, IN VIEW</div><h1>Keep your next move <em>moving.</em></h1><p>A little clarity goes a long way. Here's where things stand.</p></div><button className="primary" onClick={openCreate}><Plus size={17}/> Add application</button></div>
        <section className="stats">
          <div className="stat-card total"><div className="stat-label">Total applications <span className="mini-icon"><BriefcaseBusiness size={15}/></span></div><div className="stat-number">{total}<small> tracked</small></div><div className="stat-foot">Your search, all in one place</div></div>
          {['Applied', 'Interview', 'Offer'].map((status, i) => <button key={status} className={`stat-card stat-${i}`} onClick={() => setFilter(filter === status ? 'All' : status)}><div className="stat-label">{status === 'Applied' ? 'In progress' : status === 'Interview' ? 'Interviewing' : 'Offers'}<span className="stat-dot"/></div><div className="stat-number">{counts[status] || 0}<small> {status.toLowerCase()}</small></div><div className="stat-foot">{status === 'Applied' ? 'Waiting to hear back' : status === 'Interview' ? 'Conversations underway' : 'Great things ahead'}</div></button>)}
          <div className="stat-card follow-card"><div className="stat-label">Follow-ups due <span className="mini-icon amber"><Clock3 size={15}/></span></div><div className="stat-number">{apps.filter(a => a.isOverdue).length}<small> to nudge</small></div><div className="stat-foot">A thoughtful check-in can help</div></div>
        </section>
        <section className="list-section">
          <div className="section-heading"><div><h2>Your applications</h2><p>Every opportunity, one step at a time.</p></div><span className="count-pill">{apps.length} showing</span></div>
          <div className="toolbar"><div className="searchbox"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search companies" aria-label="Search companies"/>{search && <button onClick={() => setSearch('')}><X size={14}/></button>}</div><div className="filters">{['All', ...STATUSES].map(status => <button key={status} onClick={() => setFilter(status)} className={filter === status ? 'filter active' : 'filter'}>{status}</button>)}</div></div>
          {apps.length ? <div className="application-list">{apps.map(app => <article className="application-card" key={app._id}>
            <div className="company-logo">{app.companyName.slice(0, 1).toUpperCase()}</div>
            <div className="job-main"><div className="job-title-row"><h3>{app.jobRole}</h3><span className={`badge ${app.status.toLowerCase()}`}>{app.status}</span>{app.isOverdue && <span className="badge overdue">Follow-up due</span>}</div><div className="company-line">{app.companyName}<span>·</span>{app.jobType}<span>·</span><span className="job-id">{app.applicationId}</span></div></div>
            <div className="job-meta"><div><CalendarDays size={14}/>{date(app.appliedDate)}</div><small>Applied</small></div>
            <div className="job-meta salary"><div>{money(app.expectedSalary)}</div><small>Expected salary</small></div>
            <div className="card-actions"><button className="icon-btn" title="View details" onClick={() => setSelected(app)}><ArrowUpRight size={17}/></button><button className="icon-btn" title="Edit application" onClick={() => openEdit(app)}><Pencil size={15}/></button><div className="status-select"><select aria-label={`Change status for ${app.jobRole}`} value="" onChange={e => e.target.value && changeStatus(app, e.target.value)} disabled={!FLOW[app.status].length}><option value="">Move to</option>{FLOW[app.status].map(s => <option key={s}>{s}</option>)}</select><ChevronDown size={13}/></div></div>
          </article>)}</div> : <div className="empty"><div className="empty-icon"><BriefcaseBusiness size={23}/></div><h3>{search || filter !== 'All' ? 'No matches just yet' : 'Your next chapter starts here'}</h3><p>{search || filter !== 'All' ? 'Try a different search or status filter.' : 'Add your first application and keep the momentum going.'}</p>{!search && filter === 'All' && <button className="primary" onClick={openCreate}><Plus size={16}/> Add your first application</button>}</div>}
        </section>
        <footer className="footer">Made for the next step <span>✳</span></footer>
      </div>
    </main>

    {modal && <div className="overlay" onMouseDown={e => e.target === e.currentTarget && setModal(null)}><form className="dialog" onSubmit={submit}><div className="dialog-head"><div><div className="eyebrow">{modal.mode === 'create' ? 'NEW OPPORTUNITY' : 'EDIT DETAILS'}</div><h2>{modal.mode === 'create' ? 'Add application' : 'Update application'}</h2></div><button type="button" className="close" onClick={() => setModal(null)}><X size={18}/></button></div><div className="form-grid"><label>Company name<input required maxLength="100" value={form.companyName} onChange={e => setForm({...form, companyName:e.target.value})} placeholder="e.g. Northstar Studio"/></label><label>Job role<input required maxLength="100" value={form.jobRole} onChange={e => setForm({...form, jobRole:e.target.value})} placeholder="e.g. Product Designer"/></label><label>Job type<select value={form.jobType} onChange={e => setForm({...form, jobType:e.target.value})}><option>Full-time</option><option>Internship</option><option>Contract</option></select></label><label>Applied date<input required type="date" max={new Date().toISOString().slice(0,10)} disabled={modal.mode === 'edit'} value={form.appliedDate} onChange={e => setForm({...form, appliedDate:e.target.value})}/></label><label>Expected salary <span className="optional">optional · USD</span><input type="number" min="0" value={form.expectedSalary} onChange={e => setForm({...form, expectedSalary:e.target.value})} placeholder="e.g. 85000"/></label><label className="span2">Notes <span className="optional">optional</span><textarea maxLength="2000" rows="3" value={form.notes} onChange={e => setForm({...form, notes:e.target.value})} placeholder="Add a detail worth remembering…"/></label></div><div className="dialog-foot"><span>Follow-up reminder is set for 7 days after applying.</span><button className="primary" disabled={busy}>{busy ? 'Saving…' : <><Check size={16}/>{modal.mode === 'create' ? 'Save application' : 'Save changes'}</>}</button></div></form></div>}

    {selected && <div className="overlay" onMouseDown={e => e.target === e.currentTarget && setSelected(null)}><section className="dialog detail-dialog"><div className="dialog-head"><div><div className="eyebrow">{selected.applicationId}</div><h2>{selected.jobRole}</h2><p className="detail-company">{selected.companyName} · {selected.jobType}</p></div><button className="close" onClick={() => setSelected(null)}><X size={18}/></button></div><div className="detail-info"><div><span>Status</span><b className={`badge ${selected.status.toLowerCase()}`}>{selected.status}</b></div><div><span>Applied</span><b>{date(selected.appliedDate)}</b></div><div><span>Follow-up date</span><b>{date(selected.followUpDate)} {selected.isOverdue && <i className="due-text">· due</i>}</b></div><div><span>Expected salary</span><b>{money(selected.expectedSalary)}</b></div></div>{selected.notes && <div className="notes-box"><span>NOTES</span><p>{selected.notes}</p></div>}<div className="timeline-title">Status history</div><div className="timeline">{[...(selected.statusHistory || [])].reverse().map((item, i) => <div className="timeline-item" key={`${item.status}-${i}`}><span className="timeline-dot"/><div><b>{item.status}</b><time>{date(item.date)}</time>{item.note && <p>{item.note}</p>}</div></div>)}</div><div className="dialog-foot"><button className="text-danger" onClick={() => remove(selected)}><Trash2 size={15}/> Delete</button><button className="primary" onClick={() => { setSelected(null); openEdit(selected); }}><Pencil size={15}/> Edit details</button></div></section></div>}
    {toast && <div className="toast"><span><Check size={15}/></span>{toast}<button onClick={() => setToast('')}><X size={14}/></button></div>}
  </div>;
}
export default App;
