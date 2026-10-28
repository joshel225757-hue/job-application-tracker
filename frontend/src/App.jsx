
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  BriefcaseBusiness,
  Search,
  Plus,
  ArrowUpRight,
  Clock3,
  CalendarDays,
  Trash2,
  Pencil,
  X,
  Check,
  ChevronDown,
  Sparkles,
  LayoutDashboard,
  CircleHelp,
  Sun,
  Moon
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const STATUSES = [
  'Applied',
  'Interview',
  'Offer',
  'Accepted',
  'Declined',
  'Rejected'
];

const FLOW = {
  Applied: ['Interview', 'Rejected'],
  Interview: ['Offer', 'Rejected'],
  Offer: ['Accepted', 'Declined'],
  Accepted: [],
  Declined: [],
  Rejected: []
};

const DELETABLE_STATUSES = [
  'Applied',
  'Rejected',
  'Accepted',
  'Declined'
];

const blank = () => ({
  companyName: '',
  jobRole: '',
  jobType: 'Full-time',
  appliedDate: new Date().toISOString().slice(0, 10),
  expectedSalary: '',
  notes: ''
});

const date = value => {
  if (!value) return '—';

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return '—';

  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const money = value =>
  value !== null && value !== undefined && value !== ''
    ? new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
      }).format(value)
    : '—';

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error('The server returned an invalid response.');
  }

  if (!response.ok || !result.success) {
    throw new Error(result.message || 'Request failed. Please try again.');
  }

  return result.data;
}

