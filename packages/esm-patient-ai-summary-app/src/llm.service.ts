import { type SerializedVisitData } from './ai-visit-summary.resource';

export type LlmProvider = 'openai' | 'anthropic' | 'gemini' | 'local';

export interface LlmGenerateOptions {
  backendUrl: string;
  provider: LlmProvider;
  model: string;
  visitData: SerializedVisitData;
}

export async function generateVisitSummary(options: LlmGenerateOptions): Promise<string> {
  const { backendUrl, provider, model, visitData } = options;

  const url = `${backendUrl.replace(/\/$/, '')}/api/generate-visit-summary`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, model, visitData }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Proxy server error (${res.status}): ${err}`);
  }

  const data = await res.json();
  if (typeof data?.summary !== 'string') {
    throw new Error('Invalid response from proxy server');
  }
  return data.summary;
}
