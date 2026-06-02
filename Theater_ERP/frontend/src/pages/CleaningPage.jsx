import { useState } from 'react';
import toast from 'react-hot-toast';

export default function CleaningPage() {
  const [tasks, setTasks] = useState([
    { id: 1, area: 'Screen 1', task: 'Between-show cleanup (Popcorn/Trash)', assignedTo: 'Raju', status: 'COMPLETED', shift: 'Morning', time: '11:45 AM' },
    { id: 2, area: 'Lobby', task: 'Floor Mopping & Sanitization', assignedTo: 'Geetha', status: 'IN_PROGRESS', shift: 'Morning', time: '12:30 PM' },
    { id: 3, area: 'Washrooms', task: 'Deep Clean & Refill dispensers', assignedTo: 'Suresh', status: 'PENDING', shift: 'Afternoon', time: '02:00 PM' },
    { id: 4, area: 'Screen 2', task: 'End-of-day Deep Clean', assignedTo: 'Raju', status: 'PENDING', shift: 'Night', time: '11:30 PM' },
  ]);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ area: 'Screen 1', task: '', assignedTo: '', shift: 'Morning', time: '' });

  const handleCreate = (e) => {
    e.preventDefault();
    const newTask = {
      id: Date.now(),
      ...form,
      status: 'PENDING'
    };
    setTasks([newTask, ...tasks]);
    toast.success('Cleaning task assigned!');
    setShowModal(false);
    setForm({ area: 'Screen 1', task: '', assignedTo: '', shift: 'Morning', time: '' });
  };

  const markStatus = (id, newStatus) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, status: newStatus } : t));
    toast.success(`Task marked as ${newStatus}`);
  };

  return (
    <div>
      {/* PAGE HEADER */}
      <div className="page-header">
        <div>
          <h1 className="page-title">🧹 Cleaning & Housekeeping</h1>
          <p className="page-subtitle">Track staff duties, between-show cleanups, and deep cleaning schedules.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + Assign Duty
          </button>
        </div>
      </div>

      {/* KPI METRICS */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div className="kpi-card" style={{ flex: 1, padding: '14px 18px' }}>
          <div className="kpi-label">Pending Duties</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--warning)', marginTop: 4 }}>
            {tasks.filter(t => t.status === 'PENDING').length}
          </div>
        </div>
        <div className="kpi-card" style={{ flex: 1, padding: '14px 18px' }}>
          <div className="kpi-label">Completed Today</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--success)', marginTop: 4 }}>
            {tasks.filter(t => t.status === 'COMPLETED').length}
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Area / Zone</th>
              <th>Task Description</th>
              <th>Assigned Staff</th>
              <th>Shift & Time</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map(t => (
              <tr key={t.id}>
                <td><strong>{t.area}</strong></td>
                <td>{t.task}</td>
                <td>{t.assignedTo}</td>
                <td className="text-muted text-xs">{t.shift} - {t.time}</td>
                <td>
                  <span className={`badge ${t.status === 'COMPLETED' ? 'badge-success' : t.status === 'IN_PROGRESS' ? 'badge-info' : 'badge-warning'}`}>
                    {t.status}
                  </span>
                </td>
                <td>
                  {t.status === 'PENDING' && (
                    <button className="btn btn-sm btn-secondary" onClick={() => markStatus(t.id, 'IN_PROGRESS')}>Start</button>
                  )}
                  {t.status === 'IN_PROGRESS' && (
                    <button className="btn btn-sm" style={{ background: 'var(--success)', color: '#000' }} onClick={() => markStatus(t.id, 'COMPLETED')}>Finish</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">🧹 Assign Cleaning Duty</div>
            <form onSubmit={handleCreate}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Area / Zone</label>
                  <select className="form-select" value={form.area} onChange={e => setForm({...form, area: e.target.value})}>
                    <option value="Screen 1">Screen 1</option>
                    <option value="Screen 2">Screen 2</option>
                    <option value="Lobby">Lobby</option>
                    <option value="Washrooms">Washrooms</option>
                    <option value="Box Office">Box Office</option>
                    <option value="Cafeteria">Cafeteria / Concession</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Shift</label>
                  <select className="form-select" value={form.shift} onChange={e => setForm({...form, shift: e.target.value})}>
                    <option value="Morning">Morning</option>
                    <option value="Afternoon">Afternoon</option>
                    <option value="Evening">Evening</option>
                    <option value="Night">Night</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Task Description</label>
                <input type="text" className="form-input" placeholder="e.g. Clean popcorn from seats" required value={form.task} onChange={e => setForm({...form, task: e.target.value})} />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Assigned Staff Name</label>
                  <input type="text" className="form-input" required value={form.assignedTo} onChange={e => setForm({...form, assignedTo: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Scheduled Time</label>
                  <input type="time" className="form-input" required value={form.time} onChange={e => setForm({...form, time: e.target.value})} />
                </div>
              </div>
              <div className="flex gap-12" style={{ justifyContent: 'flex-end', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Assign Task</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
