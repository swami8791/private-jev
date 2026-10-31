import { DISCLAIMER, MODEL, JevError, keys, object, parseInput, validateAnswers } from './domain.ts';
export interface Configuration { apiKey?: string; ownerId?: string }
export interface Dependencies {
  fetch: (url: string, options: RequestInit) => Promise<Response>;
  now?: () => Date;
  requestId?: () => string;
}
const configured = (value: string | undefined | null): value is string => typeof value === 'string' && value.trim().length > 0;

/** Reads bytes before decoding; neither Content-Length nor chunk boundaries are trusted. */
export async function readCapped(stream: ReadableStream<Uint8Array> | null, limit: number, code: string, signal?: AbortSignal): Promise<string> {
  if (!stream) throw new JevError('MALFORMED_RESPONSE');
  const reader = stream.getReader();
  const cancel = (): void => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener('abort', cancel, { once: true });
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    if (signal?.aborted) throw new JevError('TIMEOUT');
    while (true) {
      const { done, value } = await reader.read();
      if (signal?.aborted) throw new JevError('TIMEOUT');
      if (done) break;
      total += value.byteLength;
      if (total > limit) { cancel(); throw new JevError(code); }
      chunks.push(value);
    }
    const joined = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
    try { return new TextDecoder('utf-8', { fatal: true }).decode(joined); }
    catch { throw new JevError('MALFORMED_RESPONSE'); }
  } finally {
    signal?.removeEventListener('abort', cancel);
    reader.releaseLock();
  }
}
function providerCode(status: number): string {
  if ([401, 403].includes(status)) return 'PROVIDER_AUTH';
  if ([400, 422].includes(status)) return 'PROVIDER_INVALID_REQUEST';
  if ([429, 529].includes(status)) return 'PROVIDER_BUSY';
  return 'PROVIDER_ERROR';
}
export function createJev(config: Configuration, trustedCaller: string | null, dependencies: Dependencies) {
  function status(args: unknown) {
    keys(object(args), [], []);
    return {
      api_key_configured: configured(config.apiKey),
      owner_configured: configured(config.ownerId),
      caller_is_owner: configured(trustedCaller) && configured(config.ownerId) && trustedCaller === config.ownerId,
      caller_site_user_id: configured(trustedCaller) ? trustedCaller : null,
      requested_model: MODEL,
      disclaimer: DISCLAIMER,
    };
  }
  async function evaluate(args: unknown) {
    if (!configured(trustedCaller)) throw new JevError('UNAUTHORIZED');
    if (!configured(config.ownerId)) throw new JevError('NOT_CONFIGURED');
    if (trustedCaller !== config.ownerId) throw new JevError('FORBIDDEN');
    if (!configured(config.apiKey)) throw new JevError('NOT_CONFIGURED');
    const input = parseInput(args);
    const requestId = (dependencies.requestId ?? (() => crypto.randomUUID()))();
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new JevError('TIMEOUT')); }, 20000);
    });
    async function operation() {
      const response = await dependencies.fetch('https://api.typesafe.ai/v1/systemone', {
        // Workers rejects redirect:error before sending. Manual mode returns 3xx
        // to the non-OK rejection below; destinations are never followed.
        method: 'POST', redirect: 'manual', cache: 'no-store', signal: controller.signal,
        headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MODEL, state: input.state, questions: input.questions }),
      });
      if (!response.ok) {
        void response.body?.cancel().catch(() => {});
        throw new JevError(providerCode(response.status));
      }
      const raw = await readCapped(response.body, 128 * 1024, 'RESPONSE_TOO_LARGE', controller.signal);
      let parsed: unknown;
      try { parsed = JSON.parse(raw); } catch { throw new JevError('MALFORMED_RESPONSE'); }
      const result = validateAnswers(parsed, input);
      return {
        answers: result.answers,
        needs_review: Object.values(result.answers).some(answer => answer.needs_review),
        verification_status: 'not_fact_checked' as const,
        disclaimer: DISCLAIMER,
        provider: 'TypeSafe' as const,
        requested_model: MODEL,
        returned_model: result.model,
        evaluated_at: (dependencies.now ?? (() => new Date()))().toISOString(),
        usage: result.usage,
        request_id: requestId,
        sources: (input.sources ?? []).map(source => ({ ...source, verification_status: 'unverified' as const })),
      };
    }
    try { return await Promise.race([operation(), timeout]); }
    catch (error) {
      if (controller.signal.aborted) throw new JevError('TIMEOUT');
      if (error instanceof JevError) throw error;
      throw new JevError('PROVIDER_UNAVAILABLE');
    } finally { clearTimeout(timer); }
  }
  return { status, evaluate };
}
