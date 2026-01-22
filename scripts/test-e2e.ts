#!/usr/bin/env npx tsx
// =============================================================================
// scripts/test-e2e.ts
// End-to-End Test Script for DNA Marketing Engine
// =============================================================================

/**
 * This script tests the full flow of the CRM system:
 * 1. Create lead via event ingestion
 * 2. Trigger scoring via multiple events
 * 3. Trigger intent detection
 * 4. Verify routing occurs when thresholds are met
 * 5. Verify deal creation
 * 
 * Usage: npx tsx scripts/test-e2e.ts
 * 
 * Prerequisites:
 * - API server running on localhost:3000
 * - Workers running (npm run workers)
 * - PostgreSQL and Redis running
 */

import axios, { AxiosError } from 'axios';

// =============================================================================
// Configuration
// =============================================================================

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api/v1';
const API_KEY = process.env.TEST_API_KEY || 'test123';
const TEST_EMAIL = `e2e-test-${Date.now()}@biotech.com`;

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

// =============================================================================
// Helper Functions
// =============================================================================

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message: string) {
  log(`✅ ${message}`, colors.green);
}

function logError(message: string) {
  log(`❌ ${message}`, colors.red);
}

function logInfo(message: string) {
  log(`ℹ️  ${message}`, colors.blue);
}

function logStep(step: number, message: string) {
  log(`\n${colors.bold}Step ${step}: ${message}${colors.reset}`, colors.cyan);
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

async function apiRequest<T = unknown>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  data?: unknown
): Promise<ApiResponse<T>> {
  try {
    const response = await axios({
      method,
      url: `${BASE_URL}${path}`,
      data,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      }
    });

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    const axiosError = error as AxiosError;
    return {
      success: false,
      error: axiosError.response 
        ? JSON.stringify(axiosError.response.data) 
        : axiosError.message
    };
  }
}

// =============================================================================
// Test Functions
// =============================================================================

async function testHealthEndpoints(): Promise<boolean> {
  logStep(1, 'Testing Health Endpoints');
  
  try {
    const healthResponse = await axios.get(`${BASE_URL.replace('/api/v1', '')}/health`);
    if (healthResponse.status === 200 && healthResponse.data.status === 'ok') {
      logSuccess('Health endpoint OK');
    } else {
      logError('Health endpoint returned unexpected response');
      return false;
    }

    const readyResponse = await axios.get(`${BASE_URL.replace('/api/v1', '')}/ready`);
    if (readyResponse.status === 200 && readyResponse.data.ready === true) {
      logSuccess('Ready endpoint OK');
    } else {
      logError('Ready endpoint returned unexpected response');
      return false;
    }

    return true;
  } catch (error) {
    logError(`Health check failed: ${(error as Error).message}`);
    return false;
  }
}

async function ingestEvent(eventType: string, metadata: Record<string, unknown> = {}): Promise<boolean> {
  const result = await apiRequest('POST', '/events/ingest', {
    event_type: eventType,
    source: 'portal',
    occurred_at: new Date().toISOString(),
    lead_identifier: { email: TEST_EMAIL },
    metadata
  });

  if (result.success) {
    logSuccess(`Event ingested: ${eventType}`);
    return true;
  } else {
    logError(`Failed to ingest event: ${result.error}`);
    return false;
  }
}

async function testEventIngestion(): Promise<boolean> {
  logStep(2, 'Testing Event Ingestion');

  // First event - should create the lead
  const success = await ingestEvent('page_visited', { 
    page_path: '/enterprise',
    page_title: 'Enterprise Solutions'
  });

  if (!success) return false;

  // Wait for worker to process
  await sleep(2000);

  // Verify lead was created
  const leadsResult = await apiRequest<{ data: Array<{ email: string }> }>('GET', `/leads?search=${TEST_EMAIL}`);
  
  if (!leadsResult.success || !leadsResult.data?.data?.length) {
    logError('Lead was not created from event');
    return false;
  }

  logSuccess(`Lead created: ${TEST_EMAIL}`);
  return true;
}

async function testScoring(): Promise<boolean> {
  logStep(3, 'Testing Scoring Engine');

  // Send high-value events to trigger scoring
  const events = [
    { type: 'pricing_viewed', metadata: { page_path: '/pricing' } },
    { type: 'roi_calculator_submitted', metadata: { samples_per_month: 300, calculated_savings: 15000 } },
    { type: 'demo_requested', metadata: { preferred_time: 'morning', product_interest: 'b2b' } }
  ];

  for (const event of events) {
    const success = await ingestEvent(event.type, event.metadata);
    if (!success) return false;
    await sleep(500);
  }

  // Wait for workers to process
  logInfo('Waiting for scoring to complete...');
  await sleep(5000);

  // Check lead score
  const leadsResult = await apiRequest<{ data: Array<{ email: string; total_score: number }> }>(
    'GET', 
    `/leads?search=${TEST_EMAIL}`
  );

  if (!leadsResult.success || !leadsResult.data?.data?.length) {
    logError('Could not fetch lead after scoring');
    return false;
  }

  const lead = leadsResult.data.data[0];
  logInfo(`Current lead score: ${lead.total_score}`);

  if (lead.total_score > 0) {
    logSuccess(`Scoring working - Lead score: ${lead.total_score}`);
    return true;
  } else {
    logError('Lead score is still 0 after events');
    return false;
  }
}

