import { Suspense } from 'react';

import { GameShellRoute } from '@/components/GameShellRoute';

export default function Page() {
  return (
    <Suspense fallback={<p className="game-canvas__loading">Setting out the desk…</p>}>
      <GameShellRoute />
    </Suspense>
  );
}
