#!/bin/bash

echo "🔧 Starting server with Node 18..."

# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Switch to Node 18
nvm use 18

echo ""
echo "✅ Node version:"
node -v

echo ""
echo "🚀 Starting React dev server..."
npm start
