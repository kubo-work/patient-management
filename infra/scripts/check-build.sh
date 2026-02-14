#!/bin/bash

REGION="ap-northeast-1"
PROFILE="patient"
PROJECT="patient-management-dev-migrate"

# Get the latest build ID (full ARN format)
BUILD_ARN=$(aws codebuild list-builds-for-project \
  --project-name "$PROJECT" \
  --profile "$PROFILE" \
  --region "$REGION" \
  --max-items 1 \
  --query 'ids[0]' \
  --output text)

echo "Latest Build ARN: $BUILD_ARN"
echo ""

# Get build details
echo "=== Build Status ==="
aws codebuild batch-get-builds \
  --ids "$BUILD_ARN" \
  --profile "$PROFILE" \
  --region "$REGION" \
  --query 'builds[0].{Phase:currentPhase,Status:buildStatus,Start:startTime}' \
  --output table

echo ""
echo "=== Phase Details ==="
aws codebuild batch-get-builds \
  --ids "$BUILD_ARN" \
  --profile "$PROFILE" \
  --region "$REGION" \
  --query 'builds[0].phases[*].{Phase:phaseType,Status:phaseStatus,Duration:durationInSeconds}' \
  --output table

echo ""
echo "=== CloudWatch Logs URL ==="
aws codebuild batch-get-builds \
  --ids "$BUILD_ARN" \
  --profile "$PROFILE" \
  --region "$REGION" \
  --query 'builds[0].logs.deepLink' \
  --output text
