import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useRef, useState } from 'react';
import { describe, expect, it } from 'vitest';

import { StoryDecisionModal } from '@/components/StoryDecisionModal';
import { getCandidateScenario } from '@/content/loadScenario';
import { drawStoryEvent } from '@/domain/storyDirector';
import { createRun } from '@/domain/runSetup';
import { createGameSession } from '@/game/session';

const scenario = getCandidateScenario();

function Harness() {
  const initial = drawStoryEvent(createRun({
    scenario, districtId: 'GA-05', party: 'democratic',
    values: ['Tenant Stability', 'Housing Supply'], mode: 'session', seed: 417,
  }), scenario).state;
  const session = useState(() => createGameSession(initial, scenario))[0];
  const [state, setState] = useState(initial);
  const [open, setOpen] = useState(true);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => session.subscribe((result) => setState(result.state)), [session]);
  return <>
    <button ref={trigger} type="button" onClick={() => setOpen(true)}>Review Story</button>
    <StoryDecisionModal session={session} state={state} open={open} onOpenChange={setOpen} returnFocusRef={trigger} />
  </>;
}

describe('StoryDecisionModal', () => {
  it('returns focus after Escape and can reopen the same unresolved choice', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: false, cancelable: true }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Review Story' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Review Story' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
