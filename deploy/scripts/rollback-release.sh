#!/usr/bin/env bash
set -Eeuo pipefail

: "${RELEASE_NAME:=lg-agent}"
: "${RESOURCE_PREFIX:=$RELEASE_NAME}"
: "${NAMESPACE:=lg-agent-prod}"
: "${ROLLBACK_REVISION:?Set ROLLBACK_REVISION to the last known-good Helm revision}"
: "${TIMEOUT:=10m}"

echo "Rolling back application resources only; no destructive database migration is run."
helm rollback "$RELEASE_NAME" "$ROLLBACK_REVISION" \
  --namespace "$NAMESPACE" \
  --wait \
  --timeout "$TIMEOUT"
kubectl rollout status "deployment/$RESOURCE_PREFIX-api" -n "$NAMESPACE" --timeout="$TIMEOUT"
kubectl rollout status "deployment/$RESOURCE_PREFIX-admin-web" -n "$NAMESPACE" --timeout="$TIMEOUT"
kubectl rollout status "deployment/$RESOURCE_PREFIX-trainee-web" -n "$NAMESPACE" --timeout="$TIMEOUT"
node deploy/scripts/production-smoke.mjs
