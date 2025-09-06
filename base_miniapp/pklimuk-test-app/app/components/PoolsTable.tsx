"use client";

import { useState, useEffect, useMemo } from 'react';
import { useOpenUrl } from "@coinbase/onchainkit/minikit";
import { CheckSquare, HelpCircle, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  createColumnHelper,
  flexRender,
  type SortingState,
} from '@tanstack/react-table';
import { PoolData } from '../api/pools/route';

interface PoolsTableProps {
  onSelectionChange?: (selectedPools: PoolData[]) => void;
  maxSelection?: number;
}

const columnHelper = createColumnHelper<PoolData>();

export default function PoolsTable({ onSelectionChange, maxSelection = 3 }: PoolsTableProps) {
  const [data, setData] = useState<PoolData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'tvlUsd', desc: true }]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [chainFilter, setChainFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<{ chains: string[]; projects: string[] }>({ chains: [], projects: [] });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  const openUrl = useOpenUrl();

  const limit = 100;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
          ...(globalFilter && { search: globalFilter }),
          ...(chainFilter && { chain: chainFilter }),
          ...(projectFilter && { project: projectFilter }),
          ...(sorting[0] && { 
            sortBy: sorting[0].id,
            sortOrder: sorting[0].desc ? 'desc' : 'asc'
          }),
        });

        const response = await fetch(`/api/pools?${params}`);
        if (!response.ok) throw new Error('Failed to fetch data');
        
        const result = await response.json();
        setData(result.pools);
        setTotalPages(result.totalPages);
        setTotalCount(result.totalCount);
        setFilters(result.filters);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [page, sorting, globalFilter, chainFilter, projectFilter]);

  const formatNumber = (num: number | null | undefined) => {
    if (num === null || num === undefined || isNaN(num)) return '-';
    if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`;
    return `$${num.toFixed(2)}`;
  };

  const formatPercent = (num: number | null | undefined) => {
    if (num === null || num === undefined || isNaN(num)) return '-';
    return `${num.toFixed(5)}%`;
  };


  const columns = useMemo(
    () => [
      // Checkbox column
      columnHelper.display({
        id: 'select',
        header: () => <CheckSquare size={16} className="text-gray-500" />,
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={selectedRows.has(row.original.pool)}
            onChange={(e) => {
              const newSelectedRows = new Set(selectedRows);
              if (e.target.checked) {
                if (selectedRows.size < maxSelection) {
                  newSelectedRows.add(row.original.pool);
                }
              } else {
                newSelectedRows.delete(row.original.pool);
              }
              setSelectedRows(newSelectedRows);
              
              const selectedPools = data.filter(pool => newSelectedRows.has(pool.pool));
              onSelectionChange?.(selectedPools);
            }}
            disabled={!selectedRows.has(row.original.pool) && selectedRows.size >= maxSelection}
            className="w-4 h-4 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
          />
        ),
        enableSorting: false,
      }),
      // Pool column (renamed from Project)
      columnHelper.accessor('project', {
        header: 'Pool',
        cell: info => (
          <span className="font-medium text-gray-900">
            {info.getValue()}
          </span>
        ),
      }),
      // Advertised APY column (renamed from APY)
      columnHelper.accessor('apy', {
        header: 'Advertised APY',
        cell: info => (
          <span className="font-mono text-blue-600 font-semibold">
            {formatPercent(info.getValue())}
          </span>
        ),
      }),
      // Historic APY column (new, no data)
      columnHelper.display({
        id: 'historicApy',
        header: 'Historic APY (90d)',
        cell: () => (
          <span className="text-gray-400 text-sm italic">
            Soon
          </span>
        ),
        enableSorting: false,
      }),
      // Net Yield column (new, with tooltip)
      columnHelper.display({
        id: 'netYield',
        header: () => (
          <div className="flex items-center space-x-1">
            <span>Net Yield (ILAY)</span>
            <div className="relative group">
              <HelpCircle size={14} className="text-gray-400 hover:text-gray-600 cursor-help" />
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-80 p-3 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-[60]">
                <div className="mb-2">
                  <strong>Advertised APY: 18%</strong> — the protocol promised 18% based on fees and incentives.
                </div>
                <div>
                  <strong>Realized IL-adjusted APY: 10%</strong> — your actual return considering price changes of assets in the pool.
                </div>
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-gray-900"></div>
              </div>
            </div>
          </div>
        ),
        cell: () => (
          <span className="text-gray-400 text-sm italic">
            Soon
          </span>
        ),
        enableSorting: false,
      }),
      // TVL column (renamed from TVL (USD))
      columnHelper.accessor('tvlUsd', {
        header: 'TVL',
        cell: info => (
          <span className="font-mono text-green-600 font-semibold">
            {formatNumber(info.getValue())}
          </span>
        ),
      }),
      // Chain column
      columnHelper.accessor('chain', {
        header: 'Chain',
        cell: info => (
          <span className="px-2 py-1 bg-gray-100 rounded-md text-sm font-medium">
            {info.getValue()}
          </span>
        ),
      }),
      // Buy column
      columnHelper.display({
        id: 'buy',
        header: 'Buy',
        cell: () => (
          <button
            onClick={() => openUrl('https://www.curve.finance/dex/ethereum/pools/3pool/deposit?affiliate=defilpmonitoring')}
            className="inline-flex items-center px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors duration-200"
          >
            Buy
          </button>
        ),
      }),
    ],
    [data, selectedRows, maxSelection, onSelectionChange, openUrl]
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
    manualSorting: true,
    manualFiltering: true,
  });

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Search
          </label>
          <input
            type="text"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search pools..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Chain
          </label>
          <select
            value={chainFilter}
            onChange={(e) => setChainFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Chains</option>
            {filters.chains.map(chain => (
              <option key={chain} value={chain}>{chain}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Project
          </label>
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Projects</option>
            {filters.projects.map(project => (
              <option key={project} value={project}>{project}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-4 text-sm text-gray-600">
        <span>Total Pools: {totalCount.toLocaleString()}</span>
        {/* <span>Selected: {selectedRows.size}/{maxSelection}</span> */}
        <span>Page: {page}/{totalPages}</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-500">Loading pools...</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  {table.getHeaderGroups().map(headerGroup => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map(header => (
                        <th
                          key={header.id}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                        >
                          <div className="flex items-center space-x-1">
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                            {header.column.getCanSort() && (
                              <span className="text-gray-400 ml-1">
                                {{
                                  asc: <ChevronUp size={14} />,
                                  desc: <ChevronDown size={14} />,
                                }[header.column.getIsSorted() as string] ?? <ChevronsUpDown size={14} />}
                              </span>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {table.getRowModel().rows.map(row => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id} className="px-6 py-4 whitespace-nowrap text-sm">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            <div className="bg-gray-50 px-6 py-3 flex items-center justify-between border-t border-gray-200">
              <div className="flex-1 flex justify-between">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}