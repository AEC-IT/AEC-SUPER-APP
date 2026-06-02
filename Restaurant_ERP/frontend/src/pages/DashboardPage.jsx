import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { revenueAPI } from '../api';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const TODAY = format(new Date(), 'yyyy-MM-dd');

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [filterDate, setFilterDate] = useState(TODAY);

  const { data: salesData } = useQuery({
    queryKey: ['restaurant-sales', filterDate],
    queryFn: () => revenueAPI.canteenSales({ date: filterDate }).then(r => r.data),
  });

  const { data: expensesData } = useQuery({
    queryKey: ['restaurant-expenses', filterDate],
    queryFn: () => revenueAPI.cafeExpenses({ date: filterDate }).then(r => r.data),
  });

  const sales = salesData?.results || salesData || [];
  const expenses = expensesData?.results || expensesData || [];

  const totalRevenue = sales.reduce((s, r) => s + parseFloat(r.total || 0), 0);
  const totalExpenses = expenses.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
  const netProfit = totalRevenue - totalExpenses;
  const isProfit = netProfit >= 0;

  return (
    <div>
      {/* Header */}
      <div className="page-header flex-between" style={{ flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="page-title">🍽️ Restaurant Dashboard</h1>
          <p className="page-subtitle">AEC Food & Beverage — Daily Operations Overview</p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <input
            type="date"
            className="form-input"
            style={{ width: 180 }}
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid-3" style={{ marginBottom: 24, gap: 16 }}>
        <div className="kpi-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/cafe')}>
          <div className="kpi-label">💰 Today's Revenue</div>
          <div className="kpi-value" style={{ color: 'var(--success)' }}>
            ₹{totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-muted mt-2">All counter sales for {filterDate}</div>
        </div>

        <div className="kpi-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/cafe')}>
          <div className="kpi-label">📉 Today's Purchases</div>
          <div className="kpi-value" style={{ color: 'var(--error)' }}>
            ₹{totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-muted mt-2">Stock inward & inventory purchases</div>
        </div>

        <div className="kpi-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/cafe')}>
          <div className="kpi-label">⚖️ Net Profit / Loss</div>
          <div className="kpi-value" style={{ color: isProfit ? 'var(--success)' : 'var(--error)' }}>
            {isProfit ? '+' : '-'}₹{Math.abs(netProfit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-muted mt-2">{isProfit ? 'Profitable day ✅' : 'Net operating loss ⚠️'}</div>
        </div>
      </div>

      {/* Secondary KPIs */}
      <div className="grid-3" style={{ marginBottom: 24, gap: 16 }}>
        <div className="kpi-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/cafe')}>
          <div className="kpi-label">🧾 Total Transactions</div>
          <div className="kpi-value">{sales.length}</div>
          <div className="text-xs text-muted mt-2">Individual sale records today</div>
        </div>

        <div className="kpi-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/petpooja')}>
          <div className="kpi-label">🔌 Petpooja Sync</div>
          <div className="kpi-value" style={{ color: 'var(--success)', fontSize: 22 }}>Active</div>
          <div className="text-xs text-muted mt-2">POS integration connected</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">📊 Date Viewing</div>
          <div className="kpi-value" style={{ fontSize: 16 }}>
            {format(new Date(filterDate + 'T00:00:00'), 'dd MMM yyyy')}
          </div>
          <div className="text-xs text-muted mt-2">Use date picker to browse history</div>
        </div>
      </div>

      {/* Recent Sales */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>🍿 Recent Sales — {filterDate}</h3>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/cafe')}>View All →</button>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Counter</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {sales.length === 0 && <tr><td colSpan={5} className="loading-cell">No sales recorded for this date.</td></tr>}
            {sales.slice(0, 8).map(r => (
              <tr key={r.id}>
                <td><strong>{r.item_name}</strong></td>
                <td>{r.cafe_unit_name || 'Main Counter'}</td>
                <td>{r.quantity}</td>
                <td>₹{parseFloat(r.unit_price).toFixed(2)}</td>
                <td><strong style={{ color: 'var(--success)' }}>₹{parseFloat(r.total).toLocaleString('en-IN')}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
