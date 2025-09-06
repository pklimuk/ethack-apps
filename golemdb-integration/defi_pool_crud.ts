import { 
  createClient, 
  type GolemBaseClient,
  type GolemBaseCreate,
  type GolemBaseUpdate,
  Annotation,
  Tagged
} from "golem-base-sdk";
import { randomUUID } from "crypto";
import { Logger, ILogObj } from "tslog";
import * as dotenv from "dotenv";
import * as fs from "fs";

// Load environment variables
dotenv.config();

// Configure logger
const logLevelMap: Record<string, number> = {
  silly: 0,
  trace: 1,
  debug: 2,
  info: 3,
  warn: 4,
  error: 5,
  fatal: 6
};

const logger = new Logger<ILogObj>({
  name: "DeFi Pool CRUD",
  minLevel: logLevelMap[process.env.LOG_LEVEL as keyof typeof logLevelMap] || logLevelMap.info
});

// DeFi Pool data interface matching CSV format
interface DeFiPoolData {
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apyBase?: number;
  apyReward?: number;
  apy?: number;
  rewardTokens?: string;
  pool?: string;
  apyPct1D?: number;
  apyPct7D?: number;
  apyPct30D?: number;
  stablecoin?: boolean;
  ilRisk?: string;
  exposure?: string;
  predictions?: string;
  poolMeta?: string;
  mu?: number;
  sigma?: number;
  count?: number;
  outlier?: boolean;
  underlyingTokens?: string;
  il7d?: number;
  apyBase7d?: number;
  apyMean30d?: number;
  volumeUsd1d?: number;
  volumeUsd7d?: number;
  apyBaseInception?: number;
}

// Extended interface with metadata
interface DeFiPoolEntity extends DeFiPoolData {
  poolId: string;
  createdAt: string;
  updatedAt?: string;
  entityKey?: string;
}

class DeFiPoolCRUD {
  private client: GolemBaseClient;
  private readonly poolType = "defi_pool";

  constructor(client: GolemBaseClient) {
    this.client = client;
  }

  /**
   * Create a single DeFi pool entity
   */
  async createPool(poolData: DeFiPoolData, btl: number = 1000000): Promise<string> {
    const poolId = randomUUID();
    
    const entityData: DeFiPoolEntity = {
      ...poolData,
      poolId,
      createdAt: Math.floor(Date.now() / 1000).toString()
    };

    // Create string annotations
    const stringAnnotations: Annotation<string>[] = [
      new Annotation("type", this.poolType),
      new Annotation("pool_id", poolId),
      new Annotation("chain", poolData.chain),
      new Annotation("project", poolData.project),
      new Annotation("symbol", poolData.symbol),
    ];

    // Add optional string annotations
    if (poolData.rewardTokens) {
      stringAnnotations.push(new Annotation("rewardTokens", poolData.rewardTokens));
    }
    if (poolData.pool) {
      stringAnnotations.push(new Annotation("pool", poolData.pool));
    }
    if (poolData.exposure) {
      stringAnnotations.push(new Annotation("exposure", poolData.exposure));
    }
    if (poolData.underlyingTokens) {
      stringAnnotations.push(new Annotation("underlyingTokens", poolData.underlyingTokens));
    }
    if (poolData.ilRisk) {
      stringAnnotations.push(new Annotation("ilRisk", poolData.ilRisk));
    }

    // Create numeric annotations (storing floats as integers to avoid precision issues)
    const numericAnnotations: Annotation<number>[] = [
      new Annotation("tvlUsd", Math.round(poolData.tvlUsd * 100)), // Store as cents
      new Annotation("created_timestamp", Math.floor(Date.now() / 1000)),
    ];

    // Add optional numeric annotations (skip zero/negative values to avoid RLP encoding issues)
    if (poolData.apyBase !== undefined && poolData.apyBase !== null && poolData.apyBase > 0) {
      const apyBaseValue = Math.round(poolData.apyBase * 10000);
      if (apyBaseValue > 0) {
        numericAnnotations.push(new Annotation("apyBase", apyBaseValue)); // Store as basis points
      }
    }
    if (poolData.apyReward !== undefined && poolData.apyReward !== null && poolData.apyReward > 0) {
      const apyRewardValue = Math.round(poolData.apyReward * 10000);
      if (apyRewardValue > 0) {
        numericAnnotations.push(new Annotation("apyReward", apyRewardValue));
      }
    }
    if (poolData.apy !== undefined && poolData.apy !== null && poolData.apy > 0) {
      const apyValue = Math.round(poolData.apy * 10000);
      if (apyValue > 0) {
        numericAnnotations.push(new Annotation("apy", apyValue));
      }
    }
    if (poolData.volumeUsd1d !== undefined && poolData.volumeUsd1d !== null) {
      numericAnnotations.push(new Annotation("volumeUsd1d", Math.round(poolData.volumeUsd1d * 100)));
    }
    if (poolData.volumeUsd7d !== undefined && poolData.volumeUsd7d !== null) {
      numericAnnotations.push(new Annotation("volumeUsd7d", Math.round(poolData.volumeUsd7d * 100)));
    }
    if (poolData.count !== undefined && poolData.count !== null) {
      numericAnnotations.push(new Annotation("count", poolData.count));
    }
    if (poolData.stablecoin !== undefined && poolData.stablecoin !== null && poolData.stablecoin) {
      numericAnnotations.push(new Annotation("stablecoin", 1)); // Only add if true
    }
    if (poolData.outlier !== undefined && poolData.outlier !== null && poolData.outlier) {
      numericAnnotations.push(new Annotation("outlier", 1)); // Only add if true
    }

    // Create entity
    const entity: GolemBaseCreate = {
      data: new TextEncoder().encode(JSON.stringify(entityData)),
      btl,
      stringAnnotations,
      numericAnnotations
    };

    const createReceipts = await this.client.createEntities([entity]);
    logger.info(`Created pool: ${poolData.symbol} on ${poolData.chain} - ${createReceipts[0].entityKey}`);
    
    return createReceipts[0].entityKey;
  }

