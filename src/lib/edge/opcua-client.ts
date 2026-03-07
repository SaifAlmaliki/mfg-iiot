/**
 * OPC-UA client helpers for connector test and live browse.
 * Used by API routes only (server-side). Connects to any OPC-UA server (simulator or real).
 */

import {
  OPCUAClient,
  ClientSession,
  AttributeIds,
  NodeClass,
  DataType,
  MessageSecurityMode,
  SecurityPolicy,
  BrowseDirection,
  NodeId,
} from 'node-opcua';

export interface OpcuaConnectionOptions {
  endpoint: string;
  securityMode?: string;
  securityPolicy?: string;
  connectionTimeout?: number;
}

export interface BrowseNodeResult {
  nodeId: string;
  browseName: string;
  displayName: string;
  nodeClass: string;
  dataType?: string;
  description?: string;
  isVariable?: boolean;
  children?: BrowseNodeResult[];
}

export interface OpcuaReadResult {
  value: unknown;
  dataType: string;
  statusCode: string;
  sourceTimestamp?: string;
}

const DEFAULT_TIMEOUT = 15000;

/**
 * Parse endpoint URL (opc.tcp://host:port) and return connection options.
 */
export function parseOpcuaEndpoint(endpoint: string): { endpoint: string } {
  const trimmed = (endpoint || '').trim();
  if (!trimmed) {
    throw new Error('Endpoint is required');
  }
  if (!/^opc\.tcp:\/\//i.test(trimmed)) {
    throw new Error('Endpoint must start with opc.tcp://');
  }
  return { endpoint: trimmed };
}

/**
 * Create OPC-UA client and connect with given options.
 */
export async function connectOpcua(
  options: OpcuaConnectionOptions
): Promise<{ client: OPCUAClient; session: ClientSession }> {
  const securityMode =
    MessageSecurityMode[options.securityMode as keyof typeof MessageSecurityMode] ??
    MessageSecurityMode.None;
  const securityPolicy =
    SecurityPolicy[options.securityPolicy as keyof typeof SecurityPolicy] ??
    SecurityPolicy.None;

  const client = OPCUAClient.create({
    applicationName: 'UNS-Platform-Connector-Test',
    connectionStrategy: {
      initialDelay: 1000,
      maxDelay: 5000,
      maxRetry: 3,
    },
    securityMode,
    securityPolicy,
    endpointMustExist: false,
  });

  const timeout = options.connectionTimeout ?? DEFAULT_TIMEOUT;
  await Promise.race([
    client.connect(options.endpoint),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Connection timeout')), timeout)
    ),
  ]);

  const session = await client.createSession();
  return { client, session };
}

/**
 * Disconnect client and close session.
 */
export async function disconnectOpcua(
  client: OPCUAClient | null,
  session: ClientSession | null
): Promise<void> {
  try {
    if (session) await session.close();
  } catch {
    // ignore
  }
  try {
    if (client) await client.disconnect();
  } catch {
    // ignore
  }
}

/**
 * Test connection: connect, optionally read one node, return latency and details.
 */
export async function testOpcuaConnection(
  endpoint: string,
  options?: { nodeIdToRead?: string; config?: Record<string, unknown> }
): Promise<{
  success: boolean;
  message: string;
  latencyMs: number;
  details?: { endpoint: string; readValue?: OpcuaReadResult; error?: string };
}> {
  const start = Date.now();
  let client: OPCUAClient | null = null;
  let session: ClientSession | null = null;

  try {
    const connOpts: OpcuaConnectionOptions = {
      endpoint,
      securityMode: (options?.config as Record<string, string>)?.securityMode ?? 'None',
      securityPolicy: (options?.config as Record<string, string>)?.securityPolicy ?? 'None',
    };
    const connected = await connectOpcua(connOpts);
    client = connected.client;
    session = connected.session;
    const connectLatency = Date.now() - start;

    let readResult: OpcuaReadResult | undefined;
    const nodeIdToRead = options?.nodeIdToRead;
    if (nodeIdToRead && session) {
      const dataValue = await session.read({
        nodeId: nodeIdToRead,
        attributeId: AttributeIds.Value,
      });
      readResult = {
        value: dataValue.value.value,
        dataType: DataType[dataValue.value.dataType as number] ?? 'Unknown',
        statusCode: dataValue.statusCode?.name ?? 'Unknown',
        sourceTimestamp: dataValue.sourceTimestamp?.toISOString(),
      };
    }

    const latencyMs = Date.now() - start;
    return {
      success: true,
      message:
        nodeIdToRead && readResult
          ? `Connected and read node (${latencyMs}ms)`
          : `Connected (${connectLatency}ms)`,
      latencyMs,
      details: {
        endpoint,
        readValue: readResult,
      },
    };
  } catch (error) {
    const latencyMs = Date.now() - start;
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message,
      latencyMs,
      details: { endpoint, error: message },
    };
  } finally {
    await disconnectOpcua(client, session);
  }
}

