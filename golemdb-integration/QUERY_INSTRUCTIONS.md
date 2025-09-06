# GolemDB DeFi Pool Query Instructions

This document provides comprehensive instructions for querying DeFi liquidity pool data stored in GolemDB using TypeScript.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Basic Query Methods](#basic-query-methods)
3. [Enhanced Query Methods](#enhanced-query-methods)
4. [Query Syntax Reference](#query-syntax-reference)
5. [Common Use Cases](#common-use-cases)
6. [Performance Tips](#performance-tips)
7. [Troubleshooting](#troubleshooting)

## Quick Start

### Setup and Connection

```typescript
import { DeFiPoolCRUD, initializeClient } from './defi_pool_crud';
import { EnhancedPoolQueries } from './enhanced_queries';

// Initialize client and CRUD operations
const client = await initializeClient();
const crud = new DeFiPoolCRUD(client);
const enhanced = new EnhancedPoolQueries(crud);
```

### Run Demo

```bash
# Run complete query demonstration
npm run demo-queries

# Clean up existing data
npm run cleanup

# Create sample pools
npm run create

# Run basic queries
npm run query
```

## Basic Query Methods

### 1. Query by Chain

```typescript
// Get all pools on Ethereum
const ethereumPools = await crud.queryPoolsByChain("Ethereum");

// Get all pools on Polygon  
const polygonPools = await crud.queryPoolsByChain("Polygon");
```

### 2. Query by Project

```typescript
// Get all Uniswap V3 pools
const uniswapPools = await crud.queryPoolsByProject("uniswap-v3");

// Get all Curve pools
const curvePools = await crud.queryPoolsByProject("curve-dex");
```

### 3. Query by TVL Range

```typescript
// Pools with TVL between $1M and $100M
const midTvlPools = await crud.queryPoolsByTvlRange(1_000_000, 100_000_000);

// High TVL pools (>$50M)
const highTvlPools = await crud.queryHighTvlPools(50_000_000);
```

### 4. Query by APY Range

```typescript
// Pools with 5-15% APY
const moderateApyPools = await crud.queryPoolsByApyRange(5.0, 15.0);

// High yield pools (>20% APY)  
const highYieldPools = await crud.queryPoolsByApyRange(20.0, 100.0);
```

### 5. Query Stablecoin Pools

```typescript
// All stablecoin pools
const stablecoinPools = await crud.queryStablecoinPools();
```

## Enhanced Query Methods

### 1. Advanced Multi-Criteria Filtering

```typescript
const advancedPools = await enhanced.queryPoolsAdvanced({
  minTvl: 1_000_000,           // Minimum $1M TVL
  maxTvl: 100_000_000,         // Maximum $100M TVL
  minApy: 5.0,                 // Minimum 5% APY
  maxApy: 20.0,                // Maximum 20% APY
  minVolume: 100_000,          // Minimum daily volume
  volumePeriod: '1d',          // Use 1-day volume
  chains: ["Ethereum", "Polygon"], // Specific chains
  projects: ["uniswap-v3", "curve-dex"], // Specific projects
  stablecoinOnly: true,        // Only stablecoin pools
  excludeOutliers: true        // Exclude statistical outliers
});
```

### 2. Top Performers by Metric

```typescript
// Top 10 pools by TVL
const topTvlPools = await enhanced.queryTopPoolsByMetric('tvlUsd', 10);

// Top 5 pools by APY
const topApyPools = await enhanced.queryTopPoolsByMetric('apy', 5);

// Top pools by 7-day volume
const topVolumePools = await enhanced.queryTopPoolsByMetric('volumeUsd7d', 10);
```

### 3. Percentile-Based Queries

```typescript
// Top 10% of pools by TVL (90th percentile and above)
const elitePools = await enhanced.queryPoolsByPercentile('tvlUsd', 90);

// Top 25% by APY
const highYieldPools = await enhanced.queryPoolsByPercentile('apy', 75);
```

### 4. Data Reliability Filtering

```typescript
// Pools with >200 data points (high reliability)
const reliablePools = await enhanced.queryReliablePools(200);

// Pools with >500 data points (very high reliability)
const veryReliablePools = await enhanced.queryReliablePools(500);
```

### 5. Multi-Chain/Project Queries

```typescript
// Pools across multiple chains
const crossChainPools = await enhanced.queryPoolsByChains([
  "Ethereum", "Polygon", "Arbitrum", "BSC"
]);

// Multiple DeFi projects
const defiPools = await enhanced.queryPoolsByProjects([
  "uniswap-v3", "curve-dex", "balancer-v3", "sushiswap"
]);
```

### 6. Statistical Analysis

```typescript
const stats = await enhanced.getPoolStatistics();
console.log(`Total Pools: ${stats.totalPools}`);
console.log(`Total TVL: $${stats.totalTvl.toLocaleString()}`);
console.log(`Average APY: ${stats.averageApy.toFixed(2)}%`);
console.log(`Stablecoin %: ${stats.stablecoinPercentage.toFixed(1)}%`);
```

### 7. High-Yield Opportunity Finding

```typescript
const opportunities = await enhanced.findHighYieldOpportunities({
  minApy: 10.0,              // Minimum 10% APY
  minTvl: 500_000,           // Minimum $500K TVL
  maxTvl: 50_000_000,        // Maximum $50M TVL (avoid mega pools)
  stablecoinOnly: true,      // Focus on stablecoins
  minReliability: 100        // Require >100 data points
});
```

### 8. Protocol Comparison

```typescript
const comparison = await enhanced.compareProtocolsAcrossChains([
  "uniswap-v3", "curve-dex", "balancer-v3"
]);

// Results show each protocol's performance across different chains
for (const protocol of comparison) {
  console.log(`${protocol.protocol}: ${protocol.totalPools} pools, $${protocol.totalTvl} TVL`);
  for (const chain of protocol.chains) {
    console.log(`  ${chain.chain}: ${chain.poolCount} pools, ${chain.averageApy.toFixed(2)}% avg APY`);
  }
}
```

## Query Syntax Reference

### GolemDB Query Language

GolemDB uses a SQL-like query syntax with the following operators:

#### Comparison Operators
- `=` : Equals
- `>` : Greater than
- `>=` : Greater than or equal
- `<` : Less than
- `<=` : Less than or equal

**Note**: The `!=` (not equals) operator is not currently supported in GolemDB query syntax.

#### Logical Operators
- `&&` : AND
- `||` : OR
- `!` : NOT

#### String Matching
```typescript
// Exact match
'chain = "Ethereum"'

// Multiple options
'chain = "Ethereum" || chain = "Polygon"'
```

#### Numeric Filtering
```typescript
// TVL greater than $10M (stored as cents)
'tvlUsd >= 1000000000'

// APY between 5-15% (stored as basis points)
'apy >= 50000 && apy <= 150000'

// Volume filtering
'volumeUsd1d > 100000000' // >$1M daily volume
```

### Data Storage Format

**Important**: Numeric values are stored in specific formats to avoid precision issues:

- **TVL**: Stored as cents (`$1,000,000` = `100000000`)
- **APY**: Stored as basis points (`5.25%` = `52500`)  
- **Volume**: Stored as cents (`$500,000` = `50000000`)
- **Counts**: Stored as integers (`count >= 100`)
- **Booleans**: Stored as integers (`stablecoin = 1` for true)

## Common Use Cases

### 1. Find High-Yield Stablecoin Opportunities

```typescript
// Method 1: Using basic queries
const stableHighYield = await crud.queryPools(
  'stablecoin = 1 && apy >= 100000 && tvlUsd >= 100000000 && outlier != 1'
);

// Method 2: Using enhanced queries  
const opportunities = await enhanced.queryPoolsAdvanced({
  stablecoinOnly: true,
  minApy: 10.0,
  minTvl: 1_000_000,
  excludeOutliers: true
});
```

### 2. Research Cross-Chain Protocol Performance

```typescript
const protocols = ["uniswap-v3", "curve-dex", "sushiswap"];
const comparison = await enhanced.compareProtocolsAcrossChains(protocols);

// Find best chain for each protocol
for (const protocol of comparison) {
  const bestChain = protocol.chains.sort((a, b) => b.averageApy - a.averageApy)[0];
  console.log(`${protocol.protocol} performs best on ${bestChain.chain}: ${bestChain.averageApy.toFixed(2)}% APY`);
}
```

### 3. Risk-Adjusted Pool Selection

```typescript
// Conservative approach: Large TVL, reliable data, moderate yields
const conservativePools = await enhanced.queryPoolsAdvanced({
  minTvl: 10_000_000,        // Large pools only
  maxApy: 15.0,              // Moderate yields
  stablecoinOnly: true,      // Lower risk
  excludeOutliers: true,     // Exclude statistical anomalies
  minReliability: 200        // High data reliability
});

// Aggressive approach: High yields with minimum safety
const aggressivePools = await enhanced.queryPoolsAdvanced({
  minApy: 20.0,              // High yields
  minTvl: 100_000,           // Accept smaller pools
  excludeOutliers: true,     // But avoid obvious outliers
  minReliability: 50         // Minimum data reliability
});
```

### 4. Market Analysis

```typescript
// Get market overview
const stats = await enhanced.getPoolStatistics();

// Find dominant chains
const topChains = Object.entries(stats.chainDistribution)
  .sort(([,a], [,b]) => b - a)
  .slice(0, 5);

// Find leading protocols  
const topProjects = Object.entries(stats.projectDistribution)
  .sort(([,a], [,b]) => b - a)
  .slice(0, 5);

console.log("Top 5 Chains:", topChains);
console.log("Top 5 Protocols:", topProjects);
```

## Performance Tips

### 1. Use Specific Filters

```typescript
// ❌ Slow: Query all pools then filter
const allPools = await crud.queryPools('tvlUsd > 0');
const filteredPools = allPools.filter(p => p.chain === "Ethereum");

// ✅ Fast: Filter in query
const ethereumPools = await crud.queryPoolsByChain("Ethereum");
```

### 2. Limit Result Sets

```typescript
// Get top 10 instead of all pools
const topPools = await enhanced.queryTopPoolsByMetric('tvlUsd', 10);

// Use percentile queries for large datasets
const topTier = await enhanced.queryPoolsByPercentile('tvlUsd', 90);
```

### 3. Batch Operations

```typescript
// ❌ Slow: Multiple single queries
const ethPools = await crud.queryPoolsByChain("Ethereum");
const polyPools = await crud.queryPoolsByChain("Polygon");
const arbPools = await crud.queryPoolsByChain("Arbitrum");

// ✅ Fast: Single multi-chain query
const multiChainPools = await enhanced.queryPoolsByChains([
  "Ethereum", "Polygon", "Arbitrum"
]);
```

### 4. Use Appropriate Data Types

```typescript
// ✅ Numeric comparisons are faster
'tvlUsd >= 100000000'  // $1M in cents

// ❌ String comparisons are slower  
'tvlUsd_string >= "1000000"'
```

## Troubleshooting

### Common Errors

#### 1. "No pools found" 

**Problem**: Query returns empty results

**Solutions**:
```typescript
// Check if data exists
const totalPools = await crud.queryPools('tvlUsd > 0');
console.log(`Total pools in database: ${totalPools.length}`);

// If no pools, load sample data
if (totalPools.length === 0) {
  await crud.exampleCreatePools();
}
```

#### 2. "Query timeout" 

**Problem**: Query takes too long

**Solutions**:
- Add more specific filters
- Use smaller result sets
- Check for proper numeric formatting

```typescript
// ❌ Too broad
const allPools = await crud.queryPools('tvlUsd > 0');

// ✅ More specific  
const targetPools = await crud.queryPools('chain = "Ethereum" && tvlUsd >= 100000000');
```

#### 3. "Numeric comparison failed"

**Problem**: Wrong numeric format in query

**Solutions**:
```typescript
// ❌ Wrong: Using raw numbers
'tvlUsd >= 1000000'     // Incorrect format

// ✅ Correct: Using cent conversion  
'tvlUsd >= 100000000'   // $1M = 100M cents

// ✅ Or use helper methods
const minTvlCents = Math.round(1_000_000 * 100);
const query = `tvlUsd >= ${minTvlCents}`;
```

#### 4. "Connection failed"

**Problem**: Cannot connect to GolemDB

**Solutions**:
```typescript
// Check environment variables
console.log('PRIVATE_KEY defined:', !!process.env.PRIVATE_KEY);

// Verify account balance
const client = await initializeClient();
const balance = await client.getRawClient().httpClient.getBalance({ 
  address: await client.getOwnerAddress() 
});
console.log(`Balance: ${Number(balance) / 10**18} ETH`);
```

### Debug Mode

Enable detailed logging:

```typescript
// Set debug log level
process.env.LOG_LEVEL = 'debug';

// Or create logger with debug level
const logger = new Logger({ minLevel: 0 });
```

### Query Validation

Test your queries step by step:

```typescript
// 1. Test basic connection
const pools = await crud.queryPools('tvlUsd > 0');
console.log(`Found ${pools.length} total pools`);

// 2. Test specific filter  
const filtered = await crud.queryPools('chain = "Ethereum"');
console.log(`Found ${filtered.length} Ethereum pools`);

// 3. Test numeric filter
const highTvl = await crud.queryPools('tvlUsd >= 100000000');
console.log(`Found ${highTvl.length} high TVL pools`);
```

## Advanced Examples

### Custom Query Builder

```typescript
class QueryBuilder {
  private filters: string[] = [];
  
  chain(chain: string) {
    this.filters.push(`chain = "${chain}"`);
    return this;
  }
  
  minTvl(amount: number) {
    this.filters.push(`tvlUsd >= ${Math.round(amount * 100)}`);
    return this;
  }
  
  minApy(percentage: number) {
    this.filters.push(`apy >= ${Math.round(percentage * 10000)}`);
    return this;
  }
  
  stablecoins() {
    this.filters.push('stablecoin = 1');
    return this;
  }
  
  build() {
    return this.filters.join(' && ');
  }
}

// Usage
const query = new QueryBuilder()
  .chain("Ethereum")
  .minTvl(1_000_000)
  .minApy(5.0)
  .stablecoins()
  .build();

const results = await crud.queryPools(query);
```

### Automated Monitoring

```typescript
async function monitorHighYieldOpportunities() {
  const opportunities = await enhanced.findHighYieldOpportunities({
    minApy: 15.0,
    minTvl: 500_000,
    stablecoinOnly: true,
    minReliability: 100
  });
  
  if (opportunities.length > 0) {
    console.log(`🚨 Found ${opportunities.length} high-yield opportunities:`);
    for (const pool of opportunities.slice(0, 5)) {
      console.log(`${pool.symbol} on ${pool.chain}: ${pool.apy}% APY, ${formatNumber(pool.tvlUsd)} TVL`);
    }
  }
}

// Run every 5 minutes
setInterval(monitorHighYieldOpportunities, 5 * 60 * 1000);
```

---

## Summary

This query system provides powerful filtering capabilities for DeFi liquidity pool data with:

- **Basic queries** for simple filtering by chain, project, TVL, and APY
- **Enhanced queries** for complex multi-criteria filtering
- **Statistical analysis** for market insights
- **Performance optimization** through proper indexing and query structure
- **Comprehensive error handling** and debugging tools

For more examples, run `npm run demo-queries` to see all features in action.