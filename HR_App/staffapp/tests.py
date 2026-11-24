from datetime import date, time, timedelta

from django.test import TestCase
from django.utils import timezone

from core.models import Attendance, Department, EmployeeProfile, LeaveRequest, StaffTask, User
from workforce.models import AttendanceBreak, Shift, ShiftAssignment, worked_seconds


class StaffApp(TestCase):
    @classmethod
    def setUpTestData(cls):
        d = Department.objects.create(name='Cinema', code='CIN')
        cls.hr = User.objects.create_user('hr', password='pw', role='HR')
        EmployeeProfile.objects.create(user=cls.hr, department=d, probation_status='PERMANENT')
        cls.u = User.objects.create_user('anu', password='pw', role='STAFF', first_name='Anu')
        cls.p = EmployeeProfile.objects.create(user=cls.u, department=d, probation_status='PERMANENT',
                                               designation='Ticketing')

    def setUp(self):
        self.client.force_login(self.u)

    def test_staff_redirected_admin_not(self):
        self.assertRedirects(self.client.get('/dashboard/'), '/app/', fetch_redirect_response=False)
        self.client.force_login(self.hr)
        self.assertEqual(self.client.get('/dashboard/').status_code, 200)
        self.assertEqual(self.client.get('/app/').status_code, 200)  # admins can open their own app

    def test_all_tabs_render(self):
        for url in ('/app/', '/app/attendance/', '/app/feed/', '/app/services/', '/app/profile/',
                    '/app/profile/?s=personal', '/app/profile/?s=work', '/app/profile/?s=assets',
                    '/app/profile/?s=documents', '/app/leaves/', '/app/leave/new/', '/app/schedule/',
                    '/app/tasks/', '/app/?m=2026-1'):
            self.assertEqual(self.client.get(url).status_code, 200, url)

    def test_break_and_duration(self):
        now = timezone.now()
        att = Attendance.objects.create(profile=self.p, date=timezone.localdate(), in_time=now - timedelta(hours=2))
        self.assertEqual(self.client.post('/app/break/').json()['on_break'], True)
        b = AttendanceBreak.objects.get()
        b.start = now - timedelta(minutes=30)
        b.save()
        self.assertEqual(self.client.post('/app/break/').json()['on_break'], False)
        self.assertAlmostEqual(worked_seconds(att), 90 * 60, delta=5)
        self.assertContains(self.client.get('/app/'), 'Check Out')

    def test_month_status(self):
        from staffapp.views import month_status
        first = (timezone.localdate().replace(day=1) - timedelta(days=1)).replace(day=1)  # last month
        Attendance.objects.create(profile=self.p, date=first, in_time=timezone.now())
        lv_day = first + timedelta(days=2)
        LeaveRequest.objects.create(profile=self.p, leave_type='FULL', start_date=lv_day, end_date=lv_day,
                                    status='APPROVED')
        off = first + timedelta(days=3)
        ShiftAssignment.objects.create(profile=self.p, date=off, is_week_off=True)
        days = month_status(self.p, first)
        self.assertEqual(days[first]['status'], 'P')
        self.assertEqual(days[lv_day]['status'], 'L')
        self.assertEqual(days[off]['status'], 'OFF')

    def test_leave_and_task(self):
        d = timezone.localdate() + timedelta(days=5)
        r = self.client.post('/app/leave/new/', {'leave_type': 'FULL', 'start_date': d, 'end_date': d, 'reason': 'x'})
        self.assertRedirects(r, '/app/leaves/', fetch_redirect_response=False)
        self.assertEqual(LeaveRequest.objects.filter(profile=self.p).count(), 1)
        self.client.post('/app/tasks/', {'title': 'Restock popcorn'})
        t = StaffTask.objects.get()
        self.client.post('/app/tasks/', {'action': 'status', 'pk': t.pk, 'status': 'COMPLETED'})
        t.refresh_from_db()
        self.assertEqual(t.status, 'COMPLETED')
