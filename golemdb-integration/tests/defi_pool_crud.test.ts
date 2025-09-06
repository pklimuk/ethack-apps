import {
  DeFiPoolCRUD,
  DeFiPoolData,
  DeFiPoolEntity,
  initializeClient,
  loadPoolsFromCsv
} from '../defi_pool_crud';
import { GolemBaseClient, Annotation } from 'golem-base-sdk';
import * as fs from 'fs';

// Mock the entire golem-base-sdk module
jest.mock('golem-base-sdk', () => ({
  createClient: jest.fn(),
  Annotation: jest.fn().mockImplementation((key, value) => ({ key, value })),
  Tagged: jest.fn().mockImplementation((tag, data) => ({ tag, data }))
}));

// Mock fs module
jest.mock('fs');

// Mock crypto module
jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'test-uuid-123')
}));

describe('DeFiPoolCRUD', () => {
  let mockClient: jest.Mocked<GolemBaseClient>;
  let defiPoolCRUD: DeFiPoolCRUD;

  const mockPoolData: DeFiPoolData = {
    chain: 'Ethereum',
    project: 'Uniswap',
    symbol: 'USDC-WETH',
    tvlUsd: 1000000,
    apyBase: 5.5,
    apyReward: 2.3,
    apy: 7.8,
    rewardTokens: 'UNI',
    pool: '0x123...abc',
    stablecoin: false,
    ilRisk: 'low',
    exposure: 'single',
    underlyingTokens: 'USDC,WETH',
    volumeUsd1d: 50000,
    volumeUsd7d: 350000,
    count: 100,
    outlier: false
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock client with all required methods
    mockClient = {
      createEntities: jest.fn(),
      queryEntities: jest.fn(),
      updateEntities: jest.fn(),
      deleteEntities: jest.fn(),
      getOwnerAddress: jest.fn(),
      getRawClient: jest.fn(),
      watchLogs: jest.fn()
    } as any;

    // Mock client methods
    mockClient.createEntities.mockResolvedValue([{ entityKey: 'test-entity-key-123' }]);
    mockClient.queryEntities.mockResolvedValue([]);
    mockClient.updateEntities.mockResolvedValue([{ entityKey: 'test-entity-key-123' }]);
    mockClient.deleteEntities.mockResolvedValue([{ entityKey: 'test-entity-key-123' }]);
    mockClient.getOwnerAddress.mockResolvedValue('0xtest-address');
    mockClient.getRawClient.mockReturnValue({
      httpClient: {
        getBalance: jest.fn().mockResolvedValue(BigInt('1000000000000000000')), // 1 ETH
        getBlockNumber: jest.fn().mockResolvedValue(12345)
      }
    } as any);

    defiPoolCRUD = new DeFiPoolCRUD(mockClient);
  });

  describe('createPool', () => {
    it('should create a single pool successfully', async () => {
      const entityKey = await defiPoolCRUD.createPool(mockPoolData);

      expect(entityKey).toBe('test-entity-key-123');
      expect(mockClient.createEntities).toHaveBeenCalledTimes(1);
      
      const createCall = mockClient.createEntities.mock.calls[0][0][0];
      expect(createCall).toMatchObject({
        data: expect.any(Uint8Array),
        btl: 1000000,
        stringAnnotations: expect.arrayContaining([
          expect.objectContaining({ key: 'type', value: 'defi_pool' }),
          expect.objectContaining({ key: 'chain', value: 'Ethereum' }),
          expect.objectContaining({ key: 'project', value: 'Uniswap' }),
          expect.objectContaining({ key: 'symbol', value: 'USDC-WETH' })
        ]),
        numericAnnotations: expect.arrayContaining([
          expect.objectContaining({ key: 'tvlUsd', value: 100000000 }), // $1M in cents
          expect.objectContaining({ key: 'apyBase', value: 55000 }), // 5.5% in basis points
          expect.objectContaining({ key: 'apy', value: 78000 }) // 7.8% in basis points
        ])
      });
    });

    it('should handle pools with minimal data', async () => {
      const minimalPool: DeFiPoolData = {
        chain: 'Polygon',
        project: 'QuickSwap',
        symbol: 'MATIC-USDC',
        tvlUsd: 50000
      };

      const entityKey = await defiPoolCRUD.createPool(minimalPool);

      expect(entityKey).toBe('test-entity-key-123');
      expect(mockClient.createEntities).toHaveBeenCalledTimes(1);
    });

    it('should skip zero or negative APY values', async () => {
      const poolWithZeroApy: DeFiPoolData = {
        ...mockPoolData,
        apyBase: 0,
        apyReward: -1.5,
        apy: 0
      };

      await defiPoolCRUD.createPool(poolWithZeroApy);

      const createCall = mockClient.createEntities.mock.calls[0][0][0];
      const apyAnnotations = createCall.numericAnnotations.filter(
        (ann: any) => ann.key === 'apyBase' || ann.key === 'apyReward' || ann.key === 'apy'
      );
      
      expect(apyAnnotations).toHaveLength(0);
    });

    it('should convert boolean values correctly', async () => {
      const poolWithBooleans: DeFiPoolData = {
        ...mockPoolData,
        stablecoin: true,
        outlier: false
      };

      await defiPoolCRUD.createPool(poolWithBooleans);

      const createCall = mockClient.createEntities.mock.calls[0][0][0];
      expect(createCall.numericAnnotations).toContainEqual(
        expect.objectContaining({ key: 'stablecoin', value: 1 })
      );
      expect(createCall.numericAnnotations).toContainEqual(
        expect.objectContaining({ key: 'outlier', value: 0 })
      );
    });
  });

  describe('createPoolsBatch', () => {
    it('should create multiple pools in batches', async () => {
      const poolsData = [mockPoolData, { ...mockPoolData, symbol: 'DAI-WETH' }];
      mockClient.createEntities
        .mockResolvedValueOnce([{ entityKey: 'key-1' }, { entityKey: 'key-2' }]);

      const entityKeys = await defiPoolCRUD.createPoolsBatch(poolsData, 5);

      expect(entityKeys).toEqual(['key-1', 'key-2']);
      expect(mockClient.createEntities).toHaveBeenCalledTimes(1);
    });

    it('should handle large batches by splitting them', async () => {
      const poolsData = Array(15).fill(mockPoolData);
      mockClient.createEntities
        .mockResolvedValueOnce(Array(10).fill(0).map((_, i) => ({ entityKey: `key-${i}` })))
        .mockResolvedValueOnce(Array(5).fill(0).map((_, i) => ({ entityKey: `key-${i + 10}` })));

      const entityKeys = await defiPoolCRUD.createPoolsBatch(poolsData, 10);

      expect(entityKeys).toHaveLength(15);
      expect(mockClient.createEntities).toHaveBeenCalledTimes(2);
    });
  });

  describe('queryPools', () => {
    const mockQueryResults = [
      {
        entityKey: 'test-key-1',
        storageValue: new TextEncoder().encode(JSON.stringify({
          ...mockPoolData,
          poolId: 'pool-1',
          createdAt: '2023-01-01T00:00:00Z'
        }))
      }
    ];

    it('should query pools with custom filter', async () => {
      mockClient.queryEntities.mockResolvedValue(mockQueryResults);

      const result = await defiPoolCRUD.queryPools('chain = "Ethereum"');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        ...mockPoolData,
        poolId: 'pool-1',
        entityKey: 'test-key-1'
      });
      expect(mockClient.queryEntities).toHaveBeenCalledWith(
        'type = "defi_pool" && chain = "Ethereum"'
      );
    });

    it('should return empty array when no results found', async () => {
      mockClient.queryEntities.mockResolvedValue([]);

      const result = await defiPoolCRUD.queryPools('chain = "NonExistent"');

      expect(result).toHaveLength(0);
    });
  });

  describe('queryPoolsByChain', () => {
    it('should query pools by blockchain', async () => {
      const spy = jest.spyOn(defiPoolCRUD, 'queryPools').mockResolvedValue([]);

      await defiPoolCRUD.queryPoolsByChain('Ethereum');

      expect(spy).toHaveBeenCalledWith('chain = "Ethereum"');
    });
  });

  describe('queryPoolsByProject', () => {
    it('should query pools by project name', async () => {
      const spy = jest.spyOn(defiPoolCRUD, 'queryPools').mockResolvedValue([]);

      await defiPoolCRUD.queryPoolsByProject('Uniswap');

      expect(spy).toHaveBeenCalledWith('project = "Uniswap"');
    });
  });

  describe('queryPoolsByTvlRange', () => {
    it('should query pools by TVL range', async () => {
      const spy = jest.spyOn(defiPoolCRUD, 'queryPools').mockResolvedValue([]);

      await defiPoolCRUD.queryPoolsByTvlRange(1000000, 5000000);

      expect(spy).toHaveBeenCalledWith('tvlUsd >= 100000000 && tvlUsd <= 500000000');
    });
  });

  describe('queryPoolsByApyRange', () => {
    it('should query pools by APY range', async () => {
      const spy = jest.spyOn(defiPoolCRUD, 'queryPools').mockResolvedValue([]);

      await defiPoolCRUD.queryPoolsByApyRange(5.0, 15.0);

      expect(spy).toHaveBeenCalledWith('apy >= 50000 && apy <= 150000');
    });
  });

  describe('queryHighTvlPools', () => {
    it('should query high TVL pools with default minimum', async () => {
      const spy = jest.spyOn(defiPoolCRUD, 'queryPools').mockResolvedValue([]);

      await defiPoolCRUD.queryHighTvlPools();

      expect(spy).toHaveBeenCalledWith('tvlUsd >= 100000000'); // $1M in cents
    });

    it('should query high TVL pools with custom minimum', async () => {
      const spy = jest.spyOn(defiPoolCRUD, 'queryPools').mockResolvedValue([]);

      await defiPoolCRUD.queryHighTvlPools(10000000);

      expect(spy).toHaveBeenCalledWith('tvlUsd >= 1000000000'); // $10M in cents
    });
  });

  describe('queryStablecoinPools', () => {
    it('should query stablecoin pools only', async () => {
      const spy = jest.spyOn(defiPoolCRUD, 'queryPools').mockResolvedValue([]);

      await defiPoolCRUD.queryStablecoinPools();

      expect(spy).toHaveBeenCalledWith('stablecoin = 1');
    });
  });

  describe('updatePool', () => {
    const mockExistingPool: DeFiPoolEntity = {
      ...mockPoolData,
      poolId: 'existing-pool-id',
      createdAt: '2023-01-01T00:00:00Z',
      entityKey: 'existing-entity-key'
    };

    beforeEach(() => {
      mockClient.queryEntities.mockResolvedValue([
        {
          entityKey: 'existing-entity-key',
          storageValue: new TextEncoder().encode(JSON.stringify(mockExistingPool))
        }
      ]);
    });

    it('should update an existing pool', async () => {
      const updatedData: Partial<DeFiPoolData> = {
        tvlUsd: 2000000,
        apy: 10.5
      };

      const entityKey = await defiPoolCRUD.updatePool('existing-entity-key', updatedData);

      expect(entityKey).toBe('test-entity-key-123');
      expect(mockClient.updateEntities).toHaveBeenCalledTimes(1);
      
      const updateCall = mockClient.updateEntities.mock.calls[0][0][0];
      expect(updateCall.entityKey).toBe('existing-entity-key');
      expect(updateCall.numericAnnotations).toContainEqual(
        expect.objectContaining({ key: 'tvlUsd', value: 200000000 }) // $2M in cents
      );
      expect(updateCall.numericAnnotations).toContainEqual(
        expect.objectContaining({ key: 'apy', value: 105000 }) // 10.5% in basis points
      );
    });

    it('should throw error when pool not found', async () => {
      mockClient.queryEntities.mockResolvedValue([]);

      await expect(
        defiPoolCRUD.updatePool('non-existent-key', { tvlUsd: 1000000 })
      ).rejects.toThrow('Pool with entity_key non-existent-key not found');
    });
  });

  describe('deletePool', () => {
    it('should delete a single pool', async () => {
      const entityKey = await defiPoolCRUD.deletePool('test-entity-key');

      expect(entityKey).toBe('test-entity-key-123');
      expect(mockClient.deleteEntities).toHaveBeenCalledWith(['test-entity-key']);
    });
  });

  describe('deletePoolsByQuery', () => {
    it('should delete multiple pools matching query', async () => {
      const mockPools: DeFiPoolEntity[] = [
        { ...mockPoolData, poolId: '1', createdAt: '2023-01-01', entityKey: 'key1' },
        { ...mockPoolData, poolId: '2', createdAt: '2023-01-01', entityKey: 'key2' }
      ];
      
      jest.spyOn(defiPoolCRUD, 'queryPools').mockResolvedValue(mockPools);
      mockClient.deleteEntities.mockResolvedValue([{ entityKey: 'key1' }, { entityKey: 'key2' }]);

      const deletedCount = await defiPoolCRUD.deletePoolsByQuery('chain = "Ethereum"');

      expect(deletedCount).toBe(2);
      expect(mockClient.deleteEntities).toHaveBeenCalledWith(['key1', 'key2']);
    });

    it('should return 0 when no pools match query', async () => {
      jest.spyOn(defiPoolCRUD, 'queryPools').mockResolvedValue([]);

      const deletedCount = await defiPoolCRUD.deletePoolsByQuery('chain = "NonExistent"');

      expect(deletedCount).toBe(0);
      expect(mockClient.deleteEntities).not.toHaveBeenCalled();
    });

    it('should handle large deletions in batches', async () => {
      const mockPools: DeFiPoolEntity[] = Array(25).fill(0).map((_, i) => ({
        ...mockPoolData,
        poolId: `pool-${i}`,
        createdAt: '2023-01-01',
        entityKey: `key-${i}`
      }));
      
      jest.spyOn(defiPoolCRUD, 'queryPools').mockResolvedValue(mockPools);
      mockClient.deleteEntities
        .mockResolvedValueOnce(Array(10).fill(0).map((_, i) => ({ entityKey: `key-${i}` })))
        .mockResolvedValueOnce(Array(10).fill(0).map((_, i) => ({ entityKey: `key-${i + 10}` })))
        .mockResolvedValueOnce(Array(5).fill(0).map((_, i) => ({ entityKey: `key-${i + 20}` })));

      const deletedCount = await defiPoolCRUD.deletePoolsByQuery('type = "defi_pool"');

      expect(deletedCount).toBe(25);
      expect(mockClient.deleteEntities).toHaveBeenCalledTimes(3);
    });
  });

  describe('cleanAllPools', () => {
    it('should delete all DeFi pools', async () => {
      const spy = jest.spyOn(defiPoolCRUD, 'deletePoolsByQuery').mockResolvedValue(10);

      const deletedCount = await defiPoolCRUD.cleanAllPools();

      expect(deletedCount).toBe(10);
      expect(spy).toHaveBeenCalledWith('type = "defi_pool"');
    });
  });
});

