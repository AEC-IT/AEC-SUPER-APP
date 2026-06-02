from django.db import migrations
from django.contrib.auth.hashers import make_password

def create_restaurant_tenant(apps, schema_editor):
    Tenant = apps.get_model('tenants', 'Tenant')
    TenantModule = apps.get_model('tenants', 'TenantModule')
    User = apps.get_model('accounts', 'User')
    IntegrationConnector = apps.get_model('integrations', 'IntegrationConnector')

    # 1. Disable CAFE and PETPOOJA modules for aec-cinemas (tenant ID 1)
    try:
        aec = Tenant.objects.get(id=1)
        TenantModule.objects.filter(tenant=aec, module_key='CAFE').update(is_enabled=False)
        TenantModule.objects.filter(tenant=aec, module_key='PETPOOJA').update(is_enabled=False)
    except Tenant.DoesNotExist:
        pass

    # 2. Create the 'resturent' tenant
    restaurant_tenant, created = Tenant.objects.get_or_create(
        slug='resturent',
        defaults={
            'name': 'resturent',
            'plan': 'pro',
            'timezone': 'Asia/Kolkata',
            'currency': 'INR',
            'working_days_per_month': 26
        }
    )

    # 3. Enable CAFE and PETPOOJA modules for the 'resturent' tenant
    TenantModule.objects.update_or_create(
        tenant=restaurant_tenant,
        module_key='CAFE',
        defaults={'is_enabled': True}
    )
    TenantModule.objects.update_or_create(
        tenant=restaurant_tenant,
        module_key='PETPOOJA',
        defaults={'is_enabled': True}
    )

    # 4. Create admin@resturent.com user
    hashed_password = make_password('AEC@resturent2026')
    User.objects.update_or_create(
        email='admin@resturent.com',
        defaults={
            'full_name': 'Restaurant Admin',
            'role': 'MD',
            'tenant': restaurant_tenant,
            'password': hashed_password,
            'is_active': True
        }
    )

    # 5. Create default active IntegrationConnector for Petpooja on the resturent tenant
    IntegrationConnector.objects.update_or_create(
        tenant=restaurant_tenant,
        connector_name='PETPOOJA',
        defaults={
            'status': 'ACTIVE',
            'auth_type': 'API_KEY',
            'sync_frequency': 'HOURLY',
            'is_active': True,
            'credentials_json': {
                'base_url': 'https://api.petpooja.com/v1',
                'app_key': 'PP-AEC-9281',
                'app_secret': 'PP-SECRET-9281'
            }
        }
    )

def reverse_create(apps, schema_editor):
    Tenant = apps.get_model('tenants', 'Tenant')
    TenantModule = apps.get_model('tenants', 'TenantModule')
    User = apps.get_model('accounts', 'User')
    IntegrationConnector = apps.get_model('integrations', 'IntegrationConnector')

    # Enable CAFE back for aec-cinemas
    try:
        aec = Tenant.objects.get(id=1)
        TenantModule.objects.filter(tenant=aec, module_key='CAFE').update(is_enabled=True)
    except Tenant.DoesNotExist:
        pass

    # Delete resturent tenant and its data
    try:
        res = Tenant.objects.get(slug='resturent')
        User.objects.filter(tenant=res).delete()
        IntegrationConnector.objects.filter(tenant=res).delete()
        TenantModule.objects.filter(tenant=res).delete()
        res.delete()
    except Tenant.DoesNotExist:
        pass

class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0004_seed_aec_modules'),
        ('accounts', '0002_add_tenant_fk'),
        ('integrations', '0002_integrationconnector'),
    ]

    operations = [
        migrations.RunPython(create_restaurant_tenant, reverse_create),
    ]
