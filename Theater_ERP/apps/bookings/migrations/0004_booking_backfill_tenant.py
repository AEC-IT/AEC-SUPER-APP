"""
Migration: 0004_booking_backfill_tenant

Data migration: populate Booking.tenant from Booking.show.screen.tenant
for all existing rows where tenant IS NULL.

Strategy:
- Traverses the FK chain: Booking → Show → Screen → tenant
- Runs in a single SQL UPDATE per tenant using Python loops (safe for
  moderate data volumes; replace with raw SQL if table is very large).
- Only updates rows where tenant IS NULL (idempotent / safe to re-run).
- Wraps all updates in a transaction (atomic=True per RunPython default).

Rollback: NULLs out Booking.tenant for all rows (non-destructive; the
          schema migration 0003 is what actually removes the column on
          full rollback).
"""

from django.db import migrations


def backfill_booking_tenant(apps, schema_editor):
    Booking = apps.get_model('bookings', 'Booking')
    Tenant = apps.get_model('tenants', 'Tenant')

    # Fetch all bookings that have no tenant yet
    bookings_without_tenant = Booking.objects.filter(
        tenant__isnull=True
    ).select_related('show__screen__tenant')

    updated = 0
    skipped = 0

    for booking in bookings_without_tenant.iterator(chunk_size=500):
        try:
            # Resolve tenant through show → screen → tenant
            tenant = booking.show.screen.tenant
            if tenant:
                Booking.objects.filter(pk=booking.pk).update(tenant=tenant)
                updated += 1
            else:
                skipped += 1
        except Exception as exc:
            print(f'\n  ✗ Booking #{booking.pk} ({booking.booking_ref}): {exc}')
            skipped += 1

    print(f'\n  ✓ Booking tenant backfill: {updated} updated, {skipped} skipped (no screen tenant).')


def reverse_backfill(apps, schema_editor):
    """Rollback: null out Booking.tenant for all rows."""
    Booking = apps.get_model('bookings', 'Booking')
    count = Booking.objects.filter(tenant__isnull=False).update(tenant=None)
    print(f'\n  ↩ Reversed booking tenant backfill: {count} rows nulled.')


class Migration(migrations.Migration):

    dependencies = [
        ('bookings', '0003_booking_add_tenant_fk'),
    ]

    operations = [
        migrations.RunPython(
            backfill_booking_tenant,
            reverse_backfill,
        ),
    ]
