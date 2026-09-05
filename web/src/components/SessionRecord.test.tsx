import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SessionRecord } from '@/components/SessionRecord';
import { buildSessionRecord } from '@/domain/sessionRecord';
import { createRun } from '@/domain/runSetup';
import { decodeChallenge } from '@/persistence/challengeCode';
import { sessionScenario, sessionSetup } from '@/test/fixtures/session';

describe('SessionRecord local copy controls', () => {
  const state = createRun({ ...sessionSetup, mode: 'session', settings: { reducedMotion: true } });
  const record = buildSessionRecord(state, sessionScenario);

  it('copies a challenge from the frozen record setup and copies that record as local text', async () => {
    render(<SessionRecord record={record} scenario={sessionScenario} nextExperiments={['Try one recorded gap.']} />);
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    await user.click(screen.getByTestId('session-copy-challenge'));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const decoded = decodeChallenge(writeText.mock.calls[0]![0], sessionScenario);
    expect(decoded).toMatchObject({
      ok: true,
      setup: {
        mode: record.setup.mode,
        rulesVersion: record.setup.rulesVersion,
        snapshotId: record.setup.snapshotId,
        snapshotHash: record.setup.snapshotHash,
        seed: record.setup.seed,
        settings: { reducedMotion: true },
        values: record.setup.values,
      },
    });

    await user.click(screen.getByTestId('session-copy-record'));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
    expect(JSON.parse(writeText.mock.calls[1]![0])).toEqual(record);
    expect(screen.getByTestId('session-next-experiments')).toHaveTextContent('Try one recorded gap.');
    expect(screen.getByText(/neither is proof of an authenticated score/i)).toBeInTheDocument();
  });
});
