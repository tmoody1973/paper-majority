import { z } from 'zod';

import { COMPUTED_TAGS } from '@/domain/types';
import type {
  CardDefinition,
  GoverningValue,
  ScenarioDefinition,
  SourceClass,
} from '@/domain/types';

const idSchema = z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/);
const districtIdSchema = z.string().regex(/^[A-Z]{2}-\d{2}$/);
const finiteNonnegative = z.number().finite().nonnegative();
const positiveInteger = z.number().int().positive();
const httpsUrl = z.string().url().refine((url) => url.startsWith('https://'));

const CARD_KINDS = [
  'staff',
  'policy',
  'evidence',
  'coalition',
  'constituency',
  'institution',
  'political',
  'tactic',
] as const;
const SOURCE_CLASSES = ['official', 'derived', 'simulated'] as const;
const PARTIES = ['democratic', 'republican'] as const;
const RUN_MODES = ['interaction-spike', 'session', 'term'] as const;
const FORMS = ['raw', 'summary', 'drafted', 'prepared'] as const;
const STAGES = [
  'draft',
  'committee',
  'house',
  'senate',
  'resolution',
  'election',
  'complete',
] as const;
const SUPPORT_STATES = ['unavailable', 'interested', 'conditional', 'committed', 'refused'] as const;
const GOVERNING_VALUES = [
  'Fiscal Stewardship',
  'Local Control',
  'Market Competition',
  'Public Investment',
  'Tenant Stability',
  'Housing Supply',
  'Environmental Resilience',
  'Fair Access',
] as const satisfies readonly GoverningValue[];
const RESOURCE_KEYS = [
  'staffAttention',
  'politicalCapital',
  'districtTrust',
  'billMomentum',
  'policyIntegrity',
  'staffMorale',
] as const;

const citationSchema = z.strictObject({
  title: z.string().min(1),
  url: httpsUrl,
  retrievedAt: z.iso.date(),
  publishedAt: z.iso.date().optional(),
});

const cardBaseShape = {
  id: idSchema,
  title: z.string().min(1),
  tags: z.array(idSchema),
  sourceClass: z.enum(SOURCE_CLASSES),
  citations: z.array(citationSchema),
  workload: finiteNonnegative,
  contextualSubtitle: z.string().min(1).optional(),
  plainLanguage: z.string().min(1).optional(),
};

const ordinaryCardSchema = <const K extends (typeof CARD_KINDS)[number]>(kind: K) =>
  z.strictObject({ ...cardBaseShape, kind: z.literal(kind) });

const policyCardSchema = z.strictObject({
  ...cardBaseShape,
  kind: z.literal('policy'),
  plainLanguage: z.string().min(1),
  valueEffects: z.partialRecord(
    z.enum(GOVERNING_VALUES),
    z.union([z.literal(-1), z.literal(0), z.literal(1)]),
  ),
  committeeJurisdiction: z.string().min(1),
  precedentIds: z.array(idSchema),
  editorialReviewDate: z.iso.date(),
});

const coalitionCardSchema = z.strictObject({
  ...cardBaseShape,
  kind: z.literal('coalition'),
  simulation: z.strictObject({
    interestTags: z.array(idSchema).min(1),
  }).optional(),
  officialRecord: z.discriminatedUnion('provenance', [
    z.strictObject({
      provenance: z.literal('official'),
      officeTitle: z.string().min(1),
      memberName: z.string().min(1),
      party: z.enum(PARTIES),
      stateCode: z.string().regex(/^[A-Z]{2}$/),
      district: z.string().min(1),
      congress: positiveInteger,
      profileUrl: httpsUrl,
    }),
    z.strictObject({
      provenance: z.literal('simulated-fixture'),
      officeTitle: z.string().min(1),
      memberName: z.string().min(1),
      party: z.enum(PARTIES).optional(),
      stateCode: z.string().regex(/^[A-Z]{2}$/),
      district: z.string().min(1),
      congress: positiveInteger,
      profileUrl: httpsUrl,
    }),
  ]),
});

const constituencyCardSchema = z.strictObject({
  ...cardBaseShape,
  kind: z.literal('constituency'),
  authoredConcern: z.strictObject({
    concernId: idSchema,
    recipientOfficeDefinitionId: idSchema,
  }).optional(),
});

