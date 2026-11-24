"""
Workforce module — Loyaltri-parity features:
  * OfficeLocation  — admin-managed geofences for GPS check-in
  * Shift / ShiftAssignment / ShiftSwapRequest — rosters & swaps
  * ReviewCycle / Goal / PerformanceReview — performance management
"""
from datetime import datetime, timedelta

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone


# ---------------------------------------------------------------------------
# Geofenced office locations
# ---------------------------------------------------------------------------
class OfficeLocation(models.Model):
    name = models.CharField(max_length=120)
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    radius_m = models.PositiveIntegerField(default=250, help_text="Allowed check-in radius in metres")
    departments = models.ManyToManyField(
        'core.Department', blank=True, related_name='office_locations',
        help_text="Leave empty to allow every department at this location.",
    )
    require_selfie = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.radius_m} m)"


# ---------------------------------------------------------------------------
# Shifts
# ---------------------------------------------------------------------------
class Shift(models.Model):
    name = models.CharField(max_length=80)
    start_time = models.TimeField()
    end_time = models.TimeField(help_text="If earlier than start, the shift ends next day (night shift).")
    grace_minutes = models.PositiveIntegerField(default=15)
    break_minutes = models.PositiveIntegerField(default=60)
    color = models.CharField(max_length=7, default='#2563eb')
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['start_time']

    def __str__(self):
        return f"{self.name} ({self.start_time:%H:%M}–{self.end_time:%H:%M})"

    @property
    def is_night(self):
        return self.end_time <= self.start_time

    @property
    def hours(self):
        start = datetime.combine(datetime.today(), self.start_time)
        end = datetime.combine(datetime.today(), self.end_time)
        if end <= start:
            end += timedelta(days=1)
        return round(((end - start).total_seconds() / 60 - self.break_minutes) / 60, 2)


class ShiftAssignment(models.Model):
    """One employee on one shift for one date. Week-off = shift is null."""
    profile = models.ForeignKey('core.EmployeeProfile', on_delete=models.CASCADE, related_name='shift_assignments')
    date = models.DateField()
    shift = models.ForeignKey(Shift, on_delete=models.PROTECT, null=True, blank=True)
    is_week_off = models.BooleanField(default=False)
    assigned_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        unique_together = ('profile', 'date')
        ordering = ['date']

    def __str__(self):
        return f"{self.profile} – {self.date} – {'Week off' if self.is_week_off else self.shift}"


def shift_for(profile, date):
    """The shift an employee works on a date, or None (week-off / unassigned)."""
    a = ShiftAssignment.objects.filter(profile=profile, date=date).select_related('shift').first()
    if a is None or a.is_week_off:
        return None
    return a.shift


class ShiftSwapRequest(models.Model):
    class Status(models.TextChoices):
        PENDING_PEER = 'PENDING_PEER', 'Waiting for colleague'
        PENDING_HR = 'PENDING_HR', 'Waiting for approval'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Rejected'
        CANCELLED = 'CANCELLED', 'Cancelled'

    requester = models.ForeignKey('core.EmployeeProfile', on_delete=models.CASCADE, related_name='swap_requests_made')
    colleague = models.ForeignKey('core.EmployeeProfile', on_delete=models.CASCADE, related_name='swap_requests_received')
    date = models.DateField()
    reason = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING_PEER)
    decided_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def apply(self):
        """Swap the two employees' assignments for the date."""
        a = ShiftAssignment.objects.filter(profile=self.requester, date=self.date).first()
        b = ShiftAssignment.objects.filter(profile=self.colleague, date=self.date).first()
        a_shift, a_off = (a.shift, a.is_week_off) if a else (None, True)
        b_shift, b_off = (b.shift, b.is_week_off) if b else (None, True)
        ShiftAssignment.objects.update_or_create(
            profile=self.requester, date=self.date, defaults={'shift': b_shift, 'is_week_off': b_off})
        ShiftAssignment.objects.update_or_create(
            profile=self.colleague, date=self.date, defaults={'shift': a_shift, 'is_week_off': a_off})


# ---------------------------------------------------------------------------
# Performance
# ---------------------------------------------------------------------------
RATING = [MinValueValidator(1), MaxValueValidator(5)]


class ReviewCycle(models.Model):
    name = models.CharField(max_length=120, help_text="e.g. 'H1 2026 Appraisal'")
    start_date = models.DateField()
    end_date = models.DateField()
    self_review_due = models.DateField(null=True, blank=True)
    is_open = models.BooleanField(default=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-start_date']

    def __str__(self):
        return self.name


class Goal(models.Model):
    class Status(models.TextChoices):
        NOT_STARTED = 'NOT_STARTED', 'Not started'
        ON_TRACK = 'ON_TRACK', 'On track'
        AT_RISK = 'AT_RISK', 'At risk'
        DONE = 'DONE', 'Completed'

    profile = models.ForeignKey('core.EmployeeProfile', on_delete=models.CASCADE, related_name='goals')
    cycle = models.ForeignKey(ReviewCycle, on_delete=models.CASCADE, related_name='goals', null=True, blank=True)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    weight = models.PositiveIntegerField(default=1, help_text="Relative importance")
    progress = models.PositiveIntegerField(default=0, validators=[MaxValueValidator(100)])
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.NOT_STARTED)
    due_date = models.DateField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['due_date', 'id']

    def __str__(self):
        return self.title


class PerformanceReview(models.Model):
    class Stage(models.TextChoices):
        SELF = 'SELF', 'Self review pending'
        MANAGER = 'MANAGER', 'Manager review pending'
        DONE = 'DONE', 'Completed'

    cycle = models.ForeignKey(ReviewCycle, on_delete=models.CASCADE, related_name='reviews')
    profile = models.ForeignKey('core.EmployeeProfile', on_delete=models.CASCADE, related_name='performance_reviews')
    reviewer = models.ForeignKey('core.EmployeeProfile', on_delete=models.SET_NULL, null=True, blank=True,
                                 related_name='reviews_to_give')
    stage = models.CharField(max_length=10, choices=Stage.choices, default=Stage.SELF)

    self_rating = models.PositiveSmallIntegerField(null=True, blank=True, validators=RATING)
    self_comments = models.TextField(blank=True)
    achievements = models.TextField(blank=True)

    manager_rating = models.PositiveSmallIntegerField(null=True, blank=True, validators=RATING)
    manager_comments = models.TextField(blank=True)
    strengths = models.TextField(blank=True)
    improvements = models.TextField(blank=True)
    recommend_promotion = models.BooleanField(default=False)

    submitted_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('cycle', 'profile')

    def __str__(self):
        return f"{self.profile} – {self.cycle}"

    @property
    def goal_score(self):
        goals = list(self.profile.goals.filter(cycle=self.cycle))
        total_w = sum(g.weight for g in goals)
        if not total_w:
            return None
        return round(sum(g.progress * g.weight for g in goals) / total_w)

    def submit_self(self):
        self.stage = self.Stage.MANAGER
        self.submitted_at = timezone.now()
        self.save()

    def complete(self):
        self.stage = self.Stage.DONE
        self.completed_at = timezone.now()
        self.save()
