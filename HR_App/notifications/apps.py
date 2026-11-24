from django.apps import AppConfig


class NotificationsConfig(AppConfig):
    name = 'notifications'

    def ready(self):
        from . import push  # noqa: F401  (registers push signal)
