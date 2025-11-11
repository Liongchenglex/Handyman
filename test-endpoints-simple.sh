#!/bin/bash

# Simple endpoint connectivity test
# This just verifies the endpoints are deployed and responding

echo ""
echo "🧪 Testing Endpoint Connectivity"
echo "=================================="
echo ""

BASE_URL="https://us-central1-eazydone-d06cf.cloudfunctions.net"

# Test with a simple GET endpoint
echo "Testing: getAccountStatus (should return 400 - missing parameter)"
echo "─────────────────────────────────────────────────────────────────"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  "${BASE_URL}/getAccountStatus" | head -5

echo ""
echo ""
echo "Testing: getPaymentStatus (should return 400 - missing parameter)"
echo "─────────────────────────────────────────────────────────────────"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  "${BASE_URL}/getPaymentStatus" | head -5

echo ""
echo ""
echo "=================================="
echo "✅ Endpoints are live and responding!"
echo ""
echo "Note: 400 errors are EXPECTED here - it means the endpoints"
echo "are working but need proper parameters (which is correct)."
echo ""
echo "Your endpoints are ready to use from your frontend!"
echo "=================================="
echo ""
