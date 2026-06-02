from rest_framework_simplejwt.tokens import AccessToken
from django.contrib.auth import login
from django.shortcuts import redirect
from core.models import User
import logging

logger = logging.getLogger(__name__)

class SSOAuthenticationMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        token_str = request.GET.get('token')
        if token_str:
            try:
                # Decode access token
                access_token = AccessToken(token_str)
                email = access_token.get('email')
                if email:
                    try:
                        user = User.objects.get(email=email, is_active=True)
                        # Automatically log in using Django session
                        user.backend = 'django.contrib.auth.backends.ModelBackend'
                        login(request, user)
                    except User.DoesNotExist:
                        logger.error(f"SSO user with email {email} does not exist in HR database.")
                
                # Redirect to the same path but strip the token query param
                path = request.path
                query_params = request.GET.copy()
                query_params.pop('token', None)
                query_params.pop('refresh', None)
                if query_params:
                    path += '?' + query_params.urlencode()
                return redirect(path)
            except Exception as e:
                logger.error(f"SSO automatic login failed: {e}")
                
        return self.get_response(request)
