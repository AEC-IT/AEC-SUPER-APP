"""
Migration: 0003_booking_add_tenant_fk

Adds a nullable tenant ForeignKey to apps.bookings.Booking.
Nullable allows the migration to run against existing data safely.

The backfill (setting the actual tenant value) is done in the
next migration: 0004_booking_backfill_tenant.

Rollback: Simply removes the tenant column from the bookings table.
"""

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('bookings', '0002_bookingcorrection'),
        ('tenants', '0004_seed_aec_modules'),  # Ensures Tenant table exists
    ]

    operations = [
        migrations.AddField(
            model_name='booking',
            name='tenant',
            field=models.ForeignKey(
                blank=True,
                db_index=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='bookings',
                to='tenants.tenant',
            ),
        ),
    ]
