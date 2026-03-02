import { fhirBaseUrl, openmrsFetch, restBaseUrl, type Visit } from '@openmrs/esm-framework';

const VISIT_CUSTOM_REPRESENTATION =
  'custom:(uuid,location,encounters:(uuid,diagnoses:(uuid,display,rank,diagnosis,voided),form:(uuid,display,name,description,encounterType,version,resources:(uuid,display,name,valueReference)),encounterDatetime,orders:full,obs:(uuid,concept:(uuid,display,conceptClass:(uuid,display)),display,groupMembers:(uuid,concept:(uuid,display),value:(uuid,display),display),value,obsDatetime),encounterType:(uuid,display,viewPrivilege,editPrivilege),encounterProviders:(uuid,display,encounterRole:(uuid,display),provider:(uuid,person:(uuid,display)))),visitType:(uuid,name,display),startDatetime,stopDatetime,patient,attributes:(attributeType:ref,display,uuid,value)';

export interface SerializedVisitData {
  patient?: {
    id: string;
    name: string;
    birthDate?: string;
    gender?: string;
  };
  visit: {
    startDatetime: string;
    endDatetime: string;
    visitType: string;
    location: string;
  };
  providers: Array<{ name: string; role: string }>;
  vitals: Array<{
    concept: string;
    value: string;
    unit?: string;
    datetime: string;
  }>;
  diagnoses: Array<{ display: string; rank: number; certainty: string }>;
  observations: Array<{ concept: string; value: string }>;
  medicationsOrdered: Array<{
    drug: string;
    dose: string;
    route: string;
    frequency: string;
    duration: string;
    orderer: string;
    dateOrdered: string;
  }>;
  testsOrdered: Array<{
    test: string;
    dateOrdered: string;
    status: string;
  }>;
  testsResults: Array<{
    test: string;
    value: string;
    unit?: string;
    referenceRange?: string;
    datetime: string;
  }>;
  allergies: Array<{
    allergen: string;
    reaction: string;
    severity: string;
  }>;
  activeConditions: Array<{
    condition: string;
    onsetDate: string;
    status: string;
  }>;
}

const VITAL_CONCEPT_DISPLAYS = [
  'systolic',
  'diastolic',
  'blood pressure',
  'pulse',
  'heart rate',
  'temperature',
  'temp',
  'weight',
  'height',
  'oxygen',
  'respiratory',
  'spo2',
];

function isVital(conceptDisplay: string): boolean {
  const lower = conceptDisplay?.toLowerCase() ?? '';
  return VITAL_CONCEPT_DISPLAYS.some((v) => lower.includes(v));
}

const SEPARATOR = ' › ';
const MAX_RECURSE_DEPTH = 3;

