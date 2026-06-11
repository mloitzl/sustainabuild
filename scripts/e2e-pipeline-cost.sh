#!/bin/bash

set -euo pipefail

API_URL="http://localhost:4000/graphql"
CLUSTER_NAME="pipeline-cost-test"
NODE_ID="node-cost-test-1"
RUN_ID="run-pipeline-cost-1"
COST_PER_KWH=0.12
NODE_HOSTNAME="pipeline-agent.local"
NODE_IP_ADDRESS="10.42.0.11"
NODE_FIRMWARE_VERSION="1.2.3-test"

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

TESTS_PASSED=0
TESTS_FAILED=0

graphql() {
  local query="$1"
  local body
  body=$(jq -n --arg query "$query" '{query:$query}')
  curl -s "$API_URL" -X POST -H "Content-Type: application/json" -d "$body"
}

test_case() {
  echo -e "\n${GREEN}Test: $1${NC}"
}

pass() {
  echo -e "${GREEN}✓${NC} $1"
  TESTS_PASSED=$((TESTS_PASSED + 1))
}

fail() {
  echo -e "${RED}✗${NC} $1"
  TESTS_FAILED=$((TESTS_FAILED + 1))
}

assert_no_errors() {
  local response="$1"
  local errors
  errors=$(echo "$response" | jq -r '.errors // empty')
  if [ -n "$errors" ]; then
    echo "$response" | jq .
    return 1
  fi
}

echo "Waiting for API..."
for i in {1..30}; do
  if graphql '{ health { ok } }' | jq -e '.data.health.ok' >/dev/null 2>&1; then
    echo "API ready!"
    break
  fi
  sleep 1
done

test_case "Creating cluster"
CLUSTER_RESPONSE=$(graphql "mutation { createCluster(name: \"${CLUSTER_NAME}\") { id name status } }")
assert_no_errors "$CLUSTER_RESPONSE"
CLUSTER_ID=$(echo "$CLUSTER_RESPONSE" | jq -r '.data.createCluster.id')

if [ -n "$CLUSTER_ID" ] && [ "$CLUSTER_ID" != "null" ]; then
  pass "Cluster created: $CLUSTER_ID"
else
  fail "Failed to create cluster"
  exit 1
fi

test_case "Acquiring pipeline lease"
LEASE_RESPONSE=$(graphql "mutation { acquireClusterLease(clusterId: \"${CLUSTER_ID}\", runId: \"${RUN_ID}\") { id status activeLeaseCount } }")
assert_no_errors "$LEASE_RESPONSE"

LEASE_STATUS=$(echo "$LEASE_RESPONSE" | jq -r '.data.acquireClusterLease.status')
LEASE_COUNT=$(echo "$LEASE_RESPONSE" | jq -r '.data.acquireClusterLease.activeLeaseCount')

if [ "$LEASE_STATUS" = "BOOTING" ] || [ "$LEASE_STATUS" = "ONLINE" ]; then
  pass "Lease acquired, cluster status is $LEASE_STATUS ($LEASE_COUNT active lease(s))"
else
  fail "Unexpected cluster status after lease acquisition: $LEASE_STATUS"
  exit 1
fi

test_case "Connecting node"
CONNECT_RESPONSE=$(
  graphql "mutation { emitNodeConnected(
    clusterId: \"${CLUSTER_ID}\",
    nodeId: \"${NODE_ID}\",
    hostname: \"${NODE_HOSTNAME}\",
    ipAddress: \"${NODE_IP_ADDRESS}\",
    firmwareVersion: \"${NODE_FIRMWARE_VERSION}\"
  ) { clusterId nodeId connectedAt } }"
)
assert_no_errors "$CONNECT_RESPONSE"

CONNECTED_NODE=$(echo "$CONNECT_RESPONSE" | jq -r '.data.emitNodeConnected.nodeId')
if [ "$CONNECTED_NODE" = "$NODE_ID" ]; then
  pass "Node connected: $NODE_ID"
else
  fail "Node connection failed"
  exit 1
fi

sleep 2

test_case "Verifying node metadata projection"
NODES_RESPONSE=$(
  graphql "query { nodesByCluster(clusterId: \"${CLUSTER_ID}\") { edges { node { id hostname ipAddress firmwareVersion } } } }"
)
assert_no_errors "$NODES_RESPONSE"

PROJECTED_HOSTNAME=$(echo "$NODES_RESPONSE" | jq -r '.data.nodesByCluster.edges[0].node.hostname')
PROJECTED_IP=$(echo "$NODES_RESPONSE" | jq -r '.data.nodesByCluster.edges[0].node.ipAddress')
PROJECTED_FIRMWARE=$(echo "$NODES_RESPONSE" | jq -r '.data.nodesByCluster.edges[0].node.firmwareVersion')

if [ "$PROJECTED_HOSTNAME" = "$NODE_HOSTNAME" ] && [ "$PROJECTED_IP" = "$NODE_IP_ADDRESS" ] && [ "$PROJECTED_FIRMWARE" = "$NODE_FIRMWARE_VERSION" ]; then
  pass "Node metadata projected correctly"
else
  fail "Node metadata mismatch: hostname=$PROJECTED_HOSTNAME ip=$PROJECTED_IP firmware=$PROJECTED_FIRMWARE"
  exit 1
fi

test_case "Recording power ticks"
for i in {1..10}; do
  TICK_RESPONSE=$(graphql "mutation { recordNodePowerTick(nodeId: \"${NODE_ID}\", clusterId: \"${CLUSTER_ID}\", powerW: 30, energyWh: 5) }")
  assert_no_errors "$TICK_RESPONSE"
  TOTAL_WH=$(echo "$TICK_RESPONSE" | jq -r '.data.recordNodePowerTick')
  echo "  Tick $i -> $TOTAL_WH Wh"
  sleep 1
