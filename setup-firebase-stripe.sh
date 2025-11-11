#!/bin/bash

# Setup script for configuring Stripe in Firebase Functions
# This script sets the Stripe API keys from .env.local into Firebase config

echo "🔧 Setting up Stripe configuration in Firebase Functions..."
echo ""

# Load environment variables from .env.local
if [ ! -f .env.local ]; then
  echo "❌ Error: .env.local file not found"
  exit 1
fi

# Source the .env.local file
export $(cat .env.local | grep -v '^#' | xargs)

# Check if variables are loaded
if [ -z "$STRIPE_SECRET_KEY" ]; then
  echo "❌ Error: STRIPE_SECRET_KEY not found in .env.local"
  exit 1
fi

if [ -z "$STRIPE_WEBHOOK_SECRET" ]; then
  echo "⚠️  Warning: STRIPE_WEBHOOK_SECRET not found in .env.local"
  echo "   You can set this later after creating the webhook endpoint"
fi

# Set Firebase config
echo "Setting Stripe secret key..."
firebase functions:config:set stripe.secret_key="$STRIPE_SECRET_KEY"

if [ -n "$STRIPE_WEBHOOK_SECRET" ]; then
  echo "Setting Stripe webhook secret..."
  firebase functions:config:set stripe.webhook_secret="$STRIPE_WEBHOOK_SECRET"
fi

echo ""
echo "✅ Stripe configuration set successfully!"
echo ""
echo "To view your configuration, run:"
echo "  firebase functions:config:get"
echo ""
echo "To deploy functions, run:"
echo "  cd functions && npm install && cd .. && firebase deploy --only functions"
echo ""
