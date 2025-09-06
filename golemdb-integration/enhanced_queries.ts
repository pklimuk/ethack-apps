import { DeFiPoolCRUD, DeFiPoolEntity } from './defi_pool_crud';

/**
 * Enhanced query utilities that extend the base DeFiPoolCRUD functionality
 * without modifying the original working implementation
 */
export class EnhancedPoolQueries {
  private crud: DeFiPoolCRUD;

  constructor(crud: DeFiPoolCRUD) {
    this.crud = crud;
  }

  /**
   * Query pools by volume range (1d or 7d)
   */
  async queryPoolsByVolumeRange(minVolume: number, maxVolume: number, period: '1d' | '7d' = '1d'): Promise<DeFiPoolEntity[]> {
    const minVolumeCents = Math.round(minVolume * 100);
    const maxVolumeCents = Math.round(maxVolume * 100);
    const volumeField = period === '1d' ? 'volumeUsd1d' : 'volumeUsd7d';
    return this.crud.queryPools(`${volumeField} >= ${minVolumeCents} && ${volumeField} <= ${maxVolumeCents}`);
  }

  /**
   * Advanced multi-criteria pool query
   */
  async queryPoolsAdvanced(criteria: {
    minTvl?: number;
    maxTvl?: number;
    minApy?: number;
    maxApy?: number;
    minVolume?: number;
    maxVolume?: number;
    volumePeriod?: '1d' | '7d';
    chains?: string[];
    projects?: string[];
    stablecoinOnly?: boolean;
    excludeOutliers?: boolean;
  }): Promise<DeFiPoolEntity[]> {
    const filters: string[] = [];

    // TVL filtering
    if (criteria.minTvl !== undefined) {
      filters.push(`tvlUsd >= ${Math.round(criteria.minTvl * 100)}`);
    }
    if (criteria.maxTvl !== undefined) {
      filters.push(`tvlUsd <= ${Math.round(criteria.maxTvl * 100)}`);
    }

    // APY filtering
    if (criteria.minApy !== undefined) {
      filters.push(`apy >= ${Math.round(criteria.minApy * 10000)}`);
    }
    if (criteria.maxApy !== undefined) {
      filters.push(`apy <= ${Math.round(criteria.maxApy * 10000)}`);
    }

    // Volume filtering
    if (criteria.minVolume !== undefined || criteria.maxVolume !== undefined) {
      const volumeField = criteria.volumePeriod === '7d' ? 'volumeUsd7d' : 'volumeUsd1d';
      if (criteria.minVolume !== undefined) {
        filters.push(`${volumeField} >= ${Math.round(criteria.minVolume * 100)}`);
      }
      if (criteria.maxVolume !== undefined) {
        filters.push(`${volumeField} <= ${Math.round(criteria.maxVolume * 100)}`);
      }
    }

    // Chain filtering
    if (criteria.chains && criteria.chains.length > 0) {
      const chainFilters = criteria.chains.map(chain => `chain = "${chain}"`);
      filters.push(`(${chainFilters.join(' || ')})`);
    }

    // Project filtering
    if (criteria.projects && criteria.projects.length > 0) {
      const projectFilters = criteria.projects.map(project => `project = "${project}"`);
      filters.push(`(${projectFilters.join(' || ')})`);
    }

    // Stablecoin filtering
    if (criteria.stablecoinOnly) {
      filters.push('stablecoin = 1');
    }

    // Exclude outliers (Note: GolemDB doesn't support !=, so we skip this filter)
    // if (criteria.excludeOutliers) {
    //   filters.push('outlier != 1');  // Not supported in current GolemDB version
    // }

    const combinedFilter = filters.length > 0 ? filters.join(' && ') : 'tvlUsd > 0';
    return this.crud.queryPools(combinedFilter);
  }

  /**
   * Query top N pools by a specific numeric metric
   */
  async queryTopPoolsByMetric(metric: 'tvlUsd' | 'apy' | 'volumeUsd1d' | 'volumeUsd7d', count: number = 10): Promise<DeFiPoolEntity[]> {
    const allPools = await this.crud.queryPools(`${metric} > 0`);
    
    // Sort by the metric (descending)
    const sortedPools = allPools.sort((a, b) => {
      const valueA = this.getMetricValue(a, metric);
      const valueB = this.getMetricValue(b, metric);
      return valueB - valueA;
    });

    return sortedPools.slice(0, count);
  }

  /**
   * Query pools by percentile of a specific metric
   */
  async queryPoolsByPercentile(metric: 'tvlUsd' | 'apy' | 'volumeUsd1d' | 'volumeUsd7d', percentile: number): Promise<DeFiPoolEntity[]> {
    if (percentile < 0 || percentile > 100) {
      throw new Error('Percentile must be between 0 and 100');
    }

    const allPools = await this.crud.queryPools(`${metric} > 0`);
    
    // Sort by the metric
    const sortedPools = allPools.sort((a, b) => {
      const valueA = this.getMetricValue(a, metric);
      const valueB = this.getMetricValue(b, metric);
      return valueA - valueB;
    });

    // Calculate percentile threshold
    const thresholdIndex = Math.floor((percentile / 100) * sortedPools.length);
    const thresholdValue = this.getMetricValue(sortedPools[thresholdIndex], metric);

    // Return pools above the percentile threshold
    return sortedPools.filter(pool => this.getMetricValue(pool, metric) >= thresholdValue);
  }

  /**
   * Query reliable pools based on minimum data points
   */
  async queryReliablePools(minDataPoints: number = 100): Promise<DeFiPoolEntity[]> {
    return this.crud.queryPools(`count >= ${minDataPoints}`);
  }