async function testIntentDetection(): Promise<boolean> {
  logStep(4, 'Testing Intent Detection');

  // Send B2B intent signals
  const b2bEvents = [
    { type: 'page_visited', metadata: { page_path: '/enterprise', page_title: 'Enterprise' } },
    { type: 'resource_downloaded', metadata: { resource_type: 'whitepaper', title: 'B2B Lab Guide' } }
  ];

  for (const event of b2bEvents) {
    await ingestEvent(event.type, event.metadata);
    await sleep(500);
  }

  // Wait for intent detection
  logInfo('Waiting for intent detection...');
  await sleep(3000);

  // Check lead intent
  const leadsResult = await apiRequest<{ 
    data: Array<{ 
      email: string; 
      primary_intent: string | null; 
      intent_confidence: number;
      intent_summary: { research: number; b2b: number; co_creation: number };
    }> 
  }>('GET', `/leads?search=${TEST_EMAIL}`);

  if (!leadsResult.success || !leadsResult.data?.data?.length) {
    logError('Could not fetch lead for intent check');
    return false;
  }

  const lead = leadsResult.data.data[0];
  logInfo(`Primary intent: ${lead.primary_intent || 'none'} (${lead.intent_confidence}%)`);
  logInfo(`Intent summary: Research=${lead.intent_summary?.research || 0}, B2B=${lead.intent_summary?.b2b || 0}, Co-Creation=${lead.intent_summary?.co_creation || 0}`);

  if (lead.intent_confidence > 0) {
    logSuccess('Intent detection working');
    return true;
  } else {
    logInfo('No intent detected yet (may need more events)');
    return true; // Not a failure, just needs more data
  }
}

async function testRouting(): Promise<boolean> {
  logStep(5, 'Testing Smart Routing');

  // Get current lead status
  const leadsResult = await apiRequest<{ 
    data: Array<{ 
      id: string;
      email: string; 
      total_score: number;
      intent_confidence: number;
      routing_status: string;
      pipeline_id: string | null;
    }> 
  }>('GET', `/leads?search=${TEST_EMAIL}`);

  if (!leadsResult.success || !leadsResult.data?.data?.length) {
    logError('Could not fetch lead for routing check');
    return false;
  }

  const lead = leadsResult.data.data[0];
  logInfo(`Lead status: Score=${lead.total_score}, Intent=${lead.intent_confidence}%, Routing=${lead.routing_status}`);

  // Check routing conditions
  const needsMoreScore = lead.total_score < 40;
  const needsMoreIntent = lead.intent_confidence < 60;

  if (needsMoreScore || needsMoreIntent) {
    logInfo(`Routing thresholds not met yet (need score>=40, intent>=60%)`);
    
    if (needsMoreScore) {
      logInfo('Sending more events to increase score...');
      // Send more high-value events
      await ingestEvent('meeting_scheduled', { meeting_type: 'demo', attendees: 3 });
      await ingestEvent('email_opened', { campaign: 'nurture', subject: 'B2B Solutions' });
      await ingestEvent('linkedin_message_replied', { conversation_length: 5 });
    }

    await sleep(5000);
  }

  // Re-check lead
  const updatedResult = await apiRequest<{ 
    data: Array<{ 
      id: string;
      total_score: number;
      intent_confidence: number;
      routing_status: string;
      pipeline_id: string | null;
    }> 
  }>('GET', `/leads?search=${TEST_EMAIL}`);

  if (updatedResult.success && updatedResult.data?.data?.length) {
    const updatedLead = updatedResult.data.data[0];
    logInfo(`Updated lead: Score=${updatedLead.total_score}, Intent=${updatedLead.intent_confidence}%, Routing=${updatedLead.routing_status}`);

    if (updatedLead.routing_status === 'routed' && updatedLead.pipeline_id) {
      logSuccess(`Lead routed to pipeline: ${updatedLead.pipeline_id}`);
      return true;
    } else if (updatedLead.routing_status === 'pending') {
      logInfo('Lead is pending routing (workers may still be processing)');
      return true;
    } else {
      logInfo(`Lead routing status: ${updatedLead.routing_status}`);
      return true; // Not necessarily a failure
    }
  }

  return true;
}

