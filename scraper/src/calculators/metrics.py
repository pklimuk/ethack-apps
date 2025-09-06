import math
from typing import Dict, List, Optional, Tuple, Union
from dataclasses import dataclass
from ..services.redstone import redstone_service
from ..services.uniswap_v3 import UniswapV3Pool
from ..services.sushiswap import SushiSwapPool
from ..services.curve import CurvePool
from ..services.pancakeswap import PancakeSwapPool
from ..utils.helpers import safe_div, calculate_apy, estimate_impermanent_loss
from ..utils.logger import logger

@dataclass
class PoolMetrics:
    """Standardized pool metrics across all DEXs"""
    protocol: str
    network: str
    pool_address: str
    pool_name: str
    token0_symbol: str
    token1_symbol: str
    token0_price: float
    token1_price: float
    token0_reserve: float
    token1_reserve: float
    tvl_usd: float
    volume_24h: float
    volume_7d: float
    fees_24h: float
    apr_base: float  # Base APR from trading fees
    apr_rewards: float  # Additional rewards APR
    apy_base: float  # Compounded base APY
    apy_total: float  # Total APY including rewards
    impermanent_loss_1d: float
    impermanent_loss_7d: float
    sharpe_ratio: Optional[float]
    risk_score: float
    liquidity_depth: float
    price_impact_1pct: float
    last_updated: str

