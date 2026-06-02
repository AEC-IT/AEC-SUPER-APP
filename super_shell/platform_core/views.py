from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView
from platform_core.serializers import SuperAppTokenObtainPairSerializer

class SuperAppTokenObtainPairView(TokenObtainPairView):
    serializer_class = SuperAppTokenObtainPairSerializer


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        tenant = getattr(user, 'tenant', None)
        
        tenant_data = None
        if tenant:
            tenant_data = {
                'id': tenant.id,
                'name': tenant.name,
                'slug': tenant.slug,
                'plan': tenant.plan,
                'currency': tenant.currency,
                'timezone': tenant.timezone,
            }
            
        return Response({
            'id': user.id,
            'email': user.email,
            'full_name': getattr(user, 'full_name', '') or user.email,
            'role': getattr(user, 'role', 'STAFF'),
            'tenant': tenant_data,
        })


class HomeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        tenant = getattr(request, 'tenant', None)
        tenant_name = tenant.name if tenant else 'No Tenant'
        
        return Response({
            'message': f"Welcome to the AEC Super App platform shell, {getattr(user, 'full_name', '') or user.email}!",
            'tenant_context': {
                'id': tenant.id if tenant else None,
                'name': tenant_name,
                'slug': tenant.slug if tenant else None,
            },
            'user_context': {
                'email': user.email,
                'role': getattr(user, 'role', 'STAFF'),
            }
        })


class NotificationsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Placeholder notification data
        return Response([
            {
                'id': 1,
                'title': 'Welcome to AEC Super App',
                'content': 'You have successfully logged in to the new consolidated super app launcher.',
                'type': 'info',
                'created_at': '2026-05-22T10:00:00Z',
                'is_read': False,
            },
            {
                'id': 2,
                'title': 'Staging Environment Ready',
                'content': 'All downstream modules (HR and Theater) are now linked successfully.',
                'type': 'system',
                'created_at': '2026-05-22T12:00:00Z',
                'is_read': False,
            }
        ])


from django.views.generic import TemplateView

class DashboardView(TemplateView):
    template_name = "platform_core/dashboard.html"


class PlatformAuditLogView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        import logging
        audit_logger = logging.getLogger('aec.audit')
        user = request.user
        data = request.data

        audit_logger.info(f"AUDIT EVENT - User: {user.email} - Action: {data.get('action')} - Details: {data.get('details')}")
        return Response({"status": "logged"}, status=200)