done
pass "Recorded 10 ticks"

sleep 2

test_case "Verifying node stats before lease release"
NODE_STATS=$(graphql "query { nodeStats(nodeId: \"${NODE_ID}\", clusterId: \"${CLUSTER_ID}\") { totalEnergyWh lastPowerW status } }")
assert_no_errors "$NODE_STATS"

NODE_STATUS=$(echo "$NODE_STATS" | jq -r '.data.nodeStats.status')
NODE_ENERGY=$(echo "$NODE_STATS" | jq -r '.data.nodeStats.totalEnergyWh')
NODE_POWER=$(echo "$NODE_STATS" | jq -r '.data.nodeStats.lastPowerW')

if [ "$NODE_STATUS" = "ONLINE" ] && [ "$NODE_ENERGY" = "50" ] && [ "$NODE_POWER" = "30" ]; then
  pass "Node stats show 50 Wh and 30 W while ONLINE"
else
  fail "Unexpected node stats: status=$NODE_STATUS energy=$NODE_ENERGY power=$NODE_POWER"
  exit 1
fi

test_case "Releasing pipeline lease"
RELEASE_RESPONSE=$(graphql "mutation { releaseClusterLease(clusterId: \"${CLUSTER_ID}\", runId: \"${RUN_ID}\") { id status activeLeaseCount } }")
assert_no_errors "$RELEASE_RESPONSE"

RELEASE_STATUS=$(echo "$RELEASE_RESPONSE" | jq -r '.data.releaseClusterLease.status')
if [ "$RELEASE_STATUS" = "PENDING_SHUTDOWN" ] || [ "$RELEASE_STATUS" = "OFFLINE" ] || [ "$RELEASE_STATUS" = "SHUTTING_DOWN" ]; then
  pass "Lease released, cluster status is $RELEASE_STATUS"
else
  fail "Unexpected cluster status after lease release: $RELEASE_STATUS"
  exit 1
fi

sleep 2

test_case "Calculating pipeline run cost"
COST_RESPONSE=$(graphql "query { pipelineRunCost(clusterId: \"${CLUSTER_ID}\", runId: \"${RUN_ID}\", costPerKwh: ${COST_PER_KWH}) { pipelineRunId totalEnergyWh totalKwh costPerKwh totalCost calculatedAt } }")
assert_no_errors "$COST_RESPONSE"

PIPELINE_RUN_ID=$(echo "$COST_RESPONSE" | jq -r '.data.pipelineRunCost.pipelineRunId')
TOTAL_WH=$(echo "$COST_RESPONSE" | jq -r '.data.pipelineRunCost.totalEnergyWh')
TOTAL_KWH=$(echo "$COST_RESPONSE" | jq -r '.data.pipelineRunCost.totalKwh')
TOTAL_COST=$(echo "$COST_RESPONSE" | jq -r '.data.pipelineRunCost.totalCost')

if [ "$PIPELINE_RUN_ID" != "$RUN_ID" ]; then
  fail "Pipeline run id mismatch: expected $RUN_ID, got $PIPELINE_RUN_ID"
  exit 1
fi

node -e '
const wh = Number(process.argv[1]);
const kwh = Number(process.argv[2]);
const cost = Number(process.argv[3]);
if (Math.abs(wh - 50) > 0.0001) process.exit(1);
if (Math.abs(kwh - 0.05) > 0.0001) process.exit(1);
if (Math.abs(cost - 0.006) > 0.0001) process.exit(1);
' "$TOTAL_WH" "$TOTAL_KWH" "$TOTAL_COST"

pass "Pipeline run cost calculated: ${TOTAL_WH} Wh, ${TOTAL_KWH} kWh, ${TOTAL_COST} USD"

test_case "Shutting down node"
HALT_RESPONSE=$(graphql "mutation { emitNodeHalting(clusterId: \"${CLUSTER_ID}\", nodeId: \"${NODE_ID}\") { clusterId nodeId } }")
assert_no_errors "$HALT_RESPONSE"

HALTED_NODE=$(echo "$HALT_RESPONSE" | jq -r '.data.emitNodeHalting.nodeId')
if [ "$HALTED_NODE" = "$NODE_ID" ]; then
  pass "Node halt event emitted"
else
  fail "Node halt event failed"
  exit 1
fi

sleep 2

test_case "Verifying node is offline"
FINAL_NODE_STATS=$(graphql "query { nodeStats(nodeId: \"${NODE_ID}\", clusterId: \"${CLUSTER_ID}\") { status totalEnergyWh } }")
assert_no_errors "$FINAL_NODE_STATS"

FINAL_STATUS=$(echo "$FINAL_NODE_STATS" | jq -r '.data.nodeStats.status')
FINAL_ENERGY=$(echo "$FINAL_NODE_STATS" | jq -r '.data.nodeStats.totalEnergyWh')

if [ "$FINAL_STATUS" = "OFFLINE" ] && [ "$FINAL_ENERGY" = "50" ]; then
  pass "Node offline with final energy ${FINAL_ENERGY} Wh"
else
  fail "Unexpected final node stats: status=$FINAL_STATUS energy=$FINAL_ENERGY"
  exit 1
fi

echo ""
echo "════════════════════════════════"
echo "Test Results"
echo "════════════════════════════════"
echo "  Passed: $TESTS_PASSED"
echo "  Failed: $TESTS_FAILED"

if [ "$TESTS_FAILED" -eq 0 ]; then
  echo ""
  echo -e "${GREEN}✓ Pipeline run cost E2E tests passed!${NC}"
  exit 0
fi

echo ""
echo -e "${RED}✗ Some tests failed${NC}"
exit 1
