"use client";

import { useState } from 'react';
import PoolsTable from './PoolsTable';
import PoolsComparison from './PoolsComparison';
import { PoolData } from '../api/pools/route';
import { Button } from './DemoComponents';

interface PoolsDashboardProps {
  setActiveTab: (tab: string) => void;
}

export default function PoolsDashboard({ setActiveTab }: PoolsDashboardProps) {
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
        <h1 className="text-2xl font-bold text-gray-900">DeFi Liquidity Pools Dashboard</h1>
        <p className="text-gray-600">
          Explore and compare DeFi liquidity pools across different chains and protocols
        </p>
      </div>

      {/* Action Bar */}
      {selectedPools.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-blue-800">
              <span className="font-medium">{selectedPools.length} pool{selectedPools.length !== 1 ? 's' : ''} selected</span>
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="text-sm font-medium text-gray-500">Total Pools</div>
          <div className="text-2xl font-bold text-gray-900">19K+</div>
          <div className="text-xs text-gray-500 mt-1">Across all chains</div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="text-sm font-medium text-gray-500">Chains Supported</div>
          <div className="text-2xl font-bold text-blue-600">20+</div>
          <div className="text-xs text-gray-500 mt-1">Major blockchain networks</div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="text-sm font-medium text-gray-500">Selected Pools</div>
          <div className="text-2xl font-bold text-purple-600">{selectedPools.length}/3</div>
          <div className="text-xs text-gray-500 mt-1">For comparison</div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="text-sm font-medium text-gray-500">Data Source</div>
          <div className="text-lg font-bold text-green-600">DeFi Llama</div>
          <div className="text-xs text-gray-500 mt-1">Real-time yields API</div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <svg className="w-5 h-5 text-blue-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-gray-700">
            <p className="font-medium mb-1">How to use this dashboard:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>Use the search and filter controls to find specific pools</li>
              <li>Click column headers to sort by different metrics</li>
              <li>Select up to 3 pools using the checkboxes</li>
              <li>Click &quot;Compare Pools&quot; to see a detailed side-by-side comparison</li>
              <li>Higher values are highlighted in green in the comparison view</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <PoolsTable 
        onSelectionChange={handleSelectionChange}
        maxSelection={3}
      />

      {/* Footer */}
      <div className="text-center py-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setActiveTab('home')}
          className="text-gray-500"
        >
          ← Back to Home
        </Button>
      </div>
    </div>
  );
}