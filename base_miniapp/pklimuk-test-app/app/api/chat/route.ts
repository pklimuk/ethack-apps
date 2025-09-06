import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';
import OpenAI from 'openai';
import { PoolData } from '../pools/route';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  messages: Message[];
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const { messages }: ChatRequest = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      );
    }

    // Load CSV data
    let csvData: string;
    
    if (process.env.NODE_ENV === 'production') {
      // In production (Vercel), try multiple approaches
      try {
        // First try the public URL with PNG extension (Vercel workaround)
        const csvUrl = `${process.env.NEXT_PUBLIC_URL}/defi_llama_pools_by_tvl.png`;
        const response = await fetch(csvUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch CSV from URL: ${response.statusText}`);
        }
        csvData = await response.text();
      } catch (urlError) {
        // Fallback: try reading from filesystem
        try {
          const { readFile } = await import('fs/promises');
          const { join } = await import('path');
          const filePath = join(process.cwd(), 'public', 'defi_llama_pools_by_tvl.png');
          csvData = await readFile(filePath, 'utf8');
        } catch (fsError) {
          throw new Error(`Failed to load CSV file. URL error: ${urlError}. FS error: ${fsError}`);
        }
      }
    } else {
      // In development, read from filesystem
      const { readFile } = await import('fs/promises');
      const { join } = await import('path');
      const filePath = join(process.cwd(), 'public', 'defi_llama_pools_by_tvl.png');
      csvData = await readFile(filePath, 'utf8');
    }

    // Parse CSV data
    const parsed = Papa.parse(csvData, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    });

    if (parsed.errors && parsed.errors.length > 0) {
      console.error('CSV parsing errors:', parsed.errors);
    }

    const pools = parsed.data as PoolData[];

    // Create a summary of the data for context (to stay within token limits)
    const totalPools = pools.length;
    const uniqueChains = [...new Set(pools.map((p: PoolData) => p.chain))].filter(Boolean);
    const uniqueProjects = [...new Set(pools.map((p: PoolData) => p.project))].filter(Boolean);
    
    // Get top 10 pools by TVL for context
    const topPoolsByTVL = pools
      .filter((p: PoolData) => p.tvlUsd && !isNaN(Number(p.tvlUsd)))
      .sort((a: PoolData, b: PoolData) => Number(b.tvlUsd) - Number(a.tvlUsd))
      .slice(0, 10)
      .map((p: PoolData) => ({
        chain: p.chain,
        project: p.project,
        symbol: p.symbol,
        tvlUsd: p.tvlUsd,
        apy: p.apy,
        stablecoin: p.stablecoin
      }));

    // Get top 10 pools by APY for context
    const topPoolsByAPY = pools
      .filter((p: PoolData) => p.apy && !isNaN(Number(p.apy)))
      .sort((a: PoolData, b: PoolData) => Number(b.apy) - Number(a.apy))
      .slice(0, 10)
      .map((p: PoolData) => ({
        chain: p.chain,
        project: p.project,
        symbol: p.symbol,
        tvlUsd: p.tvlUsd,
        apy: p.apy,
        stablecoin: p.stablecoin
      }));

    const systemPrompt = `You are an AI assistant helping users analyze DeFi liquidity pool data. You have access to comprehensive data about ${totalPools} liquidity pools across ${uniqueChains.length} blockchain networks.

Dataset Overview:
- Total Pools: ${totalPools}
- Supported Chains: ${uniqueChains.slice(0, 10).join(', ')}${uniqueChains.length > 10 ? ' and more' : ''}
- Projects: ${uniqueProjects.length} different protocols
- Data includes: TVL (Total Value Locked), APY rates, chain info, stablecoin status, volume data, etc.

Sample Top Pools by TVL:
${topPoolsByTVL.map(p => `- ${p.project} ${p.symbol} on ${p.chain}: $${Number(p.tvlUsd).toLocaleString()} TVL, ${p.apy}% APY`).join('\n')}

Sample Top Pools by APY:
${topPoolsByAPY.map(p => `- ${p.project} ${p.symbol} on ${p.chain}: ${p.apy}% APY, $${Number(p.tvlUsd).toLocaleString()} TVL`).join('\n')}

Available data fields: chain, project, symbol, tvlUsd, apyBase, apyReward, apy, stablecoin, ilRisk, exposure, volumeUsd1d, volumeUsd7d, and more.

Please help users understand and analyze this DeFi data. You can answer questions about:
- Top pools by various metrics
- Comparisons between chains/projects
- Risk analysis (stablecoin vs non-stablecoin, IL risk)
- APY and TVL trends
- Volume analysis
- And any other insights from the data

Be conversational and helpful. Format numbers nicely (use commas, abbreviations like 1.2M, 500K, etc.).`;

    // Initialize OpenAI
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Create chat completion
    const completion = await openai.chat.completions.create({
      model: 'gpt-5-mini', // or 'gpt-4' if available
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const assistantMessage = completion.choices[0]?.message?.content;

    if (!assistantMessage) {
      throw new Error('No response from OpenAI');
    }

    return NextResponse.json({
      message: assistantMessage
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    );
  }
}