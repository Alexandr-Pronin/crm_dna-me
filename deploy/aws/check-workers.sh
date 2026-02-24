#!/bin/bash
# Check workers and recent errors on the App EC2 instance via SSM
STACK_NAME="${STACK_NAME:-dna-crm-stack}"
REGION="${AWS_REGION:-eu-central-1}"

INSTANCE_ID=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='AppInstanceId'].OutputValue" --output text)
echo "Instance: $INSTANCE_ID"

CMD_ID=$(aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["
echo \"=== Container Status ===\"
docker ps -a

echo \"\"
echo \"=== Worker Logs (last 80 lines) ===\"
docker logs dna_workers 2>&1 | tail -80

echo \"\"
echo \"=== API Logs (errors + last 30 lines) ===\"
docker logs dna_api 2>&1 | grep -iE \"error|fail|deactivated|does not exist|unhandled\" | tail -30
docker logs dna_api 2>&1 | tail -30

echo \"\"
echo \"=== Redis Queue depth ===\"
docker exec dna_redis redis-cli LLEN bull:EVENTS:wait 2>/dev/null || echo \"(redis not running or queue key different)\"
docker exec dna_redis redis-cli keys \"bull:*\" 2>/dev/null | head -20
"]' \
  --region "$REGION" \
  --query "Command.CommandId" --output text)

echo "CommandId: $CMD_ID — waiting..."
sleep 12
aws ssm get-command-invocation --command-id "$CMD_ID" --instance-id "$INSTANCE_ID" \
  --region "$REGION" --query "StandardOutputContent" --output text
