import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';
import { readFile } from 'fs/promises';
import { join } from 'path';

export interface PoolData {
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apyBase: number;
  apyReward: number;
  apy: number;
  rewardTokens: string;
  pool: string;
  apyPct1D: number;
  apyPct7D: number;
  apyPct30D: number;
  stablecoin: boolean;
  ilRisk: string;
  exposure: string;
  predictions: string;
  poolMeta: string;
  mu: number;
  sigma: number;
  count: number;
  outlier: boolean;
  underlyingTokens: string;
  il7d: number;
  apyBase7d: number;
  apyMean30d: number;
  volumeUsd1d: number;
  volumeUsd7d: number;
  apyBaseInception: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '100');
    const search = searchParams.get('search') || '';
    const chain = searchParams.get('chain') || '';
    const project = searchParams.get('project') || '';
    const sortBy = searchParams.get('sortBy') || 'tvlUsd';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const filePath = join(process.cwd(), 'public', 'data', 'defi_llama_pools_by_tvl.csv');
    const csvData = await readFile(filePath, 'utf8');

    const parsed = Papa.parse(csvData, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      transform: (value, field) => {
        // Parse numeric fields
        const numericFields = ['tvlUsd', 'apyBase', 'apyReward', 'apy', 'apyPct1D', 'apyPct7D', 'apyPct30D', 'mu', 'sigma', 'count', 'il7d', 'apyBase7d', 'apyMean30d', 'volumeUsd1d', 'volumeUsd7d', 'apyBaseInception'];
        const booleanFields = ['stablecoin', 'outlier'];
        
        const fieldName = typeof field === 'string' ? field : String(field);
        
        if (numericFields.includes(fieldName)) {
          const num = parseFloat(value);
          return isNaN(num) ? 0 : num;
        }
        
        if (booleanFields.includes(fieldName)) {
          return value.toLowerCase() === 'true';
        }
        
        return value || '';
      }
    });

    if (parsed.errors && parsed.errors.length > 0) {
      console.error('CSV parsing errors:', parsed.errors);
    }

    let pools = parsed.data as PoolData[];

    // Filter by search term
    if (search) {
      const searchLower = search.toLowerCase();
      pools = pools.filter(pool => 
        pool.symbol?.toLowerCase().includes(searchLower) ||
        pool.project?.toLowerCase().includes(searchLower) ||
        pool.chain?.toLowerCase().includes(searchLower)
      );
    }

    // Filter by chain
    if (chain) {
      pools = pools.filter(pool => pool.chain === chain);
    }

    // Filter by project
    if (project) {
      pools = pools.filter(pool => pool.project === project);
    }

    // Sort data
    pools.sort((a, b) => {
      let aVal = a[sortBy as keyof PoolData];
      let bVal = b[sortBy as keyof PoolData];
      
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      
      if (sortOrder === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedPools = pools.slice(startIndex, endIndex);

    // Get unique values for filters
    const allPools = parsed.data as PoolData[];
    const uniqueChains = [...new Set(allPools.map(p => p.chain))].filter(Boolean).sort();
    const uniqueProjects = [...new Set(allPools.map(p => p.project))].filter(Boolean).sort();

    return NextResponse.json({
      pools: paginatedPools,
      totalCount: pools.length,
      totalPages: Math.ceil(pools.length / limit),
      currentPage: page,
      limit,
      filters: {
        chains: uniqueChains,
        projects: uniqueProjects
      }
    });
  } catch (error) {
    console.error('Error fetching pools data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pools data' },
      { status: 500 }
    );
  }
}