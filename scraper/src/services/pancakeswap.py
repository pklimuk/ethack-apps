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
class PancakeSwapPool:
    """PancakeSwap pool data structure"""
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
    farm_apy: float = 0.0  # CAKE farming APY
    total_apy: float = 0.0  # Trading + Farming APY
    network: str = 'bsc'

class PancakeSwapService:
    """PancakeSwap data collection service"""
    
    def __init__(self):
        self.network = 'bsc'  # PancakeSwap is primarily on BSC
        self.w3 = Web3(Web3.HTTPProvider(config.RPC_URLS['bsc']))
        self.rate_limiter = RateLimiter(calls_per_second=8)
        
        # PancakeSwap API endpoints
        self.api_base = "https://api.pancakeswap.info/api/v2"
        self.subgraph_url = "https://api.thegraph.com/subgraphs/name/pancakeswap/exchange"
        
        # Alternative data sources
        self.bsc_scan_api = "https://api.bscscan.com/api"
        self.defillama_api = "https://yields.llama.fi/pools"
        
        # Contract addresses on BSC
        self.factory_address = config.CONTRACTS['bsc']['pancakeswap_factory']
        self.router_address = config.CONTRACTS['bsc']['pancakeswap_router']
        
        self._load_contracts()
    
    def _load_contracts(self):
        """Load PancakeSwap contract ABIs"""
        # Uniswap V2 style factory ABI (PancakeSwap is a fork)
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
            self.factory_contract = self.w3.eth.contract(
                address=self.factory_address,
                abi=self.factory_abi
            )
            logger.info("Loaded PancakeSwap factory contract on BSC")
        except Exception as e:
            logger.error(f"Error loading PancakeSwap contracts: {e}")
            self.factory_contract = None
    
    @retry_on_failure(max_retries=3)
    async def get_top_pools(self, limit: int = 50) -> List[PancakeSwapPool]:
        """Get top PancakeSwap pools by TVL"""
        await self.rate_limiter.wait()
        
        # Try official PancakeSwap API first
        pools = await self._get_pools_from_api()
        
        if not pools:
            # Fallback to subgraph
            pools = await self._get_pools_from_subgraph(limit)
        
        if not pools:
            # Final fallback to DeFiLlama
            pools = await self._get_pools_from_defillama()
        
        # Filter by TVL threshold
        filtered_pools = [
            pool for pool in pools 
            if pool.tvl_usd >= config.MIN_TVL_THRESHOLD
        ][:config.MAX_POOLS_PER_DEX]
        
        logger.info(f"Fetched {len(filtered_pools)} PancakeSwap pools")
        return filtered_pools
    
    async def _get_pools_from_api(self) -> List[PancakeSwapPool]:
        """Get pools from official PancakeSwap API"""
        async with aiohttp.ClientSession() as session:
            try:
                # Get pairs summary
                url = f"{self.api_base}/pairs"
                
                async with session.get(url, timeout=config.REQUEST_TIMEOUT) as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        pools = []
                        # Sort by reserve USD descending
                        sorted_pairs = sorted(
                            data.get('data', {}).items(),
                            key=lambda x: float(x[1].get('reserve_USD', 0)),
                            reverse=True
                        )
                        
                        for pair_address, pair_data in sorted_pairs[:config.MAX_POOLS_PER_DEX]:
                            try:
                                pool = self._parse_api_pool_data(pair_address, pair_data)
                                if pool:
                                    pools.append(pool)
                            except Exception as e:
                                logger.warning(f"Error parsing PancakeSwap API pool data: {e}")
                                continue
                        
                        logger.info(f"Fetched {len(pools)} pools from PancakeSwap API")
                        return pools
                        
            except Exception as e:
                logger.warning(f"PancakeSwap API failed: {e}")
                return []
    
    def _parse_api_pool_data(self, pair_address: str, pair_data: Dict) -> Optional[PancakeSwapPool]:
        """Parse pool data from PancakeSwap API response"""
        try:
            # Calculate fees (0.25% of volume for PancakeSwap)
            volume_24h = float(pair_data.get('volume_USD', 0))
            fees_24h = volume_24h * 0.0025  # 0.25% fee
            
            # Parse token information
            base_symbol = pair_data.get('base_symbol', '')
            quote_symbol = pair_data.get('quote_symbol', '')
            
            pool = PancakeSwapPool(
                address=pair_address,
                token0=pair_data.get('base_id', ''),
                token1=pair_data.get('quote_id', ''),
                token0_symbol=base_symbol,
                token1_symbol=quote_symbol,
                token0_reserve=float(pair_data.get('base_volume', 0)),
                token1_reserve=float(pair_data.get('quote_volume', 0)),
                volume_24h=volume_24h,
                fees_24h=fees_24h,
                tvl_usd=float(pair_data.get('reserve_USD', 0)),
                network=self.network
            )
            
            # Calculate base APY from trading fees
            if pool.tvl_usd > 0:
                pool.apy = (pool.fees_24h * 365) / pool.tvl_usd * 100
                pool.total_apy = pool.apy  # Will add farm APY later if available
            
            return pool
            
        except (KeyError, ValueError, TypeError) as e:
            logger.warning(f"Error parsing PancakeSwap API pool data: {e}")
            return None
    
    async def _get_pools_from_subgraph(self, limit: int) -> List[PancakeSwapPool]:
        """Get pools from The Graph subgraph"""
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
                                pool = self._parse_subgraph_pool_data(pair_data)
                                if pool:
                                    pools.append(pool)
                            except Exception as e:
                                logger.warning(f"Error parsing subgraph pool data: {e}")
                                continue
                        
                        logger.info(f"Fetched {len(pools)} pools from PancakeSwap subgraph")
                        return pools
                    else:
                        logger.warning(f"HTTP {response.status} from PancakeSwap subgraph")
                        return []
                        
            except Exception as e:
                logger.warning(f"PancakeSwap subgraph failed: {e}")
                return []
    
    def _parse_subgraph_pool_data(self, pair_data: Dict) -> Optional[PancakeSwapPool]:
        """Parse pool data from subgraph response"""
        try:
            # Calculate 24h volume from dayData if available
            volume_24h = 0.0
            if pair_data.get('dayData') and len(pair_data['dayData']) > 0:
                volume_24h = float(pair_data['dayData'][0].get('volumeUSD', 0))
            else:
                volume_24h = float(pair_data.get('volumeUSD', 0))
            
            # Calculate fees (0.25% of volume)
            fees_24h = volume_24h * 0.0025
            
            pool = PancakeSwapPool(
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
                pool.total_apy = pool.apy
            
            return pool
            
        except (KeyError, ValueError, TypeError) as e:
            logger.warning(f"Error parsing subgraph pool data: {e}")
            return None
    
    async def _get_pools_from_defillama(self) -> List[PancakeSwapPool]:
        """Fallback method using DeFiLlama API"""
        async with aiohttp.ClientSession() as session:
            try:
                url = f"{self.defillama_api}"
                
                async with session.get(url, timeout=config.REQUEST_TIMEOUT) as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        pools = []
                        pancake_pools = [
                            pool for pool in data.get('data', [])
                            if 'pancakeswap' in pool.get('project', '').lower()
                            and pool.get('chain') == 'binance'
                        ]
                        
                        for pool_data in pancake_pools[:config.MAX_POOLS_PER_DEX]:
                            pool = self._parse_defillama_pool_data(pool_data)
                            if pool:
                                pools.append(pool)
                        
                        logger.info(f"Fetched {len(pools)} PancakeSwap pools via DeFiLlama")
                        return pools
                        
            except Exception as e:
                logger.warning(f"DeFiLlama fallback also failed: {e}")
                return []
    
    def _parse_defillama_pool_data(self, pool_data: Dict) -> Optional[PancakeSwapPool]:
        """Parse pool data from DeFiLlama API"""
        try:
            # Extract symbols from pool name
            symbols = pool_data.get('symbol', '').split('-')
            token0_symbol = symbols[0] if len(symbols) > 0 else ''
            token1_symbol = symbols[1] if len(symbols) > 1 else ''
            
            pool = PancakeSwapPool(
                address=pool_data.get('pool', ''),
                token0='',  # Not available from DeFiLlama
                token1='',
                token0_symbol=token0_symbol,
                token1_symbol=token1_symbol,
                tvl_usd=float(pool_data.get('tvlUsd', 0)),
                apy=float(pool_data.get('apyBase', 0)),
                farm_apy=float(pool_data.get('apyReward', 0)),
                total_apy=float(pool_data.get('apy', 0)),
                network=self.network
            )
            
            return pool
            
        except Exception as e:
            logger.warning(f"Error parsing DeFiLlama pool data: {e}")
            return None
    
    @retry_on_failure(max_retries=2)
    async def get_pool_details(self, pool_address: str) -> Optional[PancakeSwapPool]:
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
            
            pool = PancakeSwapPool(
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
            
            logger.debug(f"Fetched PancakeSwap pool details for {pool_address}")
            return pool
            
        except Exception as e:
            logger.error(f"Error fetching PancakeSwap pool details for {pool_address}: {e}")
            return None
    
    async def get_farming_pools(self) -> List[Dict]:
        """Get pools that offer CAKE farming rewards"""
        async with aiohttp.ClientSession() as session:
            try:
                # This would require access to PancakeSwap's farming contract
                # For now, return empty list - could be implemented with farm contract calls
                logger.info("Farming pools data requires additional contract integration")
                return []
                
            except Exception as e:
                logger.warning(f"Could not fetch farming pools: {e}")
                return []
    
    async def get_pools_for_tokens(self, token_pairs: List[Tuple[str, str]]) -> List[PancakeSwapPool]:
        """Get pools for specific token pairs"""
        if not self.factory_contract:
            logger.warning("No factory contract available for PancakeSwap")
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
                logger.debug(f"No PancakeSwap pool found for {token0}/{token1}: {e}")
                continue
        
        logger.info(f"Found {len(pools)} PancakeSwap pools for {len(token_pairs)} token pairs")
        return pools
    
    def calculate_impermanent_loss(self, initial_ratio: float, current_ratio: float) -> float:
        """Calculate impermanent loss for the pool"""
        if initial_ratio <= 0 or current_ratio <= 0:
            return 0.0
        
        price_ratio = current_ratio / initial_ratio
        il = 2 * math.sqrt(price_ratio) / (1 + price_ratio) - 1
        return abs(il) * 100

# Global service instance
pancakeswap_service = PancakeSwapService()