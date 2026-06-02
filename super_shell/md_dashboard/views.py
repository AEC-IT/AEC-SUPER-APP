import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from integrations.connectors import HRAppConnector, TheaterERPConnector
from apps.tenants.models import TenantModule
from module_registry.models import SuperAppModule
from module_registry.serializers import SuperAppModuleSerializer

logger = logging.getLogger(__name__)

class MDDashboardSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if getattr(user, 'role', 'STAFF') != 'MD':
            return Response({"detail": "Only MD can access MD dashboard summary."}, status=403)

        # Get token from headers
        auth_header = request.headers.get('Authorization', None)
        token = None
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]

        # Call HR App summary
        hr_data = None
        hr_status = "OFFLINE"
        if token:
            hr_res = HRAppConnector.get_summary(token)
            if hr_res:
                hr_data = hr_res
                hr_status = "ONLINE"
                
        # Call Theater ERP summary
        theater_data = None
        theater_status = "OFFLINE"
        if token:
            theater_res = TheaterERPConnector.get_summary(token)
            if theater_res:
                theater_data = theater_res
                theater_status = "ONLINE"

        # Aggregate daily and monthly trends
        daily_trends = []
        monthly_trends = []

        # Map daily trends
        theater_daily_rev = (theater_data.get('daily_revenue') or []) if theater_data else []
        hr_monthly_pay = (hr_data.get('monthly_payroll_history') or []) if hr_data else []

        for item in theater_daily_rev:
            date_str = item.get('date')
            rev = item.get('revenue', 0.0)
            
            # Estimate daily payroll from matching monthly payroll
            ym = date_str[:7] if date_str else ""
            matching_pay = 0.0
            for pay_item in hr_monthly_pay:
                if pay_item.get('month') == ym:
                    matching_pay = pay_item.get('payroll', 0.0)
                    break
            
            daily_pay = matching_pay / 30.0
            daily_exp = daily_pay + (rev * 0.40)
            daily_profit = rev - daily_exp
            
            daily_trends.append({
                'date': date_str,
                'revenue': float(rev),
                'expense': float(daily_exp),
                'profit': float(daily_profit)
            })

        # Map monthly trends
        theater_monthly_rev = (theater_data.get('monthly_revenue_history') or []) if theater_data else []
        for item in theater_monthly_rev:
            ym = item.get('month')
            rev = item.get('revenue', 0.0)
            
            matching_pay = 0.0
            for pay_item in hr_monthly_pay:
                if pay_item.get('month') == ym:
                    matching_pay = pay_item.get('payroll', 0.0)
                    break
            
            monthly_exp = matching_pay + (rev * 0.40)
            monthly_profit = rev - monthly_exp
            
            monthly_trends.append({
                'month': ym,
                'revenue': float(rev),
                'expense': float(monthly_exp),
                'profit': float(monthly_profit)
            })

        # Fallback values if offline
        if not daily_trends:
            import datetime
            today = datetime.date.today()
            for i in range(7):
                day = today - datetime.timedelta(days=6-i)
                daily_trends.append({
                    'date': day.strftime('%Y-%m-%d'),
                    'revenue': 0.0,
                    'expense': 0.0,
                    'profit': 0.0
                })

        if not monthly_trends:
            import datetime
            today = datetime.date.today()
            for i in range(6):
                year = today.year
                month = today.month - (5-i)
                while month <= 0:
                    month += 12
                    year -= 1
                month_start = datetime.date(year, month, 1)
                monthly_trends.append({
                    'month': month_start.strftime('%Y-%m'),
                    'revenue': 0.0,
                    'expense': 0.0,
                    'profit': 0.0
                })

        # Combine response
        return Response({
            'hr': {
                'status': hr_status,
                'active_employees': hr_data.get('active_employees') if hr_data else None,
                'leaves_today': hr_data.get('leaves_today') if hr_data else None,
                'pending_approvals': hr_data.get('pending_approvals') if hr_data else None,
                'payroll_total': hr_data.get('payroll_total') if hr_data else None,
                'monthly_payroll_history': hr_monthly_pay,
            },
            'theater': {
                'status': theater_status,
                'confirmed_bookings': theater_data.get('confirmed_bookings') if theater_data else None,
                'monthly_revenue': theater_data.get('monthly_revenue') if theater_data else None,
                'open_tickets': theater_data.get('open_tickets') if theater_data else None,
                'active_pm_schedules': theater_data.get('active_pm_schedules') if theater_data else None,
                'daily_revenue': theater_daily_rev,
                'monthly_revenue_history': theater_monthly_rev,
            },
            'trends': {
                'daily': daily_trends,
                'monthly': monthly_trends,
            }
        })


class MDDashboardModulesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        tenant = getattr(request, 'tenant', None) or getattr(user, 'tenant', None)
        
        if getattr(user, 'role', 'STAFF') != 'MD':
            return Response({"detail": "Only MD can view MD dashboard modules."}, status=403)

        queryset = SuperAppModule.objects.filter(is_active=True)
        if tenant:
            enabled_keys = TenantModule.objects.filter(
                tenant=tenant, 
                is_enabled=True
            ).values_list('module_key', flat=True)
            queryset = queryset.filter(module_key__in=enabled_keys)
        else:
            queryset = queryset.none()

        # Filter modules accessible to MD
        accessible_modules = []
        for module in queryset:
            if not module.role_access or 'MD' in module.role_access:
                accessible_modules.append(module)

        serializer = SuperAppModuleSerializer(accessible_modules, many=True)
        return Response(serializer.data)


class MDDashboardAlertsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if getattr(user, 'role', 'STAFF') != 'MD':
            return Response({"detail": "Only MD can access MD dashboard alerts."}, status=403)

        auth_header = request.headers.get('Authorization', None)
        token = None
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]

        aggregated_alerts = []

        # 1. Fetch pending leaves from HR (if online)
        if token:
            hr_leaves = HRAppConnector.get_pending_leaves(token)
            if hr_leaves:
                results = hr_leaves
                if isinstance(hr_leaves, dict) and 'results' in hr_leaves:
                    results = hr_leaves['results']
                
                if isinstance(results, list):
                    for leave in results:
                        aggregated_alerts.append({
                            'id': f"hr-leave-{leave.get('id')}",
                            'module': 'HR',
                            'title': f"Leave Request: {leave.get('employee_name', 'Employee')}",
                            'description': f"Type: {leave.get('leave_type')}, Dates: {leave.get('start_date')} to {leave.get('end_date')}. Reason: {leave.get('reason')}",
                            'severity': 'WARNING',
                            'created_at': leave.get('created_at'),
                            'status': leave.get('status'),
                            'action_url': '/hr/leaves/',
                        })

        # 2. Fetch open alerts from Theater (if online)
        if token:
            theater_alerts = TheaterERPConnector.get_open_alerts(token)
            if theater_alerts:
                results = theater_alerts
                if isinstance(theater_alerts, dict) and 'results' in theater_alerts:
                    results = theater_alerts['results']
                
                if isinstance(results, list):
                    for alert in results:
                        sev = alert.get('severity', 'WARNING')
                        aggregated_alerts.append({
                            'id': f"theater-alert-{alert.get('id')}",
                            'module': 'THEATER',
                            'title': f"Operational Alert: {alert.get('alert_type')}",
                            'description': f"Module: {alert.get('source_module')}, Reference: {alert.get('reference_record')}",
                            'severity': sev,
                            'created_at': alert.get('triggered_time'),
                            'status': alert.get('status'),
                            'action_url': '/operations/alerts/',
                        })

        # Sort aggregated alerts by time descending
        def get_alert_time(a):
            val = a.get('created_at')
            return val if val else ""

        aggregated_alerts.sort(key=get_alert_time, reverse=True)

        return Response(aggregated_alerts)

    def post(self, request):
        user = request.user
        if getattr(user, 'role', 'STAFF') != 'MD':
            return Response({"detail": "Only MD can action alerts."}, status=403)

        auth_header = request.headers.get('Authorization', None)
        token = None
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]

        if not token:
            return Response({"detail": "Authorization token is required."}, status=401)

        alert_id = request.data.get('alert_id')
        action = request.data.get('action')  # APPROVED, REJECTED, ACKNOWLEDGED, RESOLVED, SNOOZED
        note = request.data.get('note')

        if not alert_id or not action:
            return Response({"detail": "alert_id and action are required."}, status=400)

        if alert_id.startswith('hr-leave-'):
            # Action a leave request in HR app
            leave_id = alert_id.replace('hr-leave-', '')
            res = HRAppConnector.action_leave(token, leave_id, action, note)
            if res:
                return Response({"status": "success", "data": res})
            return Response({"detail": "Failed to action leave request in HR module."}, status=502)

        elif alert_id.startswith('theater-alert-'):
            # Action an operational alert in Theater ERP
            theater_alert_id = alert_id.replace('theater-alert-', '')
            res = TheaterERPConnector.action_alert(token, theater_alert_id, action, note)
            if res:
                return Response({"status": "success", "data": res})
            return Response({"detail": "Failed to action alert in Theater ERP module."}, status=502)

        return Response({"detail": "Unknown alert format."}, status=400)

