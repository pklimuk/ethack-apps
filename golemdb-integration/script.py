import os
import json
import time
import asyncio
import uuid
from dotenv import load_dotenv

from golem_base_sdk import (
    GolemBaseClient,
    GolemBaseCreate,
    GolemBaseUpdate,
    GolemBaseDelete,
    GenericBytes,
    Annotation
)
from tqdm import tqdm
import pandas as pd

load_dotenv()

PRIVATE_KEY = os.getenv('PRIVATESS_KEY', '0x0000000000000000000000000000000000000000000000000000000000000001')
RPC_URL = 'https://ethwarsaw.holesky.golemdb.io/rpc'
WS_URL = 'wss://ethwarsaw.holesky.golemdb.io/rpc/ws'



BASE_DATA_PATH = "/Users/antonmasiukevich/ethack-apps/scraper/tutorials/results.csv"

def load_data(path):

    df = pd.read_csv(path)
    return df


async def create_client():

    private_key_hex = PRIVATE_KEY.replace('0x', '')
    private_key_bytes = bytes.fromhex(private_key_hex)
    
    client = await GolemBaseClient.create(
        rpc_url=RPC_URL,
        ws_url=WS_URL,
        private_key=private_key_bytes
    )
    return client

client = asyncio.run(create_client())



async def main():

    print("Connected to Golem DB!")
    print(f"Address: {client.get_account_address()}")
    
    # === CREATE Operations ===
    print("\n=== CREATE Operations ===")
    
    # Create entity with unique ID
    BATCH_SIZE = 10

    full_data = load_data(BASE_DATA_PATH).to_dict('records')

    all_entity_keys = []
    
    # Process data in batches
    MAX_SIZE = len(full_data)  # Process all data
    entity_id = str(uuid.uuid4())  # Generate unique entity ID
    
    for batch_start in range(0, len(full_data[:MAX_SIZE]), BATCH_SIZE):
        batch_end = min(batch_start + BATCH_SIZE, len(full_data))
        batch_data = full_data[batch_start:batch_end]
        
        entities = []
        for i, data_point in enumerate(batch_data, start=batch_start):
            entity = GolemBaseCreate(
                data=json.dumps(data_point).encode('utf-8'),
                btl=1000000,
                string_annotations=[Annotation(key="json_id", value=f"{entity_id}_{i}")],
                numeric_annotations=[
                    Annotation(key="id", value=i)
                ]
            )
            entities.append(entity)
        
        print(f"Processing batch {batch_start//BATCH_SIZE + 1}: items {batch_start} to {batch_end-1}")
        data_points = await client.create_entities(entities)
        batch_entity_keys = [data_point.entity_key for data_point in data_points]
        all_entity_keys.extend(batch_entity_keys)
        
        print(f"Created {len(batch_entity_keys)} entities in this batch")

    print(f"Total created entities: {all_entity_keys}")


async def query_data(id):
    import time
    first = time.time()
    results = await client.query_entities(f'json_id ="{entity_id}_{id}"')
    second = time.time()

    print(second - first, "sec")
    print(f"Found {len(results)} entities")
    
    for result in results:
        data = json.loads(result.storage_value.decode('utf-8'))
        print(f"  Entity: {data}")


async def clean_db():
    print("Cleaning database - looking for entities with json_id annotations...")
    
    # Query all entities that have json_id annotation
    results = await client.query_entities('json_id != ""')
    print(f"Found {len(results)} entities with json_id to delete")
    
    if not results:
        print("No entities found to delete")
        return
    
    # Create delete operations for each entity
    delete_operations = []
    for result in results:
        delete_operations.append(GolemBaseDelete(result.entity_key))
    
    # Delete entities in batches
    BATCH_SIZE = 10
    deleted_count = 0
    
    for batch_start in tqdm(range(0, len(delete_operations), BATCH_SIZE)):
        batch_end = min(batch_start + BATCH_SIZE, len(delete_operations))
        batch_deletes = delete_operations[batch_start:batch_end]
        
        delete_receipts = await client.delete_entities(batch_deletes)
        deleted_count += len(delete_receipts)
        print(f"Deleted batch: {len(delete_receipts)} entities")
    
    print(f"Total deleted entities: {deleted_count}")

if __name__ == "__main__":
    
    asyncio.run(clean_db())
    # asyncio.run(main())
    # import sys
    # asyncio.run(query_data(11))
    # print("\nExample completed!")
    # sys.exit(0)
