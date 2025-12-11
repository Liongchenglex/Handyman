/**
 * Stripe Configuration Test Page
 *
 * This page helps diagnose Stripe integration issues
 * Access at: http://localhost:3000/stripe-test
 */

import React, { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';

const StripeTest = () => {
  const [diagnostics, setDiagnostics] = useState({
    publishableKey: null,
    stripeLoaded: false,
    error: null
  });

  useEffect(() => {
    const runDiagnostics = async () => {
      try {
        // Check if publishable key exists
        const key = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;

        console.log('🔍 Stripe Diagnostics:');
        console.log('Publishable Key exists:', !!key);
        console.log('Key starts with pk_test:', key?.startsWith('pk_test_'));
        console.log('Key length:', key?.length);

        if (!key) {
          setDiagnostics({
            publishableKey: null,
            stripeLoaded: false,
            error: 'REACT_APP_STRIPE_PUBLISHABLE_KEY not found in environment variables'
          });
          return;
        }

        // Try to load Stripe
        const stripe = await loadStripe(key);

        if (stripe) {
          console.log('✅ Stripe loaded successfully!');
          setDiagnostics({
            publishableKey: key,
            stripeLoaded: true,
            error: null
          });
        } else {
          console.error('❌ Stripe failed to load');
          setDiagnostics({
            publishableKey: key,
            stripeLoaded: false,
            error: 'Failed to load Stripe.js'
          });
        }
      } catch (err) {
        console.error('❌ Error during diagnostics:', err);
        setDiagnostics({
          publishableKey: process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || null,
          stripeLoaded: false,
          error: err.message
        });
      }
    };

    runDiagnostics();
  }, []);

  return (
    <div style={{
      maxWidth: '800px',
      margin: '50px auto',
      padding: '20px',
      fontFamily: 'monospace'
    }}>
      <h1>🔧 Stripe Configuration Diagnostics</h1>

      <div style={{
        background: '#f5f5f5',
        padding: '20px',
        borderRadius: '8px',
        marginTop: '20px'
      }}>
        <h2>Environment Variables:</h2>
        <pre>
          REACT_APP_STRIPE_PUBLISHABLE_KEY: {diagnostics.publishableKey
            ? `${diagnostics.publishableKey.substring(0, 20)}...${diagnostics.publishableKey.substring(diagnostics.publishableKey.length - 10)}`
            : '❌ NOT SET'
          }
        </pre>

        <h2>Stripe.js Status:</h2>
        <pre>
          Loaded: {diagnostics.stripeLoaded ? '✅ YES' : '❌ NO'}
        </pre>

        {diagnostics.error && (
          <>
            <h2 style={{ color: 'red' }}>Error:</h2>
            <pre style={{ color: 'red' }}>{diagnostics.error}</pre>
          </>
        )}
      </div>

      <div style={{
        background: '#e3f2fd',
        padding: '20px',
        borderRadius: '8px',
        marginTop: '20px'
      }}>
        <h2>All Environment Variables:</h2>
        <pre style={{ fontSize: '12px', maxHeight: '300px', overflow: 'auto' }}>
          {JSON.stringify(
            Object.keys(process.env)
              .filter(key => key.startsWith('REACT_APP_'))
              .reduce((obj, key) => {
                obj[key] = key.includes('SECRET') || key.includes('KEY') || key.includes('TOKEN')
                  ? '***REDACTED***'
                  : process.env[key];
                return obj;
              }, {}),
            null,
            2
          )}
        </pre>
      </div>

      <div style={{ marginTop: '20px', padding: '20px', background: '#fff3cd', borderRadius: '8px' }}>
        <h3>💡 Troubleshooting Tips:</h3>
        <ul>
          <li><strong>If publishable key is NOT SET:</strong> Check .env.local file exists and contains REACT_APP_STRIPE_PUBLISHABLE_KEY</li>
          <li><strong>If Stripe.js fails to load:</strong> Check browser console for network errors</li>
          <li><strong>After fixing .env.local:</strong> Restart the dev server (npm start)</li>
        </ul>
      </div>
    </div>
  );
};

export default StripeTest;
