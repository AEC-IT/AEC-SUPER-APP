from django.db import models

class SuperAppModule(models.Model):
    module_key = models.CharField(
        max_length=50, 
        unique=True, 
        help_text="Unique key identifier, e.g. HR, THEATER"
    )
    module_name = models.CharField(max_length=100)
    display_name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    route_slug = models.SlugField(max_length=100, unique=True)
    api_base_url = models.URLField(
        help_text="Base URL for the downstream API, e.g. http://localhost:8001"
    )
    icon = models.CharField(
        max_length=100, 
        blank=True, 
        help_text="Lucide or FontAwesome icon name"
    )
    display_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    role_access = models.JSONField(
        default=list, 
        blank=True, 
        help_text="List of roles allowed to access this module, e.g. ['STAFF', 'ADMIN', 'MD']"
    )

    class Meta:
        verbose_name = "Super App Module"
        verbose_name_plural = "Super App Modules"
        ordering = ['display_order', 'display_name']

    def __str__(self):
        return f"{self.display_name} ({self.module_key})"
