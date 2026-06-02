import { useState } from 'react';
import toast from 'react-hot-toast';

export default function InventoryPage() {
  const [items, setItems] = useState([
    { id: 1, name: 'Ticket Rolls', category: 'Consumables', quantity: 45, unit: 'Rolls', minStock: 20, lastRestocked: '2026-05-15' },
    { id: 2, name: 'Cleaning Liquid', category: 'Housekeeping', quantity: 12, unit: 'Liters', minStock: 15, lastRestocked: '2026-05-10' },
    { id: 3, name: 'Air Freshener Refills', category: 'Housekeeping', quantity: 8, unit: 'Units', minStock: 10, lastRestocked: '2026-05-12' },
    { id: 4, name: 'Printer Ink Cartridges', category: 'Office Supplies', quantity: 4, unit: 'Units', minStock: 3, lastRestocked: '2026-04-20' },
  ]);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'Consumables', quantity: 0, unit: 'Units', minStock: 0 });

  const handleCreate = (e) => {
    e.preventDefault();
    const newItem = {
      id: Date.now(),
      name: form.name,
      category: form.category,
      quantity: form.quantity,
      unit: form.unit,
      minStock: form.minStock,
      lastRestocked: new Date().toISOString().split('T')[0]
    };
    setItems([newItem, ...items]);
    toast.success('Inventory item added successfully!');
    setShowModal(false);
    setForm({ name: '', category: 'Consumables', quantity: 0, unit: 'Units', minStock: 0 });
  };

  return (
    <div>
      {/* PAGE HEADER */}
      <div className="page-header">
        <div>
          <h1 className="page-title">📦 Inventory Management</h1>
          <p className="page-subtitle">Track theater consumables, office supplies, and housekeeping stock.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + Add New Item
          </button>
        </div>
      </div>

      {/* KPI METRICS */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div className="kpi-card" style={{ flex: 1, padding: '14px 18px' }}>
          <div className="kpi-label">Total Items Tracked</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>{items.length}</div>
        </div>
        <div className="kpi-card" style={{ flex: 1, padding: '14px 18px', border: '1px solid rgba(239,68,68,0.3)' }}>
          <div className="kpi-label">Low Stock Alerts</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--error)', marginTop: 4 }}>
            {items.filter(i => i.quantity <= i.minStock).length}
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Item Name</th>
              <th>Category</th>
              <th>Current Stock</th>
              <th>Min. Stock Level</th>
              <th>Last Restocked</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => {
              const isLowStock = item.quantity <= item.minStock;
              return (
                <tr key={item.id}>
                  <td><strong>{item.name}</strong></td>
                  <td><span className="badge badge-neutral">{item.category}</span></td>
                  <td><strong style={{ color: isLowStock ? 'var(--error)' : 'var(--success)' }}>{item.quantity} {item.unit}</strong></td>
                  <td>{item.minStock} {item.unit}</td>
                  <td className="text-muted text-xs">{item.lastRestocked}</td>
                  <td>
                    {isLowStock ? (
                      <span className="badge badge-error">Reorder Needed</span>
                    ) : (
                      <span className="badge badge-success">Sufficient</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">📦 Add Inventory Item</div>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Item Name</label>
                <input type="text" className="form-input" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-select" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                    <option value="Consumables">Consumables</option>
                    <option value="Housekeeping">Housekeeping</option>
                    <option value="Office Supplies">Office Supplies</option>
                    <option value="F&B Base">F&B Base</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Unit of Measurement</label>
                  <input type="text" className="form-input" placeholder="e.g. Rolls, Liters, Units" required value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Initial Quantity</label>
                  <input type="number" className="form-input" required value={form.quantity} onChange={e => setForm({...form, quantity: parseInt(e.target.value)})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Minimum Stock Alert</label>
                  <input type="number" className="form-input" required value={form.minStock} onChange={e => setForm({...form, minStock: parseInt(e.target.value)})} />
                </div>
              </div>
              <div className="flex gap-12" style={{ justifyContent: 'flex-end', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Item</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
