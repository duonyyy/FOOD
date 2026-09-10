#!/bin/sh
set -eu

# Named volumes created by the legacy MinIO image are root-owned. Normalize
# ownership once before dropping privileges for the actual server process.
chown -R minio:minio /data
exec su-exec minio:minio /usr/local/bin/minio "$@"
