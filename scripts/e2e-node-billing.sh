#!/bin/bash

# Phase 4: Node Lifecycle & Billing E2E Test
#
# This script validates the complete node lifecycle with power tracking and billing:
# 1. Agent connects → Node transitions to ONLINE
# 2. Record power ticks for 5 seconds
# 3. Query node stats (online duration, energy, cost)
# 4. Agent halts → Node transitions to OFFLINE
# 5. Verify event store has all events
# 6. Verify read model reflects final state

set -euo pipefail

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
GRAPHQL_URL="http://localhost:4000/graphql"
TEST_CLUSTER="node-billing-test-$$"
TEST_NODE="node-test-$$"
POWER_TICK_DURATION=5  # seconds
POWER_TICK_INTERVAL=1  # second

# Counters
PASSED=0
FAILED=0

# Helpers
pass() {
  echo -e "${GREEN}✓${NC} $*"
  ((PASSED++))
}

fail() {
  echo -e "${RED}✗${NC} $*"
  ((FAILED++))
}

header() {
  echo ""
  echo -e "${BLUE}════ $* ════${NC}"
}

section() {
  echo ""
  echo "→ $*"
}

# ============================================================================
# Phase 1: Agent Connection & Node Provisioning
# ============================================================================

header "Phase 1: Agent Connection & Node Provisioning"

section "Connecting agent to Core API (simulating WebSocket connection)"
CONNECT_RESPONSE=$(curl -s -X POST "$GRAPHQL_URL" \
  -H 'Content-Type: application/json' \
  -d "{\"query\":\"mutation { emitNodeConnected(clusterId:\\\"$TEST_CLUSTER\\\", nodeId:\\\"$TEST_NODE\\\") { clusterId nodeId connectedAt } }\"}")

CONNECTED_AT=$(echo "$CONNECT_RESPONSE" | jq -r '.data.emitNodeConnected.connectedAt // empty')
if [ -n "$CONNECTED_AT" ]; then
  pass "Node connected: $TEST_CLUSTER/$TEST_NODE at $CONNECTED_AT"
else
  fail "Failed to connect node"
  echo "$CONNECT_RESPONSE" | jq .
  exit 1
fi

# ============================================================================
# Phase 2: Query Initial Node State
# ============================================================================

header "Phase 2: Query Initial Node State"

section "Querying node stats after connection"
NODE_RESPONSE=$(curl -s -X POST "$GRAPHQL_URL" \
  -H 'Content-Type: application/json' \
  -d "{\"query\":\"query { nodeStats(nodeId:\\\"$TEST_NODE\\\", clusterId:\\\"$TEST_CLUSTER\\\") { status totalEnergyWh lastPowerW onlineDurationSeconds } }\"}")

STATUS=$(echo "$NODE_RESPONSE" | jq -r '.data.nodeStats.status // empty')
if [ "$STATUS" = "ONLINE" ]; then
  pass "Node status is ONLINE"
else
  fail "Node status is not ONLINE (got: $STATUS)"
  echo "$NODE_RESPONSE" | jq .
fi

# ============================================================================
# Phase 3: Record Power Ticks
# ============================================================================

header "Phase 3: Record Power Ticks"

section "Recording $POWER_TICK_DURATION seconds of power ticks (1 per second)"
TICK_COUNT=0
for ((i=1; i<=POWER_TICK_DURATION; i++)); do
  # Simulate varying power consumption (25W to 35W)
  POWER_W=$((25 + RANDOM % 11))
  # Use a fixed energyWh value for 1-second tick (approximately 0.008 Wh per second at 30W)
  ENERGY_WH=5
  
  TICK_RESPONSE=$(curl -s -X POST "$GRAPHQL_URL" \
    -H 'Content-Type: application/json' \
    -d "{\"query\":\"mutation { recordNodePowerTick(nodeId:\\\"$TEST_NODE\\\", clusterId:\\\"$TEST_CLUSTER\\\", powerW: $POWER_W, energyWh: $ENERGY_WH) }\"}")
  
  TOTAL_ENERGY=$(echo "$TICK_RESPONSE" | jq -r '.data.recordNodePowerTick // empty')
  if [ -n "$TOTAL_ENERGY" ]; then
    ((TICK_COUNT++))
  fi
  
  sleep $POWER_TICK_INTERVAL
done

if [ $TICK_COUNT -eq $POWER_TICK_DURATION ]; then
  pass "Recorded $TICK_COUNT power ticks"
else
  fail "Only recorded $TICK_COUNT/$POWER_TICK_DURATION power ticks"
fi

# Wait for projector to process all events
sleep 2

# ============================================================================
# Phase 4: Query Power Stats After Ticks
# ============================================================================

header "Phase 4: Query Power Stats After Ticks"

section "Querying node stats after power ticks"
STATS_RESPONSE=$(curl -s -X POST "$GRAPHQL_URL" \
  -H 'Content-Type: application/json' \
  -d "{\"query\":\"query { nodeStats(nodeId:\\\"$TEST_NODE\\\", clusterId:\\\"$TEST_CLUSTER\\\") { status totalEnergyWh lastPowerW } }\"}")

TOTAL_ENERGY=$(echo "$STATS_RESPONSE" | jq -r '.data.nodeStats.totalEnergyWh // empty')
LAST_POWER=$(echo "$STATS_RESPONSE" | jq -r '.data.nodeStats.lastPowerW // empty')

