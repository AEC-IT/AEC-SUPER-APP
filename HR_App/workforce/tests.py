from datetime import date, datetime, time, timedelta
from unittest import mock

from django.test import TestCase, override_settings
from django.utils import timezone

from core.models import Attendance, Department, EmployeeProfile, User
from notifications.models import Notification, PushSubscription
from workforce.models import (Goal, OfficeLocation, PerformanceReview, ReviewCycle, Shift,
                              ShiftAssignment, ShiftSwapRequest)

OFFICE = (9.967283, 76.286628)
PIXEL = 'data:image/jpeg;base64,/9j/4AAQSkZJRg=='


class Base(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.dept = Department.objects.create(name='Cinema Ops', code='CIN')
        cls.hr = cls._make('hr', User.Role.HR)
        cls.boss = cls._make('boss', User.Role.DEPT_HEAD)
        cls.a = cls._make('anu', User.Role.STAFF, manager=cls.boss.employee_profile)
        cls.b = cls._make('binu', User.Role.STAFF, manager=cls.boss.employee_profile)

    @classmethod
    def _make(cls, name, role, manager=None):
        u = User.objects.create_user(username=name, password='pw', role=role, first_name=name.title(),
                                     email=f'{name}@x.in')
        EmployeeProfile.objects.create(user=u, department=cls.dept, designation='Staff', is_active=True,
                                       probation_status='PERMANENT', reporting_manager=manager)
        return u

    def login(self, u):
        self.client.force_login(u)


class PagesRender(Base):
    def test_pages_for_each_role(self):
        for u in (self.hr, self.boss, self.a):
            self.login(u)
            for url in ('/workforce/roster/', '/workforce/performance/', '/dashboard/',
                        '/manifest.webmanifest', '/sw.js'):
                r = self.client.get(url)
                self.assertEqual(r.status_code, 200, f'{u.username} {url}')
        self.login(self.hr)
        self.assertEqual(self.client.get('/workforce/locations/').status_code, 200)
        self.login(self.a)
        self.assertEqual(self.client.get('/workforce/locations/').status_code, 403)


class GeoCheckin(Base):
    def clock(self, lat, lon, face=PIXEL):
        return self.client.post('/attendance/clock/', {'action': 'in', 'latitude': lat, 'longitude': lon,
                                                        'face_image': face})

    def test_legacy_fallback_when_no_locations(self):
        self.login(self.a)
        self.assertEqual(self.clock(*OFFICE).status_code, 200)

    def test_configured_location_enforced(self):
        OfficeLocation.objects.create(name='Kochi', latitude=OFFICE[0], longitude=OFFICE[1], radius_m=100)
        self.login(self.a)
        self.assertEqual(self.clock(10.5, 76.0).status_code, 400)   # far away
        self.assertEqual(self.clock(*OFFICE, face='').status_code, 400)  # selfie missing
        r = self.clock(*OFFICE)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(Attendance.objects.get(profile=self.a.employee_profile).location_name, 'Kochi')

    def test_department_restricted_location(self):
        other = Department.objects.create(name='Restaurant', code='RES')
        loc = OfficeLocation.objects.create(name='Hotel', latitude=OFFICE[0], longitude=OFFICE[1])
        loc.departments.set([other])
        self.login(self.a)
        self.assertEqual(self.clock(*OFFICE).status_code, 400)

    def test_shift_based_lateness(self):
        shift = Shift.objects.create(name='Matinee', start_time=time(14, 0), end_time=time(22, 0), grace_minutes=10)
        today = timezone.localdate()
        ShiftAssignment.objects.create(profile=self.a.employee_profile, date=today, shift=shift)
        fake_now = timezone.make_aware(datetime.combine(today, time(14, 30)))
        self.login(self.a)
        with mock.patch('django.utils.timezone.now', return_value=fake_now):
            self.clock(*OFFICE)
        att = Attendance.objects.get(profile=self.a.employee_profile)
        self.assertTrue(att.is_late)
        self.assertEqual(att.late_minutes, 30)


class Roster(Base):
    def test_assign_and_swap_flow(self):
        s1 = Shift.objects.create(name='Morning', start_time=time(9), end_time=time(17))
        s2 = Shift.objects.create(name='Night', start_time=time(22), end_time=time(6))
        self.assertTrue(s2.is_night)
        d = timezone.localdate() + timedelta(days=1)
        pa, pb = self.a.employee_profile, self.b.employee_profile

        self.login(self.boss)  # dept head can roster own dept
        self.client.post('/workforce/roster/assign/', {'profiles': [pa.id], 'shift': s1.id,
                                                       'date_from': d.isoformat(), 'date_to': d.isoformat()})
        self.client.post('/workforce/roster/assign/', {'profiles': [pb.id], 'shift': s2.id,
                                                       'date_from': d.isoformat(), 'date_to': d.isoformat()})
        self.assertEqual(ShiftAssignment.objects.get(profile=pa, date=d).shift, s1)

        self.login(self.a)  # staff cannot assign
        self.assertEqual(self.client.post('/workforce/roster/assign/', {}).status_code, 403)
        self.client.post('/workforce/swaps/new/', {'colleague': pb.id, 'date': d.isoformat()})
        swap = ShiftSwapRequest.objects.get()
        self.login(self.b)
        self.client.post(f'/workforce/swaps/{swap.pk}/', {'action': 'accept'})
        self.login(self.hr)
        self.client.post(f'/workforce/swaps/{swap.pk}/', {'action': 'approve'})
        self.assertEqual(ShiftAssignment.objects.get(profile=pa, date=d).shift, s2)
        self.assertEqual(ShiftAssignment.objects.get(profile=pb, date=d).shift, s1)
        self.assertTrue(Notification.objects.filter(target_profile=pa, notification_type='PERSONAL').exists())


class Performance(Base):
    def test_full_cycle(self):
        self.login(self.hr)
        self.client.post('/workforce/performance/', {'action': 'create_cycle', 'name': 'H2 2026',
                                                     'start_date': '2026-07-01', 'end_date': '2026-12-31'})
        cycle = ReviewCycle.objects.get()
        review = PerformanceReview.objects.get(cycle=cycle, profile=self.a.employee_profile)
        self.assertEqual(review.reviewer, self.boss.employee_profile)

        self.login(self.a)
        self.client.post('/workforce/performance/goal/', {'title': 'Cut ticket queue time', 'weight': 2})
        g = Goal.objects.get()
        self.client.post('/workforce/performance/goal/', {'pk': g.pk, 'progress': 50})
        self.client.post(f'/workforce/performance/review/{review.pk}/',
                         {'self_rating': 4, 'achievements': 'x', 'submit': '1'})
        review.refresh_from_db()
        self.assertEqual(review.stage, 'MANAGER')
        self.assertEqual(review.goal_score, 50)

        self.login(self.b)  # colleague cannot open it
        self.assertEqual(self.client.get(f'/workforce/performance/review/{review.pk}/').status_code, 403)

        self.login(self.boss)
        self.client.post(f'/workforce/performance/review/{review.pk}/',
                         {'manager_rating': 5, 'strengths': 'y', 'submit': '1'})
        review.refresh_from_db()
        self.assertEqual((review.stage, review.manager_rating), ('DONE', 5))


@override_settings(WEBPUSH_VAPID_PUBLIC_KEY='pub', WEBPUSH_VAPID_PRIVATE_KEY='priv')
class Push(Base):
    def test_subscribe_and_broadcast(self):
        self.login(self.a)
        r = self.client.post('/notifications/push/subscribe/', content_type='application/json',
                             data={'endpoint': 'https://push.example/1', 'keys': {'p256dh': 'k', 'auth': 'a'}})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(PushSubscription.objects.count(), 1)
        with mock.patch('pywebpush.webpush') as wp:
            self.login(self.hr)
            self.client.post('/notifications/post/', {'title': 'Onam holiday', 'message': 'Office closed'})
            self.assertEqual(wp.call_count, 1)
            # birthday wish is targeted at a profile but broadcast to everyone
            Notification.objects.create(title='Bday', message='m', notification_type='BIRTHDAY_WISH',
                                        target_profile=self.b.employee_profile)
            self.assertEqual(wp.call_count, 2)
            # personal notice only reaches its target (b has no device)
            Notification.objects.create(title='p', message='m', notification_type='PERSONAL',
                                        target_profile=self.b.employee_profile)
            self.assertEqual(wp.call_count, 2)
