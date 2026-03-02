import { fhirBaseUrl, openmrsFetch, restBaseUrl, type Visit } from '@openmrs/esm-framework';
import { mockCurrentVisit } from '__mocks__';
import { fetchVisitDataForSummary, serializeVisitDataForLLM } from './ai-visit-summary.resource';

const mockOpenmrsFetch = jest.mocked(openmrsFetch);

const VISIT_CUSTOM_REPRESENTATION =
  'custom:(uuid,location,encounters:(uuid,diagnoses:(uuid,display,rank,diagnosis,voided),form:(uuid,display,name,description,encounterType,version,resources:(uuid,display,name,valueReference)),encounterDatetime,orders:full,obs:(uuid,concept:(uuid,display,conceptClass:(uuid,display)),display,groupMembers:(uuid,concept:(uuid,display),value:(uuid,display),display),value,obsDatetime),encounterType:(uuid,display,viewPrivilege,editPrivilege),encounterProviders:(uuid,display,encounterRole:(uuid,display),provider:(uuid,person:(uuid,display)))),visitType:(uuid,name,display),startDatetime,stopDatetime,patient,attributes:(attributeType:ref,display,uuid,value)';

describe('ai-visit-summary.resource', () => {
  beforeEach(() => {
    mockOpenmrsFetch.mockReset();
  });

  describe('fetchVisitDataForSummary', () => {
    it('fetches visit, allergies, and conditions from correct URLs in parallel', async () => {
      const visitUuid = 'visit-123';
      const patientUuid = 'patient-456';

      mockOpenmrsFetch
        .mockResolvedValueOnce({ data: mockCurrentVisit } as any)
        .mockResolvedValueOnce({ data: { results: [] } } as any)
        .mockResolvedValueOnce({ data: { entry: [], total: 0 } } as any);

      await fetchVisitDataForSummary(visitUuid, patientUuid);

      expect(mockOpenmrsFetch).toHaveBeenCalledWith(
        `${restBaseUrl}/visit/${visitUuid}?v=${VISIT_CUSTOM_REPRESENTATION}`,
      );
      expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${restBaseUrl}/patient/${patientUuid}/allergy?v=full`);
      expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${fhirBaseUrl}/Condition?patient=${patientUuid}&_count=100`);
      expect(mockOpenmrsFetch).toHaveBeenCalledTimes(3);
    });

    it('returns visit, allergies, and conditions from API responses', async () => {
      const visitUuid = 'visit-123';
      const patientUuid = 'patient-456';
      const mockAllergies = { results: [{ allergen: { codedAllergen: { display: 'Penicillin' } } }] };
      const mockConditions = {
        entry: [
          {
            resource: {
              code: { coding: [{ display: 'Type 2 diabetes' }] },
              onsetDateTime: '2020-05-15',
              clinicalStatus: { coding: [{ code: 'active' }] },
            },
          },
        ],
      };

      mockOpenmrsFetch
        .mockResolvedValueOnce({ data: mockCurrentVisit } as any)
        .mockResolvedValueOnce({ data: mockAllergies } as any)
        .mockResolvedValueOnce({ data: mockConditions } as any);

      const result = await fetchVisitDataForSummary(visitUuid, patientUuid);

      expect(result.visit).toEqual(mockCurrentVisit);
      expect(result.allergies).toEqual(mockAllergies);
      expect(result.conditions).toEqual(mockConditions);
    });

    it('handles allergies and conditions fetch errors with empty fallbacks', async () => {
      mockOpenmrsFetch
        .mockResolvedValueOnce({ data: mockCurrentVisit } as any)
        .mockRejectedValueOnce(new Error('Allergy API error'))
        .mockRejectedValueOnce(new Error('Condition API error'));

      const result = await fetchVisitDataForSummary('v1', 'p1');

      expect(result.visit).toEqual(mockCurrentVisit);
      expect(result.allergies).toEqual({ results: [] });
      expect(result.conditions).toEqual({ entry: [], total: 0 });
    });
  });

  describe('serializeVisitDataForLLM', () => {
    it('serializes visit metadata with startDatetime, endDatetime, visit type, and location', () => {
      const raw = {
        visit: mockCurrentVisit,
        allergies: { results: [] },
        conditions: { entry: [] },
      };

      const result = serializeVisitDataForLLM(raw);

      expect(result.visit.startDatetime).toBe(mockCurrentVisit.startDatetime ?? '');
      expect(result.visit.endDatetime).toBe(mockCurrentVisit.stopDatetime ?? mockCurrentVisit.startDatetime ?? '');
      expect(result.visit.visitType).toBe(mockCurrentVisit.visitType.display);
      expect(result.visit.location).toBe(mockCurrentVisit.location?.display ?? '');
    });

    it('serializes diagnoses with display, rank, and certainty', () => {
      const visitWithDiagnoses = {
        ...mockCurrentVisit,
        encounters: [
          {
            uuid: 'enc-1',
            diagnoses: [
              {
                display: 'Acute sinusitis',
                rank: 1,
                certainty: 'CONFIRMED',
                voided: false,
                diagnosis: { coded: { display: 'Acute sinusitis' } },
              },
              {
                display: 'Fever',
                rank: 2,
                certainty: 'PRESUMED',
                voided: false,
                diagnosis: { coded: { display: 'Fever' } },
              },
            ],
            obs: [],
            orders: [],
            encounterProviders: [],
          },
        ],
      };
      const raw = {
        visit: visitWithDiagnoses as unknown as Visit,
        allergies: { results: [] },
        conditions: { entry: [] },
      };

      const result = serializeVisitDataForLLM(raw);

      expect(result.diagnoses).toHaveLength(2);
      expect(result.diagnoses[0]).toEqual({ display: 'Acute sinusitis', rank: 1, certainty: 'CONFIRMED' });
      expect(result.diagnoses[1]).toEqual({ display: 'Fever', rank: 2, certainty: 'PRESUMED' });
    });

    it('returns empty certainty when not explicitly given', () => {
      const visitWithDiagnosisNoCertainty = {
        ...mockCurrentVisit,
        encounters: [
          {
            uuid: 'enc-1',
            diagnoses: [
              { display: 'Hypertension', rank: 1, voided: false, diagnosis: { coded: { display: 'Hypertension' } } },
            ],
            obs: [],
            orders: [],
            encounterProviders: [],
          },
        ],
      };
      const raw = {
        visit: visitWithDiagnosisNoCertainty as unknown as Visit,
        allergies: { results: [] },
        conditions: { entry: [] },
      };

      const result = serializeVisitDataForLLM(raw);

      expect(result.diagnoses[0]).toEqual({ display: 'Hypertension', rank: 1, certainty: '' });
    });

    it('flattens nested groupMembers in obs using separator', () => {
      const visitWithNestedObs = {
        ...mockCurrentVisit,
        encounters: [
          {
            uuid: 'enc-1',
            encounterDatetime: '2025-02-15T09:35:00.000Z',
            obs: [
              {
                concept: { display: 'Physical exam' },
                groupMembers: [
                  {
                    concept: { display: 'Cardiovascular' },
                    groupMembers: [
                      { concept: { display: 'Heart sounds' }, value: { display: 'Regular' }, groupMembers: [] },
                    ],
                  },
                ],
              },
            ],
            orders: [],
            encounterProviders: [],
            diagnoses: [],
          },
        ],
      };
      const raw = {
        visit: visitWithNestedObs as unknown as Visit,
        allergies: { results: [] },
        conditions: { entry: [] },
      };

      const result = serializeVisitDataForLLM(raw);

      expect(result.observations).toContainEqual({
        concept: 'Physical exam › Cardiovascular › Heart sounds',
        value: 'Regular',
      });
    });

    it('classifies vital concepts into vitals array', () => {
      const visitWithVitals = {
        ...mockCurrentVisit,
        encounters: [
          {
            uuid: 'enc-1',
            encounterDatetime: '2025-02-15T09:35:00.000Z',
            obs: [
              { concept: { display: 'Systolic blood pressure' }, value: 128, display: '128' },
              { concept: { display: 'Weight' }, value: 72, display: '72' },
            ],
            orders: [],
            encounterProviders: [],
            diagnoses: [],
          },
        ],
      };
      const raw = {
        visit: visitWithVitals as unknown as Visit,
        allergies: { results: [] },
        conditions: { entry: [] },
      };

      const result = serializeVisitDataForLLM(raw);

      expect(result.vitals).toHaveLength(2);
      expect(result.vitals.map((v) => v.concept)).toContain('Systolic blood pressure');
      expect(result.vitals.map((v) => v.concept)).toContain('Weight');
    });

    it('serializes allergies and active conditions', () => {
      const raw = {
        visit: mockCurrentVisit,
        allergies: {
          results: [
            {
              allergen: { codedAllergen: { display: 'Penicillin' } },
              reactions: [{ reaction: { display: 'Rash' } }],
              severity: { display: 'Moderate' },
            },
          ],
        },
        conditions: {
          entry: [
            {
              resource: {
                code: { coding: [{ display: 'Type 2 diabetes mellitus' }] },
                onsetDateTime: '2020-05-15',
                clinicalStatus: { coding: [{ code: 'active' }] },
              },
            },
          ],
        },
      };

      const result = serializeVisitDataForLLM(raw);

      expect(result.allergies).toEqual([{ allergen: 'Penicillin', reaction: 'Rash', severity: 'Moderate' }]);
      expect(result.activeConditions).toEqual([
        { condition: 'Type 2 diabetes mellitus', onsetDate: '2020-05', status: 'active' },
      ]);
    });
  });
});