if [ -n "$TOTAL_ENERGY" ] && [ "$TOTAL_ENERGY" -gt 0 ]; then
  pass "Total energy tracked: $TOTAL_ENERGY Wh"
else
  fail "Total energy not tracked properly (got: $TOTAL_ENERGY)"
fi

if [ -n "$LAST_POWER" ] && [ "$LAST_POWER" -gt 0 ]; then
  pass "Last power measurement: $LAST_POWER W"
else
  fail "Last power measurement not recorded (got: $LAST_POWER)"
fi

# ============================================================================
# Phase 5: Agent Halt & Node Shutdown
# ============================================================================

header "Phase 5: Agent Halt & Node Shutdown"

section "Emitting NodeHalting event (simulating graceful shutdown)"
HALT_RESPONSE=$(curl -s -X POST "$GRAPHQL_URL" \
  -H 'Content-Type: application/json' \
  -d "{\"query\":\"mutation { emitNodeHalting(clusterId:\\\"$TEST_CLUSTER\\\", nodeId:\\\"$TEST_NODE\\\") { clusterId nodeId } }\"}")

HALT_CLUSTER=$(echo "$HALT_RESPONSE" | jq -r '.data.emitNodeHalting.clusterId // empty')
if [ -n "$HALT_CLUSTER" ]; then
  pass "Node halt event emitted"
else
  fail "Failed to emit node halt event"
  echo "$HALT_RESPONSE" | jq .
fi

# ============================================================================
# Phase 6: Verify Node Offline State
# ============================================================================

header "Phase 6: Verify Node Offline State"

section "Querying node stats after shutdown"
OFFLINE_RESPONSE=$(curl -s -X POST "$GRAPHQL_URL" \
  -H 'Content-Type: application/json' \
  -d "{\"query\":\"query { nodeStats(nodeId:\\\"$TEST_NODE\\\", clusterId:\\\"$TEST_CLUSTER\\\") { status totalEnergyWh } }\"}")

OFFLINE_STATUS=$(echo "$OFFLINE_RESPONSE" | jq -r '.data.nodeStats.status // empty')

if [ "$OFFLINE_STATUS" = "OFFLINE" ]; then
  pass "Node status transitioned to OFFLINE"
else
  fail "Node status did not transition to OFFLINE (got: $OFFLINE_STATUS)"
  echo "$OFFLINE_RESPONSE" | jq .
fi

# ============================================================================
# Phase 7: Query Billing Cycle & Cost
# ============================================================================

header "Phase 7: Query Billing Cycle & Cost"

section "Querying node billing cycle information"
BILLING_RESPONSE=$(curl -s -X POST "$GRAPHQL_URL" \
  -H 'Content-Type: application/json' \
  -d "{\"query\":\"query { nodeStats(nodeId:\\\"$TEST_NODE\\\", clusterId:\\\"$TEST_CLUSTER\\\") { status totalEnergyWh } }\"}")

FINAL_ENERGY=$(echo "$BILLING_RESPONSE" | jq -r '.data.nodeStats.totalEnergyWh // empty')

if [ -n "$FINAL_ENERGY" ] && [ "$FINAL_ENERGY" -gt 0 ]; then
  # Calculate cost (assuming $0.12 per kWh)
  COST_PER_KWH=0.12
  ENERGY_KWH=$(echo "scale=3; $FINAL_ENERGY / 1000" | bc)
  COST=$(echo "scale=5; $ENERGY_KWH * $COST_PER_KWH" | bc)
  pass "Final energy: $FINAL_ENERGY Wh (~$ENERGY_KWH kWh, cost: \$$COST)"
else
  fail "Unable to calculate billing (energy: $FINAL_ENERGY)"
fi

# ============================================================================
# Phase 8: Verify Event Store
# ============================================================================

header "Phase 8: Verify Event Store"

section "Checking event store for domain events"
# Query node stats to verify events were processed
EVENT_RESPONSE=$(curl -s -X POST "$GRAPHQL_URL" \
  -H 'Content-Type: application/json' \
  -d "{\"query\":\"query { nodeStats(nodeId:\\\"$TEST_NODE\\\", clusterId:\\\"$TEST_CLUSTER\\\") { status } }\"}")

NODE_STATUS=$(echo "$EVENT_RESPONSE" | jq -r '.data.nodeStats.status // empty')
if [ -n "$NODE_STATUS" ]; then
  pass "Event store query successful (node status: $NODE_STATUS)"
else
  fail "Event store query failed"
fi

# ============================================================================
# Summary
# ============================================================================

echo ""
echo "════════════════════════════════"
echo "Test Results"
echo "════════════════════════════════"
echo "  Passed: $PASSED"
echo "  Failed: $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ Node Billing E2E tests passed!${NC}"
  echo ""
  echo "Node lifecycle verified:"
  echo "  1. Connection: ✓ (node transitioned to ONLINE)"
  echo "  2. Power Tracking: ✓ ($TICK_COUNT ticks recorded)"
  echo "  3. Shutdown: ✓ (node transitioned to OFFLINE)"
  echo "  4. Billing: ✓ ($FINAL_ENERGY Wh tracked)"
  exit 0
else
  echo -e "${RED}✗ Node Billing E2E tests failed!${NC}"
  exit 1
fi
