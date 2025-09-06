#!/usr/bin/env python3
"""
RedStone-Only Liquidity Pool Analysis
Quick implementation using just RedStone data for immediate Excel generation
"""

import asyncio
import sys
from pathlib import Path
from typing import List, Dict
from dataclasses import dataclass
import pandas as pd
from datetime import datetime

# Add src to Python path
sys.path.append(str(Path(__file__).parent / 'src'))

from src.services.redstone import redstone_service
from src.exporters.excel import excel_exporter
from src.utils.logger import logger

@dataclass
class MockPool:
    """Mock pool data structure for RedStone testing"""
    protocol: str
    network: str
    pool_address: str
    pool_name: str
    token0_symbol: str
    token1_symbol: str
    token0_price: float = 0.0
    token1_price: float = 0.0
    token0_reserve: float = 1000000.0  # Mock 1M tokens
    token1_reserve: float = 1000000.0  # Mock 1M tokens
    tvl_usd: float = 0.0
    volume_24h: float = 50000.0
    fees_24h: float = 150.0
    apr_base: float = 0.0
    apy_total: float = 0.0
    risk_score: float = 25.0
    impermanent_loss_7d: float = 2.0

# Popular token pairs to get real RedStone prices for
POPULAR_PAIRS = [
    ("ETH", "USDC", "Uniswap V3", "ethereum", "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640"),
    ("BTC", "ETH", "Uniswap V3", "ethereum", "0x4585fe77225b41b697c938b018e2ac67ac5a20c0"),
    ("USDC", "USDT", "Curve", "ethereum", "0xa3c5a1e09150b75ff251c1a7815a07182c3de2fb"),
    ("ETH", "USDT", "SushiSwap", "ethereum", "0x06da0fd433c1a5d7a4faa01111c044910a184553"),
    ("MATIC", "ETH", "Uniswap V3", "polygon", "0x167384319b41f7094e62f7506409eb38079abff8"),
    ("AVAX", "USDC", "PancakeSwap", "avalanche", "0xf4003f4efbe8691b60249e6afbd307abe7758adb"),
    ("BNB", "BUSD", "PancakeSwap", "bsc", "0x58f876857a02d6762e0101bb5c46a8c1ed44dc16"),
    ("LINK", "ETH", "Uniswap V3", "ethereum", "0xa6cc3c2531fdaa6ae1a3ca84c2855806728693e8"),
    ("UNI", "ETH", "Uniswap V3", "ethereum", "0x1d42064fc4beb5f8aaf85f4617ae8b3b5b8bd801"),
    ("AAVE", "ETH", "SushiSwap", "ethereum", "0xd75ea151a61d06868e31f8988d28dff5e9df57b4"),
]

async def create_mock_pools_with_real_prices() -> List[MockPool]:
    """Create mock pools with real RedStone prices"""
    logger.info("🔄 Creating mock pools with real RedStone prices...")
    
    pools = []
    
    for i, (token0, token1, protocol, network, address) in enumerate(POPULAR_PAIRS):
        try:
            # Get real prices from RedStone
            prices = await redstone_service.get_prices([token0, token1])
            token0_price = prices.get(token0.lower(), 1.0)
            token1_price = prices.get(token1.lower(), 1.0)
            
            logger.info(f"✅ Got prices: {token0}=${token0_price:.2f}, {token1}=${token1_price:.2f}")
            
            # Create mock pool with real prices
            pool = MockPool(
                protocol=protocol,
                network=network,
                pool_address=address,
                pool_name=f"{token0}/{token1}",
                token0_symbol=token0,
                token1_symbol=token1,
                token0_price=token0_price,
                token1_price=token1_price,
                token0_reserve=1000000 * (1.2 ** i),  # Varied reserves
                token1_reserve=1000000 * (1.1 ** i),
                volume_24h=50000 * (1.5 ** i),
                fees_24h=150 * (1.3 ** i),
            )
            
            # Calculate TVL
            pool.tvl_usd = (pool.token0_reserve * token0_price) + (pool.token1_reserve * token1_price)
            
            # Calculate APR (fees/TVL * 365)
            if pool.tvl_usd > 0:
                pool.apr_base = (pool.fees_24h * 365) / pool.tvl_usd * 100
                pool.apy_total = pool.apr_base * 1.1  # Add small compounding effect
            
            pools.append(pool)
            
            # Brief pause between requests
            await asyncio.sleep(0.5)
            
        except Exception as e:
            logger.error(f"❌ Error creating pool {token0}/{token1}: {e}")
            continue
    
    logger.info(f"✅ Created {len(pools)} mock pools with real prices")
    return pools

