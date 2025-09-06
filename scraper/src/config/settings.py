import os
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

class Config:
    """Application configuration settings"""
    
    # RPC URLs
    RPC_URLS = {
        'ethereum': os.getenv('ETHEREUM_RPC_URL', 'https://eth.llamarpc.com'),
        'bsc': os.getenv('BSC_RPC_URL', 'https://bsc-dataseed.binance.org'),
        'polygon': os.getenv('POLYGON_RPC_URL', 'https://polygon.llamarpc.com'),
        'arbitrum': os.getenv('ARBITRUM_RPC_URL', 'https://arb1.arbitrum.io/rpc')
    }
    
    # API Keys
    ALCHEMY_API_KEY = os.getenv('ALCHEMY_API_KEY')
    INFURA_API_KEY = os.getenv('INFURA_API_KEY')
    MORALIS_API_KEY = os.getenv('MORALIS_API_KEY')
    
    # Application Settings
    UPDATE_INTERVAL = int(os.getenv('UPDATE_INTERVAL_MINUTES', 60))
    MIN_TVL_THRESHOLD = int(os.getenv('MIN_TVL_THRESHOLD', 100000))
    MAX_POOLS_PER_DEX = int(os.getenv('MAX_POOLS_PER_DEX', 50))
    REQUEST_TIMEOUT = int(os.getenv('REQUEST_TIMEOUT', 30))
    MAX_RETRIES = int(os.getenv('MAX_RETRIES', 3))
    
    # Export Settings
    EXPORT_PATH = os.getenv('EXPORT_PATH', './exports')
    INCLUDE_HISTORICAL_DATA = os.getenv('INCLUDE_HISTORICAL_DATA', 'true').lower() == 'true'
    INCLUDE_CHARTS = os.getenv('INCLUDE_CHARTS', 'true').lower() == 'true'
    
    # Debugging
    DEBUG = os.getenv('DEBUG', 'false').lower() == 'true'
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    
    # Contract Addresses
    CONTRACTS = {
        'ethereum': {
            'uniswap_v3_factory': '0x1F98431c8aD98523631AE4a59f267346ea31F984',
            'uniswap_v3_quoter': '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
            'sushiswap_factory': '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac'
        },
        'bsc': {
            'pancakeswap_factory': '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
            'pancakeswap_router': '0x10ED43C718714eb63d5aA57B78B54704E256024E'
        },
        'polygon': {
            'uniswap_v3_factory': '0x1F98431c8aD98523631AE4a59f267346ea31F984',
            'sushiswap_factory': '0xc35DADB65012eC5796536bD9864eD8773aBc74C4'
        },
        'arbitrum': {
            'uniswap_v3_factory': '0x1F98431c8aD98523631AE4a59f267346ea31F984',
            'sushiswap_factory': '0xc35DADB65012eC5796536bD9864eD8773aBc74C4'
        }
    }
    
    @staticmethod
    def get_export_filename():
        """Generate timestamped export filename"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        return f'liquidity_pools_{timestamp}.xlsx'

config = Config()