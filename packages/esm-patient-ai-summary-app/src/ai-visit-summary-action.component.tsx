import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, IconButton } from '@carbon/react';
import { DocumentIcon, launchWorkspace2, type Visit, useLayoutType } from '@openmrs/esm-framework';
import { type PatientWorkspaceGroupProps } from '@openmrs/esm-patient-common-lib';

interface AiVisitSummaryActionProps {
  visit: Visit;
  patient: fhir.Patient;
  compact?: boolean;
}

const AiVisitSummaryAction: React.FC<AiVisitSummaryActionProps> = ({ visit, patient, compact }) => {
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const responsiveSize = isTablet ? 'lg' : 'sm';
  const patientUuid = patient?.id ?? visit?.patient?.uuid;

  const handleGenerateSummary = () => {
    launchWorkspace2<{ visit: Visit }, {}, PatientWorkspaceGroupProps>(
      'ai-visit-summary-workspace',
      { visit },
      {},
      {
        patient,
        patientUuid,
        visitContext: visit,
        mutateVisitContext: () => {},
      },
    );
  };

  if (compact) {
    return (
      <IconButton
        kind="ghost"
        size={responsiveSize}
        align="top-end"
        label={t('generateAiSummary', 'Generate AI summary')}
        onClick={handleGenerateSummary}
      >
        <DocumentIcon size={16} />
      </IconButton>
    );
  }

  return (
    <Button kind="ghost" size={responsiveSize} renderIcon={DocumentIcon} onClick={handleGenerateSummary}>
      {t('generateAiSummary', 'Generate AI summary')}
    </Button>
  );
};

export default AiVisitSummaryAction;
