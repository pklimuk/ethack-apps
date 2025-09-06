import asyncio
import aiohttp
from web3 import Web3
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import json
import math
from ..utils.helpers import retry_on_failure, RateLimiter, wei_to_ether, safe_div
from ..utils.logger import logger
from ..config.settings import config

@dataclass
class SushiSwapPool:
    """SushiSwap pool data structure"""
    address: str
    token0: str
    token1: str
    token0_symbol: str
    token1_symbol: str
    token0_decimals: int = 18
    token1_decimals: int = 18
    token0_reserve: float = 0.0
    token1_reserve: float = 0.0
    total_supply: float = 0.0
    volume_24h: float = 0.0
    volume_7d: float = 0.0
    fees_24h: float = 0.0
    tvl_usd: float = 0.0
    apy: float = 0.0
    network: str = 'ethereum'

class SushiSwapService:
    """SushiSwap data collection service"""
    
    def __init__(self, network: str = 'ethereum'):
        self.network = network
        self.w3 = Web3(Web3.HTTPProvider(config.RPC_URLS[network]))
        self.rate_limiter = RateLimiter(calls_per_second=8)
        
        # SushiSwap subgraph endpoints
        self.subgraph_urls = {
            'ethereum': 'https://api.thegraph.com/subgraphs/name/sushiswap/exchange',
            'polygon': 'https://api.thegraph.com/subgraphs/name/sushiswap/matic-exchange',
            'arbitrum': 'https://api.thegraph.com/subgraphs/name/sushiswap/arbitrum-exchange'
        }
        self.subgraph_url = self.subgraph_urls.get(network, self.subgraph_urls['ethereum'])
        
        # Alternative API endpoints
        self.api_base = "https://app.sushi.com/api"
        
        # Contract addresses
        factory_addresses = {
            'ethereum': config.CONTRACTS['ethereum'].get('sushiswap_factory'),
            'polygon': config.CONTRACTS.get('polygon', {}).get('sushiswap_factory'),
            'arbitrum': config.CONTRACTS.get('arbitrum', {}).get('sushiswap_factory')
        }
        self.factory_address = factory_addresses.get(network)
        
        self._load_contracts()
    
    def _load_contracts(self):
        """Load SushiSwap contract ABIs"""
        # Uniswap V2 style factory ABI (SushiSwap is a fork)
        self.factory_abi = [
            {
                "constant": True,
                "inputs": [
                    {"name": "", "type": "address"},
                    {"name": "", "type": "address"}
                ],
                "name": "getPair",
                "outputs": [{"name": "", "type": "address"}],
                "type": "function"
            }
        ]
        
        # Uniswap V2 style pair ABI
        self.pair_abi = [
            {
                "constant": True,
                "inputs": [],
                "name": "getReserves",
                "outputs": [
                    {"name": "_reserve0", "type": "uint112"},
                    {"name": "_reserve1", "type": "uint112"},
                    {"name": "_blockTimestampLast", "type": "uint32"}
                ],
                "type": "function"
            },
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
                "name": "totalSupply",
                "outputs": [{"name": "", "type": "uint256"}],
                "type": "function"
            }
        ]
        
        # ERC20 ABI
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
            if self.factory_address:
                self.factory_contract = self.w3.eth.contract(
                    address=self.factory_address,
                    abi=self.factory_abi
                )
                logger.info(f"Loaded SushiSwap factory contract on {self.network}")
            else:
                self.factory_contract = None
                logger.warning(f"No SushiSwap factory address for {self.network}")
        except Exception as e:
            logger.error(f"Error loading SushiSwap contracts: {e}")
            self.factory_contract = None
    
    @retry_on_failure(max_retries=3)
    async def get_top_pools(self, limit: int = 50) -> List[SushiSwapPool]:
        """Get top SushiSwap pools by TVL using The Graph"""
        await self.rate_limiter.wait()
        
        query = """
        {
          pairs(first: %d, orderBy: reserveUSD, orderDirection: desc) {
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
            reserve0
            reserve1
            totalSupply
            reserveUSD
            volumeUSD
            untrackedVolumeUSD
            dayData(first: 1, orderBy: date, orderDirection: desc) {
              volumeUSD
              reserveUSD
            }
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
                        pairs_data = data.get('data', {}).get('pairs', [])
                        
                        pools = []
                        for pair_data in pairs_data:
                            try:
                                pool = self._parse_pool_data(pair_data)
                                if pool and pool.tvl_usd >= config.MIN_TVL_THRESHOLD:
                                    pools.append(pool)
                            except Exception as e:
                                logger.warning(f"Error parsing SushiSwap pool data: {e}")
                                continue
                        
                        logger.info(f"Fetched {len(pools)} SushiSwap pools on {self.network}")
                        return pools
                    else:
                        logger.error(f"HTTP {response.status} from SushiSwap subgraph")
                        return await self._get_pools_fallback()
                        
            except Exception as e:
                logger.error(f"Error fetching SushiSwap pools: {e}")
                return await self._get_pools_fallback()
    
    def _parse_pool_data(self, pair_data: Dict) -> Optional[SushiSwapPool]:
        """Parse pool data from The Graph response"""
        try:
            # Calculate 24h volume from dayData if available
            volume_24h = 0.0
            if pair_data.get('dayData') and len(pair_data['dayData']) > 0:
                volume_24h = float(pair_data['dayData'][0].get('volumeUSD', 0))
            else:
                volume_24h = float(pair_data.get('volumeUSD', 0))
            
            # Calculate fees (0.3% of volume)
            fees_24h = volume_24h * 0.003
            
            pool = SushiSwapPool(
                address=pair_data['id'],
                token0=pair_data['token0']['id'],
                token1=pair_data['token1']['id'],
                token0_symbol=pair_data['token0']['symbol'],
                token1_symbol=pair_data['token1']['symbol'],
                token0_decimals=int(pair_data['token0']['decimals']),
                token1_decimals=int(pair_data['token1']['decimals']),
                token0_reserve=float(pair_data['reserve0']),
                token1_reserve=float(pair_data['reserve1']),
                total_supply=float(pair_data['totalSupply']),
                volume_24h=volume_24h,
                fees_24h=fees_24h,
                tvl_usd=float(pair_data.get('reserveUSD', 0)),
                network=self.network
            )
            
            # Calculate estimated APY
            if pool.tvl_usd > 0:
                pool.apy = (pool.fees_24h * 365) / pool.tvl_usd * 100
            
            return pool
            
        except (KeyError, ValueError, TypeError) as e:
            logger.warning(f"Error parsing SushiSwap pool data: {e}")
            return None
    
    async def _get_pools_fallback(self) -> List[SushiSwapPool]:
        """Fallback method to get pools using direct API"""
        try:
            async with aiohttp.ClientSession() as session:
                # Try the SushiSwap API endpoint
                url = f"{self.api_base}/pools/{self.network}"
                
                async with session.get(url, timeout=config.REQUEST_TIMEOUT) as response:
                    if response.status == 200:
                        data = await response.json()
                        pools = []
                        
                        # Process API response (format may vary)
                        if isinstance(data, list):
                            for pool_data in data[:config.MAX_POOLS_PER_DEX]:
                                pool = self._parse_api_pool_data(pool_data)
                                if pool and pool.tvl_usd >= config.MIN_TVL_THRESHOLD:
                                    pools.append(pool)
                        
                        logger.info(f"Fetched {len(pools)} SushiSwap pools via fallback API")
                        return pools
                        
        except Exception as e:
            logger.error(f"Fallback API also failed: {e}")
        
        return []
    
    def _parse_api_pool_data(self, pool_data: Dict) -> Optional[SushiSwapPool]:
        """Parse pool data from API response (fallback)"""
        try:
            return SushiSwapPool(
                address=pool_data.get('address', ''),
                token0=pool_data.get('token0', {}).get('address', ''),
                token1=pool_data.get('token1', {}).get('address', ''),
                token0_symbol=pool_data.get('token0', {}).get('symbol', ''),
                token1_symbol=pool_data.get('token1', {}).get('symbol', ''),
                token0_decimals=int(pool_data.get('token0', {}).get('decimals', 18)),
                token1_decimals=int(pool_data.get('token1', {}).get('decimals', 18)),
                tvl_usd=float(pool_data.get('tvl', 0)),
                volume_24h=float(pool_data.get('volume24h', 0)),
                fees_24h=float(pool_data.get('fees24h', 0)),
                network=self.network
            )
        except Exception as e:
            logger.warning(f"Error parsing API pool data: {e}")
            return None
    
    @retry_on_failure(max_retries=2)
    async def get_pool_details(self, pool_address: str) -> Optional[SushiSwapPool]:
        """Get detailed information for a specific pool using on-chain data"""
        await self.rate_limiter.wait()
        
        try:
            pair_contract = self.w3.eth.contract(
                address=pool_address,
                abi=self.pair_abi
            )
            
            # Get basic pool info
            token0 = pair_contract.functions.token0().call()
            token1 = pair_contract.functions.token1().call()
            reserves = pair_contract.functions.getReserves().call()
            total_supply = pair_contract.functions.totalSupply().call()
            
            # Get token info
            token0_contract = self.w3.eth.contract(address=token0, abi=self.erc20_abi)
            token1_contract = self.w3.eth.contract(address=token1, abi=self.erc20_abi)
            
            token0_symbol = token0_contract.functions.symbol().call()
            token1_symbol = token1_contract.functions.symbol().call()
            token0_decimals = token0_contract.functions.decimals().call()
            token1_decimals = token1_contract.functions.decimals().call()
            
            # Convert reserves to human readable format
            token0_reserve = reserves[0] / (10 ** token0_decimals)
            token1_reserve = reserves[1] / (10 ** token1_decimals)
            
            pool = SushiSwapPool(
                address=pool_address,
                token0=token0,
                token1=token1,
                token0_symbol=token0_symbol,
                token1_symbol=token1_symbol,
                token0_decimals=token0_decimals,
                token1_decimals=token1_decimals,
                token0_reserve=token0_reserve,
                token1_reserve=token1_reserve,
                total_supply=wei_to_ether(total_supply),
                network=self.network
            )
            
            logger.debug(f"Fetched SushiSwap pool details for {pool_address}")
            return pool
            
        except Exception as e:
            logger.error(f"Error fetching SushiSwap pool details for {pool_address}: {e}")
            return None
    
    async def get_pools_for_tokens(self, token_pairs: List[Tuple[str, str]]) -> List[SushiSwapPool]:
        """Get pools for specific token pairs"""
        if not self.factory_contract:
            logger.warning("No factory contract available for SushiSwap")
            return []
        
        pools = []
        
        for token0, token1 in token_pairs:
            try:
                pair_address = self.factory_contract.functions.getPair(token0, token1).call()
                
                if pair_address != '0x0000000000000000000000000000000000000000':
                    pool = await self.get_pool_details(pair_address)
                    if pool:
                        pools.append(pool)
                        
            except Exception as e:
                logger.debug(f"No SushiSwap pool found for {token0}/{token1}: {e}")
                continue
        
        logger.info(f"Found {len(pools)} SushiSwap pools for {len(token_pairs)} token pairs")
        return pools
    
    def calculate_pool_share(self, lp_tokens: float, total_supply: float) -> float:
        """Calculate share of pool ownership"""
        return safe_div(lp_tokens, total_supply)
    
    def calculate_impermanent_loss(self, initial_ratio: float, current_ratio: float) -> float:
        """Calculate impermanent loss for the pool"""
        if initial_ratio <= 0 or current_ratio <= 0:
            return 0.0
        
        price_ratio = current_ratio / initial_ratio
        il = 2 * math.sqrt(price_ratio) / (1 + price_ratio) - 1
        return abs(il) * 100

# Create service instances for different networks
sushiswap_ethereum = SushiSwapService('ethereum')
sushiswap_polygon = SushiSwapService('polygon')
sushiswap_arbitrum = SushiSwapService('arbitrum')