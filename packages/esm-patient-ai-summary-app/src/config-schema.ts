import { Type } from '@openmrs/esm-framework';

export interface AiVisitSummarizerConfig {
  backendUrl: string;
}

export const configSchema = {
  aiVisitSummarizer: {
    backendUrl: {
      _type: Type.String,
      _default: 'http://localhost:3001',
      _description: 'Base URL of the openmrs-ai-proxy-server (e.g. http://localhost:3001)',
    },
  },
};
