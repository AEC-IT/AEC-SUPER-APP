from django.urls import path
from module_registry.views import PlatformModulesListView

urlpatterns = [
    path('platform/modules/', PlatformModulesListView.as_view(), name='platform_modules_list'),
]