def convert_to_pool_metrics(pools: List[MockPool]):
    """Convert mock pools to PoolMetrics format for Excel export"""
    from src.calculators.metrics import PoolMetrics
    
    metrics = []
    for pool in pools:
        metric = PoolMetrics(
            protocol=pool.protocol,
            network=pool.network,
            pool_address=pool.pool_address,
            pool_name=pool.pool_name,
            token0_symbol=pool.token0_symbol,
            token1_symbol=pool.token1_symbol,
            token0_price=pool.token0_price,
            token1_price=pool.token1_price,
            token0_reserve=pool.token0_reserve,
            token1_reserve=pool.token1_reserve,
            tvl_usd=pool.tvl_usd,
            volume_24h=pool.volume_24h,
            volume_7d=pool.volume_24h * 7,
            fees_24h=pool.fees_24h,
            apr_base=pool.apr_base,
            apr_rewards=0.0,
            apy_base=pool.apr_base,
            apy_total=pool.apy_total,
            impermanent_loss_1d=pool.impermanent_loss_7d / 7,
            impermanent_loss_7d=pool.impermanent_loss_7d,
            sharpe_ratio=pool.apy_total / pool.risk_score if pool.risk_score > 0 else None,
            risk_score=pool.risk_score,
            liquidity_depth=8.0 if pool.tvl_usd > 1000000 else 5.0,
            price_impact_1pct=0.5,
            last_updated=str(pd.Timestamp.now())
        )
        metrics.append(metric)
    
    return metrics

async def main():
    """Main function for RedStone-only analysis"""
    logger.info("🚀 Starting RedStone-Only Liquidity Pool Analysis")
    
    try:
        # Step 1: Create mock pools with real RedStone prices
        mock_pools = await create_mock_pools_with_real_prices()
        
        if not mock_pools:
            logger.error("❌ No pools created - cannot proceed")
            return 1
        
        # Step 2: Convert to metrics format
        logger.info("🧮 Converting to metrics format...")
        all_metrics = convert_to_pool_metrics(mock_pools)
        
        # Step 3: Organize by protocol
        protocol_breakdown = {}
        for metrics in all_metrics:
            protocol = metrics.protocol
            if protocol not in protocol_breakdown:
                protocol_breakdown[protocol] = []
            protocol_breakdown[protocol].append(metrics)
        
        # Sort each protocol's pools by TVL
        for protocol in protocol_breakdown:
            protocol_breakdown[protocol].sort(key=lambda x: x.tvl_usd, reverse=True)
        
        # Step 4: Generate Excel report
        logger.info("📊 Generating Excel report with real RedStone data...")
        filename = excel_exporter.create_comprehensive_report(all_metrics, protocol_breakdown)
        
        # Step 5: Print summary
        print_summary(all_metrics, protocol_breakdown)
        
        logger.info(f"🎉 RedStone analysis complete! Report saved to: {filename}")
        print(f"\n✅ Excel report generated: {filename}")
        return 0
        
    except Exception as e:
        logger.error(f"❌ Analysis failed: {e}")
        return 1

def print_summary(all_metrics, protocol_breakdown):
    """Print summary to console"""
    print("\n" + "="*60)
    print("🎯 REDSTONE LIQUIDITY POOL ANALYSIS")
    print("="*60)
    
    total_tvl = sum(m.tvl_usd for m in all_metrics)
    avg_apy = sum(m.apy_total for m in all_metrics) / len(all_metrics) if all_metrics else 0
    
    print(f"📊 Pools Analyzed: {len(all_metrics)}")
    print(f"💰 Total TVL: ${total_tvl:,.2f}")
    print(f"📈 Average APY: {avg_apy:.2f}%")
    
    print("\n" + "-"*40)
    print("🏆 TOP 3 POOLS BY TVL")
    print("-"*40)
    
    top_pools = sorted(all_metrics, key=lambda x: x.tvl_usd, reverse=True)[:3]
    for i, pool in enumerate(top_pools, 1):
        print(f"{i}. {pool.pool_name} ({pool.protocol})")
        print(f"   TVL: ${pool.tvl_usd:,.2f} | APY: {pool.apy_total:.2f}%")
    
    print("\n" + "="*60)

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))