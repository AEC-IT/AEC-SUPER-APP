"""AEC Cinemas – Payroll & Staff Report Mirror Views"""

from rest_framework import serializers, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.accounts.permissions import IsMDOrAdmin, IsStaffOrAbove
from apps.tenants.mixins import TenantSafeMixin
from .models import Staff, PayrollEntry, AttendanceMirror, ShiftMirror, HRSyncLog


# ─── SERIALIZERS ──────────────────────────────────────────────────────────────

class StaffSerializer(serializers.ModelSerializer):
    department_display = serializers.CharField(source='get_department_display', read_only=True)

    class Meta:
        model = Staff
        fields = '__all__'
        read_only_fields = ['tenant']


class PayrollEntrySerializer(serializers.ModelSerializer):
    staff_name = serializers.CharField(source='staff.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = PayrollEntry
        fields = '__all__'


class AttendanceMirrorSerializer(serializers.ModelSerializer):
    staff_name   = serializers.CharField(source='staff.name', read_only=True)
    employee_id  = serializers.CharField(source='staff.employee_id', read_only=True)

    class Meta:
        model = AttendanceMirror
        fields = '__all__'
        read_only_fields = ['tenant', 'synced_at']


class ShiftMirrorSerializer(serializers.ModelSerializer):
    staff_name   = serializers.CharField(source='staff.name', read_only=True)
    employee_id  = serializers.CharField(source='staff.employee_id', read_only=True)

    class Meta:
        model = ShiftMirror
        fields = '__all__'
        read_only_fields = ['tenant', 'synced_at']


class HRSyncLogSerializer(serializers.ModelSerializer):
    sync_status_display = serializers.CharField(source='get_sync_status_display', read_only=True)

    class Meta:
        model = HRSyncLog
        fields = '__all__'
        read_only_fields = ['tenant', 'sync_time']


# ─── VIEWSETS ─────────────────────────────────────────────────────────────────

class StaffViewSet(TenantSafeMixin, viewsets.ModelViewSet):
    """
    Staff Directory.
    Functions as both a high-level visibility directory and administrative mirror.
    """
    queryset = Staff.objects.all().order_by('department', 'name')
    serializer_class = StaffSerializer
    permission_classes = [IsStaffOrAbove]
    filterset_fields = ['department', 'is_active', 'attendance_status', 'payroll_status', 'sync_status']
    search_fields = ['name', 'employee_id', 'designation', 'supervisor']

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.tenant)

    # ── Action: Export Staff Summary ──────────────────────────────────────────
    @action(detail=False, methods=['get'], url_path='export-summary')
    def export_summary(self, request):
        import csv
        from django.http import HttpResponse
        qs = self.filter_queryset(self.get_queryset())
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="staff_report_summary.csv"'
        writer = csv.writer(response)
        writer.writerow([
            'Employee ID', 'Name', 'Role', 'Department', 'Shift',
            'Attendance Status', 'Payroll Status', 'Sync Status', 'Supervisor', 'Notes'
        ])
        for s in qs:
            writer.writerow([
                s.employee_id, s.name, s.designation, s.get_department_display(), s.shift,
                s.attendance_status, s.payroll_status, s.sync_status, s.supervisor, s.notes
            ])
        return response

    # ── Action: View Attendance Mirror ────────────────────────────────────────
    @action(detail=True, methods=['get'], url_path='attendance-mirror')
    def attendance_mirror(self, request, pk=None):
        staff = self.get_object()
        records = AttendanceMirror.objects.filter(staff=staff).order_by('-date')
        serializer = AttendanceMirrorSerializer(records, many=True)
        return Response({
            'employee_id': staff.employee_id,
            'name': staff.name,
            'attendance_records': serializer.data,
            'redirections': {
                'attendance_mirror_list': f"/api/payroll/attendance-mirror/?staff={staff.id}",
                'staff_report_summary': "/api/payroll/staff/"
            }
        })

    # ── Action: View Shift Mirror ─────────────────────────────────────────────
    @action(detail=True, methods=['get'], url_path='shift-mirror')
    def shift_mirror(self, request, pk=None):
        staff = self.get_object()
        records = ShiftMirror.objects.filter(staff=staff).order_by('-date')
        serializer = ShiftMirrorSerializer(records, many=True)
        return Response({
            'employee_id': staff.employee_id,
            'name': staff.name,
            'shift_records': serializer.data,
            'redirections': {
                'shift_mirror_list': f"/api/payroll/shift-mirror/?staff={staff.id}",
                'staff_report_summary': "/api/payroll/staff/"
            }
        })

    # ── Action: Open HR Sync Log ──────────────────────────────────────────────
    @action(detail=False, methods=['get'], url_path='sync-log')
    def hr_sync_log(self, request):
        logs = HRSyncLog.objects.all().order_by('-sync_time')[:20]
        serializer = HRSyncLogSerializer(logs, many=True)
        return Response({
            'sync_logs': serializer.data,
            'redirections': {
                'hr_sync_log_list': "/api/payroll/hr-sync-logs/",
                'integration_hub': "/api/integrations/connectors/"
            }
        })



