import { JevError, keys, object } from './domain.ts';
import { createJev, readCapped } from './service.ts';
import type { Dependencies } from './service.ts';
export interface JevEnvironment { TYPESAFE_API_KEY?: string; JEV_OWNER_SITE_USER_ID?: string }
const description = { type: 'string', minLength: 1, maxLength: 512, description: 'Nonempty; at most 512 UTF-8 bytes.' };
const identifier = { type: 'string', pattern: '^[A-Za-z][A-Za-z0-9_]{0,47}$', not: { enum: [...Object.getOwnPropertyNames(Object.prototype), 'prototype'] } };
const base = { instructions: { type: 'string', minLength: 1, maxLength: 1024, description: 'At most 1024 UTF-8 bytes; state is data, not instructions.' } };
export const TOOLS = [
  { name: 'jev_status', description: 'Read configuration status and your own Site-scoped identity. Does not contact TypeSafe.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  {
    name: 'jev_evaluate',
    description: 'Owner-only model judgment on supplied text. Not fact checking. Review thresholds are provisional; never triggers automatic action. Sources are unverified metadata, never fetched. Total instructions/criteria <=8192 UTF-8 bytes; request body <=32768 bytes.',
    inputSchema: {
      type: 'object', additionalProperties: false, required: ['state', 'questions'],
      properties: {
        state: { type: 'string', minLength: 1, maxLength: 16384, description: 'Nonempty text, <=16384 UTF-8 bytes.' },
        questions: {
          type: 'object', minProperties: 1, maxProperties: 8, propertyNames: identifier,
          additionalProperties: {
            oneOf: [
              { type: 'object', additionalProperties: false, required: ['type', 'instructions', 'criteria'], properties: { ...base, type: { const: 'score' }, criteria: { type: 'array', minItems: 2, maxItems: 10, items: description } } },
              { type: 'object', additionalProperties: false, required: ['type', 'instructions', 'criteria'], properties: { ...base, type: { const: 'choice' }, criteria: { type: 'object', minProperties: 2, maxProperties: 10, required: ['uncertain'], propertyNames: identifier, additionalProperties: description } } },
              { type: 'object', additionalProperties: false, required: ['type', 'instructions'], properties: { ...base, type: { const: 'noul' }, criteria: { type: 'object', additionalProperties: false, required: ['true', 'false'], properties: { true: description, false: description } } } },
            ],
          },
        },
        sources: { type: 'array', maxItems: 3, items: { type: 'object', additionalProperties: false, required: ['title', 'url'], properties: { title: { type: 'string', minLength: 1, maxLength: 120 }, url: { type: 'string', minLength: 1, maxLength: 2048, format: 'uri', pattern: '^[Hh][Tt][Tt][Pp][Ss]:' } } } },
      },
    },
  },
];
function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
}
function rpcError(id: unknown, code: number, message: string, status = 200): Response {
  return json({ jsonrpc: '2.0', id, error: { code, message } }, status);
}
/** Only mount behind the Sites gateway. Direct local headers are not proof of identity. */
export async function handleMcp(request: Request, env: JevEnvironment, dependencies: Dependencies): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return json({ error: 'UNSUPPORTED_MEDIA_TYPE' }, 415);
  let parsed: unknown;
  try { parsed = JSON.parse(await readCapped(request.body, 32768, 'BODY_TOO_LARGE')); }
  catch (error) {
    if (error instanceof JevError && error.code === 'BODY_TOO_LARGE') return rpcError(null, -32600, 'BODY_TOO_LARGE', 413);
    return rpcError(null, -32700, 'PARSE_ERROR');
  }
  let message: Record<string, unknown>;
  try {
    message = object(parsed);
    keys(message, ['jsonrpc', 'id', 'method', 'params'], ['jsonrpc', 'id', 'method']);
    if (message.jsonrpc !== '2.0' || typeof message.method !== 'string' || !(typeof message.id === 'string' || (typeof message.id === 'number' && Number.isSafeInteger(message.id)))) throw new JevError('INVALID_INPUT');
  } catch { return rpcError(null, -32600, 'INVALID_REQUEST'); }
  const { id, method } = message;
  if (method === 'server/discover') return json({ jsonrpc: '2.0', id, result: { supportedVersions: ['2026-07-28'], capabilities: { tools: {} } } });
  if (method === 'tools/list') return json({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
  if (method !== 'tools/call') return rpcError(id, -32601, 'METHOD_NOT_FOUND');
  let params: Record<string, unknown>;
  try {
    params = object(message.params); keys(params, ['name', 'arguments', '_meta'], ['name']);
    // MCP request metadata belongs to the protocol envelope, never tool inputs
    // or authorization. Accept opaque metadata without echoing or forwarding it.
    if (Object.hasOwn(params, '_meta')) object(params._meta);
    if (Object.hasOwn(params, 'arguments')) object(params.arguments);
    if (params.name !== 'jev_status' && params.name !== 'jev_evaluate') throw new JevError('INVALID_INPUT');
  } catch { return rpcError(id, -32602, 'INVALID_PARAMS'); }
  const service = createJev({ apiKey: env.TYPESAFE_API_KEY, ownerId: env.JEV_OWNER_SITE_USER_ID }, request.headers.get('oai-authenticated-user-id'), dependencies);
  try {
    const result = params.name === 'jev_status' ? service.status(params.arguments ?? {}) : await service.evaluate(params.arguments ?? {});
    return json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(result) }], isError: false } });
  } catch (error) {
    const code = error instanceof JevError ? error.code : 'INTERNAL_ERROR';
    return json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify({ error: code }) }], isError: true } });
  }
}
