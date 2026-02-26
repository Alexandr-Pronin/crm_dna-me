#!/bin/bash
INSTANCE_ID=$(aws cloudformation describe-stacks --stack-name dna-crm-stack --region eu-central-1 --query "Stacks[0].Outputs[?OutputKey=='AppInstanceId'].OutputValue" --output text)
CMD_ID=$(aws ssm send-command --instance-ids "$INSTANCE_ID" --document-name "AWS-RunShellScript" --parameters 'commands=["docker logs dna_nginx_proxy 2>&1 | tail -50"]' --region eu-central-1 --query "Command.CommandId" --output text)
sleep 5
aws ssm get-command-invocation --command-id "$CMD_ID" --instance-id "$INSTANCE_ID" --region eu-central-1 --query "StandardOutputContent" --output text
