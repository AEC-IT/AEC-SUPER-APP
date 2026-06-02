"""apps/communications/apps.py — Communications Django app config."""

from django.apps import AppConfig


class CommunicationsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.communications'
    verbose_name = 'Communications'

    def ready(self):
        # Wire up signal handlers for automatic alert notifications.
        import apps.communications.signals  # noqa: F401
