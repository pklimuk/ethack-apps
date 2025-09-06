"use client";

import { useState } from 'react';
import { PoolData } from '../api/pools/route';
import { Button } from './DemoComponents';
import PoolsComparison from './PoolsComparison';
import PoolsTable from './PoolsTable';

export default function PoolsDashboard() {
  const [selectedPools, setSelectedPools] = useState<PoolData[]>([]);
  const [showComparison, setShowComparison] = useState(false);

  const handleSelectionChange = (pools: PoolData[]) => {
    setSelectedPools(pools);
  };

  const handleCompare = () => {
    if (selectedPools.length > 0) {
      setShowComparison(true);
    }
  };

  const handleCloseComparison = () => {
    setShowComparison(false);
  };

  const clearSelection = () => {
    setSelectedPools([]);
    setShowComparison(false);
  };

  if (showComparison) {
    return (
      <div className="space-y-4">
        {/* Header with back button */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleCloseComparison}
            className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Back to Table</span>
          </button>

          <Button
            variant="outline"
            size="sm"
            onClick={clearSelection}
          >
            Clear Selection
          </Button>
        </div>

        <PoolsComparison
          selectedPools={selectedPools}
          onClose={handleCloseComparison}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">DeFi Liquidity Pools Monitoring</h1>
        <p className="text-gray-600">
          Explore and compare DeFi liquidity pools across different chains and protocols
        </p>
      </div>

      {/* Action Bar */}
      {selectedPools.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-blue-800">
              <span className="font-medium">{selectedPools.length}/3 pools selected</span>
              <span className="ml-2 text-blue-600">
                ({selectedPools.map(p => p.symbol).join(', ')})
              </span>
            </div>
            <div className="space-x-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handleCompare}
                disabled={selectedPools.length === 0}
              >
                Compare Pools
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearSelection}
              >
                Clear Selection
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Table */}
      <PoolsTable
        onSelectionChange={handleSelectionChange}
        maxSelection={3}
      />
    </div>
  );
}