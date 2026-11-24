"""
Workforce views: office locations, shift roster & swaps, performance reviews.

Admin side  = HR / MD (full control); Dept Heads manage their own department.
Employee side = see own roster, request swaps, set goals, write self-review.
"""
from datetime import date, timedelta

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.http import HttpResponseForbidden
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_POST

from core.models import Department, EmployeeProfile, User
from notifications.push import notify_profile
from .models import (Goal, OfficeLocation, PerformanceReview, ReviewCycle, Shift,
                     ShiftAssignment, ShiftSwapRequest)

ADMIN_ROLES = (User.Role.HR, User.Role.MD)
MANAGER_ROLES = (User.Role.HR, User.Role.MD, User.Role.GM, User.Role.DEPT_HEAD)


def _is_admin(u):
    return u.is_superuser or u.role in ADMIN_ROLES


def _is_manager(u):
    return u.is_superuser or u.role in MANAGER_ROLES


def _profile(u):
    return getattr(u, 'employee_profile', None) if hasattr(u, 'employee_profile') else None


def _managed_profiles(u):
    """Employees the user may roster / review."""
    qs = EmployeeProfile.objects.filter(is_active=True).select_related('user', 'department')
    if _is_admin(u):
        return qs
    me = _profile(u)
    if not me:
        return qs.none()
    if u.role in (User.Role.DEPT_HEAD, User.Role.GM):
        return qs.filter(Q(department=me.department) | Q(reporting_manager=me))
    return qs.filter(reporting_manager=me)


# ---------------------------------------------------------------------------
# Office locations (geofences)
# ---------------------------------------------------------------------------
@login_required
def locations(request):
    if not _is_admin(request.user):
        return HttpResponseForbidden("HR / MD only")
    if request.method == 'POST':
        action = request.POST.get('action')
        if action == 'add':
            try:
                loc = OfficeLocation.objects.create(
                    name=request.POST['name'].strip(),
                    latitude=request.POST['latitude'],
                    longitude=request.POST['longitude'],
                    radius_m=int(request.POST.get('radius_m') or 250),
                    require_selfie=bool(request.POST.get('require_selfie')),
                )
                loc.departments.set(request.POST.getlist('departments'))
                messages.success(request, f'Location "{loc.name}" added.')
            except (KeyError, ValueError) as e:
                messages.error(request, f'Could not add location: {e}')
        elif action in ('toggle', 'delete'):
            loc = get_object_or_404(OfficeLocation, pk=request.POST.get('pk'))
            if action == 'toggle':
                loc.is_active = not loc.is_active
                loc.save()
            else:
                loc.delete()
        return redirect('workforce:locations')
    return render(request, 'workforce/locations.html', {
        'locations': OfficeLocation.objects.prefetch_related('departments'),
        'departments': Department.objects.filter(is_active=True),
    })


# ---------------------------------------------------------------------------
# Shift roster
# ---------------------------------------------------------------------------
def _week_start(request):
    try:
        d = date.fromisoformat(request.GET.get('week', ''))
    except ValueError:
        d = timezone.localdate()
    return d - timedelta(days=d.weekday())


@login_required
def roster(request):
    u = request.user
    start = _week_start(request)
    days = [start + timedelta(days=i) for i in range(7)]
    me = _profile(u)

    if _is_manager(u):
        people = list(_managed_profiles(u))
        dept = request.GET.get('dept')
        if dept:
            people = [p for p in people if str(p.department_id) == dept]
    else:
        people = [me] if me else []

    assigns = ShiftAssignment.objects.filter(profile__in=people, date__in=days).select_related('shift')
    grid = {(a.profile_id, a.date): a for a in assigns}
    rows = [{'profile': p, 'cells': [(d, grid.get((p.id, d))) for d in days]} for p in people]

    swaps = ShiftSwapRequest.objects.select_related('requester__user', 'colleague__user')
    if _is_admin(u):
        swaps = swaps.filter(status__in=['PENDING_HR', 'PENDING_PEER'])
    elif me:
        swaps = swaps.filter(Q(requester=me) | Q(colleague=me)).exclude(status='CANCELLED')[:20]
    else:
        swaps = swaps.none()

    colleagues = []
    if me:
        colleagues = EmployeeProfile.objects.filter(
            is_active=True, department=me.department).exclude(pk=me.pk).select_related('user')

    return render(request, 'workforce/roster.html', {
        'days': days, 'rows': rows, 'today': timezone.localdate(), 'shifts': Shift.objects.filter(is_active=True),
        'prev_week': start - timedelta(days=7), 'next_week': start + timedelta(days=7),
        'is_manager': _is_manager(u), 'is_admin': _is_admin(u), 'me': me,
        'swaps': swaps, 'colleagues': colleagues,
        'departments': Department.objects.filter(is_active=True),
    })