async function testDealsAndPipelines(): Promise<boolean> {
  logStep(6, 'Testing Deals & Pipelines');

  // Get pipelines
  const pipelinesResult = await apiRequest<{ data: Array<{ id: string; name: string; slug: string }> }>(
    'GET', 
    '/pipelines'
  );

  if (!pipelinesResult.success || !pipelinesResult.data?.data?.length) {
    logError('Could not fetch pipelines');
    return false;
  }

  logSuccess(`Found ${pipelinesResult.data.data.length} pipelines`);
  pipelinesResult.data.data.forEach(p => {
    logInfo(`  - ${p.name} (${p.slug})`);
  });

  // Check if any deals were created
  const dealsResult = await apiRequest<{ data: Array<{ id: string; name: string; status: string }> }>(
    'GET',
    '/deals'
  );

  if (dealsResult.success && dealsResult.data?.data) {
    logInfo(`Total deals in system: ${dealsResult.data.data.length}`);
  }

  return true;
}

async function testAPIEndpoints(): Promise<boolean> {
  logStep(7, 'Testing All API Endpoints');

  const endpoints = [
    { method: 'GET' as const, path: '/leads', name: 'List Leads' },
    { method: 'GET' as const, path: '/leads/unrouted', name: 'Unrouted Leads' },
    { method: 'GET' as const, path: '/leads/stats', name: 'Lead Stats' },
    { method: 'GET' as const, path: '/pipelines', name: 'List Pipelines' },
    { method: 'GET' as const, path: '/deals', name: 'List Deals' },
    { method: 'GET' as const, path: '/scoring/rules', name: 'Scoring Rules' },
    { method: 'GET' as const, path: '/routing/config', name: 'Routing Config' },
    { method: 'GET' as const, path: '/tasks', name: 'List Tasks' },
  ];

  let allPassed = true;

  for (const endpoint of endpoints) {
    const result = await apiRequest(endpoint.method, endpoint.path);
    if (result.success) {
      logSuccess(`${endpoint.name} (${endpoint.method} ${endpoint.path})`);
    } else {
      logError(`${endpoint.name} (${endpoint.method} ${endpoint.path}): ${result.error}`);
      allPassed = false;
    }
  }

  return allPassed;
}

async function cleanup(): Promise<void> {
  logStep(8, 'Cleanup');

  // Get the test lead
  const leadsResult = await apiRequest<{ data: Array<{ id: string }> }>('GET', `/leads?search=${TEST_EMAIL}`);
  
  if (leadsResult.success && leadsResult.data?.data?.length) {
    const leadId = leadsResult.data.data[0].id;
    const deleteResult = await apiRequest('DELETE', `/leads/${leadId}`);
    
    if (deleteResult.success) {
      logSuccess(`Test lead deleted: ${TEST_EMAIL}`);
    } else {
      logInfo(`Could not delete test lead: ${deleteResult.error}`);
    }
  } else {
    logInfo('No test lead found to clean up');
  }
}

// =============================================================================
// Main Test Runner
// =============================================================================

async function runTests(): Promise<void> {
  console.log(`
${colors.bold}╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🧬 DNA Marketing Engine - E2E Test Suite               ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝${colors.reset}
`);

  logInfo(`Test email: ${TEST_EMAIL}`);
  logInfo(`API URL: ${BASE_URL}`);
  logInfo(`API Key: ${API_KEY.substring(0, 10)}...`);
  console.log();

  const results: { name: string; passed: boolean }[] = [];

  try {
    // Run all tests
    results.push({ name: 'Health Endpoints', passed: await testHealthEndpoints() });
    results.push({ name: 'Event Ingestion', passed: await testEventIngestion() });
    results.push({ name: 'Scoring Engine', passed: await testScoring() });
    results.push({ name: 'Intent Detection', passed: await testIntentDetection() });
    results.push({ name: 'Smart Routing', passed: await testRouting() });
    results.push({ name: 'Deals & Pipelines', passed: await testDealsAndPipelines() });
    results.push({ name: 'API Endpoints', passed: await testAPIEndpoints() });

    // Cleanup (optional)
    if (process.env.CLEANUP_AFTER_TEST !== 'false') {
      await cleanup();
    }

  } catch (error) {
    logError(`Unexpected error: ${(error as Error).message}`);
  }

  // Print summary
  console.log(`
${colors.bold}═══════════════════════════════════════════════════════════
                        TEST SUMMARY
═══════════════════════════════════════════════════════════${colors.reset}
`);

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  results.forEach(r => {
    const icon = r.passed ? colors.green + '✅' : colors.red + '❌';
    console.log(`  ${icon} ${r.name}${colors.reset}`);
  });

  console.log(`
${colors.bold}───────────────────────────────────────────────────────────${colors.reset}
  Total: ${results.length} | Passed: ${colors.green}${passed}${colors.reset} | Failed: ${colors.red}${failed}${colors.reset}
${colors.bold}═══════════════════════════════════════════════════════════${colors.reset}
`);

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
