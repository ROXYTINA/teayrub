#!/usr/bin/env bash
# Upload the static frontend to S3 and clear the CloudFront cache.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
tf() { terraform -chdir="$ROOT/infra" output -raw "$1"; }

BUCKET=$(tf web_bucket); DIST=$(tf cloudfront_id)
aws s3 sync "$ROOT/web" "s3://$BUCKET" --delete
aws cloudfront create-invalidation --distribution-id "$DIST" --paths "/*" >/dev/null
echo "Frontend live at $(tf site_url)"