@login_required
@require_POST
def shift_create(request):
    if not _is_admin(request.user):
        return HttpResponseForbidden()
    try:
        Shift.objects.create(
            name=request.POST['name'].strip(),
            start_time=request.POST['start_time'], end_time=request.POST['end_time'],
            grace_minutes=int(request.POST.get('grace_minutes') or 15),
            break_minutes=int(request.POST.get('break_minutes') or 60),
            color=request.POST.get('color') or '#2563eb',
        )
        messages.success(request, 'Shift created.')
    except (KeyError, ValueError) as e:
        messages.error(request, f'Could not create shift: {e}')
    return redirect('workforce:roster')


@login_required
@require_POST
def assign(request):
    """Bulk assign: selected employees × date range → shift (or week off)."""
    u = request.user
    if not _is_manager(u):
        return HttpResponseForbidden()
    allowed = set(_managed_profiles(u).values_list('id', flat=True))
    ids = [int(i) for i in request.POST.getlist('profiles') if int(i) in allowed]
    try:
        d_from = date.fromisoformat(request.POST['date_from'])
        d_to = date.fromisoformat(request.POST.get('date_to') or request.POST['date_from'])
    except (KeyError, ValueError):
        messages.error(request, 'Pick a valid date range.')
        return redirect('workforce:roster')
    if (d_to - d_from).days > 62 or d_to < d_from:
        messages.error(request, 'Date range must be 0–62 days.')
        return redirect('workforce:roster')
    shift_id = request.POST.get('shift')
    week_off = shift_id == 'OFF'
    shift = None if week_off or not shift_id else get_object_or_404(Shift, pk=shift_id)
    skip_days = {int(x) for x in request.POST.getlist('skip_weekdays')}
    n = 0
    d = d_from
    while d <= d_to:
        if d.weekday() not in skip_days:
            for pid in ids:
                ShiftAssignment.objects.update_or_create(
                    profile_id=pid, date=d,
                    defaults={'shift': shift, 'is_week_off': week_off, 'assigned_by': u})
                n += 1
        d += timedelta(days=1)
    messages.success(request, f'{n} roster entries saved.')
    for pid in ids:
        notify_profile(pid, 'Roster updated', f'Your shifts from {d_from:%d %b} to {d_to:%d %b} were updated.',
                       url='/workforce/roster/')
    return redirect(f"{reverse('workforce:roster')}?week={d_from.isoformat()}")


@login_required
@require_POST
def swap_create(request):
    me = _profile(request.user)
    if not me:
        return HttpResponseForbidden()
    colleague = get_object_or_404(EmployeeProfile, pk=request.POST.get('colleague'), is_active=True)
    try:
        d = date.fromisoformat(request.POST['date'])
    except (KeyError, ValueError):
        messages.error(request, 'Pick a valid date.')
        return redirect('workforce:roster')
    if d < timezone.localdate():
        messages.error(request, 'Cannot swap a past date.')
        return redirect('workforce:roster')
    ShiftSwapRequest.objects.create(requester=me, colleague=colleague, date=d,
                                    reason=request.POST.get('reason', ''))
    notify_profile(colleague.id, 'Shift swap request',
                   f'{me.user.get_full_name()} wants to swap shifts with you on {d:%d %b}.', url='/workforce/roster/')
    messages.success(request, 'Swap request sent to your colleague.')
    return redirect('workforce:roster')


