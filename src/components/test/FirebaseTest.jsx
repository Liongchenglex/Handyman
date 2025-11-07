/**
 * Firebase Connection Test Component
 *
 * This component provides a UI to test your Firebase setup
 * Add this to your app temporarily to verify everything works
 */

import React, { useState } from 'react';
import { runAllTests } from '../../services/firebase/testConnection';

const FirebaseTest = () => {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState(null);

  const handleRunTests = async () => {
    setTesting(true);
    setResults(null);

    try {
      const testResults = await runAllTests();
      setResults(testResults);
    } catch (error) {
      console.error('Test error:', error);
      setResults({ error: error.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-6 max-w-md">
        <div className="flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-orange-500">science</span>
          <h3 className="text-lg font-bold">Firebase Connection Test</h3>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Click the button below to test your Firebase configuration, authentication, and database connection.
        </p>

        <button
          onClick={handleRunTests}
          disabled={testing}
          className="w-full bg-primary text-black font-bold py-3 px-4 rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {testing ? 'Running Tests...' : 'Run Firebase Tests'}
        </button>

        {results && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            {results.error ? (
              <div className="text-red-500">
                <span className="material-symbols-outlined">error</span>
                <p className="text-sm mt-2">Test failed. Check console for details.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-green-600">
                  <span className="material-symbols-outlined">check_circle</span>
                  <span className="font-bold">All tests passed!</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Check browser console for detailed results.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 text-xs text-gray-500">
          <p>=¡ Open browser console (F12) to see detailed test results</p>
        </div>
      </div>
    </div>
  );
};

export default FirebaseTest;
