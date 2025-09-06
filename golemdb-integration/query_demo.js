"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatNumber = formatNumber;
exports.displayResults = displayResults;
exports.timeQuery = timeQuery;
exports.demoBasicFilters = demoBasicFilters;
exports.demoAdvancedFilters = demoAdvancedFilters;
exports.demoStatisticalAnalysis = demoStatisticalAnalysis;
exports.demoCustomQueries = demoCustomQueries;
exports.demoDataLoading = demoDataLoading;
const defi_pool_crud_1 = require("./defi_pool_crud");
const enhanced_queries_1 = require("./enhanced_queries");
const dotenv = __importStar(require("dotenv"));
// Load environment variables
dotenv.config();
/**
 * Utility function to format numbers for display
 */
function formatNumber(num, decimals = 2) {
    if (num >= 1e9) {
        return `$${(num / 1e9).toFixed(decimals)}B`;
    }
    else if (num >= 1e6) {
        return `$${(num / 1e6).toFixed(decimals)}M`;
    }
    else if (num >= 1e3) {
        return `$${(num / 1e3).toFixed(decimals)}K`;
    }
    else {
        return `$${num.toFixed(decimals)}`;
    }
}
/**
 * Display query results in a formatted table
 */
function displayResults(pools, title, maxResults = 10) {
    console.log(`\n=== ${title} ===`);
    console.log(`Found ${pools.length} pools`);
    if (pools.length === 0) {
        console.log("No pools found matching the criteria.");
        return;
    }
    // Display top results
    const displayPools = pools.slice(0, maxResults);
    console.log("\nTop Results:");
    console.log("─".repeat(100));
    console.log("Chain".padEnd(12) + "Project".padEnd(15) + "Symbol".padEnd(20) + "TVL".padEnd(12) + "APY".padEnd(8) + "Stablecoin");
    console.log("─".repeat(100));
    for (const pool of displayPools) {
        const chain = pool.chain.padEnd(12);
        const project = pool.project.padEnd(15);
        const symbol = pool.symbol.padEnd(20);
        const tvl = formatNumber(pool.tvlUsd).padEnd(12);
        const apy = `${(pool.apy || 0).toFixed(2)}%`.padEnd(8);
        const stablecoin = pool.stablecoin ? "Yes" : "No";
        console.log(`${chain}${project}${symbol}${tvl}${apy}${stablecoin}`);
    }
    if (pools.length > maxResults) {
        console.log(`... and ${pools.length - maxResults} more pools`);
    }
}
/**
 * Measure and display query performance
 */
async function timeQuery(queryName, queryFn) {
    console.log(`\n🔍 Executing: ${queryName}`);
    const startTime = Date.now();
    try {
        const result = await queryFn();
        const endTime = Date.now();
        const duration = endTime - startTime;
        console.log(`⏱️  Query completed in ${duration}ms`);
        return result;
    }
    catch (error) {
        console.error(`❌ Query failed: ${error}`);
        throw error;
    }
}
/**
 * Demonstrate basic filtering capabilities
 */
async function demoBasicFilters(crud) {
    console.log("\n" + "=".repeat(60));
    console.log("🔍 BASIC FILTERING DEMONSTRATIONS");
    console.log("=".repeat(60));
    // Query by chain
    const ethereumPools = await timeQuery("Query Ethereum pools", () => crud.queryPoolsByChain("Ethereum"));
    displayResults(ethereumPools, "Ethereum Pools", 5);
    // Query high TVL pools
    const highTvlPools = await timeQuery("Query pools with TVL > $10M", () => crud.queryHighTvlPools(10000000));
    displayResults(highTvlPools, "High TVL Pools (>$10M)", 5);
    // Query by APY range
    const midApyPools = await timeQuery("Query pools with 5-15% APY", () => crud.queryPoolsByApyRange(5.0, 15.0));
    displayResults(midApyPools, "Mid APY Pools (5-15%)", 5);
    // Query stablecoin pools
    const stablecoinPools = await timeQuery("Query stablecoin pools only", () => crud.queryStablecoinPools());
    displayResults(stablecoinPools, "Stablecoin Pools", 5);
}
/**
 * Demonstrate advanced filtering capabilities
 */
