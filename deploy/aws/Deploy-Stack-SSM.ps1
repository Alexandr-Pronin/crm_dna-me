<#
.SYNOPSIS
    DNA ME CRM — CloudFormation Stack (SSM-only, kein SSH)
    Erstellt den Stack fuer Deployment via AWS Systems Manager.

.PARAMETER StackName
    Name des CloudFormation Stacks (Standard: dna-crm-stack)

.PARAMETER DeployBucket
    S3 Bucket fuer Deploy-Artefakte (erforderlich). Vorher anlegen: aws s3 mb s3://BUCKET

.PARAMETER Region
    AWS Region (Standard: eu-central-1)

.EXAMPLE
    .\Deploy-Stack-SSM.ps1 -DeployBucket dna-crm-deploy-123456789012
#>

[CmdletBinding()]
param(
    [Parameter()]
    [string]$StackName = "dna-crm-stack",

    [Parameter(Mandatory = $true)]
    [string]$DeployBucket,

    [Parameter()]
    [string]$Region = "eu-central-1"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$TemplatePath = Join-Path $ScriptDir "cloudformation-ssm.yaml"

if (-not (Test-Path $TemplatePath)) {
    Write-Error "Template nicht gefunden: $TemplatePath"
}

Write-Host "=== DNA ME CRM — SSM Stack Deployment ===" -ForegroundColor Cyan
Write-Host "  Stack: $StackName | Bucket: $DeployBucket | Region: $Region" -ForegroundColor Gray
Write-Host ""

$prevErrorAction = $ErrorActionPreference
$ErrorActionPreference = "SilentlyContinue"
$null = aws cloudformation describe-stacks --stack-name $StackName --region $Region 2>&1
$StackExists = ($LASTEXITCODE -eq 0)
$ErrorActionPreference = $prevErrorAction

$Params = @(
    "ParameterKey=DeployBucket,ParameterValue=$DeployBucket"
)

if ($StackExists) {
    Write-Host "=== Update Stack ===" -ForegroundColor Yellow
    aws cloudformation update-stack `
        --stack-name $StackName `
        --template-body "file://$TemplatePath" `
        --parameters $Params `
        --region $Region
} else {
    Write-Host "=== Create Stack ===" -ForegroundColor Yellow
    aws cloudformation create-stack `
        --stack-name $StackName `
        --template-body "file://$TemplatePath" `
        --parameters $Params `
        --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM `
        --region $Region
}

Write-Host ""
Write-Host "=== Warte auf Stack-Abschluss ===" -ForegroundColor Yellow
$waitOp = if ($StackExists) { "stack-update-complete" } else { "stack-create-complete" }
aws cloudformation wait $waitOp --stack-name $StackName --region $Region
Write-Host "  Stack bereit." -ForegroundColor Green

Write-Host ""
Write-Host "=== Naechste Schritte ===" -ForegroundColor Cyan
Write-Host "  1. deploy/aws/.env.aws konfigurieren" -ForegroundColor Gray
Write-Host "  2. bash deploy/aws/deploy-aws-ssm.sh" -ForegroundColor Gray
Write-Host ""