  /**
   * Create multiple pools in batches
   */
  async createPoolsBatch(poolsData: DeFiPoolData[], batchSize: number = 10, btl: number = 1000000): Promise<string[]> {
    const allEntityKeys: string[] = [];
    
    for (let batchStart = 0; batchStart < poolsData.length; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize, poolsData.length);
      const batchPools = poolsData.slice(batchStart, batchEnd);
      
      const entities: GolemBaseCreate[] = [];
      
      for (const poolData of batchPools) {
        const poolId = randomUUID();
        
        const entityData: DeFiPoolEntity = {
          ...poolData,
          poolId,
          createdAt: new Date().toISOString()
        };

        // Create annotations (same logic as createPool)
        const stringAnnotations: Annotation<string>[] = [
          new Annotation("type", this.poolType),
          new Annotation("pool_id", poolId),
          new Annotation("chain", poolData.chain),
          new Annotation("project", poolData.project),
          new Annotation("symbol", poolData.symbol),
        ];

        if (poolData.rewardTokens) stringAnnotations.push(new Annotation("rewardTokens", poolData.rewardTokens));
        if (poolData.pool) stringAnnotations.push(new Annotation("pool", poolData.pool));
        if (poolData.exposure) stringAnnotations.push(new Annotation("exposure", poolData.exposure));
        if (poolData.underlyingTokens) stringAnnotations.push(new Annotation("underlyingTokens", poolData.underlyingTokens));
        if (poolData.ilRisk) stringAnnotations.push(new Annotation("ilRisk", poolData.ilRisk));

        const numericAnnotations: Annotation<number>[] = [
          new Annotation("tvlUsd", Math.round(poolData.tvlUsd * 100)),
          new Annotation("created_timestamp", Math.floor(Date.now() / 1000)),
        ];

        if (poolData.apyBase !== undefined && poolData.apyBase !== null && poolData.apyBase > 0) {
          const apyBaseValue = Math.round(poolData.apyBase * 10000);
          if (apyBaseValue > 0) {
            numericAnnotations.push(new Annotation("apyBase", apyBaseValue));
          }
        }
        if (poolData.apyReward !== undefined && poolData.apyReward !== null && poolData.apyReward > 0) {
          const apyRewardValue = Math.round(poolData.apyReward * 10000);
          if (apyRewardValue > 0) {
            numericAnnotations.push(new Annotation("apyReward", apyRewardValue));
          }
        }
        if (poolData.apy !== undefined && poolData.apy !== null && poolData.apy > 0) {
          const apyValue = Math.round(poolData.apy * 10000);
          if (apyValue > 0) {
            numericAnnotations.push(new Annotation("apy", apyValue));
          }
        }
        if (poolData.volumeUsd1d !== undefined && poolData.volumeUsd1d !== null) {
          numericAnnotations.push(new Annotation("volumeUsd1d", Math.round(poolData.volumeUsd1d * 100)));
        }
        if (poolData.volumeUsd7d !== undefined && poolData.volumeUsd7d !== null) {
          numericAnnotations.push(new Annotation("volumeUsd7d", Math.round(poolData.volumeUsd7d * 100)));
        }
        if (poolData.count !== undefined && poolData.count !== null) {
          numericAnnotations.push(new Annotation("count", poolData.count));
        }
        if (poolData.stablecoin !== undefined && poolData.stablecoin !== null && poolData.stablecoin) {
          numericAnnotations.push(new Annotation("stablecoin", 1)); // Only add if true
        }
        if (poolData.outlier !== undefined && poolData.outlier !== null && poolData.outlier) {
          numericAnnotations.push(new Annotation("outlier", 1)); // Only add if true
        }

        const entity: GolemBaseCreate = {
          data: new TextEncoder().encode(JSON.stringify(entityData)),
          btl,
          stringAnnotations,
          numericAnnotations
        };
        
        entities.push(entity);
      }
      
      console.log(`Creating batch ${Math.floor(batchStart / batchSize) + 1}: ${entities.length} pools`);
      const receipts = await this.client.createEntities(entities);
      const batchKeys = receipts.map(receipt => receipt.entityKey);
      allEntityKeys.push(...batchKeys);
      
      console.log(`Created ${batchKeys.length} pools in batch`);
    }
    
