import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, SkeletonText } from '@carbon/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { showSnackbar, useConfig, Workspace2 } from '@openmrs/esm-framework';
import { type PatientWorkspace2DefinitionProps } from '@openmrs/esm-patient-common-lib';
import { generateVisitSummary } from './llm.service';
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
  };
  const backendUrl = aiConfig.backendUrl?.trim() ?? 'http://localhost:3001';

  const summaryRef = useRef<HTMLDivElement>(null);

  const [summary, setSummary] = useState<string | null>(null);
  const [status, setStatus] = useState<'generating' | 'done' | 'error'>('generating');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePrint = useCallback(() => {
    if (!summaryRef.current) return;
    const win = window.open('', '_blank');
    if (!win) return;

    const titleEl = win.document.createElement('title');
    titleEl.textContent = t('aiVisitSummary', 'AI Visit Summary');
    win.document.head.appendChild(titleEl);

    const style = win.document.createElement('style');
    style.textContent = [
      'body { font-family: sans-serif; font-size: 14px; line-height: 1.6; margin: 2cm; color: #000; }',
      'h1 { font-size: 1.4em; margin-top: 1.5em; }',
      'h2 { font-size: 1.2em; margin-top: 1.2em; }',
      'table { border-collapse: collapse; width: 100%; margin: 1em 0; }',
      'th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }',
      'th { font-weight: 600; background: #f4f4f4; }',
      'ul, ol { margin-left: 1.5em; }',
    ].join('\n');
    win.document.head.appendChild(style);

    win.document.body.appendChild(summaryRef.current.cloneNode(true));

    win.focus();
    win.print();
    win.close();
  }, [t]);

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
  }, [visit.uuid, patientUuid, backendUrl, t]);

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
            <div ref={summaryRef} className={styles.summarySection}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
            </div>
            <div className={styles.actions}>
              <Button kind="ghost" onClick={handlePrint}>
                {t('printSummary', 'Print')}
              </Button>
              <Button
                kind="secondary"
                onClick={() => {
                  setStatus('generating');
                  setSummary(null);
                  setErrorMessage(null);
                  handleGenerate();
                }}
              >
                {t('generateAgain', 'Generate again')}
              </Button>
            </div>
          </>
        )}
      </div>
    </Workspace2>
  );
};

export default AiVisitSummaryWorkspace;
