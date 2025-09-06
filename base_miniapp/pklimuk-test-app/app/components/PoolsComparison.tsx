"use client";

import { PoolData } from '../api/pools/route';

interface PoolsComparisonProps {
  selectedPools: PoolData[];
  onClose: () => void;
}

export default function PoolsComparison({ selectedPools, onClose }: PoolsComparisonProps) {
  if (selectedPools.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-8">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Pool Comparison</h3>
          <p className="text-gray-500">Select up to 3 pools to compare their metrics side by side.</p>
        </div>
      </div>
    );
  }

  const formatNumber = (num: number | null | undefined) => {
    if (num === null || num === undefined || isNaN(num)) return '-';
    if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`;
    return `$${num.toFixed(2)}`;
  };

  const formatPercent = (num: number | null | undefined) => {
    if (num === null || num === undefined || isNaN(num)) return '-';
    return `${num.toFixed(2)}%`;
  };

  type ComparisonField = {
    key: keyof PoolData;
    label: string;
    format: (val: unknown) => string;
  };

  const comparisonFields: ComparisonField[] = [
    { key: 'chain', label: 'Chain', format: (val: unknown) => (val as string) || '-' },
    { key: 'project', label: 'Project', format: (val: unknown) => (val as string) || '-' },
    { key: 'symbol', label: 'Symbol', format: (val: unknown) => (val as string) || '-' },
    { key: 'tvlUsd', label: 'TVL (USD)', format: (val: unknown) => formatNumber(val as number) },
    { key: 'apy', label: 'Total APY', format: (val: unknown) => formatPercent(val as number) },
    { key: 'apyBase', label: 'Base APY', format: (val: unknown) => formatPercent(val as number) },
    { key: 'apyReward', label: 'Reward APY', format: (val: unknown) => formatPercent(val as number) },
    { key: 'apyPct1D', label: 'APY Change (1D)', format: (val: unknown) => formatPercent(val as number) },
    { key: 'apyPct7D', label: 'APY Change (7D)', format: (val: unknown) => formatPercent(val as number) },
    { key: 'apyPct30D', label: 'APY Change (30D)', format: (val: unknown) => formatPercent(val as number) },
    { key: 'stablecoin', label: 'Stablecoin', format: (val: unknown) => (val as boolean) ? 'Yes' : 'No' },
    { key: 'ilRisk', label: 'IL Risk', format: (val: unknown) => (val as string) || '-' },
    { key: 'exposure', label: 'Exposure', format: (val: unknown) => (val as string) || '-' },
    { key: 'volumeUsd1d', label: 'Volume (1D)', format: (val: unknown) => formatNumber(val as number) },
    { key: 'volumeUsd7d', label: 'Volume (7D)', format: (val: unknown) => formatNumber(val as number) },
    { key: 'mu', label: 'Mu (μ)', format: (val: unknown) => (val as number) ? (val as number).toFixed(4) : '-' },
    { key: 'sigma', label: 'Sigma (σ)', format: (val: unknown) => (val as number) ? (val as number).toFixed(4) : '-' },
    { key: 'count', label: 'Count', format: (val: unknown) => (val as number) ? (val as number).toString() : '-' },
    { key: 'outlier', label: 'Outlier', format: (val: unknown) => (val as boolean) ? 'Yes' : 'No' },
  ];

  const getBestValue = (field: string, pools: PoolData[]) => {
    if (['tvlUsd', 'apy', 'apyBase', 'apyReward', 'volumeUsd1d', 'volumeUsd7d'].includes(field)) {
      // Higher is better for these fields
      return Math.max(...pools.map(p => (p[field as keyof PoolData] as number) || 0));
    }
    return null;
  };

  const getCellStyle = (field: string, value: string | number | boolean, pools: PoolData[]) => {
    const bestValue = getBestValue(field, pools);
    if (bestValue !== null && typeof value === 'number' && value === bestValue && value > 0) {
      return 'bg-green-50 text-green-800 font-semibold';
    }
    return '';
  };

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200">
      {/* Header */}
      <div className="px-4 md:px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-base md:text-lg font-medium text-gray-900">
          Pool Comparison ({selectedPools.length})
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full p-1"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Mobile Card Layout */}
      <div className="lg:hidden">
        <div className="p-4 space-y-4">
          {selectedPools.map((pool) => (
            <div key={pool.pool} className="border border-gray-200 rounded-lg">
              {/* Pool Header */}
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 rounded-t-lg">
                <h4 className="font-semibold text-gray-900">{pool.symbol}</h4>
                <p className="text-sm text-gray-600">{pool.project}</p>
                <span className="inline-block mt-1 px-2 py-1 bg-gray-100 rounded-md text-xs">
                  {pool.chain}
                </span>
              </div>
              
              {/* Pool Metrics */}
              <div className="p-4 space-y-3">
                {comparisonFields.map(field => {
                  const value = pool[field.key as keyof PoolData];
                  const formattedValue = field.format(value);
                  const cellStyle = getCellStyle(field.key, value, selectedPools);
                  const isBest = cellStyle.includes('bg-green-50');
                  
                  return (
                    <div key={field.key} className="flex justify-between items-center py-1">
                      <span className="text-sm text-gray-600">{field.label}:</span>
                      <span className={`text-sm font-medium ${
                        isBest ? 'text-green-800 bg-green-50 px-2 py-1 rounded' : 'text-gray-900'
                      }`}>
                        {isBest && '🏆 '}{formattedValue}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Desktop Table Layout */}
      <div className="hidden lg:block">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Metric
                </th>
                {selectedPools.map((pool) => (
                  <th key={pool.pool} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="space-y-1">
                      <div className="font-semibold text-gray-900">{pool.symbol}</div>
                      <div className="text-xs text-gray-500">{pool.project}</div>
                      <div className="text-xs">
                        <span className="px-2 py-1 bg-gray-100 rounded-md">{pool.chain}</span>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {comparisonFields.map(field => (
                <tr key={field.key} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {field.label}
                  </td>
                  {selectedPools.map(pool => {
                    const value = pool[field.key as keyof PoolData];
                    const formattedValue = field.format(value);
                    const cellStyle = getCellStyle(field.key, value, selectedPools);
                    
                    return (
                      <td key={`${pool.pool}-${field.key}`} className={`px-6 py-4 whitespace-nowrap text-sm ${cellStyle}`}>
                        {formattedValue}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="px-4 md:px-6 py-4 bg-gray-50 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Summary Statistics</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-3 rounded-md border border-gray-200">
            <div className="text-xs text-gray-500 uppercase tracking-wider">Total TVL</div>
            <div className="text-lg font-semibold text-green-600">
              {formatNumber(selectedPools.reduce((sum, pool) => sum + (pool.tvlUsd || 0), 0))}
            </div>
          </div>
          <div className="bg-white p-3 rounded-md border border-gray-200">
            <div className="text-xs text-gray-500 uppercase tracking-wider">Average APY</div>
            <div className="text-lg font-semibold text-blue-600">
              {formatPercent(selectedPools.reduce((sum, pool) => sum + (pool.apy || 0), 0) / selectedPools.length)}
            </div>
          </div>
          <div className="bg-white p-3 rounded-md border border-gray-200">
            <div className="text-xs text-gray-500 uppercase tracking-wider">Chains</div>
            <div className="text-sm font-medium">
              {[...new Set(selectedPools.map(p => p.chain))].join(', ')}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="px-4 md:px-6 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-green-50 border border-green-200 rounded"></div>
            <span className="hidden sm:inline">Best value in category</span>
            <span className="sm:hidden">Best value 🏆</span>
          </div>
        </div>
      </div>
    </div>
  );
}