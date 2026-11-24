"""
Web Push delivery (works on Android Chrome and on iOS 16.4+ once the PWA is
installed to the home screen).

Configure with env vars (generate once with `python manage.py vapid_keys`):
    WEBPUSH_VAPID_PUBLIC_KEY, WEBPUSH_VAPID_PRIVATE_KEY, WEBPUSH_CONTACT (mailto:)
If keys are missing, push is skipped silently and only in-app notices are made.
"""
import json
import logging

from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)

BROADCAST_TYPES = {'GENERAL', 'BIRTHDAY_WISH', 'ANNIVERSARY_WISH', 'ONBOARDING_WISH', 'PROMOTION_WISH'}


def push_enabled():
    return bool(getattr(settings, 'WEBPUSH_VAPID_PRIVATE_KEY', '') and
                getattr(settings, 'WEBPUSH_VAPID_PUBLIC_KEY', ''))


def send_push(users, title, body, url='/'):
    """Send a push to every subscription of the given users. Returns count sent."""
    if not push_enabled():
        return 0
    try:
        from pywebpush import WebPushException, webpush
    except ImportError:
        logger.warning("pywebpush not installed; skipping push")
        return 0
    from .models import PushSubscription
    payload = json.dumps({'title': title, 'body': body[:240], 'url': url})
    sent = 0
    for sub in PushSubscription.objects.filter(user__in=users, user__is_active=True):
        try:
            webpush(
                subscription_info={'endpoint': sub.endpoint, 'keys': {'p256dh': sub.p256dh, 'auth': sub.auth}},
                data=payload,
                vapid_private_key=settings.WEBPUSH_VAPID_PRIVATE_KEY,
                vapid_claims={'sub': getattr(settings, 'WEBPUSH_CONTACT', 'mailto:hr@aecgroup.in')},
                timeout=5,
            )
            sent += 1
        except WebPushException as e:
            status = getattr(getattr(e, 'response', None), 'status_code', None)
            if status in (404, 410):  # subscription expired / unsubscribed
                sub.delete()
            else:
                logger.warning("push failed for %s: %s", sub.pk, e)
        except Exception as e:  # network etc. — never break the request
            logger.warning("push error for %s: %s", sub.pk, e)
    return sent


def notify_profile(profile_id, title, message, url='/notifications/'):
    """Personal in-app notification (+ push via the signal below)."""
    from .models import Notification
    Notification.objects.create(title=title, message=message, target_profile_id=profile_id,
                                notification_type='PERSONAL')


@receiver(post_save, sender='notifications.Notification')
def push_on_new_notification(sender, instance, created, **kwargs):
    if not created or not instance.is_active or not push_enabled():
        return
    from django.contrib.auth import get_user_model
    User = get_user_model()
    if instance.notification_type in BROADCAST_TYPES and (
            instance.target_profile_id is None or instance.notification_type != 'GENERAL'):
        users = User.objects.filter(is_active=True)
        if instance.created_by_id:
            users = users.exclude(pk=instance.created_by_id)
    elif instance.target_profile_id:
        users = User.objects.filter(employee_profile__id=instance.target_profile_id)
    else:
        return
    send_push(users, instance.title, instance.message, url='/notifications/')