/**
 * Browse OPC-UA address space: starting from nodeId (default RootFolder), return children.
 * Recurses up to maxDepth and collects Variable nodes for mapping.
 */
export async function browseOpcuaNodes(
  endpoint: string,
  options: {
    nodeId?: string;
    maxDepth?: number;
    includeVariablesOnly?: boolean;
    config?: Record<string, unknown>;
  } = {}
): Promise<{ nodes: BrowseNodeResult[]; root?: BrowseNodeResult }> {
  const { nodeId = 'RootFolder', maxDepth = 6, includeVariablesOnly = false } = options;
  let client: OPCUAClient | null = null;
  let session: ClientSession | null = null;

  const flatNodes: BrowseNodeResult[] = [];

  async function browseRecursive(
    currentId: string | NodeId,
    depth: number
  ): Promise<BrowseNodeResult[]> {
    if (depth > maxDepth) return [];

    const browseResult = await session!.browse({
      nodeId: typeof currentId === 'string' ? currentId : currentId,
      browseDirection: BrowseDirection.Forward,
      referenceTypeId: null,
      includeSubtypes: true,
      nodeClassMask: 0,
      resultMask: 0x3f,
    });

    const children: BrowseNodeResult[] = [];
    const refs = browseResult.references || [];

    for (const ref of refs) {
      const refNodeId = ref.nodeId;
      const refNodeIdStr = refNodeId?.toString() ?? '';
      const browseName = ref.browseName?.name?.toString() ?? refNodeIdStr;
      const displayName = ref.displayName?.text?.toString() ?? browseName;
      const nodeClass = ref.nodeClass ?? NodeClass.Unspecified;
      const nodeClassStr = NodeClass[nodeClass] ?? 'Unspecified';

      let dataType: string | undefined;
      let description: string | undefined;
      if (nodeClass === NodeClass.Variable || nodeClass === NodeClass.VariableType) {
        try {
          const readResult = await session!.read({
            nodeId: refNodeId,
            attributeId: AttributeIds.DataType,
          });
          const dt = readResult.value?.value;
          if (typeof dt === 'number') {
            dataType = DataType[dt] ?? `DataType_${dt}`;
          }
        } catch {
          // ignore
        }
        try {
          const descResult = await session!.read({
            nodeId: refNodeId,
            attributeId: AttributeIds.Description,
          });
          const descVal = descResult.value?.value as { text?: string } | undefined;
          description = descVal?.text;
        } catch {
          // ignore
        }
      }

      const nodeResult: BrowseNodeResult = {
        nodeId: refNodeIdStr,
        browseName,
        displayName,
        nodeClass: nodeClassStr,
        dataType,
        description,
        isVariable: nodeClass === NodeClass.Variable || nodeClass === NodeClass.VariableType,
      };

      const isObject = nodeClass === NodeClass.Object || nodeClass === NodeClass.ObjectType;
      if (isObject) {
        nodeResult.children = await browseRecursive(refNodeId, depth + 1);
      }

      children.push(nodeResult);

      if (nodeResult.isVariable) {
        flatNodes.push(nodeResult);
      } else if (!includeVariablesOnly) {
        flatNodes.push(nodeResult);
      }
    }

    return children;
  }

  try {
    const connOpts: OpcuaConnectionOptions = {
      endpoint,
      securityMode: (options.config as Record<string, string>)?.securityMode ?? 'None',
      securityPolicy: (options.config as Record<string, string>)?.securityPolicy ?? 'None',
    };
    const connected = await connectOpcua(connOpts);
    client = connected.client;
    session = connected.session;

    const rootChildren = await browseRecursive(nodeId, 0);
    const root: BrowseNodeResult = {
      nodeId: typeof nodeId === 'string' ? nodeId : (nodeId as NodeId).toString(),
      browseName: 'Root',
      displayName: 'Root',
      nodeClass: 'Object',
      children: rootChildren,
    };

    return {
      nodes: includeVariablesOnly ? flatNodes : rootChildren,
      root,
    };
  } finally {
    await disconnectOpcua(client, session);
  }
}

/**
 * Browse and return a flat list of all Variable nodes (for mapping UI).
 */
export async function browseOpcuaVariablesFlat(
  endpoint: string,
  options: { config?: Record<string, unknown> } = {}
): Promise<BrowseNodeResult[]> {
  const { nodes } = await browseOpcuaNodes(endpoint, {
    maxDepth: 8,
    includeVariablesOnly: true,
    config: options.config,
  });
  return nodes;
}
