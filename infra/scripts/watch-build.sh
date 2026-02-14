#!/bin/bash

REGION="ap-northeast-1"
PROFILE="patient"
PROJECT="patient-management-dev-migrate"

# Get AWS Account ID
ACCOUNT_ID=$(aws sts get-caller-identity --profile "$PROFILE" --query Account --output text 2>/dev/null)

if [ -z "$ACCOUNT_ID" ]; then
    echo "Error: Could not get AWS Account ID"
    exit 1
fi

echo "Monitoring latest build for project: $PROJECT"
echo "Region: $REGION"
echo ""

for i in {1..60}; do
    BUILD_ID=$(aws codebuild list-builds-for-project \
      --project-name "$PROJECT" \
      --profile "$PROFILE" \
      --region "$REGION" \
      --max-items 1 \
      --query 'ids[0]' \
      --output text 2>/dev/null)
    
    if [ -z "$BUILD_ID" ] || [ "$BUILD_ID" = "None" ]; then
        echo "No builds found. Waiting for build to start..."
        sleep 5
        continue
    fi
    
    # BUILD_IDをARN形式に変換
    if [[ $BUILD_ID != arn:* ]]; then
        BUILD_ARN="arn:aws:codebuild:${REGION}:${ACCOUNT_ID}:build/${BUILD_ID}"
    else
        BUILD_ARN="$BUILD_ID"
    fi
    
    # ビルド情報を取得
    BUILD_INFO=$(aws codebuild batch-get-builds \
      --ids "$BUILD_ARN" \
      --profile "$PROFILE" \
      --region "$REGION" \
      --output json 2>/dev/null)
    
    if [ -z "$BUILD_INFO" ]; then
        echo "Error getting build info"
        sleep 5
        continue
    fi
    
    PHASE=$(echo "$BUILD_INFO" | jq -r '.builds[0].currentPhase // "UNKNOWN"')
    STATUS=$(echo "$BUILD_INFO" | jq -r '.builds[0].buildStatus // "UNKNOWN"')
    
    # 色付きで表示
    case "$STATUS" in
        "IN_PROGRESS")
            COLOR="\033[1;33m"  # Yellow
            ;;
        "SUCCEEDED")
            COLOR="\033[1;32m"  # Green
            ;;
        "FAILED")
            COLOR="\033[1;31m"  # Red
            ;;
        *)
            COLOR="\033[0m"     # Reset
            ;;
    esac
    
    echo -e "${COLOR}[$(date '+%H:%M:%S')] Phase: $PHASE | Status: $STATUS\033[0m"
    
    # 終了状態をチェック
    if [ "$STATUS" = "SUCCEEDED" ] || [ "$STATUS" = "FAILED" ] || [ "$STATUS" = "STOPPED" ]; then
        echo ""
        echo "=== Build completed with status: $STATUS ==="
        echo ""
        
        # フェーズの詳細を表示
        echo "Phase Details:"
        echo "$BUILD_INFO" | jq -r '.builds[0].phases[] | "  \(.phaseType): \(.phaseStatus) (\(.durationInSeconds // 0)s)"'
        echo ""
        
        # ログURLを表示
        LOG_GROUP=$(echo "$BUILD_INFO" | jq -r '.builds[0].logs.groupName // ""')
        LOG_STREAM=$(echo "$BUILD_INFO" | jq -r '.builds[0].logs.streamName // ""')
        LOG_URL=$(echo "$BUILD_INFO" | jq -r '.builds[0].logs.deepLink // ""')
        
        if [ -n "$LOG_URL" ]; then
            echo "CloudWatch Logs URL:"
            echo "$LOG_URL"
            echo ""
        fi
        
        # 最新のログを表示
        if [ -n "$LOG_GROUP" ] && [ -n "$LOG_STREAM" ]; then
            echo "Recent logs:"
            echo "---"
            aws logs get-log-events \
              --profile "$PROFILE" \
              --region "$REGION" \
              --log-group-name "$LOG_GROUP" \
              --log-stream-name "$LOG_STREAM" \
              --limit 20 \
              --query 'events[*].message' \
              --output text 2>/dev/null || echo "Could not fetch logs"
        fi
        
        break
    fi
    
    sleep 5
done

if [ $i -eq 60 ]; then
    echo ""
    echo "Timeout: Build is still running after 5 minutes"
fi
