import asyncio
import aiohttp
from web3 import Web3
from web3.exceptions import ContractLogicError
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from eth_abi import decode
import json
from ..utils.helpers import retry_on_failure, RateLimiter, wei_to_ether
from ..utils.logger import logger
from ..config.settings import config

@dataclass
class UniswapV3Pool:
    """Uniswap V3 pool data structure"""
    address: str
    token0: str
    token1: str
    token0_symbol: str
    token1_symbol: str
    fee: int
    tick_spacing: int
    liquidity: int
    sqrt_price_x96: int
    tick: int
    token0_decimals: int = 18
    token1_decimals: int = 18
    token0_reserve: float = 0.0
    token1_reserve: float = 0.0
    volume_24h: float = 0.0
    fees_24h: float = 0.0
    tvl_usd: float = 0.0

class UniswapV3Service:
    """Uniswap V3 data collection service"""
    
    def __init__(self, network: str = 'ethereum'):
        self.network = network
        self.w3 = Web3(Web3.HTTPProvider(config.RPC_URLS[network]))
        self.rate_limiter = RateLimiter(calls_per_second=8)
        
        # Contract addresses
        self.factory_address = config.CONTRACTS[network]['uniswap_v3_factory']
        self.quoter_address = config.CONTRACTS[network].get('uniswap_v3_quoter')
        
        # Load contract ABIs
        self._load_contracts()
        
        # GraphQL endpoint for The Graph
        self.subgraph_url = self._get_subgraph_url()
    
    def _load_contracts(self):
        """Load smart contract instances"""
        # Simplified ABI for factory contract
        factory_abi = [
            {
                "constant": True,
                "inputs": [
                    {"name": "tokenA", "type": "address"},
                    {"name": "tokenB", "type": "address"},
                    {"name": "fee", "type": "uint24"}
                ],
                "name": "getPool",
                "outputs": [{"name": "pool", "type": "address"}],
                "type": "function"
            },
            {
                "anonymous": False,
                "inputs": [
                    {"indexed": True, "name": "token0", "type": "address"},
                    {"indexed": True, "name": "token1", "type": "address"},
                    {"indexed": True, "name": "fee", "type": "uint24"},
                    {"indexed": False, "name": "tickSpacing", "type": "int24"},
                    {"indexed": False, "name": "pool", "type": "address"}
                ],
                "name": "PoolCreated",
                "type": "event"
            }
        ]
        
        # Simplified ABI for pool contract
        self.pool_abi = [
            {
                "constant": True,
                "inputs": [],
                "name": "token0",
                "outputs": [{"name": "", "type": "address"}],
                "type": "function"
            },
            {
                "constant": True,
                "inputs": [],
                "name": "token1", 
                "outputs": [{"name": "", "type": "address"}],
                "type": "function"
            },
            {
                "constant": True,
                "inputs": [],
                "name": "fee",
                "outputs": [{"name": "", "type": "uint24"}],
                "type": "function"
            },
            {
                "constant": True,
                "inputs": [],
                "name": "liquidity",
                "outputs": [{"name": "", "type": "uint128"}],
                "type": "function"
            },
            {
                "constant": True,
                "inputs": [],
                "name": "slot0",
                "outputs": [
                    {"name": "sqrtPriceX96", "type": "uint160"},
                    {"name": "tick", "type": "int24"},
                    {"name": "observationIndex", "type": "uint16"},
                    {"name": "observationCardinality", "type": "uint16"},
                    {"name": "observationCardinalityNext", "type": "uint16"},
                    {"name": "feeProtocol", "type": "uint8"},
                    {"name": "unlocked", "type": "bool"}
                ],
                "type": "function"
            }
        ]
        
        # ERC20 ABI for token info
        self.erc20_abi = [
            {
                "constant": True,
                "inputs": [],
                "name": "symbol",
                "outputs": [{"name": "", "type": "string"}],
                "type": "function"
            },
            {
                "constant": True,
                "inputs": [],
                "name": "decimals",
                "outputs": [{"name": "", "type": "uint8"}],
                "type": "function"
            }
        ]
        
        try:
            self.factory_contract = self.w3.eth.contract(
                address=self.factory_address, 
                abi=factory_abi
            )
            logger.info(f"Loaded Uniswap V3 factory contract on {self.network}")
        except Exception as e:
            logger.error(f"Error loading Uniswap V3 contracts: {e}")
            self.factory_contract = None
    
    def _get_subgraph_url(self) -> str:
        """Get The Graph subgraph URL for the network"""
        subgraph_urls = {
            'ethereum': 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
            'polygon': 'https://api.thegraph.com/subgraphs/name/ianlapham/uniswap-v3-polygon',
            'arbitrum': 'https://api.thegraph.com/subgraphs/name/ianlapham/arbitrum-minimal'
        }
        return subgraph_urls.get(self.network, subgraph_urls['ethereum'])
    
    @retry_on_failure(max_retries=3)
    async def get_top_pools(self, limit: int = 50) -> List[UniswapV3Pool]:
        """Get top Uniswap V3 pools by TVL using The Graph"""
        await self.rate_limiter.wait()
        
        query = """
        {
          pools(first: %d, orderBy: totalValueLockedUSD, orderDirection: desc) {
            id
            token0 {
              id
              symbol
              decimals
            }
            token1 {
              id  
              symbol
              decimals
            }
            feeTier
            liquidity
            sqrtPrice
            tick
            token0Price
            token1Price
            volumeUSD
            totalValueLockedUSD
            feesUSD
          }
        }
        """ % min(limit, config.MAX_POOLS_PER_DEX)
        
        async with aiohttp.ClientSession() as session:
            try:
                async with session.post(
                    self.subgraph_url,
                    json={'query': query},
                    timeout=config.REQUEST_TIMEOUT
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        pools_data = data.get('data', {}).get('pools', [])
                        
                        pools = []
                        for pool_data in pools_data:
                            try:
                                pool = self._parse_pool_data(pool_data)
                                if pool and pool.tvl_usd >= config.MIN_TVL_THRESHOLD:
                                    pools.append(pool)
                            except Exception as e:
                                logger.warning(f"Error parsing pool data: {e}")
                                continue
                        
                        logger.info(f"Fetched {len(pools)} Uniswap V3 pools on {self.network}")
                        return pools
                    else:
                        logger.error(f"HTTP {response.status} from Uniswap subgraph")
                        return []
                        
            except Exception as e:
                logger.error(f"Error fetching Uniswap V3 pools: {e}")
                return []
    
    def _parse_pool_data(self, pool_data: Dict) -> Optional[UniswapV3Pool]:
        """Parse pool data from The Graph response"""
        try:
            return UniswapV3Pool(
                address=pool_data['id'],
                token0=pool_data['token0']['id'],
                token1=pool_data['token1']['id'],
                token0_symbol=pool_data['token0']['symbol'],
                token1_symbol=pool_data['token1']['symbol'],
                fee=int(pool_data['feeTier']),
                tick_spacing=self._fee_to_tick_spacing(int(pool_data['feeTier'])),
                liquidity=int(pool_data['liquidity']),
                sqrt_price_x96=int(float(pool_data['sqrtPrice'])),
                tick=int(pool_data['tick']),
                token0_decimals=int(pool_data['token0']['decimals']),
                token1_decimals=int(pool_data['token1']['decimals']),
                volume_24h=float(pool_data.get('volumeUSD', 0)),
                fees_24h=float(pool_data.get('feesUSD', 0)),
                tvl_usd=float(pool_data.get('totalValueLockedUSD', 0))
            )
        except (KeyError, ValueError, TypeError) as e:
            logger.warning(f"Error parsing pool data: {e}")
            return None
    
    def _fee_to_tick_spacing(self, fee: int) -> int:
        """Convert fee tier to tick spacing"""
        fee_to_spacing = {
            500: 10,      # 0.05%
            3000: 60,     # 0.3%
            10000: 200    # 1%
        }
        return fee_to_spacing.get(fee, 60)
    
    @retry_on_failure(max_retries=2)
    async def get_pool_details(self, pool_address: str) -> Optional[UniswapV3Pool]:
        """Get detailed information for a specific pool"""
        await self.rate_limiter.wait()
        
        try:
            pool_contract = self.w3.eth.contract(
                address=pool_address,
                abi=self.pool_abi
            )
            
            # Get basic pool info
            token0 = pool_contract.functions.token0().call()
            token1 = pool_contract.functions.token1().call()
            fee = pool_contract.functions.fee().call()
            liquidity = pool_contract.functions.liquidity().call()
            slot0 = pool_contract.functions.slot0().call()
            
            # Get token info
            token0_contract = self.w3.eth.contract(address=token0, abi=self.erc20_abi)
            token1_contract = self.w3.eth.contract(address=token1, abi=self.erc20_abi)
            
            token0_symbol = token0_contract.functions.symbol().call()
            token1_symbol = token1_contract.functions.symbol().call()
            token0_decimals = token0_contract.functions.decimals().call()
            token1_decimals = token1_contract.functions.decimals().call()
            
            pool = UniswapV3Pool(
                address=pool_address,
                token0=token0,
                token1=token1,
                token0_symbol=token0_symbol,
                token1_symbol=token1_symbol,
                fee=fee,
                tick_spacing=self._fee_to_tick_spacing(fee),
                liquidity=liquidity,
                sqrt_price_x96=slot0[0],  # sqrtPriceX96
                tick=slot0[1],           # current tick
                token0_decimals=token0_decimals,
                token1_decimals=token1_decimals
            )
            
            logger.debug(f"Fetched pool details for {pool_address}")
            return pool
            
        except Exception as e:
            logger.error(f"Error fetching pool details for {pool_address}: {e}")
            return None
    
    async def get_pools_for_tokens(self, token_pairs: List[Tuple[str, str]], 
                                 fee_tiers: List[int] = None) -> List[UniswapV3Pool]:
        """Get pools for specific token pairs"""
        if fee_tiers is None:
            fee_tiers = [500, 3000, 10000]  # 0.05%, 0.3%, 1%
        
        pools = []
        
        for token0, token1 in token_pairs:
            for fee in fee_tiers:
                try:
                    pool_address = self.factory_contract.functions.getPool(
                        token0, token1, fee
                    ).call()
                    
                    if pool_address != '0x0000000000000000000000000000000000000000':
                        pool = await self.get_pool_details(pool_address)
                        if pool:
                            pools.append(pool)
                            
                except Exception as e:
                    logger.debug(f"No pool found for {token0}/{token1} at {fee}: {e}")
                    continue
        
        logger.info(f"Found {len(pools)} pools for {len(token_pairs)} token pairs")
        return pools
    
    def calculate_price_from_sqrt(self, sqrt_price_x96: int, token0_decimals: int, 
                                token1_decimals: int) -> float:
        """Calculate token price from sqrtPriceX96"""
        try:
            # Price = (sqrtPriceX96 / 2^96)^2 * (10^(token0_decimals - token1_decimals))
            price = (sqrt_price_x96 / (2**96))**2
            decimal_adjustment = 10**(token0_decimals - token1_decimals)
            return price * decimal_adjustment
        except:
            return 0.0

# Create service instances for different networks
uniswap_ethereum = UniswapV3Service('ethereum')
uniswap_polygon = UniswapV3Service('polygon') 
uniswap_arbitrum = UniswapV3Service('arbitrum')