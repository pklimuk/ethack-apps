import asyncio
import aiohttp
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import json
from ..utils.helpers import retry_on_failure, RateLimiter, safe_div
from ..utils.logger import logger
from ..config.settings import config

@dataclass
class CurvePool:
    """Curve Finance pool data structure"""
    address: str
    name: str
    symbol: str
    pool_type: str  # 'stable', 'crypto', 'factory'
    coins: List[Dict[str, str]]  # [{"address": "0x...", "symbol": "USDT", "decimals": 6}]
    coin_addresses: List[str]
    coin_symbols: List[str]
    balances: List[float]
    underlying_balances: List[float]
    total_supply: float
    virtual_price: float
    amp: Optional[int]  # Amplification coefficient (for stable pools)
    fee: float  # Trading fee
    admin_fee: float
    volume_24h: float = 0.0
    volume_7d: float = 0.0
    fees_24h: float = 0.0
    tvl_usd: float = 0.0
    apy: float = 0.0
    base_apy: float = 0.0  # Base trading fee APY
    rewards_apy: float = 0.0  # CRV rewards APY
    network: str = 'ethereum'

class CurveService:
    """Curve Finance data collection service"""
    
    def __init__(self, network: str = 'ethereum'):
        self.network = network
        self.rate_limiter = RateLimiter(calls_per_second=6)
        
        # Curve API endpoints
        self.api_bases = {
            'ethereum': 'https://api.curve.fi/api',
            'polygon': 'https://api-polygon.curve.fi/api',
            'arbitrum': 'https://api-arbitrum.curve.fi/api'
        }
        self.api_base = self.api_bases.get(network, self.api_bases['ethereum'])
        
        # Alternative data sources
        self.defillama_api = "https://yields.llama.fi/pools"
        self.coingecko_api = "https://api.coingecko.com/api/v3"
        
        # Pool registries on different networks
        self.registries = {
            'ethereum': {
                'main': '0x90E00ACe148ca3b23Ac1bC8C240C2a7Dd9c2d7f5',
                'factory': '0xB9fC157394Af804a3578134A6585C0dc9cc990d4',
                'crypto': '0x8F942C20D02bEfc377D41445793068908E2250D0'
            },
            'polygon': {
                'factory': '0x722272D36ef0Da72FF51c5A65Db7b870E2e8D4EE'
            },
            'arbitrum': {
                'factory': '0xb17b674D9c5CB2e441F8e196a2f048A81355d031'
            }
        }
    
    @retry_on_failure(max_retries=3)
    async def get_all_pools(self) -> List[CurvePool]:
        """Get all Curve pools from the API"""
        await self.rate_limiter.wait()
        
        async with aiohttp.ClientSession() as session:
            try:
                # Try the official Curve API first
                url = f"{self.api_base}/getPools/all"
                
                async with session.get(url, timeout=config.REQUEST_TIMEOUT) as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        pools = []
                        pool_data = data.get('data', {}).get('poolData', [])
                        
                        for pool_info in pool_data[:config.MAX_POOLS_PER_DEX]:
                            try:
                                pool = self._parse_pool_data(pool_info)
                                if pool and pool.tvl_usd >= config.MIN_TVL_THRESHOLD:
                                    pools.append(pool)
                            except Exception as e:
                                logger.warning(f"Error parsing Curve pool data: {e}")
                                continue
                        
                        logger.info(f"Fetched {len(pools)} Curve pools on {self.network}")
                        return pools
                    else:
                        logger.warning(f"HTTP {response.status} from Curve API, trying fallback")
                        return await self._get_pools_fallback()
                        
            except Exception as e:
                logger.error(f"Error fetching Curve pools: {e}")
                return await self._get_pools_fallback()
    
    def _parse_pool_data(self, pool_info: Dict) -> Optional[CurvePool]:
        """Parse pool data from Curve API response"""
        try:
            # Extract coin information
            coins = []
            coin_addresses = []
            coin_symbols = []
            balances = []
            
            for coin_data in pool_info.get('coins', []):
                coins.append({
                    'address': coin_data.get('address', ''),
                    'symbol': coin_data.get('symbol', ''),
                    'decimals': str(coin_data.get('decimals', 18))
                })
                coin_addresses.append(coin_data.get('address', ''))
                coin_symbols.append(coin_data.get('symbol', ''))
                
                # Pool balances
                balance = float(coin_data.get('poolBalance', 0))
                balances.append(balance)
            
            # Underlying balances for meta pools
            underlying_balances = []
            for coin_data in pool_info.get('underlyingCoins', []):
                balance = float(coin_data.get('poolBalance', 0))
                underlying_balances.append(balance)
            
            # Calculate fees
            volume_24h = float(pool_info.get('volume', 0))
            fee_rate = float(pool_info.get('fee', 0)) / 1e10  # Convert from basis points
            fees_24h = volume_24h * fee_rate
            
            pool = CurvePool(
                address=pool_info.get('address', ''),
                name=pool_info.get('name', ''),
                symbol=pool_info.get('symbol', ''),
                pool_type=self._determine_pool_type(pool_info),
                coins=coins,
                coin_addresses=coin_addresses,
                coin_symbols=coin_symbols,
                balances=balances,
                underlying_balances=underlying_balances or balances,
                total_supply=float(pool_info.get('totalSupply', 0)),
                virtual_price=float(pool_info.get('virtualPrice', 1)),
                amp=pool_info.get('A'),
                fee=fee_rate,
                admin_fee=float(pool_info.get('adminFee', 0)) / 1e10,
                volume_24h=volume_24h,
                fees_24h=fees_24h,
                tvl_usd=float(pool_info.get('usdTotal', 0)),
                network=self.network
            )
            
            # Calculate APY estimates
            if pool.tvl_usd > 0:
                pool.base_apy = (pool.fees_24h * 365) / pool.tvl_usd * 100
                pool.apy = pool.base_apy  # Base APY, will add rewards later
            
            return pool
            
        except (KeyError, ValueError, TypeError) as e:
            logger.warning(f"Error parsing Curve pool data: {e}")
            return None
    
    def _determine_pool_type(self, pool_info: Dict) -> str:
        """Determine the type of Curve pool"""
        if 'factory' in pool_info.get('registryAddress', '').lower():
            return 'factory'
        elif pool_info.get('isMetaPool'):
            return 'meta'
        elif pool_info.get('isCrypto'):
            return 'crypto'
        else:
            return 'stable'
    
    async def _get_pools_fallback(self) -> List[CurvePool]:
        """Fallback method using DeFiLlama API"""
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{self.defillama_api}"
                
                async with session.get(url, timeout=config.REQUEST_TIMEOUT) as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        pools = []
                        curve_pools = [
                            pool for pool in data.get('data', [])
                            if 'curve' in pool.get('project', '').lower()
                            and pool.get('chain') == self.network
                        ]
                        
                        for pool_data in curve_pools[:config.MAX_POOLS_PER_DEX]:
                            pool = self._parse_defillama_pool_data(pool_data)
                            if pool and pool.tvl_usd >= config.MIN_TVL_THRESHOLD:
                                pools.append(pool)
                        
                        logger.info(f"Fetched {len(pools)} Curve pools via DeFiLlama fallback")
                        return pools
                        
        except Exception as e:
            logger.error(f"Fallback API also failed: {e}")
        
        return []
    
    def _parse_defillama_pool_data(self, pool_data: Dict) -> Optional[CurvePool]:
        """Parse pool data from DeFiLlama API"""
        try:
            # Extract symbols from pool name
            symbols = pool_data.get('symbol', '').split('-')
            
            pool = CurvePool(
                address=pool_data.get('pool', ''),
                name=pool_data.get('symbol', ''),
                symbol=pool_data.get('symbol', ''),
                pool_type='unknown',
                coins=[],
                coin_addresses=[],
                coin_symbols=symbols,
                balances=[],
                underlying_balances=[],
                total_supply=0.0,
                virtual_price=1.0,
                amp=None,
                fee=0.0004,  # Default 0.04% fee
                admin_fee=0.5,  # Default 50% admin fee
                tvl_usd=float(pool_data.get('tvlUsd', 0)),
                apy=float(pool_data.get('apy', 0)),
                base_apy=float(pool_data.get('apyBase', 0)),
                rewards_apy=float(pool_data.get('apyReward', 0)),
                network=self.network
            )
            
            return pool
            
        except Exception as e:
            logger.warning(f"Error parsing DeFiLlama pool data: {e}")
            return None
    
    @retry_on_failure(max_retries=3)
    async def get_pool_apy(self, pool_address: str) -> Dict[str, float]:
        """Get detailed APY breakdown for a specific pool"""
        await self.rate_limiter.wait()
        
        async with aiohttp.ClientSession() as session:
            try:
                url = f"{self.api_base}/getSubgraphData/{pool_address}"
                
                async with session.get(url, timeout=config.REQUEST_TIMEOUT) as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        return {
                            'base_apy': float(data.get('baseApy', 0)),
                            'crv_apy': float(data.get('crvApy', 0)),
                            'rewards_apy': float(data.get('rewardsApy', 0)),
                            'total_apy': float(data.get('totalApy', 0))
                        }
                        
            except Exception as e:
                logger.debug(f"Could not fetch APY data for {pool_address}: {e}")
        
        return {'base_apy': 0, 'crv_apy': 0, 'rewards_apy': 0, 'total_apy': 0}
    
    @retry_on_failure(max_retries=2)
    async def get_pool_volume(self, pool_address: str, days: int = 7) -> Dict[str, float]:
        """Get volume statistics for a pool"""
        await self.rate_limiter.wait()
        
        async with aiohttp.ClientSession() as session:
            try:
                url = f"{self.api_base}/getVolume/{pool_address}"
                
                async with session.get(url, timeout=config.REQUEST_TIMEOUT) as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        return {
                            'volume_24h': float(data.get('volume24h', 0)),
                            'volume_7d': float(data.get('volume7d', 0)),
                            'fees_24h': float(data.get('fees24h', 0))
                        }
                        
            except Exception as e:
                logger.debug(f"Could not fetch volume data for {pool_address}: {e}")
        
        return {'volume_24h': 0, 'volume_7d': 0, 'fees_24h': 0}
    
    async def get_stable_pools(self) -> List[CurvePool]:
        """Get only stable pools (USDT, USDC, DAI, etc.)"""
        all_pools = await self.get_all_pools()
        return [pool for pool in all_pools if pool.pool_type == 'stable']
    
    async def get_crypto_pools(self) -> List[CurvePool]:
        """Get only crypto pools (ETH, BTC, etc.)"""
        all_pools = await self.get_all_pools()
        return [pool for pool in all_pools if pool.pool_type == 'crypto']
    
    def calculate_pool_dominance(self, pool: CurvePool) -> Dict[str, float]:
        """Calculate which tokens dominate the pool"""
        if not pool.balances or len(pool.balances) == 0:
            return {}
        
        total_balance = sum(pool.balances)
        if total_balance == 0:
            return {}
        
        dominance = {}
        for i, symbol in enumerate(pool.coin_symbols):
            if i < len(pool.balances):
                dominance[symbol] = (pool.balances[i] / total_balance) * 100
        
        return dominance
    
    def estimate_impermanent_loss_stable(self, price_changes: List[float]) -> float:
        """Estimate impermanent loss for stable pools (should be minimal)"""
        # For stable pools, IL should be very small due to similar asset values
        max_deviation = max(abs(change) for change in price_changes) if price_changes else 0
        return min(max_deviation * 0.1, 1.0)  # Cap at 1% for stable pools

# Create service instances for different networks  
curve_ethereum = CurveService('ethereum')
curve_polygon = CurveService('polygon')
curve_arbitrum = CurveService('arbitrum')