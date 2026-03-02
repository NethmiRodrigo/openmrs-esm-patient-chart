import React from 'react';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { launchWorkspace2, useLayoutType } from '@openmrs/esm-framework';
import { mockCurrentVisit, mockFhirPatient } from '__mocks__';
import AiVisitSummaryAction from './ai-visit-summary-action.component';

const mockLaunchWorkspace2 = jest.mocked(launchWorkspace2);
const mockUseLayoutType = jest.mocked(useLayoutType);

const defaultProps = {
  visit: mockCurrentVisit,
  patient: mockFhirPatient,
};

describe('AiVisitSummaryAction', () => {
  beforeEach(() => {
    mockUseLayoutType.mockReturnValue('small-desktop');
  });

  it('renders a Generate AI summary button', () => {
    render(<AiVisitSummaryAction {...defaultProps} />);

    expect(screen.getByRole('button', { name: /generate ai summary/i })).toBeInTheDocument();
  });

  it('renders a compact icon button when compact is true', () => {
    render(<AiVisitSummaryAction {...defaultProps} compact />);

    expect(screen.getByRole('button', { name: /generate ai summary/i })).toBeInTheDocument();
  });

  it('calls launchWorkspace2 with correct args when clicked', async () => {
    const user = userEvent.setup();
    render(<AiVisitSummaryAction {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /generate ai summary/i }));

    expect(mockLaunchWorkspace2).toHaveBeenCalledWith(
      'ai-visit-summary-workspace',
      { visit: mockCurrentVisit },
      {},
      expect.objectContaining({
        patient: mockFhirPatient,
        patientUuid: mockFhirPatient.id,
        visitContext: mockCurrentVisit,
        mutateVisitContext: expect.any(Function),
      }),
    );
  });
});
