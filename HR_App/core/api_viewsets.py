from rest_framework import viewsets, filters
from django_filters.rest_framework import DjangoFilterBackend
from shared.tenants.mixins import TenantSafeMixin
from core.models import EmployeeProfile, Attendance, LeaveRequest, Payroll, AuditLog
from core.serializers import (
    EmployeeProfileSerializer,
    AttendanceSerializer,
    LeaveRequestSerializer,
    PayrollSerializer,
    AuditLogSerializer
)

class EmployeeProfileViewSet(TenantSafeMixin, viewsets.ModelViewSet):
    queryset = EmployeeProfile.objects.select_related('user', 'department', 'reporting_manager__user').all()
    serializer_class = EmployeeProfileSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['department', 'probation_status', 'onboarding_status', 'is_active']
    search_fields = ['employee_id', 'user__first_name', 'user__last_name', 'user__email', 'designation']
    ordering_fields = ['employee_id', 'created_at', 'updated_at']


class AttendanceViewSet(TenantSafeMixin, viewsets.ModelViewSet):
    queryset = Attendance.objects.select_related('profile__user').all()
    serializer_class = AttendanceSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['profile', 'date', 'is_valid', 'is_late']
    ordering_fields = ['date', 'in_time', 'out_time']


class LeaveRequestViewSet(TenantSafeMixin, viewsets.ModelViewSet):
    queryset = LeaveRequest.objects.select_related('profile__user', 'approved_by').all()
    serializer_class = LeaveRequestSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['profile', 'leave_type', 'status']
    ordering_fields = ['start_date', 'end_date', 'created_at']


class PayrollViewSet(TenantSafeMixin, viewsets.ModelViewSet):
    queryset = Payroll.objects.select_related('profile__user', 'reviewed_by').all()
    serializer_class = PayrollSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['profile', 'month', 'status', 'is_locked']
    ordering_fields = ['month', 'net_salary']


class AuditLogViewSet(TenantSafeMixin, viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.select_related('profile__user', 'performed_by').all()
    serializer_class = AuditLogSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['profile', 'action', 'performed_by']
    ordering_fields = ['timestamp']


from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db.models import Sum

class HRDashboardViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        return Response({"message": "HR Dashboard API"})

    @action(detail=False, methods=['get'])
    def summary(self, request):
        tenant = getattr(request, 'tenant', None)
        today = timezone.now().date()
        
        # Base querysets
        employee_qs = EmployeeProfile.objects.filter(is_active=True)
        leave_qs = LeaveRequest.objects.filter(status='APPROVED', start_date__lte=today, end_date__gte=today)
        payroll_qs = Payroll.objects.all()
        pending_leaves_qs = LeaveRequest.objects.filter(status='PENDING')

        # Filter by tenant if tenant exists
        if tenant:
            employee_qs = employee_qs.filter(tenant=tenant)
            leave_qs = leave_qs.filter(tenant=tenant)
            payroll_qs = payroll_qs.filter(tenant=tenant)
            pending_leaves_qs = pending_leaves_qs.filter(tenant=tenant)

        # Basic calculations
        active_count = employee_qs.count()
        leaves_today = leave_qs.count()
        pending_requests_count = pending_leaves_qs.count()
        
        # Total payroll amount for current month start
        current_month_start = today.replace(day=1)
        payroll_total = payroll_qs.filter(month=current_month_start, status='FINALIZED').aggregate(total=Sum('net_salary'))['total'] or 0.0
        if payroll_total == 0.0:
            # Fallback to sum of all finalized payrolls if current month has none
            payroll_total = payroll_qs.filter(status='FINALIZED').aggregate(total=Sum('net_salary'))['total'] or 0.0

        # Last 6 months monthly payroll history
        import datetime
        monthly_payroll_history = []
        for i in range(6):
            year = today.year
            month = today.month - i
            while month <= 0:
                month += 12
                year -= 1
            month_start = datetime.date(year, month, 1)
            month_pay = payroll_qs.filter(month=month_start, status='FINALIZED').aggregate(total=Sum('net_salary'))['total'] or 0.0
            monthly_payroll_history.append({
                'month': month_start.strftime('%Y-%m'),
                'payroll': float(month_pay)
            })
        monthly_payroll_history.reverse()

        from rest_framework.response import Response
        return Response({
            'active_employees': active_count,
            'leaves_today': leaves_today,
            'pending_approvals': pending_requests_count,
            'payroll_total': float(payroll_total),
            'monthly_payroll_history': monthly_payroll_history,
        })