@login_required
@require_POST
def swap_respond(request, pk):
    swap = get_object_or_404(ShiftSwapRequest, pk=pk)
    u = request.user
    me = _profile(u)
    action = request.POST.get('action')

    if swap.status == 'PENDING_PEER' and me and swap.colleague_id == me.id:
        swap.status = 'PENDING_HR' if action == 'accept' else 'REJECTED'
    elif swap.status in ('PENDING_PEER', 'PENDING_HR') and me and swap.requester_id == me.id and action == 'cancel':
        swap.status = 'CANCELLED'
    elif swap.status == 'PENDING_HR' and _is_manager(u):
        if action == 'approve':
            swap.apply()
            swap.status = 'APPROVED'
        else:
            swap.status = 'REJECTED'
        swap.decided_by = u
    else:
        return HttpResponseForbidden()
    swap.save()
    if swap.status in ('APPROVED', 'REJECTED'):
        for pid in (swap.requester_id, swap.colleague_id):
            notify_profile(pid, f'Shift swap {swap.get_status_display().lower()}',
                           f'Swap on {swap.date:%d %b} was {swap.get_status_display().lower()}.', url='/workforce/roster/')
    messages.success(request, f'Swap request: {swap.get_status_display()}.')
    return redirect('workforce:roster')


# ---------------------------------------------------------------------------
# Performance
# ---------------------------------------------------------------------------
@login_required
def performance(request):
    u = request.user
    me = _profile(u)
    cycles = ReviewCycle.objects.all()
    open_cycle = cycles.filter(is_open=True).first()

    if request.method == 'POST' and request.POST.get('action') == 'create_cycle' and _is_admin(u):
        try:
            cycle = ReviewCycle.objects.create(
                name=request.POST['name'].strip(),
                start_date=request.POST['start_date'], end_date=request.POST['end_date'],
                self_review_due=request.POST.get('self_review_due') or None, created_by=u)
        except (KeyError, ValueError) as e:
            messages.error(request, f'Could not create cycle: {e}')
            return redirect('workforce:performance')
        n = 0
        for p in EmployeeProfile.objects.filter(is_active=True, probation_status__in=['PROBATION', 'PERMANENT']):
            PerformanceReview.objects.get_or_create(cycle=cycle, profile=p,
                                                    defaults={'reviewer': p.reporting_manager})
            notify_profile(p.id, 'Appraisal started', f'{cycle.name}: please complete your self review.',
                           url='/workforce/performance/')
            n += 1
        messages.success(request, f'Cycle "{cycle.name}" opened for {n} employees.')
        return redirect('workforce:performance')

    if request.method == 'POST' and request.POST.get('action') == 'close_cycle' and _is_admin(u):
        ReviewCycle.objects.filter(pk=request.POST.get('pk')).update(is_open=False)
        return redirect('workforce:performance')

    ctx = {'cycles': cycles, 'open_cycle': open_cycle, 'is_admin': _is_admin(u), 'me': me}
    if me:
        ctx['my_goals'] = Goal.objects.filter(profile=me).filter(Q(cycle=open_cycle) | Q(cycle__isnull=True)) \
            if open_cycle else Goal.objects.filter(profile=me)
        ctx['my_review'] = PerformanceReview.objects.filter(profile=me, cycle=open_cycle).first() if open_cycle else None
        ctx['to_review'] = PerformanceReview.objects.filter(reviewer=me).exclude(profile=me) \
            .select_related('profile__user', 'cycle').order_by('stage')
    if _is_admin(u) and open_cycle:
        reviews = PerformanceReview.objects.filter(cycle=open_cycle).select_related('profile__user', 'reviewer__user')
        ctx['all_reviews'] = reviews
        ctx['stage_counts'] = {s: reviews.filter(stage=s).count() for s, _ in PerformanceReview.Stage.choices}
    return render(request, 'workforce/performance.html', ctx)


