#!/usr/bin/env python3
"""
Liquidity Pool Scraper - Main Orchestration Script

This script coordinates the collection of liquidity pool data from major DEXs,
calculates APY/TVL metrics using RedStone price feeds, and exports the results to Excel.

Usage:
    python main.py [--networks ethereum,polygon] [--protocols uniswap,sushiswap,curve,pancakeswap]
"""

import asyncio
import argparse
import sys
from typing import List, Dict
from pathlib import Path

# Add src to Python path
sys.path.append(str(Path(__file__).parent / 'src'))

from src.services.redstone import redstone_service
from src.services.uniswap_v3 import uniswap_ethereum, uniswap_polygon, uniswap_arbitrum
from src.services.sushiswap import sushiswap_ethereum, sushiswap_polygon, sushiswap_arbitrum
from src.services.curve import curve_ethereum, curve_polygon, curve_arbitrum
from src.services.pancakeswap import pancakeswap_service
from src.calculators.metrics import metrics_calculator, PoolMetrics
from src.exporters.excel import excel_exporter
from src.config.settings import config
from src.utils.logger import logger
from src.utils.helpers import format_currency, format_percentage

class LiquidityPoolScraper:
    """Main orchestration class for liquidity pool data collection"""
    
    def __init__(self, networks: List[str] = None, protocols: List[str] = None):
        self.networks = networks or ['ethereum', 'polygon', 'arbitrum', 'bsc']
        self.protocols = protocols or ['uniswap', 'sushiswap', 'curve', 'pancakeswap']
        
        # Service mappings
        self.services = {
            'uniswap': {
                'ethereum': uniswap_ethereum,
                'polygon': uniswap_polygon,
                'arbitrum': uniswap_arbitrum
            },
            'sushiswap': {
                'ethereum': sushiswap_ethereum,
                'polygon': sushiswap_polygon,
                'arbitrum': sushiswap_arbitrum
            },
            'curve': {
                'ethereum': curve_ethereum,
                'polygon': curve_polygon,
                'arbitrum': curve_arbitrum
            },
            'pancakeswap': {
                'bsc': pancakeswap_service
            }
        }
    
    async def run_complete_analysis(self) -> str:
        """Run the complete analysis pipeline"""
        logger.info("🚀 Starting Liquidity Pool Analysis Pipeline")
        logger.info(f"📊 Networks: {', '.join(self.networks)}")
        logger.info(f"🔄 Protocols: {', '.join(self.protocols)}")
        
        try:
            # Step 1: Collect pool data
            all_pools = await self.collect_all_pool_data()
            logger.info(f"✅ Collected {len(all_pools)} pools across all protocols")
            
            if not all_pools:
                logger.error("❌ No pools collected - cannot proceed with analysis")
                return None
            
            # Step 2: Calculate metrics for all pools
            logger.info("🧮 Calculating comprehensive metrics...")
            all_metrics = await self.calculate_all_metrics(all_pools)
            logger.info(f"✅ Calculated metrics for {len(all_metrics)} pools")
            
            # Step 3: Organize by protocol for detailed analysis
            protocol_breakdown = self.organize_by_protocol(all_metrics)
            
            # Step 4: Generate Excel report
            logger.info("📊 Generating Excel report...")
            filename = excel_exporter.create_comprehensive_report(all_metrics, protocol_breakdown)
            
            # Step 5: Print summary
            self.print_summary(all_metrics, protocol_breakdown)
            
            logger.info(f"🎉 Analysis complete! Report saved to: {filename}")
            return filename
            
        except Exception as e:
            logger.error(f"❌ Analysis pipeline failed: {e}")
            raise
    
    async def collect_all_pool_data(self) -> List:
        """Collect pool data from all specified protocols and networks"""
        all_pools = []
        
        for protocol in self.protocols:
            if protocol not in self.services:
                logger.warning(f"⚠️  Unknown protocol: {protocol}")
                continue
                
            protocol_services = self.services[protocol]
            
            for network in self.networks:
                if network not in protocol_services:
                    continue
                    
                logger.info(f"📡 Fetching {protocol} pools on {network}...")
                
                try:
                    service = protocol_services[network]
                    
                    # Different methods based on protocol
                    if protocol == 'uniswap':
                        pools = await service.get_top_pools(limit=config.MAX_POOLS_PER_DEX)
                    elif protocol == 'sushiswap':
                        pools = await service.get_top_pools(limit=config.MAX_POOLS_PER_DEX)
                    elif protocol == 'curve':
                        pools = await service.get_all_pools()
                    elif protocol == 'pancakeswap':
                        pools = await service.get_top_pools(limit=config.MAX_POOLS_PER_DEX)
                    
                    logger.info(f"✅ {protocol}/{network}: {len(pools)} pools")
                    all_pools.extend(pools)
                    
                    # Brief pause between requests
                    await asyncio.sleep(1)
                    
                except Exception as e:
                    logger.error(f"❌ Error fetching {protocol}/{network}: {e}")
                    continue
        
        return all_pools
    
    async def calculate_all_metrics(self, all_pools: List) -> List[PoolMetrics]:
        """Calculate comprehensive metrics for all pools"""
        all_metrics = []
        
        # Process pools in batches to avoid overwhelming APIs
        batch_size = 10
        for i in range(0, len(all_pools), batch_size):
            batch = all_pools[i:i + batch_size]
            
            logger.info(f"🔄 Processing batch {i//batch_size + 1}/{(len(all_pools) - 1)//batch_size + 1}")
            
            batch_tasks = []
            for pool in batch:
                task = metrics_calculator.calculate_pool_metrics(pool)
                batch_tasks.append(task)
            
            try:
                batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)
                
                for result in batch_results:
                    if isinstance(result, Exception):
                        logger.warning(f"⚠️  Metric calculation failed: {result}")
                        continue
                    if result:
                        all_metrics.append(result)
                        
            except Exception as e:
                logger.error(f"❌ Batch processing failed: {e}")
            
            # Pause between batches
            await asyncio.sleep(2)
        
        return all_metrics
    
    def organize_by_protocol(self, all_metrics: List[PoolMetrics]) -> Dict[str, List[PoolMetrics]]:
        """Organize metrics by protocol for detailed analysis"""
        protocol_breakdown = {}
        
        for metrics in all_metrics:
            protocol = metrics.protocol
            if protocol not in protocol_breakdown:
                protocol_breakdown[protocol] = []
            protocol_breakdown[protocol].append(metrics)
        
        # Sort each protocol's pools by TVL
        for protocol in protocol_breakdown:
            protocol_breakdown[protocol].sort(key=lambda x: x.tvl_usd, reverse=True)
        
        return protocol_breakdown
    
    def print_summary(self, all_metrics: List[PoolMetrics], 
                     protocol_breakdown: Dict[str, List[PoolMetrics]]):
        """Print summary statistics to console"""
        
        print("\n" + "="*80)
        print("🎯 LIQUIDITY POOL ANALYSIS SUMMARY")
        print("="*80)
        
        # Overall statistics
        total_tvl = sum(m.tvl_usd for m in all_metrics)
        total_volume = sum(m.volume_24h for m in all_metrics)
        avg_apy = sum(m.apy_total for m in all_metrics) / len(all_metrics) if all_metrics else 0
        
        print(f"📊 Total Pools Analyzed: {len(all_metrics)}")
        print(f"💰 Total TVL: {format_currency(total_tvl)}")
        print(f"📈 Total 24h Volume: {format_currency(total_volume)}")
        print(f"📊 Average APY: {format_percentage(avg_apy)}")
        
        print("\n" + "-"*60)
        print("🏆 TOP 5 POOLS BY TVL")
        print("-"*60)
        
        top_pools = sorted(all_metrics, key=lambda x: x.tvl_usd, reverse=True)[:5]
        for i, pool in enumerate(top_pools, 1):
            print(f"{i}. {pool.pool_name} ({pool.protocol})")
            print(f"   TVL: {format_currency(pool.tvl_usd)} | APY: {format_percentage(pool.apy_total)}")
        
        print("\n" + "-"*60)
        print("🚀 TOP 5 POOLS BY APY")
        print("-"*60)
        
        top_apy = sorted(all_metrics, key=lambda x: x.apy_total, reverse=True)[:5]
        for i, pool in enumerate(top_apy, 1):
            print(f"{i}. {pool.pool_name} ({pool.protocol})")
            print(f"   APY: {format_percentage(pool.apy_total)} | TVL: {format_currency(pool.tvl_usd)} | Risk: {pool.risk_score:.1f}")
        
        print("\n" + "-"*60)
        print("📈 PROTOCOL BREAKDOWN")
        print("-"*60)
        
        for protocol, pools in protocol_breakdown.items():
            protocol_tvl = sum(p.tvl_usd for p in pools)
            protocol_apy = sum(p.apy_total for p in pools) / len(pools) if pools else 0
            print(f"{protocol}: {len(pools)} pools | TVL: {format_currency(protocol_tvl)} | Avg APY: {format_percentage(protocol_apy)}")
        
        print("\n" + "="*80)