describe('initializeClient', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should initialize client successfully', async () => {
    const { createClient } = require('golem-base-sdk');
    const mockClient = {
      getOwnerAddress: jest.fn().mockResolvedValue('0xtest-address'),
      getRawClient: jest.fn().mockReturnValue({
        httpClient: {
          getBalance: jest.fn().mockResolvedValue(BigInt('1000000000000000000'))
        }
      })
    };
    
    createClient.mockResolvedValue(mockClient);

    const client = await initializeClient();

    expect(client).toBe(mockClient);
    expect(createClient).toHaveBeenCalledWith(
      60138453033,
      expect.any(Object),
      'https://ethwarsaw.holesky.golemdb.io/rpc',
      'wss://ethwarsaw.holesky.golemdb.io/rpc/ws',
      expect.any(Object)
    );
  });

  it('should warn about zero balance', async () => {
    const { createClient } = require('golem-base-sdk');
    const mockClient = {
      getOwnerAddress: jest.fn().mockResolvedValue('0xtest-address'),
      getRawClient: jest.fn().mockReturnValue({
        httpClient: {
          getBalance: jest.fn().mockResolvedValue(BigInt('0'))
        }
      })
    };
    
    createClient.mockResolvedValue(mockClient);
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

    await initializeClient();

    expect(consoleSpy).toHaveBeenCalledWith(
      'Warning: Account balance is 0 ETH. Please acquire test tokens from the faucet.'
    );
    
    consoleSpy.mockRestore();
  });
});