@login_required
@require_POST
def goal_save(request):
    u = request.user
    me = _profile(u)
    pk = request.POST.get('pk')
    if pk:
        goal = get_object_or_404(Goal, pk=pk)
        can_edit = (me and goal.profile_id == me.id) or goal.profile_id in \
            set(_managed_profiles(u).values_list('id', flat=True))
        if not can_edit:
            return HttpResponseForbidden()
        if request.POST.get('delete'):
            goal.delete()
            return redirect(request.POST.get('next') or 'workforce:performance')
    else:
        target = int(request.POST.get('profile') or (me.id if me else 0))
        if not (me and target == me.id) and target not in set(_managed_profiles(u).values_list('id', flat=True)):
            return HttpResponseForbidden()
        goal = Goal(profile_id=target, created_by=u,
                    cycle=ReviewCycle.objects.filter(is_open=True).first())
    goal.title = request.POST.get('title', goal.title).strip() or goal.title
    goal.description = request.POST.get('description', goal.description)
    goal.weight = max(1, int(request.POST.get('weight') or goal.weight or 1))
    goal.progress = min(100, max(0, int(request.POST.get('progress') or goal.progress or 0)))
    goal.status = request.POST.get('status') or goal.status
    goal.due_date = request.POST.get('due_date') or goal.due_date
    if goal.progress == 100:
        goal.status = Goal.Status.DONE
    goal.save()
    messages.success(request, 'Goal saved.')
    return redirect(request.POST.get('next') or 'workforce:performance')


@login_required
def review_detail(request, pk):
    u = request.user
    me = _profile(u)
    review = get_object_or_404(PerformanceReview.objects.select_related('profile__user', 'cycle', 'reviewer__user'), pk=pk)
    is_self = me and review.profile_id == me.id
    is_reviewer = (me and review.reviewer_id == me.id) or _is_admin(u)
    if not (is_self or is_reviewer):
        return HttpResponseForbidden()

    if request.method == 'POST':
        def rating(name):
            v = request.POST.get(name)
            return min(5, max(1, int(v))) if v else None
        if is_self and review.stage == review.Stage.SELF:
            review.self_rating = rating('self_rating')
            review.self_comments = request.POST.get('self_comments', '')
            review.achievements = request.POST.get('achievements', '')
            if request.POST.get('submit'):
                review.submit_self()
                if review.reviewer_id:
                    notify_profile(review.reviewer_id, 'Review ready',
                                   f'{review.profile.user.get_full_name()} submitted a self review.',
                                   url=f'/workforce/performance/review/{review.pk}/')
                messages.success(request, 'Self review submitted to your manager.')
            else:
                review.save()
                messages.success(request, 'Draft saved.')
        elif is_reviewer and not is_self and review.stage == review.Stage.MANAGER:
            review.manager_rating = rating('manager_rating')
            review.manager_comments = request.POST.get('manager_comments', '')
            review.strengths = request.POST.get('strengths', '')
            review.improvements = request.POST.get('improvements', '')
            review.recommend_promotion = bool(request.POST.get('recommend_promotion'))
            if request.POST.get('submit'):
                review.complete()
                notify_profile(review.profile_id, 'Appraisal completed',
                               f'Your {review.cycle.name} review is complete.',
                               url=f'/workforce/performance/review/{review.pk}/')
                messages.success(request, 'Review completed.')
            else:
                review.save()
                messages.success(request, 'Draft saved.')
        else:
            messages.error(request, 'This review is not editable by you at this stage.')
        return redirect('workforce:review', pk=review.pk)

    return render(request, 'workforce/review.html', {
        'review': review, 'is_self': is_self, 'is_reviewer': is_reviewer and not is_self,
        'goals': Goal.objects.filter(profile=review.profile, cycle=review.cycle),
        'ratings': range(1, 6),
        # Employees see manager feedback only after completion.
        'show_manager': review.stage == review.Stage.DONE or (is_reviewer and not is_self),
    })