    return allEntityKeys;
  }

  /**
   * Query pools with custom filter
   */
  async queryPools(queryFilter: string): Promise<DeFiPoolEntity[]> {
    const startTime = Date.now();
    const results = await this.client.queryEntities(`type = "${this.poolType}" && ${queryFilter}`);
    const queryTime = Date.now() - startTime;
    
    console.log(`Query completed in ${queryTime}ms - Found ${results.length} pools`);
    
    const pools: DeFiPoolEntity[] = [];
    for (const result of results) {
      const data = JSON.parse(new TextDecoder().decode(result.storageValue)) as DeFiPoolEntity;
      data.entityKey = result.entityKey;
      pools.push(data);
    }
    
    return pools;
  }

  /**
   * Query pools by blockchain
   */
  async queryPoolsByChain(chain: string): Promise<DeFiPoolEntity[]> {
    return this.queryPools(`chain = "${chain}"`);
  }

  /**
   * Query pools by project name
   */
  async queryPoolsByProject(project: string): Promise<DeFiPoolEntity[]> {
    return this.queryPools(`project = "${project}"`);
  }

  /**
   * Query pools by TVL range
   */
  async queryPoolsByTvlRange(minTvl: number, maxTvl: number): Promise<DeFiPoolEntity[]> {
    const minTvlCents = Math.round(minTvl * 100);
    const maxTvlCents = Math.round(maxTvl * 100);
    return this.queryPools(`tvlUsd >= ${minTvlCents} && tvlUsd <= ${maxTvlCents}`);
  }

  /**
   * Query pools by APY range
   */
  async queryPoolsByApyRange(minApy: number, maxApy: number): Promise<DeFiPoolEntity[]> {
    const minApyBp = Math.round(minApy * 10000);
    const maxApyBp = Math.round(maxApy * 10000);
    return this.queryPools(`apy >= ${minApyBp} && apy <= ${maxApyBp}`);
  }

  /**
   * Query pools with high TVL (default > $1M)
   */
  async queryHighTvlPools(minTvl: number = 1000000): Promise<DeFiPoolEntity[]> {
    const minTvlCents = Math.round(minTvl * 100);
    return this.queryPools(`tvlUsd >= ${minTvlCents}`);
  }

  /**
   * Query stablecoin pools only
   */
  async queryStablecoinPools(): Promise<DeFiPoolEntity[]> {
    return this.queryPools('stablecoin = 1');
  }

  /**
   * Update an existing pool
   */
  async updatePool(entityKey: string, updatedData: Partial<DeFiPoolData>, btl: number = 1000000): Promise<string> {
    // Get current pool data
    const allResults = await this.client.queryEntities(`type = "${this.poolType}"`);
    let currentPool: DeFiPoolEntity | null = null;
    
    for (const result of allResults) {
      if (result.entityKey === entityKey) {
        currentPool = JSON.parse(new TextDecoder().decode(result.storageValue)) as DeFiPoolEntity;
        break;
      }
    }
    
    if (!currentPool) {
      throw new Error(`Pool with entity_key ${entityKey} not found`);
    }

    // Merge updated data
    const mergedPool: DeFiPoolEntity = {
      ...currentPool,
      ...updatedData,
      updatedAt: new Date().toISOString()
    };

    // Create new annotations based on updated data
    const stringAnnotations: Annotation<string>[] = [
      new Annotation("type", this.poolType),
      new Annotation("pool_id", mergedPool.poolId),
      new Annotation("chain", mergedPool.chain),
      new Annotation("project", mergedPool.project),
      new Annotation("symbol", mergedPool.symbol),
    ];

    if (mergedPool.rewardTokens) stringAnnotations.push(new Annotation("rewardTokens", mergedPool.rewardTokens));
    if (mergedPool.pool) stringAnnotations.push(new Annotation("pool", mergedPool.pool));
    if (mergedPool.exposure) stringAnnotations.push(new Annotation("exposure", mergedPool.exposure));
    if (mergedPool.underlyingTokens) stringAnnotations.push(new Annotation("underlyingTokens", mergedPool.underlyingTokens));
    if (mergedPool.ilRisk) stringAnnotations.push(new Annotation("ilRisk", mergedPool.ilRisk));

    const numericAnnotations: Annotation<number>[] = [
      new Annotation("tvlUsd", Math.round(mergedPool.tvlUsd * 100)),
      new Annotation("updated_timestamp", Math.floor(Date.now() / 1000)),
    ];

    if (mergedPool.apyBase !== undefined && mergedPool.apyBase !== null && mergedPool.apyBase > 0) {
      numericAnnotations.push(new Annotation("apyBase", Math.round(mergedPool.apyBase * 10000)));
    }
    if (mergedPool.apyReward !== undefined && mergedPool.apyReward !== null && mergedPool.apyReward > 0) {
      numericAnnotations.push(new Annotation("apyReward", Math.round(mergedPool.apyReward * 10000)));
    }
    if (mergedPool.apy !== undefined && mergedPool.apy !== null && mergedPool.apy > 0) {
      numericAnnotations.push(new Annotation("apy", Math.round(mergedPool.apy * 10000)));
    }
    if (mergedPool.volumeUsd1d !== undefined && mergedPool.volumeUsd1d !== null) {
      numericAnnotations.push(new Annotation("volumeUsd1d", Math.round(mergedPool.volumeUsd1d * 100)));
    }
    if (mergedPool.volumeUsd7d !== undefined && mergedPool.volumeUsd7d !== null) {
      numericAnnotations.push(new Annotation("volumeUsd7d", Math.round(mergedPool.volumeUsd7d * 100)));
    }
    if (mergedPool.count !== undefined && mergedPool.count !== null) {
      numericAnnotations.push(new Annotation("count", mergedPool.count));
    }
    if (mergedPool.stablecoin !== undefined && mergedPool.stablecoin !== null) {
      numericAnnotations.push(new Annotation("stablecoin", mergedPool.stablecoin ? 1 : 0));
    }
    if (mergedPool.outlier !== undefined && mergedPool.outlier !== null) {
      numericAnnotations.push(new Annotation("outlier", mergedPool.outlier ? 1 : 0));
    }

    const updateEntity: GolemBaseUpdate = {
      entityKey: entityKey as `0x${string}`,
      data: new TextEncoder().encode(JSON.stringify(mergedPool)),
      btl,
      stringAnnotations,
      numericAnnotations
    };

    const receipts = await this.client.updateEntities([updateEntity]);
    logger.info(`Updated pool: ${mergedPool.symbol} - ${receipts[0].entityKey}`);
    
    return receipts[0].entityKey;
  }

  /**
   * Delete a single pool
   */
  async deletePool(entityKey: string): Promise<string> {
    const deleteReceipts = await this.client.deleteEntities([entityKey as `0x${string}`]);
    logger.info(`Deleted pool: ${deleteReceipts[0].entityKey}`);
    return deleteReceipts[0].entityKey;
  }

  /**
   * Delete pools matching a query
   */
  async deletePoolsByQuery(queryFilter: string): Promise<number> {
    const pools = await this.queryPools(queryFilter);
    
    if (pools.length === 0) {
      console.log("No pools found matching query");
      return 0;
    }
    
    const entityKeys = pools.map(pool => pool.entityKey!);
    
    // Delete in batches
    const batchSize = 10;
    let deletedCount = 0;
    
    for (let batchStart = 0; batchStart < entityKeys.length; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize, entityKeys.length);
      const batchKeys = entityKeys.slice(batchStart, batchEnd);
      
      const receipts = await this.client.deleteEntities(batchKeys as `0x${string}`[]);
      deletedCount += receipts.length;
      console.log(`Deleted batch: ${receipts.length} pools`);
    }
    
    return deletedCount;
  }

  /**
   * Delete all DeFi pool entities
   */
  async cleanAllPools(): Promise<number> {
    return this.deletePoolsByQuery('type = "defi_pool"');
  }
}

