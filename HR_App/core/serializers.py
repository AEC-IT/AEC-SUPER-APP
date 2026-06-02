from rest_framework import serializers
from core.models import User, EmployeeProfile, Attendance, LeaveRequest, Payroll, AuditLog

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'phone']


class EmployeeProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    reporting_manager_name = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeProfile
        fields = [
            'id', 'employee_id', 'user', 'department', 'department_name',
            'personal_account', 'salary_account', 'docs_vault', 'is_locked',
            'probation_status', 'reporting_manager', 'reporting_manager_name',
            'onboarding_status', 'rejection_reason', 'probation_end_date',
            'aadhaar_masked', 'date_of_joining', 'notice_period_days',
            'designation', 'basic_salary', 'emergency_contact', 'address',
            'wedding_anniversary', 'spouse_name', 'blood_group', 'hobbies',
            'is_active', 'created_at', 'updated_at', 'tenant'
        ]
        read_only_fields = ['employee_id', 'created_at', 'updated_at', 'tenant']

    def get_reporting_manager_name(self, obj):
        if obj.reporting_manager:
            return obj.reporting_manager.user.get_full_name() or obj.reporting_manager.user.username
        return None


class AttendanceSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='profile.user.get_full_name', read_only=True)
    employee_id = serializers.CharField(source='profile.employee_id', read_only=True)

    class Meta:
        model = Attendance
        fields = [
            'id', 'profile', 'employee_name', 'employee_id', 'date',
            'in_time', 'out_time', 'gps_latitude', 'gps_longitude',
            'ip_address', 'location_name', 'face_image_path',
            'is_valid', 'is_late', 'late_minutes', 'tenant'
        ]
        read_only_fields = ['is_valid', 'is_late', 'late_minutes', 'tenant']


class LeaveRequestSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='profile.user.get_full_name', read_only=True)
    employee_id = serializers.CharField(source='profile.employee_id', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True)

    class Meta:
        model = LeaveRequest
        fields = [
            'id', 'profile', 'employee_name', 'employee_id', 'leave_type',
            'start_date', 'end_date', 'reason', 'status', 'approved_by',
            'approved_by_name', 'rejection_reason', 'created_at', 'updated_at', 'tenant'
        ]
        read_only_fields = ['created_at', 'updated_at', 'tenant']


class PayrollSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='profile.user.get_full_name', read_only=True)
    employee_id = serializers.CharField(source='profile.employee_id', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.get_full_name', read_only=True)

    class Meta:
        model = Payroll
        fields = [
            'id', 'profile', 'employee_name', 'employee_id', 'month',
            'basic_salary', 'daily_rate', 'working_days', 'days_present',
            'days_absent', 'late_deduction_days', 'ot_hours', 'ot_amount',
            'incentive_total', 'pt_deduction', 'esi_deduction', 'pf_deduction',
            'other_deductions', 'deduction_notes', 'gross_salary',
            'total_deductions', 'net_salary', 'status', 'is_locked',
            'reviewed_by', 'reviewed_by_name', 'finalized_at',
            'created_at', 'updated_at', 'tenant'
        ]
        read_only_fields = ['created_at', 'updated_at', 'tenant']


class AuditLogSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    performed_by_name = serializers.CharField(source='performed_by.get_full_name', read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            'id', 'profile', 'employee_name', 'performed_by', 'performed_by_name',
            'action', 'details', 'ip_address', 'timestamp', 'tenant'
        ]
        read_only_fields = ['timestamp', 'tenant']

    def get_employee_name(self, obj):
        if obj.profile:
            return obj.profile.user.get_full_name() or obj.profile.user.username
        return None
