import { 
  createClient, 
  type GolemBaseClient,
  Tagged
} from "golem-base-sdk";
import { Logger, ILogObj } from "tslog";
import * as dotenv from "dotenv";

dotenv.config();

const logger = new Logger<ILogObj>({ name: "Table Returner" });

interface PoolData {
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apyBase: number;
  apyReward: number;
  apy: number;
  rewardTokens: string;
  pool: string;
  apyPct1D: number;
  apyPct7D: number;
  apyPct30D: number;
  stablecoin: boolean;
  ilRisk: string;
  exposure: string;
  predictions: string;
  poolMeta: string;
  mu: number;
  sigma: number;
  count: number;
  outlier: boolean;
  underlyingTokens: string;
  il7d: number;
  apyBase7d: number;
  apyMean30d: number;
  volumeUsd1d: number;
  volumeUsd7d: number;
  apyBaseInception: number;
}

async function initializeClient(): Promise<GolemBaseClient> {
  const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x...";
  const privateKeyHex = PRIVATE_KEY.replace(/^0x/, "");
  const privateKey = new Uint8Array(
    privateKeyHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
  );
  
  const client = await createClient(
    60138453033,
    new Tagged("privatekey", privateKey),
    "https://ethwarsaw.holesky.golemdb.io/rpc",
    "wss://ethwarsaw.holesky.golemdb.io/rpc/ws",
    logger
  );
  
  console.log("Connected to Golem DB!");
  return client;
}

function convertBackToOriginalValues(data: any): PoolData {
  return {
    chain: data.chain || '',
    project: data.project || '',
    symbol: data.symbol || '',
    tvlUsd: data.tvlUsd || 0,
    apyBase: data.apyBase || 0,
    apyReward: data.apyReward || 0,
    apy: data.apy || 0,
    rewardTokens: data.rewardTokens || '',
    pool: data.pool || '',
    apyPct1D: data.apyPct1D || 0,
    apyPct7D: data.apyPct7D || 0,
    apyPct30D: data.apyPct30D || 0,
    stablecoin: data.stablecoin || false,
    ilRisk: data.ilRisk || '',
    exposure: data.exposure || '',
    predictions: data.predictions || '',
    poolMeta: data.poolMeta || '',
    mu: data.mu || 0,
    sigma: data.sigma || 0,
    count: data.count || 0,
    outlier: data.outlier || false,
    underlyingTokens: data.underlyingTokens || '',
    il7d: data.il7d || 0,
    apyBase7d: data.apyBase7d || 0,
    apyMean30d: data.apyMean30d || 0,
    volumeUsd1d: data.volumeUsd1d || 0,
    volumeUsd7d: data.volumeUsd7d || 0,
    apyBaseInception: data.apyBaseInception || 0
  };
}

async function getPoolsTable(): Promise<PoolData[]> {
  const client = await initializeClient();
  
  console.log("Querying all DeFi pools...");
  const results = await client.queryEntities('type = "defi_pool"');
  
  console.log(`Found ${results.length} pools`);
  
  const pools: PoolData[] = [];
  
  for (const result of results) {
    try {
      const data = JSON.parse(new TextDecoder().decode(result.storageValue));
      const pool = convertBackToOriginalValues(data);
      pools.push(pool);
    } catch (error) {
      console.warn(`Failed to parse pool data: ${error}`);
    }
  }
  
  return pools;
}

function printTable(pools: PoolData[]): void {
  if (pools.length === 0) {
    console.log("No pools found");
    return;
  }

  console.log("\n=== DeFi Pools Table ===");
  console.log(`Found ${pools.length} pools\n`);
  
  console.table(pools.map(pool => ({
    Chain: pool.chain,
    Project: pool.project,
    Symbol: pool.symbol,
    "TVL (USD)": pool.tvlUsd?.toLocaleString() || "0",
    "APY %": pool.apy?.toFixed(2) || "0.00",
    "APY Base %": pool.apyBase?.toFixed(2) || "0.00",
    "APY Reward %": pool.apyReward?.toFixed(2) || "0.00",
    "Volume 1D": pool.volumeUsd1d?.toLocaleString() || "0",
    "Volume 7D": pool.volumeUsd7d?.toLocaleString() || "0",
    Stablecoin: pool.stablecoin ? "Yes" : "No",
    Outlier: pool.outlier ? "Yes" : "No",
    Pool: pool.pool || "",
    "IL Risk": pool.ilRisk || "",
    Exposure: pool.exposure || ""
  })));
}

function getPoolsAsApiResponse(
  pools: PoolData[], 
  page: number = 1, 
  limit: number = 100,
  search: string = '',
  chain: string = '',
  project: string = '',
  sortBy: keyof PoolData = 'tvlUsd',
  sortOrder: 'asc' | 'desc' = 'desc'
) {
  let filteredPools = [...pools];

  // Filter by search term
  if (search) {
    const searchLower = search.toLowerCase();
    filteredPools = filteredPools.filter(pool => 
      pool.symbol?.toLowerCase().includes(searchLower) ||
      pool.project?.toLowerCase().includes(searchLower) ||
      pool.chain?.toLowerCase().includes(searchLower)
    );
  }

  // Filter by chain
  if (chain) {
    filteredPools = filteredPools.filter(pool => pool.chain === chain);
  }

  // Filter by project
  if (project) {
    filteredPools = filteredPools.filter(pool => pool.project === project);
  }

  // Sort data
  filteredPools.sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];
    
    if (typeof aVal === 'string') aVal = aVal.toLowerCase();
    if (typeof bVal === 'string') bVal = bVal.toLowerCase();
    
    if (sortOrder === 'asc') {
      return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    } else {
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
    }
  });

  // Pagination
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedPools = filteredPools.slice(startIndex, endIndex);

  // Get unique values for filters
  const uniqueChains = [...new Set(pools.map(p => p.chain))].filter(Boolean).sort();
  const uniqueProjects = [...new Set(pools.map(p => p.project))].filter(Boolean).sort();

  return {
    pools: paginatedPools,
    totalCount: filteredPools.length,
    totalPages: Math.ceil(filteredPools.length / limit),
    currentPage: page,
    limit,
    filters: {
      chains: uniqueChains,
      projects: uniqueProjects
    }
  };
}

async function main(): Promise<void> {
  try {
    const pools = await getPoolsTable();
    
    // Print table format
    printTable(pools);
    
    console.log(`\nTotal pools retrieved: ${pools.length}`);
    
    // Also output as JSON API format (like base miniapp)
    const apiResponse = getPoolsAsApiResponse(pools);
    console.log('\n=== API Response Format ===');
    console.log(JSON.stringify(apiResponse, null, 2));
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    process.exit(0);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
}

export { getPoolsTable, printTable, getPoolsAsApiResponse, PoolData };