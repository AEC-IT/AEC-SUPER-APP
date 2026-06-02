import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const NAV_ITEMS = [
  { section: 'Overview', items: [
    { path: '/dashboard', icon: '📊', label: 'Dashboard' },
  ]},
  { section: 'F&B Operations', items: [
    { path: '/cafe', icon: '🍿', label: 'Cafe Sales & Counter', module: 'CAFE' },
    { path: '/petpooja', icon: '🔌', label: 'Petpooja POS Sync', module: 'PETPOOJA' },
  ]},
  { section: 'Administration', items: [
    { path: '/settings', icon: '⚙️', label: 'Settings', roles: ['MD'] },
  ]},
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
    toast.success('Signed out successfully.');
  };

  const getRoleColor = (role) => {
    if (role === 'MD') return 'badge-warning';
    if (role === 'ADMIN') return 'badge-info';
    return 'badge-neutral';
  };

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo" style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          {/* Restaurant logo */}
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, #16a34a, #d97706)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, boxShadow: '0 4px 20px rgba(22,163,74,0.3)'
          }}>🍽️</div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: '#4ade80', letterSpacing: '1px', textTransform: 'uppercase', textAlign: 'center' }}>
            AEC
          </div>
          <div style={{ fontSize: '11px', fontWeight: 500, color: 'rgba(240,247,242,0.5)', letterSpacing: '2px', textTransform: 'uppercase', textAlign: 'center' }}>
            RESTAURANT
          </div>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(section => {
            const visibleItems = section.items.filter(item => {
              if (item.roles && !item.roles.includes(user?.role)) return false;
              if (item.module && user?.active_modules && !user.active_modules.includes(item.module)) return false;
              return true;
            });
            if (visibleItems.length === 0) return null;
            return (
              <div key={section.section}>
                <div className="nav-section-label">{section.section}</div>
                {visibleItems.map(item => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        <div style={{ padding: '16px', borderTop: '1px solid var(--border)' }}>
          <div className="user-badge" style={{ marginBottom: '10px' }}>
            <div className="user-avatar">{user?.full_name?.charAt(0) || 'U'}</div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>{user?.full_name}</div>
              <div className={`badge ${getRoleColor(user?.role)}`} style={{ fontSize: '10px', padding: '1px 6px' }}>
                {user?.role}
              </div>
            </div>
          </div>
          <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleLogout}>
            🚪 Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="main-content">
        <div style={{ padding: '32px' }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
