import os
import sys
from pathlib import Path
from datetime import timedelta

# BASE_DIR points to the super_shell directory
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Set up PYTHONPATH adjustments for shared tenants foundation & Theater_ERP apps
PARENT_DIR = BASE_DIR.parent
THEATER_DIR = PARENT_DIR / 'Theater_ERP'

if str(PARENT_DIR) not in sys.path:
    sys.path.insert(0, str(PARENT_DIR))
if str(THEATER_DIR) not in sys.path:
    sys.path.insert(0, str(THEATER_DIR))

SECRET_KEY = 'aec-cinemas-super-secret-key-2026'
DEBUG = True
ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Third party apps
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'django_filters',
    
    # Shared foundation apps
    'apps.tenants',
    'apps.accounts',
    
    # Super shell local apps
    'platform_core',
    'module_registry',
    'md_dashboard',
    'integrations',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    
    # Tenant context middleware
    'shared.tenants.middleware.TenantMiddleware',
]

ROOT_URLCONF = 'super_shell.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'super_shell.wsgi.application'

# Database
# Connect to the Neon DB of Theater_ERP
import dj_database_url
# Default fallback to the main database URL
DATABASE_URL = os.environ.get(
    'DATABASE_URL', 
    'postgresql://neondb_owner:npg_TvBeNh3HO2GP@ep-twilight-dust-aoz4w2e2.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
)

DATABASES = {
    'default': dj_database_url.config(
        default=DATABASE_URL,
        conn_max_age=60,
        conn_health_checks=True,
    )
}
DATABASES['default'].setdefault('OPTIONS', {})
DATABASES['default']['OPTIONS'].update({
    'sslmode': 'require',
    'options': '-c default_transaction_isolation=serializable',
})

# Re-use Custom User model from Theater_ERP
AUTH_USER_MODEL = 'accounts.User'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Kolkata'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
    ],
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=8),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# Cross-module API settings
HR_APP_API_URL = os.environ.get('HR_APP_API_URL', 'http://localhost:8001')
THEATER_ERP_API_URL = os.environ.get('THEATER_ERP_API_URL', 'http://localhost:8002')
HR_FRONTEND_URL = os.environ.get('HR_FRONTEND_URL', 'http://localhost:8001')
THEATER_FRONTEND_URL = os.environ.get('THEATER_FRONTEND_URL', 'http://localhost:5173')

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
}

MIGRATION_MODULES = {
    'tenants': None,
    'accounts': None,
    'module_registry': None,
}

