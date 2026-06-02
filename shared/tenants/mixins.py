"""
shared.tenants.mixins — Re-exports all tenant scoping and audit mixins.

Available mixins:
  TenantQuerysetMixin      — Auto-scopes ViewSet queryset to request.tenant
  TenantCreateMixin        — Auto-stamps tenant + entered_by on creates/updates
  TenantObjectGuardMixin   — Returns 404 (not 403) for cross-tenant object access
  TenantSafeMixin          — Combined: Queryset + ObjectGuard + Create (standard use)
  AuditShieldMixin         — Blocks STAFF deletes, logs create/update/delete to ChangeLog
  TenantAuditMixin         — Combined: Queryset + ObjectGuard + AuditShield (full production)
  HasTenantPermission      — DRF Permission class: rejects orphaned accounts (no tenant)

Available helpers:
  get_tenant_from_request  — Authoritative tenant resolver from a DRF request

Usage:
    from shared.tenants.mixins import TenantSafeMixin, TenantAuditMixin
    from shared.tenants.mixins import get_tenant_from_request

    class MyViewSet(TenantSafeMixin, viewsets.ModelViewSet):
        queryset = MyModel.objects.all()
        ...
"""
from apps.tenants.mixins import (  # noqa: F401
    get_tenant_from_request,
    TenantQuerysetMixin,
    TenantCreateMixin,
    TenantObjectGuardMixin,
    TenantSafeMixin,
    AuditShieldMixin,
    TenantAuditMixin,
    HasTenantPermission,
)

__all__ = [
    'get_tenant_from_request',
    'TenantQuerysetMixin',
    'TenantCreateMixin',
    'TenantObjectGuardMixin',
    'TenantSafeMixin',
    'AuditShieldMixin',
    'TenantAuditMixin',
    'HasTenantPermission',
]
