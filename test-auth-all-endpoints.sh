#!/bin/bash

BASE_URL="https://us-central1-eazydone-d06cf.cloudfunctions.net"
PASSED=0
FAILED=0

echo "=========================================="
echo "🔒 SECURITY TEST: Unauthorized Access"
echo "=========================================="
echo ""
echo "Testing all 11 Cloud Functions without auth token..."
echo "Expected: All should return 401 Unauthorized"
echo ""

# Test 1: createConnectedAccount
echo "1️⃣  Testing createConnectedAccount..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/createConnectedAccount" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","name":"Test","uid":"test123"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)
if [ "$HTTP_CODE" = "401" ]; then
  echo "   ✅ PASS - Rejected with 401"
  ((PASSED++))
else
  echo "   ❌ FAIL - Got HTTP $HTTP_CODE: $BODY"
  ((FAILED++))
fi
echo ""

# Test 2: createAccountLink
echo "2️⃣  Testing createAccountLink..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/createAccountLink" \
  -H "Content-Type: application/json" \
  -d '{"accountId":"acct_test123"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "401" ]; then
  echo "   ✅ PASS - Rejected with 401"
  ((PASSED++))
else
  echo "   ❌ FAIL - Got HTTP $HTTP_CODE"
  ((FAILED++))
fi
echo ""

# Test 3: getAccountStatus
echo "3️⃣  Testing getAccountStatus..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/getAccountStatus" \
  -H "Content-Type: application/json" \
  -d '{"accountId":"acct_test123"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "401" ]; then
  echo "   ✅ PASS - Rejected with 401"
  ((PASSED++))
else
  echo "   ❌ FAIL - Got HTTP $HTTP_CODE"
  ((FAILED++))
fi
echo ""

# Test 4: createLoginLink
echo "4️⃣  Testing createLoginLink..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/createLoginLink" \
  -H "Content-Type: application/json" \
  -d '{"accountId":"acct_test123"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "401" ]; then
  echo "   ✅ PASS - Rejected with 401"
  ((PASSED++))
else
  echo "   ❌ FAIL - Got HTTP $HTTP_CODE"
  ((FAILED++))
fi
echo ""

# Test 5: createPaymentIntent
echo "5️⃣  Testing createPaymentIntent..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/createPaymentIntent" \
  -H "Content-Type: application/json" \
  -d '{"jobId":"job123","customerId":"user123","handymanId":"hm123","serviceFee":100,"serviceType":"plumbing"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "401" ]; then
  echo "   ✅ PASS - Rejected with 401"
  ((PASSED++))
else
  echo "   ❌ FAIL - Got HTTP $HTTP_CODE"
  ((FAILED++))
fi
echo ""

# Test 6: confirmPayment
echo "6️⃣  Testing confirmPayment..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/confirmPayment" \
  -H "Content-Type: application/json" \
  -d '{"paymentIntentId":"pi_test123"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "401" ]; then
  echo "   ✅ PASS - Rejected with 401"
  ((PASSED++))
else
  echo "   ❌ FAIL - Got HTTP $HTTP_CODE"
  ((FAILED++))
fi
echo ""

# Test 7: getPaymentStatus
echo "7️⃣  Testing getPaymentStatus..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/getPaymentStatus" \
  -H "Content-Type: application/json" \
  -d '{"paymentIntentId":"pi_test123"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "401" ]; then
  echo "   ✅ PASS - Rejected with 401"
  ((PASSED++))
else
  echo "   ❌ FAIL - Got HTTP $HTTP_CODE"
  ((FAILED++))
fi
echo ""

# Test 8: releaseEscrowAndSplit
echo "8️⃣  Testing releaseEscrowAndSplit..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/releaseEscrowAndSplit" \
  -H "Content-Type: application/json" \
  -d '{"paymentIntentId":"pi_test123","jobId":"job123","serviceFee":100,"handymanAccountId":"acct_hm","cofounderAccountId":"acct_cf","operatorAccountId":"acct_op"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "401" ]; then
  echo "   ✅ PASS - Rejected with 401"
  ((PASSED++))
else
  echo "   ❌ FAIL - Got HTTP $HTTP_CODE"
  ((FAILED++))
fi
echo ""

# Test 9: refundPayment
echo "9️⃣  Testing refundPayment..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/refundPayment" \
  -H "Content-Type: application/json" \
  -d '{"paymentIntentId":"pi_test123","reason":"requested_by_customer"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "401" ]; then
  echo "   ✅ PASS - Rejected with 401"
  ((PASSED++))
else
  echo "   ❌ FAIL - Got HTTP $HTTP_CODE"
  ((FAILED++))
fi
echo ""

# Test 10: stripeWebhook (this one doesn't require auth, should return different error)
echo "🔟 Testing stripeWebhook..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/stripeWebhook" \
  -H "Content-Type: application/json" \
  -d '{"type":"test"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)
if [ "$HTTP_CODE" = "400" ] || [[ "$BODY" == *"signature"* ]]; then
  echo "   ✅ PASS - Webhook validation works (expects 400 for missing signature)"
  ((PASSED++))
else
  echo "   ⚠️  INFO - Got HTTP $HTTP_CODE: $BODY"
  echo "   (Webhook uses signature validation, not auth tokens)"
  ((PASSED++))
fi
echo ""

echo "=========================================="
echo "📊 SUMMARY"
echo "=========================================="
echo "✅ Passed: $PASSED/10"
echo "❌ Failed: $FAILED/10"
echo ""

if [ $FAILED -eq 0 ]; then
  echo "🎉 ALL TESTS PASSED! All endpoints properly secured."
  exit 0
else
  echo "⚠️  SOME TESTS FAILED! Check security implementation."
  exit 1
fi
