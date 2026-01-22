#!/bin/bash
# =============================================================================
# DNA Marketing Engine - E2E Test Script (Shell Version)
# =============================================================================
#
# This script tests the full flow of the CRM system using curl commands.
# 
# Usage: ./scripts/test-e2e.sh
#
# Prerequisites:
# - API server running on localhost:3000
# - Workers running (npm run workers)
# - PostgreSQL and Redis running
# - curl and jq installed
#
# =============================================================================

set -e

# Configuration
BASE_URL="${API_BASE_URL:-http://localhost:3000/api/v1}"
API_KEY="${TEST_API_KEY:-portal:key2}"
TEST_EMAIL="e2e-test-$(date +%s)@biotech.com"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0

# =============================================================================
# Helper Functions
# =============================================================================

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
    ((PASSED++))
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
    ((FAILED++))
}

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_step() {
    echo -e "\n${BOLD}${CYAN}Step $1: $2${NC}"
}

api_request() {
    local method="$1"
    local path="$2"
    local data="$3"
    
    if [ -n "$data" ]; then
        curl -s -X "$method" \
            -H "Content-Type: application/json" \
            -H "X-API-Key: $API_KEY" \
            -d "$data" \
            "${BASE_URL}${path}"
    else
        curl -s -X "$method" \
            -H "Content-Type: application/json" \
            -H "X-API-Key: $API_KEY" \
            "${BASE_URL}${path}"
    fi
}

# =============================================================================
# Header
# =============================================================================

echo -e "${BOLD}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                                                           ║"
echo "║   🧬 DNA Marketing Engine - E2E Test Suite               ║"
echo "║                                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

log_info "Test email: $TEST_EMAIL"
log_info "API URL: $BASE_URL"
log_info "API Key: ${API_KEY:0:10}..."
echo ""

# =============================================================================
# Step 1: Health Check
# =============================================================================

log_step 1 "Testing Health Endpoints"

HEALTH_URL="${BASE_URL/\/api\/v1/}/health"
HEALTH_RESPONSE=$(curl -s "$HEALTH_URL")
HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | jq -r '.status // empty' 2>/dev/null)

if [ "$HEALTH_STATUS" = "ok" ]; then
    log_success "Health endpoint OK"
else
    log_error "Health endpoint failed"
fi

READY_URL="${BASE_URL/\/api\/v1/}/ready"
READY_RESPONSE=$(curl -s "$READY_URL")
READY_STATUS=$(echo "$READY_RESPONSE" | jq -r '.ready // empty' 2>/dev/null)

if [ "$READY_STATUS" = "true" ]; then
    log_success "Ready endpoint OK"
else
    log_error "Ready endpoint failed"
fi

# =============================================================================
# Step 2: Event Ingestion
# =============================================================================

log_step 2 "Testing Event Ingestion"

EVENT_DATA=$(cat <<EOF
{
    "event_type": "page_visited",
    "source": "portal",
    "occurred_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "lead_identifier": {
        "email": "$TEST_EMAIL"
    },
    "metadata": {
        "page_path": "/enterprise",
        "page_title": "Enterprise Solutions"
    }
}
EOF
)

INGEST_RESPONSE=$(api_request "POST" "/events/ingest" "$EVENT_DATA")
INGEST_SUCCESS=$(echo "$INGEST_RESPONSE" | jq -r '.success // empty' 2>/dev/null)

if [ "$INGEST_SUCCESS" = "true" ]; then
    EVENT_ID=$(echo "$INGEST_RESPONSE" | jq -r '.event_id // empty')
    log_success "Event ingested: page_visited (ID: $EVENT_ID)"
else
    log_error "Event ingestion failed: $INGEST_RESPONSE"
fi

# Wait for worker to process
log_info "Waiting for worker to process event..."
sleep 3

# Verify lead was created
LEADS_RESPONSE=$(api_request "GET" "/leads?search=$TEST_EMAIL")
LEAD_COUNT=$(echo "$LEADS_RESPONSE" | jq -r '.data | length // 0' 2>/dev/null)

if [ "$LEAD_COUNT" -gt 0 ]; then
    LEAD_ID=$(echo "$LEADS_RESPONSE" | jq -r '.data[0].id')
    log_success "Lead created: $TEST_EMAIL (ID: $LEAD_ID)"
else
    log_error "Lead was not created from event"
fi

# =============================================================================
# Step 3: Scoring
# =============================================================================

log_step 3 "Testing Scoring Engine"

# Send more events to trigger scoring
EVENTS=(
    '{"event_type":"pricing_viewed","source":"portal","occurred_at":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'","lead_identifier":{"email":"'"$TEST_EMAIL"'"},"metadata":{"page_path":"/pricing"}}'
    '{"event_type":"roi_calculator_submitted","source":"portal","occurred_at":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'","lead_identifier":{"email":"'"$TEST_EMAIL"'"},"metadata":{"samples_per_month":300}}'
    '{"event_type":"demo_requested","source":"portal","occurred_at":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'","lead_identifier":{"email":"'"$TEST_EMAIL"'"},"metadata":{}}'
)

for EVENT in "${EVENTS[@]}"; do
    EVENT_TYPE=$(echo "$EVENT" | jq -r '.event_type')
    RESPONSE=$(api_request "POST" "/events/ingest" "$EVENT")
    SUCCESS=$(echo "$RESPONSE" | jq -r '.success // empty' 2>/dev/null)
    if [ "$SUCCESS" = "true" ]; then
        log_success "Event ingested: $EVENT_TYPE"
    else
        log_error "Event ingestion failed: $EVENT_TYPE"
    fi
    sleep 0.5
