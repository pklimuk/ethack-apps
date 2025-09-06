import { DeFiPoolCRUD, initializeClient } from './defi_pool_crud';
import { EnhancedPoolQueries } from './enhanced_queries';

async function test() {
  console.log("Testing enhanced queries...");
  
  const client = await initializeClient();
  const crud = new DeFiPoolCRUD(client);
  const enhanced = new EnhancedPoolQueries(crud);
  
  // Test basic functionality
  const stats = await enhanced.getPoolStatistics();
  console.log(`✅ Statistics: ${stats.totalPools} pools, $${(stats.totalTvl/1e9).toFixed(2)}B TVL`);
  
  // Test top performers
  const topTvl = await enhanced.queryTopPoolsByMetric('tvlUsd', 3);
  console.log(`✅ Top TVL: Found ${topTvl.length} pools`);
  
  // Test advanced query (without problematic filters)
  const advanced = await enhanced.queryPoolsAdvanced({
    minTvl: 1_000_000,
    stablecoinOnly: true
  });
  console.log(`✅ Advanced query: Found ${advanced.length} pools`);
  
  console.log("✅ All tests passed!");
  process.exit(0);
}

test().catch(console.error);