/**
 * Create and initialize GolemDB client
 */
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
  const ownerAddress = await client.getOwnerAddress();
  console.log(`Owner address: ${ownerAddress}`);

  // Get and check client account balance
  const balanceBigint = await client.getRawClient().httpClient.getBalance({ address: ownerAddress });
  const balance = Number(balanceBigint) / 10**18;
  console.log(`Client account balance: ${balance} ETH`);

  if (balance === 0) {
    console.warn("Warning: Account balance is 0 ETH. Please acquire test tokens from the faucet.");
  }

  return client;
}

/**
 * Load DeFi pools from CSV file
 */
function loadPoolsFromCsv(filePath: string): DeFiPoolData[] {
  const csvContent = fs.readFileSync(filePath, 'utf-8');
  const lines = csvContent.split('\n');
  const headers = lines[0].split(',');
  
  const pools: DeFiPoolData[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = line.split(',');
    const pool: any = {};
    
    headers.forEach((header, index) => {
      const value = values[index]?.trim();
      if (value && value !== '') {
        // Handle different data types
        if (header === 'tvlUsd' || header.includes('apy') || header.includes('volume') || 
            header.includes('mu') || header.includes('sigma') || header.includes('il7d')) {
          pool[header] = parseFloat(value) || 0;
        } else if (header === 'count') {
          pool[header] = parseInt(value) || 0;
        } else if (header === 'stablecoin' || header === 'outlier') {
          pool[header] = value.toLowerCase() === 'true';
        } else {
          pool[header] = value;
        }
      }
    });
    
    if (pool.chain && pool.project && pool.symbol && pool.tvlUsd !== undefined) {
      pools.push(pool as DeFiPoolData);
    }
  }
  
  return pools;
}

