from unittest.mock import patch
import requests
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from apps.tenants.models import Tenant, TenantModule
from apps.accounts.models import User
from module_registry.models import SuperAppModule

class SuperAppTestCase(APITestCase):
    def setUp(self):
        # 1. Create Tenant
        self.tenant = Tenant.objects.create(
            name="AEC Corporates",
            slug="aec-corporates",
            plan="ENTERPRISE",
            currency="INR",
            timezone="Asia/Kolkata"
        )
        
        # 2. Create Users
        self.md_user = User.objects.create_user(
            email="md@aec.com",
            password="password123",
            full_name="MD Manager",
            role="MD",
            tenant=self.tenant
        )
        self.staff_user = User.objects.create_user(
            email="staff@aec.com",
            password="password123",
            full_name="Staff Member",
            role="STAFF",
            tenant=self.tenant
        )

        # 3. Create Super App Modules
        self.hr_module = SuperAppModule.objects.create(
            module_key="HR",
            module_name="Human Resources",
            display_name="HR Portal",
            route_slug="hr-portal",
            api_base_url="http://localhost:8001",
            is_active=True,
            role_access=["MD", "ADMIN"]
        )
        self.theater_module = SuperAppModule.objects.create(
            module_key="THEATER",
            module_name="Theater ERP",
            display_name="Theater ERP",
            route_slug="theater-erp",
            api_base_url="http://localhost:8002",
            is_active=True,
            role_access=["MD", "ADMIN", "STAFF"]
        )

        # 4. Enable Modules for Tenant
        TenantModule.objects.create(tenant=self.tenant, module_key="HR", is_enabled=True)
        TenantModule.objects.create(tenant=self.tenant, module_key="THEATER", is_enabled=True)

    def test_auth_login(self):
        url = reverse('token_obtain_pair')
        response = self.client.post(url, {
            'email': 'md@aec.com',
            'password': 'password123'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertEqual(response.data['role'], 'MD')
        self.assertEqual(response.data['tenant_slug'], 'aec-corporates')

    def test_platform_me(self):
        self.client.force_authenticate(user=self.md_user)
        url = reverse('platform_me')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['email'], 'md@aec.com')
        self.assertEqual(response.data['role'], 'MD')
        self.assertEqual(response.data['tenant']['slug'], 'aec-corporates')

    def test_module_registry_filtering(self):
        # Authenticate as STAFF - should only see THEATER because HR requires MD/ADMIN
        self.client.force_authenticate(user=self.staff_user)
        url = reverse('platform_modules_list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        module_keys = [mod['module_key'] for mod in response.data]
        self.assertIn('THEATER', module_keys)
        self.assertNotIn('HR', module_keys)

        # Authenticate as MD - should see both HR and THEATER
        self.client.force_authenticate(user=self.md_user)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        module_keys = [mod['module_key'] for mod in response.data]
        self.assertIn('THEATER', module_keys)
        self.assertIn('HR', module_keys)

    @patch('requests.get')
    def test_md_dashboard_summary_success(self, mock_get):
        self.client.force_authenticate(user=self.md_user)
        
        # Configure mocked API responses
        def mock_api_calls(url, *args, **kwargs):
            class MockResponse:
                def __init__(self, json_data, status_code):
                    self.json_data = json_data
                    self.status_code = status_code
                    self.text = str(json_data)
                def json(self):
                    return self.json_data
            
            if "hr/dashboard/summary" in url:
                return MockResponse({
                    'active_employees': 45,
                    'leaves_today': 2,
                    'pending_approvals': 5,
                    'payroll_total': 150000.0,
                }, 200)
            elif "operations/dashboard/summary" in url:
                return MockResponse({
                    'confirmed_bookings': 120,
                    'monthly_revenue': 25000.0,
                    'open_tickets': 3,
                    'active_pm_schedules': 8,
                }, 200)
            return MockResponse({}, 404)

        mock_get.side_effect = mock_api_calls
        
        url = reverse('md_dashboard_summary')
        response = self.client.get(url, HTTP_AUTHORIZATION='Bearer testtoken')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['hr']['status'], 'ONLINE')
        self.assertEqual(response.data['hr']['active_employees'], 45)
        self.assertEqual(response.data['theater']['status'], 'ONLINE')
        self.assertEqual(response.data['theater']['confirmed_bookings'], 120)

    @patch('requests.get')
    def test_md_dashboard_summary_resilience(self, mock_get):
        self.client.force_authenticate(user=self.md_user)
        
        # Simulating HR App timeout / failure and Theater Success
        def mock_api_calls(url, *args, **kwargs):
            class MockResponse:
                def __init__(self, json_data, status_code):
                    self.json_data = json_data
                    self.status_code = status_code
                    self.text = str(json_data)
                def json(self):
                    return self.json_data

            if "hr/dashboard/summary" in url:
                raise requests.exceptions.Timeout("Connection timed out")
            elif "operations/dashboard/summary" in url:
                return MockResponse({
                    'confirmed_bookings': 120,
                    'monthly_revenue': 25000.0,
                    'open_tickets': 3,
                    'active_pm_schedules': 8,
                }, 200)
            return MockResponse({}, 404)

        mock_get.side_effect = mock_api_calls
        
        url = reverse('md_dashboard_summary')
        response = self.client.get(url, HTTP_AUTHORIZATION='Bearer testtoken')
        
        # View should NOT crash and should return 200 OK
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['hr']['status'], 'OFFLINE')
        self.assertIsNone(response.data['hr']['active_employees'])
        self.assertEqual(response.data['theater']['status'], 'ONLINE')
        self.assertEqual(response.data['theater']['confirmed_bookings'], 120)

    @patch('requests.get')
    def test_md_dashboard_alerts_aggregation(self, mock_get):
        self.client.force_authenticate(user=self.md_user)
        
        def mock_api_calls(url, *args, **kwargs):
            class MockResponse:
                def __init__(self, json_data, status_code):
                    self.json_data = json_data
                    self.status_code = status_code
                    self.text = str(json_data)
                def json(self):
                    return self.json_data

            if "hr/leaves" in url:
                return MockResponse([
                    {
                        'id': 101,
                        'employee_name': 'Alice Smith',
                        'leave_type': 'CASUAL',
                        'start_date': '2026-05-25',
                        'end_date': '2026-05-26',
                        'reason': 'Medical',
                        'status': 'PENDING',
                        'created_at': '2026-05-22T09:00:00Z'
                    }
                ], 200)
            elif "operations/alerts" in url:
                return MockResponse([
                    {
                        'id': 202,
                        'alert_type': 'LOW_STOCK',
                        'source_module': 'Inventory',
                        'severity': 'CRITICAL',
                        'triggered_time': '2026-05-22T09:30:00Z',
                        'reference_record': 'Item-99',
                        'status': 'TRIGGERED'
                    }
                ], 200)
            return MockResponse([], 404)

        mock_get.side_effect = mock_api_calls
        
        url = reverse('md_dashboard_alerts')
        response = self.client.get(url, HTTP_AUTHORIZATION='Bearer testtoken')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        
        # Verify sorting (theater alert is at 09:30:00Z, hr leave at 09:00:00Z)
        # So theater alert should be first in descending order
        self.assertEqual(response.data[0]['id'], 'theater-alert-202')
        self.assertEqual(response.data[0]['severity'], 'CRITICAL')
        self.assertEqual(response.data[1]['id'], 'hr-leave-101')

    def test_platform_audit_logging(self):
        self.client.force_authenticate(user=self.md_user)
        url = reverse('platform_audit_logs')
        payload = {
            'action': 'test_action',
            'details': {'key': 'value'}
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'logged')

    @patch('requests.get')
    def test_md_dashboard_summary_trends(self, mock_get):
        self.client.force_authenticate(user=self.md_user)
        
        def mock_api_calls(url, *args, **kwargs):
            class MockResponse:
                def __init__(self, json_data, status_code):
                    self.json_data = json_data
                    self.status_code = status_code
                    self.text = str(json_data)
                def json(self):
                    return self.json_data
            
            if "hr/dashboard/summary" in url:
                return MockResponse({
                    'active_employees': 45,
                    'leaves_today': 2,
                    'pending_approvals': 5,
                    'payroll_total': 150000.0,
                    'monthly_payroll_history': [
                        {'month': '2026-05', 'payroll': 150000.0}
                    ]
                }, 200)
            elif "operations/dashboard/summary" in url:
                return MockResponse({
                    'confirmed_bookings': 120,
                    'monthly_revenue': 25000.0,
                    'open_tickets': 3,
                    'active_pm_schedules': 8,
                    'daily_revenue': [
                        {'date': '2026-05-23', 'revenue': 1000.0}
                    ],
                    'monthly_revenue_history': [
                        {'month': '2026-05', 'revenue': 25000.0}
                    ]
                }, 200)
            return MockResponse({}, 404)

        mock_get.side_effect = mock_api_calls
        
        url = reverse('md_dashboard_summary')
        response = self.client.get(url, HTTP_AUTHORIZATION='Bearer testtoken')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('trends', response.data)
        
        # Verify Daily Trend calculation
        daily_trends = response.data['trends']['daily']
        self.assertTrue(len(daily_trends) > 0)
        self.assertEqual(daily_trends[-1]['date'], '2026-05-23')
        self.assertEqual(daily_trends[-1]['revenue'], 1000.0)
        # Daily expense = (150000 / 30) + (1000 * 0.4) = 5000 + 400 = 5400.0
        self.assertEqual(daily_trends[-1]['expense'], 5400.0)
        # Profit = 1000 - 5400 = -4400.0
        self.assertEqual(daily_trends[-1]['profit'], -4400.0)

        # Verify Monthly Trend calculation
        monthly_trends = response.data['trends']['monthly']
        self.assertTrue(len(monthly_trends) > 0)
        self.assertEqual(monthly_trends[-1]['month'], '2026-05')
        self.assertEqual(monthly_trends[-1]['revenue'], 25000.0)
        # Monthly expense = 150000 + (25000 * 0.4) = 150000 + 10000 = 160000.0
        self.assertEqual(monthly_trends[-1]['expense'], 160000.0)
        # Profit = 25000 - 160000 = -135000.0
        self.assertEqual(monthly_trends[-1]['profit'], -135000.0)
