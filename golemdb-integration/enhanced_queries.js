"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedPoolQueries = void 0;
/**
 * Enhanced query utilities that extend the base DeFiPoolCRUD functionality
 * without modifying the original working implementation
 */
class EnhancedPoolQueries {
    constructor(crud) {
        this.crud = crud;
    }
    /**
     * Query pools by volume range (1d or 7d)
     */
    async queryPoolsByVolumeRange(minVolume, maxVolume, period = '1d') {
        const minVolumeCents = Math.round(minVolume * 100);
        const maxVolumeCents = Math.round(maxVolume * 100);
        const volumeField = period === '1d' ? 'volumeUsd1d' : 'volumeUsd7d';
        return this.crud.queryPools(`${volumeField} >= ${minVolumeCents} && ${volumeField} <= ${maxVolumeCents}`);
    }
    /**
     * Advanced multi-criteria pool query
     */
    async queryPoolsAdvanced(criteria) {
        const filters = [];
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
    async queryTopPoolsByMetric(metric, count = 10) {
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
    async queryPoolsByPercentile(metric, percentile) {
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
    async queryReliablePools(minDataPoints = 100) {
        return this.crud.queryPools(`count >= ${minDataPoints}`);
    }
    /**
     * Query pools by multiple chains
     */
    async queryPoolsByChains(chains) {
        if (chains.length === 0)
            return [];
        const chainFilters = chains.map(chain => `chain = "${chain}"`);
        return this.crud.queryPools(chainFilters.join(' || '));
    }
    /**
     * Query pools by multiple projects
     */
    async queryPoolsByProjects(projects) {
        if (projects.length === 0)
            return [];
        const projectFilters = projects.map(project => `project = "${project}"`);
        return this.crud.queryPools(projectFilters.join(' || '));
    }
    /**
     * Helper method to get metric value from pool entity
     */
    getMetricValue(pool, metric) {
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
    async getPoolStatistics() {
        const allPools = await this.crud.queryPools('tvlUsd > 0');
        const stats = {
            totalPools: allPools.length,
            totalTvl: allPools.reduce((sum, pool) => sum + (pool.tvlUsd || 0), 0),
            averageApy: allPools.reduce((sum, pool) => sum + (pool.apy || 0), 0) / allPools.length,
            chainDistribution: {},
            projectDistribution: {},
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
    async findHighYieldOpportunities(criteria) {
        const filters = [];
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
    async compareProtocolsAcrossChains(protocols) {
        const results = [];
        for (const protocol of protocols) {
            const protocolPools = await this.crud.queryPools(`project = "${protocol}"`);
            // Group by chain
            const chainStats = {};
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
exports.EnhancedPoolQueries = EnhancedPoolQueries;
