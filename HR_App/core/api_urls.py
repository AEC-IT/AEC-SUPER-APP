from django.urls import path, include
from rest_framework.routers import DefaultRouter
from core.api_viewsets import (
    EmployeeProfileViewSet,
    AttendanceViewSet,
    LeaveRequestViewSet,
    PayrollViewSet,
    AuditLogViewSet,
    HRDashboardViewSet
)

router = DefaultRouter()
router.register(r'employees', EmployeeProfileViewSet, basename='employee')
router.register(r'attendance', AttendanceViewSet, basename='attendance')
router.register(r'leaves', LeaveRequestViewSet, basename='leave')
router.register(r'payroll', PayrollViewSet, basename='payroll')
router.register(r'audit-logs', AuditLogViewSet, basename='auditlog')
router.register(r'dashboard', HRDashboardViewSet, basename='hr-dashboard')

urlpatterns = [
    path('', include(router.urls)),
]

