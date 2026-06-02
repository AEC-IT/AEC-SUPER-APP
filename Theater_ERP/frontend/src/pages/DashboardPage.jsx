import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsAPI, screensAPI, integrationsAPI, operationsAPI } from '../api';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import AIReportWidget from '../components/AIReportWidget';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [filterDate, setFilterDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data: daily, isLoading: loadingDaily } = useQuery({
    queryKey: ['daily-pl', filterDate],
    queryFn: () => reportsAPI.dailyPL(filterDate).then(r => r.data),
  });

  const { data: alertsData } = useQuery({
    queryKey: ['alerts', filterDate],
    queryFn: () => reportsAPI.alerts(filterDate).then(r => r.data),
    refetchInterval: 60000,
  });

  const { data: dcrData } = useQuery({
    queryKey: ['dcrs-dashboard', filterDate],
    queryFn: () => integrationsAPI.dcrList({ report_date: filterDate }).then(r => r.data),
    enabled: !!user?.active_modules?.includes('DISTRICT_BRIDGE'),
  });

  // Lamp life data
  const { data: lampAssets } = useQuery({
    queryKey: ['lamp-assets-dashboard'],
    queryFn: () => operationsAPI.tenantAssets.list({ template__category__key: 'LAMP', is_active: true })
                    .then(r => r.data?.results ?? r.data),
    staleTime: 5 * 60 * 1000, // cache 5 min
    enabled: !!user?.active_modules?.includes('LAMP_REGISTRY'),
  });
  const lamps = Array.isArray(lampAssets) ? lampAssets : [];
  // Most critical lamp = lowest life % remaining
  const criticalLamp = lamps.length > 0
    ? lamps.reduce((min, l) => parseFloat(l.life_percentage ?? 100) < parseFloat(min.life_percentage ?? 100) ? l : min)
    : null;

  const dcrs = dcrData?.results || dcrData || [];
  const totalDCRs = dcrs.length;
  const mismatchDCRs = dcrs.filter(d => d.mismatch_flag).length;

  // Acknowledge alert helper
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState(() => {
    const saved = localStorage.getItem('acknowledgedAlerts');
    return saved ? JSON.parse(saved) : {};
  });

  const handleAcknowledgeAlert = (key) => {
    const updated = { ...acknowledgedAlerts, [key]: true };
    setAcknowledgedAlerts(updated);
    localStorage.setItem('acknowledgedAlerts', JSON.stringify(updated));
    toast.success('Alert acknowledged successfully.');
  };

  const income = daily ? (daily.income?.total ?? 0) : 0;
  const expenses = daily ? (daily.expenses?.total ?? 0) : 0;
  const net = daily ? (daily.net_profit ?? 0) : 0;
  const isProfit = net >= 0;

  // Aggregate alerts
  const dynamicAlerts = [
    ...(alertsData?.daily_alerts || []),
    ...(alertsData?.lamp_alerts || [])
  ].map((a, idx) => ({
    key: `dynamic_${a.type}_${idx}`,
    severity: a.severity || 'warning',
    type: a.type,
    message: a.message
  }));

  const allAlerts = dynamicAlerts.filter(a => !acknowledgedAlerts[a.key]);

  const handleExportSummary = () => {
    const csvContent = "data:text/csv;charset=utf-8,Metric,Value\nRevenue," + income + "\nExpenses," + expenses + "\nNet," + net;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Executive_Summary_${filterDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Executive dashboard summary for ${filterDate} exported as CSV.`);
  };

  return (
    <div>
      {/* 1. PAGE HEADER & DATE FILTER */}
      <div className="page-header flex-between" style={{ flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">👑 Executive Suite Dashboard</h1>
          <p className="page-subtitle">Unified Cinema Intelligence Master Dashboard.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <input 
            type="date" 
            className="form-input" 
            style={{ width: '180px' }} 
            value={filterDate} 
            onChange={e => setFilterDate(e.target.value)} 
          />
          <button className="btn btn-secondary" onClick={handleExportSummary}>⬇️ Export Summary</button>
        </div>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <AIReportWidget moduleCode="EXECUTIVE" defaultPeriod="DAILY" />
      </div>

      {/* 2. ALERT CENTER SECTION */}
      {allAlerts.length > 0 && (
        <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="text-xs text-muted font-semibold" style={{ letterSpacing: '1px', textTransform: 'uppercase' }}>
            🚨 OPEN ALERTS CENTER ({allAlerts.length})
          </div>
          {allAlerts.map((alert) => (
            <div key={alert.key} className={`alert-card ${alert.severity === 'warning' ? 'warning' : ''}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ fontSize: '20px' }}>{alert.severity === 'critical' ? '🚨' : '⚠️'}</div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: alert.severity === 'critical' ? 'var(--error)' : 'var(--warning)' }}>
                    {alert.type.replace(/_/g, ' ')}
                  </div>
                  <div className="text-sm text-secondary" style={{ marginTop: '2px' }}>{alert.message}</div>
                </div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => handleAcknowledgeAlert(alert.key)}>Acknowledge</button>
            </div>
          ))}
        </div>
      )}

      {/* 3. CORE FIELD KPI CARDS */}
      <div className="grid-3" style={{ marginBottom: '24px', gap: '16px' }}>

        {/* KPI: Today Revenue */}
        <div className="kpi-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/reports')}>
          <div className="kpi-label">💰 Today Revenue</div>
          <div className="kpi-value" style={{ color: 'var(--success)' }}>₹{income.toLocaleString('en-IN')}</div>
          <div className="text-xs text-muted mt-2">
            {user?.active_modules?.includes('BOOKINGS') ? 'Box office + Cafe + Ads' : 'Concession Cafe Confectioneries'}
          </div>
        </div>

        {/* KPI: Today Expense */}
        <div className="kpi-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/reports')}>
          <div className="kpi-label">📉 Today Expense</div>
          <div className="kpi-value" style={{ color: 'var(--error)' }}>₹{expenses.toLocaleString('en-IN')}</div>
          <div className="text-xs text-muted mt-2">
            {user?.active_modules?.includes('BOOKINGS') ? 'Power + Fuel + Distributors + Wages' : 'Cafe Stock Purchases + Staff wages'}
          </div>
        </div>

        {/* KPI: Net Profit/Loss */}
        <div className="kpi-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/reports')}>
          <div className="kpi-label">⚖️ Net Profit / Loss</div>
          <div className="kpi-value" style={{ color: isProfit ? 'var(--success)' : 'var(--error)' }}>
            {isProfit ? '+' : '-'}₹{Math.abs(net).toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-muted mt-2">{isProfit ? 'Profitable operation' : 'Net operating deficit'}</div>
        </div>

        {/* KPI: Tickets Sold */}
        {user?.active_modules?.includes('BOOKINGS') && (
          <div className="kpi-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/bookings')}>
            <div className="kpi-label">🎟️ Tickets Sold</div>
            <div className="kpi-value">{daily?.tickets_sold ?? 0} tickets</div>
            <div className="text-xs text-muted mt-2">Counter and online bookings combined</div>
          </div>
        )}

        {/* KPI: Occupancy */}
        {user?.active_modules?.includes('BOOKINGS') && (
          <div className="kpi-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/shows')}>
            <div className="kpi-label">👥 Seating Occupancy</div>
            <div className="kpi-value">{(daily?.occupancy_percent ?? 0).toFixed(1)} %</div>
            <div className="text-xs text-muted mt-2">Average capacity filled today</div>
          </div>
        )}

        {/* KPI: District DCR */}
        {user?.active_modules?.includes('DISTRICT_BRIDGE') && (
          <div className="kpi-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/integrations/dcr')}>
            <div className="kpi-label">📊 District DCR Reports</div>
            <div className="kpi-value" style={{ fontSize: '24px', marginTop: '8px' }}>{totalDCRs} Ingested</div>
            <div className="text-xs text-muted mt-2">
              {mismatchDCRs > 0 ? `⚠️ ${mismatchDCRs} mismatch alerts pending` : '✅ All reports verified & synced'}
            </div>
          </div>
        )}

        {/* KPI: Utility Summary */}
        {user?.active_modules?.includes('OPERATIONS') && (
          <div className="kpi-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/electricity')}>
            <div className="kpi-label">⚡ Utility Cost Summary</div>
            <div className="kpi-value">
              ₹{((daily?.expenses?.electricity ?? 0) + (daily?.expenses?.diesel ?? 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-muted mt-2">Electricity meter tariff + Diesel fuel</div>
          </div>
        )}

        {/* KPI: Projection Lamp Life */}
        {user?.active_modules?.includes('LAMP_REGISTRY') && (
          <div
            className="kpi-card"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/lamps')}
          >
            <div className="kpi-label">💡 Projection Lamp Life</div>

            {lamps.length === 0 && (
              <div className="text-xs text-muted" style={{ marginTop: 10 }}>Loading lamp data…</div>
            )}

            {lamps.map(lamp => {
              const pct = Math.min(Math.max(parseFloat(lamp.life_percentage ?? 0), 0), 100);
              const remaining = Math.round(parseFloat(lamp.remaining_hours ?? 0));
              const color = pct < 10 ? 'var(--error)' : pct < 30 ? 'var(--warning)' : 'var(--success)';
              const label = lamp.asset_name
                .replace('Screen 2 \u2013 Barco DP4K-19B ', 'S2 \u2013 ')
                .replace('Screen 1 \u2013 ', 'S1 \u2013 ');
              return (
                <div key={lamp.id} style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</span>
                    <span style={{ fontSize: 11, color, fontWeight: 700 }}>{pct.toFixed(0)}% · {remaining.toLocaleString('en-IN')}h</span>
                  </div>
                  <div style={{ width: '100%', height: 7, borderRadius: 99, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                    <div style={{
                      width: `${pct}%`, height: '100%', borderRadius: 99,
                      background: color, transition: 'width 0.6s ease',
                      boxShadow: pct < 30 ? `0 0 8px ${color}88` : 'none'
                    }} />
                  </div>
                </div>
              );
            })}

            {criticalLamp && (
              <div className="text-xs text-muted" style={{ marginTop: 12 }}>
                {parseFloat(criticalLamp.life_percentage) < 30
                  ? `\u26a0\ufe0f ${criticalLamp.asset_name.split('\u2013').pop()?.trim()} needs attention`
                  : '\u2705 All lamps within safe operating range'}
              </div>
            )}
          </div>
        )}

        {/* KPI: Pending Approvals */}
        {user?.active_modules?.includes('AUDIT') && (
          <div className="kpi-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/audit')}>
            <div className="kpi-label">⏳ Pending Approvals</div>
            <div className="kpi-value" style={{ color: 'var(--warning)' }}>3 pending</div>
            <div className="text-xs text-muted mt-2">Requires MD/Admin sign-off</div>
          </div>
        )}

        {/* KPI: Open Alerts */}
        {user?.active_modules?.includes('AUDIT') && (
          <div className="kpi-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/audit')}>
            <div className="kpi-label">⚠️ Total Open Alerts</div>
            <div className="kpi-value" style={{ color: allAlerts.length > 0 ? 'var(--error)' : 'var(--text-primary)' }}>{allAlerts.length} Active</div>
            <div className="text-xs text-muted mt-2">Unacknowledged system alerts</div>
          </div>
        )}
      </div>
    </div>
  );
}
