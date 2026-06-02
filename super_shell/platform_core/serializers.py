from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

class SuperAppTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Add custom claims
        token['email'] = user.email
        token['role'] = getattr(user, 'role', 'STAFF')
        token['full_name'] = getattr(user, 'full_name', '') or user.email
        
        tenant = getattr(user, 'tenant', None)
        if tenant:
            token['tenant_slug'] = tenant.slug
            token['tenant_id'] = tenant.id
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        # Add extra user detail fields directly to the auth response
        data['email'] = self.user.email
        data['role'] = getattr(self.user, 'role', 'STAFF')
        data['full_name'] = getattr(self.user, 'full_name', '') or self.user.email
        
        tenant = getattr(self.user, 'tenant', None)
        if tenant:
            data['tenant_slug'] = tenant.slug
            data['tenant_id'] = tenant.id
        return data