async function demoAdvancedFilters(crud) {
    const enhanced = new enhanced_queries_1.EnhancedPoolQueries(crud);
    console.log("\n" + "=".repeat(60));
    console.log("🚀 ADVANCED FILTERING DEMONSTRATIONS");
    console.log("=".repeat(60));
    // Multi-criteria advanced query
    const advancedPools = await timeQuery("Advanced multi-criteria query", () => enhanced.queryPoolsAdvanced({
        minTvl: 1000000, // Min $1M TVL
        maxTvl: 100000000, // Max $100M TVL
        minApy: 3.0, // Min 3% APY
        maxApy: 20.0, // Max 20% APY
        chains: ["Ethereum", "Polygon"],
        stablecoinOnly: true
        // excludeOutliers: true  // Not supported in current GolemDB version
    }));
    displayResults(advancedPools, "Advanced Criteria: $1M-$100M TVL, 3-20% APY, ETH/Polygon, Stablecoins", 8);
    // Top pools by TVL
    const topTvlPools = await timeQuery("Top 5 pools by TVL", () => enhanced.queryTopPoolsByMetric('tvlUsd', 5));
    displayResults(topTvlPools, "Top 5 Pools by TVL", 5);
    // Top pools by APY
    const topApyPools = await timeQuery("Top 5 pools by APY", () => enhanced.queryTopPoolsByMetric('apy', 5));
    displayResults(topApyPools, "Top 5 Pools by APY", 5);
    // Percentile-based query
    const top10PercentPools = await timeQuery("Top 10% pools by TVL", () => enhanced.queryPoolsByPercentile('tvlUsd', 90));
    displayResults(top10PercentPools, "Top 10% Pools by TVL (90th Percentile)", 5);
    // Reliable pools query
    const reliablePools = await timeQuery("Reliable pools (>200 data points)", () => enhanced.queryReliablePools(200));
    displayResults(reliablePools, "Reliable Pools (>200 data points)", 5);
}
/**
 * Demonstrate statistical analysis
 */
async function demoStatisticalAnalysis(crud) {
    const enhanced = new enhanced_queries_1.EnhancedPoolQueries(crud);
    console.log("\n" + "=".repeat(60));
    console.log("📊 STATISTICAL ANALYSIS");
    console.log("=".repeat(60));
    const stats = await timeQuery("Calculate pool statistics", () => enhanced.getPoolStatistics());
    console.log(`\n📈 Overall Statistics:`);
    console.log(`Total Pools: ${stats.totalPools}`);
    console.log(`Total TVL: ${formatNumber(stats.totalTvl)}`);
    console.log(`Average APY: ${stats.averageApy.toFixed(2)}%`);
    console.log(`Stablecoin Percentage: ${stats.stablecoinPercentage.toFixed(1)}%`);
    console.log(`\n🏗️ Chain Distribution:`);
    const sortedChains = Object.entries(stats.chainDistribution)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);
    for (const [chain, count] of sortedChains) {
        const percentage = ((count / stats.totalPools) * 100).toFixed(1);
        console.log(`  ${chain.padEnd(15)}: ${count.toString().padEnd(3)} pools (${percentage}%)`);
    }
    console.log(`\n🛠️ Project Distribution:`);
    const sortedProjects = Object.entries(stats.projectDistribution)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);
    for (const [project, count] of sortedProjects) {
        const percentage = ((count / stats.totalPools) * 100).toFixed(1);
        console.log(`  ${project.padEnd(15)}: ${count.toString().padEnd(3)} pools (${percentage}%)`);
    }
}
/**
 * Demonstrate complex custom queries
 */
async function demoCustomQueries(crud) {
    console.log("\n" + "=".repeat(60));
    console.log("🎯 CUSTOM QUERY EXAMPLES");
    console.log("=".repeat(60));
    // Custom query 1: High-yield Ethereum stablecoin pools
    const customQuery1 = await timeQuery('Custom: High-yield Ethereum stablecoin pools', () => crud.queryPools('chain = "Ethereum" && stablecoin = 1 && apy >= 500 && tvlUsd >= 1000000'));
    displayResults(customQuery1, 'High-yield Ethereum Stablecoin Pools (>5% APY, >$1M TVL)', 5);
    // Custom query 2: Cross-chain Uniswap pools
    const customQuery2 = await timeQuery('Custom: Cross-chain Uniswap V3 pools', () => crud.queryPools('project = "uniswap-v3" && tvlUsd >= 500000'));
    displayResults(customQuery2, 'Uniswap V3 Pools (>$500K TVL)', 5);
    // Custom query 3: Curve pools with high data reliability
    const customQuery3 = await timeQuery('Custom: Reliable Curve pools', () => crud.queryPools('project = "curve-dex" && count >= 300 && tvlUsd >= 1000000'));
    displayResults(customQuery3, 'Reliable Curve Pools (>300 data points, >$1M TVL)', 5);
}
/**
 * Interactive demonstration of pool loading and querying
 */