const cardSchema = z.discriminatedUnion('kind', [
  ordinaryCardSchema('staff'),
  policyCardSchema,
  z.strictObject({
    ...cardBaseShape,
    kind: z.literal('evidence'),
    roleTags: z.array(idSchema).min(1).optional(),
    validForms: z.array(z.enum(['raw', 'summary', 'prepared'])).min(1).optional(),
    transformations: z.array(z.enum([
      'summarize',
      'office-response',
      'district-packet',
      'committee-packet',
    ])).min(1).optional(),
    underlyingSourceIds: z.array(idSchema).min(1).optional(),
    sinks: z.array(z.enum([
      'drafting',
      'office-concern',
      'district-preparation',
      'committee-preparation',
    ])).min(1).optional(),
  }),
  coalitionCardSchema,
  constituencyCardSchema,
  ordinaryCardSchema('institution'),
  ordinaryCardSchema('political'),
  ordinaryCardSchema('tactic'),
]);

export const resourceCostSchema = z.strictObject(
  Object.fromEntries(RESOURCE_KEYS.map((key) => [key, finiteNonnegative.optional()])) as {
    [K in (typeof RESOURCE_KEYS)[number]]: z.ZodOptional<typeof finiteNonnegative>;
  },
);

const recipeSlotSchema = z.strictObject({
  kind: z.enum(CARD_KINDS).optional(),
  requiredTags: z.array(idSchema).optional(),
  anyTags: z.array(idSchema).optional(),
  sourceClasses: z.array(z.enum(SOURCE_CLASSES)).optional(),
  forms: z.array(z.enum(FORMS)).optional(),
  originExplanationKeys: z.array(z.string().min(1)).min(1).optional(),
  quantity: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  consumed: z.boolean().optional(),
});

const recipeOutputSchema = z.discriminatedUnion('mode', [
  z.strictObject({ mode: z.literal('fixed'), definitionId: idSchema }),
  z.strictObject({
    mode: z.literal('derived'),
    resolverId: z.enum([
      'summarize-evidence-v1',
      'draft-provision-v1',
      'answer-office-concern-v1',
      'prepare-evidence-packet-v1',
      'resolve-outreach-v1',
      'strengthen-provision-v1',
      'prepare-district-response-v1',
      'prepare-committee-packet-v1',
      'prepare-district-endorsement-v1',
      'prepare-political-asset-v1',
      'review-provision-v1',
    ]),
    parameters: z.record(z.string(), z.union([z.string(), z.number().finite(), z.boolean()])).optional(),
  }),
]);

export const recipePatternSchema = z.strictObject({
  id: idSchema,
  slots: z.array(recipeSlotSchema).min(1),
  eligibleStages: z.array(z.enum(STAGES)).min(1).optional(),
  output: recipeOutputSchema,
  durationMs: positiveInteger,
  resourceCost: resourceCostSchema,
  priority: z.number().int(),
  discoveryHint: z.string().min(1),
});

const sessionExpansionEffectSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('widen-slot'),
    slotIndex: z.number().int().nonnegative(),
    addAnyTags: z.array(idSchema).optional(),
    addSourceClasses: z.array(z.enum(SOURCE_CLASSES)).optional(),
  }),
  z.strictObject({
    kind: z.literal('resource-cost'),
    resource: z.enum(RESOURCE_KEYS),
    delta: z.number().finite(),
  }),
  z.strictObject({
    kind: z.literal('duration-multiplier'),
    multiplier: z.number().finite().positive(),
  }),
  z.strictObject({ kind: z.literal('procedure-eligibility'), stage: z.enum(STAGES) }),
]);

const legacyExpansionEffectSchema = z.discriminatedUnion('kind', [
  ...sessionExpansionEffectSchema.options,
  z.strictObject({ kind: z.literal('output-strength'), delta: z.number().finite() }),
]);

const expansionBaseShape = {
  id: idSchema,
  tacticDefinitionId: idSchema,
  targetPatternId: idSchema,
  expansionNote: z.string().min(1),
  studyCost: finiteNonnegative,
  studyDurationMs: positiveInteger,
  eligibleStaffTags: z.array(idSchema).min(1),
};

export const tacticExpansionSchema = z.strictObject({
  ...expansionBaseShape,
  effect: sessionExpansionEffectSchema,
});

const storyConditionSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('metric'),
    metric: z.enum(RESOURCE_KEYS),
    op: z.enum(['lt', 'lte', 'gte', 'gt']),
    value: z.number().finite(),
  }),
  z.strictObject({ kind: z.literal('week'), min: positiveInteger, max: positiveInteger }),
  z.strictObject({ kind: z.literal('stage'), anyOf: z.array(z.enum(STAGES)).min(1) }),
  z.strictObject({ kind: z.literal('hasProvision'), provisionId: idSchema }),
  z.strictObject({
    kind: z.literal('relationshipCount'),
    support: z.enum(SUPPORT_STATES),
    op: z.enum(['gte', 'lt']),
    value: z.number().int().nonnegative(),
  }),
]);

const storyChoiceSchema = z.strictObject({
  id: idSchema,
  label: z.string().min(1),
  cost: resourceCostSchema,
  effects: z.strictObject(
    Object.fromEntries(RESOURCE_KEYS.map((key) => [key, z.number().finite().optional()])) as {
      [K in (typeof RESOURCE_KEYS)[number]]: z.ZodOptional<z.ZodNumber>;
    },
  ),
  electionEffect: z.number().int().min(-3).max(3).optional(),
  electionEffectExplanation: z.string().min(1).optional(),
}).superRefine((choice, ctx) => {
  if ((choice.electionEffect === undefined) !== (choice.electionEffectExplanation === undefined)) {
    ctx.addIssue({ code: 'custom', message: 'electionEffect and its explanation must appear together' });
  }
});

const storyEventSchema = z.strictObject({
  id: idSchema,
  title: z.string().min(1),
  body: z.string().min(1),
  class: z.enum(['opportunity', 'pressure', 'consequence', 'recovery']),
  pressureCategory: z.enum(['district', 'staff', 'media', 'coalition', 'procedure']).optional(),
  minWeek: positiveInteger,
  maxWeek: positiveInteger,
  cooldownWeeks: z.number().int().nonnegative(),
  weight: positiveInteger,
  conditions: z.array(storyConditionSchema),
  choices: z.array(storyChoiceSchema).min(1),
  whyRules: z.array(z.string().min(1)).min(1),
});

const dueTimeSchema = z.strictObject({
  week: z.number().int().min(1).max(6),
  // Authored due times must be reachable at every supported pace, including brisk.
  offsetMs: z.number().int().min(0).max(75_000),
});

export const relationshipConditionSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('bill-has-tag'), tag: idSchema }),
  z.strictObject({ kind: z.literal('prepared-evidence-tag'), tag: idSchema }),
  z.strictObject({ kind: z.literal('governing-value'), value: z.enum(GOVERNING_VALUES) }),
]);

const obligationFulfillmentSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('docketed-policy-tag'), tag: idSchema }),
  z.strictObject({ kind: z.literal('prepared-evidence-tag'), tag: idSchema }),
  z.strictObject({
    kind: z.literal('completed-pattern'),
    patternId: idSchema,
    sourceDefinitionId: idSchema.optional(),
    concernId: idSchema.optional(),
    requireSourceCardOccurrence: z.boolean().optional(),
  }),
]);

const decisionChoiceEffectSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('resource'),
    resource: z.enum(RESOURCE_KEYS).refine((resource) => resource !== 'policyIntegrity', {
      message: 'Policy Integrity is derived from bill provisions and governing values',
    }),
    delta: z.number().finite(),
  }),
  z.strictObject({ kind: z.literal('create-obligation'), obligationDefinitionId: idSchema }),
  z.strictObject({ kind: z.literal('relationship-support'), support: z.enum(SUPPORT_STATES) }),
  z.strictObject({ kind: z.literal('promise-condition'), condition: relationshipConditionSchema }),
  z.strictObject({ kind: z.literal('bill-add-provision'), provisionId: idSchema }),
  z.strictObject({ kind: z.literal('bill-remove-provision'), provisionId: idSchema }),
]);

const packPoolSchema = z.strictObject({
  id: idSchema,
  title: z.string().min(1),
  drawCount: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  options: z.array(
    z.strictObject({ definitionId: idSchema, weight: positiveInteger }),
  ).min(1),
  fallbackDefinitionIds: z.array(idSchema).min(1),
});

