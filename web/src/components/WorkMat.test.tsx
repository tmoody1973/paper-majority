import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useState } from 'react';
import { describe, expect, it } from 'vitest';

import { WorkMat } from '@/components/WorkMat';
import { createRun } from '@/domain/initialState';
import type { CardInstance, TermState } from '@/domain/types';
import { createGameSession } from '@/game/session';
import { sessionScenario, sessionSetup } from '@/test/fixtures/session';

function makeSession() {
  const base = createRun({ ...sessionSetup, mode: 'session' });
  const evidence = base.cards.find((card) => card.definitionId === 'evidence-rent-burden-report')!;
  const summary: CardInstance = {
    ...evidence,
    id: 'card-summary',
    stackId: 'stack-card-summary',
    form: 'summary',
  };
  const state: TermState = {
    ...base,
    cards: [...base.cards, summary],
    stacks: [...base.stacks, { id: summary.stackId, cardIds: [summary.id] }],
  };
  return createGameSession(state, sessionScenario);
}

function Harness({ session }: { session: ReturnType<typeof makeSession> }) {
  const [state, setState] = useState(session.getState());
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => session.subscribe((result) => setState(result.state)), [session]);
  return <WorkMat session={session} state={state} selectedCardIds={ids} onSelectedCardIdsChange={setIds} />;
}

describe('WorkMat', () => {
  it('stages, removes, restages, and begins three-card work without reserving early', async () => {
    const user = userEvent.setup();
    const session = makeSession();
    const before = session.getState().resources.staffAttention;
    const idOf = (definitionId: string, form?: string) => session.getState().cards.find(
      (card) => card.definitionId === definitionId && (!form || card.form === form),
    )!.id;
    const counsel = idOf('staff-legislative-counsel');
    const summary = idOf('evidence-rent-burden-report', 'summary');
    const policy = idOf('policy-housing-choice-voucher');
    render(<Harness session={session} />);

    for (const id of [counsel, summary, policy]) {
      await user.selectOptions(screen.getByTestId('work-mat-picker'), id);
      await user.click(screen.getByTestId('work-mat-stage'));
    }
    expect(session.getState().resources.staffAttention).toBe(before);
    expect(session.getState().activeWork).toEqual([]);

    await user.click(screen.getByRole('button', { name: /remove rent burden report/i }));
    expect(screen.getByTestId('work-mat-begin')).toBeDisabled();
    await user.selectOptions(screen.getByTestId('work-mat-picker'), summary);
    await user.click(screen.getByTestId('work-mat-stage'));
    expect(screen.getByTestId('work-mat-begin')).toBeEnabled();
    expect(screen.getByTestId('work-mat-preview')).toHaveTextContent(/Drafted Housing Choice Voucher in 40s/i);
    expect(screen.getByTestId('work-mat-preview')).toHaveTextContent(/Assigned: Legislative Counsel/i);
    expect(screen.getByTestId('work-mat-preview')).toHaveTextContent(/Consumes: Housing Choice Voucher, Rent Burden Report — summary/i);
    expect(screen.getByTestId('work-mat-preview')).toHaveTextContent(/Returns: Legislative Counsel/i);
    expect(session.getState().resources.staffAttention).toBe(before);

    await user.click(screen.getByTestId('work-mat-begin'));
    expect(session.getState().activeWork).toHaveLength(1);
    expect(session.getState().resources.staffAttention).toBe(before - 1);
  });
});
