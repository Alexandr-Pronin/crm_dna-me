<#
.SYNOPSIS
    DNA ME CRM — DNS A-Record einrichten
    Erstellt crm.dna-me.net -> App-IP (Route53 oder Anleitung)
#>

$ErrorActionPreference = "Stop"
$Region = "eu-central-1"
$StackName = "dna-crm-stack"
$RecordName = "crm.dna-me.net"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# App-IP aus CloudFormation holen
$AppIP = aws cloudformation describe-stacks --stack-name $StackName --region $Region `
    --query "Stacks[0].Outputs[?OutputKey=='AppPublicIP'].OutputValue" --output text 2>$null

if (-not $AppIP) {
    Write-Host "FEHLER: Stack-Outputs nicht gefunden. Stack deployen." -ForegroundColor Red
    exit 1
}

Write-Host "=== DNA ME CRM - DNS Setup ===" -ForegroundColor Cyan
Write-Host "  Domain: $RecordName -> $AppIP" -ForegroundColor Gray
Write-Host ""

# Route53 Hosted Zone fuer dna-me.net suchen
$ZoneId = aws route53 list-hosted-zones --query "HostedZones[?Name=='dna-me.net.'].Id" --output text 2>$null
if (-not $ZoneId) {
    $ZoneId = aws route53 list-hosted-zones --query "HostedZones[?contains(Name,'dna-me')].Id" --output text 2>$null
}
$ZoneId = $ZoneId -replace "/hostedzone/", "" -replace "`t.*", ""

if ($ZoneId) {
    Write-Host "Route53 Hosted Zone gefunden. Erstelle A-Record..." -ForegroundColor Yellow
    $JsonPath = Join-Path $ScriptDir "dns-change.json"
    @"
{
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "$RecordName",
      "Type": "A",
      "TTL": 300,
      "ResourceRecords": [{"Value": "$AppIP"}]
    }
  }]
}
"@ | Set-Content -Path $JsonPath -Encoding UTF8
    
    $JsonPathUri = "file:///" + ($JsonPath -replace '\\', '/')
    aws route53 change-resource-record-sets --hosted-zone-id $ZoneId --change-batch $JsonPathUri 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Remove-Item $JsonPath -Force -ErrorAction SilentlyContinue
        Write-Host "  A-Record erstellt: $RecordName -> $AppIP" -ForegroundColor Green
        Write-Host ""
        Write-Host "Fertig! DNS-Propagation: 2-10 Minuten." -ForegroundColor Green
        Write-Host "  https://$RecordName" -ForegroundColor Gray
        exit 0
    }
    Remove-Item $JsonPath -Force -ErrorAction SilentlyContinue
}

Write-Host "Manuelle DNS-Einrichtung erforderlich:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Typ:    A" -ForegroundColor White
Write-Host "  Name:   crm" -ForegroundColor White
Write-Host "  Wert:   $AppIP" -ForegroundColor White
Write-Host "  TTL:    300" -ForegroundColor White
Write-Host ""
Write-Host "Bei Cloudflare/Strato/IONOS: DNS-Eintraege -> Neuer A-Record" -ForegroundColor Gray
Write-Host ""
