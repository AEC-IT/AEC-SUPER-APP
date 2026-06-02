import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingsAPI, screensAPI } from '../api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

/* ── small helper to download a CSV ── */
function downloadCSV(rows, filename) {
  if (!rows.length) { toast.error('No data to export.'); return; }
  const headers = Object.keys(rows[0]).join(',');
  const lines = rows.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
  const blob = new Blob([headers + '\n' + lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  toast.success(`Exported ${rows.length} records.`);
}

const AUTO_REF = (prefix) => `${prefix}-${Date.now().toString().slice(-6)}`;

export default function BookingsPage() {
  const [activeTab, setActiveTab] = useState('bookings');
  const qc = useQueryClient();

  /* ── Modal visibility ── */
  const [showNewBookingModal, setShowNewBookingModal]       = useState(false);
  const [showRefundModal, setShowRefundModal]               = useState(false);
  const [showNewRefundModal, setShowNewRefundModal]         = useState(false);
  const [showCancelModal, setShowCancelModal]               = useState(false);
  const [showNewCancelModal, setShowNewCancelModal]         = useState(false);
  const [showCompModal, setShowCompModal]                   = useState(false);
  const [showAdjModal, setShowAdjModal]                     = useState(false);
  const [selectedBooking, setSelectedBooking]               = useState(null);

  /* ── Forms ── */
  const [newBookingForm, setNewBookingForm] = useState({
    booking_ref: '', show_id: '', customer_name: '', customer_phone: '',
    source: 'COUNTER', seats_count: 1, total_amount: '',
    payment_mode: 'CASH', notes: ''
  });
  const [refundForm, setRefundForm] = useState({ amount: '', reason: '' });
  const [newRefundForm, setNewRefundForm] = useState({ booking_ref: '', amount: '', reason: '', mode: 'CASH' });
  const [newCancelForm, setNewCancelForm] = useState({
    booking_ref: '', customer: '', amount: '', reason: '', recovered: false
  });
  const [compForm, setCompForm] = useState({ guestName: '', seatsCount: 1, movie: '', targetDate: '', targetTime: '', approvedBy: 'MD' });
  const [adjForm, setAdjForm] = useState({ bookingRef: '', adjustmentType: 'ADDITION', amount: '', reason: '' });

  /* ── API Queries ── */
  const { data, isLoading } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => bookingsAPI.list().then(r => r.data)
  });
  const { data: bmsLogs } = useQuery({
    queryKey: ['bms-logs'],
    queryFn: () => bookingsAPI.bmsSyncLogs().then(r => r.data)
  });
  const { data: shows } = useQuery({
    queryKey: ['shows-list'],
    queryFn: () => screensAPI.shows().then(r => r.data)
  });

  const records = data?.results || data || [];
  const showList = shows?.results || shows || [];

  /* ── Mutations ── */
  const createBookingMut = useMutation({
    mutationFn: d => bookingsAPI.create(d),
    onSuccess: () => {
      qc.invalidateQueries(['bookings']);
      toast.success('Manual booking recorded successfully!');
      setShowNewBookingModal(false);
      setNewBookingForm({ booking_ref: '', show_id: '', customer_name: '', customer_phone: '', source: 'COUNTER', seats_count: 1, total_amount: '', payment_mode: 'CASH', notes: '' });
    },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to create booking.')
  });

  const cancelMutation = useMutation({
    mutationFn: id => bookingsAPI.cancel(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries(['bookings']);
      const bk = records.find(r => r.id === id);
      if (bk) {
        setCancellations(prev => [{
          id: prev.length + 1,
          ref: bk.booking_ref,
          customer: bk.customer_name || 'Walk-in Guest',
          amount: parseFloat(bk.total_amount),
          reason: 'Operator cancellation',
          date: new Date().toISOString()
        }, ...prev]);
      }
      toast.success('Booking cancelled. Entry added to Cancellations register.');
      setShowCancelModal(false);
      setSelectedBooking(null);
    },
    onError: () => toast.error('Failed to cancel booking.')
  });

  /* ── Local registers (offline-first pattern while backend extended) ── */
  const [refunds, setRefunds] = useState([
    { id: 1, ref: 'BK-APP-8941', booking_ref: 'BK-APP-8941', amount: 350.00, mode: 'ORIGINAL', reason: 'Double booking error', status: 'PROCESSED', date: '2026-05-17T11:20:00', raised_by: 'Admin' },
    { id: 2, ref: 'BK-BMS-5690', booking_ref: 'BK-BMS-5690', amount: 540.00, mode: 'CASH', reason: 'Show pause cancellation', status: 'PENDING', date: '2026-05-18T09:15:00', raised_by: 'Admin' },
  ]);

  const [cancellations, setCancellations] = useState([
    { id: 1, ref: 'BK-APP-4102', customer: 'John Doe', amount: 280.00, reason: 'Customer request', date: '2026-05-16T14:40:00', recovered: true },
    { id: 2, ref: 'BK-POS-1002', customer: 'Walk-in Guest', amount: 150.00, reason: 'Show postponed', date: '2026-05-18T10:10:00', recovered: false },
  ]);

  const [compPasses, setCompPasses] = useState([
    { id: 1, guestName: 'Suresh Kumar (Audit Inspector)', seatsCount: 2, movie: 'Avatar 3', showTime: '2026-05-18 18:00', approvedBy: 'MD' },
    { id: 2, guestName: 'Elena Gilbert', seatsCount: 4, movie: 'The Avengers', showTime: '2026-05-19 21:15', approvedBy: 'Admin' }
  ]);

  const [adjustments, setAdjustments] = useState([
    { id: 1, bookingRef: 'BK-POS-9812', type: 'DEDUCTION', amount: 50.00, reason: 'Promo code applied late', approvedBy: 'Admin', timestamp: '2026-05-18T08:00:00' },
    { id: 2, bookingRef: 'BK-APP-2349', type: 'ADDITION', amount: 120.00, reason: 'Gourmet upgrade addon', approvedBy: 'MD', timestamp: '2026-05-18T13:42:00' }
  ]);

  /* ── Handlers ── */
  const handleNewBooking = (e) => {
    e.preventDefault();
    createBookingMut.mutate({
      ...newBookingForm,
      show: newBookingForm.show_id || undefined,
      booking_ref: newBookingForm.booking_ref || AUTO_REF('BK-CNTR'),
      seats_count: parseInt(newBookingForm.seats_count),
      total_amount: parseFloat(newBookingForm.total_amount),
    });
  };

  const handleRefundFromBooking = (e) => {
    e.preventDefault();
    if (!selectedBooking) return;
    const newRef = {
      id: refunds.length + 1,
      ref: selectedBooking.booking_ref,
      booking_ref: selectedBooking.booking_ref,
      amount: parseFloat(refundForm.amount),
      mode: 'ORIGINAL',
      reason: refundForm.reason,
      status: 'PENDING',
      date: new Date().toISOString(),
      raised_by: 'Admin'
    };
    setRefunds([newRef, ...refunds]);
    toast.success('Refund request logged — pending MD approval.');
    setShowRefundModal(false);
    setRefundForm({ amount: '', reason: '' });
    setSelectedBooking(null);
  };

  const handleNewRefund = (e) => {
    e.preventDefault();
    const newRef = {
      id: refunds.length + 1,
      ref: newRefundForm.booking_ref,
      booking_ref: newRefundForm.booking_ref,
      amount: parseFloat(newRefundForm.amount),
      mode: newRefundForm.mode,
      reason: newRefundForm.reason,
      status: 'PENDING',
      date: new Date().toISOString(),
      raised_by: 'Admin'
    };
    setRefunds([newRef, ...refunds]);
    toast.success('Refund entry added to registry — pending MD approval.');
    setShowNewRefundModal(false);
    setNewRefundForm({ booking_ref: '', amount: '', reason: '', mode: 'CASH' });
  };

  const handleNewCancellation = (e) => {
    e.preventDefault();
    const newCan = {
      id: cancellations.length + 1,
      ref: newCancelForm.booking_ref,
      customer: newCancelForm.customer || 'Walk-in Guest',
      amount: parseFloat(newCancelForm.amount),
      reason: newCancelForm.reason,
      recovered: newCancelForm.recovered,
      date: new Date().toISOString()
    };
    setCancellations([newCan, ...cancellations]);
    toast.success('Cancellation logged in register.');
    setShowNewCancelModal(false);
    setNewCancelForm({ booking_ref: '', customer: '', amount: '', reason: '', recovered: false });
  };

  const handleCreateCompPass = (e) => {
    e.preventDefault();
    const showTimeStr = `${compForm.targetDate} ${compForm.targetTime}`;
    const newPass = {
      id: compPasses.length + 1,
      guestName: compForm.guestName,
      seatsCount: parseInt(compForm.seatsCount),
      movie: compForm.movie,
      showTime: showTimeStr,
      approvedBy: compForm.approvedBy
    };
    setCompPasses([newPass, ...compPasses]);
    toast.success('Complimentary pass issued!');
    setShowCompModal(false);
    setCompForm({ guestName: '', seatsCount: 1, movie: '', targetDate: '', targetTime: '', approvedBy: 'MD' });
  };

  const handleCreateAdjustment = (e) => {
    e.preventDefault();
    const newAdj = {
      id: adjustments.length + 1,
      bookingRef: adjForm.bookingRef,
      type: adjForm.adjustmentType,
      amount: parseFloat(adjForm.amount),
      reason: adjForm.reason,
      approvedBy: 'MD',
      timestamp: new Date().toISOString()
    };
    setAdjustments([newAdj, ...adjustments]);
    toast.success('Financial adjustment synced to P&L ledger.');
    setShowAdjModal(false);
    setAdjForm({ bookingRef: '', adjustmentType: 'ADDITION', amount: '', reason: '' });
  };

  /* ── Badge helpers ── */
  const sourceBadge = s => { if (s === 'APP') return 'badge-info'; if (s === 'BMS') return 'badge-warning'; if (s === 'COUNTER') return 'badge-success'; return 'badge-neutral'; };
  const statusBadge = s => { if (s === 'CONFIRMED') return 'badge-success'; if (s === 'CANCELLED') return 'badge-error'; if (s === 'CHECKED_IN') return 'badge-info'; return 'badge-neutral'; };

  /* ── Tab sub-header with action + export ── */
  const TabActions = ({ children, onExport }) => (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, justifyContent: 'flex-end' }}>
      {children}
      <button className="btn btn-secondary btn-sm" onClick={onExport}>📥 Export CSV</button>
    </div>
  );

  return (
    <div>
      {/* ── PAGE HEADER ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">🎟️ Bookings &amp; Box Office</h1>
          <p className="page-subtitle">Multi-channel bookings · Cancellations · Refunds · Comp Passes · Adjustments</p>
        </div>
      </div>

      {/* ── BMS SYNC BANNER ── */}
      {activeTab === 'bookings' && bmsLogs && (
        <div className="card" style={{ marginBottom: 20, background: 'var(--bg-glass)', padding: '14px 20px' }}>
          <div className="flex-between">
            <div className="font-semibold" style={{ fontSize: 13 }}>🔄 External Ticketing Sync Active (District App / BookMyShow)</div>
            <div className="text-xs text-muted">Auto-scheduler running</div>
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 12 }}>
            {(bmsLogs.results || bmsLogs || []).slice(0, 3).map(log => (
              <div key={log.id} className="card" style={{ padding: '10px 14px', flex: 1, border: '1px solid var(--border)' }}>
                <div className={`badge ${log.status === 'SUCCESS' ? 'badge-success' : 'badge-error'}`}>{log.status}</div>
                <div className="text-xs text-muted" style={{ marginTop: 4 }}>{log.records_fetched} fetched · {log.records_created} new</div>
                <div className="text-xs text-muted">{log.sync_timestamp ? format(new Date(log.sync_timestamp), 'dd MMM, HH:mm') : ''}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TABS ── */}
      <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--border)', marginBottom: 20, paddingBottom: 8, flexWrap: 'wrap' }}>
        {[
          ['bookings',      '🎟️ Bookings Ledger'],
          ['refunds',       '💸 Refunds Registry'],
          ['cancellations', '❌ Cancellations'],
          ['comp-passes',   '🎫 Comp Passes'],
          ['adjustments',   '⚖️ Adjustments'],
        ].map(([key, label]) => (
          <button
            key={key}
            id={`tab-${key}`}
            className={`tab-btn ${activeTab === key ? 'active' : ''}`}
            onClick={() => setActiveTab(key)}
          >{label}</button>
        ))}
      </div>

      {/* ══════════════════════════════════
          TAB 1 — BOOKINGS LEDGER
      ══════════════════════════════════ */}
      {activeTab === 'bookings' && (
        <>
          <TabActions
            onExport={() => downloadCSV(
              records.map(r => ({ ref: r.booking_ref, movie: r.show_info?.movie, customer: r.customer_name || 'Walk-in', source: r.source, seats: r.booked_seats?.length || 0, amount: r.total_amount, status: r.status })),
              `Bookings_Ledger_${format(new Date(), 'yyyy-MM-dd')}.csv`
            )}
          >
            <button id="btn-add-booking-inline" className="btn btn-primary btn-sm" onClick={() => setShowNewBookingModal(true)}>
              ✚ Add Manual Booking
            </button>
          </TabActions>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Booking Ref</th>
                  <th>Show / Screen</th>
                  <th>Customer</th>
                  <th>Channel</th>
                  <th>Seats</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={8} className="loading-cell">Loading bookings…</td></tr>}
                {!isLoading && records.length === 0 && (
                  <tr><td colSpan={8} className="loading-cell">
                    No bookings found. Use "Add Manual Booking" to get started.
                  </td></tr>
                )}
                {records.map(r => (
                  <tr key={r.id}>
                    <td><strong style={{ color: 'var(--gold)' }}>{r.booking_ref}</strong></td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.show_info?.movie}</div>
                      <span className="text-xs text-muted">{r.show_info?.screen} · {r.show_info?.date}</span>
                    </td>
                    <td>
                      <div>{r.customer_name || 'Walk-in Guest'}</div>
                      {r.customer_phone && <span className="text-xs text-muted">{r.customer_phone}</span>}
                    </td>
                    <td><span className={`badge ${sourceBadge(r.source)}`}>{r.source}</span></td>
                    <td>{r.booked_seats?.length || r.seats_count || 0} seats</td>
                    <td><strong>₹{parseFloat(r.total_amount).toLocaleString('en-IN')}</strong></td>
                    <td><span className={`badge ${statusBadge(r.status)}`}>{r.status}</span></td>
                    <td>
                      {r.status === 'CONFIRMED' && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: 11 }}
                            onClick={() => { setSelectedBooking(r); setRefundForm({ amount: r.total_amount, reason: '' }); setShowRefundModal(true); }}
                          >💸 Refund</button>
                          <button
                            className="btn btn-sm"
                            style={{ fontSize: 11, background: 'rgba(239,68,68,0.15)', color: 'var(--error)', border: '1px solid rgba(239,68,68,0.3)' }}
                            onClick={() => { setSelectedBooking(r); setShowCancelModal(true); }}
                          >❌ Cancel</button>
                        </div>
                      )}
                      {r.status === 'CANCELLED' && (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ══════════════════════════════════
          TAB 2 — REFUNDS REGISTRY
      ══════════════════════════════════ */}
      {activeTab === 'refunds' && (
        <>
          <TabActions
            onExport={() => downloadCSV(
              refunds.map(r => ({ id: `REF-00${r.id}`, booking_ref: r.ref, amount: r.amount, mode: r.mode, reason: r.reason, status: r.status, date: r.date, raised_by: r.raised_by })),
              `Refunds_Registry_${format(new Date(), 'yyyy-MM-dd')}.csv`
            )}
          >
            <button id="btn-new-refund-tab" className="btn btn-primary btn-sm" onClick={() => setShowNewRefundModal(true)}>
              ✚ New Refund Entry
            </button>
          </TabActions>

          {/* Summary strip */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'Total Refunds', value: refunds.length, color: 'var(--text-primary)' },
              { label: 'Pending', value: refunds.filter(r => r.status === 'PENDING').length, color: 'var(--warning)' },
              { label: 'Processed', value: refunds.filter(r => r.status === 'PROCESSED').length, color: 'var(--success)' },
              { label: 'Total Value', value: `₹${refunds.reduce((s,r) => s + r.amount, 0).toLocaleString('en-IN')}`, color: 'var(--error)' },
            ].map(kpi => (
              <div key={kpi.label} className="kpi-card" style={{ flex: 1, padding: '14px 18px' }}>
                <div className="kpi-label">{kpi.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: kpi.color, marginTop: 4 }}>{kpi.value}</div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Refund ID</th>
                  <th>Booking Ref</th>
                  <th>Amount</th>
                  <th>Mode</th>
                  <th>Reason</th>
                  <th>Raised By</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {refunds.length === 0 && <tr><td colSpan={8} className="loading-cell">No refunds recorded.</td></tr>}
                {refunds.map(ref => (
                  <tr key={ref.id}>
                    <td><strong>REF-00{ref.id}</strong></td>
                    <td style={{ color: 'var(--gold)' }}>{ref.ref}</td>
                    <td><strong style={{ color: 'var(--error)' }}>₹{ref.amount.toFixed(2)}</strong></td>
                    <td><span className="badge badge-neutral">{ref.mode || 'ORIGINAL'}</span></td>
                    <td>{ref.reason}</td>
                    <td className="text-muted text-xs">{ref.raised_by || 'Admin'}</td>
                    <td className="text-muted text-xs">{format(new Date(ref.date), 'dd MMM yyyy, HH:mm')}</td>
                    <td><span className={`badge ${ref.status === 'PROCESSED' ? 'badge-success' : 'badge-warning'}`}>{ref.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ══════════════════════════════════
          TAB 3 — CANCELLATIONS
      ══════════════════════════════════ */}
      {activeTab === 'cancellations' && (
        <>
          <TabActions
            onExport={() => downloadCSV(
              cancellations.map(c => ({ id: `CAN-00${c.id}`, ref: c.ref, customer: c.customer, amount: c.amount, reason: c.reason, recovered: c.recovered ? 'YES' : 'NO', date: c.date })),
              `Cancellations_${format(new Date(), 'yyyy-MM-dd')}.csv`
            )}
          >
            <button id="btn-log-cancellation" className="btn btn-primary btn-sm" onClick={() => setShowNewCancelModal(true)}>
              ✚ Log Cancellation
            </button>
          </TabActions>

          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'Total Cancellations', value: cancellations.length, color: 'var(--text-primary)' },
              { label: 'Revenue Lost', value: `₹${cancellations.reduce((s,c) => s + c.amount, 0).toLocaleString('en-IN')}`, color: 'var(--error)' },
              { label: 'Recovered (Resold)', value: cancellations.filter(c => c.recovered).length, color: 'var(--success)' },
            ].map(kpi => (
              <div key={kpi.label} className="kpi-card" style={{ flex: 1, padding: '14px 18px' }}>
                <div className="kpi-label">{kpi.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: kpi.color, marginTop: 4 }}>{kpi.value}</div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cancel ID</th>
                  <th>Booking Ref</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Reason</th>
                  <th>Seat Recovered?</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {cancellations.length === 0 && <tr><td colSpan={7} className="loading-cell">No cancellations recorded.</td></tr>}
                {cancellations.map(c => (
                  <tr key={c.id}>
                    <td><strong>CAN-00{c.id}</strong></td>
                    <td style={{ color: 'var(--gold)' }}>{c.ref}</td>
                    <td>{c.customer}</td>
                    <td>₹{c.amount.toFixed(2)}</td>
                    <td>{c.reason}</td>
                    <td>
                      <span className={`badge ${c.recovered ? 'badge-success' : 'badge-error'}`}>
                        {c.recovered ? 'Yes – Resold' : 'No'}
                      </span>
                    </td>
                    <td className="text-muted text-xs">{format(new Date(c.date), 'dd MMM yyyy, HH:mm')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ══════════════════════════════════
          TAB 4 — COMPLIMENTARY PASSES
      ══════════════════════════════════ */}
      {activeTab === 'comp-passes' && (
        <>
          <TabActions
            onExport={() => downloadCSV(
              compPasses.map(p => ({ id: `COMP-00${p.id}`, guest: p.guestName, seats: p.seatsCount, movie: p.movie, show_time: p.showTime, approved_by: p.approvedBy })),
              `Comp_Passes_${format(new Date(), 'yyyy-MM-dd')}.csv`
            )}
          >
            <button id="btn-issue-comp-pass" className="btn btn-primary btn-sm" onClick={() => setShowCompModal(true)}>
              ✚ Issue Comp Pass
            </button>
          </TabActions>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Pass ID</th>
                  <th>Guest / Organisation</th>
                  <th>Seats</th>
                  <th>Movie</th>
                  <th>Show Time</th>
                  <th>Authority</th>
                </tr>
              </thead>
              <tbody>
                {compPasses.length === 0 && <tr><td colSpan={6} className="loading-cell">No comp passes issued.</td></tr>}
                {compPasses.map(p => (
                  <tr key={p.id}>
                    <td><strong>COMP-00{p.id}</strong></td>
                    <td><strong>{p.guestName}</strong></td>
                    <td>{p.seatsCount} seats</td>
                    <td>{p.movie}</td>
                    <td>{p.showTime}</td>
                    <td><span className="badge badge-success">{p.approvedBy}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ══════════════════════════════════
          TAB 5 — ADJUSTMENTS PANEL
      ══════════════════════════════════ */}
      {activeTab === 'adjustments' && (
        <>
          <TabActions
            onExport={() => downloadCSV(
              adjustments.map(a => ({ id: `ADJ-00${a.id}`, booking_ref: a.bookingRef, type: a.type, amount: a.amount, reason: a.reason, approved_by: a.approvedBy, timestamp: a.timestamp })),
              `Adjustments_${format(new Date(), 'yyyy-MM-dd')}.csv`
            )}
          >
            <button id="btn-new-adjustment" className="btn btn-primary btn-sm" onClick={() => setShowAdjModal(true)}>
              ✚ New Adjustment
            </button>
          </TabActions>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Adj ID</th>
                  <th>Affected Booking</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Reason</th>
                  <th>Authorized By</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {adjustments.length === 0 && <tr><td colSpan={7} className="loading-cell">No adjustments recorded.</td></tr>}
                {adjustments.map(adj => (
                  <tr key={adj.id}>
                    <td><strong>ADJ-00{adj.id}</strong></td>
                    <td style={{ color: 'var(--gold)' }}>{adj.bookingRef}</td>
                    <td><span className={`badge ${adj.type === 'ADDITION' ? 'badge-success' : 'badge-error'}`}>{adj.type}</span></td>
                    <td><strong>₹{adj.amount.toFixed(2)}</strong></td>
                    <td>{adj.reason}</td>
                    <td>{adj.approvedBy}</td>
                    <td className="text-muted text-xs">{format(new Date(adj.timestamp), 'dd MMM yyyy, HH:mm')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════
          MODALS
      ══════════════════════════════════════════════ */}

      {/* MODAL 1 — NEW MANUAL BOOKING */}
      {showNewBookingModal && (
        <div className="modal-overlay" onClick={() => setShowNewBookingModal(false)}>
          <div className="modal" style={{ maxWidth: 620 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">🎟️ Add Manual Booking</div>
            <p className="text-xs text-muted" style={{ marginBottom: 20, lineHeight: 1.6 }}>
              Record a counter / phone booking not captured through BookMyShow or the mobile app. A unique reference will be auto-generated if left blank.
            </p>
            <form onSubmit={handleNewBooking}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Booking Ref (auto if blank)</label>
                  <input className="form-input" placeholder="BK-CNTR-XXXXXX" value={newBookingForm.booking_ref}
                    onChange={e => setNewBookingForm(p => ({ ...p, booking_ref: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Channel / Source</label>
                  <select className="form-select" value={newBookingForm.source}
                    onChange={e => setNewBookingForm(p => ({ ...p, source: e.target.value }))}>
                    <option value="COUNTER">Counter (Box Office)</option>
                    <option value="PHONE">Phone Booking</option>
                    <option value="AGENT">Agent / Broker</option>
                    <option value="CORPORATE">Corporate Block</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Show (optional)</label>
                <select className="form-select" value={newBookingForm.show_id}
                  onChange={e => setNewBookingForm(p => ({ ...p, show_id: e.target.value }))}>
                  <option value="">— Select Show (or leave blank) —</option>
                  {showList.map(s => (
                    <option key={s.id} value={s.id}>{s.movie_title} · {s.screen_name} · {s.show_date} {s.start_time}</option>
                  ))}
                </select>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Customer Name</label>
                  <input className="form-input" placeholder="Full name or 'Walk-in'" value={newBookingForm.customer_name}
                    onChange={e => setNewBookingForm(p => ({ ...p, customer_name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input className="form-input" placeholder="+91 XXXXX XXXXX" value={newBookingForm.customer_phone}
                    onChange={e => setNewBookingForm(p => ({ ...p, customer_phone: e.target.value }))} />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">No. of Seats *</label>
                  <input type="number" min="1" max="20" className="form-input" value={newBookingForm.seats_count}
                    onChange={e => setNewBookingForm(p => ({ ...p, seats_count: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Total Amount (₹) *</label>
                  <input type="number" step="0.01" className="form-input" placeholder="0.00" value={newBookingForm.total_amount}
                    onChange={e => setNewBookingForm(p => ({ ...p, total_amount: e.target.value }))} required />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Payment Mode</label>
                <select className="form-select" value={newBookingForm.payment_mode}
                  onChange={e => setNewBookingForm(p => ({ ...p, payment_mode: e.target.value }))}>
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="CARD">Card (POS)</option>
                  <option value="NEFT">NEFT / Bank Transfer</option>
                  <option value="CREDIT">Credit (Pay Later)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Notes / Remarks</label>
                <textarea className="form-input" rows={2} placeholder="Any special instructions..." value={newBookingForm.notes}
                  onChange={e => setNewBookingForm(p => ({ ...p, notes: e.target.value }))} />
              </div>

              <div className="flex gap-12" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowNewBookingModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={createBookingMut.isPending}>
                  {createBookingMut.isPending ? '⏳ Saving…' : '✅ Save Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2 — REFUND FROM BOOKING ROW */}
      {showRefundModal && (
        <div className="modal-overlay" onClick={() => setShowRefundModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">💸 Request Refund</div>
            <form onSubmit={handleRefundFromBooking}>
              <div className="form-group">
                <label className="form-label">Booking Reference</label>
                <input type="text" className="form-input" value={selectedBooking?.booking_ref || ''} readOnly style={{ opacity: 0.7 }} />
              </div>
              <div className="form-group">
                <label className="form-label">Refund Amount (₹) *</label>
                <input type="number" step="0.01" className="form-input" value={refundForm.amount}
                  onChange={e => setRefundForm(p => ({ ...p, amount: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Reason / Justification *</label>
                <textarea className="form-input" rows={3} value={refundForm.reason} placeholder="State refund cause…"
                  onChange={e => setRefundForm(p => ({ ...p, reason: e.target.value }))} required />
              </div>
              <div className="flex gap-12" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowRefundModal(false); setSelectedBooking(null); }}>Close</button>
                <button type="submit" className="btn btn-primary">Submit for MD Signoff</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3 — CONFIRM CANCELLATION FROM BOOKING ROW */}
      {showCancelModal && selectedBooking && (
        <div className="modal-overlay" onClick={() => { setShowCancelModal(false); setSelectedBooking(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">❌ Confirm Cancellation</div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
              You are about to cancel booking <strong style={{ color: 'var(--gold)' }}>{selectedBooking.booking_ref}</strong> for{' '}
              <strong>{selectedBooking.customer_name || 'Walk-in Guest'}</strong> worth{' '}
              <strong style={{ color: 'var(--error)' }}>₹{parseFloat(selectedBooking.total_amount).toLocaleString('en-IN')}</strong>.
              <br /><br />
              This action will mark the booking as <strong>CANCELLED</strong> and add an entry to the Cancellations register. It cannot be undone.
            </p>
            <div className="flex gap-12" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => { setShowCancelModal(false); setSelectedBooking(null); }}>Go Back</button>
              <button
                className="btn"
                style={{ background: 'rgba(239,68,68,0.2)', color: 'var(--error)', border: '1px solid rgba(239,68,68,0.4)' }}
                onClick={() => cancelMutation.mutate(selectedBooking.id)}
                disabled={cancelMutation.isPending}
              >
                {cancelMutation.isPending ? '⏳ Processing…' : '❌ Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4 — STANDALONE NEW REFUND */}
      {showNewRefundModal && (
        <div className="modal-overlay" onClick={() => setShowNewRefundModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">💸 New Refund Entry</div>
            <p className="text-xs text-muted" style={{ marginBottom: 16, lineHeight: 1.6 }}>
              Manually log a refund that was processed offline or via counter. All refunds require MD approval before funds are released.
            </p>
            <form onSubmit={handleNewRefund}>
              <div className="form-group">
                <label className="form-label">Booking Reference *</label>
                <input className="form-input" placeholder="e.g. BK-POS-0012" value={newRefundForm.booking_ref}
                  onChange={e => setNewRefundForm(p => ({ ...p, booking_ref: e.target.value }))} required />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Refund Amount (₹) *</label>
                  <input type="number" step="0.01" className="form-input" placeholder="0.00" value={newRefundForm.amount}
                    onChange={e => setNewRefundForm(p => ({ ...p, amount: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Refund Mode</label>
                  <select className="form-select" value={newRefundForm.mode}
                    onChange={e => setNewRefundForm(p => ({ ...p, mode: e.target.value }))}>
                    <option value="ORIGINAL">Original Payment Method</option>
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="BANK">Bank Transfer</option>
                    <option value="VOUCHER">Voucher / Credit Note</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Reason *</label>
                <textarea className="form-input" rows={3} placeholder="Reason for refund…" value={newRefundForm.reason}
                  onChange={e => setNewRefundForm(p => ({ ...p, reason: e.target.value }))} required />
              </div>
              <div className="flex gap-12" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowNewRefundModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">✅ Log Refund</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5 — STANDALONE NEW CANCELLATION */}
      {showNewCancelModal && (
        <div className="modal-overlay" onClick={() => setShowNewCancelModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">❌ Log Cancellation</div>
            <p className="text-xs text-muted" style={{ marginBottom: 16, lineHeight: 1.6 }}>
              Record a cancellation that happened offline or for a booking not in the system (e.g. phone booking, agent block).
            </p>
            <form onSubmit={handleNewCancellation}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Booking Reference *</label>
                  <input className="form-input" placeholder="e.g. BK-POS-0088" value={newCancelForm.booking_ref}
                    onChange={e => setNewCancelForm(p => ({ ...p, booking_ref: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Customer Name</label>
                  <input className="form-input" placeholder="Walk-in Guest" value={newCancelForm.customer}
                    onChange={e => setNewCancelForm(p => ({ ...p, customer: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Ticket Value (₹) *</label>
                <input type="number" step="0.01" className="form-input" placeholder="0.00" value={newCancelForm.amount}
                  onChange={e => setNewCancelForm(p => ({ ...p, amount: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Cancellation Reason *</label>
                <textarea className="form-input" rows={2} placeholder="Reason for cancellation…" value={newCancelForm.reason}
                  onChange={e => setNewCancelForm(p => ({ ...p, reason: e.target.value }))} required />
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="recovered-check" checked={newCancelForm.recovered}
                  onChange={e => setNewCancelForm(p => ({ ...p, recovered: e.target.checked }))}
                  style={{ width: 16, height: 16 }} />
                <label htmlFor="recovered-check" style={{ fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  Seat was re-sold / recovered after cancellation
                </label>
              </div>
              <div className="flex gap-12" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowNewCancelModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">✅ Log Cancellation</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6 — COMP PASS */}
      {showCompModal && (
        <div className="modal-overlay" onClick={() => setShowCompModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">🎫 Issue Complimentary Pass</div>
            <form onSubmit={handleCreateCompPass}>
              <div className="form-group">
                <label className="form-label">Guest / Organisation *</label>
                <input className="form-input" placeholder="e.g. Inspector General" value={compForm.guestName}
                  onChange={e => setCompForm(p => ({ ...p, guestName: e.target.value }))} required />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Seats Count</label>
                  <input type="number" min="1" max="10" className="form-input" value={compForm.seatsCount}
                    onChange={e => setCompForm(p => ({ ...p, seatsCount: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Authorised By</label>
                  <select className="form-select" value={compForm.approvedBy}
                    onChange={e => setCompForm(p => ({ ...p, approvedBy: e.target.value }))} required>
                    <option value="MD">Managing Director (MD)</option>
                    <option value="Admin">Administrator</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Movie *</label>
                <input className="form-input" placeholder="e.g. Avatar 3" value={compForm.movie}
                  onChange={e => setCompForm(p => ({ ...p, movie: e.target.value }))} required />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Show Date *</label>
                  <input type="date" className="form-input" value={compForm.targetDate}
                    onChange={e => setCompForm(p => ({ ...p, targetDate: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Show Time *</label>
                  <input type="time" className="form-input" value={compForm.targetTime}
                    onChange={e => setCompForm(p => ({ ...p, targetTime: e.target.value }))} required />
                </div>
              </div>
              <div className="flex gap-12" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCompModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">✅ Issue Pass</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 7 — BOX OFFICE ADJUSTMENT */}
      {showAdjModal && (
        <div className="modal-overlay" onClick={() => setShowAdjModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">⚖️ Box Office Adjustment</div>
            <p className="text-xs text-muted" style={{ marginBottom: 16, lineHeight: 1.6 }}>
              Record post-transaction corrections — promo codes applied late, goodwill upgrades, or penalty fees — without voiding the original ticket.
            </p>
            <form onSubmit={handleCreateAdjustment}>
              <div className="form-group">
                <label className="form-label">Affected Booking Ref *</label>
                <input className="form-input" placeholder="e.g. BK-POS-9812" value={adjForm.bookingRef}
                  onChange={e => setAdjForm(p => ({ ...p, bookingRef: e.target.value }))} required />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Adjustment Type</label>
                  <select className="form-select" value={adjForm.adjustmentType}
                    onChange={e => setAdjForm(p => ({ ...p, adjustmentType: e.target.value }))}>
                    <option value="ADDITION">Addition (Credit)</option>
                    <option value="DEDUCTION">Deduction (Promo / Discount)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Amount (₹) *</label>
                  <input type="number" step="0.01" className="form-input" value={adjForm.amount}
                    onChange={e => setAdjForm(p => ({ ...p, amount: e.target.value }))} required />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Reason *</label>
                <textarea className="form-input" rows={3} placeholder="State the operational reason…" value={adjForm.reason}
                  onChange={e => setAdjForm(p => ({ ...p, reason: e.target.value }))} required />
              </div>
              <div className="flex gap-12" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdjModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">✅ Apply Adjustment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
