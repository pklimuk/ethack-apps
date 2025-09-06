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
  name: "GolemDB Example",
  minLevel: logLevelMap[process.env.LOG_LEVEL as keyof typeof logLevelMap] || logLevelMap.info
});

async function main() {
  // 1. INITIALIZE CLIENT
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

  // Set up real-time event watching
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
  
  // 2. CREATE - Single entity with annotations
  const id = randomUUID();
  const entity: GolemBaseCreate = {
    data: new TextEncoder().encode(JSON.stringify({
      message: "Hello from ETHWarsaw 2025!",
      timestamp: Date.now(),
      author: "Developer"
    })),
    btl: 300, // ~10 minutes (300 blocks * 2 seconds = 600 seconds)
    stringAnnotations: [
      new Annotation("type", "message"),
      new Annotation("event", "ethwarsaw"),
      new Annotation("id", id)
    ],
    numericAnnotations: [
      new Annotation("version", 1),
      new Annotation("timestamp", Date.now())
    ]
  };
  
  const createReceipts = await client.createEntities([entity]);
  const entityKey = createReceipts[0].entityKey;
  console.log(`Created entity: ${entityKey}`);
  
  // 3. QUERY - Find entity by annotations
  const queryResults = await client.queryEntities(`id = "${id}" && version = 1`);
  console.log(`Found ${queryResults.length} matching entities`);
  
  for (const result of queryResults) {
    const data = JSON.parse(new TextDecoder().decode(result.storageValue));
    console.log("Query result:", data);
  }
  
  // 4. UPDATE - Modify existing entity
  const updateData: GolemBaseUpdate = {
    entityKey: entityKey,
    data: new TextEncoder().encode(JSON.stringify({
      message: "Updated message from ETHWarsaw!",
      updated: true,
      updateTime: Date.now()
    })),
    btl: 600, // ~20 minutes (600 blocks * 2 seconds = 1200 seconds)
    stringAnnotations: [
      new Annotation("type", "message"),
      new Annotation("id", id),
      new Annotation("status", "updated")
    ],
    numericAnnotations: [
      new Annotation("version", 2)
    ]
  };
  
  const updateReceipts = await client.updateEntities([updateData]);
  console.log(`Updated entity: ${updateReceipts[0].entityKey}`);
  
  // 5. QUERY updated entity
  const updatedResults = await client.queryEntities(`id = "${id}" && version = 2`);
  console.log(`Found ${updatedResults.length} updated entities`);
  
  // 6. BATCH OPERATIONS - Create multiple entities
  const batchEntities: GolemBaseCreate[] = [];
  for (let i = 0; i < 5; i++) {
    batchEntities.push({
      data: new TextEncoder().encode(`Batch message ${i}`),
      btl: 100,
      stringAnnotations: [
        new Annotation("type", "batch"),
        new Annotation("index", i.toString())
      ],
      numericAnnotations: [
        new Annotation("sequence", i + 1)  // Start from 1, not 0 (SDK bug with value 0)
      ]
    });
  }
  
  const batchReceipts = await client.createEntities(batchEntities);
  console.log(`Created ${batchReceipts.length} entities in batch`);
  
  // 7. BTL MANAGEMENT - Extend entity lifetime
  const extendReceipts = await client.extendEntities([{
    entityKey: entityKey,
    numberOfBlocks: 100
  }]);
  console.log(`Extended BTL to block: ${extendReceipts[0].newExpirationBlock}`);
  
  // Check metadata to verify BTL
  const metadata = await client.getEntityMetaData(entityKey);
  console.log(`Entity expires at block: ${metadata.expiresAtBlock}`);
  
  // 8. DELETE - Remove entity
  const deleteReceipts = await client.deleteEntities([entityKey]);
  console.log(`Deleted entity: ${deleteReceipts[0].entityKey}`);
  
  // Clean up batch entities
  for (const receipt of batchReceipts) {
    await client.deleteEntities([receipt.entityKey]);
  }
  
  // Stop watching events
  unsubscribe();
  console.log("Complete!");
  
  // Clean exit
  process.exit(0);
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});