import multiprocessing
import os

# Server socket
bind = f"0.0.0.0:{os.environ.get('PORT', '8000')}"

# Worker processes
workers = int(os.environ.get('WEB_CONCURRENCY', multiprocessing.cpu_count() * 2 + 1))
threads = int(os.environ.get('PYTHON_MAX_THREADS', '4'))
worker_class = 'gthread'
timeout = int(os.environ.get('WEB_TIMEOUT', '120'))
keepalive = 5

# Logging
accesslog = '-'
errorlog = '-'
loglevel = os.environ.get('LOG_LEVEL', 'info')

# Process naming
proc_name = 'aec_hr_superapp'
