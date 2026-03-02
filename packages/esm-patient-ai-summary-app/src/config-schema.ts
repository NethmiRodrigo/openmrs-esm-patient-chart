import { Type } from '@openmrs/esm-framework';

export interface AiVisitSummarizerConfig {
  provider: string;
  backendUrl: string;
  model: string;
}

export const configSchema = {
  aiVisitSummarizer: {
    provider: {
      _type: Type.String,
      _default: 'anthropic',
      _description: 'LLM provider: openai | anthropic',
      _validators: [
        (value) => {
          if (value !== 'openai' && value !== 'anthropic') {
            return 'Invalid provider';
          }
          return true;
        },
      ],
    },
    backendUrl: {
      _type: Type.String,
      _default: 'http://localhost:3001',
      _description: 'Base URL of the openmrs-ai-proxy-server (e.g. http://localhost:3001)',
    },
    model: {
      _type: Type.String,
      _default: 'claude-sonnet-4-6',
      _description: 'Model name to pass to the proxy server',
    },
  },
};
