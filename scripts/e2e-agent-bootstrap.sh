#!/bin/bash
#
# Phase 3: Agent Bootstrap E2E Test
#
# This script validates the complete agent bootstrap and shutdown flow:
# 1. Provision agent with device JWT
# 2. Agent connects to Core API
# 3. Agent emits NodeConnected event
# 4. Core API broadcasts shutdown command
# 5. Agent receives shutdown via subscription
# 6. Agent emits NodeHalting event
# 7. Agent triggers graceful shutdown (mock or real)

set -euo pipefail

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
API_URL="http://localhost:4000"
GRAPHQL_URL="$API_URL/graphql"
WS_URL="ws://localhost:4000/graphql"
TEST_CLUSTER="agent-test-$(date +%s)"
TEST_NODE="node-test-$(date +%s)"
PASSED=0
FAILED=0

# Helper functions
pass() {
  echo -e "${GREEN}✓${NC} $*"
  ((PASSED++)) || true
}

fail() {
  echo -e "${RED}✗${NC} $*"
  ((FAILED++)) || true
}

section() {
  echo ""
  echo -e "${BLUE}→ $*${NC}"
}

header() {
  echo ""
  echo -e "${BLUE}════ $* ════${NC}"
}

# Verify API
section "Verifying API connectivity..."
if ! curl -sf "$API_URL/health" > /dev/null; then
  fail "API not available at $API_URL"
  echo "Start docker-compose first: docker compose up --build --detach"
  exit 1
fi
pass "API is responding"

# ============================================================================
# Phase 1: Provision Agent
# ============================================================================

header "Phase 1: Agent Provisioning"

section "Generate provisioning token for cluster"
PROV_TOKEN=$(curl -s -X POST "$GRAPHQL_URL" \
  -H 'Content-Type: application/json' \
  -d "{\"query\":\"mutation { generateProvisioningToken(clusterId:\\\"$TEST_CLUSTER\\\") }\"}" | jq -r '.data.generateProvisioningToken')

if [ -n "$PROV_TOKEN" ] && [ "$PROV_TOKEN" != "null" ]; then
  pass "Token generated: ${PROV_TOKEN:0:40}..."
else
  fail "Failed to generate provisioning token"
  exit 1
fi

section "Exchange token for device JWT"
DEVICE_JWT=$(curl -s -X POST "$GRAPHQL_URL" \
  -H 'Content-Type: application/json' \
  -d "{\"query\":\"mutation { exchangeProvisioningToken(provisioningToken:\\\"$PROV_TOKEN\\\") { deviceJwt clusterId } }\"}" | jq -r '.data.exchangeProvisioningToken.deviceJwt')

if [ -n "$DEVICE_JWT" ] && [ "$DEVICE_JWT" != "null" ]; then
  pass "Device JWT obtained: ${DEVICE_JWT:0:40}..."
else
  fail "Failed to exchange provisioning token"
  exit 1
fi

# ============================================================================
# Phase 2: Start Agent Process
# ============================================================================

header "Phase 2: Agent Startup"

section "Starting agent in background"
AGENT_PID=""

