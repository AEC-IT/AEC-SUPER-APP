from django.contrib import admin
from .models import (Goal, OfficeLocation, PerformanceReview, ReviewCycle, Shift,
                     ShiftAssignment, ShiftSwapRequest)

admin.site.register([OfficeLocation, Shift, ShiftSwapRequest, ReviewCycle, Goal, PerformanceReview])


@admin.register(ShiftAssignment)
class ShiftAssignmentAdmin(admin.ModelAdmin):
    list_display = ('profile', 'date', 'shift', 'is_week_off')
    list_filter = ('shift', 'is_week_off', 'date')
