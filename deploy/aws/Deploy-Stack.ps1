<#
.SYNOPSIS
    DNA ME CRM — CloudFormation Stack Deployment (PowerShell)
    Erstellt oder aktualisiert den AWS CloudFormation Stack für App + DB Instanzen.

.DESCRIPTION
    Automatisiert das Deployment des DNA ME CRM Stacks in eu-central-1.
    Unterstützt sowohl create-stack als auch update-stack.

.PARAMETER StackName
    Name des CloudFormation Stacks (Standard: dna-crm-stack)

.PARAMETER KeyPairName
    Name des EC2 Key Pairs für SSH-Zugriff (erforderlich)

.PARAMETER AllowedCidr
    Ihre IP im CIDR-Format für SSH (z.B. 203.0.113.50/32). Standard: 1.1.1.1/32

.PARAMETER DomainName
    Domain für die Anwendung (Standard: crm.dna-me.com)

.PARAMETER LetsEncryptEmail
    E-Mail für Let's Encrypt Zertifikate (Standard: admin@dna-me.com)

.PARAMETER S3BackupBucket
    Optional: S3 Bucket für Off-Site Backups (z.B. dna-crm-backups)

.PARAMETER Region
    AWS Region (Standard: eu-central-1)

.PARAMETER SkipWait
    Warten auf Stack-Abschluss überspringen

.EXAMPLE
    .\Deploy-Stack.ps1 -KeyPairName my-key -AllowedCidr "203.0.113.50/32"

.EXAMPLE
    .\Deploy-Stack.ps1 -KeyPairName my-key -AllowedCidr "203.0.113.50/32" -S3BackupBucket dna-crm-backups
#>

[CmdletBinding()]
param(
    [Parameter()]
    [string]$StackName = "dna-crm-stack",

    [Parameter(Mandatory = $true)]
    [string]$KeyPairName,

    [Parameter()]
    [string]$AllowedCidr = "1.1.1.1/32",

    [Parameter()]
    [string]$DomainName = "crm.dna-me.com",

    [Parameter()]
    [string]$LetsEncryptEmail = "admin@dna-me.com",

    [Parameter()]
    [string]$S3BackupBucket = "",

    [Parameter()]
    [string]$Region = "eu-central-1",

    [Parameter()]
    [switch]$SkipWait
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$TemplatePath = Join-Path $ScriptDir "cloudformation.yaml"

# ---------------------------------------------------------------------------
# Prüfungen
# ---------------------------------------------------------------------------
if (-not (Test-Path $TemplatePath)) {
    Write-Error "Template nicht gefunden: $TemplatePath"
}

# AWS CLI prüfen
try {
    $null = aws --version 2>&1
} catch {
    Write-Error "AWS CLI nicht gefunden. Bitte installieren und konfigurieren."
}

Write-Host "=== DNA ME CRM — CloudFormation Deployment ===" -ForegroundColor Cyan
Write-Host "  Stack: $StackName | Region: $Region" -ForegroundColor Gray
Write-Host ""

# ---------------------------------------------------------------------------
# Parameter für CloudFormation
# ---------------------------------------------------------------------------
$Params = @(
    "ParameterKey=KeyPairName,ParameterValue=$KeyPairName",
    "ParameterKey=AllowedCidr,ParameterValue=$AllowedCidr",
    "ParameterKey=DomainName,ParameterValue=$DomainName",
    "ParameterKey=LetsEncryptEmail,ParameterValue=$LetsEncryptEmail"
)

if (-not [string]::IsNullOrWhiteSpace($S3BackupBucket)) {
    $Params += "ParameterKey=S3BackupBucket,ParameterValue=$S3BackupBucket"
}

# ---------------------------------------------------------------------------
# Stack existiert? → Update, sonst Create
# ---------------------------------------------------------------------------
$StackExists = $false
$prevErrorAction = $ErrorActionPreference
$ErrorActionPreference = "SilentlyContinue"
$null = aws cloudformation describe-stacks --stack-name $StackName --region $Region 2>&1
$StackExists = ($LASTEXITCODE -eq 0)
$ErrorActionPreference = $prevErrorAction

Write-Host "=== $($(if ($StackExists) { "Update" } else { "Create" })) Stack ===" -ForegroundColor Yellow
Write-Host "  KeyPair: $KeyPairName | AllowedCidr: $AllowedCidr" -ForegroundColor Gray
if ($S3BackupBucket) { Write-Host "  S3BackupBucket: $S3BackupBucket" -ForegroundColor Gray }
Write-Host ""

$cmdOutput = $null
if ($StackExists) {
    $cmdOutput = aws cloudformation update-stack `
        --stack-name $StackName `
        --template-body "file://$TemplatePath" `
        --parameters $Params `
        --capabilities CAPABILITY_IAM `
        --region $Region 2>&1
} else {
    $cmdOutput = aws cloudformation create-stack `
        --stack-name $StackName `
        --template-body "file://$TemplatePath" `
        --parameters $Params `
        --capabilities CAPABILITY_IAM `
        --region $Region 2>&1
}

if ($LASTEXITCODE -ne 0) {
    $errMsg = if ($cmdOutput -is [array]) { $cmdOutput -join " " } else { $cmdOutput }
    if ($errMsg -match "No updates to be performed") {
        Write-Host "Keine Änderungen erforderlich. Stack ist bereits aktuell." -ForegroundColor Green
        $SkipWait = $true
    } else {
        Write-Error "CloudFormation Fehler: $errMsg"
    }
}

# ---------------------------------------------------------------------------
# Warten auf Abschluss
# ---------------------------------------------------------------------------
if (-not $SkipWait) {
    Write-Host ""
    Write-Host "=== Warte auf Stack-Abschluss ===" -ForegroundColor Yellow
    $waitOp = if ($StackExists) { "stack-update-complete" } else { "stack-create-complete" }
    aws cloudformation wait $waitOp --stack-name $StackName --region $Region
    Write-Host "  Stack bereit." -ForegroundColor Green
}

# ---------------------------------------------------------------------------
# Outputs anzeigen
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "=== Stack Outputs ===" -ForegroundColor Cyan
$outputs = aws cloudformation describe-stacks `
    --stack-name $StackName `
    --region $Region `
    --query "Stacks[0].Outputs" `
    --output json | ConvertFrom-Json

foreach ($o in $outputs) {
    $key = $o.OutputKey
    $val = $o.OutputValue
    $desc = if ($o.Description) { " - $($o.Description)" } else { "" }
    Write-Host ("  " + $key + ": " + $val + $desc) -ForegroundColor White
}

Write-Host ""
Write-Host "=== Nächste Schritte ===" -ForegroundColor Cyan
$appIp = ($outputs | Where-Object { $_.OutputKey -eq "AppPublicIP" }).OutputValue
if ($appIp) {
    Write-Host "  1. DNS A-Record: $DomainName -> $appIp" -ForegroundColor Gray
    Write-Host "  2. deploy/aws/.env.aws konfigurieren (POSTGRES_PASSWORD, JWT_SECRET, etc.)" -ForegroundColor Gray
    Write-Host "  3. Anwendung deployen: bash deploy/aws/deploy-aws.sh" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  SSH: ssh -i ~/.ssh/$KeyPairName.pem ec2-user@$appIp" -ForegroundColor Gray
    Write-Host "  Health: https://$appIp/health" -ForegroundColor Gray
}
Write-Host ""
Write-Host "Deployment abgeschlossen." -ForegroundColor Green
