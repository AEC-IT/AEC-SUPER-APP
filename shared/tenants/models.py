"""
shared.tenants.models — Re-exports the canonical Tenant and TenantModule models.

The actual Django app_label is 'tenants' and migrations live in:
  Theater_ERP/apps/tenants/migrations/

Do NOT define new models here. Do NOT run makemigrations in this package.
"""
from apps.tenants.models import Tenant, TenantModule  # noqa: F401

__all__ = ['Tenant', 'TenantModule']
