export interface LlmGenerateOptions {
  backendUrl: string;
  visitUuid: string;
  patientUuid: string;
}

export async function generateVisitSummary(options: LlmGenerateOptions): Promise<string> {
  const { backendUrl, visitUuid, patientUuid } = options;

  const url = `${backendUrl.replace(/\/$/, '')}/api/generate-visit-summary`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitUuid, patientUuid }),
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
