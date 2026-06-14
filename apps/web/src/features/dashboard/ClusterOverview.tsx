'use client';

import { graphql, useFragment } from 'react-relay';
import { ClusterCard } from './ClusterCard';
import type { ClusterOverview_query$key } from './__generated__/ClusterOverview_query.graphql';

type Props = {
  query: ClusterOverview_query$key;
};

export function ClusterOverview({ query }: Props) {
  const data = useFragment(
    graphql`
      fragment ClusterOverview_query on Query
      @argumentDefinitions(first: { type: "Int", defaultValue: 20 }) {
        clusters(first: $first) {
          edges {
            node {
              id
              status
              currentPowerW
              ...ClusterCard_cluster
            }
          }
        }
      }
    `,
    query,
  );

  const clusters =
    data.clusters.edges
      ?.map((edge) => edge?.node)
      .filter((node): node is NonNullable<typeof node> => node != null) ?? [];

  const onlineCount = clusters.filter((cluster) => cluster.status === 'ONLINE').length;
  const totalPowerW = clusters.reduce((sum, cluster) => sum + cluster.currentPowerW, 0);

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Clusters</p>
        <div className="flex flex-wrap gap-2 text-xs text-gray-300">
          <span className="rounded border border-gray-800 bg-gray-900/60 px-2 py-0.5">
            Total: {clusters.length}
          </span>
          <span className="rounded border border-green-800 bg-green-950/30 px-2 py-0.5 text-green-300">
            Online: {onlineCount}
          </span>
          <span className="rounded border border-blue-800 bg-blue-950/30 px-2 py-0.5 text-blue-200">
            Total power: {totalPowerW} W
          </span>
        </div>
      </div>

      {clusters.length === 0 ? (
        <p className="mt-3 text-sm text-gray-400">
          No clusters yet. Create one via mutations to populate this view.
        </p>
      ) : (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {clusters.map((cluster) => (
            <ClusterCard key={cluster.id} cluster={cluster} />
          ))}
        </ul>
      )}
    </div>
  );
}
