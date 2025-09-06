import { DeFiPoolCRUD, DeFiPoolEntity, initializeClient } from './defi_pool_crud';
import { EnhancedPoolQueries } from './enhanced_queries';

/**
 * Simple demo showcasing GolemDB integration with enhanced number filtering
 * This version avoids unsupported query operators and focuses on working functionality
 */

function formatNumber(num: number, decimals: number = 2): string {
  if (num >= 1e9) {
    return `$${(num / 1e9).toFixed(decimals)}B`;
  } else if (num >= 1e6) {
    return `$${(num / 1e6).toFixed(decimals)}M`;
  } else if (num >= 1e3) {
    return `$${(num / 1e3).toFixed(decimals)}K`;
  } else {
    return `$${num.toFixed(decimals)}`;
  }
}

function displayResults(pools: DeFiPoolEntity[], title: string, maxResults: number = 5) {
  console.log(`\n=== ${title} ===`);
  console.log(`Found ${pools.length} pools`);
  
  if (pools.length === 0) {
    console.log("No pools found matching the criteria.");
    return;
  }

  const displayPools = pools.slice(0, maxResults);
  console.log("─".repeat(80));
  console.log("Symbol".padEnd(20) + "Chain".padEnd(12) + "Project".padEnd(15) + "TVL".padEnd(12) + "APY");
  console.log("─".repeat(80));
  
  for (const pool of displayPools) {
    const symbol = pool.symbol.padEnd(20);
    const chain = pool.chain.padEnd(12);
    const project = pool.project.padEnd(15);
    const tvl = formatNumber(pool.tvlUsd).padEnd(12);
    const apy = `${(pool.apy || 0).toFixed(2)}%`;
    
    console.log(`${symbol}${chain}${project}${tvl}${apy}`);
  }
  
  if (pools.length > maxResults) {
    console.log(`... and ${pools.length - maxResults} more pools`);
  }
}

async function main() {
  console.log("🎯 GolemDB DeFi Pool Enhanced Query Demo");
  console.log("=========================================\n");

  try {
    // Initialize
    console.log("🔧 Connecting to GolemDB...");
    const client = await initializeClient();
    const crud = new DeFiPoolCRUD(client);
    const enhanced = new EnhancedPoolQueries(crud);
    
    console.log("✅ Connected successfully!\n");

    // 1. Basic Statistics
    console.log("📊 BASIC STATISTICS");
    console.log("=".repeat(50));
    
    const stats = await enhanced.getPoolStatistics();
    console.log(`Total Pools: ${stats.totalPools}`);
    console.log(`Total TVL: ${formatNumber(stats.totalTvl)}`);
    console.log(`Average APY: ${stats.averageApy.toFixed(2)}%`);
    console.log(`Stablecoin Percentage: ${stats.stablecoinPercentage.toFixed(1)}%`);

    // 2. Top Performers
    console.log("\n🏆 TOP PERFORMERS");
    console.log("=".repeat(50));
    
    const topTvlPools = await enhanced.queryTopPoolsByMetric('tvlUsd', 5);
    displayResults(topTvlPools, "Top 5 Pools by TVL", 5);

    const topApyPools = await enhanced.queryTopPoolsByMetric('apy', 5);
    displayResults(topApyPools, "Top 5 Pools by APY", 5);

    // 3. Advanced Filtering
    console.log("\n🔍 ADVANCED FILTERING");
    console.log("=".repeat(50));

    // Multi-criteria query (without unsupported operators)
    const advancedPools = await enhanced.queryPoolsAdvanced({
      minTvl: 10_000_000,     // Min $10M TVL
      maxTvl: 200_000_000,    // Max $200M TVL
      minApy: 1.0,            // Min 1% APY
      chains: ["Ethereum"],
      stablecoinOnly: true
    });
    displayResults(advancedPools, "Large Ethereum Stablecoin Pools ($10M-$200M TVL, >1% APY)", 5);

    // 4. Chain Comparison
    console.log("\n🌐 CHAIN COMPARISON");
    console.log("=".repeat(50));
    
    for (const chainName of Object.keys(stats.chainDistribution).slice(0, 3)) {
      const chainPools = await crud.queryPoolsByChain(chainName);
      const chainTvl = chainPools.reduce((sum, pool) => sum + (pool.tvlUsd || 0), 0);
      const chainAvgApy = chainPools.reduce((sum, pool) => sum + (pool.apy || 0), 0) / chainPools.length;
      
      console.log(`${chainName.padEnd(12)}: ${chainPools.length.toString().padEnd(3)} pools, ${formatNumber(chainTvl).padEnd(10)}, ${chainAvgApy.toFixed(2)}% avg APY`);
    }

    // 5. Reliable Pools
    console.log("\n📈 DATA RELIABILITY");
    console.log("=".repeat(50));
    
    const reliablePools = await enhanced.queryReliablePools(100);
    displayResults(reliablePools, "Reliable Pools (>100 data points)", 5);

    // 6. High-Yield Opportunities (using basic advanced query)
    console.log("\n💰 HIGH-YIELD OPPORTUNITIES");
    console.log("=".repeat(50));
    
    const opportunities = await enhanced.queryPoolsAdvanced({
      minApy: 3.0,
      minTvl: 1_000_000,
      stablecoinOnly: true
    });
    displayResults(opportunities, "High-Yield Stablecoin Opportunities (>3% APY, >$1M TVL)", 5);

    console.log("\n✅ Demo completed successfully!");
    console.log("\n📚 Available npm scripts:");
    console.log("  npm run demo-queries     - Full interactive demo");
    console.log("  npm run query           - Basic query examples");
    console.log("  npm run create          - Load sample data");
    console.log("  npm run cleanup         - Clean database");

  } catch (error) {
    console.error("❌ Demo failed:", error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { main };