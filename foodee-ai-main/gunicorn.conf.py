"""Gunicorn production configuration optimized for Foodee AI microservice."""
import os

# Server socket
bind = os.getenv("GUNICORN_BIND", "0.0.0.0:5000")
backlog = int(os.getenv("GUNICORN_BACKLOG", "2048"))

# Worker processes & threads
# 2 workers x 2 threads = 4 concurrency slots (optimal for CPU memory balance in PyTorch/TFLite)
workers = int(os.getenv("GUNICORN_WORKERS", "2"))
threads = int(os.getenv("GUNICORN_THREADS", "2"))
worker_class = "gthread"
worker_connections = 1000
timeout = int(os.getenv("GUNICORN_TIMEOUT", "120"))
keepalive = int(os.getenv("GUNICORN_KEEPALIVE", "5"))

# Memory management & recycling (mitigate fragmentation from OpenCV/PyTorch buffers)
max_requests = int(os.getenv("GUNICORN_MAX_REQUESTS", "1000"))
max_requests_jitter = int(os.getenv("GUNICORN_MAX_REQUESTS_JITTER", "50"))

# Server mechanics
preload_app = False  # Avoid preloading to prevent fork deadlocks in PyTorch/TFLite C++ runtimes
daemon = False

# Logging
loglevel = os.getenv("GUNICORN_LOG_LEVEL", "info")
accesslog = "-"
errorlog = "-"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(L)ss'
