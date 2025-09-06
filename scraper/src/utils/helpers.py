import asyncio
import aiohttp
import time
from typing import Any, Dict, List, Optional
from functools import wraps
from decimal import Decimal, ROUND_HALF_UP
from ..config.settings import config
from .logger import logger

def retry_on_failure(max_retries: int = None, delay: float = 1.0):
    """Decorator to retry function calls on failure"""
    if max_retries is None:
        max_retries = config.MAX_RETRIES
        
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None
            for attempt in range(max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    if attempt < max_retries:
                        logger.warning(f"Attempt {attempt + 1} failed for {func.__name__}: {str(e)}")
                        await asyncio.sleep(delay * (2 ** attempt))  # Exponential backoff
                    else:
                        logger.error(f"All {max_retries + 1} attempts failed for {func.__name__}")
            raise last_exception
        return wrapper
    return decorator

def format_currency(amount: float, decimals: int = 2) -> str:
    """Format currency amount with proper decimal places"""
    if amount is None:
        return "N/A"
    
    if amount >= 1_000_000_000:
        return f"${amount / 1_000_000_000:.{decimals}f}B"
    elif amount >= 1_000_000:
        return f"${amount / 1_000_000:.{decimals}f}M"
    elif amount >= 1_000:
        return f"${amount / 1_000:.{decimals}f}K"
    else:
        return f"${amount:.{decimals}f}"

def format_percentage(value: float, decimals: int = 2) -> str:
    """Format percentage with proper decimal places"""
    if value is None:
        return "N/A"
    return f"{value:.{decimals}f}%"

def calculate_apy(apr: float) -> float:
    """Convert APR to APY assuming daily compounding"""
    if apr is None or apr <= 0:
        return 0
    
    # APY = (1 + APR/365)^365 - 1
    daily_rate = apr / 365
    apy = ((1 + daily_rate) ** 365) - 1
    return apy * 100

def safe_div(numerator: float, denominator: float, default: float = 0) -> float:
    """Safe division with default value for zero denominator"""
    if denominator == 0 or denominator is None:
        return default
    return numerator / denominator

def normalize_token_address(address: str) -> str:
    """Normalize token address to lowercase with checksum"""
    if not address:
        return ""
    return address.lower()

def wei_to_ether(wei_amount: int) -> float:
    """Convert wei to ether"""
    return wei_amount / 10**18

def calculate_pool_tvl(token0_reserve: float, token0_price: float, 
                      token1_reserve: float, token1_price: float) -> float:
    """Calculate total value locked in a liquidity pool"""
    token0_value = token0_reserve * token0_price
    token1_value = token1_reserve * token1_price
    return token0_value + token1_value

def estimate_impermanent_loss(price_ratio_change: float) -> float:
    """
    Estimate impermanent loss based on price ratio change
    Formula: IL = 2*sqrt(price_ratio) / (1 + price_ratio) - 1
    """
    if price_ratio_change <= 0:
        return 0
    
    import math
    il = 2 * math.sqrt(price_ratio_change) / (1 + price_ratio_change) - 1
    return abs(il) * 100  # Return as percentage

def batch_requests(items: List[Any], batch_size: int = 10) -> List[List[Any]]:
    """Split items into batches for processing"""
    return [items[i:i + batch_size] for i in range(0, len(items), batch_size)]

async def fetch_with_session(session: aiohttp.ClientSession, url: str, 
                           headers: Dict[str, str] = None) -> Dict:
    """Fetch data from URL with session and error handling"""
    try:
        async with session.get(url, headers=headers, timeout=config.REQUEST_TIMEOUT) as response:
            if response.status == 200:
                return await response.json()
            else:
                logger.warning(f"HTTP {response.status} for {url}")
                return {}
    except asyncio.TimeoutError:
        logger.error(f"Timeout fetching {url}")
        return {}
    except Exception as e:
        logger.error(f"Error fetching {url}: {str(e)}")
        return {}

class RateLimiter:
    """Simple rate limiter for API calls"""
    
    def __init__(self, calls_per_second: float = 10):
        self.calls_per_second = calls_per_second
        self.min_interval = 1.0 / calls_per_second
        self.last_call = 0
    
    async def wait(self):
        """Wait if necessary to respect rate limit"""
        current_time = time.time()
        time_since_last = current_time - self.last_call
        
        if time_since_last < self.min_interval:
            sleep_time = self.min_interval - time_since_last
            await asyncio.sleep(sleep_time)
        
        self.last_call = time.time()