const commonScenarioShape = {
  snapshotId: idSchema,
  frozenAt: z.iso.datetime(),
  issue: z.strictObject({ id: z.literal('housing-affordability'), title: z.string().min(1) }),
  districts: z.array(z.strictObject({
    id: districtIdSchema,
    title: z.string().min(1),
    role: z.string().min(1),
    sourceYear: positiveInteger,
    uncertaintyNote: z.string().min(1),
    citations: z.array(citationSchema).min(1),
  })).min(1),
  cards: z.array(cardSchema).min(1),
  startingCardDefinitionIds: z.array(idSchema).nonempty(),
  tagTaxonomy: z.array(idSchema),
  patterns: z.array(recipePatternSchema),
  storyEvents: z.array(storyEventSchema),
  houseModel: z.strictObject({
    totalSeats: z.literal(435),
    curatedMemberSeats: z.number().int().nonnegative(),
    anonymousSeats: z.number().int().nonnegative(),
    sourceClass: z.literal('simulated'),
    baseline: z.strictObject({
      committed: z.number().int().nonnegative(),
      conditional: z.number().int().nonnegative(),
      undecided: z.number().int().nonnegative(),
      opposed: z.number().int().nonnegative(),
    }),
  }),
};

const rawScenarioSchema = z.strictObject({
  schemaVersion: z.literal(2),
  supportedModes: z.array(z.enum(RUN_MODES)).nonempty(),
  contentStatus: z.strictObject({
    status: z.enum(['candidate', 'reviewed']),
    humanReviewPending: z.boolean(),
    notice: z.string().min(1),
  }).optional(),
  ...commonScenarioShape,
  tacticExpansions: z.array(tacticExpansionSchema),
  weeklyPacks: z.array(z.strictObject({
    week: z.number().int().min(1).max(6),
    guaranteedDefinitionIds: z.array(idSchema),
    pools: z.array(packPoolSchema),
  })),
  obligationDefinitions: z.array(z.strictObject({
    id: idSchema,
    title: z.string().min(1),
    sourceDefinitionId: idSchema,
    due: dueTimeSchema,
    dueOptions: z.array(dueTimeSchema).min(2).optional(),
    mandatory: z.boolean(),
    rewardCapital: finiteNonnegative,
    trustPenalty: finiteNonnegative,
    fulfillment: obligationFulfillmentSchema,
  })),
  demandDefinitions: z.array(z.strictObject({
    id: idSchema,
    title: z.string().min(1),
    officeDefinitionId: idSchema,
    condition: relationshipConditionSchema,
    choiceIds: z.array(idSchema).min(1),
  })),
  decisionChoices: z.array(z.strictObject({
    id: idSchema,
    label: z.string().min(1),
    action: z.enum(['accept', 'reject', 'counter']),
    requirements: z.array(relationshipConditionSchema),
    effects: z.array(decisionChoiceEffectSchema),
    requiredWorkPatternId: idSchema.optional(),
  })),
  modeObjectives: z.array(z.strictObject({
    id: idSchema,
    mode: z.enum(['session', 'term']),
    kind: z.literal('readiness'),
    minProvisionCount: z.number().int().nonnegative(),
    minCommittedOfficeCount: z.number().int().nonnegative(),
    requireNoOverdueMandatory: z.boolean(),
  })),
  staffTraits: z.array(z.strictObject({
    id: idSchema,
    title: z.string().min(1),
    eligibleStaffDefinitionIds: z.array(idSchema).min(1),
    effect: z.strictObject({
      kind: z.literal('duration-multiplier'),
      taskTag: idSchema,
      multiplier: z.number().finite().positive().max(1),
    }),
  })),
});

function addReferenceIssue(ctx: z.RefinementCtx, message: string, path: PropertyKey[] = []) {
  ctx.addIssue({ code: 'custom', message, path });
}

function uniqueIds(
  ctx: z.RefinementCtx,
  label: string,
  entries: readonly { id: string }[],
  path: PropertyKey[],
) {
  const seen = new Set<string>();
  for (const [index, entry] of entries.entries()) {
    if (seen.has(entry.id)) addReferenceIssue(ctx, `Duplicate ${label} ID: ${entry.id}`, [...path, index, 'id']);
    seen.add(entry.id);
  }
}

