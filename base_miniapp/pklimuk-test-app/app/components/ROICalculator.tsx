"use client";

import { useState, useEffect } from 'react';
import { Button } from './DemoComponents';
import { PoolData } from '../api/pools/route';

export default function ROICalculator() {
  const [pools, setPools] = useState<PoolData[]>([]);
  const [selectedPool, setSelectedPool] = useState<PoolData | null>(null);
  const [investmentAmount, setInvestmentAmount] = useState<string>('1000');
  const [timeframe, setTimeframe] = useState<number>(365); // days
  const [loading, setLoading] = useState(false);

  // Load pools on component mount
  useEffect(() => {
    const fetchPools = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/pools?limit=1000&sortBy=apy&sortOrder=desc');
        if (!response.ok) throw new Error('Failed to fetch pools');
        
        const result = await response.json();
        const filteredPools = result.pools.filter((p: PoolData) => p.apy && p.apy > 0);
        setPools(filteredPools);
        
        if (filteredPools.length > 0) {
          setSelectedPool(filteredPools[0]);
        }
      } catch (error) {
        console.error('Error fetching pools:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPools();
  }, []);

  const calculateReturns = () => {
    if (!selectedPool || !selectedPool.apy) return null;
    
    const principal = parseFloat(investmentAmount) || 0;
    const annualRate = selectedPool.apy / 100; // Convert percentage to decimal
    const timeInYears = timeframe / 365;
    
    // Simple compound interest calculation (daily compounding)
    const compoundFrequency = 365; // Daily compounding
    const finalAmount = principal * Math.pow(1 + (annualRate / compoundFrequency), compoundFrequency * timeInYears);
    const totalReturn = finalAmount - principal;
    const roi = (totalReturn / principal) * 100;
    
    return {
      principal,
      finalAmount,
      totalReturn,
      roi,
      dailyReturn: totalReturn / timeframe,
      annualizedReturn: annualRate * 100
    };
  };

  const results = calculateReturns();

  const generateChartData = () => {
    if (!results) return [];
    
    const data = [];
    const days = Math.min(timeframe, 365); // Limit chart to 1 year max
    const dailyGrowthRate = Math.pow(results.finalAmount / results.principal, 1 / timeframe);
    
    for (let day = 0; day <= days; day += Math.max(1, Math.floor(days / 50))) {
      const amount = results.principal * Math.pow(dailyGrowthRate, day);
      data.push({ day, amount });
    }
    
    return data;
  };

  const chartData = generateChartData();
  const maxAmount = chartData.length > 0 ? Math.max(...chartData.map(d => d.amount)) : 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatPercent = (percent: number) => {
    return `${percent.toFixed(2)}%`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading pools data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">ROI Calculator</h1>
        <p className="text-gray-600">
          Calculate potential returns from DeFi liquidity pool investments
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Investment Parameters</h2>
            
            {/* Pool Selection */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Select Pool
              </label>
              <select
                value={selectedPool?.pool || ''}
                onChange={(e) => {
                  const pool = pools.find(p => p.pool === e.target.value);
                  setSelectedPool(pool || null);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {pools.map((pool) => (
                  <option key={pool.pool} value={pool.pool}>
                    {pool.symbol} ({pool.project}) - APY: {formatPercent(pool.apy || 0)}
                  </option>
                ))}
              </select>
              {selectedPool && (
                <div className="text-sm text-gray-600 mt-2">
                  <div>Chain: <span className="font-medium">{selectedPool.chain}</span></div>
                  <div>TVL: <span className="font-medium">{formatCurrency(selectedPool.tvlUsd || 0)}</span></div>
                  <div>Risk: <span className="font-medium">{selectedPool.stablecoin ? 'Low (Stablecoin)' : 'Higher (Volatile)'}</span></div>
                </div>
              )}
            </div>

            {/* Investment Amount */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Investment Amount (USD)
              </label>
              <input
                type="number"
                value={investmentAmount}
                onChange={(e) => setInvestmentAmount(e.target.value)}
                placeholder="1000"
                min="0"
                step="100"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Timeframe */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Investment Period
              </label>
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={7}>1 Week</option>
                <option value={30}>1 Month</option>
                <option value={90}>3 Months</option>
                <option value={180}>6 Months</option>
                <option value={365}>1 Year</option>
                <option value={730}>2 Years</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results Panel */}
        <div className="space-y-6">
          {results && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                  <div className="text-sm font-medium text-gray-500">Total Return</div>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(results.totalReturn)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    +{formatPercent(results.roi)}
                  </div>
                </div>
                
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                  <div className="text-sm font-medium text-gray-500">Final Amount</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {formatCurrency(results.finalAmount)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    From {formatCurrency(results.principal)}
                  </div>
                </div>
              </div>

              {/* Additional Metrics */}
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Detailed Breakdown</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Daily Return (avg):</span>
                    <span className="font-medium">{formatCurrency(results.dailyReturn)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">APY:</span>
                    <span className="font-medium">{formatPercent(results.annualizedReturn)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Investment Period:</span>
                    <span className="font-medium">{timeframe} days</span>
                  </div>
                  <div className="border-t border-gray-200 pt-3">
                    <div className="text-xs text-gray-500">
                      * Calculations assume compound interest and stable APY rates. 
                      Actual returns may vary due to market conditions, fees, and impermanent loss.
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}