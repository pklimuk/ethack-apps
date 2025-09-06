"use client";

import { useState, useEffect } from 'react';
import { Button } from './DemoComponents';
import PoolsComparison from './PoolsComparison';
import { PoolData } from '../api/pools/route';

interface ComparisonHistory {
  id: string;
  title: string;
  pools: PoolData[];
  timestamp: number;
}

export default function CompareTab() {
  const [comparisonHistory, setComparisonHistory] = useState<ComparisonHistory[]>([]);
  const [selectedComparison, setSelectedComparison] = useState<ComparisonHistory | null>(null);

  // Load comparison history from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('poolComparisons');
    if (saved) {
      try {
        const history = JSON.parse(saved);
        setComparisonHistory(history);
        if (history.length > 0) {
          setSelectedComparison(history[0]); // Auto-select the most recent
        }
      } catch (error) {
        console.error('Failed to load comparison history:', error);
      }
    }
  }, []);

  const clearHistory = () => {
    setComparisonHistory([]);
    setSelectedComparison(null);
    localStorage.removeItem('poolComparisons');
  };

  const deleteComparison = (id: string) => {
    const updated = comparisonHistory.filter(comp => comp.id !== id);
    setComparisonHistory(updated);
    localStorage.setItem('poolComparisons', JSON.stringify(updated));
    
    if (selectedComparison?.id === id) {
      setSelectedComparison(updated.length > 0 ? updated[0] : null);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (comparisonHistory.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="text-6xl mb-4">📊</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Comparisons Yet</h2>
          <p className="text-gray-500 mb-4">
            Start comparing pools in the Explore tab to see them here
          </p>
          <p className="text-sm text-gray-400">
            Comparisons are automatically saved when you use the compare feature
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar - Comparison History */}
      <div className="w-80 bg-gray-50 border-r border-gray-200 overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Comparison History</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearHistory}
              className="text-red-600 hover:text-red-700"
            >
              Clear All
            </Button>
          </div>
          <p className="text-sm text-gray-500">
            {comparisonHistory.length} comparison{comparisonHistory.length !== 1 ? 's' : ''} saved
          </p>
        </div>

        <div className="p-2">
          {comparisonHistory.map((comparison) => (
            <div
              key={comparison.id}
              className={`p-3 mb-2 rounded-lg cursor-pointer transition-colors ${
                selectedComparison?.id === comparison.id
                  ? 'bg-blue-100 border-blue-200 border'
                  : 'bg-white hover:bg-gray-100 border border-gray-200'
              }`}
              onClick={() => setSelectedComparison(comparison)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900 text-sm mb-1">
                    {comparison.title}
                  </h3>
                  <p className="text-xs text-gray-500 mb-2">
                    {formatDate(comparison.timestamp)}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {comparison.pools.map((pool, index) => (
                      <span
                        key={index}
                        className="inline-block bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded"
                      >
                        {pool.symbol}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteComparison(comparison.id);
                  }}
                  className="text-gray-400 hover:text-red-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content - Selected Comparison */}
      <div className="flex-1 overflow-auto">
        {selectedComparison ? (
          <div className="p-6">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {selectedComparison.title}
              </h1>
              <p className="text-gray-500">
                Created on {formatDate(selectedComparison.timestamp)}
              </p>
            </div>
            <PoolsComparison 
              selectedPools={selectedComparison.pools}
              onClose={() => {}} // No close action needed in this context
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-4xl mb-4">👈</div>
              <p className="text-gray-500">Select a comparison from the sidebar to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}