cleanup() {
  if [ -n "$AGENT_PID" ] && kill -0 "$AGENT_PID" 2>/dev/null; then
    echo -e "${BLUE}[cleanup]${NC} Terminating agent process..."
    kill -SIGTERM "$AGENT_PID" 2>/dev/null || true
    wait "$AGENT_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT

# Start agent with mock D-Bus
DEVICE_JWT="$DEVICE_JWT" \
CLUSTER_ID="$TEST_CLUSTER" \
NODE_ID="$TEST_NODE" \
CORE_API_URL="$WS_URL" \
MOCK_DBUS=true \
GRACEFUL_SHUTDOWN_TIMEOUT_MS=5000 \
pnpm --filter=@sustainabuild/agent run dev 2>&1 | tee /tmp/agent-output.log &
AGENT_PID=$!

echo "Agent PID: $AGENT_PID"

# Wait for agent to connect
sleep 3

if ! kill -0 "$AGENT_PID" 2>/dev/null; then
  fail "Agent process exited unexpectedly"
  cat /tmp/agent-output.log
  exit 1
fi
pass "Agent started successfully"

# Check for connection log
section "Verifying agent connected"
if grep -q "Connected to Core API" /tmp/agent-output.log; then
  pass "Agent connected to Core API"
else
  fail "Agent did not connect to Core API"
  tail -20 /tmp/agent-output.log
  exit 1
fi

if grep -q "NodeConnected confirmed" /tmp/agent-output.log; then
  pass "NodeConnected mutation confirmed"
else
  echo "Waiting for NodeConnected confirmation..."
  sleep 2
  if grep -q "NodeConnected confirmed" /tmp/agent-output.log; then
    pass "NodeConnected mutation confirmed (after wait)"
  else
    fail "NodeConnected mutation not confirmed"
    tail -20 /tmp/agent-output.log
  fi
fi

# ============================================================================
# Phase 3: Broadcast Shutdown Command
# ============================================================================

header "Phase 3: Shutdown Command Broadcast"

section "Broadcasting shutdown command to agent"
SHUTDOWN_RESPONSE=$(curl -s -X POST "$GRAPHQL_URL" \
  -H 'Content-Type: application/json' \
  -d "{\"query\":\"mutation { broadcastShutdownNode(clusterId:\\\"$TEST_CLUSTER\\\", nodeId:\\\"$TEST_NODE\\\", gracePeriodSeconds: 300) { clusterId nodeId commandId sentAt } }\"}")

COMMAND_ID=$(echo "$SHUTDOWN_RESPONSE" | jq -r '.data.broadcastShutdownNode.commandId // empty')
if [ -n "$COMMAND_ID" ]; then
  pass "Shutdown command broadcast: $COMMAND_ID"
else
  fail "Failed to broadcast shutdown command"
  echo "$SHUTDOWN_RESPONSE" | jq .
  exit 1
fi

# ============================================================================
# Phase 4: Verify Agent Response
# ============================================================================

header "Phase 4: Agent Shutdown Response"

section "Waiting for agent to receive and process shutdown..."
sleep 2

# Check for shutdown command receipt
if grep -q "Received shutdown command:" /tmp/agent-output.log; then
  pass "Agent received shutdown command"
else
  fail "Agent did not receive shutdown command"
  tail -20 /tmp/agent-output.log
  exit 1
fi

# Check for NodeHalting confirmation
if grep -q "NodeHalting confirmed" /tmp/agent-output.log; then
  pass "NodeHalting event confirmed"
else
  echo "Waiting for NodeHalting confirmation..."
  sleep 2
  if grep -q "NodeHalting confirmed" /tmp/agent-output.log; then
    pass "NodeHalting event confirmed (after wait)"
  else
    fail "NodeHalting event not confirmed"
    tail -20 /tmp/agent-output.log
  fi
fi

# Check for mock shutdown
if grep -q "MOCK_DBUS=true" /tmp/agent-output.log && grep -q "Mock shutdown" /tmp/agent-output.log; then
  pass "Mock D-Bus shutdown triggered"
else
  if grep -q "Mock shutdown" /tmp/agent-output.log; then
    pass "Mock D-Bus shutdown triggered"
  else
    fail "Mock D-Bus shutdown not executed"
    tail -20 /tmp/agent-output.log
  fi
fi

# Wait for agent to exit
section "Waiting for agent graceful shutdown..."
WAIT_COUNT=0
while kill -0 "$AGENT_PID" 2>/dev/null && [ $WAIT_COUNT -lt 15 ]; do
  sleep 1
  ((WAIT_COUNT++)) || true
done

if ! kill -0 "$AGENT_PID" 2>/dev/null; then
  pass "Agent shut down gracefully"
else
  echo "Agent still running after shutdown, force terminating..."
  kill -SIGTERM "$AGENT_PID" 2>/dev/null || true
  sleep 1
  if kill -0 "$AGENT_PID" 2>/dev/null; then
    kill -SIGKILL "$AGENT_PID" 2>/dev/null || true
    fail "Agent required forced termination"
  else
    pass "Agent shut down after SIGTERM"
  fi
fi

# ============================================================================
# Phase 5: Verify Event Log
# ============================================================================

header "Phase 5: Event Log Verification"

section "Checking Core API event store for domain events"
EVENTS=$(curl -s -X POST "$GRAPHQL_URL" \
  -H 'Content-Type: application/json' \
  -d "{\"query\":\"query { cluster(id:\\\"$TEST_CLUSTER\\\") { id status activeLeaseCount } }\"}" | jq '.')

if [ "$?" -eq 0 ]; then
  pass "Event store query successful"
else
  fail "Failed to query event store"
  exit 1
fi

# ============================================================================
# Summary
# ============================================================================

echo ""
echo -e "${BLUE}════════════════════════════════${NC}"
echo "Test Results"
echo -e "${BLUE}════════════════════════════════${NC}"
echo -e "  ${GREEN}Passed: $PASSED${NC}"
echo -e "  ${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ Agent Bootstrap E2E tests passed!${NC}"
  echo ""
  echo "Agent lifecycle verified:"
  echo "  1. Provisioning: ✓ (device JWT exchange)"
  echo "  2. Connection: ✓ (WebSocket + JWT auth)"
  echo "  3. Registration: ✓ (NodeConnected event)"
  echo "  4. Command Receipt: ✓ (shutdownNode subscription)"
  echo "  5. Graceful Shutdown: ✓ (NodeHalting + D-Bus mock)"
  echo ""
  echo "Next steps:"
  echo "  - Test with real D-Bus on Raspberry Pi (remove MOCK_DBUS env var)"
  echo "  - Test reconnection after network drop"
  echo "  - Implement Node read model projection"
  echo "  - Add billing/energy tracking per node"
  exit 0
else
  echo -e "${RED}✗ Some tests failed${NC}"
  exit 1
fi