export const scenarioSchema: z.ZodType<ScenarioDefinition> = rawScenarioSchema.superRefine(
  (scenario, ctx) => {
    uniqueIds(ctx, 'card', scenario.cards, ['cards']);
    uniqueIds(ctx, 'pattern', scenario.patterns, ['patterns']);
    uniqueIds(ctx, 'Tactic expansion', scenario.tacticExpansions, ['tacticExpansions']);
    uniqueIds(ctx, 'story event', scenario.storyEvents, ['storyEvents']);
    uniqueIds(ctx, 'obligation', scenario.obligationDefinitions, ['obligationDefinitions']);
    uniqueIds(ctx, 'demand', scenario.demandDefinitions, ['demandDefinitions']);
    uniqueIds(ctx, 'decision choice', scenario.decisionChoices, ['decisionChoices']);
    uniqueIds(ctx, 'mode objective', scenario.modeObjectives, ['modeObjectives']);
    uniqueIds(ctx, 'staff trait', scenario.staffTraits, ['staffTraits']);

    const cards = new Map(scenario.cards.map((card) => [card.id, card]));
    const patterns = new Map(scenario.patterns.map((pattern) => [pattern.id, pattern]));
    const tags = new Set(scenario.tagTaxonomy);
    const choices = new Set(scenario.decisionChoices.map((choice) => choice.id));
    const obligations = new Set(scenario.obligationDefinitions.map((entry) => entry.id));
    const demands = new Map(scenario.demandDefinitions.map((demand) => [demand.id, demand]));

    if (new Set(scenario.supportedModes).size !== scenario.supportedModes.length) {
      addReferenceIssue(ctx, 'Supported modes must be unique', ['supportedModes']);
    }
    if (
      scenario.houseModel.curatedMemberSeats + scenario.houseModel.anonymousSeats !==
        scenario.houseModel.totalSeats ||
      Object.values(scenario.houseModel.baseline).reduce((sum, count) => sum + count, 0) !==
        scenario.houseModel.totalSeats
    ) {
      addReferenceIssue(ctx, 'House model counts must total 435', ['houseModel']);
    }

    for (const [index, card] of scenario.cards.entries()) {
      if (card.tags.some((tag) => (COMPUTED_TAGS as readonly string[]).includes(tag))) {
        addReferenceIssue(ctx, 'Computed relationship tags cannot be authored', ['cards', index, 'tags']);
      }
      for (const tag of card.tags) {
        if (!tags.has(tag)) addReferenceIssue(ctx, `Unknown tag: ${tag}`, ['cards', index, 'tags']);
      }
      if (card.kind === 'coalition') {
        for (const tag of card.simulation?.interestTags ?? []) {
          if (!tags.has(tag)) {
            addReferenceIssue(ctx, `Unknown simulated interest tag: ${tag}`, [
              'cards', index, 'simulation', 'interestTags',
            ]);
          }
        }
      }
      if (card.sourceClass !== 'simulated' && card.citations.length === 0) {
        addReferenceIssue(ctx, `${card.sourceClass} cards require a citation`, ['cards', index, 'citations']);
      }
      if (
        card.kind === 'coalition' &&
        card.officialRecord.provenance === 'simulated-fixture' &&
        card.sourceClass !== 'simulated'
      ) {
        addReferenceIssue(ctx, 'Simulated fixture offices require the simulated source class', [
          'cards',
          index,
          'officialRecord',
        ]);
      }
      if (card.kind === 'constituency' && card.authoredConcern) {
        const demand = demands.get(card.authoredConcern.concernId);
        if (!demand) {
          addReferenceIssue(ctx, `Unknown authored concern: ${card.authoredConcern.concernId}`, [
            'cards', index, 'authoredConcern', 'concernId',
          ]);
        }
        if (cards.get(card.authoredConcern.recipientOfficeDefinitionId)?.kind !== 'coalition') {
          addReferenceIssue(ctx, `Unknown concern recipient: ${card.authoredConcern.recipientOfficeDefinitionId}`, [
            'cards', index, 'authoredConcern', 'recipientOfficeDefinitionId',
          ]);
        }
        if (demand && demand.officeDefinitionId !== card.authoredConcern.recipientOfficeDefinitionId) {
          addReferenceIssue(ctx, 'Authored concern recipient must match its demand office', [
            'cards', index, 'authoredConcern',
          ]);
        }
      }
    }

    for (const [index, definitionId] of scenario.startingCardDefinitionIds.entries()) {
      if (!cards.has(definitionId)) addReferenceIssue(ctx, `Unknown starting card: ${definitionId}`, ['startingCardDefinitionIds', index]);
    }

    for (const [patternIndex, pattern] of scenario.patterns.entries()) {
      const total = pattern.slots.reduce((sum, slot) => sum + slot.quantity, 0);
      if (total < 2 || total > 4) addReferenceIssue(ctx, 'Patterns require two to four total inputs', ['patterns', patternIndex, 'slots']);
      for (const [slotIndex, slot] of pattern.slots.entries()) {
        for (const tag of [...(slot.requiredTags ?? []), ...(slot.anyTags ?? [])]) {
          if (!tags.has(tag) && !(COMPUTED_TAGS as readonly string[]).includes(tag)) {
            addReferenceIssue(ctx, `Unknown slot tag: ${tag}`, ['patterns', patternIndex, 'slots', slotIndex]);
          }
        }
      }
      if (pattern.output.mode === 'fixed' && !cards.has(pattern.output.definitionId)) {
        addReferenceIssue(ctx, `Unknown fixed output: ${pattern.output.definitionId}`, ['patterns', patternIndex, 'output']);
      }
    }

    for (const [index, expansion] of scenario.tacticExpansions.entries()) {
      if (cards.get(expansion.tacticDefinitionId)?.kind !== 'tactic') addReferenceIssue(ctx, `Unknown Tactic: ${expansion.tacticDefinitionId}`, ['tacticExpansions', index]);
      const pattern = patterns.get(expansion.targetPatternId);
      if (!pattern) addReferenceIssue(ctx, `Unknown target pattern: ${expansion.targetPatternId}`, ['tacticExpansions', index]);
      if (expansion.effect.kind === 'widen-slot' && !pattern?.slots[expansion.effect.slotIndex]) addReferenceIssue(ctx, 'Widen-slot effect targets a missing slot', ['tacticExpansions', index, 'effect']);
      if (expansion.effect.kind === 'procedure-eligibility' && (!pattern?.eligibleStages || pattern.eligibleStages.includes(expansion.effect.stage))) addReferenceIssue(ctx, 'Procedure eligibility must unlock a stage excluded by the authored rule', ['tacticExpansions', index, 'effect']);
    }

    for (const [index, obligation] of scenario.obligationDefinitions.entries()) {
      if (!cards.has(obligation.sourceDefinitionId)) addReferenceIssue(ctx, `Unknown obligation source: ${obligation.sourceDefinitionId}`, ['obligationDefinitions', index]);
      if (obligation.dueOptions && !obligation.dueOptions.some((due) =>
        due.week === obligation.due.week && due.offsetMs === obligation.due.offsetMs)) {
        addReferenceIssue(ctx, 'The default due time must be one authored deadline option', ['obligationDefinitions', index, 'dueOptions']);
      }
      if (obligation.fulfillment.kind === 'completed-pattern') {
        if (!patterns.has(obligation.fulfillment.patternId)) addReferenceIssue(ctx, `Unknown fulfillment pattern: ${obligation.fulfillment.patternId}`, ['obligationDefinitions', index, 'fulfillment']);
        if (obligation.fulfillment.sourceDefinitionId
          && !cards.has(obligation.fulfillment.sourceDefinitionId)) {
          addReferenceIssue(ctx, `Unknown fulfillment source: ${obligation.fulfillment.sourceDefinitionId}`, ['obligationDefinitions', index, 'fulfillment']);
        }
        if (obligation.fulfillment.concernId && !demands.has(obligation.fulfillment.concernId)) {
          addReferenceIssue(ctx, `Unknown fulfillment concern: ${obligation.fulfillment.concernId}`, ['obligationDefinitions', index, 'fulfillment']);
        }
        const source = cards.get(obligation.sourceDefinitionId);
        if (obligation.fulfillment.sourceDefinitionId
          && obligation.fulfillment.sourceDefinitionId !== obligation.sourceDefinitionId) {
          addReferenceIssue(ctx, 'Fulfillment source must identify the obligation source card', ['obligationDefinitions', index, 'fulfillment']);
        }
        if (obligation.fulfillment.concernId && (source?.kind !== 'constituency'
          || source.authoredConcern?.concernId !== obligation.fulfillment.concernId)) {
          addReferenceIssue(ctx, 'Fulfillment concern must match the source card authored concern', ['obligationDefinitions', index, 'fulfillment']);
        }
        if (obligation.fulfillment.requireSourceCardOccurrence && !obligation.fulfillment.sourceDefinitionId) {
          addReferenceIssue(ctx, 'Occurrence-bound fulfillment requires a source definition', ['obligationDefinitions', index, 'fulfillment']);
        }
      }
      if ('tag' in obligation.fulfillment && !tags.has(obligation.fulfillment.tag)) addReferenceIssue(ctx, `Unknown obligation tag: ${obligation.fulfillment.tag}`, ['obligationDefinitions', index, 'fulfillment']);
    }
    for (const [index, demand] of scenario.demandDefinitions.entries()) {
      if (cards.get(demand.officeDefinitionId)?.kind !== 'coalition') addReferenceIssue(ctx, `Unknown demand office: ${demand.officeDefinitionId}`, ['demandDefinitions', index]);
      if ('tag' in demand.condition && !tags.has(demand.condition.tag)) addReferenceIssue(ctx, `Unknown demand tag: ${demand.condition.tag}`, ['demandDefinitions', index, 'condition']);
      for (const choiceId of demand.choiceIds) if (!choices.has(choiceId)) addReferenceIssue(ctx, `Unknown decision choice: ${choiceId}`, ['demandDefinitions', index, 'choiceIds']);
    }
    for (const [index, choice] of scenario.decisionChoices.entries()) {
      for (const effect of choice.effects) if (effect.kind === 'create-obligation' && !obligations.has(effect.obligationDefinitionId)) addReferenceIssue(ctx, `Unknown obligation effect: ${effect.obligationDefinitionId}`, ['decisionChoices', index, 'effects']);
      for (const effect of choice.effects) if ((effect.kind === 'bill-add-provision' || effect.kind === 'bill-remove-provision') && cards.get(effect.provisionId)?.kind !== 'policy') addReferenceIssue(ctx, `Unknown decision provision: ${effect.provisionId}`, ['decisionChoices', index, 'effects']);
      for (const effect of choice.effects) if (effect.kind === 'promise-condition' && 'tag' in effect.condition && !tags.has(effect.condition.tag)) addReferenceIssue(ctx, `Unknown promise condition tag: ${effect.condition.tag}`, ['decisionChoices', index, 'effects']);
      for (const requirement of choice.requirements) if ('tag' in requirement && !tags.has(requirement.tag)) addReferenceIssue(ctx, `Unknown choice requirement tag: ${requirement.tag}`, ['decisionChoices', index, 'requirements']);
      if (choice.requiredWorkPatternId && !patterns.has(choice.requiredWorkPatternId)) addReferenceIssue(ctx, `Unknown decision work pattern: ${choice.requiredWorkPatternId}`, ['decisionChoices', index, 'requiredWorkPatternId']);
    }
    for (const [weekIndex, pack] of scenario.weeklyPacks.entries()) {
      for (const definitionId of pack.guaranteedDefinitionIds) if (!cards.has(definitionId)) addReferenceIssue(ctx, `Unknown guaranteed card: ${definitionId}`, ['weeklyPacks', weekIndex]);
      for (const pool of pack.pools) {
        for (const option of pool.options) if (!cards.has(option.definitionId)) addReferenceIssue(ctx, `Unknown pool card: ${option.definitionId}`, ['weeklyPacks', weekIndex]);
        for (const definitionId of pool.fallbackDefinitionIds) if (!cards.has(definitionId)) addReferenceIssue(ctx, `Unknown fallback card: ${definitionId}`, ['weeklyPacks', weekIndex]);
      }
    }
    for (const [index, trait] of scenario.staffTraits.entries()) {
      if (!tags.has(trait.effect.taskTag)) addReferenceIssue(ctx, `Unknown trait tag: ${trait.effect.taskTag}`, ['staffTraits', index, 'effect']);
      for (const definitionId of trait.eligibleStaffDefinitionIds) if (cards.get(definitionId)?.kind !== 'staff') addReferenceIssue(ctx, `Unknown eligible staff card: ${definitionId}`, ['staffTraits', index]);
    }
    for (const [index, objective] of scenario.modeObjectives.entries()) {
      if (!scenario.supportedModes.includes(objective.mode)) addReferenceIssue(ctx, `Objective mode is not supported: ${objective.mode}`, ['modeObjectives', index, 'mode']);
    }
    for (const [index, event] of scenario.storyEvents.entries()) {
      if (event.minWeek > event.maxWeek) addReferenceIssue(ctx, 'Story event minWeek must not exceed maxWeek', ['storyEvents', index]);
      for (const condition of event.conditions) {
        if (condition.kind === 'hasProvision' && cards.get(condition.provisionId)?.kind !== 'policy') addReferenceIssue(ctx, `Unknown Story policy: ${condition.provisionId}`, ['storyEvents', index, 'conditions']);
        if (condition.kind === 'week' && condition.min > condition.max) addReferenceIssue(ctx, 'Story week min must not exceed max', ['storyEvents', index, 'conditions']);
      }
    }
  },
);