function flattenObsGroupMembers(
  members: Array<{
    concept?: { display?: string };
    value?: { display?: string };
    display?: string;
    groupMembers?: Array<unknown>;
  }>,
  parentConcept: string,
  depth: number,
  out: Array<{ concept: string; value: string }>,
): void {
  if (depth > MAX_RECURSE_DEPTH) return;
  const conceptChain = parentConcept ? `${parentConcept}${SEPARATOR}` : '';

  for (const member of members ?? []) {
    const conceptDisplay = member.concept?.display ?? '';
    const fullConcept = conceptChain + conceptDisplay;
    const value = member.value?.display ?? member.display ?? (member.value as string) ?? '';

    if (member.groupMembers && Array.isArray(member.groupMembers) && member.groupMembers.length > 0) {
      flattenObsGroupMembers(member.groupMembers as typeof members, fullConcept, depth + 1, out);
    } else {
      out.push({ concept: fullConcept, value: String(value) });
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function flattenObs(obs: Array<any>): Array<{ concept: string; value: string }> {
  const result: Array<{ concept: string; value: string }> = [];
  for (const o of obs ?? []) {
    const conceptDisplay = o.concept?.display ?? '';
    const value = o.value?.display ?? o.display ?? (o.value as string) ?? '';
    if (o.groupMembers && Array.isArray(o.groupMembers) && o.groupMembers.length > 0) {
      flattenObsGroupMembers(
        o.groupMembers as Array<{
          concept?: { display?: string };
          value?: { display?: string };
          display?: string;
          groupMembers?: Array<unknown>;
        }>,
        conceptDisplay,
        1,
        result,
      );
    } else {
      result.push({ concept: conceptDisplay, value: String(value) });
    }
  }
  return result;
}

export async function fetchVisitDataForSummary(
  visitUuid: string,
  patientUuid: string,
): Promise<{
  visit: Visit;
  allergies: unknown;
  conditions: unknown;
}> {
  const visitUrl = `${restBaseUrl}/visit/${visitUuid}?v=${VISIT_CUSTOM_REPRESENTATION}`;
  const allergiesUrl = `${restBaseUrl}/patient/${patientUuid}/allergy?v=full`;
  const conditionsUrl = `${fhirBaseUrl}/Condition?patient=${patientUuid}&_count=100`;

  const [visitRes, allergiesRes, conditionsRes] = await Promise.all([
    openmrsFetch<Visit>(visitUrl),
    openmrsFetch(allergiesUrl).catch(() => ({ data: { results: [] } })),
    openmrsFetch(conditionsUrl).catch(() => ({ data: { entry: [], total: 0 } })),
  ]);

  return {
    visit: visitRes.data,
    allergies: allergiesRes.data,
    conditions: conditionsRes.data,
  };
}

export function serializeVisitDataForLLM(
  raw: {
    visit: Visit;
    allergies: unknown;
    conditions: unknown;
  },
  patient?: fhir.Patient,
): SerializedVisitData {
  const { visit, allergies, conditions } = raw;

  const startDatetime = visit?.startDatetime ?? '';
  const endDatetime = visit?.stopDatetime ?? startDatetime;

  const patientInfo = patient
    ? {
        id: patient.id ?? '',
        name:
          patient.name?.[0]?.text ??
          ([patient.name?.[0]?.given?.join(' '), patient.name?.[0]?.family].filter(Boolean).join(' ').trim() || ''),
        birthDate: patient.birthDate,
        gender: patient.gender,
      }
    : undefined;

  const providers: Array<{ name: string; role: string }> = [];
  const diagnoses: Array<{ display: string; rank: number; certainty: string }> = [];
  const vitals: SerializedVisitData['vitals'] = [];
  const observations: Array<{ concept: string; value: string }> = [];
  const medicationsOrdered: SerializedVisitData['medicationsOrdered'] = [];
  const testsOrdered: SerializedVisitData['testsOrdered'] = [];
  const testsResults: SerializedVisitData['testsResults'] = [];

  for (const enc of visit?.encounters ?? []) {
    for (const ep of enc.encounterProviders ?? []) {
      const name = ep.provider?.person?.display ?? ep.display ?? '';
      const role = ep.encounterRole?.display ?? '';
      if (name && !providers.some((p) => p.name === name)) {
        providers.push({ name, role });
      }
    }

    for (const d of enc.diagnoses ?? []) {
      if (d.voided) continue;
      const display = d.diagnosis?.coded?.display ?? d.display ?? '';
      const certainty =
        typeof d.certainty === 'string'
          ? d.certainty.trim()
          : (d.certainty as { display?: string })?.display?.trim() ?? '';
      diagnoses.push({ display, rank: d.rank ?? 999, certainty });
    }
    diagnoses.sort((a, b) => a.rank - b.rank);

    const flattenedObs = flattenObs(enc.obs ?? []);
    const encDate = enc.encounterDatetime ?? '';
    for (const o of flattenedObs) {
      if (isVital(o.concept)) {
        vitals.push({
          concept: o.concept,
          value: o.value,
          datetime: encDate,
        });
      } else {
        observations.push(o);
      }
    }

    for (const order of enc.orders ?? []) {
      const drugDisplay = order.drug?.display ?? order.concept?.display ?? order.display ?? '';
      const orderTypeDisplay = order.orderType?.display ?? '';
      const isDrug = orderTypeDisplay.toLowerCase().includes('drug') || !!order.drug;
      if (isDrug) {
        medicationsOrdered.push({
          drug: drugDisplay,
          dose: String(order.dose ?? ''),
          route: order.route?.display ?? '',
          frequency: order.frequency?.display ?? '',
          duration: `${order.duration ?? ''} ${order.durationUnits?.display ?? ''}`.trim(),
          orderer: order.orderer?.display ?? '',
          dateOrdered: order.dateActivated ? new Date(order.dateActivated).toISOString().slice(0, 10) : '',
        });
      } else {
        testsOrdered.push({
          test: drugDisplay || order.concept?.display || order.display || 'Test',
          dateOrdered: order.dateActivated ? new Date(order.dateActivated).toISOString().slice(0, 10) : '',
          status: order.fulfillerStatus ?? 'Ordered',
        });
      }
    }
  }

  const allergiesData = allergies as {
    results?: Array<{
      allergen?: { codedAllergen?: { display?: string } };
      severity?: { display?: string };
      reactions?: Array<{ reaction?: { display?: string } }>;
    }>;
  };
  const allergyList = allergiesData?.results ?? [];
  const serializedAllergies = allergyList.map((a) => ({
    allergen: a.allergen?.codedAllergen?.display ?? 'Unknown',
    reaction: a.reactions?.[0]?.reaction?.display ?? '',
    severity: a.severity?.display ?? '',
  }));

  const conditionsData = conditions as {
    entry?: Array<{
      resource?: {
        code?: { coding?: Array<{ display?: string }> };
        clinicalStatus?: { coding?: Array<{ code?: string }> };
        onsetDateTime?: string;
        abatementDateTime?: string;
      };
    }>;
    total?: number;
  };
  const conditionList = conditionsData?.entry ?? [];
  const serializedConditions = conditionList
    .map((e) => e.resource)
    .filter(Boolean)
    .map((r) => ({
      condition: r.code?.coding?.[0]?.display ?? 'Unknown',
      onsetDate: r.onsetDateTime?.slice(0, 7) ?? '',
      status: r.clinicalStatus?.coding?.[0]?.code ?? 'active',
    }));

  return {
    ...(patientInfo && { patient: patientInfo }),
    visit: {
      startDatetime,
      endDatetime,
      visitType: visit?.visitType?.display ?? '',
      location: visit?.location?.display ?? '',
    },
    providers,
    vitals,
    diagnoses,
    observations,
    medicationsOrdered,
    testsOrdered,
    testsResults,
    allergies: serializedAllergies,
    activeConditions: serializedConditions,
  };
}
