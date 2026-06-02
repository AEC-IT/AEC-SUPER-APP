import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { operationsAPI, screensAPI } from '../api';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';

const TODAY = format(new Date(), 'yyyy-MM-dd');

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(d) {
  try { return format(parseISO(d), 'dd.MM.yy'); } catch { return d; }
}

function BalanceBar({ used, rated, countsDown }) {
  const remaining = countsDown
    ? /* last closing value is balance */ used
    : Math.max(rated - used, 0);
  const pct = rated > 0 ? Math.min((remaining / rated) * 100, 100) : 0;
  const color = pct < 10 ? '#ef4444' : pct < 30 ? '#f59e0b' : '#22c55e';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, background: 'rgba(255,255,255,0.07)', borderRadius: 99, height: 7, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, background: color, height: '100%', borderRadius: 99, transition: 'width 0.4s' }} />
      </div>
      <span style={{ fontSize: 11, color, fontWeight: 700, minWidth: 38 }}>{pct.toFixed(0)}%</span>
    </div>
  );
}

function SummaryCard({ label, value, sub, accent }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14, padding: '16px 20px', flex: 1, minWidth: 140
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent || 'var(--text-primary)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LampsPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('screen1'); // screen1 | screen2 | trend
  const [monthFilter, setMonthFilter] = useState('');    // e.g. "2026-04"
  const [showLogModal, setShowLogModal] = useState(null); // { asset, lampLabel }

  const [logForm, setLogForm] = useState({
    log_date: TODAY, opening_value: '', closing_value: '', notes: ''
  });

  // ── API Fetches ──────────────────────────────────────────────────────────
  const { data: allAssets, isLoading: assetsLoading } = useQuery({
    queryKey: ['lamp-assets'],
    queryFn: () => operationsAPI.tenantAssets.list({ template__category__key: 'LAMP' })
                    .then(r => r.data?.results ?? r.data),
  });

  const assetList = Array.isArray(allAssets) ? allAssets : [];

  // Separate by screen
  const screen1Asset = assetList.find(a => a.screen_name === 'Screen 1');
  const screen2Assets = assetList.filter(a => a.screen_name === 'Screen 2');
  const lamp1 = screen2Assets.find(a => a.serial_number === 'BAR-DP4K-S2-L1') || screen2Assets[0];
  const lamp2 = screen2Assets.find(a => a.serial_number === 'BAR-DP4K-S2-L2') || screen2Assets[1];

  // Fetch logs per asset
  const { data: s1Logs } = useQuery({
    queryKey: ['asset-logs', screen1Asset?.id],
    queryFn: () => operationsAPI.assetLogs.list({ asset: screen1Asset.id, ordering: 'log_date' })
                    .then(r => r.data?.results ?? r.data),
    enabled: !!screen1Asset,
  });

  const { data: s2L1Logs } = useQuery({
    queryKey: ['asset-logs', lamp1?.id],
    queryFn: () => operationsAPI.assetLogs.list({ asset: lamp1.id, ordering: 'log_date' })
                    .then(r => r.data?.results ?? r.data),
    enabled: !!lamp1,
  });

  const { data: s2L2Logs } = useQuery({
    queryKey: ['asset-logs', lamp2?.id],
    queryFn: () => operationsAPI.assetLogs.list({ asset: lamp2.id, ordering: 'log_date' })
                    .then(r => r.data?.results ?? r.data),
    enabled: !!lamp2,
  });

  // ── Log mutation ─────────────────────────────────────────────────────────
  const logMutation = useMutation({
    mutationFn: (d) => operationsAPI.assetLogs.create(d),
    onSuccess: () => {
      qc.invalidateQueries(['asset-logs']);
      qc.invalidateQueries(['lamp-assets']);
      toast.success('📝 Log entry saved successfully!');
      setShowLogModal(null);
      setLogForm({ log_date: TODAY, opening_value: '', closing_value: '', notes: '' });
    },
    onError: (e) => {
      const msg = e?.response?.data?.closing_value?.[0]
                || e?.response?.data?.non_field_errors?.[0]
                || 'Failed to save log.';
      toast.error(msg);
    }
  });

  // ── Filter logs by month ─────────────────────────────────────────────────
  const filterByMonth = (logs) => {
    if (!logs) return [];
    if (!monthFilter) return [...logs].sort((a, b) => a.log_date.localeCompare(b.log_date));
    return [...logs]
      .filter(l => l.log_date.startsWith(monthFilter))
      .sort((a, b) => a.log_date.localeCompare(b.log_date));
  };

  const s1Filtered = useMemo(() => filterByMonth(s1Logs), [s1Logs, monthFilter]);
  const s2L1Filtered = useMemo(() => filterByMonth(s2L1Logs), [s2L1Logs, monthFilter]);
  const s2L2Filtered = useMemo(() => filterByMonth(s2L2Logs), [s2L2Logs, monthFilter]);

  // ── Merge Screen2 logs by date (same row: Lamp1 + Lamp2) ─────────────────
  const screen2Merged = useMemo(() => {
    const byDate = {};
    (s2L1Filtered).forEach(l => {
      byDate[l.log_date] = { ...byDate[l.log_date], date: l.log_date, lamp1: l };
    });
    (s2L2Filtered).forEach(l => {
      byDate[l.log_date] = { ...byDate[l.log_date], date: l.log_date, lamp2: l };
    });
    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
  }, [s2L1Filtered, s2L2Filtered]);

  // ── Summary computations ─────────────────────────────────────────────────
  const s1Balance = screen1Asset
    ? parseFloat(screen1Asset.remaining_hours ?? 0)
    : null;
  const s1Rated = 2100; // Christie Xenon 2100H

  const s2L1Balance = lamp1
    ? parseFloat(lamp1?.remaining_hours ?? 0)
    : null;
  const s2L2Balance = lamp2
    ? parseFloat(lamp2?.remaining_hours ?? 0)
    : null;

  const openLogFor = (asset, label) => {
    const logs = asset?.id === screen1Asset?.id ? s1Logs
                : asset?.id === lamp1?.id ? s2L1Logs : s2L2Logs;
    const lastLog = logs?.[logs.length - 1];
    setLogForm({
      log_date: TODAY,
      opening_value: lastLog ? String(lastLog.closing_value) : '0',
      closing_value: '',
      notes: ''
    });
    setShowLogModal({ asset, label });
  };

  // Available months for filter pill
  const allDates = [
    ...(s1Logs || []),
    ...(s2L1Logs || []),
    ...(s2L2Logs || []),
  ].map(l => l.log_date.substring(0, 7));
  const months = [...new Set(allDates)].sort();

  return (
    <div>
      {/* PAGE HEADER */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">💡 Projection Lamp Reading Register</h1>
          <p className="page-subtitle">
            Screen 1: Christie Xenon (2100h rated) · Screen 2: Barco DP4K-19B – Lamp 1 &amp; Lamp 2 (3000h rated each)
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Month filter pills */}
          <button
            onClick={() => setMonthFilter('')}
            style={{
              padding: '5px 14px', borderRadius: 99, border: '1px solid var(--border)',
              background: !monthFilter ? 'var(--primary)' : 'transparent',
              color: !monthFilter ? '#fff' : 'var(--text-muted)', cursor: 'pointer', fontSize: 12
            }}>All</button>
          {months.map(m => (
            <button key={m} onClick={() => setMonthFilter(m)} style={{
              padding: '5px 14px', borderRadius: 99, border: '1px solid var(--border)',
              background: monthFilter === m ? 'var(--primary)' : 'transparent',
              color: monthFilter === m ? '#fff' : 'var(--text-muted)', cursor: 'pointer', fontSize: 12
            }}>{m}</button>
          ))}
          <button className="btn btn-primary" style={{ marginLeft: 8 }}
            onClick={() => {
              const active = activeTab === 'screen1' ? screen1Asset
                           : activeTab === 'screen2' ? (lamp1 || lamp2) : null;
              if (!active && activeTab !== 'screen2') return toast.error('No lamp found');
              if (activeTab === 'screen2') openLogFor(lamp1, 'Screen 2 – Lamp 1');
              else openLogFor(screen1Asset, 'Screen 1 – Christie Xenon');
            }}>
            + Add Log Entry
          </button>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <SummaryCard
          label="Screen 1 – Balance Life"
          value={s1Balance !== null ? `${s1Balance} hrs` : '—'}
          sub={`Rated: ${s1Rated}h | Christie Xenon 2100H`}
          accent={s1Balance !== null && s1Balance < 300 ? '#ef4444' : '#22c55e'}
        />
        <SummaryCard
          label="Screen 2 – Lamp 1 Remaining"
          value={s2L1Balance !== null ? `${s2L1Balance} hrs` : '—'}
          sub="Barco DP4K-19B · 3000h rated"
          accent={s2L1Balance !== null && s2L1Balance < 300 ? '#ef4444' : '#22c55e'}
        />
        <SummaryCard
          label="Screen 2 – Lamp 2 Remaining"
          value={s2L2Balance !== null ? `${s2L2Balance} hrs` : '—'}
          sub="Barco DP4K-19B · 3000h rated"
          accent={s2L2Balance !== null && s2L2Balance < 300 ? '#ef4444' : '#22c55e'}
        />
        <SummaryCard
          label="Total Log Entries"
          value={(s1Logs?.length ?? 0) + (s2L1Logs?.length ?? 0) + (s2L2Logs?.length ?? 0)}
          sub="Across all 3 lamp units"
          accent="var(--primary)"
        />
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', marginBottom: 24, paddingBottom: 8 }}>
        {[
          { key: 'screen1', label: '🎬 Screen 1 Lamp (2100h)' },
          { key: 'screen2', label: '🎥 Screen 2 Lamps (3000h × 2)' },
          { key: 'trend', label: '📈 Life Trend' },
        ].map(t => (
          <button key={t.key}
            className={`tab-btn ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {/* ── SCREEN 1 TAB ── */}
      {activeTab === 'screen1' && (
        <div>
          {/* Header row matching spreadsheet */}
          <div style={{
            background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)',
            borderRadius: '14px 14px 0 0', padding: '14px 20px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>SCREEN 1 THEATRE LAMP</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Christie Xenon 2100H · S/N: CHR-XEN-S1-001 · Rated Life: 2100 hrs ·
                <span style={{ color: '#f59e0b', marginLeft: 6 }}>⬇️ Countdown Mode</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              {screen1Asset && (
                <div style={{ fontSize: 13, fontWeight: 700, color: '#22c55e' }}>
                  Balance: {s1Balance !== null ? `${s1Balance} hrs` : '—'}
                </div>
              )}
              <button className="btn btn-primary" style={{ marginTop: 6, padding: '4px 14px', fontSize: 12 }}
                onClick={() => screen1Asset && openLogFor(screen1Asset, 'Screen 1 – Christie Xenon')}>
                + Add Log
              </button>
            </div>
          </div>

          {/* Life bar */}
          {screen1Asset && (
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 20px', borderLeft: '1px solid rgba(255,255,255,0.08)', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
              <BalanceBar
                used={s1Balance ?? 0}
                rated={s1Rated}
                countsDown={true}
              />
            </div>
          )}

          {/* Table */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.08)', borderTop: 'none', borderRadius: '0 0 14px 14px', overflow: 'hidden' }}>
            {assetsLoading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
            ) : !screen1Asset ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                Screen 1 lamp not found in registry.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'rgba(99,102,241,0.10)' }}>
                    <th style={thStyle}>#</th>
                    <th style={thStyle}>DATE</th>
                    <th style={thStyle}>OPENING</th>
                    <th style={thStyle}>CLOSING</th>
                    <th style={thStyle}>WORKING hrs</th>
                    <th style={thStyle}>BALANCE</th>
                    <th style={thStyle}>NOTES</th>
                  </tr>
                </thead>
                <tbody>
                  {s1Filtered.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No entries for selected period.</td></tr>
                  ) : s1Filtered.map((log, idx) => {
                    const working = Math.abs(parseFloat(log.delta ?? log.closing_value - log.opening_value));
                    const balance = parseFloat(log.closing_value); // for countdown lamp, closing = remaining
                    const isLow = balance < 300;
                    return (
                      <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                        <td style={tdMuted}>{idx + 1}</td>
                        <td style={tdStyle}><strong>{fmtDate(log.log_date)}</strong></td>
                        <td style={tdStyle}>{parseFloat(log.opening_value)}</td>
                        <td style={tdStyle}>{parseFloat(log.closing_value)}</td>
                        <td style={{ ...tdStyle, fontWeight: 700 }}>{working}</td>
                        <td style={{ ...tdStyle, fontWeight: 800, color: isLow ? '#ef4444' : '#22c55e' }}>
                          {balance}
                          {isLow && <span style={{ fontSize: 10, marginLeft: 4, color: '#ef4444' }}>⚠️</span>}
                        </td>
                        <td style={tdMuted}>{log.notes || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
                {s1Filtered.length > 0 && (
                  <tfoot>
                    <tr style={{ background: 'rgba(99,102,241,0.08)', fontWeight: 700 }}>
                      <td colSpan={4} style={{ ...tdStyle, textAlign: 'right', paddingRight: 16 }}>Total Working Hours (period):</td>
                      <td style={{ ...tdStyle, color: 'var(--primary)' }}>
                        {s1Filtered.reduce((sum, l) => sum + Math.abs(parseFloat(l.delta ?? 0)), 0).toFixed(0)} hrs
                      </td>
                      <td style={{ ...tdStyle, color: s1Balance !== null && s1Balance < 300 ? '#ef4444' : '#22c55e' }}>
                        {s1Filtered.length > 0 ? parseFloat(s1Filtered[s1Filtered.length - 1].closing_value) : '—'} hrs left
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── SCREEN 2 TAB ── */}
      {activeTab === 'screen2' && (
        <div>
          {/* Header */}
          <div style={{
            background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.25)',
            borderRadius: '14px 14px 0 0', padding: '14px 20px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>THEATRE LAMP SCREEN 2</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Barco DP4K-19B · 2 Lamps · Rated Life: 3000 hrs each ·
                <span style={{ color: '#22c55e', marginLeft: 6 }}>⬆️ Count-Up Mode</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" style={{ padding: '4px 14px', fontSize: 12 }}
                onClick={() => lamp1 && openLogFor(lamp1, 'Screen 2 – Lamp 1')}>+ Add Lamp 1 Log</button>
              <button className="btn btn-secondary" style={{ padding: '4px 14px', fontSize: 12 }}
                onClick={() => lamp2 && openLogFor(lamp2, 'Screen 2 – Lamp 2')}>+ Add Lamp 2 Log</button>
            </div>
          </div>

          {/* Lamp life bars */}
          {(lamp1 || lamp2) && (
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 20px', borderLeft: '1px solid rgba(255,255,255,0.08)', borderRight: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {lamp1 && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                    LAMP 1 · S/N: {lamp1.serial_number} · Used: {parseFloat(lamp1.current_hours)}h
                  </div>
                  <BalanceBar used={parseFloat(lamp1.current_hours)} rated={3000} countsDown={false} />
                </div>
              )}
              {lamp2 && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                    LAMP 2 · S/N: {lamp2.serial_number} · Used: {parseFloat(lamp2.current_hours)}h
                  </div>
                  <BalanceBar used={parseFloat(lamp2.current_hours)} rated={3000} countsDown={false} />
                </div>
              )}
            </div>
          )}

          {/* Table — both lamps merged by date */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.08)', borderTop: 'none', borderRadius: '0 0 14px 14px', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'rgba(16,185,129,0.10)' }}>
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>DATE</th>
                  <th style={thStyle}>NO</th>
                  <th style={{ ...thStyle, borderLeft: '2px solid rgba(99,102,241,0.3)' }}>OPENING</th>
                  <th style={thStyle}>CLOSING</th>
                  <th style={thStyle}>WORKING hrs</th>
                  <th style={{ ...thStyle, borderRight: '2px solid rgba(99,102,241,0.3)' }}>BALANCE</th>
                </tr>
              </thead>
              <tbody>
                {screen2Merged.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No entries for selected period.</td></tr>
                ) : screen2Merged.map((row, idx) => {
                  const lamp1Log = row.lamp1;
                  const lamp2Log = row.lamp2;
                  const rows = [];

                  if (lamp1Log) {
                    const working = parseFloat(lamp1Log.delta ?? 0);
                    const balance = 3000 - parseFloat(lamp1Log.closing_value);
                    rows.push(
                      <tr key={`${row.date}-L1`} style={{ borderBottom: lamp2Log ? 'none' : '1px solid rgba(255,255,255,0.05)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                        <td style={tdMuted} rowSpan={lamp2Log ? 2 : 1}>{idx + 1}</td>
                        <td style={tdStyle} rowSpan={lamp2Log ? 2 : 1}><strong>{fmtDate(row.date)}</strong></td>
                        <td style={{ ...tdStyle, color: 'var(--primary)', fontWeight: 700 }}>LAMP 1</td>
                        <td style={tdStyle}>{parseFloat(lamp1Log.opening_value)}</td>
                        <td style={tdStyle}>{parseFloat(lamp1Log.closing_value)}</td>
                        <td style={{ ...tdStyle, fontWeight: 700 }}>{working}</td>
                        <td style={{ ...tdStyle, fontWeight: 800, color: balance < 300 ? '#ef4444' : '#22c55e' }}>{balance}</td>
                      </tr>
                    );
                  }

                  if (lamp2Log) {
                    const working = parseFloat(lamp2Log.delta ?? 0);
                    const balance = 3000 - parseFloat(lamp2Log.closing_value);
                    rows.push(
                      <tr key={`${row.date}-L2`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: idx % 2 === 0 ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.01)' }}>
                        {!lamp1Log && <td style={tdMuted}>{idx + 1}</td>}
                        {!lamp1Log && <td style={tdStyle}><strong>{fmtDate(row.date)}</strong></td>}
                        <td style={{ ...tdStyle, color: '#f59e0b', fontWeight: 700 }}>LAMP 2</td>
                        <td style={tdStyle}>{parseFloat(lamp2Log.opening_value)}</td>
                        <td style={tdStyle}>{parseFloat(lamp2Log.closing_value)}</td>
                        <td style={{ ...tdStyle, fontWeight: 700 }}>{working}</td>
                        <td style={{ ...tdStyle, fontWeight: 800, color: balance < 300 ? '#ef4444' : '#22c55e' }}>{balance}</td>
                      </tr>
                    );
                  }

                  return rows;
                })}
              </tbody>
              {screen2Merged.length > 0 && (() => {
                const l1Total = s2L1Filtered.reduce((s, l) => s + parseFloat(l.delta ?? 0), 0);
                const l2Total = s2L2Filtered.reduce((s, l) => s + parseFloat(l.delta ?? 0), 0);
                const l1Last = s2L1Filtered[s2L1Filtered.length - 1];
                const l2Last = s2L2Filtered[s2L2Filtered.length - 1];
                return (
                  <tfoot>
                    <tr style={{ background: 'rgba(16,185,129,0.08)', fontWeight: 700 }}>
                      <td colSpan={3} style={{ ...tdStyle, textAlign: 'right' }}>Period Totals →</td>
                      <td colSpan={2} style={tdStyle}></td>
                      <td style={{ ...tdStyle, color: 'var(--primary)' }}>
                        L1: {l1Total.toFixed(0)}h · L2: {l2Total.toFixed(0)}h
                      </td>
                      <td style={{ ...tdStyle, color: '#22c55e' }}>
                        L1: {l1Last ? 3000 - parseFloat(l1Last.closing_value) : '—'} · L2: {l2Last ? 3000 - parseFloat(l2Last.closing_value) : '—'}
                      </td>
                    </tr>
                  </tfoot>
                );
              })()}
            </table>
          </div>
        </div>
      )}

      {/* ── TREND TAB ── */}
      {activeTab === 'trend' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Screen 1 trend */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 15 }}>
              🎬 Screen 1 – Christie Xenon 2100H · Balance Life Trend
            </div>
            {s1Logs && s1Logs.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[...s1Logs].slice(-30).map(l => {
                  const bal = parseFloat(l.closing_value);
                  const pct = Math.min((bal / 2100) * 100, 100);
                  const color = pct < 15 ? '#ef4444' : pct < 35 ? '#f59e0b' : '#22c55e';
                  return (
                    <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 64, flexShrink: 0 }}>{fmtDate(l.log_date)}</span>
                      <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 99, height: 8, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, background: color, height: '100%', borderRadius: 99 }} />
                      </div>
                      <span style={{ fontSize: 11, color, fontWeight: 700, width: 60, textAlign: 'right' }}>{bal}h left</span>
                    </div>
                  );
                })}
              </div>
            ) : <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>No data</div>}
          </div>

          {/* Screen 2 trend */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 15 }}>
              🎥 Screen 2 – Barco DP4K-19B · Usage Hours Trend (Lamp 1 &amp; Lamp 2)
            </div>
            {s2L1Logs && s2L1Logs.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[...s2L1Logs].slice(-30).map((l, i) => {
                  const used = parseFloat(l.closing_value);
                  const pct = Math.min((used / 3000) * 100, 100);
                  const l2 = s2L2Logs?.[i];
                  const used2 = l2 ? parseFloat(l2.closing_value) : null;
                  const pct2 = used2 !== null ? Math.min((used2 / 3000) * 100, 100) : null;
                  return (
                    <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 64, flexShrink: 0 }}>{fmtDate(l.log_date)}</span>
                      <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 99, height: 7, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, background: 'var(--primary)', height: '100%', borderRadius: 99 }} />
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--primary)', width: 40, textAlign: 'center', fontWeight: 700 }}>L1 {used}h</span>
                      {pct2 !== null && <>
                        <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 99, height: 7, overflow: 'hidden' }}>
                          <div style={{ width: `${pct2}%`, background: '#f59e0b', height: '100%', borderRadius: 99 }} />
                        </div>
                        <span style={{ fontSize: 10, color: '#f59e0b', width: 40, textAlign: 'right', fontWeight: 700 }}>L2 {used2}h</span>
                      </>}
                    </div>
                  );
                })}
              </div>
            ) : <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>No data</div>}
          </div>
        </div>
      )}

      {/* ── ADD LOG MODAL ── */}
      {showLogModal && (
        <div className="modal-overlay" onClick={() => setShowLogModal(null)}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">📝 Add Lamp Reading — {showLogModal.label}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              {showLogModal.asset?.counts_down
                ? '⬇️ Countdown lamp: Opening must be higher than closing'
                : '⬆️ Count-up lamp: Closing must be ≥ opening'}
            </div>
            <form onSubmit={e => {
              e.preventDefault();
              logMutation.mutate({
                asset: showLogModal.asset.id,
                log_date: logForm.log_date,
                opening_value: logForm.opening_value,
                closing_value: logForm.closing_value,
                notes: logForm.notes,
              });
            }}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Date *</label>
                  <input type="date" className="form-input"
                    value={logForm.log_date}
                    onChange={e => setLogForm(p => ({ ...p, log_date: e.target.value }))}
                    required />
                </div>
                <div className="form-group">
                  <label className="form-label">Opening Reading *</label>
                  <input type="number" step="0.01" className="form-input"
                    placeholder={showLogModal.asset?.counts_down ? 'e.g. 856' : 'e.g. 480'}
                    value={logForm.opening_value}
                    onChange={e => setLogForm(p => ({ ...p, opening_value: e.target.value }))}
                    required />
                </div>
                <div className="form-group">
                  <label className="form-label">Closing Reading *</label>
                  <input type="number" step="0.01" className="form-input"
                    placeholder={showLogModal.asset?.counts_down ? 'e.g. 842 (lower)' : 'e.g. 490 (higher)'}
                    value={logForm.closing_value}
                    onChange={e => setLogForm(p => ({ ...p, closing_value: e.target.value }))}
                    required />
                </div>
                <div className="form-group">
                  <label className="form-label">Working Hours (auto-calc)</label>
                  <input type="number" className="form-input" readOnly
                    value={logForm.opening_value && logForm.closing_value
                      ? Math.abs(parseFloat(logForm.closing_value) - parseFloat(logForm.opening_value)).toFixed(0)
                      : ''}
                    style={{ opacity: 0.7, cursor: 'not-allowed' }} />
                </div>
              </div>
              {logForm.opening_value && logForm.closing_value && (
                <div style={{
                  background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
                  borderRadius: 8, padding: '8px 14px', fontSize: 12, marginBottom: 12
                }}>
                  💡 <strong>Balance after this entry:</strong>{' '}
                  {showLogModal.asset?.counts_down
                    ? `${parseFloat(logForm.closing_value)} hrs remaining`
                    : `${Math.max(3000 - parseFloat(logForm.closing_value), 0)} hrs remaining`}
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Notes (optional)</label>
                <input type="text" className="form-input"
                  placeholder="Any remarks or observations…"
                  value={logForm.notes}
                  onChange={e => setLogForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowLogModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={logMutation.isLoading}>
                  {logMutation.isLoading ? '⏳ Saving…' : '💾 Save Log Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Style helpers ─────────────────────────────────────────────────────────────
const thStyle = {
  padding: '11px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700,
  color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em',
  whiteSpace: 'nowrap', borderBottom: '1px solid rgba(255,255,255,0.07)'
};
const tdStyle = {
  padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap'
};
const tdMuted = {
  padding: '9px 14px', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap'
};
