#!/bin/bash

REGION="ap-northeast-1"
PROFILE="patient"
PROJECT="patient-management-dev-migrate"

echo "Getting latest build for project: $PROJECT"

BUILD_ID=$(aws codebuild list-builds-for-project \
  --project-name "$PROJECT" \
  --profile "$PROFILE" \
  --region "$REGION" \
  --max-items 1 \
  --query 'ids[0]' \
  --output text)

if [ -z "$BUILD_ID" ] || [ "$BUILD_ID" = "None" ]; then
    echo "No builds found"
    exit 1
fi

echo "Build ID: $BUILD_ID"

# Get log group and stream
BUILD_INFO=$(aws codebuild batch-get-builds \
  --ids "$BUILD_ID" \
  --profile "$PROFILE" \
  --region "$REGION" \
  --output json)

LOG_GROUP=$(echo "$BUILD_INFO" | jq -r '.builds[0].logs.groupName // ""')
LOG_STREAM=$(echo "$BUILD_INFO" | jq -r '.builds[0].logs.streamName // ""')

if [ -z "$LOG_GROUP" ] || [ -z "$LOG_STREAM" ]; then
    echo "Log group or stream not found yet. Build may not have started."
    echo "Try running watch-build.sh first to see the build status."
    exit 1
fi

echo "Log Group: $LOG_GROUP"
echo "Log Stream: $LOG_STREAM"
echo ""
echo "Tailing logs (press Ctrl+C to stop)..."
echo "---"

# Tail the logs
aws logs tail "$LOG_GROUP" \
  --profile "$PROFILE" \
  --region "$REGION" \
  --follow \
  --format short \
  --filter-pattern "$LOG_STREAM"
