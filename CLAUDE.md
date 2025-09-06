# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains multiple blockchain/DeFi applications built during ETHWarsaw 2025 hackathon. The project consists of four main components:

### 1. Base Miniapp (`base_miniapp/pklimuk-test-app/`)
- **Technology**: Next.js 15, React 18, TypeScript, Tailwind CSS
- **Framework**: MiniKit with OnchainKit integration for Farcaster Frames
- **Purpose**: A Farcaster Frame application template with Web3 functionality
- **Key Features**: Frame metadata, account association, background notifications via Redis

### 2. Liquidity Pool Scraper (`scraper/`)
- **Technology**: Python with asyncio, pandas, web3.py
- **Purpose**: Comprehensive DeFi liquidity pool data collection from major DEXs
- **Features**: Multi-network support (Ethereum, Polygon, Arbitrum, BSC), RedStone price feeds integration
- **Supported Protocols**: Uniswap, SushiSwap, Curve, PancakeSwap

### 3. Dune Analytics LP Scraper (`dune_lp_scaper/`)
- **Technology**: Python with requests, pandas
- **Purpose**: Simple data extraction from Dune Analytics dashboard
- **Features**: CSV export of liquidity pool data

### 4. DeFi Llama API Client (`defi_llama_api/`)
- **Technology**: Python with requests, pandas
- **Purpose**: Pool data collection from DeFi Llama yields API
- **Features**: Direct API integration for DeFi yield farming data

## Development Commands

### Base Miniapp (Next.js)
Navigate to `base_miniapp/pklimuk-test-app/` before running these commands:

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for production  
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

### Python Scripts
Each Python project has its own `requirements.txt`. Install dependencies with:

```bash
# For scraper/
cd scraper && pip install -r requirements.txt

# For dune_lp_scaper/
cd dune_lp_scaper && pip install -r requirements.txt

# For defi_llama_api/
cd defi_llama_api && pip install -r requirements.txt
```

Run Python scripts directly:
```bash
# Main liquidity pool scraper
python scraper/main.py

# Dune Analytics scraper  
python dune_lp_scaper/dune_lp.py

# DeFi Llama API client
python defi_llama_api/defi_lama_get_plain_pools.py
```

## Architecture Notes

- **Base Miniapp**: Uses MiniKit provider pattern with OnchainKit integration, Frame SDK for Farcaster interactions
- **Scraper**: Service-oriented architecture with separate modules for different DEX protocols and networks
- **Environment Variables**: Required for API keys (Dune Analytics, OnchainKit, Redis) - see respective `.env.example` files
- **Data Output**: Python scripts generate CSV files, Next.js app serves Frame endpoints

## Key Dependencies

- **Next.js App**: OnchainKit, MiniKit, Wagmi, Viem for blockchain interactions
- **Python Scripts**: Web3.py, pandas for data processing, aiohttp for async operations
- **Styling**: Tailwind CSS with custom theming for the miniapp