// Example usage functions

/**
 * Example: Create pools from CSV data
 */
async function exampleCreatePools(): Promise<string[]> {
  const client = await initializeClient();
  const crud = new DeFiPoolCRUD(client);
  
  console.log("Loading pools from CSV...");
  const poolsData = loadPoolsFromCsv("defi_llama_pools_by_tvl.csv");
  console.log(`Loaded ${poolsData.length} pools`);
  
  // Create all pools from CSV data with only essential fields
  const simplifiedPools: DeFiPoolData[] = poolsData.map(pool => ({
    chain: pool.chain,
    project: pool.project,
    symbol: pool.symbol,
    tvlUsd: pool.tvlUsd,
    apy: pool.apy,
    stablecoin: pool.stablecoin,
    // Only keep essential fields to avoid transaction size limits
  }));

  console.log(`Creating ${simplifiedPools.length} pools one at a time...`);
  const entityKeys = await crud.createPoolsBatch(simplifiedPools, 1); // Process one at a time
  console.log(`Created ${entityKeys.length} pools total`);
  
  return entityKeys;
}

/**
 * Example: Query pools with various filters
 */
async function exampleQueryPools(): Promise<DeFiPoolEntity[]> {
  const client = await initializeClient();
  const crud = new DeFiPoolCRUD(client);
  
  console.log("\n=== Query Examples ===");
  
  // Query by chain
  const ethereumPools = await crud.queryPoolsByChain("Ethereum");
  console.log(`Ethereum pools: ${ethereumPools.length}`);
  
  // Query high TVL pools
  const highTvlPools = await crud.queryHighTvlPools(1000000); // > $1M TVL
  console.log(`High TVL pools (>$1M): ${highTvlPools.length}`);
  
  // Query by APY range
  const highApyPools = await crud.queryPoolsByApyRange(10.0, 50.0); // 10-50% APY
  console.log(`High APY pools (10-50%): ${highApyPools.length}`);
  
  // Query stablecoin pools
  const stablecoinPools = await crud.queryStablecoinPools();
  console.log(`Stablecoin pools: ${stablecoinPools.length}`);
  
  // Custom query
  const customPools = await crud.queryPools('chain = "Ethereum" && tvlUsd >= 5000000000'); // Ethereum pools with >$50M TVL
  console.log(`Ethereum pools with >$50M TVL: ${customPools.length}`);
  
  return customPools;
}

