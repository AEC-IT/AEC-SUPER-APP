from .base import *

DEBUG = False
SECRET_KEY = os.environ.get('SECRET_KEY', 'aec-cinemas-super-secret-key-2026')
ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', '').split(',') if os.environ.get('ALLOWED_HOSTS') else []