export function parseScenario(input: unknown): ScenarioDefinition {
  return scenarioSchema.parse(input);
}

const legacyCardSchema = z.strictObject({
  ...cardBaseShape,
  kind: z.enum(CARD_KINDS),
  officeParty: z.enum(PARTIES).optional(),
});

const legacyScenarioSchema = z.strictObject({
  schemaVersion: z.literal(1),
  ...commonScenarioShape,
  districts: z.array(z.strictObject({
    id: districtIdSchema,
    title: z.string().min(1),
    role: z.string().min(1),
    sourceYear: positiveInteger,
    uncertaintyNote: z.string().min(1),
    citations: z.array(citationSchema),
  })).min(1),
  cards: z.array(legacyCardSchema).min(1),
  tacticExpansions: z.array(z.strictObject({ ...expansionBaseShape, effect: legacyExpansionEffectSchema })),
  weeklyPacks: z.array(z.strictObject({ week: positiveInteger, cardDefinitionIds: z.array(idSchema) })),
});

function upgradeLegacyCard(
  card: z.infer<typeof legacyCardSchema>,
  frozenAt: string,
): CardDefinition {
  if (card.kind === 'coalition' && card.sourceClass !== 'simulated') {
    throw new Error(
      `Cannot upgrade legacy coalition card "${card.id}": its legacy coalition classification is not simulated and the record lacks verified official facts`,
    );
  }
  const shared = { ...card };
  delete (shared as { officeParty?: unknown }).officeParty;

  if (card.kind === 'policy') {
    return {
      ...shared,
      kind: 'policy',
      plainLanguage: card.plainLanguage ?? 'Legacy interaction-fixture policy.',
      valueEffects: {},
      committeeJurisdiction: 'Legacy interaction fixture',
      precedentIds: [],
      editorialReviewDate: frozenAt.slice(0, 10),
    };
  }
  if (card.kind === 'coalition') {
    return {
      ...shared,
      kind: 'coalition',
      officialRecord: {
        provenance: 'simulated-fixture',
        officeTitle: card.title,
        memberName: card.title,
        ...(card.officeParty ? { party: card.officeParty } : {}),
        stateCode: 'XX',
        district: '00',
        congress: 119,
        profileUrl: 'https://example.invalid/legacy-interaction-fixture',
      },
    };
  }
  switch (card.kind) {
    case 'staff':
      return { ...shared, kind: 'staff' };
    case 'evidence':
      return { ...shared, kind: 'evidence' };
    case 'constituency':
      return { ...shared, kind: 'constituency' };
    case 'institution':
      return { ...shared, kind: 'institution' };
    case 'political':
      return { ...shared, kind: 'political' };
    case 'tactic':
      return { ...shared, kind: 'tactic' };
    default:
      throw new Error(`Unsupported legacy card kind: ${String(card.kind)}`);
  }
}

