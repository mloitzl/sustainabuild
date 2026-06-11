'use client';

import { graphql, useFragment } from 'react-relay';
import type { ClusterListItem_cluster$key } from './__generated__/ClusterListItem_cluster.graphql';

type Props = {
  cluster: ClusterListItem_cluster$key;
};

export function ClusterListItem({ cluster }: Props) {
  const data = useFragment(
    graphql`
      fragment ClusterListItem_cluster on Cluster {
        id
        name
        status
        activeLeaseCount
        currentPowerW
      }
    `,
    cluster,
  );

  return (
    <li className="rounded border border-gray-700 bg-gray-950/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-100">{data.name}</p>
          <p className="text-xs text-gray-400">{data.id}</p>
        </div>
        <span className="rounded border border-gray-700 bg-gray-900 px-2 py-0.5 text-xs text-gray-200">
          {data.status}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-300">
        <span>Leases: {data.activeLeaseCount}</span>
        <span>Power: {data.currentPowerW} W</span>
      </div>
    </li>
  );
}
