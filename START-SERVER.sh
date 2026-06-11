#!/bin/bash

echo "🔧 Starting server with Node 20..."

# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Switch to Node 20 (matches .nvmrc; required by Firebase CLI for deploys)
nvm use 20

echo ""
echo "✅ Node version:"
node -v

echo ""
echo "🚀 Starting React dev server..."
npm start
