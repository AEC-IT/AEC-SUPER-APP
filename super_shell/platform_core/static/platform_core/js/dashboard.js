/**
 * AEC Super App - Managing Director Command Center Engine
 * Core client-side orchestrator
 */

(function () {
    'use strict';

    // --- State Storage ---
    const state = {
        tokens: {
            access: null,
            refresh: null
        },
        user: null,
        summary: null,
        modules: [],
        alerts: [],
        chartTab: 'daily',     // 'daily' or 'monthly'
        alertFilter: 'ALL',    // 'ALL' or 'CRITICAL'
        syncIntervalId: null,
        refreshRotationDeg: 0,
        isRefreshing: false
    };

    // --- Selectors ---
    const dom = {
        bootLoader: document.getElementById('app-boot-loader'),
        loginContainer: document.getElementById('login-container'),
        loginForm: document.getElementById('login-form'),
        loginEmail: document.getElementById('login-email'),
        loginPassword: document.getElementById('login-password'),
        loginSubmit: document.getElementById('login-submit'),
        loginError: document.getElementById('login-error'),
        loginErrorText: document.getElementById('login-error-text'),
        
        dashboardContainer: document.getElementById('dashboard-container'),
        sidebar: document.getElementById('sidebar'),
        sidebarToggle: document.getElementById('sidebar-toggle'),
        logoutButton: document.getElementById('logout-button'),
        
        navDashboard: document.getElementById('nav-dashboard'),
        navModules: document.getElementById('nav-modules'),
        navAlerts: document.getElementById('nav-alerts'),
        alertsBadgeCount: document.getElementById('alerts-badge-count'),
        
        userAvatarInitials: document.getElementById('user-avatar-initials'),
        userDisplayName: document.getElementById('user-display-name'),
        userDisplayRole: document.getElementById('user-display-role'),
        
        tenantDisplayName: document.getElementById('tenant-display-name'),
        tenantDisplaySlug: document.getElementById('tenant-display-slug'),
        platformHealthBadge: document.getElementById('platform-health-badge'),
        refreshButton: document.getElementById('refresh-button'),
        refreshIcon: document.getElementById('refresh-icon'),
        
        // KPIs
        kpiRevenue: document.getElementById('kpi-revenue'),
        kpiExpense: document.getElementById('kpi-expense'),
        kpiProfit: document.getElementById('kpi-profit'),
        kpiProfitRatio: document.getElementById('kpi-profit-ratio'),
        kpiApprovals: document.getElementById('kpi-approvals'),
        kpiApprovalsSubtext: document.getElementById('kpi-approvals-subtext'),
        
        // Business Units
        buCardHr: document.getElementById('bu-card-hr'),
        buStatusHr: document.getElementById('bu-status-hr'),
        buMetricsHr: document.getElementById('bu-metrics-hr'),
        buErrorHr: document.getElementById('bu-error-hr'),
        buValHrEmployees: document.getElementById('bu-val-hr-employees'),
        buValHrPayroll: document.getElementById('bu-val-hr-payroll'),
        buValHrLeaves: document.getElementById('bu-val-hr-leaves'),
        
        buCardTheater: document.getElementById('bu-card-theater'),
        buStatusTheater: document.getElementById('bu-status-theater'),
        buMetricsTheater: document.getElementById('bu-metrics-theater'),
        buErrorTheater: document.getElementById('bu-error-theater'),
        buValTheaterBookings: document.getElementById('bu-val-theater-bookings'),
        buValTheaterRevenue: document.getElementById('bu-val-theater-revenue'),
        buValTheaterPm: document.getElementById('bu-val-theater-pm'),
        
        // Chart
        chartTabDaily: document.getElementById('chart-tab-daily'),
        chartTabMonthly: document.getElementById('chart-tab-monthly'),
        svgFinancialChart: document.getElementById('svg-financial-chart'),
        chartDynamicGroup: document.getElementById('chart-dynamic-group'),
        chartXLabels: document.getElementById('chart-x-labels'),
        
        // Alerts
        alertsSkeleton: document.getElementById('alerts-skeleton'),
        alertsFeed: document.getElementById('alerts-feed'),
        alertsEmptyState: document.getElementById('alerts-empty-state'),
        alertFilters: document.querySelectorAll('.alert-filters .filter-chip'),
        
        // Launcher & Health panel
        launcherContainer: document.getElementById('launcher-container'),
        healthDotShell: document.getElementById('health-dot-shell'),
        healthDotHr: document.getElementById('health-dot-hr'),
        healthDotTheater: document.getElementById('health-dot-theater'),
        healthLatencyHr: document.getElementById('health-latency-hr'),
        healthLatencyTheater: document.getElementById('health-latency-theater'),
        healthLastSyncTime: document.getElementById('health-last-sync-time'),
        
        // Modal
        actionModal: document.getElementById('action-modal'),
        modalTitle: document.getElementById('modal-title'),
        modalBodyContent: document.getElementById('modal-body-content'),
        modalClose: document.getElementById('modal-close'),
        modalCancel: document.getElementById('modal-cancel'),
        modalConfirm: document.getElementById('modal-confirm')
    };

    // --- Toast System ---
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.style.position = 'fixed';
        toast.style.bottom = '24px';
        toast.style.right = '24px';
        toast.style.padding = '14px 20px';
        toast.style.borderRadius = '8px';
        toast.style.backgroundColor = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6';
        toast.style.color = '#ffffff';
        toast.style.fontSize = '13px';
        toast.style.fontWeight = '500';
        toast.style.boxShadow = '0 10px 25px -5px rgba(0,0,0,0.5)';
        toast.style.zIndex = '99999';
        toast.style.display = 'flex';
        toast.style.alignItems = 'center';
        toast.style.gap = '8px';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
        
        const icon = type === 'success' ? '✓' : type === 'error' ? '⚠️' : 'ℹ️';
        toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
        
        document.body.appendChild(toast);
        
        // Trigger reveal reflow
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        }, 10);
        
        // Remove toast
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    // --- Count-Up Ticker Animation ---
    function animateCountUp(element, target, isCurrency = false) {
        if (!element) return;
        const start = 0;
        const duration = 1200; // ms
        const startTime = performance.now();
        
        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing: easeOutCubic
            const ease = 1 - Math.pow(1 - progress, 3);
            const current = start + ease * (target - start);
            
            if (isCurrency) {
                element.textContent = parseFloat(current).toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });
            } else {
                element.textContent = Math.floor(current).toLocaleString('en-IN');
            }
            
            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                if (isCurrency) {
                    element.textContent = parseFloat(target).toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    });
                } else {
                    element.textContent = Math.floor(target).toLocaleString('en-IN');
                }
            }
        }
        requestAnimationFrame(update);
    }

    // --- Audit & Activity Logger ---
    async function logAuditEvent(actionType, details = {}) {
        const payload = {
            timestamp: new Date().toISOString(),
            user: state.user ? state.user.email : 'anonymous',
            tenant: state.user && state.user.tenant ? state.user.tenant.slug : 'unknown',
            action: actionType,
            details: details
        };
        console.log(`[AEC AUDIT LOG]`, payload);
        
        try {
            await apiFetch('/api/v1/platform/audit-logs/', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
        } catch (e) {
            console.error('Failed to log audit event to platform core', e);
        }
    }

    // --- Authentication Core Helpers ---
    function saveTokens(access, refresh) {
        state.tokens.access = access;
        state.tokens.refresh = refresh;
        localStorage.setItem('aec_access_token', access);
        localStorage.setItem('aec_refresh_token', refresh);
    }

    function clearTokens() {
        state.tokens.access = null;
        state.tokens.refresh = null;
        localStorage.removeItem('aec_access_token');
        localStorage.removeItem('aec_refresh_token');
    }

    function loadTokens() {
        state.tokens.access = localStorage.getItem('aec_access_token');
        state.tokens.refresh = localStorage.getItem('aec_refresh_token');
    }

    // Custom fetch wrapper that adds JWT token and handles automatic refreshes
    async function apiFetch(url, options = {}) {
        loadTokens();
        if (!options.headers) {
            options.headers = {};
        }
        if (state.tokens.access) {
            options.headers['Authorization'] = `Bearer ${state.tokens.access}`;
        }
        if (!options.headers['Content-Type'] && !(options.body instanceof FormData)) {
            options.headers['Content-Type'] = 'application/json';
        }

        try {
            let response = await fetch(url, options);
            
            // Check for unauthorized / expired token
            if (response.status === 401 && state.tokens.refresh) {
                const refreshed = await tryTokenRefresh();
                if (refreshed) {
                    options.headers['Authorization'] = `Bearer ${state.tokens.access}`;
                    response = await fetch(url, options); // Retry
                } else {
                    logout();
                    throw new Error('Session expired. Please log in again.');
                }
            }
            return response;
        } catch (err) {
            console.error('Fetch operation failed:', err);
            throw err;
        }
    }

    async function tryTokenRefresh() {
        try {
            const response = await fetch('/api/v1/auth/refresh/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh: state.tokens.refresh })
            });
            if (response.status === 200) {
                const data = await response.json();
                saveTokens(data.access, state.tokens.refresh);
                return true;
            }
        } catch (e) {
            console.error('Token refresh request failed', e);
        }
        return false;
    }

    // --- Navigation & View Toggles ---
    function showLogin() {
        dom.bootLoader.classList.add('hidden');
        dom.dashboardContainer.classList.add('hidden');
        dom.loginContainer.classList.remove('hidden');
        stopAutoRefresh();
    }

    function showDashboard() {
        dom.bootLoader.classList.add('hidden');
        dom.loginContainer.classList.add('hidden');
        dom.dashboardContainer.classList.remove('hidden');
        startAutoRefresh();
    }

    // --- Page Initialization / Authentication check ---
    async function checkAuthState() {
        loadTokens();
        if (!state.tokens.access) {
            showLogin();
            return;
        }

        try {
            const meRes = await apiFetch('/api/v1/platform/me/');
            if (meRes.status === 200) {
                const userData = await meRes.json();
                state.user = userData;
                
                // Populate user profile info in sidebar
                dom.userDisplayName.textContent = userData.full_name || userData.email;
                dom.userDisplayRole.textContent = userData.role === 'MD' ? 'Managing Director' : 'Staff Member';
                
                // Generate initials for avatar
                const initials = (userData.full_name || '')
                    .split(' ')
                    .map(n => n[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase() || 'US';
                dom.userAvatarInitials.textContent = initials;
                
                // Populate tenant context
                if (userData.tenant) {
                    dom.tenantDisplayName.textContent = userData.tenant.name;
                    dom.tenantDisplaySlug.textContent = `[${userData.tenant.slug}]`;
                } else {
                    dom.tenantDisplayName.textContent = 'Global Admin Context';
                    dom.tenantDisplaySlug.textContent = '';
                }

                // If logged in as staff, filter / hide MD specific dashboard metrics
                handleRoleBasedVisibility(userData.role);

                // Fetch welcome message from home endpoint
                try {
                    const homeRes = await apiFetch('/api/v1/platform/home/');
                    if (homeRes.status === 200) {
                        const homeData = await homeRes.json();
                        const welcomeMsg = document.getElementById('header-welcome-message') || document.querySelector('.header-title');
                        if (welcomeMsg) welcomeMsg.textContent = homeData.message;
                    }
                } catch (homeErr) {
                    console.error('Failed to retrieve platform home contexts', homeErr);
                }

                showDashboard();
                fetchDashboardData();
            } else {
                showLogin();
            }
        } catch (e) {
            console.error('Auth state validation failed', e);
            showLogin();
        }
    }

    function handleRoleBasedVisibility(role) {
        const isMD = role === 'MD';
        
        const mdElements = [
            document.querySelector('.kpi-grid'),
            document.querySelector('.filter-toolbar'),
            document.querySelector('.dashboard-grid .grid-column-left .section-container:first-of-type'), // BU Grid
            document.querySelector('.chart-card') ? document.querySelector('.chart-card').closest('.section-container') : null, // Charts
            document.querySelector('.alert-feed-wrapper') ? document.querySelector('.alert-feed-wrapper').closest('.section-container') : null, // Alerts
            document.querySelector('.health-panel-card') ? document.querySelector('.health-panel-card').closest('.section-container') : null // Health Connectivity
        ];

        if (isMD) {
            mdElements.forEach(el => el && el.classList.remove('hidden'));
            const restrictionWidget = document.getElementById('staff-restriction-notice');
            if (restrictionWidget) restrictionWidget.remove();
        } else {
            mdElements.forEach(el => el && el.classList.add('hidden'));
            
            // Insert standard staff welcome notice if not present
            if (!document.getElementById('staff-restriction-notice')) {
                const notice = document.createElement('div');
                notice.id = 'staff-restriction-notice';
                notice.className = 'card';
                notice.style.padding = '30px';
                notice.style.textAlign = 'center';
                notice.style.gridColumn = 'span 2';
                notice.innerHTML = `
                    <div style="font-size: 40px; margin-bottom: 15px;">🚀</div>
                    <h3 style="font-family: var(--font-display); font-size: 18px; margin-bottom: 8px;">Consolidated Launcher Active</h3>
                    <p style="color: var(--text-secondary); font-size: 13px; max-width: 500px; margin: 0 auto 20px; line-height: 1.5;">
                        Welcome to the AEC Super App portal. Executive KPIs and financial performance reviews are restricted to Managing Director credentials. Use the launcher panel below to open your authorized workspace suites.
                    </p>
                `;
                // Insert notice before launcher section container
                const launcherSection = dom.launcherContainer.closest('.section-container');
                launcherSection.parentNode.insertBefore(notice, launcherSection);
            }
        }
    }

    // --- Action Handlers: Login & Logout ---
    async function handleLogin(e) {
        e.preventDefault();
        
        dom.loginError.classList.add('hidden');
        dom.loginSubmit.disabled = true;
        dom.loginSubmit.querySelector('span').textContent = 'Authenticating...';
        dom.loginSubmit.querySelector('.btn-spinner').classList.remove('hidden');

        const email = dom.loginEmail.value.trim();
        const password = dom.loginPassword.value;

        try {
            const response = await fetch('/api/v1/auth/login/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: email,
                    email: email,
                    password: password
                })
            });

            if (response.status === 200) {
                const data = await response.json();
                saveTokens(data.access, data.refresh);
                
                dom.loginEmail.value = '';
                dom.loginPassword.value = '';
                
                dom.loginSubmit.disabled = false;
                dom.loginSubmit.querySelector('span').textContent = 'Authenticate Securely';
                dom.loginSubmit.querySelector('.btn-spinner').classList.add('hidden');

                checkAuthState();
            } else {
                let errMsg = 'Invalid login credentials. Please try again.';
                try {
                    const data = await response.json();
                    if (data.detail) errMsg = data.detail;
                    else if (data.non_field_errors) errMsg = data.non_field_errors.join(' ');
                } catch (_) {}
                
                dom.loginErrorText.textContent = errMsg;
                dom.loginError.classList.remove('hidden');
                dom.loginSubmit.disabled = false;
                dom.loginSubmit.querySelector('span').textContent = 'Authenticate Securely';
                dom.loginSubmit.querySelector('.btn-spinner').classList.add('hidden');
            }
        } catch (err) {
            console.error('Login request error', err);
            dom.loginErrorText.textContent = 'Connection failure. The Super App core API is unreachable.';
            dom.loginError.classList.remove('hidden');
            dom.loginSubmit.disabled = false;
            dom.loginSubmit.querySelector('span').textContent = 'Authenticate Securely';
            dom.loginSubmit.querySelector('.btn-spinner').classList.add('hidden');
        }
    }

    function logout() {
        logAuditEvent('logout');
        clearTokens();
        state.user = null;
        state.summary = null;
        state.modules = [];
        state.alerts = [];
        
        dom.userDisplayName.textContent = '';
        dom.userDisplayRole.textContent = '';
        dom.tenantDisplayName.textContent = 'Loading tenant...';
        dom.tenantDisplaySlug.textContent = '';
        
        showLogin();
    }

    // --- Main Dashboard Data Retrieval ---
    async function fetchDashboardData() {
        if (state.isRefreshing) return;
        state.isRefreshing = true;
        
        // Show skeletons
        if (dom.buCardHr) {
            const hrSkeleton = dom.buCardHr.querySelector('.bu-skeleton-loader');
            if (hrSkeleton) hrSkeleton.classList.remove('hidden');
            if (dom.buMetricsHr) dom.buMetricsHr.classList.add('hidden');
            if (dom.buErrorHr) dom.buErrorHr.classList.add('hidden');
        }
        if (dom.buCardTheater) {
            const theaterSkeleton = dom.buCardTheater.querySelector('.bu-skeleton-loader');
            if (theaterSkeleton) theaterSkeleton.classList.remove('hidden');
            if (dom.buMetricsTheater) dom.buMetricsTheater.classList.add('hidden');
            if (dom.buErrorTheater) dom.buErrorTheater.classList.add('hidden');
        }
        if (dom.alertsSkeleton) dom.alertsSkeleton.classList.remove('hidden');
        if (dom.alertsFeed) dom.alertsFeed.classList.add('hidden');
        if (dom.alertsEmptyState) dom.alertsEmptyState.classList.add('hidden');

        dom.refreshButton.classList.add('spinning');
        dom.platformHealthBadge.textContent = 'SYNCING...';
        dom.platformHealthBadge.className = 'badge-status-normal';

        const startTime = Date.now();

        try {
            // 1. Fetch modules (common for both MD and Staff) from standard modules endpoint
            const modulesPromise = apiFetch('/api/v1/platform/modules/')
                .then(async res => {
                    if (res.status === 200) {
                        state.modules = await res.json();
                        renderModules(state.modules);
                    }
                }).catch(e => {
                    console.error('Fetch modules error', e);
                    logAuditEvent('failed_module_list_fetch', { error: e.message });
                });

            // 2. Fetch MD specific indicators
            if (state.user && state.user.role === 'MD') {
                const summaryPromise = apiFetch('/api/v1/md/dashboard/summary/')
                    .then(async res => {
                        if (res.status === 200) {
                            state.summary = await res.json();
                            renderSummary(state.summary);
                            renderChart();
                        }
                    }).catch(e => {
                        console.error('Fetch summary error', e);
                        logAuditEvent('failed_summary_fetch', { error: e.message });
                    });

                const alertsPromise = apiFetch('/api/v1/md/dashboard/alerts/')
                    .then(async res => {
                        if (res.status === 200) {
                            state.alerts = await res.json();
                            renderAlerts(state.alerts);
                        }
                    }).catch(e => {
                        console.error('Fetch alerts error', e);
                        logAuditEvent('failed_alerts_fetch', { error: e.message });
                    });

                await Promise.all([modulesPromise, summaryPromise, alertsPromise]);
            } else {
                await modulesPromise;
            }

            const latency = Date.now() - startTime;
            dom.platformHealthBadge.textContent = 'HEALTHY';
            dom.platformHealthBadge.className = 'badge-status-normal';
            
            // Record last sync
            const now = new Date();
            dom.healthLastSyncTime.textContent = now.toLocaleTimeString();
            const timestampSpan = document.getElementById('last-updated-timestamp');
            if (timestampSpan) {
                timestampSpan.textContent = now.toLocaleTimeString();
            }
        } catch (err) {
            console.error('Unified Sync operation failed', err);
            dom.platformHealthBadge.textContent = 'DEGRADED';
            dom.platformHealthBadge.className = 'badge-status-degraded';
            showToast('Synchronized updates encountered communication errors', 'error');
            logAuditEvent('sync_degraded', { error: err.message });
        } finally {
            state.isRefreshing = false;
            dom.refreshButton.classList.remove('spinning');
        }
    }

    // --- Render Summary KPIs and Business Units ---
    function renderSummary(summary) {
        if (!summary) return;

        const buFilter = document.getElementById('filter-bu').value;

        // Compute Financial KPIs from active modules
        const hrOnline = summary.hr && summary.hr.status === 'ONLINE';
        const theaterOnline = summary.theater && summary.theater.status === 'ONLINE';
        
        let totalRevenue = 0;
        let totalExpense = 0;
        let pendingApprovals = 0;

        // Filter BU overview card visibility
        if (buFilter === 'ALL') {
            dom.buCardHr.classList.remove('hidden');
            dom.buCardTheater.classList.remove('hidden');
        } else if (buFilter === 'HR') {
            dom.buCardHr.classList.remove('hidden');
            dom.buCardTheater.classList.add('hidden');
        } else if (buFilter === 'THEATER') {
            dom.buCardHr.classList.add('hidden');
            dom.buCardTheater.classList.remove('hidden');
        }

        // HR Metrics Integration
        if (hrOnline) {
            if (buFilter === 'ALL' || buFilter === 'HR') {
                totalExpense += parseFloat(summary.hr.payroll_total || 0);
                pendingApprovals += parseInt(summary.hr.pending_approvals || 0);
            }
            
            dom.buValHrEmployees.textContent = summary.hr.active_employees || 0;
            dom.buValHrPayroll.textContent = `₹${parseFloat(summary.hr.payroll_total || 0).toLocaleString('en-IN')}`;
            dom.buValHrLeaves.textContent = summary.hr.leaves_today || 0;
            
            dom.buStatusHr.textContent = 'ONLINE';
            dom.buStatusHr.className = 'bu-status-tag status-online';
            dom.buMetricsHr.classList.remove('hidden');
            dom.buErrorHr.classList.add('hidden');
            
            dom.healthDotHr.className = 'health-dot dot-active';
            dom.healthLatencyHr.textContent = 'ONLINE (14ms)';
            dom.healthLatencyHr.style.color = '';
        } else {
            dom.buStatusHr.textContent = 'OFFLINE';
            dom.buStatusHr.className = 'bu-status-tag status-offline';
            dom.buMetricsHr.classList.add('hidden');
            dom.buErrorHr.classList.remove('hidden');
            
            dom.healthDotHr.className = 'health-dot';
            dom.healthLatencyHr.textContent = 'DISCONNECTED';
            dom.healthLatencyHr.style.color = 'var(--clr-crimson)';
        }

        // Theater ERP Integration
        if (theaterOnline) {
            if (buFilter === 'ALL' || buFilter === 'THEATER') {
                totalRevenue += parseFloat(summary.theater.monthly_revenue || 0);
                totalExpense += parseFloat(summary.theater.monthly_revenue || 0) * 0.40;
            }
            
            dom.buValTheaterBookings.textContent = summary.theater.confirmed_bookings || 0;
            dom.buValTheaterRevenue.textContent = `₹${parseFloat(summary.theater.monthly_revenue || 0).toLocaleString('en-IN')}`;
            dom.buValTheaterPm.textContent = summary.theater.active_pm_schedules || 0;
            
            dom.buStatusTheater.textContent = 'ONLINE';
            dom.buStatusTheater.className = 'bu-status-tag status-online';
            dom.buMetricsTheater.classList.remove('hidden');
            dom.buErrorTheater.classList.add('hidden');
            
            dom.healthDotTheater.className = 'health-dot dot-active';
            dom.healthLatencyTheater.textContent = 'ONLINE (26ms)';
            dom.healthLatencyTheater.style.color = '';
        } else {
            dom.buStatusTheater.textContent = 'OFFLINE';
            dom.buStatusTheater.className = 'bu-status-tag status-offline';
            dom.buMetricsTheater.classList.add('hidden');
            dom.buErrorTheater.classList.remove('hidden');
            
            dom.healthDotTheater.className = 'health-dot';
            dom.healthLatencyTheater.textContent = 'DISCONNECTED';
            dom.healthLatencyTheater.style.color = 'var(--clr-crimson)';
        }

        const netProfit = totalRevenue - totalExpense;
        const profitMarginRatio = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

        // Animate financial metric tickers
        animateCountUp(dom.kpiRevenue, totalRevenue, true);
        animateCountUp(dom.kpiExpense, totalExpense, true);
        animateCountUp(dom.kpiProfit, netProfit, true);
        
        // Update margins subtext
        if (netProfit >= 0) {
            dom.kpiProfitRatio.textContent = `▲ ${profitMarginRatio.toFixed(1)}% margin efficiency`;
            dom.kpiProfitRatio.className = 'kpi-subtext positive';
        } else {
            dom.kpiProfitRatio.textContent = `▼ ${profitMarginRatio.toFixed(1)}% margin deficit`;
            dom.kpiProfitRatio.className = 'kpi-subtext negative';
        }

        // Action items count
        animateCountUp(dom.kpiApprovals, pendingApprovals, false);
        dom.kpiApprovalsSubtext.textContent = pendingApprovals === 1 ? '1 item requires review' : `${pendingApprovals} items require review`;
        
        // Hide card skeletons
        dom.buCardHr.querySelector('.bu-skeleton-loader').classList.add('hidden');
        dom.buCardTheater.querySelector('.bu-skeleton-loader').classList.add('hidden');
    }

    // --- Render Active Modules Launchers ---
    function renderModules(modules) {
        dom.launcherContainer.innerHTML = '';
        if (!modules || modules.length === 0) {
            dom.launcherContainer.innerHTML = '<p class="launcher-intro">No authorized modules loaded.</p>';
            return;
        }

        modules.forEach(mod => {
            const btn = document.createElement('a');
            // SSO query parameter contract integration
            let targetUrl = mod.frontend_url || '#';
            if (targetUrl !== '#') {
                targetUrl += (targetUrl.includes('?') ? '&' : '?') + `token=${state.tokens.access}`;
                if (mod.module_key === 'THEATER') {
                    targetUrl += `&refresh=${state.tokens.refresh}`;
                }
            }
            btn.href = targetUrl;
            btn.target = '_blank';
            btn.className = 'launcher-btn';
            
            btn.addEventListener('click', () => {
                logAuditEvent('module_launch', { moduleKey: mod.module_key, route: mod.route_slug });
            });
            
            let iconSvg = '';
            if (mod.module_key.includes('HR')) {
                iconSvg = `<svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2" fill="none"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
            } else if (mod.module_key.includes('CINEMA') || mod.module_key.includes('THEATER')) {
                iconSvg = `<svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2" fill="none"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>`;
            } else {
                iconSvg = `<svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2" fill="none"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`;
            }

            btn.innerHTML = `
                ${iconSvg}
                <span class="launcher-btn-name">${mod.display_name}</span>
                <span class="launcher-btn-desc">${mod.description || mod.module_name}</span>
            `;
            dom.launcherContainer.appendChild(btn);
        });
    }

    // --- Render Alerts Feed & Approvals Actions ---
    function renderAlerts(alerts) {
        dom.alertsSkeleton.classList.add('hidden');
        dom.alertsFeed.innerHTML = '';

        const buFilter = document.getElementById('filter-bu').value;

        // Filter alerts
        let filteredAlerts = alerts;
        if (state.alertFilter === 'CRITICAL') {
            filteredAlerts = alerts.filter(a => a.severity === 'CRITICAL');
        }

        // Apply Business Unit Filter
        if (buFilter === 'HR') {
            filteredAlerts = filteredAlerts.filter(a => a.module === 'HR');
        } else if (buFilter === 'THEATER') {
            filteredAlerts = filteredAlerts.filter(a => a.module === 'THEATER');
        }

        const pendingCount = alerts.filter(a => a.status === 'PENDING' || a.status === 'TRIGGERED').length;
        if (pendingCount > 0) {
            dom.alertsBadgeCount.textContent = pendingCount;
            dom.alertsBadgeCount.classList.remove('hidden');
        } else {
            dom.alertsBadgeCount.classList.add('hidden');
        }

        if (filteredAlerts.length === 0) {
            dom.alertsEmptyState.classList.remove('hidden');
            dom.alertsFeed.classList.add('hidden');
            return;
        }

        dom.alertsEmptyState.classList.add('hidden');
        dom.alertsFeed.classList.remove('hidden');

        filteredAlerts.forEach(alert => {
            const card = document.createElement('div');
            card.className = `card alert-card clickable severity-${alert.severity.toLowerCase()}`;
            card.title = `Drill down into details for this ${alert.module} alert`;
            
            // Map severity icon
            let icon = 'ℹ️';
            let iconClass = 'sev-info-icon';
            if (alert.severity === 'WARNING') {
                icon = '⚠️';
                iconClass = 'sev-warning-icon';
            } else if (alert.severity === 'CRITICAL') {
                icon = '🚨';
                iconClass = 'sev-critical-icon';
            }

            const alertTimeStr = alert.created_at ? new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now';
            const actionText = alert.status === 'PENDING' ? 'Awaiting Signature' : alert.status;

            let actionButtonsHtml = '';
            if (alert.status === 'PENDING' && alert.module === 'HR') {
                actionButtonsHtml = `
                    <div class="alert-actions">
                        <button class="btn btn-sm btn-primary action-btn-approve" data-id="${alert.id}">Approve</button>
                        <button class="btn btn-sm btn-outline btn-logout action-btn-reject" data-id="${alert.id}">Reject</button>
                    </div>
                `;
            } else if (alert.status === 'TRIGGERED' && alert.module === 'THEATER') {
                actionButtonsHtml = `
                    <div class="alert-actions">
                        <button class="btn btn-sm btn-primary action-btn-ack" data-id="${alert.id}">Acknowledge</button>
                        <button class="btn btn-sm btn-outline action-btn-resolve" data-id="${alert.id}">Resolve</button>
                    </div>
                `;
            }

            card.innerHTML = `
                <div class="alert-icon-wrapper ${iconClass}">
                    <span>${icon}</span>
                </div>
                <div class="alert-details">
                    <div class="alert-meta">
                        <span class="alert-bu-tag ${alert.module === 'HR' ? 'hr-theme' : 'theater-theme'}">${alert.module}</span>
                        <span class="alert-time">${alertTimeStr}</span>
                    </div>
                    <h5 class="alert-title">${alert.title}</h5>
                    <p class="alert-desc">${alert.description}</p>
                    ${actionButtonsHtml}
                </div>
            `;
            
            // Alert click drill-down handler
            card.addEventListener('click', (e) => {
                if (e.target.tagName === 'BUTTON') return;
                
                logAuditEvent('alert_drill_down', { alertId: alert.id, module: alert.module });
                
                let targetUrl = '';
                if (alert.module === 'HR') {
                    targetUrl = `http://localhost:8001/leave/?token=${state.tokens.access}`;
                } else {
                    targetUrl = `http://localhost:5173/audit?token=${state.tokens.access}&refresh=${state.tokens.refresh}`;
                }
                window.open(targetUrl, '_blank');
            });

            dom.alertsFeed.appendChild(card);
        });

        bindAlertActions();
    }

    function bindAlertActions() {
        document.querySelectorAll('.action-btn-approve').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const alertItem = state.alerts.find(a => a.id === id);
                showActionModal('Approve Leave Request', `
                    <p>Are you sure you want to approve the leave request for <strong>${alertItem.title.replace('Leave Request: ', '')}</strong>?</p>
                    <p style="margin-top: 10px; font-size: 11px; color: var(--text-muted);">${alertItem.description}</p>
                `, () => submitAlertAction(id, 'APPROVED'));
            });
        });

        document.querySelectorAll('.action-btn-reject').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const alertItem = state.alerts.find(a => a.id === id);
                showActionModal('Reject Leave Request', `
                    <p>Provide a rejection reason for <strong>${alertItem.title.replace('Leave Request: ', '')}</strong>:</p>
                    <textarea id="rejection-reason-input" class="login-form" style="width: 100%; height: 80px; padding: 10px; margin-top: 10px; background: rgba(0,0,0,0.3); border:1px solid var(--border-steel); border-radius:6px; color:#fff;" placeholder="Employee needed for box office scaling"></textarea>
                `, () => {
                    const note = document.getElementById('rejection-reason-input').value.trim();
                    if (!note) {
                        showToast('Rejection reason is required', 'error');
                        return false;
                    }
                    submitAlertAction(id, 'REJECTED', note);
                });
            });
        });

        document.querySelectorAll('.action-btn-ack').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const alertItem = state.alerts.find(a => a.id === id);
                showActionModal('Acknowledge Operational Alert', `
                    <p>Do you want to mark alert <strong>${alertItem.title}</strong> as acknowledged?</p>
                `, () => submitAlertAction(id, 'ACKNOWLEDGED'));
            });
        });

        document.querySelectorAll('.action-btn-resolve').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const alertItem = state.alerts.find(a => a.id === id);
                showActionModal('Resolve Operational Alert', `
                    <p>Provide resolution steps taken to close the operational anomaly:</p>
                    <textarea id="resolution-note-input" class="login-form" style="width: 100%; height: 80px; padding: 10px; margin-top: 10px; background: rgba(0,0,0,0.3); border:1px solid var(--border-steel); border-radius:6px; color:#fff;" placeholder="Re-calibrated electricity reading meters."></textarea>
                `, () => {
                    const note = document.getElementById('resolution-note-input').value.trim();
                    if (!note) {
                        showToast('Resolution details are required to close this alert.', 'error');
                        return false;
                    }
                    submitAlertAction(id, 'RESOLVED', note);
                });
            });
        });
    }

    let currentModalConfirmCallback = null;
    
    function showActionModal(title, bodyHtml, onConfirm) {
        dom.modalTitle.textContent = title;
        dom.modalBodyContent.innerHTML = bodyHtml;
        currentModalConfirmCallback = onConfirm;
        dom.actionModal.classList.remove('hidden');
    }

    function closeActionModal() {
        dom.actionModal.classList.add('hidden');
        currentModalConfirmCallback = null;
    }

    async function submitAlertAction(alertId, action, note = '') {
        try {
            dom.modalConfirm.disabled = true;
            dom.modalConfirm.textContent = 'Processing...';

            const response = await apiFetch('/api/v1/md/dashboard/alerts/', {
                method: 'POST',
                body: JSON.stringify({
                    alert_id: alertId,
                    action: action,
                    note: note
                })
            });

            if (response.status === 200) {
                showToast(`Successfully processed action [${action}]`, 'success');
                logAuditEvent('alert_action', { alertId, action });
                closeActionModal();
                fetchDashboardData();
            } else {
                let errText = 'Action update rejected by sub-app service.';
                try {
                    const data = await response.json();
                    if (data.detail) errText = data.detail;
                } catch (_) {}
                showToast(errText, 'error');
            }
        } catch (e) {
            console.error('Failed to submit action', e);
            showToast('Downstream service connection failure.', 'error');
        } finally {
            dom.modalConfirm.disabled = false;
            dom.modalConfirm.textContent = 'Confirm Action';
        }
    }

    // --- Dynamic Inline SVG Chart Renderer ---
    function renderChart() {
        if (!state.summary || !state.summary.trends) return;

        const containerWidth = dom.svgFinancialChart.parentElement.clientWidth || 600;
        dom.svgFinancialChart.setAttribute('viewBox', `0 0 ${containerWidth} 220`);

        const lines = dom.svgFinancialChart.querySelectorAll('.chart-grid-line');
        lines.forEach(line => line.setAttribute('x2', containerWidth));

        let xLabels = [];
        let revenueData = [];
        let expenseData = [];
        let profitData = [];

        const buFilter = document.getElementById('filter-bu').value;
        const dateRangeFilter = document.getElementById('filter-date-range').value;

        // Align coordinates based on active date filter
        const isDaily = dateRangeFilter === '7D' || dateRangeFilter === '30D';

        if (isDaily) {
            let trends = state.summary.trends.daily || [];
            const limit = dateRangeFilter === '30D' ? 30 : 7;
            if (trends.length > limit) {
                trends = trends.slice(-limit);
            }
            
            trends.forEach(item => {
                const d = new Date(item.date);
                const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
                const dateLabel = d.getDate();
                xLabels.push(limit === 7 ? dayLabel : dateLabel);

                let rev = item.revenue;
                let exp = item.expense;

                if (buFilter === 'HR') {
                    rev = 0.0;
                    exp = item.expense - (item.revenue * 0.40);
                } else if (buFilter === 'THEATER') {
                    exp = item.revenue * 0.40;
                }

                revenueData.push(rev);
                expenseData.push(exp);
                profitData.push(rev - exp);
            });
        } else {
            let trends = state.summary.trends.monthly || [];
            if (trends.length > 6) {
                trends = trends.slice(-6);
            }
            trends.forEach(item => {
                const d = new Date(item.month + '-02');
                const monthLabel = d.toLocaleDateString('en-US', { month: 'short' });
                xLabels.push(monthLabel);

                let rev = item.revenue;
                let exp = item.expense;

                if (buFilter === 'HR') {
                    rev = 0.0;
                    exp = item.expense - (item.revenue * 0.40);
                } else if (buFilter === 'THEATER') {
                    exp = item.revenue * 0.40;
                }

                revenueData.push(rev);
                expenseData.push(exp);
                profitData.push(rev - exp);
            });
        }

        const pointsCount = revenueData.length;
        if (pointsCount === 0) return;

        const maxVal = Math.max(...revenueData, ...expenseData, 1000);
        
        const yLabels = dom.svgFinancialChart.parentElement.previousElementSibling.querySelectorAll('.y-label');
        if (yLabels.length === 3) {
            yLabels[0].textContent = `₹${Math.round(maxVal / 1000)}K`;
            yLabels[1].textContent = `₹${Math.round((maxVal / 2) / 1000)}K`;
            yLabels[2].textContent = '0';
        }

        dom.chartXLabels.innerHTML = '';
        xLabels.forEach(label => {
            const span = document.createElement('span');
            span.textContent = label;
            dom.chartXLabels.appendChild(span);
        });

        const xStep = containerWidth / (pointsCount - 1 || 1);
        const yMax = 200;
        const yMin = 20;
        const plotHeight = yMax - yMin;

        function getPoints(dataset) {
            return dataset.map((val, idx) => {
                const x = idx * xStep;
                const clampedVal = Math.max(0, val);
                const y = yMax - (clampedVal / maxVal) * plotHeight;
                return { x, y };
            });
        }

        const revPoints = getPoints(revenueData);
        const expPoints = getPoints(expenseData);
        const profPoints = getPoints(profitData);

        function drawBezierPath(points) {
            if (points.length === 0) return '';
            let path = `M ${points[0].x} ${points[0].y}`;
            for (let i = 0; i < points.length - 1; i++) {
                const p0 = points[i];
                const p1 = points[i + 1];
                const cpX1 = p0.x + xStep / 2;
                const cpY1 = p0.y;
                const cpX2 = p1.x - xStep / 2;
                const cpY2 = p1.y;
                path += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
            }
            return path;
        }

        const revPath = drawBezierPath(revPoints);
        const expPath = drawBezierPath(expPoints);
        const profPath = drawBezierPath(profPoints);

        let nodesHtml = `
            <defs>
                <linearGradient id="rev-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="var(--clr-emerald)" stop-opacity="0.12"/>
                    <stop offset="100%" stop-color="var(--clr-emerald)" stop-opacity="0.0"/>
                </linearGradient>
                <linearGradient id="prof-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="var(--clr-cobalt)" stop-opacity="0.12"/>
                    <stop offset="100%" stop-color="var(--clr-cobalt)" stop-opacity="0.0"/>
                </linearGradient>
            </defs>
        `;

        if (revPoints.length > 0) {
            nodesHtml += `<path d="${revPath} L ${revPoints[revPoints.length - 1].x} ${yMax} L ${revPoints[0].x} ${yMax} Z" fill="url(#rev-gradient)" />`;
        }
        if (profPoints.length > 0) {
            nodesHtml += `<path d="${profPath} L ${profPoints[profPoints.length - 1].x} ${yMax} L ${profPoints[0].x} ${yMax} Z" fill="url(#prof-gradient)" />`;
        }

        nodesHtml += `<path d="${revPath}" class="chart-line chart-line-revenue" />`;
        nodesHtml += `<path d="${expPath}" class="chart-line chart-line-expense" />`;
        nodesHtml += `<path d="${profPath}" class="chart-line chart-line-profit" />`;

        const drawNodes = (points, dotClass) => {
            let dots = '';
            points.forEach(p => {
                dots += `<circle cx="${p.x}" cy="${p.y}" class="chart-dot ${dotClass}" />`;
            });
            return dots;
        };

        nodesHtml += drawNodes(revPoints, 'dot-revenue');
        nodesHtml += drawNodes(expPoints, 'dot-expense');
        nodesHtml += drawNodes(profPoints, 'dot-profit');

        dom.chartDynamicGroup.innerHTML = nodesHtml;
    }

    // --- Automatic Refresh Control ---
    function startAutoRefresh() {
        stopAutoRefresh();
        state.syncIntervalId = setInterval(() => {
            fetchDashboardData();
        }, 60000);
    }

    function stopAutoRefresh() {
        if (state.syncIntervalId) {
            clearInterval(state.syncIntervalId);
            state.syncIntervalId = null;
        }
    }

    // --- Event Bindings & Listeners ---
    function bindEvents() {
        dom.loginForm.addEventListener('submit', handleLogin);
        dom.logoutButton.addEventListener('click', logout);
        
        dom.refreshButton.addEventListener('click', () => {
            fetchDashboardData();
            showToast('Platform Sync Triggered', 'info');
        });

        document.querySelectorAll('.btn-retry-bu').forEach(btn => {
            btn.addEventListener('click', () => {
                const bu = btn.getAttribute('data-bu');
                showToast(`Re-attaching integration bridge for ${bu}...`, 'info');
                fetchDashboardData();
            });
        });

        // Charts daily/monthly summaries toggles
        dom.chartTabDaily.addEventListener('click', () => {
            dom.chartTabDaily.classList.add('active');
            dom.chartTabMonthly.classList.remove('active');
            state.chartTab = 'daily';
            const filterDateRange = document.getElementById('filter-date-range');
            if (filterDateRange) filterDateRange.value = '7D';
            renderChart();
        });

        dom.chartTabMonthly.addEventListener('click', () => {
            dom.chartTabMonthly.classList.add('active');
            dom.chartTabDaily.classList.remove('active');
            state.chartTab = 'monthly';
            const filterDateRange = document.getElementById('filter-date-range');
            if (filterDateRange) filterDateRange.value = '6M';
            renderChart();
        });

        // Interactive select filters in HTML
        const filterBu = document.getElementById('filter-bu');
        if (filterBu) {
            filterBu.addEventListener('change', () => {
                logAuditEvent('filter_change', { filter: 'business_unit', value: filterBu.value });
                renderSummary(state.summary);
                renderChart();
                renderAlerts(state.alerts);
            });
        }

        const filterDateRange = document.getElementById('filter-date-range');
        if (filterDateRange) {
            filterDateRange.addEventListener('change', () => {
                logAuditEvent('filter_change', { filter: 'date_range', value: filterDateRange.value });
                if (filterDateRange.value === '6M') {
                    dom.chartTabMonthly.classList.add('active');
                    dom.chartTabDaily.classList.remove('active');
                    state.chartTab = 'monthly';
                } else {
                    dom.chartTabDaily.classList.add('active');
                    dom.chartTabMonthly.classList.remove('active');
                    state.chartTab = 'daily';
                }
                renderChart();
            });
        }

        // Clickable KPI cards deep-linking
        const kpiRevenue = document.getElementById('kpi-card-revenue');
        if (kpiRevenue) {
            kpiRevenue.addEventListener('click', () => {
                logAuditEvent('kpi_drill_down', { metric: 'revenue', destination: 'Theater ERP Finance' });
                window.open(`http://localhost:5173/finance?token=${state.tokens.access}&refresh=${state.tokens.refresh}`, '_blank');
            });
            kpiRevenue.title = "Drill down to Theater ERP Finance & Revenue dashboard";
        }

        const kpiExpense = document.getElementById('kpi-card-expense');
        if (kpiExpense) {
            kpiExpense.addEventListener('click', () => {
                logAuditEvent('kpi_drill_down', { metric: 'expense', destination: 'HR App Payroll' });
                window.open(`http://localhost:8001/payroll/?token=${state.tokens.access}`, '_blank');
            });
            kpiExpense.title = "Drill down to HR App Payroll & Expenses";
        }

        const kpiProfit = document.getElementById('kpi-card-profit');
        if (kpiProfit) {
            kpiProfit.addEventListener('click', () => {
                logAuditEvent('kpi_drill_down', { metric: 'profit', destination: 'Theater ERP Finance' });
                window.open(`http://localhost:5173/finance?token=${state.tokens.access}&refresh=${state.tokens.refresh}`, '_blank');
            });
            kpiProfit.title = "Drill down to Theater ERP Finance & Margin logs";
        }

        const kpiApprovals = document.getElementById('kpi-card-approvals');
        if (kpiApprovals) {
            kpiApprovals.addEventListener('click', () => {
                logAuditEvent('kpi_drill_down', { metric: 'approvals', destination: 'HR App Leaves' });
                window.open(`http://localhost:8001/leave/?token=${state.tokens.access}`, '_blank');
            });
            kpiApprovals.title = "Drill down to HR App Leave approval queue";
        }

        // Clicking trendline chart container deep-linking
        const chartCard = document.getElementById('chart-card-finance');
        if (chartCard) {
            chartCard.addEventListener('click', (e) => {
                if (e.target.closest('.trend-tabs')) return;
                logAuditEvent('chart_drill_down', { destination: 'Theater ERP Finance' });
                window.open(`http://localhost:5173/finance?token=${state.tokens.access}&refresh=${state.tokens.refresh}`, '_blank');
            });
            chartCard.title = "Drill down to Theater ERP Finance reports";
        }

        // Clicking Business Unit cards deep-linking
        if (dom.buCardHr) {
            dom.buCardHr.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                logAuditEvent('bu_card_drill_down', { module: 'HR' });
                window.open(`http://localhost:8001/dashboard/?token=${state.tokens.access}`, '_blank');
            });
            dom.buCardHr.title = "Drill down to HR Portal dashboard";
        }

        if (dom.buCardTheater) {
            dom.buCardTheater.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                logAuditEvent('bu_card_drill_down', { module: 'THEATER' });
                window.open(`http://localhost:5173/dashboard?token=${state.tokens.access}&refresh=${state.tokens.refresh}`, '_blank');
            });
            dom.buCardTheater.title = "Drill down to Theater ERP dashboard";
        }

        dom.alertFilters.forEach(chip => {
            chip.addEventListener('click', () => {
                dom.alertFilters.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                state.alertFilter = chip.getAttribute('data-filter');
                renderAlerts(state.alerts);
            });
        });

        dom.sidebarToggle.addEventListener('click', () => {
            dom.sidebar.classList.toggle('collapsed');
            const isCollapsed = dom.sidebar.classList.contains('collapsed');
            localStorage.setItem('aec_sidebar_collapsed', isCollapsed ? 'true' : 'false');
            setTimeout(renderChart, 350);
        });

        dom.modalClose.addEventListener('click', closeActionModal);
        dom.modalCancel.addEventListener('click', closeActionModal);
        
        dom.modalConfirm.addEventListener('click', () => {
            if (currentModalConfirmCallback) {
                currentModalConfirmCallback();
            }
        });

        dom.actionModal.addEventListener('click', (e) => {
            if (e.target === dom.actionModal) {
                closeActionModal();
            }
        });

        window.addEventListener('resize', () => {
            if (state.user && state.user.role === 'MD') {
                renderChart();
            }
        });
    }

    // --- Init ---
    function init() {
        bindEvents();
        
        const isCollapsed = localStorage.getItem('aec_sidebar_collapsed') === 'true';
        if (isCollapsed) {
            dom.sidebar.classList.add('collapsed');
        }

        checkAuthState();
    }

    document.addEventListener('DOMContentLoaded', init);

})();
