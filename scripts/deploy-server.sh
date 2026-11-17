#!/usr/bin/env bash
# Build the game-server image, push it to ECR and roll the ECS service.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
tf() { terraform -chdir="$ROOT/infra" output -raw "$1"; }

REGION=$(tf region); REPO=$(tf ecr_repo_url); CLUSTER=$(tf ecs_cluster); SERVICE=$(tf ecs_service)

aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "${REPO%%/*}"
# Fargate defaults to x86_64; --platform keeps this working from Apple-silicon laptops too.
docker buildx build --platform linux/amd64 -f "$ROOT/server/Dockerfile" -t "$REPO:latest" --push "$ROOT"
aws ecs update-service --cluster "$CLUSTER" --service "$SERVICE" --force-new-deployment --region "$REGION" >/dev/null
echo "Deployment started. Watch it: aws ecs describe-services --cluster $CLUSTER --services $SERVICE --region $REGION"
