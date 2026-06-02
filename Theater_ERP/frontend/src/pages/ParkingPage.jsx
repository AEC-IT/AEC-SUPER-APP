import { useState } from 'react';
import toast from 'react-hot-toast';

export default function ParkingPage() {
  const [logs, setLogs] = useState([
    { id: 1, date: '2026-06-02', show: 'Avatar 3 - 10:00 AM', twoWheelers: 45, fourWheelers: 12, attendant: 'Mahesh' },
    { id: 2, date: '2026-06-02', show: 'Avatar 3 - 01:30 PM', twoWheelers: 60, fourWheelers: 20, attendant: 'Suresh' },
    { id: 3, date: '2026-06-01', show: 'Pathaan 2 - 09:30 PM', twoWheelers: 85, fourWheelers: 35, attendant: 'Mahesh' },
  ]);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], show: '', twoWheelers: 0, fourWheelers: 0, attendant: '' });

  const handleCreate = (e) => {
    e.preventDefault();
    const newLog = {
      id: Date.now(),
      ...form
    };
    setLogs([newLog, ...logs]);
    toast.success('Parking log recorded!');
    setShowModal(false);
    setForm({ date: new Date().toISOString().split('T')[0], show: '', twoWheelers: 0, fourWheelers: 0, attendant: '' });
  };

  const totalTwoWheelers = logs.reduce((sum, log) => sum + log.twoWheelers, 0);
  const totalFourWheelers = logs.reduce((sum, log) => sum + log.fourWheelers, 0);

  return (
    <div>
      {/* PAGE HEADER */}
      <div className="page-header">
        <div>
          <h1 className="page-title">🚗 Parking Management</h1>
          <p className="page-subtitle">Track 2-wheeler and 4-wheeler counts per show.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + Log Show Parking
          </button>
        </div>
      </div>

      {/* KPI METRICS */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div className="kpi-card" style={{ flex: 1, padding: '14px 18px' }}>
          <div className="kpi-label">Total 2-Wheelers</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
            {totalTwoWheelers}
          </div>
        </div>
        <div className="kpi-card" style={{ flex: 1, padding: '14px 18px' }}>
          <div className="kpi-label">Total 4-Wheelers</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
            {totalFourWheelers}
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Show Details</th>
              <th>2-Wheelers</th>
              <th>4-Wheelers</th>
              <th>Attendant</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id}>
                <td>{log.date}</td>
                <td><strong>{log.show}</strong></td>
                <td>{log.twoWheelers}</td>
                <td>{log.fourWheelers}</td>
                <td>{log.attendant}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">🚗 Log Show Parking</div>
            <form onSubmit={handleCreate}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input type="date" className="form-input" required value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Show (Movie & Time)</label>
                  <input type="text" className="form-input" placeholder="e.g. Avatar 3 - 10:00 AM" required value={form.show} onChange={e => setForm({...form, show: e.target.value})} />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">2-Wheelers Count</label>
                  <input type="number" className="form-input" required value={form.twoWheelers} onChange={e => setForm({...form, twoWheelers: parseInt(e.target.value)})} />
                </div>
                <div className="form-group">
                  <label className="form-label">4-Wheelers Count</label>
                  <input type="number" className="form-input" required value={form.fourWheelers} onChange={e => setForm({...form, fourWheelers: parseInt(e.target.value)})} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Attendant Name</label>
                <input type="text" className="form-input" required value={form.attendant} onChange={e => setForm({...form, attendant: e.target.value})} />
              </div>
              <div className="flex gap-12" style={{ justifyContent: 'flex-end', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Parking Log</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
