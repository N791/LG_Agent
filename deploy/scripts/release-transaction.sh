#!/usr/bin/env bash
set -Eeuo pipefail

: "${RELEASE_VERSION:?Set RELEASE_VERSION to vX.Y.Z}"
: "${IMAGE_TAG:?Set IMAGE_TAG to the same vX.Y.Z or sha-<40 hex> immutable tag}"
: "${BACKUP_VERIFICATION_ID:?Set BACKUP_VERIFICATION_ID to the successful restore drill record}"
: "${IMAGE_DIGESTS_FILE:?Set IMAGE_DIGESTS_FILE to the signed three-image digest manifest}"

if [[ ! "$RELEASE_VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]]; then
  echo "RELEASE_VERSION must be vX.Y.Z" >&2
  exit 2
fi
if [[ ! "$IMAGE_TAG" =~ ^(v[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?|sha-[a-f0-9]{40})$ ]]; then
  echo "IMAGE_TAG must be immutable (vX.Y.Z or sha-<40 hex>)" >&2
  exit 2
fi
if [[ ! -s "$IMAGE_DIGESTS_FILE" ]]; then
  echo "Image digest manifest is missing or empty: $IMAGE_DIGESTS_FILE" >&2
  exit 2
fi

RELEASE_NAME="${RELEASE_NAME:-lg-agent}"
RESOURCE_PREFIX="${RESOURCE_PREFIX:-$RELEASE_NAME}"
NAMESPACE="${NAMESPACE:-lg-agent-prod}"
CHART="${CHART:-deploy/helm/lg-agent}"
VALUES_FILE="${VALUES_FILE:-deploy/helm/lg-agent/values.production.yaml}"
TIMEOUT="${TIMEOUT:-10m}"
API_PUBLIC_URL="${API_PUBLIC_URL:-}"
SMOKE_COMMAND="${SMOKE_COMMAND:-node deploy/scripts/production-smoke.mjs}"

common=(
  "$RELEASE_NAME" "$CHART"
  --namespace "$NAMESPACE"
  --create-namespace
  --atomic
  --wait
  --timeout "$TIMEOUT"
  -f "$VALUES_FILE"
  --set-string "global.releaseVersion=$RELEASE_VERSION"
  --set-string "global.imageTag=$IMAGE_TAG"
  --set-string "api.image.tag=$IMAGE_TAG"
)

echo "Backup restore drill: $BACKUP_VERIFICATION_ID"
if helm status "$RELEASE_NAME" --namespace "$NAMESPACE" >/dev/null 2>&1; then
  ADMIN_PHASE_ONE_ENABLED=true
  TRAINEE_PHASE_ONE_ENABLED=true
  CURRENT_ADMIN_TAG="$(
    kubectl get deployment "$RESOURCE_PREFIX-admin-web" -n "$NAMESPACE" \
      -o jsonpath='{.spec.template.spec.containers[0].image}' | awk -F: '{print $NF}'
  )"
  CURRENT_TRAINEE_TAG="$(
    kubectl get deployment "$RESOURCE_PREFIX-trainee-web" -n "$NAMESPACE" \
      -o jsonpath='{.spec.template.spec.containers[0].image}' | awk -F: '{print $NF}'
  )"
else
  ADMIN_PHASE_ONE_ENABLED=false
  TRAINEE_PHASE_ONE_ENABLED=false
  CURRENT_ADMIN_TAG="$IMAGE_TAG"
  CURRENT_TRAINEE_TAG="$IMAGE_TAG"
fi

echo "Phase 1/3: migration, authorization registry and API"
helm upgrade --install "${common[@]}" \
  --set release.runMigration=true \
  --set api.enabled=true \
  --set "adminWeb.enabled=$ADMIN_PHASE_ONE_ENABLED" \
  --set-string "adminWeb.image.tag=$CURRENT_ADMIN_TAG" \
  --set "traineeWeb.enabled=$TRAINEE_PHASE_ONE_ENABLED" \
  --set-string "traineeWeb.image.tag=$CURRENT_TRAINEE_TAG"
kubectl rollout status "deployment/$RESOURCE_PREFIX-api" -n "$NAMESPACE" --timeout="$TIMEOUT"

if [[ -n "$API_PUBLIC_URL" ]]; then
  curl --fail --silent --show-error "$API_PUBLIC_URL/api/v1/health/ready" >/dev/null
fi

echo "Phase 2/3: Admin Web"
helm upgrade "${common[@]}" \
  --set release.runMigration=false \
  --set api.enabled=true \
  --set adminWeb.enabled=true \
  --set-string "adminWeb.image.tag=$IMAGE_TAG" \
  --set "traineeWeb.enabled=$TRAINEE_PHASE_ONE_ENABLED" \
  --set-string "traineeWeb.image.tag=$CURRENT_TRAINEE_TAG"
kubectl rollout status "deployment/$RESOURCE_PREFIX-admin-web" -n "$NAMESPACE" --timeout="$TIMEOUT"

echo "Phase 3/3: Trainee Web"
helm upgrade "${common[@]}" \
  --set release.runMigration=false \
  --set api.enabled=true \
  --set adminWeb.enabled=true \
  --set-string "adminWeb.image.tag=$IMAGE_TAG" \
  --set traineeWeb.enabled=true \
  --set-string "traineeWeb.image.tag=$IMAGE_TAG"
kubectl rollout status "deployment/$RESOURCE_PREFIX-trainee-web" -n "$NAMESPACE" --timeout="$TIMEOUT"

echo "Running production authorization smoke suite"
bash -lc "$SMOKE_COMMAND"
echo "Release transaction completed: $RELEASE_VERSION ($IMAGE_TAG)"
