'use client';

import { useEffect } from 'react';
import { usePreloadedQuery } from 'react-relay';
import type { PreloadedQuery } from 'react-relay';
import { viewerQuery } from './ViewerQuery';
import type { ViewerQuery as ViewerQueryType } from './__generated__/ViewerQuery.graphql';

export type ViewerData = ViewerQueryType['response']['viewer'];

type Props = {
  queryRef: PreloadedQuery<ViewerQueryType>;
  /** Stable callback (useCallback) — fired whenever the resolved viewer changes. */
  onResolved: (viewer: ViewerData) => void;
  render: (viewer: ViewerData) => React.ReactNode;
};

/**
 * Reads the BFF `viewer` query under Suspense and reports the resolved identity
 * up (for chrome rendered outside the boundary, e.g. the header badge) while
 * rendering the authenticated-or-signed-out body via the render prop. A null
 * viewer means logged out.
 */
export function ViewerGate({ queryRef, onResolved, render }: Props) {
  const data = usePreloadedQuery<ViewerQueryType>(viewerQuery, queryRef);
  const viewer = data.viewer;

  useEffect(() => {
    onResolved(viewer);
  }, [viewer, onResolved]);

  return <>{render(viewer)}</>;
}
