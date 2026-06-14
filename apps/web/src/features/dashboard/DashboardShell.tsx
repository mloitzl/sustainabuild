'use client';

import { graphql, useFragment } from 'react-relay';
import { ClusterOverview } from './ClusterOverview';
import type { DashboardShell_query$key } from './__generated__/DashboardShell_query.graphql';

type Props = {
  query: DashboardShell_query$key;
  username: string;
};

export function DashboardShell({ query, username }: Props) {
  const data = useFragment(
    graphql`
      fragment DashboardShell_query on Query
      @argumentDefinitions(first: { type: "Int", defaultValue: 20 }) {
        health {
          ok
          version
        }
        ...ClusterOverview_query @arguments(first: $first)
      }
    `,
    query,
  );

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-6">
      <h2 className="text-lg font-semibold text-gray-100">Dashboard</h2>
      <p className="mt-1 text-sm text-gray-400">
        Signed in as <span className="font-medium text-gray-200">{username}</span>
      </p>

      <div className="mt-4 rounded border border-gray-800 bg-gray-950/60 p-3 text-xs text-gray-300">
        Core API health: {data.health.ok ? 'OK' : 'NOT OK'} · version {data.health.version}
      </div>

      <div className="mt-4">
        <ClusterOverview query={data} />
      </div>
    </div>
  );
}
