#!/usr/bin/env bash
# Failover drill: stop every game-server task running in one AZ.
#   ./simulate-az-failure.sh ap-southeast-1a
#   FAIL_REDIS=1 ./simulate-az-failure.sh ap-southeast-1a   # also fail over the Redis primary
# Players should see "Reconnecting…", then continue the same game on the other AZ's tasks.
set -euo pipefail
AZ=${1:?usage: simulate-az-failure.sh <availability-zone, e.g. ap-southeast-1a>}
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
tf() { terraform -chdir="$ROOT/infra" output -raw "$1"; }
REGION=$(tf region); CLUSTER=$(tf ecs_cluster); SERVICE=$(tf ecs_service)

for t in $(aws ecs list-tasks --cluster "$CLUSTER" --service-name "$SERVICE" --region "$REGION" --query 'taskArns[]' --output text); do
  az=$(aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$t" --region "$REGION" --query 'tasks[0].availabilityZone' --output text)
  if [ "$az" = "$AZ" ]; then
    aws ecs stop-task --cluster "$CLUSTER" --task "$t" --region "$REGION" --reason "AZ failover drill" >/dev/null
    echo "stopped $t ($az)"
  fi
done

if [ "${FAIL_REDIS:-0}" = "1" ]; then
  aws elasticache test-failover --replication-group-id "$(tf redis_replication_group)" --node-group-id 0001 --region "$REGION" >/dev/null
  echo "Redis failover started (takes ~30-60 s)"
fi
