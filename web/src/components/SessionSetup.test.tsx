import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SessionSetup } from '@/components/SessionSetup';
import { DEFAULT_RUN_SETTINGS } from '@/domain/initialState';
import { createChallengeSetup, decodeChallenge, encodeChallenge } from '@/persistence/challengeCode';
import { sessionScenario } from '@/test/fixtures/session';

describe('SessionSetup challenge controls', () => {
  it('copies the complete selected setup through the local clipboard control', async () => {
    render(<SessionSetup scenario={sessionScenario} canResume={false} onResume={vi.fn()} onStart={vi.fn()} />);
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    await user.click(screen.getByTestId('copy-challenge-setup'));
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    const decoded = decodeChallenge(writeText.mock.calls[0]![0], sessionScenario);
    expect(decoded).toEqual({
      ok: true,
      setup: createChallengeSetup({
        districtId: 'GA-05',
        party: 'democratic',
        values: ['Housing Supply', 'Tenant Stability'],
        seed: 20260905,
        settings: DEFAULT_RUN_SETTINGS,
      }, sessionScenario),
    });
    expect(screen.getByTestId('challenge-notice')).toHaveTextContent(/setup only.*not an authenticated score/i);
  });

  it('starts from every imported setting and leaves the current choice alone on rejection', async () => {
    const onStart = vi.fn();
    render(<SessionSetup scenario={sessionScenario} canResume onResume={vi.fn()} onStart={onStart} />);
    const user = userEvent.setup();
    const imported = createChallengeSetup({
      districtId: 'GA-05',
      party: 'republican',
      values: ['Fair Access', 'Local Control'],
      seed: 4294967295,
      settings: {
        ...DEFAULT_RUN_SETTINGS,
        pace: 'brisk',
        guidance: 'expert',
        termStyle: 'breaking-cycle',
        voteInformation: 'detailed',
        policyComplexity: 'advanced',
        locale: 'es',
        reducedMotion: true,
      },
    }, sessionScenario);
    const input = screen.getByTestId('challenge-code-input');
    fireEvent.change(input, { target: { value: 'paper-majority.challenge.v1:%7Bbad' } });
    await user.click(screen.getByTestId('challenge-start'));
    expect(onStart).not.toHaveBeenCalled();
    expect(screen.getByTestId('challenge-notice')).toHaveTextContent(/could not be read/i);

    fireEvent.change(input, { target: { value: encodeChallenge(imported) } });
    await user.click(screen.getByTestId('challenge-start'));
    expect(onStart).toHaveBeenCalledWith({
      districtId: imported.districtId,
      party: imported.party,
      values: imported.values,
      seed: imported.seed,
      settings: imported.settings,
    });
  });
});
