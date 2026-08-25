import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library only auto-registers its cleanup when Vitest globals are enabled.
// This project keeps globals off, so unmount between tests explicitly — otherwise
// renders accumulate and every `getByTestId` finds duplicates.
afterEach(cleanup);
