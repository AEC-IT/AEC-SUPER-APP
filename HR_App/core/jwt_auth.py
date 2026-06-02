from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, AuthenticationFailed
from core.models import User
from apps.tenants.models import Tenant, TenantModule

class SharedJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        header = self.get_header(request)
        if header is None:
            return None

        raw_token = self.get_raw_token(header)
        if raw_token is None:
            return None

        validated_token = self.get_validated_token(raw_token)
        user = self.get_user(validated_token)
        
        # Set up tenant context on the request
        tenant = getattr(user, 'tenant', None)
        if tenant:
            request.tenant = tenant
            request.active_modules = set(
                TenantModule.objects.filter(
                    tenant=tenant,
                    is_enabled=True
                ).values_list('module_key', flat=True)
            )
            
        return user, validated_token

    def get_user(self, validated_token):
        email = validated_token.get('email')
        if not email:
            raise InvalidToken("Token does not contain email claim")
            
        try:
            user = User.objects.get(email=email, is_active=True)
        except User.DoesNotExist:
            raise AuthenticationFailed("User not found in HR system")
            
        return user