async function demoDataLoading(crud) {
    console.log("\n" + "=".repeat(60));
    console.log("💾 DATA LOADING DEMONSTRATION");
    console.log("=".repeat(60));
    // Check if we have existing pools
    const existingPools = await timeQuery("Check existing pools in database", () => crud.queryPools('tvlUsd > 0'));
    console.log(`\n📊 Current database state: ${existingPools.length} pools`);
    if (existingPools.length === 0) {
        console.log("\n🔄 No pools found. Loading sample data from CSV...");
        try {
            // Load and create sample pools
            console.log("📖 Loading pools from CSV file...");
            const poolsData = (0, defi_pool_crud_1.loadPoolsFromCsv)("defi_llama_pools_by_tvl.csv");
            console.log(`✅ Loaded ${poolsData.length} pools from CSV`);
            // Create a subset for demo (to avoid long loading times)
            const samplePools = poolsData.slice(0, 10);
            console.log(`\n🚀 Creating ${samplePools.length} sample pools in database...`);
            const simplifiedPools = samplePools.map(pool => ({
                chain: pool.chain,
                project: pool.project,
                symbol: pool.symbol,
                tvlUsd: pool.tvlUsd,
                apy: pool.apy,
                stablecoin: pool.stablecoin,
                count: pool.count
            }));
            const entityKeys = await crud.createPoolsBatch(simplifiedPools, 5);
            console.log(`✅ Successfully created ${entityKeys.length} pools`);
            // Wait a moment for data to be indexed
            console.log("⏳ Waiting for data to be indexed...");
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        catch (error) {
            console.error(`❌ Error loading data: ${error}`);
            console.log("\n⚠️  Demo will continue with empty dataset. Some queries may return no results.");
        }
    }
    else {
        console.log("✅ Found existing pools. Proceeding with demonstrations...");
    }
}
/**
 * Main demonstration function
 */
async function main() {
    console.log("🎯 GolemDB DeFi Pool Query Demonstration");
    console.log("==========================================");
    console.log("This demo showcases advanced querying capabilities for DeFi pool data");
    console.log("stored in GolemDB with comprehensive number filtering options.\n");
    try {
        // Initialize client and CRUD operations
        console.log("🔧 Initializing GolemDB client...");
        const client = await (0, defi_pool_crud_1.initializeClient)();
        const crud = new defi_pool_crud_1.DeFiPoolCRUD(client);
        console.log("✅ Connected to GolemDB successfully!");
        // Demonstrate data loading
        await demoDataLoading(crud);
        // Run all demonstrations
        await demoBasicFilters(crud);
        await demoAdvancedFilters(crud);
        await demoStatisticalAnalysis(crud);
        await demoCustomQueries(crud);
        console.log("\n" + "=".repeat(60));
        console.log("✅ DEMONSTRATION COMPLETED SUCCESSFULLY!");
        console.log("=".repeat(60));
        console.log("\n🎉 All query demonstrations have been completed!");
        console.log("📚 Check the query_instructions.md file for detailed API documentation.");
        console.log("🔧 Use the npm scripts to run specific query types:");
        console.log("   • npm run demo-queries    - Run this full demonstration");
        console.log("   • npm run load-fresh-data - Load fresh data from DeFi Llama");
        console.log("   • npm run advanced-queries - Run advanced filtering examples");
    }
    catch (error) {
        console.error("❌ Demo failed:", error);
        process.exit(1);
    }
    finally {
        // Clean exit
        process.exit(0);
    }
}
// Run if this file is executed directly
if (require.main === module) {
    main().catch((error) => {
        console.error("Demo error:", error);
        process.exit(1);
    });
}
