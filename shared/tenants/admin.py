"""
shared.tenants.admin — Re-exports the TenantAdmin and TenantModuleAdmin classes.

These are registered on Django's admin site by the canonical app when it is
in INSTALLED_APPS. This shim allows other modules to reference the admin
classes if needed (e.g., for inline registration or customisation).
"""
from apps.tenants.admin import TenantAdmin, TenantModuleAdmin  # noqa: F401

__all__ = ['TenantAdmin', 'TenantModuleAdmin']
