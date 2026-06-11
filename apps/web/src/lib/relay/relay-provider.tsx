'use client';

import { PropsWithChildren, useMemo } from 'react';
import { RelayEnvironmentProvider } from 'react-relay';
import { getRelayEnvironment } from './environment';

export function RelayProvider({ children }: PropsWithChildren) {
  const environment = useMemo(() => getRelayEnvironment(), []);
  return <RelayEnvironmentProvider environment={environment}>{children}</RelayEnvironmentProvider>;
}
