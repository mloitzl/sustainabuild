'use client';

import { graphql, usePreloadedQuery } from 'react-relay';
import type { PreloadedQuery } from 'react-relay';
import { DashboardShell } from './DashboardShell';
import type { DashboardRouteEntryQuery as DashboardRouteEntryQueryType } from './__generated__/DashboardRouteEntryQuery.graphql';

export const dashboardRouteQuery = graphql`
  query DashboardRouteEntryQuery($first: Int) {
    ...DashboardShell_query @arguments(first: $first)
  }
`;

type Props = {
  queryRef: PreloadedQuery<DashboardRouteEntryQueryType>;
  username: string;
};

export function DashboardRouteEntry({ queryRef, username }: Props) {
  const data = usePreloadedQuery<DashboardRouteEntryQueryType>(dashboardRouteQuery, queryRef);
  return <DashboardShell query={data} username={username} />;
}