describe('loadPoolsFromCsv', () => {
  const mockCsvContent = `chain,project,symbol,tvlUsd,apyBase,stablecoin,outlier
Ethereum,Uniswap,USDC-WETH,1000000,5.5,false,false
Polygon,QuickSwap,MATIC-USDC,500000,8.2,true,false`;

  beforeEach(() => {
    (fs.readFileSync as jest.Mock).mockReturnValue(mockCsvContent);
  });

  it('should load and parse CSV data correctly', () => {
    const pools = loadPoolsFromCsv('test.csv');

    expect(pools).toHaveLength(2);
    expect(pools[0]).toMatchObject({
      chain: 'Ethereum',
      project: 'Uniswap',
      symbol: 'USDC-WETH',
      tvlUsd: 1000000,
      apyBase: 5.5,
      stablecoin: false,
      outlier: false
    });
    expect(pools[1]).toMatchObject({
      chain: 'Polygon',
      project: 'QuickSwap',
      symbol: 'MATIC-USDC',
      tvlUsd: 500000,
      apyBase: 8.2,
      stablecoin: true,
      outlier: false
    });
  });

  it('should skip empty lines and incomplete data', () => {
    const invalidCsv = `chain,project,symbol,tvlUsd
Ethereum,Uniswap,USDC-WETH,1000000

,,,
Polygon,,MATIC-USDC,500000`;

    (fs.readFileSync as jest.Mock).mockReturnValue(invalidCsv);

    const pools = loadPoolsFromCsv('test.csv');

    expect(pools).toHaveLength(1); // Only the first valid row
    expect(pools[0].chain).toBe('Ethereum');
  });

  it('should handle different data types correctly', () => {
    const typedCsv = `chain,project,symbol,tvlUsd,count,stablecoin,outlier
Ethereum,Uniswap,USDC-WETH,1000000.50,100,true,false`;

    (fs.readFileSync as jest.Mock).mockReturnValue(typedCsv);

    const pools = loadPoolsFromCsv('test.csv');

    expect(pools[0]).toMatchObject({
      tvlUsd: 1000000.50,
      count: 100,
      stablecoin: true,
      outlier: false
    });
  });
});