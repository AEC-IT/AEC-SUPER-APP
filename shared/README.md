# AEC Super App — Shared Packages

This directory contains shared foundational code used across all AEC modules.

## Structure

```
shared/
  tenants/            ← Canonical multi-tenant foundation (re-exports from Theater_ERP)
    __init__.py
    apps.py
    models.py         ← Re-exports Tenant, TenantModule
    middleware.py     ← Re-exports TenantMiddleware
    mixins.py         ← Re-exports TenantSafeMixin, TenantAuditMixin, etc.
    admin.py          ← Re-exports admin registrations
```

## How to use in a new module

1. Add the Theater_ERP project to your `sys.path`, OR add it to your project as an installed app.
2. Import directly from `shared.tenants.*`:

```python
# In your settings.py
INSTALLED_APPS = [
    ...
    'apps.tenants',  # The actual Django app — owns migrations and DB table
    ...
]

# In your middleware
from shared.tenants.middleware import TenantMiddleware

# In your viewsets
from shared.tenants.mixins import TenantSafeMixin, TenantAuditMixin
```

## Design Principle

The `shared/tenants/` package is a **re-export shim** — it does NOT define new models
or run its own migrations. The canonical Django app that owns the DB schema is
`Theater_ERP/apps/tenants`. The `shared` package just makes imports path-agnostic
so HR_App (and future modules) can import from a stable, decoupled namespace.

## Adoption for HR_App (Phase 2)

When HR_App is ready:
1. Add `apps.tenants` from Theater_ERP to HR_App's `INSTALLED_APPS`.
2. Replace any internal tenant logic with `from shared.tenants.mixins import TenantSafeMixin`.
3. Run `python manage.py migrate` to apply the tenant schema to HR_App's Neon DB.
