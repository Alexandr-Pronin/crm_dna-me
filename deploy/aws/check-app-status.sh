#!/bin/bash
# Quick status check for App instance
set -e
INSTANCE_ID=$(aws cloudformation describe-stacks --stack-name dna-crm-stack --region eu-central-1 --query "Stacks[0].Outputs[?OutputKey=='AppInstanceId'].OutputValue" --output text)
echo "Instance: $INSTANCE_ID"
CMD_ID=$(aws ssm send-command --instance-ids "$INSTANCE_ID" --document-name "AWS-RunShellScript" --parameters 'commands=["docker ps -a 2>/dev/null; echo ---; netstat -tlnp 2>/dev/null | grep -E \"80|443\" || ss -tlnp | grep -E \":80 |:443 \""]' --region eu-central-1 --query "Command.CommandId" --output text)
echo "CommandId: $CMD_ID"
sleep 5
aws ssm get-command-invocation --command-id "$CMD_ID" --instance-id "$INSTANCE_ID" --region eu-central-1 --query "StandardOutputContent" --output text
