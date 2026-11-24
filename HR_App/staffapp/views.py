"""
Employee mobile app (/app/) — phone-first screens modelled on the Loyaltri
employee app: Home, Attendance, Feed, Services, Profile.

HR / MD / Dept heads keep the sidebar admin view; they can still open /app/
for their own check-in.
"""
import calendar
from datetime import date, timedelta

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.views.decorators.http import require_POST

from core.models import Attendance, EmployeeProfile, Holiday, LeaveRequest, StaffTask
from notifications.models import Notification
from workforce.models import (AttendanceBreak, OfficeLocation, ShiftAssignment, shift_for,
                              worked_seconds)

WISH_TYPES = ['BIRTHDAY_WISH', 'ANNIVERSARY_WISH', 'ONBOARDING_WISH', 'PROMOTION_WISH']


def _me(request):
    try:
        return request.user.employee_profile
    except EmployeeProfile.DoesNotExist:
        return None


def _no_profile(request):
    return render(request, 'staffapp/empty.html', {'msg': 'No employee profile is linked to your login. Please contact HR.'})


def _month(request):
    today = timezone.localdate()
    try:
        y, m = (int(x) for x in request.GET.get('m', '').split('-'))
        return date(y, m, 1)
    except ValueError:
        return today.replace(day=1)


def month_status(profile, first):
    """Per-day status for a month: P present, L leave, UL unpaid/absent, OFF, H holiday, '' future."""
    today = timezone.localdate()
    last = first.replace(day=calendar.monthrange(first.year, first.month)[1])
    att = {a.date: a for a in Attendance.objects.filter(profile=profile, date__range=(first, last))}
    offs = set(ShiftAssignment.objects.filter(profile=profile, date__range=(first, last), is_week_off=True)
               .values_list('date', flat=True))
    rostered = set(ShiftAssignment.objects.filter(profile=profile, date__range=(first, last), is_week_off=False)
                   .values_list('date', flat=True))
    hols = set(Holiday.objects.filter(date__range=(first, last), is_active=True).values_list('date', flat=True))
    leaves = LeaveRequest.objects.filter(profile=profile, status='APPROVED', start_date__lte=last, end_date__gte=first)
    leave_days = set()
    for lv in leaves:
        d = max(lv.start_date, first)
        while d <= min(lv.end_date, last):
            leave_days.add(d)
            d += timedelta(days=1)

    days = {}
    d = first
    while d <= last:
        a = att.get(d)
        if a and a.in_time:
            st = 'P'
        elif d in leave_days:
            st = 'L'
        elif d in hols:
            st = 'H'
        elif d in offs or (d.weekday() == 6 and d not in rostered):
            st = 'OFF'
        elif d < today:
            st = 'UL'
        else:
            st = ''
        days[d] = {'status': st, 'late': bool(a and a.is_late), 'att': a}
        d += timedelta(days=1)
    return days


def calendar_weeks(first, days):
    """Sunday-first weeks with padding, like the Loyaltri calendar."""
    start = first - timedelta(days=(first.weekday() + 1) % 7)
    weeks, d = [], start
    for _ in range(6):
        week = []
        for _ in range(7):
            info = days.get(d, {'status': '', 'late': False})
            week.append({'date': d, 'in_month': d.month == first.month, **info})
            d += timedelta(days=1)
        weeks.append(week)
        if d.month != first.month and d > first:
            break
    return weeks