/** Upgrade only the validated version-1 fixture shape; unknown versions never guess. */
export function upgradeLegacyScenario(input: unknown): ScenarioDefinition {
  const legacy = legacyScenarioSchema.parse(input);
  const upgraded: ScenarioDefinition = {
    schemaVersion: 2,
    snapshotId: legacy.snapshotId,
    frozenAt: legacy.frozenAt,
    supportedModes: ['interaction-spike'],
    issue: legacy.issue,
    districts: legacy.districts,
    cards: legacy.cards.map((card) => upgradeLegacyCard(card, legacy.frozenAt)),
    startingCardDefinitionIds: legacy.startingCardDefinitionIds,
    tagTaxonomy: legacy.tagTaxonomy,
    patterns: legacy.patterns,
    tacticExpansions: legacy.tacticExpansions,
    storyEvents: legacy.storyEvents,
    houseModel: legacy.houseModel,
    weeklyPacks: legacy.weeklyPacks.map((pack) => ({
      week: pack.week,
      guaranteedDefinitionIds: [...pack.cardDefinitionIds],
      pools: [],
    })),
    obligationDefinitions: [],
    demandDefinitions: [],
    decisionChoices: [],
    modeObjectives: [],
    staffTraits: [],
  };
  return upgraded;
}

export type ValidatedSourceClass = SourceClass;
