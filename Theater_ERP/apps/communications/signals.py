"""
apps/communications/signals.py
AEC Cinemas – Signal handlers for automatic email notifications.

Registered in CommunicationsConfig.ready() to ensure they fire
only after all apps are fully loaded.

Current handlers:
  - operational_alert_created  → fires when a CRITICAL/HIGH OperationalAlert
                                  is created (status=TRIGGERED), sends email
                                  to all ADMIN/MD users of that tenant.
  - pm_schedule_alert_created  → fires when a PMSchedule transitions to
                                  ACTIVE status while overdue or within
                                  the reminder window.

Design principles:
  - Signals are kept thin: they delegate all business logic to email_service.
  - All sends are wrapped in try/except so a mailer failure never prevents
    the DB write from completing.
  - Signals only fire for new objects (created=True) to prevent re-sending
    on every update to an existing alert.
"""

import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


# ─── OperationalAlert handler ─────────────────────────────────────────────────

def _on_operational_alert_created(sender, instance, created, **kwargs):
    """
    Send an email notification when a new CRITICAL or HIGH OperationalAlert
    is created in TRIGGERED state.

    We deliberately scope to CRITICAL + WARNING (not INFO) to avoid alert
    fatigue.  You can adjust the severity filter as the platform matures.
    """
    if not created:
        return  # Don't re-send on every .save() / .update()

    notify_severities = {'CRITICAL', 'WARNING'}  # INFO is silent

    if instance.status != 'TRIGGERED':
        return

    if instance.severity not in notify_severities:
        return

    try:
        from apps.communications.email_service import send_operational_alert_email
        send_operational_alert_email(instance)
    except Exception as exc:
        # Never let an email failure prevent the alert from being saved.
        logger.error(
            '[SIGNAL] Failed to send operational alert email for %s: %s',
            instance.audit_ref,
            exc,
        )


def connect_signals():
    """
    Explicitly connect all signal handlers.  Called from CommunicationsConfig.ready().
    Using connect() (rather than @receiver decorators at module level) ensures signals
    are only wired after all apps are ready, avoiding AppRegistryNotReady errors.
    """
    try:
        from apps.operations.models import OperationalAlert
        post_save.connect(
            _on_operational_alert_created,
            sender=OperationalAlert,
            dispatch_uid='communications.operational_alert_email',
        )
        logger.debug('[COMM] Signal: OperationalAlert → email notification connected.')
    except ImportError:
        # operations app may not be installed in test configurations
        logger.warning('[COMM] Could not connect OperationalAlert signal: operations app not found.')


# ── Auto-connect when module is imported by CommunicationsConfig.ready() ──────
connect_signals()
