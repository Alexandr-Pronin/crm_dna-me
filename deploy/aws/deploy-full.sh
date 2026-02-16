#!/bin/bash
# =============================================================================
# DNA ME CRM — Vollautomatisches Deployment (SSM, kein SSH)
# 1. Validiert .env.aws
# 2. Legt S3-Bucket an (falls nicht vorhanden)
# 3. Erstellt/aktualisiert CloudFormation Stack
# 4. Wartet auf Stack + SSM-Registrierung
# 5. Deployed die Anwendung
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
STACK_NAME="${STACK_NAME:-dna-crm-stack}"
REGION="${AWS_REGION:-eu-central-1}"
DEPLOY_BUCKET="${DEPLOY_BUCKET:-}"
SSM_WAIT_MAX="${SSM_WAIT_MAX:-300}"
SSM_WAIT_INTERVAL="${SSM_WAIT_INTERVAL:-15}"

# ---------------------------------------------------------------------------
# 1. Umgebungsvariablen validieren
# ---------------------------------------------------------------------------
validate_env() {
  echo "=== 1. Validiere deploy/aws/.env.aws ==="
  local env_file="$PROJECT_ROOT/deploy/aws/.env.aws"
  if [[ ! -f "$env_file" ]]; then
    echo "FEHLER: $env_file nicht gefunden."
    echo "  cp deploy/aws/.env.aws.example deploy/aws/.env.aws"
    echo "  Dann POSTGRES_PASSWORD, JWT_SECRET, WEBHOOK_SECRET setzen."
    exit 1
  fi

  source "$env_file" 2>/dev/null || true
  local missing=()
  [[ -z "${POSTGRES_PASSWORD:-}" ]] || [[ "$POSTGRES_PASSWORD" == "CHANGE_ME"* ]] && missing+=("POSTGRES_PASSWORD")
  [[ -z "${JWT_SECRET:-}" ]] || [[ "$JWT_SECRET" == "CHANGE_ME"* ]] && missing+=("JWT_SECRET")
  [[ -z "${WEBHOOK_SECRET:-}" ]] || [[ "$WEBHOOK_SECRET" == "CHANGE_ME"* ]] && missing+=("WEBHOOK_SECRET")

  if [[ ${#missing[@]} -gt 0 ]]; then
    echo "FEHLER: Folgende Variablen fehlen oder sind Platzhalter in .env.aws:"
    printf '  - %s\n' "${missing[@]}"
    exit 1
  fi
  echo "  OK: POSTGRES_PASSWORD, JWT_SECRET, WEBHOOK_SECRET gesetzt"
}

# ---------------------------------------------------------------------------
# 2. S3-Bucket anlegen (falls nicht vorhanden)
# ---------------------------------------------------------------------------
ensure_bucket() {
  echo ""
  echo "=== 2. S3 Deploy-Bucket ==="
  if [[ -n "$DEPLOY_BUCKET" ]]; then
    echo "  Verwende: $DEPLOY_BUCKET"
  else
    local account_id
    account_id=$(aws sts get-caller-identity --query Account --output text --region "$REGION")
    DEPLOY_BUCKET="dna-crm-deploy-${account_id}"
    echo "  Auto: $DEPLOY_BUCKET"
  fi

  if aws s3api head-bucket --bucket "$DEPLOY_BUCKET" 2>/dev/null; then
    echo "  Bucket existiert bereits."
  else
    echo "  Erstelle Bucket..."
    aws s3 mb "s3://${DEPLOY_BUCKET}" --region "$REGION"
    echo "  Bucket erstellt."
  fi
  export DEPLOY_BUCKET
}

# ---------------------------------------------------------------------------
# 3. CloudFormation Stack erstellen/aktualisieren
# ---------------------------------------------------------------------------
deploy_stack() {
  echo ""
  echo "=== 3. CloudFormation Stack ==="
  local template="$SCRIPT_DIR/cloudformation-ssm.yaml"
  if [[ ! -f "$template" ]]; then
    echo "FEHLER: Template nicht gefunden: $template"
    exit 1
  fi
  # Absolute path fuer AWS CLI (Windows: file://e:/path)
  local template_abs
  template_abs=$(cd "$(dirname "$template")" && pwd -P)/$(basename "$template")
  if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ "$(uname -s)" == "MINGW"* ]]; then
    template_abs="file://$(echo "$template_abs" | sed 's|^/\([a-zA-Z]\)/|\1:/|' | sed 's|^/||')"
  else
    template_abs="file://$template_abs"
  fi

  local stack_exists=false
  aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" &>/dev/null && stack_exists=true

  if $stack_exists; then
    echo "  Update Stack: $STACK_NAME"
    if aws cloudformation update-stack \
      --stack-name "$STACK_NAME" \
      --template-body "$template_abs" \
      --parameters "ParameterKey=DeployBucket,ParameterValue=$DEPLOY_BUCKET" \
      --region "$REGION" 2>/dev/null; then
      echo "  Warte auf stack-update-complete..."
      aws cloudformation wait stack-update-complete --stack-name "$STACK_NAME" --region "$REGION"
    else
      local err
      err=$(aws cloudformation describe-stack-events --stack-name "$STACK_NAME" --region "$REGION" \
        --query "StackEvents[0].ResourceStatusReason" --output text 2>/dev/null || true)
      if [[ "$err" == *"No updates"* ]]; then
        echo "  Keine Aenderungen erforderlich."
      else
        echo "  Update fehlgeschlagen. Pruefe: aws cloudformation describe-stack-events --stack-name $STACK_NAME"
        exit 1
      fi
    fi
  else
    echo "  Create Stack: $STACK_NAME"
    aws cloudformation create-stack \
      --stack-name "$STACK_NAME" \
      --template-body "$template_abs" \
      --parameters "ParameterKey=DeployBucket,ParameterValue=$DEPLOY_BUCKET" \
      --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
      --region "$REGION"
    echo "  Warte auf stack-create-complete (ca. 5-10 Min)..."
    aws cloudformation wait stack-create-complete --stack-name "$STACK_NAME" --region "$REGION"
  fi
  echo "  Stack bereit."
}

# ---------------------------------------------------------------------------
# 4. Warten auf SSM-Registrierung der Instanzen
# ---------------------------------------------------------------------------
wait_for_ssm() {
  echo ""
  echo "=== 4. Warte auf SSM-Registrierung ==="
  local app_id db_id
  app_id=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='AppInstanceId'].OutputValue" --output text)
  db_id=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='DbInstanceId'].OutputValue" --output text)

  local elapsed=0
  while [[ $elapsed -lt $SSM_WAIT_MAX ]]; do
    local count
    count=$(aws ssm describe-instance-information \
      --filters "Key=InstanceIds,Values=$app_id,$db_id" \
      --region "$REGION" \
      --query "length(InstanceInformationList)" \
      --output text 2>/dev/null || echo "0")
    if [[ "$count" == "2" ]]; then
      local online
      online=$(aws ssm describe-instance-information \
        --filters "Key=InstanceIds,Values=$app_id,$db_id" \
        --region "$REGION" \
        --query "InstanceInformationList[?PingStatus=='Online'] | length(@)" \
        --output text 2>/dev/null || echo "0")
      if [[ "$online" == "2" ]]; then
        echo "  Beide Instanzen bei SSM registriert (nach ${elapsed}s)."
        return 0
      fi
    fi
    echo "  Warte auf SSM... (${elapsed}s / ${SSM_WAIT_MAX}s)"
    sleep "$SSM_WAIT_INTERVAL"
    elapsed=$((elapsed + SSM_WAIT_INTERVAL))
  done
  echo "  WARNUNG: SSM-Timeout. Deploy wird trotzdem versucht..."
}

# ---------------------------------------------------------------------------
# 5. App deployen
# ---------------------------------------------------------------------------
deploy_app() {
  echo ""
  echo "=== 5. Deploy Anwendung ==="
  cd "$PROJECT_ROOT"
  export STACK_NAME REGION DEPLOY_BUCKET
  # DEPLOY_BUCKET kommt aus Stack-Output, deploy-aws-ssm.sh liest es selbst
  # Wir setzen es hier, falls das Skript es anders ermittelt
  bash "$SCRIPT_DIR/deploy-aws-ssm.sh"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  echo "=============================================="
  echo " DNA ME CRM — Vollautomatisches Deployment"
  echo "=============================================="
  echo " Stack: $STACK_NAME | Region: $REGION"
  echo ""

  validate_env
  ensure_bucket
  deploy_stack
  wait_for_ssm
  deploy_app

  echo ""
  echo "=============================================="
  echo " Deployment abgeschlossen."
  echo "=============================================="
}

main "$@"
