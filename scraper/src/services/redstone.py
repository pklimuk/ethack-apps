import asyncio
import aiohttp
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
import json
from ..utils.helpers import retry_on_failure, RateLimiter, fetch_with_session
from ..utils.logger import logger
from ..config.settings import config

class RedStoneService:
    """RedStone Oracle price data service"""
    
    def __init__(self):
        self.base_url = "https://api.redstone.finance"
        self.cache_url = "https://cache-service.redstone.finance"
        self.rate_limiter = RateLimiter(calls_per_second=5)  # Conservative rate limit
        self.price_cache = {}
        self.cache_ttl = timedelta(minutes=5)  # Cache prices for 5 minutes
    
    @retry_on_failure(max_retries=3)
    async def get_price(self, symbol: str) -> Optional[float]:
        """Get current price for a token"""
        await self.rate_limiter.wait()
        
        # Check cache first
        cache_key = symbol.upper()
        if cache_key in self.price_cache:
            price_data, timestamp = self.price_cache[cache_key]
            if datetime.now() - timestamp < self.cache_ttl:
                return price_data
        
        async with aiohttp.ClientSession() as session:
            url = f"{self.cache_url}/prices"
            params = {
                'symbols': symbol.upper(),
                'provider': 'redstone'
            }
            
            try:
                response = await fetch_with_session(session, url, headers={})
                if response and symbol.upper() in response:
                    price_data = response[symbol.upper()]
                    price = float(price_data.get('value', 0))
                    
                    # Cache the result
                    self.price_cache[cache_key] = (price, datetime.now())
                    
                    logger.debug(f"RedStone price for {symbol}: ${price:.6f}")
                    return price
                else:
                    logger.warning(f"No price data found for {symbol}")
                    return None
                    
            except Exception as e:
                logger.error(f"Error fetching RedStone price for {symbol}: {e}")
                return None
    
    @retry_on_failure(max_retries=3)
    async def get_prices(self, symbols: List[str]) -> Dict[str, float]:
        """Get current prices for multiple tokens"""
        await self.rate_limiter.wait()
        
        # Filter symbols that need fetching (not in cache or expired)
        symbols_to_fetch = []
        results = {}
        
        for symbol in symbols:
            cache_key = symbol.upper()
            if cache_key in self.price_cache:
                price_data, timestamp = self.price_cache[cache_key]
                if datetime.now() - timestamp < self.cache_ttl:
                    results[symbol] = price_data
                    continue
            symbols_to_fetch.append(symbol.upper())
        
        if not symbols_to_fetch:
            return results
        
        async with aiohttp.ClientSession() as session:
            url = f"{self.cache_url}/prices"
            params = {
                'symbols': ','.join(symbols_to_fetch),
                'provider': 'redstone'
            }
            
            try:
                response = await fetch_with_session(session, url, headers={})
                if response:
                    for symbol in symbols_to_fetch:
                        if symbol in response:
                            price_data = response[symbol]
                            price = float(price_data.get('value', 0))
                            
                            # Cache the result
                            self.price_cache[symbol] = (price, datetime.now())
                            results[symbol.lower()] = price
                        else:
                            logger.warning(f"No price data found for {symbol}")
                            results[symbol.lower()] = None
                
                logger.info(f"Fetched RedStone prices for {len(results)} tokens")
                return results
                
            except Exception as e:
                logger.error(f"Error fetching RedStone prices: {e}")
                return {symbol.lower(): None for symbol in symbols}
    
    @retry_on_failure(max_retries=3)
    async def get_historical_price(self, symbol: str, timestamp: int) -> Optional[float]:
        """Get historical price for a token at specific timestamp"""
        await self.rate_limiter.wait()
        
        async with aiohttp.ClientSession() as session:
            url = f"{self.base_url}/prices/historical"
            params = {
                'symbol': symbol.upper(),
                'timestamp': timestamp,
                'provider': 'redstone'
            }
            
            try:
                response = await fetch_with_session(session, url, headers={})
                if response and 'value' in response:
                    price = float(response['value'])
                    logger.debug(f"Historical RedStone price for {symbol}: ${price:.6f}")
                    return price
                else:
                    logger.warning(f"No historical price data found for {symbol}")
                    return None
                    
            except Exception as e:
                logger.error(f"Error fetching historical RedStone price for {symbol}: {e}")
                return None
    
    async def get_supported_tokens(self) -> List[str]:
        """Get list of supported tokens"""
        async with aiohttp.ClientSession() as session:
            url = f"{self.cache_url}/tokens"
            
            try:
                response = await fetch_with_session(session, url, headers={})
                if response and isinstance(response, list):
                    logger.info(f"RedStone supports {len(response)} tokens")
                    return response
                elif response and 'tokens' in response:
                    tokens = response['tokens']
                    logger.info(f"RedStone supports {len(tokens)} tokens")
                    return tokens
                else:
                    logger.warning("Could not fetch supported tokens list")
                    return self._get_default_tokens()
                    
            except Exception as e:
                logger.error(f"Error fetching supported tokens: {e}")
                return self._get_default_tokens()
    
    def _get_default_tokens(self) -> List[str]:
        """Return default list of commonly supported tokens"""
        return [
            'ETH', 'BTC', 'USDT', 'USDC', 'DAI', 'WETH', 'WBTC',
            'UNI', 'LINK', 'AAVE', 'SUSHI', 'CRV', 'COMP', 'MKR',
            'YFI', 'CAKE', 'BNB', 'MATIC', 'AVAX', 'FTM', 'ATOM'
        ]
    
    async def get_token_price_batch(self, token_addresses: List[Tuple[str, str]]) -> Dict[str, float]:
        """
        Get prices for tokens by their addresses
        token_addresses: List of (symbol, address) tuples
        """
        # RedStone typically works with symbols rather than addresses
        # For now, we'll use the symbols provided
        symbols = [symbol for symbol, address in token_addresses]
        return await self.get_prices(symbols)
    
    def clear_cache(self):
        """Clear the price cache"""
        self.price_cache.clear()
        logger.info("RedStone price cache cleared")

# Global instance
redstone_service = RedStoneService()