function App() {
  const [theme, setTheme] = useState(
    () => localStorage.getItem('job-tracker-theme') || 'dark'
  );

  const [apps, setApps] = useState([]);
  const [counts, setCounts] = useState({});
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(blank());
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('job-tracker-theme', theme);
  }, [theme]);

  const refresh = useCallback(async () => {
    try {
      const params = new URLSearchParams();

      if (filter !== 'All') {
        params.set('status', filter);
      }

      if (search.trim()) {
        params.set('company', search.trim());
      }

      const [items, totals] = await Promise.all([
        request(`/applications?${params.toString()}`),
        request('/applications/counts')
      ]);

      setApps(Array.isArray(items) ? items : []);
      setCounts(totals || {});
    } catch (err) {
      setToast(err.message || 'Could not load applications.');
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    const timer = setTimeout(refresh, 250);
    return () => clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    if (!toast) return undefined;

    const timer = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const total = useMemo(
    () =>
      Object.values(counts).reduce(
        (sum, count) => sum + Number(count || 0),
        0
      ),
    [counts]
  );

  const openCreate = () => {
    setForm(blank());
    setModal({ mode: 'create' });
  };

  const openEdit = app => {
    setForm({
      companyName: app.companyName || '',
      jobRole: app.jobRole || '',
      jobType: app.jobType || 'Full-time',
      appliedDate: app.appliedDate
        ? String(app.appliedDate).slice(0, 10)
        : blank().appliedDate,
      expectedSalary: app.expectedSalary ?? '',
      notes: app.notes || ''
    });

    setModal({ mode: 'edit', app });
  };

  const submit = async event => {
    event.preventDefault();

    if (!modal || busy) return;

    if (!form.companyName.trim() || !form.jobRole.trim()) {
      setToast('Company name and job role are required.');
      return;
    }

    if (form.appliedDate > new Date().toISOString().slice(0, 10)) {
      setToast('Applied date cannot be in the future.');
      return;
    }

    if (
      form.expectedSalary !== '' &&
      (!Number.isFinite(Number(form.expectedSalary)) ||
        Number(form.expectedSalary) < 0)
    ) {
      setToast('Expected salary must be a non-negative number.');
      return;
    }

    setBusy(true);

    try {
      const body = {
        companyName: form.companyName.trim(),
        jobRole: form.jobRole.trim(),
        jobType: form.jobType,
        expectedSalary:
          form.expectedSalary === '' ? null : Number(form.expectedSalary),
        notes: form.notes.trim()
      };

      const isCreate = modal.mode === 'create';

      if (isCreate) {
        body.appliedDate = form.appliedDate;
      }

      await request(
        isCreate ? '/applications' : `/applications/${modal.app._id}`,
        {
          method: isCreate ? 'POST' : 'PUT',
          body: JSON.stringify(body)
        }
      );

      setModal(null);
      setToast(
        isCreate
          ? 'Application added successfully.'
          : 'Application updated successfully.'
      );

      await refresh();
    } catch (err) {
      setToast(err.message);
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (app, status) => {
    if (!FLOW[app.status]?.includes(status)) {
      setToast('That status change is not allowed.');
      return;
    }

    try {
      await request(`/applications/${app._id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          note: status === 'Interview' ? 'Interview stage' : ''
        })
      });

      setToast(`Application moved to ${status}.`);

      await refresh();

      if (selected?._id === app._id) {
        const updated = await request(`/applications/${app._id}`);
        setSelected(updated);
      }
    } catch (err) {
      setToast(err.message);
    }
  };

  const canDelete = app =>
    DELETABLE_STATUSES.includes(app.status);

  const remove = async app => {
    if (!canDelete(app)) {
      setToast(
        'Only Applied, Accepted, Declined, and Rejected applications can be deleted.'
      );
      return;
    }

    const confirmed = window.confirm(
      `Delete ${app.jobRole} at ${app.companyName}? This cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await request(`/applications/${app._id}`, {
        method: 'DELETE'
      });

      setToast('Application deleted.');

      if (selected?._id === app._id) {
        setSelected(null);
      }

      await refresh();
    } catch (err) {
      setToast(err.message);
    }
  };

  const openDetails = async app => {
    setSelected(app);

    try {
      const details = await request(`/applications/${app._id}`);
      setSelected(details);
    } catch {
      // Keep the list item visible if the details request fails.
    }
  };

  return (
    <div className="app-shell">
      <aside className="rail">
        <div className="brand-mark" title="Job Tracker">
          <BriefcaseBusiness size={21} />
        </div>

        <div className="rail-active" title="Dashboard">
          <LayoutDashboard size={19} />
        </div>

        <button
          type="button"
          className="theme-toggle"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
        </button>

        <div className="rail-bottom">
          <CircleHelp size={19} />
          <div className="avatar">JT</div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="crumb">
            Workspace <span>/</span> <b>Applications</b>
          </div>

          <div className="user">
            <span>Keep moving forward</span>
            <div className="avatar">JT</div>
          </div>
        </header>

        <div className="content">
          <section className="welcome">
            <div>
              <div className="eyebrow">
                <Sparkles size={13} />
                YOUR CAREER, IN VIEW
              </div>

              <h1>
                Keep your next move <em>moving.</em>
              </h1>

              <p>
                A little clarity goes a long way. Here's where things stand.
              </p>
            </div>

            <button className="primary" onClick={openCreate}>
              <Plus size={17} />
              Add application
            </button>
          </section>

          <section className="stats">
            <div className="stat-card total">
              <div className="stat-label">
                Total applications
                <span className="mini-icon">
                  <BriefcaseBusiness size={15} />
                </span>
              </div>

              <div className="stat-number">
                {total}
                <small> tracked</small>
              </div>

              <div className="stat-foot">
                Your search, all in one place
              </div>
            </div>

            {['Applied', 'Interview', 'Offer'].map((status, index) => (
              <button
                key={status}
                className={`stat-card stat-${index}`}
                onClick={() =>
                  setFilter(filter === status ? 'All' : status)
                }
              >
                <div className="stat-label">
                  {status === 'Applied'
                    ? 'In progress'
                    : status === 'Interview'
                      ? 'Interviewing'
                      : 'Offers'}

                  <span className="stat-dot" />
                </div>

                <div className="stat-number">
                  {counts[status] || 0}
                  <small> {status.toLowerCase()}</small>
                </div>

                <div className="stat-foot">
                  {status === 'Applied'
                    ? 'Waiting to hear back'
                    : status === 'Interview'
                      ? 'Conversations underway'
                      : 'Great things ahead'}
                </div>
              </button>
            ))}

            <div className="stat-card follow-card">
              <div className="stat-label">
                Follow-ups due
                <span className="mini-icon amber">
                  <Clock3 size={15} />
                </span>
              </div>

              <div className="stat-number">
                {apps.filter(app => app.isOverdue).length}
                <small> to nudge</small>
              </div>

              <div className="stat-foot">
                A thoughtful check-in can help
              </div>
            </div>
          </section>

          <section className="list-section">
            <div className="section-heading">
              <div>
                <h2>Your applications</h2>
                <p>Every opportunity, one step at a time.</p>
              </div>

              <span className="count-pill">{apps.length} showing</span>
            </div>

            <div className="toolbar">
              <div className="searchbox">
                <Search size={17} />

                <input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Search companies"
                  aria-label="Search companies"
                />

                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="filters">
                {['All', ...STATUSES].map(status => (
                  <button
                    key={status}
                    onClick={() => setFilter(status)}
                    className={filter === status ? 'filter active' : 'filter'}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="empty">
                <div className="empty-icon">
                  <BriefcaseBusiness size={23} />
                </div>
                <h3>Loading your applications...</h3>
                <p>Connecting to your tracker.</p>
              </div>
            ) : apps.length ? (
              <div className="application-list">
                {apps.map(app => (
                  <article className="application-card" key={app._id}>
                    <div className="company-logo">
                      {(app.companyName || '?').slice(0, 1).toUpperCase()}
                    </div>

                    <div className="job-main">
                      <div className="job-title-row">
                        <h3>{app.jobRole}</h3>

                        <span className={`badge ${(app.status || '').toLowerCase()}`}>
                          {app.status}
                        </span>

                        {app.isOverdue && (
                          <span className="badge overdue">
                            Follow-up due
                          </span>
                        )}
                      </div>

                      <div className="company-line">
                        <span>{app.companyName}</span>
                        <span>·</span>
                        <span>{app.jobType}</span>
                        <span>·</span>
                        <span className="job-id">{app.applicationId}</span>
                      </div>
                    </div>

                    <div className="job-meta">
                      <div>
                        <CalendarDays size={14} />
                        {date(app.appliedDate)}
                      </div>
                      <small>Applied</small>
                    </div>

                    <div className="job-meta salary">
                      <div>{money(app.expectedSalary)}</div>
                      <small>Expected salary</small>
                    </div>

                    <div className="card-actions">
                      <button
                        type="button"
                        className="icon-btn"
                        title="View details"
                        aria-label={`View ${app.jobRole} details`}
                        onClick={() => openDetails(app)}
                      >
                        <ArrowUpRight size={17} />
                      </button>

                      <button
                        type="button"
                        className="icon-btn"
                        title="Edit application"
                        aria-label={`Edit ${app.jobRole}`}
                        onClick={() => openEdit(app)}
                      >
                        <Pencil size={15} />
                      </button>

                      <div className="status-select">
                        <select
                          aria-label={`Change status for ${app.jobRole}`}
                          value=""
                          onChange={event => {
                            if (event.target.value) {
                              changeStatus(app, event.target.value);
                            }
                          }}
                          disabled={!FLOW[app.status]?.length}
                        >
                          <option value="">Move to</option>

                          {(FLOW[app.status] || []).map(status => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>

                        <ChevronDown size={13} />
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty">
                <div className="empty-icon">
                  <BriefcaseBusiness size={23} />
                </div>

                <h3>
                  {search || filter !== 'All'
                    ? 'No matches just yet'
                    : 'Your next chapter starts here'}
                </h3>

                <p>
                  {search || filter !== 'All'
                    ? 'Try a different search or status filter.'
                    : 'Add your first application and keep the momentum going.'}
                </p>

                {!search && filter === 'All' && (
                  <button className="primary" onClick={openCreate}>
                    <Plus size={16} />
                    Add your first application
                  </button>
                )}
              </div>
            )}
          </section>

          <footer className="footer">
            Made for the next step <span>✳</span>
          </footer>
        </div>
      </main>

      {modal && (
        <div
          className="overlay"
          onMouseDown={event => {
            if (event.target === event.currentTarget && !busy) {
              setModal(null);
            }
          }}
        >
          <form className="dialog" onSubmit={submit}>
            <div className="dialog-head">
              <div>
                <div className="eyebrow">
                  {modal.mode === 'create'
                    ? 'NEW OPPORTUNITY'
                    : 'EDIT DETAILS'}
                </div>

                <h2>
                  {modal.mode === 'create'
                    ? 'Add application'
                    : 'Update application'}
                </h2>
              </div>

              <button
                type="button"
                className="close"
                onClick={() => !busy && setModal(null)}
                aria-label="Close form"
              >
                <X size={18} />
              </button>
            </div>

            <div className="form-grid">
              <label>
                Company name
                <input
                  required
                  maxLength={100}
                  value={form.companyName}
                  onChange={event =>
                    setForm({ ...form, companyName: event.target.value })
                  }
                  placeholder="e.g. Northstar Studio"
                />
              </label>

              <label>
                Job role
                <input
                  required
                  maxLength={100}
                  value={form.jobRole}
                  onChange={event =>
                    setForm({ ...form, jobRole: event.target.value })
                  }
                  placeholder="e.g. Product Designer"
                />
              </label>

              <label>
                Job type
                <select
                  value={form.jobType}
                  onChange={event =>
                    setForm({ ...form, jobType: event.target.value })
                  }
                >
                  <option>Full-time</option>
                  <option>Internship</option>
                  <option>Contract</option>
                </select>
              </label>

              <label>
                Applied date
                <input
                  required
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  disabled={modal.mode === 'edit'}
                  value={form.appliedDate}
                  onChange={event =>
                    setForm({ ...form, appliedDate: event.target.value })
                  }
                />
              </label>

              <label>
                Expected salary <span className="optional">optional · USD</span>
                <input
                  type="number"
                  min="0"
                  value={form.expectedSalary}
                  onChange={event =>
                    setForm({ ...form, expectedSalary: event.target.value })
                  }
                  placeholder="e.g. 85000"
                />
              </label>

              <label className="span2">
                Notes <span className="optional">optional</span>
                <textarea
                  maxLength={2000}
                  rows={3}
                  value={form.notes}
                  onChange={event =>
                    setForm({ ...form, notes: event.target.value })
                  }
                  placeholder="Add a detail worth remembering..."
                />
              </label>
            </div>

            <div className="dialog-foot">
              <span>
                Follow-up reminder is set for 7 days after applying.
              </span>

              <button className="primary" disabled={busy}>
                {busy ? (
                  'Saving...'
                ) : (
                  <>
                    <Check size={16} />
                    {modal.mode === 'create'
                      ? 'Save application'
                      : 'Save changes'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {selected && (
        <div
          className="overlay"
          onMouseDown={event => {
            if (event.target === event.currentTarget) {
              setSelected(null);
            }
          }}
        >
          <section className="dialog detail-dialog">
            <div className="dialog-head">
              <div>
                <div className="eyebrow">{selected.applicationId}</div>
                <h2>{selected.jobRole}</h2>
                <p className="detail-company">
                  {selected.companyName} · {selected.jobType}
                </p>
              </div>

              <button
                type="button"
                className="close"
                onClick={() => setSelected(null)}
                aria-label="Close details"
              >
                <X size={18} />
              </button>
            </div>

            <div className="detail-info">
              <div>
                <span>Status</span>
                <b className={`badge ${(selected.status || '').toLowerCase()}`}>
                  {selected.status}
                </b>
              </div>

              <div>
                <span>Applied</span>
                <b>{date(selected.appliedDate)}</b>
              </div>

              <div>
                <span>Follow-up date</span>
                <b>
                  {date(selected.followUpDate)}{' '}
                  {selected.isOverdue && (
                    <i className="due-text">· due</i>
                  )}
                </b>
              </div>

              <div>
                <span>Expected salary</span>
                <b>{money(selected.expectedSalary)}</b>
              </div>
            </div>

            {selected.notes && (
              <div className="notes-box">
                <span>NOTES</span>
                <p>{selected.notes}</p>
              </div>
            )}

            <div className="timeline-title">Status history</div>

            <div className="timeline">
              {[...(selected.statusHistory || [])]
                .reverse()
                .map((item, index) => (
                  <div
                    className="timeline-item"
                    key={`${item.status}-${item.date}-${index}`}
                  >
                    <span className="timeline-dot" />

                    <div>
                      <b>{item.status}</b>
                      <time>{date(item.date)}</time>
                      {item.note && <p>{item.note}</p>}
                    </div>
                  </div>
                ))}
            </div>

            <div className="dialog-foot">
              <button
                type="button"
                className="text-danger"
                disabled={!canDelete(selected)}
                title={
                  canDelete(selected)
                    ? 'Delete application'
                    : 'Cannot delete an application in Interview or Offer'
                }
                onClick={() => remove(selected)}
              >
                <Trash2 size={15} />
                Delete
              </button>

              <button
                type="button"
                className="primary"
                onClick={() => {
                  const appToEdit = selected;
                  setSelected(null);
                  openEdit(appToEdit);
                }}
              >
                <Pencil size={15} />
                Edit details
              </button>
            </div>
          </section>
        </div>
      )}

      {toast && (
        <div className="toast" role="status">
          <span>
            <Check size={15} />
          </span>

          {toast}

          <button
            type="button"
            onClick={() => setToast('')}
            aria-label="Dismiss message"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