/**
 * Example: Update pool data
 */
async function exampleUpdatePool(): Promise<void> {
  const client = await initializeClient();
  const crud = new DeFiPoolCRUD(client);
  
  // Find a pool to update
  const pools = await crud.queryPools('tvlUsd > 0');
  if (pools.length > 0) {
    const pool = pools[0];
    const entityKey = pool.entityKey!;
    
    console.log(`Updating pool: ${pool.symbol} on ${pool.chain}`);
    
    // Update TVL and APY
    await crud.updatePool(entityKey, {
      tvlUsd: pool.tvlUsd * 1.1, // Increase TVL by 10%
      apy: (pool.apy || 0) + 1.0, // Increase APY by 1%
    });
    
    console.log(`Updated pool: ${pool.symbol}`);
  } else {
    console.log("No pools found to update");
  }
}

/**
 * Example: Clean up all pools
 */
async function exampleCleanup(): Promise<void> {
  const client = await initializeClient();
  const crud = new DeFiPoolCRUD(client);
  
  const deletedCount = await crud.cleanAllPools();
  console.log(`Deleted ${deletedCount} pools`);
}

/**
 * Main function demonstrating full CRUD operations
 */
async function main(): Promise<void> {
  try {
    const client = await initializeClient();
    const crud = new DeFiPoolCRUD(client);

    // Set up real-time event watching (optional)
    const unsubscribe = client.watchLogs({
      fromBlock: BigInt(await client.getRawClient().httpClient.getBlockNumber()),
      onCreated: (args) => {
        console.log("WATCH-> Create:", args);
      },
      onUpdated: (args) => {
        console.log("WATCH-> Update:", args);
      },
      onExtended: (args) => {
        console.log("WATCH-> Extend:", args);
      },
      onDeleted: (args) => {
        console.log("WATCH-> Delete:", args);
      },
      onError: (error) => {
        console.error("WATCH-> Error:", error);
      },
      pollingInterval: 1000,
      transport: "websocket",
    });

    // Example usage - uncomment the operations you want to run
    
    await exampleCreatePools();
    // await exampleQueryPools();
    // await exampleUpdatePool();
    // await exampleCleanup();

    // Stop watching events
    unsubscribe();
    console.log("Complete!");

  } catch (error) {
    console.error("Error:", error);
  } finally {
    // Clean exit
    process.exit(0);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
}

export { 
  DeFiPoolCRUD, 
  DeFiPoolData, 
  DeFiPoolEntity, 
  initializeClient, 
  loadPoolsFromCsv,
  exampleCreatePools,
  exampleQueryPools,
  exampleUpdatePool,
  exampleCleanup
};