async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Liquidity Pool Scraper and Analyzer')
    parser.add_argument('--networks', type=str, default='ethereum,polygon,arbitrum,bsc',
                       help='Comma-separated list of networks (ethereum,polygon,arbitrum,bsc)')
    parser.add_argument('--protocols', type=str, default='uniswap,sushiswap,curve,pancakeswap',
                       help='Comma-separated list of protocols (uniswap,sushiswap,curve,pancakeswap)')
    parser.add_argument('--min-tvl', type=int, default=None,
                       help='Minimum TVL threshold (overrides config)')
    parser.add_argument('--max-pools', type=int, default=None,
                       help='Maximum pools per DEX (overrides config)')
    
    args = parser.parse_args()
    
    # Parse arguments
    networks = [n.strip() for n in args.networks.split(',')]
    protocols = [p.strip() for p in args.protocols.split(',')]
    
    # Override config if specified
    if args.min_tvl:
        config.MIN_TVL_THRESHOLD = args.min_tvl
    if args.max_pools:
        config.MAX_POOLS_PER_DEX = args.max_pools
    
    # Initialize and run scraper
    scraper = LiquidityPoolScraper(networks=networks, protocols=protocols)
    
    try:
        filename = await scraper.run_complete_analysis()
        if filename:
            print(f"\n✅ Analysis complete! Excel report saved to: {filename}")
            return 0
        else:
            print("\n❌ Analysis failed - no data collected")
            return 1
            
    except KeyboardInterrupt:
        print("\n⚠️  Analysis interrupted by user")
        return 1
    except Exception as e:
        logger.error(f"❌ Fatal error: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))