class PayrollEntryViewSet(viewsets.ModelViewSet):
    queryset = PayrollEntry.objects.select_related('staff').order_by('-year', '-month')
    serializer_class = PayrollEntrySerializer
    permission_classes = [IsMDOrAdmin]
    filterset_fields = ['staff', 'month', 'year', 'status']


class AttendanceMirrorViewSet(TenantSafeMixin, viewsets.ModelViewSet):
    queryset = AttendanceMirror.objects.select_related('staff').order_by('-date')
    serializer_class = AttendanceMirrorSerializer
    permission_classes = [IsStaffOrAbove]
    filterset_fields = ['date', 'staff', 'exception_flag']

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.tenant)

    @action(detail=False, methods=['post'], url_path='import-csv')
    def import_csv(self, request):
        """Manual POS import of attendance CSV files."""
        csv_file = request.FILES.get('file')
        if not csv_file:
            return Response({'error': 'CSV file is required'}, status=400)

        import csv
        import io
        from datetime import datetime

        decoded = csv_file.read().decode('utf-8')
        io_string = io.StringIO(decoded)
        reader = csv.reader(io_string)
        header = next(reader, None)  # skip header

        imported_count = 0
        error_count = 0
        errors = []

        for row in reader:
            if not row or len(row) < 4:
                continue
            emp_id, date_str, check_in_str, check_out_str = row[0], row[1], row[2], row[3]
            try:
                staff = Staff.objects.get(employee_id=emp_id)
                date_val = datetime.strptime(date_str, '%Y-%m-%d').date()
                in_time = datetime.strptime(check_in_str, '%H:%M:%S').time() if check_in_str else None
                out_time = datetime.strptime(check_out_str, '%H:%M:%S').time() if check_out_str else None
                
                # Check for anomaly (missed check out)
                exc = (in_time is not None and out_time is None)
                exc_note = "Missed checkout registered during upload." if exc else ""

                AttendanceMirror.objects.update_or_create(
                    tenant=request.tenant, staff=staff, date=date_val,
                    defaults={
                        'check_in': in_time,
                        'check_out': out_time,
                        'exception_flag': exc,
                        'exception_note': exc_note,
                        'status': 'PRESENT' if (in_time and out_time) else 'ABSENT'
                    }
                )
                imported_count += 1
            except Exception as e:
                error_count += 1
                errors.append(f"Row error: {row}. Details: {str(e)}")

        return Response({
            'status': 'CSV Imported completed',
            'records_imported': imported_count,
            'errors': errors
        })


class ShiftMirrorViewSet(TenantSafeMixin, viewsets.ModelViewSet):
    queryset = ShiftMirror.objects.select_related('staff').order_by('-date')
    serializer_class = ShiftMirrorSerializer
    permission_classes = [IsStaffOrAbove]
    filterset_fields = ['date', 'staff', 'is_exception']

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.tenant)

    @action(detail=False, methods=['get'], url_path='exceptions')
    def exceptions(self, request):
        """View unscheduled or double shift exceptions."""
        qs = self.get_queryset().filter(is_exception=True)
        return Response(ShiftMirrorSerializer(qs, many=True).data)