# ---------------------------------------------------------------------------
@login_required
def home(request):
    me = _me(request)
    if not me:
        return _no_profile(request)
    today = timezone.localdate()
    att = Attendance.objects.filter(profile=me, date=today).prefetch_related('breaks').first()
    on_break = att.breaks.filter(end__isnull=True).first() if att else None
    shift = shift_for(me, today)
    first = _month(request)
    days = month_status(me, first)

    locs = OfficeLocation.objects.filter(is_active=True).filter(
        Q(departments__isnull=True) | Q(departments=me.department)).distinct()
    if not OfficeLocation.objects.exists():
        from attendance.views import LEGACY_LOCATIONS
        loc_list = [{'name': 'AEC Group', 'lat': la, 'lng': lo, 'r': 250, 'selfie': False} for la, lo in LEGACY_LOCATIONS]
    else:
        loc_list = [{'name': l.name, 'lat': float(l.latitude), 'lng': float(l.longitude), 'r': l.radius_m,
                     'selfie': l.require_selfie} for l in locs]

    state = 'out'
    if att and att.in_time and not att.out_time:
        state = 'break' if on_break else 'in'
    elif att and att.out_time:
        state = 'done'

    return render(request, 'staffapp/home.html', {
        'me': me, 'att': att, 'state': state, 'shift': shift, 'today': today,
        'worked': worked_seconds(att), 'on_break': on_break,
        'weeks': calendar_weeks(first, days), 'month': first,
        'prev_m': (first - timedelta(days=1)).replace(day=1),
        'next_m': (first + timedelta(days=32)).replace(day=1),
        'locations': loc_list, 'tab': 'home',
    })


@login_required
@require_POST
def toggle_break(request):
    me = _me(request)
    att = Attendance.objects.filter(profile=me, date=timezone.localdate()).first() if me else None
    if not att or not att.in_time or att.out_time:
        return JsonResponse({'ok': False, 'message': 'Check in first.'}, status=400)
    open_b = att.breaks.filter(end__isnull=True).first()
    if open_b:
        open_b.end = timezone.now()
        open_b.save()
    else:
        AttendanceBreak.objects.create(attendance=att, start=timezone.now())
    return JsonResponse({'ok': True, 'on_break': not open_b})


@login_required
def attendance(request):
    me = _me(request)
    if not me:
        return _no_profile(request)
    first = _month(request)
    days = month_status(me, first)
    today = timezone.localdate()
    counts = {k: sum(1 for v in days.values() if v['status'] == k) for k in ('P', 'L', 'UL', 'OFF', 'H')}
    counts['late'] = sum(1 for v in days.values() if v['late'])
    total = sum(counts[k] for k in ('P', 'L', 'UL', 'OFF', 'H')) or 1
    rows = []
    for d in sorted((d for d in days if d <= today), reverse=True):
        info = days[d]
        a = info['att']
        rows.append({'date': d, 'status': info['status'], 'late': info['late'], 'att': a,
                     'hours': round(worked_seconds(a) / 3600, 1) if a and a.in_time else None})
    prev1 = (first - timedelta(days=1)).replace(day=1)
    months = [(prev1 - timedelta(days=1)).replace(day=1), prev1]
    return render(request, 'staffapp/attendance.html', {
        'me': me, 'month': first, 'counts': counts, 'rows': rows, 'tab': 'attendance',
        'bar': [(k, counts[k] * 100 / total) for k in ('P', 'L', 'OFF', 'H', 'UL')],
        'months': months + [first],
    })


@login_required
def feed(request):
    me = _me(request)
    q = Q(target_profile__isnull=True) | Q(notification_type__in=WISH_TYPES)
    if me:
        q |= Q(target_profile=me)
    items = Notification.objects.filter(q, is_active=True).select_related('created_by', 'target_profile__user')[:50]
    for n in items:
        n.is_read = n.read_by.filter(pk=request.user.pk).exists()
        if not n.is_read:
            n.read_by.add(request.user)  # opening the feed marks items seen
    today = timezone.localdate()
    upcoming = EmployeeProfile.objects.filter(is_active=True, user__date_of_birth__isnull=False).select_related('user')
    bdays = []
    for p in upcoming:
        dob = p.user.date_of_birth
        try:
            nxt = dob.replace(year=today.year)
        except ValueError:
            nxt = date(today.year, 3, 1)
        if nxt < today:
            nxt = nxt.replace(year=today.year + 1)
        if (nxt - today).days <= 7:
            bdays.append({'p': p, 'date': nxt, 'today': nxt == today})
    bdays.sort(key=lambda x: x['date'])
    return render(request, 'staffapp/feed.html', {'items': items, 'bdays': bdays, 'tab': 'feed', 'me': me})


