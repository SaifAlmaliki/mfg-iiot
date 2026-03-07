import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-config';
import { browseOpcuaNodes, browseOpcuaVariablesFlat } from '@/lib/edge/opcua-client';

/**
 * POST /api/opcua/browse
 * Live browse an OPC-UA server (simulator or real). Returns tree or flat list of nodes.
 * Body: { endpoint, nodeId?, maxDepth?, variablesOnly?, config? }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      endpoint,
      nodeId,
      maxDepth = 6,
      variablesOnly = true,
      config,
    } = body as {
      endpoint?: string;
      nodeId?: string;
      maxDepth?: number;
      variablesOnly?: boolean;
      config?: Record<string, unknown>;
    };

    if (!endpoint || typeof endpoint !== 'string') {
      return NextResponse.json(
        { error: 'endpoint is required' },
        { status: 400 }
      );
    }

    const trimmed = endpoint.trim();
    if (!/^opc\.tcp:\/\//i.test(trimmed)) {
      return NextResponse.json(
        { error: 'endpoint must start with opc.tcp://' },
        { status: 400 }
      );
    }

    if (variablesOnly) {
      const nodes = await browseOpcuaVariablesFlat(trimmed, { config });
      return NextResponse.json({
        success: true,
        endpoint: trimmed,
        variablesOnly: true,
        count: nodes.length,
        nodes,
      });
    }

    const result = await browseOpcuaNodes(trimmed, {
      nodeId: nodeId || 'RootFolder',
      maxDepth: Math.min(maxDepth, 10),
      includeVariablesOnly: false,
      config,
    });

    return NextResponse.json({
      success: true,
      endpoint: trimmed,
      variablesOnly: false,
      root: result.root,
      nodes: result.nodes,
    });
  } catch (error) {
    console.error('[API] POST /api/opcua/browse error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Browse failed',
      },
      { status: 500 }
    );
  }
}
