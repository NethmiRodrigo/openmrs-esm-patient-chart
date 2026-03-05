import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, SkeletonText } from '@carbon/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { showSnackbar, useConfig, Workspace2 } from '@openmrs/esm-framework';
import { type PatientWorkspace2DefinitionProps } from '@openmrs/esm-patient-common-lib';
import { generateVisitSummary, type LlmProvider } from './llm.service';
import { type AiVisitSummarizerConfig } from './config-schema';
import styles from './ai-visit-summary.workspace.scss';

interface AiVisitSummaryWorkspaceProps {
  visit: { uuid: string };
}

const AiVisitSummaryWorkspace: React.FC<PatientWorkspace2DefinitionProps<AiVisitSummaryWorkspaceProps, {}>> = ({
  closeWorkspace,
  workspaceProps: { visit },
  groupProps: { patientUuid },
}) => {
  const { t } = useTranslation();
  const config = useConfig<{ aiVisitSummarizer?: AiVisitSummarizerConfig }>();
  const aiConfig: AiVisitSummarizerConfig = config?.aiVisitSummarizer ?? {
    backendUrl: 'http://localhost:3001',
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
  };
  const backendUrl = aiConfig.backendUrl?.trim() ?? 'http://localhost:3001';
  const provider = (aiConfig.provider as LlmProvider) ?? 'anthropic';
  const effectiveModel = aiConfig.model ?? 'claude-sonnet-4-6';

  const [summary, setSummary] = useState<string | null>(null);
  const [status, setStatus] = useState<'generating' | 'done' | 'error'>('generating');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!backendUrl) {
      setErrorMessage(t('backendUrlNotConfigured', 'Backend URL must be configured in the application config'));
      setStatus('error');
      showSnackbar({
        kind: 'error',
        title: t('backendUrlNotConfigured', 'Backend URL must be configured in the application config'),
      });
      return;
    }

    setStatus('generating');
    setErrorMessage(null);
    setSummary(null);

    try {
      const result = await generateVisitSummary({
        backendUrl,
        provider,
        model: effectiveModel,
        visitUuid: visit.uuid,
        patientUuid,
      });

      setSummary(result);
      setStatus('done');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      setStatus('error');
      showSnackbar({
        kind: 'error',
        title: t('errorGeneratingSummary', 'Error generating summary'),
        subtitle: msg,
      });
    }
  }, [visit.uuid, patientUuid, backendUrl, provider, effectiveModel, t]);

  useEffect(() => {
    handleGenerate();
  }, [handleGenerate]);

  return (
    <Workspace2 title={t('aiVisitSummary', 'AI Visit Summary')} hasUnsavedChanges={false}>
      <div className={styles.container}>
        {status === 'error' && errorMessage && <p className={styles.errorText}>{errorMessage}</p>}

        {status === 'generating' && (
          <div className={styles.skeletonSection}>
            <SkeletonText paragraph lineCount={12} />
          </div>
        )}

        {status === 'done' && summary && (
          <>
            <div className={styles.summarySection}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
            </div>
            <Button
              kind="secondary"
              onClick={() => {
                setStatus('generating');
                setSummary(null);
                setErrorMessage(null);
                handleGenerate();
              }}
              className={styles.regenerateButton}
            >
              {t('generateAgain', 'Generate again')}
            </Button>
          </>
        )}
      </div>
    </Workspace2>
  );
};

export default AiVisitSummaryWorkspace;
