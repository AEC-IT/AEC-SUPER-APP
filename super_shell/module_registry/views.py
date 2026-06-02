from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.tenants.models import TenantModule
from module_registry.models import SuperAppModule
from module_registry.serializers import SuperAppModuleSerializer

class PlatformModulesListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        tenant = getattr(request, 'tenant', None) or getattr(user, 'tenant', None)
        
        # 1. Filter by is_active = True
        queryset = SuperAppModule.objects.filter(is_active=True)
        
        # 2. Filter by Tenant availability
        if tenant:
            # Get enabled modules for this tenant
            enabled_keys = TenantModule.objects.filter(
                tenant=tenant, 
                is_enabled=True
            ).values_list('module_key', flat=True)
            
            queryset = queryset.filter(module_key__in=enabled_keys)
        else:
            queryset = queryset.none()

        # 3. Filter by role_access
        user_role = getattr(user, 'role', 'STAFF')
        accessible_modules = []
        for module in queryset:
            # If role_access is empty, assume accessible, otherwise check if user's role is in the list
            if not module.role_access or user_role in module.role_access:
                accessible_modules.append(module)
                
        serializer = SuperAppModuleSerializer(accessible_modules, many=True)
        return Response(serializer.data)
