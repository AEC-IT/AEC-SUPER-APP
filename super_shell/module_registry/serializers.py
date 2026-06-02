from rest_framework import serializers
from module_registry.models import SuperAppModule

class SuperAppModuleSerializer(serializers.ModelSerializer):
    frontend_url = serializers.SerializerMethodField()

    class Meta:
        model = SuperAppModule
        fields = [
            'id', 
            'module_key', 
            'module_name', 
            'display_name', 
            'description', 
            'route_slug', 
            'api_base_url', 
            'frontend_url',
            'icon', 
            'display_order', 
            'is_active', 
            'role_access'
        ]

    def get_frontend_url(self, obj):
        from django.conf import settings
        if obj.module_key == 'HR':
            return getattr(settings, 'HR_FRONTEND_URL', 'http://localhost:8001')
        elif obj.module_key == 'THEATER':
            return getattr(settings, 'THEATER_FRONTEND_URL', 'http://localhost:5173')
        return '#'
