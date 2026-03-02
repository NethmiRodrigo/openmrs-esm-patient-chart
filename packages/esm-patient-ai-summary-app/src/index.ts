import { defineConfigSchema, getAsyncLifecycle, getSyncLifecycle } from '@openmrs/esm-framework';
import { configSchema } from './config-schema';
import aiVisitSummaryActionComponent from './ai-visit-summary-action.component';

const moduleName = '@openmrs/esm-patient-ai-summary-app';

export const importTranslation = require.context('../translations', false, /.json$/, 'lazy');

export function startupApp() {
  defineConfigSchema(moduleName, configSchema);
}

export const aiVisitSummaryAction = getSyncLifecycle(aiVisitSummaryActionComponent, {
  featureName: 'ai-visit-summary-action',
  moduleName,
});

export const aiVisitSummaryWorkspace = getAsyncLifecycle(() => import('./ai-visit-summary.workspace'), {
  featureName: 'ai-visit-summary-workspace',
  moduleName,
});
