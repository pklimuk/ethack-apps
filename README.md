# LP Yield Dashboard — Hackathon Demo

## What we're building
LP Yield Dashboard — Compare historical performance of liquidity pools across multiple protocols for better investment decisions

## Target audience
- Crypto-native investors (no fiat)  
- Web2 investors looking for portfolio diversification via crypto

## Problem
- Hard to compare APY, TVL across protocols  
- Current solutions are not optimized for historical perfomance
- No APY breakdown: advertised vs actual vs adjusted (incl. impermanent loss)

## Problem size or why it matters
- Crypto market grows (2018 → 2025): TVL ~$10B → ~$50–60B, including LPs TVL ~$1B → ~$5–10B 
- UX Solutions enable market adoption (2018 → 2025): # of Ethereum wallet ~20M → 100M+
- LPs provide **low-risk yield** relative to trading  
- Acts like **compounding interest**, alternative to traditional S&P stocks  
- Opportunity: underserved LP participation

## Solution
- Multi-protocol coverage: aggregate Uniswap, Balancer, Curve, etc.  
- Transparency first: stored publicly in GolemDB
- Investor-friendly: insights (ILAY), research and compare

## Demo Flow
1. Explore pulls
2. Compare pulls
3. ROI calculators
4. Ask AI
5. Invest with LP

## Differentiation 

| Feature / Product          | LP Yield Dashboard (ours) | DefiLlama | Pools.fyi | Dune Analytics |
|----------------------------|---------------------------|-----------|-----------|----------------|
| **Multi-protocol coverage** | ✅ Aggregates major LPs (Balancer, Curve, Uniswap, etc.) | ✅ 100+ protocols, API-first | ❌ Mostly Uniswap | ✅ (SQL queries) |
| **Ease of use / UX**        | ✅ Plug & play, investor-facing | ❌ API-first | ✅ Simple dashboard | ❌ SQL-first |
| **IL-adjusted / realized yield (ILAY)** | ⚠️ Only meaningful for volatile pools | ❌ | ❌ | ✅ (SQL queries) |
| **Historical APY trends**   | ✅ Snapshots stored in DB, backtested charts | ⚠️ Limited, not standardized | ❌ Real-time only | ✅ (SQL queries) |

## Market pull

## Roadmap

### Phase 1 - Hackathon 
- Multi-protocol
- Stable-coins only
- UX-first

### Phase 2 - Killer features
- Historical snapshots
- Volatile LPs with IL-adjusted APY metrics
- Realized vs. advertised returns for key pools
- Risk-adjusted “top 5 pools” insights
- API access for B2B partners

### Phase 3 — Scaling
- Referral fees integration with DEXes & aggregators
- Premium analytics tier for advanced investors
- Add scenario simulations & alerting features
- Add our own on-chain to minimize data provider dependencies
