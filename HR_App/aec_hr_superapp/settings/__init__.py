import os
import sys
from pathlib import Path
from decouple import config

# Dynamically route settings based on environment
env = config('DJANGO_ENV', default='dev').lower()
if env == 'prod':
    from .prod import *
else:
    from .dev import *
