"""
apps/communications/email_service.py
AEC Cinemas – Centralised Email Service

Provides named, purpose-driven functions for sending emails from any part of
the application.  All functions use Django's standard send_mail / EmailMultiAlternatives
so they are backend-agnostic: Brevo in production, console in dev, dummy in tests.

Usage:
    from apps.communications.email_service import send_operational_alert_email

    send_operational_alert_email(alert_instance)
"""

import logging

from django.conf import settings
from django.core.mail import EmailMultiAlternatives

logger = logging.getLogger(__name__)


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _get_admin_recipients(tenant=None):
    """
    Return a list of email addresses that should receive admin-level alerts
    for the given tenant.  Queries the accounts.User model for ADMIN / MD
    roles associated with the tenant.

    Falls back to BREVO_SENDER_EMAIL (configured 'from' address) if no
    admin users are found (prevents silent drops).
    """
    try:
        from apps.accounts.models import User
        qs = User.objects.filter(
            is_active=True,
            role__in=['ADMIN', 'MD'],
        )
        if tenant:
            qs = qs.filter(tenant=tenant)
        emails = list(qs.values_list('email', flat=True).exclude(email=''))
        if emails:
            return emails
    except Exception as exc:
        logger.warning('[COMM] Could not fetch admin recipients: %s', exc)

    # Fallback: send to the configured sender address itself
    return [settings.BREVO_SENDER_EMAIL]


def _send(subject: str, text_body: str, html_body: str, recipients: list):
    """Low-level wrapper: constructs and sends a multipart email."""
    if not recipients:
        logger.warning('[COMM] send() called with empty recipients list. Skipping.')
        return

    msg = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=recipients,
    )
    if html_body:
        msg.attach_alternative(html_body, 'text/html')

    try:
        msg.send(fail_silently=False)
        logger.info('[COMM] Email sent: "%s" → %s', subject, recipients)
    except Exception as exc:
        logger.error('[COMM] Failed to send "%s" → %s: %s', subject, recipients, exc)


# ─── Named Email Functions ────────────────────────────────────────────────────

def send_operational_alert_email(alert):
    """
    Send a notification email when an OperationalAlert is triggered.

    Parameters
    ----------
    alert : apps.operations.models.OperationalAlert
        The newly created / triggered alert instance.
    """
    tenant = getattr(alert, 'tenant', None)
    tenant_name = tenant.name if tenant else 'AEC Cinemas'
    recipients = _get_admin_recipients(tenant)

    severity_emoji = {
        'CRITICAL': '🔴',
        'HIGH': '🟠',
        'MEDIUM': '🟡',
        'LOW': '🟢',
    }.get(getattr(alert, 'severity', ''), '⚪')

    subject = (
        f"{severity_emoji} [{tenant_name}] Operational Alert: "
        f"{alert.get_alert_type_display()} — {alert.source_module}"
    )

    text_body = (
        f"AEC Cinemas Operational Alert\n"
        f"{'=' * 50}\n\n"
        f"Tenant     : {tenant_name}\n"
        f"Alert Type : {alert.get_alert_type_display()}\n"
        f"Severity   : {alert.severity}\n"
        f"Module     : {alert.source_module}\n"
        f"Reference  : {alert.reference_record}\n"
        f"Status     : {alert.status}\n\n"
        f"Details:\n{alert.resolution_note}\n\n"
        f"---\nThis is an automated notification from AEC Cinemas ERP."
    )

    html_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; color: #1a1a1a; max-width: 600px;">
        <div style="background:#1e293b;padding:20px;border-radius:8px 8px 0 0;">
            <h2 style="color:#f8fafc;margin:0;">
                {severity_emoji} Operational Alert
            </h2>
            <p style="color:#94a3b8;margin:4px 0 0;">{tenant_name}</p>
        </div>
        <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-top:none;">
            <table style="width:100%;border-collapse:collapse;">
                <tr>
                    <td style="padding:8px 0;font-weight:bold;width:140px;color:#64748b;">Alert Type</td>
                    <td style="padding:8px 0;">{alert.get_alert_type_display()}</td>
                </tr>
                <tr>
                    <td style="padding:8px 0;font-weight:bold;color:#64748b;">Severity</td>
                    <td style="padding:8px 0;font-weight:bold;">{alert.severity}</td>
                </tr>
                <tr>
                    <td style="padding:8px 0;font-weight:bold;color:#64748b;">Module</td>
                    <td style="padding:8px 0;">{alert.source_module}</td>
                </tr>
                <tr>
                    <td style="padding:8px 0;font-weight:bold;color:#64748b;">Reference</td>
                    <td style="padding:8px 0;font-family:monospace;">{alert.reference_record}</td>
                </tr>
                <tr>
                    <td style="padding:8px 0;font-weight:bold;color:#64748b;">Status</td>
                    <td style="padding:8px 0;">{alert.status}</td>
                </tr>
            </table>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;">
            <p style="font-weight:bold;color:#64748b;">Details</p>
            <p style="background:#fff;border-left:4px solid #ef4444;padding:12px 16px;
                      border-radius:0 4px 4px 0;margin:0;white-space:pre-wrap;">
                {alert.resolution_note}
            </p>
        </div>
        <div style="background:#e2e8f0;padding:12px 24px;border-radius:0 0 8px 8px;
                    font-size:12px;color:#64748b;">
            Automated notification from AEC Cinemas ERP · Do not reply to this email.
        </div>
    </body>
    </html>
    """

    _send(subject, text_body, html_body, recipients)


def send_pm_due_reminder_email(pm_schedule):
    """
    Send a reminder email when a Preventive Maintenance schedule is due / overdue.
    """
    tenant = getattr(pm_schedule, 'tenant', None)
    tenant_name = tenant.name if tenant else 'AEC Cinemas'
    recipients = _get_admin_recipients(tenant)

    status_label = 'OVERDUE' if pm_schedule.is_overdue else 'DUE SOON'
    subject = f"[{tenant_name}] PM {status_label}: {pm_schedule.task_name}"

    text_body = (
        f"Preventive Maintenance Reminder\n"
        f"Task     : {pm_schedule.task_name}\n"
        f"Asset    : {pm_schedule.asset}\n"
        f"Due Date : {pm_schedule.next_due_date}\n"
        f"Status   : {status_label}\n"
    )

    html_body = f"""
    <html><body style="font-family:Arial,sans-serif;max-width:600px;">
        <h2>🔧 PM {status_label}: {pm_schedule.task_name}</h2>
        <p><strong>Asset:</strong> {pm_schedule.asset}</p>
        <p><strong>Due Date:</strong> {pm_schedule.next_due_date}</p>
        <p><strong>Assigned To:</strong> {pm_schedule.assigned_to or 'Unassigned'}</p>
        <p style="color:#64748b;font-size:12px;">
            Automated notification from AEC Cinemas ERP.
        </p>
    </body></html>
    """

    _send(subject, text_body, html_body, recipients)
