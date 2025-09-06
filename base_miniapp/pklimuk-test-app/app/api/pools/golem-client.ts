import { 
  createClient, 
  type GolemBaseClient,
  Tagged
} from "golem-base-sdk";
import { Logger, ILogObj } from "tslog";

const logger = new Logger<ILogObj>({ 
  name: "GolemDB Client",
  minLevel: 3 // Info level
});

export interface PoolData {
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

let clientInstance: GolemBaseClient | null = null;

async function initializeGolemClient(): Promise<GolemBaseClient | null> {
  try {
    const PRIVATE_KEY = process.env.PRIVATE_KEY || process.env.GOLEM_PRIVATE_KEY;
    
    if (!PRIVATE_KEY) {
      console.warn("No PRIVATE_KEY found for GolemDB connection");
      return null;
    }

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
  } catch (error) {
    console.warn("Failed to connect to GolemDB:", error);
    return null;
  }
}

function convertBackToOriginalValues(data: PoolData): PoolData {
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

export async function getPoolsFromGolemDB(): Promise<PoolData[] | null> {
  try {
    if (!clientInstance) {
      clientInstance = await initializeGolemClient();
    }
    
    if (!clientInstance) {
      return null;
    }

    console.log("Querying GolemDB for DeFi pools...");
    const results = await clientInstance.queryEntities('type = "defi_pool"');
    
    if (results.length === 0) {
      console.log("No pools found in GolemDB");
      return null;
    }

    console.log(`Found ${results.length} pools in GolemDB`);
    
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
  } catch (error) {
    console.warn("Error fetching from GolemDB:", error);
    return null;
  }
}