  /**
   * Query pools by multiple chains
   */
  async queryPoolsByChains(chains: string[]): Promise<DeFiPoolEntity[]> {
    if (chains.length === 0) return [];
    const chainFilters = chains.map(chain => `chain = "${chain}"`);
    return this.crud.queryPools(chainFilters.join(' || '));
  }

  /**
   * Query pools by multiple projects
   */
  async queryPoolsByProjects(projects: string[]): Promise<DeFiPoolEntity[]> {
    if (projects.length === 0) return [];
    const projectFilters = projects.map(project => `project = "${project}"`);
    return this.crud.queryPools(projectFilters.join(' || '));
  }

  /**
   * Helper method to get metric value from pool entity
   */
  private getMetricValue(pool: DeFiPoolEntity, metric: string): number {
    switch (metric) {
      case 'tvlUsd':
        return pool.tvlUsd || 0;
      case 'apy':
        return pool.apy || 0;
      case 'volumeUsd1d':
        return pool.volumeUsd1d || 0;
      case 'volumeUsd7d':
        return pool.volumeUsd7d || 0;
      default:
        return 0;
    }
  }

  /**
   * Get summary statistics for all pools
   */
  async getPoolStatistics(): Promise<{
    totalPools: number;
    totalTvl: number;
    averageApy: number;
    chainDistribution: Record<string, number>;
    projectDistribution: Record<string, number>;
    stablecoinPercentage: number;
  }> {
    const allPools = await this.crud.queryPools('tvlUsd > 0');
    
    const stats = {
      totalPools: allPools.length,
      totalTvl: allPools.reduce((sum, pool) => sum + (pool.tvlUsd || 0), 0),
      averageApy: allPools.reduce((sum, pool) => sum + (pool.apy || 0), 0) / allPools.length,
      chainDistribution: {} as Record<string, number>,
      projectDistribution: {} as Record<string, number>,
      stablecoinPercentage: 0
    };

    // Calculate distributions
    let stablecoinCount = 0;
    for (const pool of allPools) {
      // Chain distribution
      stats.chainDistribution[pool.chain] = (stats.chainDistribution[pool.chain] || 0) + 1;
      
      // Project distribution
      stats.projectDistribution[pool.project] = (stats.projectDistribution[pool.project] || 0) + 1;
      
      // Stablecoin count
      if (pool.stablecoin) {
        stablecoinCount++;
      }
    }

    stats.stablecoinPercentage = (stablecoinCount / allPools.length) * 100;

    return stats;
  }

  /**
   * Find high-yield opportunities with risk assessment
   */
  async findHighYieldOpportunities(criteria: {
    minApy: number;
    maxTvl?: number;
    minTvl?: number;
    stablecoinOnly?: boolean;
    minReliability?: number;
  }): Promise<DeFiPoolEntity[]> {
    const filters: string[] = [];
    
    // APY requirement
    filters.push(`apy >= ${Math.round(criteria.minApy * 10000)}`);
    
    // TVL range
    if (criteria.minTvl !== undefined) {
      filters.push(`tvlUsd >= ${Math.round(criteria.minTvl * 100)}`);
    }
    if (criteria.maxTvl !== undefined) {
      filters.push(`tvlUsd <= ${Math.round(criteria.maxTvl * 100)}`);
    }
    
    // Stablecoin requirement
    if (criteria.stablecoinOnly) {
      filters.push('stablecoin = 1');
    }
    
    // Reliability requirement
    if (criteria.minReliability !== undefined) {
      filters.push(`count >= ${criteria.minReliability}`);
    }
    
    // Note: Cannot exclude outliers with current GolemDB query syntax
    // filters.push('outlier != 1');  // Not supported
    
    const query = filters.join(' && ');
    const opportunities = await this.crud.queryPools(query);
    
    // Sort by APY descending
    return opportunities.sort((a, b) => (b.apy || 0) - (a.apy || 0));
  }

  /**
   * Compare protocols across chains
   */
  async compareProtocolsAcrossChains(protocols: string[]): Promise<{
    protocol: string;
    chains: {
      chain: string;
      poolCount: number;
      totalTvl: number;
      averageApy: number;
    }[];
    totalPools: number;
    totalTvl: number;
  }[]> {
    const results = [];
    
    for (const protocol of protocols) {
      const protocolPools = await this.crud.queryPools(`project = "${protocol}"`);
      
      // Group by chain
      const chainStats: Record<string, {
        pools: DeFiPoolEntity[];
        totalTvl: number;
        averageApy: number;
      }> = {};
      
      for (const pool of protocolPools) {
        if (!chainStats[pool.chain]) {
          chainStats[pool.chain] = {
            pools: [],
            totalTvl: 0,
            averageApy: 0
          };
        }
        
        chainStats[pool.chain].pools.push(pool);
        chainStats[pool.chain].totalTvl += pool.tvlUsd || 0;
      }
      
      // Calculate averages
      const chains = Object.entries(chainStats).map(([chain, stats]) => ({
        chain,
        poolCount: stats.pools.length,
        totalTvl: stats.totalTvl,
        averageApy: stats.pools.reduce((sum, pool) => sum + (pool.apy || 0), 0) / stats.pools.length
      }));
      
      results.push({
        protocol,
        chains,
        totalPools: protocolPools.length,
        totalTvl: protocolPools.reduce((sum, pool) => sum + (pool.tvlUsd || 0), 0)
      });
    }
    
    return results;
  }
}