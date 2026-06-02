import { useState } from 'react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function ExpensePage() {
  const [activeTab, setActiveTab] = useState('petty'); // petty, bata, publicity, vpf

  // Static registers for UI
  const [pettyExpenses, setPettyExpenses] = useState([
    { id: 1, date: '2026-06-01', description: 'Stationery for box office', amount: 450, approvedBy: 'Manager' },
    { id: 2, date: '2026-06-02', description: 'Snacks for audit team', amount: 850, approvedBy: 'MD' },
  ]);

  const [bataPayments, setBataPayments] = useState([
    { id: 1, date: '2026-06-01', representative: 'Ramesh (Disney Star)', movie: 'Avatar 3', days: 2, dailyRate: 500, amount: 1000 },
    { id: 2, date: '2026-06-02', representative: 'Suresh (YRF)', movie: 'Pathaan 2', days: 1, dailyRate: 500, amount: 500 },
  ]);

  const [publicity, setPublicity] = useState([
    { id: 1, date: '2026-05-28', description: 'Flex Boards (City Center)', movie: 'Avatar 3', amount: 5500, vendor: 'ABC Printers' },
    { id: 2, date: '2026-05-30', description: 'Local Auto Announcements', movie: 'Pathaan 2', amount: 2500, vendor: 'Sound Ads' },
  ]);

  const [vpfShares, setVpfShares] = useState([
    { id: 1, date: '2026-05-30', movie: 'Avatar 3', provider: 'Qube Cinema', showCount: 28, ratePerShow: 400, amount: 11200, status: 'PAID' },
    { id: 2, date: '2026-06-01', movie: 'Pathaan 2', provider: 'UFO Moviez', showCount: 14, ratePerShow: 350, amount: 4900, status: 'PENDING' },
  ]);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({});

  const handleCreate = (e) => {
    e.preventDefault();
    if (activeTab === 'petty') {
      setPettyExpenses([{ id: Date.now(), date: format(new Date(), 'yyyy-MM-dd'), ...form }, ...pettyExpenses]);
      toast.success('Petty expense recorded!');
    } else if (activeTab === 'bata') {
      const amount = (form.days || 1) * (form.dailyRate || 500);
      setBataPayments([{ id: Date.now(), date: format(new Date(), 'yyyy-MM-dd'), ...form, amount }, ...bataPayments]);
      toast.success('Representative Bata recorded!');
    } else if (activeTab === 'publicity') {
      setPublicity([{ id: Date.now(), date: format(new Date(), 'yyyy-MM-dd'), ...form }, ...publicity]);
      toast.success('Publicity expense recorded!');
    } else if (activeTab === 'vpf') {
      const amount = (form.showCount || 0) * (form.ratePerShow || 0);
      setVpfShares([{ id: Date.now(), date: format(new Date(), 'yyyy-MM-dd'), ...form, amount, status: 'PENDING' }, ...vpfShares]);
      toast.success('VPF Share recorded!');
    }
    setShowModal(false);
    setForm({});
  };

  return (
    <div>
      {/* PAGE HEADER */}
      <div className="page-header">
        <div>
          <h1 className="page-title">💸 Expenses & Outflows</h1>
          <p className="page-subtitle">Manage petty expenses, representative bata, publicity, and VPF shares.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + Log New Entry
          </button>
        </div>
      </div>

      {/* TABS */}
      <div className="tab-container" style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', marginBottom: '24px', paddingBottom: '8px' }}>
        <button className={`tab-btn ${activeTab === 'petty' ? 'active' : ''}`} onClick={() => setActiveTab('petty')}>📝 Petty Expense</button>
        <button className={`tab-btn ${activeTab === 'bata' ? 'active' : ''}`} onClick={() => setActiveTab('bata')}>🤝 Representative Bata</button>
        <button className={`tab-btn ${activeTab === 'publicity' ? 'active' : ''}`} onClick={() => setActiveTab('publicity')}>📣 Publicity Payment</button>
        <button className={`tab-btn ${activeTab === 'vpf' ? 'active' : ''}`} onClick={() => setActiveTab('vpf')}>📽️ VPF Share</button>
      </div>

      {/* CONTENT */}
      {activeTab === 'petty' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Approved By</th>
                <th>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {pettyExpenses.map(p => (
                <tr key={p.id}>
                  <td>{p.date}</td>
                  <td>{p.description}</td>
                  <td><span className="badge badge-info">{p.approvedBy}</span></td>
                  <td><strong style={{ color: 'var(--error)' }}>₹{p.amount.toLocaleString('en-IN')}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'bata' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Representative Name</th>
                <th>Movie</th>
                <th>Days x Rate</th>
                <th>Total Bata (₹)</th>
              </tr>
            </thead>
            <tbody>
              {bataPayments.map(b => (
                <tr key={b.id}>
                  <td>{b.date}</td>
                  <td><strong>{b.representative}</strong></td>
                  <td>{b.movie}</td>
                  <td>{b.days} days @ ₹{b.dailyRate}</td>
                  <td><strong style={{ color: 'var(--error)' }}>₹{b.amount.toLocaleString('en-IN')}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'publicity' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Movie</th>
                <th>Vendor / Agency</th>
                <th>Description</th>
                <th>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {publicity.map(p => (
                <tr key={p.id}>
                  <td>{p.date}</td>
                  <td><strong>{p.movie}</strong></td>
                  <td>{p.vendor}</td>
                  <td>{p.description}</td>
                  <td><strong style={{ color: 'var(--error)' }}>₹{p.amount.toLocaleString('en-IN')}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'vpf' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Service Provider</th>
                <th>Movie</th>
                <th>Shows x Rate</th>
                <th>Amount (₹)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {vpfShares.map(v => (
                <tr key={v.id}>
                  <td>{v.date}</td>
                  <td><strong>{v.provider}</strong></td>
                  <td>{v.movie}</td>
                  <td>{v.showCount} @ ₹{v.ratePerShow}</td>
                  <td><strong style={{ color: 'var(--error)' }}>₹{v.amount.toLocaleString('en-IN')}</strong></td>
                  <td><span className={`badge ${v.status === 'PAID' ? 'badge-success' : 'badge-warning'}`}>{v.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">✚ Log {activeTab === 'petty' ? 'Petty Expense' : activeTab === 'bata' ? 'Representative Bata' : activeTab === 'publicity' ? 'Publicity Expense' : 'VPF Share'}</div>
            <form onSubmit={handleCreate}>
              
              {activeTab === 'petty' && (
                <>
                  <div className="form-group"><label className="form-label">Description</label><input type="text" className="form-input" required onChange={e => setForm({...form, description: e.target.value})} /></div>
                  <div className="form-group"><label className="form-label">Amount (₹)</label><input type="number" className="form-input" required onChange={e => setForm({...form, amount: parseFloat(e.target.value)})} /></div>
                  <div className="form-group"><label className="form-label">Approved By</label><input type="text" className="form-input" required onChange={e => setForm({...form, approvedBy: e.target.value})} /></div>
                </>
              )}

              {activeTab === 'bata' && (
                <>
                  <div className="form-group"><label className="form-label">Representative Name</label><input type="text" className="form-input" required onChange={e => setForm({...form, representative: e.target.value})} /></div>
                  <div className="form-group"><label className="form-label">Movie</label><input type="text" className="form-input" required onChange={e => setForm({...form, movie: e.target.value})} /></div>
                  <div className="grid-2">
                    <div className="form-group"><label className="form-label">No. of Days</label><input type="number" className="form-input" required onChange={e => setForm({...form, days: parseInt(e.target.value)})} /></div>
                    <div className="form-group"><label className="form-label">Daily Rate (₹)</label><input type="number" className="form-input" required onChange={e => setForm({...form, dailyRate: parseFloat(e.target.value)})} /></div>
                  </div>
                </>
              )}

              {activeTab === 'publicity' && (
                <>
                  <div className="form-group"><label className="form-label">Movie</label><input type="text" className="form-input" required onChange={e => setForm({...form, movie: e.target.value})} /></div>
                  <div className="form-group"><label className="form-label">Vendor / Agency</label><input type="text" className="form-input" required onChange={e => setForm({...form, vendor: e.target.value})} /></div>
                  <div className="form-group"><label className="form-label">Description</label><input type="text" className="form-input" required onChange={e => setForm({...form, description: e.target.value})} /></div>
                  <div className="form-group"><label className="form-label">Amount (₹)</label><input type="number" className="form-input" required onChange={e => setForm({...form, amount: parseFloat(e.target.value)})} /></div>
                </>
              )}

              {activeTab === 'vpf' && (
                <>
                  <div className="form-group"><label className="form-label">Service Provider</label><input type="text" className="form-input" required onChange={e => setForm({...form, provider: e.target.value})} /></div>
                  <div className="form-group"><label className="form-label">Movie</label><input type="text" className="form-input" required onChange={e => setForm({...form, movie: e.target.value})} /></div>
                  <div className="grid-2">
                    <div className="form-group"><label className="form-label">Total Shows</label><input type="number" className="form-input" required onChange={e => setForm({...form, showCount: parseInt(e.target.value)})} /></div>
                    <div className="form-group"><label className="form-label">Rate per Show (₹)</label><input type="number" className="form-input" required onChange={e => setForm({...form, ratePerShow: parseFloat(e.target.value)})} /></div>
                  </div>
                </>
              )}

              <div className="flex gap-12" style={{ justifyContent: 'flex-end', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Entry</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
