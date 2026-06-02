import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { revenueAPI, screensAPI } from '../api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const TODAY = format(new Date(), 'yyyy-MM-dd');

export default function AdvertisingPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('on-screen'); // on-screen, off-screen

  // On-Screen State
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ show: '', slot_type: 'PRE_SHOW', advertiser_name: '', duration_seconds: 30, amount: '', invoice_number: '' });
  
  // Off-Screen State (Static fallback for new module)
  const [offScreenLogs, setOffScreenLogs] = useState([
    { id: 1, type: 'POSTER', location: 'Main Lobby', advertiser: 'Coca Cola', startDate: '2026-06-01', endDate: '2026-06-30', amount: 15000 },
    { id: 2, type: 'PROMOTION_STALL', location: 'Entrance', advertiser: 'Hyundai', startDate: '2026-06-05', endDate: '2026-06-07', amount: 25000 },
  ]);
  const [showOffScreenForm, setShowOffScreenForm] = useState(false);
  const [offScreenForm, setOffScreenForm] = useState({ type: 'POSTER', location: '', advertiser: '', startDate: TODAY, endDate: TODAY, amount: 0 });

  // Queries
  const { data, isLoading } = useQuery({ queryKey: ['ad-slots'], queryFn: () => revenueAPI.adSlots().then(r => r.data) });
  const { data: shows } = useQuery({ queryKey: ['shows'], queryFn: () => screensAPI.shows().then(r => r.data) });
  
  const mutation = useMutation({
    mutationFn: d => revenueAPI.createAdSlot(d),
    onSuccess: () => { qc.invalidateQueries(['ad-slots']); toast.success('Ad slot recorded!'); setShowForm(false); },
    onError: () => toast.error('Failed'),
  });

  const handleCreateOffScreen = (e) => {
    e.preventDefault();
    const newLog = {
      id: Date.now(),
      ...offScreenForm,
      amount: parseFloat(offScreenForm.amount)
    };
    setOffScreenLogs([newLog, ...offScreenLogs]);
    toast.success('Off-screen advertising recorded!');
    setShowOffScreenForm(false);
    setOffScreenForm({ type: 'POSTER', location: '', advertiser: '', startDate: TODAY, endDate: TODAY, amount: 0 });
  };

  const records = data?.results || data || [];
  const showList = shows?.results || shows || [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">📺 Advertising Revenue</h1>
          <p className="page-subtitle">Track on-screen ad slots and off-screen promotional spaces.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {activeTab === 'on-screen' && (
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add Ad Slot</button>
          )}
          {activeTab === 'off-screen' && (
            <button className="btn btn-primary" onClick={() => setShowOffScreenForm(true)}>+ Add Off-Screen Ad</button>
          )}
        </div>
      </div>

      {/* TABS */}
      <div className="tab-container" style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', marginBottom: '24px', paddingBottom: '8px' }}>
        <button className={`tab-btn ${activeTab === 'on-screen' ? 'active' : ''}`} onClick={() => setActiveTab('on-screen')}>📽️ On-Screen Ads</button>
        <button className={`tab-btn ${activeTab === 'off-screen' ? 'active' : ''}`} onClick={() => setActiveTab('off-screen')}>🖼️ Off-Screen / Promotions</button>
      </div>

      {/* ON-SCREEN CONTENT */}
      {activeTab === 'on-screen' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table">
            <thead><tr><th>Show</th><th>Slot</th><th>Advertiser</th><th>Duration</th><th>Amount</th><th>Invoice</th></tr></thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} className="loading-cell">Loading...</td></tr>}
              {!isLoading && records.length === 0 && <tr><td colSpan={6} className="loading-cell">No ad slots recorded.</td></tr>}
              {records.map(r => (
                <tr key={r.id}>
                  <td className="text-sm">{r.show_info}</td>
                  <td><span className={`badge ${r.slot_type === 'PRE_SHOW' ? 'badge-info' : 'badge-warning'}`}>{r.slot_type.replace('_', ' ')}</span></td>
                  <td><strong>{r.advertiser_name}</strong></td>
                  <td>{r.duration_seconds}s</td>
                  <td><strong style={{ color: 'var(--success)' }}>₹{parseFloat(r.amount).toLocaleString('en-IN')}</strong></td>
                  <td className="text-muted">{r.invoice_number || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* OFF-SCREEN CONTENT */}
      {activeTab === 'off-screen' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Advertiser</th>
                <th>Location</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Revenue (₹)</th>
              </tr>
            </thead>
            <tbody>
              {offScreenLogs.map(log => (
                <tr key={log.id}>
                  <td><span className="badge badge-neutral">{log.type.replace('_', ' ')}</span></td>
                  <td><strong>{log.advertiser}</strong></td>
                  <td>{log.location}</td>
                  <td>{log.startDate}</td>
                  <td>{log.endDate}</td>
                  <td><strong style={{ color: 'var(--success)' }}>₹{log.amount.toLocaleString('en-IN')}</strong></td>
                </tr>
              ))}
              {offScreenLogs.length === 0 && (
                <tr><td colSpan={6} className="loading-cell">No off-screen advertising recorded.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ON-SCREEN MODAL */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">📺 Record On-Screen Ad Slot</div>
            <form onSubmit={e => { e.preventDefault(); mutation.mutate(form); }}>
              <div className="form-group"><label className="form-label">Show</label>
                <select className="form-select" value={form.show} onChange={e => setForm(p => ({ ...p, show: e.target.value }))} required>
                  <option value="">Select Show</option>
                  {showList.map(s => <option key={s.id} value={s.id}>{s.movie_title} · {s.show_date} · {s.screen_name}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Slot Type</label>
                <select className="form-select" value={form.slot_type} onChange={e => setForm(p => ({ ...p, slot_type: e.target.value }))}>
                  <option value="PRE_SHOW">Pre-Show</option>
                  <option value="INTERVAL">Interval</option>
                </select>
              </div>
              <div className="form-group"><label className="form-label">Advertiser Name</label><input className="form-input" value={form.advertiser_name} onChange={e => setForm(p => ({ ...p, advertiser_name: e.target.value }))} required /></div>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">Duration (sec)</label><input type="number" className="form-input" value={form.duration_seconds} onChange={e => setForm(p => ({ ...p, duration_seconds: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Amount (₹)</label><input type="number" step="0.01" className="form-input" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} required /></div>
                <div className="form-group"><label className="form-label">Invoice #</label><input className="form-input" value={form.invoice_number} onChange={e => setForm(p => ({ ...p, invoice_number: e.target.value }))} /></div>
              </div>
              <div className="flex gap-12" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OFF-SCREEN MODAL */}
      {showOffScreenForm && (
        <div className="modal-overlay" onClick={() => setShowOffScreenForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">🖼️ Record Off-Screen Advertising</div>
            <form onSubmit={handleCreateOffScreen}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Ad Type</label>
                  <select className="form-select" value={offScreenForm.type} onChange={e => setOffScreenForm(p => ({ ...p, type: e.target.value }))}>
                    <option value="POSTER">Poster / Standee</option>
                    <option value="PROMOTION_STALL">Promotion Stall</option>
                    <option value="BANNERS">Banners</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Advertiser Name</label><input className="form-input" value={offScreenForm.advertiser} onChange={e => setOffScreenForm(p => ({ ...p, advertiser: e.target.value }))} required /></div>
              </div>
              <div className="form-group"><label className="form-label">Location in Premises</label><input className="form-input" placeholder="e.g. Lobby, Entrance" value={offScreenForm.location} onChange={e => setOffScreenForm(p => ({ ...p, location: e.target.value }))} required /></div>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">Start Date</label><input type="date" className="form-input" value={offScreenForm.startDate} onChange={e => setOffScreenForm(p => ({ ...p, startDate: e.target.value }))} required /></div>
                <div className="form-group"><label className="form-label">End Date</label><input type="date" className="form-input" value={offScreenForm.endDate} onChange={e => setOffScreenForm(p => ({ ...p, endDate: e.target.value }))} required /></div>
              </div>
              <div className="form-group"><label className="form-label">Revenue Amount (₹)</label><input type="number" step="0.01" className="form-input" value={offScreenForm.amount} onChange={e => setOffScreenForm(p => ({ ...p, amount: e.target.value }))} required /></div>
              <div className="flex gap-12" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowOffScreenForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Entry</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
