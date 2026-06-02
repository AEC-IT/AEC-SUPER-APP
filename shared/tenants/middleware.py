"""
shared.tenants.middleware — Re-exports TenantMiddleware and TenantQuerysetMixin.

TenantMiddleware:
    WSGI/ASGI middleware that injects request.tenant and request.active_modules
    on every authenticated request by reading the user's tenant FK.

TenantQuerysetMixin:
    DRF ViewSet mixin that auto-scopes querysets to request.tenant.
    Models without a tenant field pass through unchanged.

Usage in settings.py MIDDLEWARE:
    'apps.tenants.middleware.TenantMiddleware',

OR via the shared path (future):
    'shared.tenants.middleware.TenantMiddleware',

Both resolve to the same class.
"""
from apps.tenants.middleware import TenantMiddleware, TenantQuerysetMixin  # noqa: F401

__all__ = ['TenantMiddleware', 'TenantQuerysetMixin']