@login_required
def services(request):
    return render(request, 'staffapp/services.html', {'tab': 'services', 'me': _me(request)})


@login_required
def profile(request):
    me = _me(request)
    if not me:
        return _no_profile(request)
    section = request.GET.get('s')
    ctx = {'me': me, 'tab': 'profile', 'section': section}
    if section == 'assets':
        from assets.models import CompanyAsset
        ctx['assets'] = CompanyAsset.objects.filter(profile=me).order_by('-issued_date')
    if section == 'documents':
        from communications.models import InternalMail
        ctx['docs'] = InternalMail.objects.filter(recipient=request.user).exclude(mail_type='WISH') \
            .order_by('-created_at')[:30]
    return render(request, 'staffapp/profile.html', ctx)


@login_required
def leaves(request):
    me = _me(request)
    if not me:
        return _no_profile(request)
    items = LeaveRequest.objects.filter(profile=me).order_by('-start_date')[:50]
    return render(request, 'staffapp/leaves.html', {'items': items, 'tab': 'services', 'me': me})


@login_required
def leave_new(request):
    """Phone form; posts through the existing leave rules (quota, holidays, approvals)."""
    if request.method == 'POST':
        from leave.views import LeaveCreateView
        resp = LeaveCreateView.as_view()(request)
        url = getattr(resp, 'url', '')
        return redirect('staffapp:leave_new' if 'new' in url else 'staffapp:leaves')
    return render(request, 'staffapp/leave_new.html', {
        'types': LeaveRequest.LeaveType.choices, 'tab': 'services', 'me': _me(request)})


@login_required
def schedule(request):
    me = _me(request)
    if not me:
        return _no_profile(request)
    today = timezone.localdate()
    rows = []
    for i in range(14):
        d = today + timedelta(days=i)
        a = ShiftAssignment.objects.filter(profile=me, date=d).select_related('shift').first()
        rows.append({'date': d, 'a': a})
    return render(request, 'staffapp/schedule.html', {'rows': rows, 'tab': 'services', 'me': me})


@login_required
def tasks(request):
    me = _me(request)
    if not me:
        return _no_profile(request)
    if request.method == 'POST':
        if request.POST.get('action') == 'status':
            t = get_object_or_404(StaffTask, pk=request.POST.get('pk'), assigned_to=me)
            t.status = request.POST.get('status', t.status)
            t.save()
        else:
            title = request.POST.get('title', '').strip()
            if title:
                assignee = me
                aid = request.POST.get('assignee')
                if aid:
                    assignee = get_object_or_404(EmployeeProfile, pk=aid, is_active=True)
                StaffTask.objects.create(title=title, description=request.POST.get('description', ''),
                                         assigned_by=request.user, assigned_to=assignee,
                                         due_date=request.POST.get('due_date') or None)
                messages.success(request, 'Task created.')
        return redirect('staffapp:tasks')
    today = timezone.localdate()
    view = request.GET.get('v', 'mine')
    mine = StaffTask.objects.filter(assigned_to=me)
    created = StaffTask.objects.filter(assigned_by=request.user).exclude(assigned_to=me)
    qs = mine if view == 'mine' else created
    open_qs = qs.exclude(status='COMPLETED')
    stats = {
        'due': open_qs.filter(due_date=today).count(),
        'overdue': open_qs.filter(due_date__lt=today).count(),
        'open': open_qs.count(),
        'done': qs.filter(status='COMPLETED').count(),
    }
    colleagues = EmployeeProfile.objects.filter(is_active=True, department=me.department).exclude(pk=me.pk) \
        .select_related('user')
    return render(request, 'staffapp/tasks.html', {
        'items': qs.select_related('assigned_to__user', 'assigned_by')[:50], 'stats': stats, 'view': view,
        'mine_count': mine.exclude(status='COMPLETED').count(),
        'created_count': created.exclude(status='COMPLETED').count(),
        'colleagues': colleagues, 'today': today, 'tab': 'home', 'me': me,
        'open_new': request.GET.get('new') == '1',
    })
