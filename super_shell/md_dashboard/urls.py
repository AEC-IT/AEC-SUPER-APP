from django.urls import path
from md_dashboard.views import MDDashboardSummaryView, MDDashboardModulesView, MDDashboardAlertsView

urlpatterns = [
    path('md/dashboard/summary/', MDDashboardSummaryView.as_view(), name='md_dashboard_summary'),
    path('md/dashboard/modules/', MDDashboardModulesView.as_view(), name='md_dashboard_modules'),
    path('md/dashboard/alerts/', MDDashboardAlertsView.as_view(), name='md_dashboard_alerts'),
]