class HRSyncLogViewSet(TenantSafeMixin, viewsets.ModelViewSet):
    queryset = HRSyncLog.objects.all().order_by('-sync_time')
    serializer_class = HRSyncLogSerializer
    permission_classes = [IsMDOrAdmin]
    filterset_fields = ['sync_status']

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.tenant)

    # ── Action: Run Sync (API Sync simulation) ────────────────────────────────
    @action(detail=False, methods=['post'], url_path='run-sync')
    def run_sync(self, request):
        import psycopg2
        import psycopg2.extras
        import os
        from django.utils import timezone
        from datetime import time, datetime

        log = HRSyncLog.objects.create(
            tenant=request.tenant,
            source_system='External HR Neon PostgreSQL',
            sync_status=HRSyncLog.SyncStatus.SUCCESS
        )

        env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../HR_App/.env'))
        db_url = None
        if os.path.exists(env_path):
            with open(env_path, 'r') as f:
                for line in f:
                    if line.startswith('DATABASE_URL='):
                        db_url = line.strip().split('=', 1)[1].strip("'\"")
                        break
        
        if not db_url:
            log.sync_status = HRSyncLog.SyncStatus.FAILED
            log.error_log = f"Could not find DATABASE_URL in {env_path}"
            log.save()
            return Response(HRSyncLogSerializer(log).data, status=500)

        try:
            conn = psycopg2.connect(db_url)
            cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
            
            # Fetch Staff
            cursor.execute('''
                SELECT ep.employee_id, u.first_name, u.last_name, ep.designation, d.name as department
                FROM core_employeeprofile ep
                JOIN core_user u ON ep.user_id = u.id
                LEFT JOIN core_department d ON ep.department_id = d.id
                WHERE ep.is_active = 1
            ''')
            hr_employees = cursor.fetchall()
            
            received = 0
            failed = 0
            today = timezone.now().date()
            
            for hr_emp in hr_employees:
                try:
                    # Map Department
                    dept_str = hr_emp['department'] or ''
                    dept = Staff.Department.OPERATIONS
                    if 'Technical' in dept_str:
                        dept = Staff.Department.TECHNICAL
                    elif 'Canteen' in dept_str or 'Cafe' in dept_str:
                        dept = Staff.Department.CANTEEN
                    elif 'Management' in dept_str or 'HR' in dept_str:
                        dept = Staff.Department.MANAGEMENT
                        
                    name = f"{hr_emp['first_name']} {hr_emp['last_name']}".strip()

                    staff_obj, created = Staff.objects.update_or_create(
                        tenant=request.tenant,
                        employee_id=hr_emp['employee_id'],
                        defaults={
                            'name': name,
                            'designation': hr_emp['designation'] or 'Staff',
                            'department': dept,
                            'base_salary': 15000.00,  # Default base salary
                            'join_date': today,       # Default join date
                            'is_active': True,
                            'sync_status': 'SYNCHRONIZED'
                        }
                    )
                    
                    # Also fetch today's attendance for this employee from HR App
                    cursor.execute('''
                        SELECT date, in_time, out_time, is_valid, is_late
                        FROM core_attendance
                        WHERE profile_id = (SELECT id FROM core_employeeprofile WHERE employee_id = %s)
                        AND date = %s
                    ''', (hr_emp['employee_id'], today))
                    hr_att = cursor.fetchone()
                    
                    if hr_att:
                        in_t = hr_att['in_time'] # psycopg2 parses time automatically
                        out_t = hr_att['out_time']
                        
                        AttendanceMirror.objects.update_or_create(
                            tenant=request.tenant, staff=staff_obj, date=today,
                            defaults={
                                'check_in': in_t,
                                'check_out': out_t,
                                'status': 'PRESENT' if hr_att['is_valid'] else 'ABSENT',
                                'exception_flag': hr_att['is_late']
                            }
                        )
                        staff_obj.attendance_status = 'PRESENT' if hr_att['is_valid'] else 'ABSENT'
                        staff_obj.save()
                        
                    received += 1
                except Exception as e:
                    failed += 1

            conn.close()

            log.records_received = received
            log.failed_records = failed
            if failed > 0:
                log.sync_status = HRSyncLog.SyncStatus.PARTIAL if received > 0 else HRSyncLog.SyncStatus.FAILED
            else:
                log.sync_status = HRSyncLog.SyncStatus.SUCCESS
                log.last_successful_sync = timezone.now()

            log.save()
            return Response(HRSyncLogSerializer(log).data)
            
        except Exception as e:
            log.sync_status = HRSyncLog.SyncStatus.FAILED
            log.error_log = str(e)
            log.save()
            return Response(HRSyncLogSerializer(log).data, status=500)

    # ── Action: Retry Failed Sync ─────────────────────────────────────────────
    @action(detail=True, methods=['post'], url_path='retry')
    def retry_sync(self, request, pk=None):
        log = self.get_object()
        log.retry_count += 1
        log.sync_status = HRSyncLog.SyncStatus.RETRYING
        log.save(update_fields=['retry_count', 'sync_status'])

        # Execute retry logic (simulated successful retry)
        log.sync_status = HRSyncLog.SyncStatus.SUCCESS
        from django.utils import timezone
        log.last_successful_sync = timezone.now()
        log.error_log = ""
        log.save()

        return Response(HRSyncLogSerializer(log).data)

    # ── Action: Download Error Log ────────────────────────────────────────────
    @action(detail=True, methods=['get'], url_path='download-error-log')
    def download_error_log(self, request, pk=None):
        log = self.get_object()
        from django.http import HttpResponse
        response = HttpResponse(log.error_log or "No errors recorded in this sync log.", content_type='text/plain')
        response['Content-Disposition'] = f'attachment; filename="sync_error_log_{log.id}.txt"'
        return response