class MetricsCalculator:
    """Advanced metrics calculator for liquidity pools"""
    
    def __init__(self):
        self.risk_free_rate = 0.05  # 5% risk-free rate assumption
    
    async def calculate_pool_metrics(self, pool: Union[UniswapV3Pool, SushiSwapPool, CurvePool, PancakeSwapPool]) -> PoolMetrics:
        """Calculate comprehensive metrics for any pool type"""
        
        # Get token prices from RedStone
        token_prices = await self._get_token_prices(pool)
        
        # Calculate base metrics
        tvl_usd = self._calculate_tvl(pool, token_prices)
        apr_base = self._calculate_base_apr(pool, tvl_usd)
        apy_base = calculate_apy(apr_base)
        
        # Get additional APR from rewards (protocol-specific)
        apr_rewards = self._get_rewards_apr(pool)
        apy_total = calculate_apy(apr_base + apr_rewards)
        
        # Calculate risk metrics
        impermanent_loss_1d = self._estimate_impermanent_loss(pool, days=1)
        impermanent_loss_7d = self._estimate_impermanent_loss(pool, days=7)
        sharpe_ratio = self._calculate_sharpe_ratio(apy_total, impermanent_loss_7d)
        risk_score = self._calculate_risk_score(pool, impermanent_loss_7d, tvl_usd)
        
        # Calculate liquidity metrics
        liquidity_depth = self._calculate_liquidity_depth(pool, tvl_usd)
        price_impact = self._estimate_price_impact(pool, percent=1.0)
        
        return PoolMetrics(
            protocol=self._get_protocol_name(pool),
            network=getattr(pool, 'network', 'ethereum'),
            pool_address=pool.address,
            pool_name=self._get_pool_name(pool),
            token0_symbol=self._get_token0_symbol(pool),
            token1_symbol=self._get_token1_symbol(pool),
            token0_price=token_prices.get(self._get_token0_symbol(pool).lower(), 0.0),
            token1_price=token_prices.get(self._get_token1_symbol(pool).lower(), 0.0),
            token0_reserve=self._get_token0_reserve(pool),
            token1_reserve=self._get_token1_reserve(pool),
            tvl_usd=tvl_usd,
            volume_24h=getattr(pool, 'volume_24h', 0.0),
            volume_7d=getattr(pool, 'volume_7d', 0.0),
            fees_24h=getattr(pool, 'fees_24h', 0.0),
            apr_base=apr_base,
            apr_rewards=apr_rewards,
            apy_base=apy_base,
            apy_total=apy_total,
            impermanent_loss_1d=impermanent_loss_1d,
            impermanent_loss_7d=impermanent_loss_7d,
            sharpe_ratio=sharpe_ratio,
            risk_score=risk_score,
            liquidity_depth=liquidity_depth,
            price_impact_1pct=price_impact,
            last_updated=str(pd.Timestamp.now())
        )
    
    async def _get_token_prices(self, pool) -> Dict[str, float]:
        """Get token prices for pool assets"""
        token0_symbol = self._get_token0_symbol(pool)
        token1_symbol = self._get_token1_symbol(pool)
        
        symbols = [token0_symbol, token1_symbol]
        try:
            prices = await redstone_service.get_prices(symbols)
            logger.debug(f"Fetched prices for {symbols}: {prices}")
            return prices
        except Exception as e:
            logger.warning(f"Error fetching prices for {symbols}: {e}")
            return {symbol.lower(): 0.0 for symbol in symbols}
    
    def _calculate_tvl(self, pool, token_prices: Dict[str, float]) -> float:
        """Calculate Total Value Locked in USD"""
        if hasattr(pool, 'tvl_usd') and pool.tvl_usd > 0:
            return pool.tvl_usd
        
        # Calculate from reserves and prices
        token0_symbol = self._get_token0_symbol(pool).lower()
        token1_symbol = self._get_token1_symbol(pool).lower()
        token0_reserve = self._get_token0_reserve(pool)
        token1_reserve = self._get_token1_reserve(pool)
        
        token0_price = token_prices.get(token0_symbol, 0.0)
        token1_price = token_prices.get(token1_symbol, 0.0)
        
        tvl = (token0_reserve * token0_price) + (token1_reserve * token1_price)
        return tvl
    
    def _calculate_base_apr(self, pool, tvl_usd: float) -> float:
        """Calculate base APR from trading fees"""
        if hasattr(pool, 'fees_24h') and pool.fees_24h > 0 and tvl_usd > 0:
            return (pool.fees_24h * 365) / tvl_usd * 100
        
        # Estimate from volume and fee rate
        volume_24h = getattr(pool, 'volume_24h', 0.0)
        fee_rate = self._get_fee_rate(pool)
        
        if volume_24h > 0 and tvl_usd > 0:
            fees_24h = volume_24h * fee_rate
            return (fees_24h * 365) / tvl_usd * 100
        
        return 0.0
    
    def _get_fee_rate(self, pool) -> float:
        """Get trading fee rate for the pool"""
        if isinstance(pool, UniswapV3Pool):
            return pool.fee / 1000000  # Convert from basis points
        elif isinstance(pool, SushiSwapPool):
            return 0.003  # 0.3%
        elif isinstance(pool, CurvePool):
            return getattr(pool, 'fee', 0.0004)  # Default 0.04%
        elif isinstance(pool, PancakeSwapPool):
            return 0.0025  # 0.25%
        else:
            return 0.003  # Default 0.3%
    
    def _get_rewards_apr(self, pool) -> float:
        """Get additional rewards APR (protocol-specific)"""
        if isinstance(pool, CurvePool):
            return getattr(pool, 'rewards_apy', 0.0)
        elif isinstance(pool, PancakeSwapPool):
            return getattr(pool, 'farm_apy', 0.0)
        else:
            return 0.0
    
    def _estimate_impermanent_loss(self, pool, days: int) -> float:
        """Estimate impermanent loss over specified period"""
        # This is a simplified estimation
        # In reality, would need historical price data
        
        if isinstance(pool, CurvePool):
            return 0.1  # Stable pools have minimal IL
        
        # Estimate based on pool type and volatility
        token0_symbol = self._get_token0_symbol(pool)
        token1_symbol = self._get_token1_symbol(pool)
        
        # Higher IL for volatile pairs
        volatile_tokens = {'ETH', 'BTC', 'MATIC', 'AVAX', 'FTM'}
        stable_tokens = {'USDT', 'USDC', 'DAI', 'BUSD'}
        
        if (token0_symbol in stable_tokens and token1_symbol in stable_tokens):
            return 0.1 * days  # Very low IL for stable-stable pairs
        elif (token0_symbol in stable_tokens or token1_symbol in stable_tokens):
            return 1.0 * days  # Moderate IL for stable-volatile pairs
        else:
            return 2.0 * days  # Higher IL for volatile-volatile pairs
    
    def _calculate_sharpe_ratio(self, apy: float, risk: float) -> Optional[float]:
        """Calculate Sharpe ratio for the pool"""
        if risk <= 0:
            return None
        
        excess_return = apy - (self.risk_free_rate * 100)
        return excess_return / risk
    
    def _calculate_risk_score(self, pool, impermanent_loss: float, tvl_usd: float) -> float:
        """Calculate overall risk score (0-100, lower is better)"""
        risk_factors = []
        
        # IL risk (0-40 points)
        il_risk = min(impermanent_loss * 2, 40)
        risk_factors.append(il_risk)
        
        # TVL risk (0-30 points) - lower TVL = higher risk
        if tvl_usd > 50_000_000:  # > $50M
            tvl_risk = 0
        elif tvl_usd > 10_000_000:  # $10M - $50M
            tvl_risk = 10
        elif tvl_usd > 1_000_000:  # $1M - $10M
            tvl_risk = 20
        else:  # < $1M
            tvl_risk = 30
        risk_factors.append(tvl_risk)
        
        # Protocol risk (0-20 points)
        protocol_name = self._get_protocol_name(pool)
        if protocol_name in ['Uniswap V3', 'Curve']:
            protocol_risk = 0  # Established protocols
        elif protocol_name in ['SushiSwap']:
            protocol_risk = 5
        else:
            protocol_risk = 15
        risk_factors.append(protocol_risk)
        
        # Network risk (0-10 points)
        network = getattr(pool, 'network', 'ethereum')
        if network == 'ethereum':
            network_risk = 0
        elif network in ['polygon', 'arbitrum']:
            network_risk = 3
        else:
            network_risk = 7
        risk_factors.append(network_risk)
        
        return min(sum(risk_factors), 100)
    
    def _calculate_liquidity_depth(self, pool, tvl_usd: float) -> float:
        """Calculate liquidity depth score"""
        # Higher TVL = better liquidity depth
        if tvl_usd > 100_000_000:
            return 10.0  # Excellent
        elif tvl_usd > 50_000_000:
            return 8.0   # Very Good
        elif tvl_usd > 10_000_000:
            return 6.0   # Good
        elif tvl_usd > 1_000_000:
            return 4.0   # Fair
        else:
            return 2.0   # Poor
    
    def _estimate_price_impact(self, pool, percent: float) -> float:
        """Estimate price impact for a given percentage trade"""
        tvl_usd = getattr(pool, 'tvl_usd', 0)
        if tvl_usd == 0:
            return 100.0  # Maximum impact if no liquidity
        
        # Simplified price impact calculation
        # Real calculation would depend on pool curve and reserves
        trade_size = tvl_usd * (percent / 100)
        
        if isinstance(pool, CurvePool):
            # Stable pools have lower price impact due to amplification
            return (trade_size / tvl_usd) * 0.1
        elif isinstance(pool, UniswapV3Pool):
            # Concentrated liquidity can have varying impact
            return (trade_size / tvl_usd) * 0.5
        else:
            # Standard AMM price impact
            return (trade_size / tvl_usd) * 0.3
    
    # Helper methods for different pool types
    def _get_protocol_name(self, pool) -> str:
        if isinstance(pool, UniswapV3Pool):
            return "Uniswap V3"
        elif isinstance(pool, SushiSwapPool):
            return "SushiSwap"
        elif isinstance(pool, CurvePool):
            return "Curve"
        elif isinstance(pool, PancakeSwapPool):
            return "PancakeSwap"
        else:
            return "Unknown"
    
    def _get_pool_name(self, pool) -> str:
        token0 = self._get_token0_symbol(pool)
        token1 = self._get_token1_symbol(pool)
        
        if isinstance(pool, UniswapV3Pool):
            fee_tier = pool.fee / 10000  # Convert to percentage
            return f"{token0}/{token1} {fee_tier}%"
        elif isinstance(pool, CurvePool):
            return pool.name or f"{token0}/{token1}"
        else:
            return f"{token0}/{token1}"
    
    def _get_token0_symbol(self, pool) -> str:
        if isinstance(pool, CurvePool) and pool.coin_symbols:
            return pool.coin_symbols[0]
        return getattr(pool, 'token0_symbol', '')
    
    def _get_token1_symbol(self, pool) -> str:
        if isinstance(pool, CurvePool) and len(pool.coin_symbols) > 1:
            return pool.coin_symbols[1]
        return getattr(pool, 'token1_symbol', '')
    
    def _get_token0_reserve(self, pool) -> float:
        if isinstance(pool, CurvePool) and pool.balances:
            return pool.balances[0]
        return getattr(pool, 'token0_reserve', 0.0)
    
    def _get_token1_reserve(self, pool) -> float:
        if isinstance(pool, CurvePool) and len(pool.balances) > 1:
            return pool.balances[1]
        return getattr(pool, 'token1_reserve', 0.0)

# Global calculator instance
import pandas as pd  # For timestamp
metrics_calculator = MetricsCalculator()