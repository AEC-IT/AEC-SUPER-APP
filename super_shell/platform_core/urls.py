from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from platform_core.views import (
    SuperAppTokenObtainPairView, MeView, HomeView, NotificationsView, PlatformAuditLogView
)

urlpatterns = [
    # Authentication
    path('auth/login/', SuperAppTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # Core Platform Context
    path('platform/me/', MeView.as_view(), name='platform_me'),
    path('platform/home/', HomeView.as_view(), name='platform_home'),
    path('platform/notifications/', NotificationsView.as_view(), name='platform_notifications'),
    path('platform/audit-logs/', PlatformAuditLogView.as_view(), name='platform_audit_logs'),
]