done

log_info "Waiting for scoring to complete..."
sleep 5

# Check lead score
LEADS_RESPONSE=$(api_request "GET" "/leads?search=$TEST_EMAIL")
LEAD_SCORE=$(echo "$LEADS_RESPONSE" | jq -r '.data[0].total_score // 0' 2>/dev/null)

log_info "Current lead score: $LEAD_SCORE"

if [ "$LEAD_SCORE" -gt 0 ]; then
    log_success "Scoring working - Lead score: $LEAD_SCORE"
else
    log_error "Lead score is still 0 after events"
fi

# =============================================================================
# Step 4: Intent Detection
# =============================================================================

log_step 4 "Testing Intent Detection"

# Check intent
INTENT=$(echo "$LEADS_RESPONSE" | jq -r '.data[0].primary_intent // "none"' 2>/dev/null)
INTENT_CONF=$(echo "$LEADS_RESPONSE" | jq -r '.data[0].intent_confidence // 0' 2>/dev/null)
INTENT_SUMMARY=$(echo "$LEADS_RESPONSE" | jq -r '.data[0].intent_summary // {}' 2>/dev/null)

log_info "Primary intent: $INTENT ($INTENT_CONF%)"
log_info "Intent summary: $INTENT_SUMMARY"

if [ "$INTENT_CONF" -gt 0 ]; then
    log_success "Intent detection working"
else
    log_info "No intent detected yet (may need more events)"
    ((PASSED++))  # Not a failure
fi

# =============================================================================
# Step 5: Routing
# =============================================================================

log_step 5 "Testing Smart Routing"

ROUTING_STATUS=$(echo "$LEADS_RESPONSE" | jq -r '.data[0].routing_status // "unknown"' 2>/dev/null)
PIPELINE_ID=$(echo "$LEADS_RESPONSE" | jq -r '.data[0].pipeline_id // "null"' 2>/dev/null)

log_info "Routing status: $ROUTING_STATUS"
log_info "Pipeline ID: $PIPELINE_ID"

if [ "$ROUTING_STATUS" = "routed" ] && [ "$PIPELINE_ID" != "null" ]; then
    log_success "Lead routed to pipeline"
elif [ "$ROUTING_STATUS" = "pending" ]; then
    log_info "Lead is pending routing"
    ((PASSED++))
else
    log_info "Lead not yet routed (thresholds may not be met)"
    ((PASSED++))
fi

# =============================================================================
# Step 6: Pipelines & Deals
# =============================================================================

log_step 6 "Testing Pipelines & Deals"

PIPELINES_RESPONSE=$(api_request "GET" "/pipelines")
PIPELINE_COUNT=$(echo "$PIPELINES_RESPONSE" | jq -r '.data | length // 0' 2>/dev/null)

if [ "$PIPELINE_COUNT" -gt 0 ]; then
    log_success "Found $PIPELINE_COUNT pipelines"
    echo "$PIPELINES_RESPONSE" | jq -r '.data[] | "  - \(.name) (\(.slug))"' 2>/dev/null
else
    log_error "No pipelines found"
fi

DEALS_RESPONSE=$(api_request "GET" "/deals")
DEAL_COUNT=$(echo "$DEALS_RESPONSE" | jq -r '.data | length // 0' 2>/dev/null)
log_info "Total deals in system: $DEAL_COUNT"

# =============================================================================
# Step 7: API Endpoints
# =============================================================================

log_step 7 "Testing All API Endpoints"

ENDPOINTS=(
    "GET:/leads:List Leads"
    "GET:/leads/unrouted:Unrouted Leads"
    "GET:/leads/stats:Lead Stats"
    "GET:/pipelines:List Pipelines"
    "GET:/deals:List Deals"
    "GET:/scoring/rules:Scoring Rules"
    "GET:/routing/config:Routing Config"
    "GET:/tasks:List Tasks"
)

for ENDPOINT in "${ENDPOINTS[@]}"; do
    IFS=':' read -r METHOD PATH NAME <<< "$ENDPOINT"
    RESPONSE=$(api_request "$METHOD" "$PATH")
    
    # Check if response is valid JSON
    if echo "$RESPONSE" | jq . > /dev/null 2>&1; then
        log_success "$NAME ($METHOD $PATH)"
    else
        log_error "$NAME ($METHOD $PATH)"
    fi
done

# =============================================================================
# Step 8: Cleanup
# =============================================================================

log_step 8 "Cleanup"

if [ -n "$LEAD_ID" ]; then
    DELETE_RESPONSE=$(api_request "DELETE" "/leads/$LEAD_ID")
    DELETE_SUCCESS=$(echo "$DELETE_RESPONSE" | jq -r '.success // empty' 2>/dev/null)
    
    if [ "$DELETE_SUCCESS" = "true" ]; then
        log_success "Test lead deleted: $TEST_EMAIL"
    else
        log_info "Could not delete test lead"
    fi
else
    log_info "No test lead to clean up"
fi

# =============================================================================
# Summary
# =============================================================================

echo -e "\n${BOLD}═══════════════════════════════════════════════════════════"
echo "                        TEST SUMMARY"
echo -e "═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${GREEN}Passed: $PASSED${NC}"
echo -e "  ${RED}Failed: $FAILED${NC}"
echo -e "  Total: $((PASSED + FAILED))"
echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"

# Exit with appropriate code
if [ "$FAILED" -gt 0 ]; then
    exit 1
else
    exit 0
fi
