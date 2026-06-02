import datetime
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework.authtoken.models import Token
from core.models import User, Department, EmployeeProfile, Attendance, LeaveRequest, Payroll, AuditLog
from apps.tenants.models import Tenant

class MultiTenantAPITestCase(APITestCase):
    def setUp(self):
        # 1. Create two distinct tenants
        self.tenant_a = Tenant.objects.create(
            id=101, name="Tenant Alpha", slug="tenant-a", plan="pro"
        )
        self.tenant_b = Tenant.objects.create(
            id=102, name="Tenant Beta", slug="tenant-b", plan="pro"
        )

        # 2. Create departments
        self.dept_a = Department.objects.create(
            name="HR", code="HR-A", tenant=self.tenant_a
        )
        self.dept_b = Department.objects.create(
            name="HR", code="HR-B", tenant=self.tenant_b
        )

        # 3. Create users
        self.user_a = User.objects.create_user(
            username="user_alpha", email="alpha@tenant.com", password="password123",
            role=User.Role.HR, tenant=self.tenant_a
        )
        self.user_b = User.objects.create_user(
            username="user_beta", email="beta@tenant.com", password="password123",
            role=User.Role.HR, tenant=self.tenant_b
        )

        # 4. Tokens
        self.token_a = Token.objects.create(user=self.user_a)
        self.token_b = Token.objects.create(user=self.user_b)

        # 5. Create employee profiles
        self.profile_a = EmployeeProfile.objects.create(
            user=self.user_a, department=self.dept_a, tenant=self.tenant_a,
            employee_id="EMP-A-001", basic_salary=50000, is_active=True, onboarding_status="VERIFIED"
        )
        self.profile_b = EmployeeProfile.objects.create(
            user=self.user_b, department=self.dept_b, tenant=self.tenant_b,
            employee_id="EMP-B-001", basic_salary=60000, is_active=True, onboarding_status="VERIFIED"
        )

        # 6. Create attendance records
        self.att_a = Attendance.objects.create(
            profile=self.profile_a, tenant=self.tenant_a,
            date=datetime.date.today(), is_valid=True
        )
        self.att_b = Attendance.objects.create(
            profile=self.profile_b, tenant=self.tenant_b,
            date=datetime.date.today(), is_valid=True
        )

        # 7. Create leave requests
        self.leave_a = LeaveRequest.objects.create(
            profile=self.profile_a, tenant=self.tenant_a,
            leave_type=LeaveRequest.LeaveType.CASUAL,
            start_date=datetime.date.today(), end_date=datetime.date.today(),
            status=LeaveRequest.Status.PENDING
        )
        self.leave_b = LeaveRequest.objects.create(
            profile=self.profile_b, tenant=self.tenant_b,
            leave_type=LeaveRequest.LeaveType.CASUAL,
            start_date=datetime.date.today(), end_date=datetime.date.today(),
            status=LeaveRequest.Status.PENDING
        )

        # 8. Create payrolls
        self.payroll_a = Payroll.objects.create(
            profile=self.profile_a, tenant=self.tenant_a,
            month=datetime.date(2026, 5, 1), basic_salary=50000, status=Payroll.Status.DRAFT
        )
        self.payroll_b = Payroll.objects.create(
            profile=self.profile_b, tenant=self.tenant_b,
            month=datetime.date(2026, 5, 1), basic_salary=60000, status=Payroll.Status.DRAFT
        )

        # 9. Create audit logs
        self.audit_a = AuditLog.objects.create(
            profile=self.profile_a, tenant=self.tenant_a,
            performed_by=self.user_a, action=AuditLog.ActionType.PROFILE_CREATED
        )
        self.audit_b = AuditLog.objects.create(
            profile=self.profile_b, tenant=self.tenant_b,
            performed_by=self.user_b, action=AuditLog.ActionType.PROFILE_CREATED
        )

    def set_auth_a(self):
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token_a.key)

    def set_auth_b(self):
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token_b.key)

    def test_employee_profile_isolation(self):
        """A user from Tenant A should not see employee profiles from Tenant B."""
        self.set_auth_a()
        
        # List view
        response = self.client.get(reverse('employee-list'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Results might be paginated or list directly
        results = response.data.get('results') if 'results' in response.data else response.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['id'], self.profile_a.id)

        # Detail view A (Allowed)
        response = self.client.get(reverse('employee-detail', args=[self.profile_a.id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Detail view B (Blocked with 404)
        response = self.client.get(reverse('employee-detail', args=[self.profile_b.id]))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_attendance_isolation(self):
        """Attendance records must be isolated by tenant."""
        self.set_auth_a()
        
        # List view
        response = self.client.get(reverse('attendance-list'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results') if 'results' in response.data else response.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['id'], self.att_a.id)

        # Detail view A
        response = self.client.get(reverse('attendance-detail', args=[self.att_a.id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Detail view B
        response = self.client.get(reverse('attendance-detail', args=[self.att_b.id]))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_leave_request_isolation(self):
        """Leave requests must be isolated by tenant."""
        self.set_auth_a()
        
        # List view
        response = self.client.get(reverse('leave-list'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results') if 'results' in response.data else response.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['id'], self.leave_a.id)

        # Detail view A
        response = self.client.get(reverse('leave-detail', args=[self.leave_a.id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Detail view B
        response = self.client.get(reverse('leave-detail', args=[self.leave_b.id]))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_payroll_isolation(self):
        """Payroll records must be isolated by tenant."""
        self.set_auth_a()
        
        # List view
        response = self.client.get(reverse('payroll-list'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results') if 'results' in response.data else response.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['id'], self.payroll_a.id)

        # Detail view A
        response = self.client.get(reverse('payroll-detail', args=[self.payroll_a.id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Detail view B
        response = self.client.get(reverse('payroll-detail', args=[self.payroll_b.id]))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_audit_log_isolation(self):
        """Audit logs must be isolated by tenant."""
        self.set_auth_a()
        
        # List view
        response = self.client.get(reverse('auditlog-list'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results') if 'results' in response.data else response.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['id'], self.audit_a.id)

        # Detail view A
        response = self.client.get(reverse('auditlog-detail', args=[self.audit_a.id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Detail view B
        response = self.client.get(reverse('auditlog-detail', args=[self.audit_b.id]))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_automatic_tenant_stamping_on_create(self):
        """Tenant must be automatically stamped from request user context during creation."""
        self.set_auth_a()

        data = {
            "profile": self.profile_a.id,
            "leave_type": "CASUAL",
            "start_date": "2026-06-01",
            "end_date": "2026-06-02",
            "reason": "Test tenant stamping",
            # Explicitly try to send a different tenant (should be ignored)
            "tenant": self.tenant_b.id
        }

        response = self.client.post(reverse('leave-list'), data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        new_leave = LeaveRequest.objects.get(id=response.data['id'])
        # Must be stamped as tenant_a, NOT tenant_b
        self.assertEqual(new_leave.tenant, self.tenant_a)
