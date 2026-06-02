"""
shared.tenants — Canonical multi-tenant foundation for AEC Super App.

This package is a re-export shim. The actual Django app (with migrations
and DB tables) lives in Theater_ERP/apps/tenants. This package provides
a stable, path-agnostic import surface for all AEC modules.

Usage:
    from shared.tenants.models import Tenant, TenantModule
    from shared.tenants.middleware import TenantMiddleware
    from shared.tenants.mixins import TenantSafeMixin, TenantAuditMixin
    from shared.tenants.mixins import TenantQuerysetMixin, TenantCreateMixin
    from shared.tenants.mixins import TenantObjectGuardMixin, get_tenant_from_request
"""
