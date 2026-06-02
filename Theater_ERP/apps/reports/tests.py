from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from datetime import date
from apps.tenants.models import Tenant, TenantModule
from apps.accounts.models import User
from apps.integrations.models import DistrictDCRReport

class ReportsTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        # Create tenant
        cls.tenant = Tenant.objects.create(name='Test Theater', slug='test-theater', is_active=True)
        # Enable modules
        for m in ['OPERATIONS', 'CAFE', 'FINANCE', 'SCREEN_BUILDER', 'BOOKINGS', 'PAYROLL_MIRROR', 'DISTRICT_BRIDGE']:
            TenantModule.objects.create(tenant=cls.tenant, module_key=m, is_enabled=True)
        
        # Create MD user
        cls.user = User.objects.create_user(
            email='md@test.com',
            password='testpass123!',
            full_name='MD User',
            role=User.Role.MD
        )
        cls.user.tenant = cls.tenant
        cls.user.save()

    def setUp(self):
        # Auth client
        self.client = APIClient()
        response = self.client.post('/api/auth/login/', {
            'email': self.user.email,
            'password': 'testpass123!',
        }, format='json')
        token = response.data.get('access')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

    def test_yearly_pl_view(self):
        url = reverse('report-yearly-pl')
        response = self.client.get(url, {'year': 2026})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['year'], 2026)
        self.assertIn('income', response.data)
        self.assertIn('expenses', response.data)
        self.assertIn('net_profit', response.data)

    def test_alerts_view_date_parameter(self):
        url = reverse('report-alerts')
        # Test default today
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('daily_alerts', response.data)
        self.assertIn('lamp_alerts', response.data)
        self.assertIn('total_alerts', response.data)

        # Test specific date
        response = self.client.get(url, {'date': '2026-05-18'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Test invalid date
        response = self.client.get(url, {'date': 'invalid-date'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_dcr_report_filter_date(self):
        # Create a report for today
        report_1 = DistrictDCRReport.objects.create(
            tenant=self.tenant,
            report_date=date(2026, 5, 18),
            movie_title='Movie A',
            screen_name='Screen 1',
            show_time='14:00:00',
            confidence_score=0.9
        )
        report_2 = DistrictDCRReport.objects.create(
            tenant=self.tenant,
            report_date=date(2026, 5, 19),
            movie_title='Movie B',
            screen_name='Screen 1',
            show_time='17:00:00',
            confidence_score=0.95
        )

        url = '/api/integrations/dcr/'
        response = self.client.get(url, {'report_date': '2026-05-18'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Check that only report_1 is returned
        results = response.data.get('results', response.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['movie_title'], 'Movie A')
