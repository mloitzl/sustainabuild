'use client';

import { graphql, useFragment } from 'react-relay';
import type { ClusterCard_cluster$key } from './__generated__/ClusterCard_cluster.graphql';

type Props = {
  cluster: ClusterCard_cluster$key;
};

const STATUS_STYLES: Record<string, string> = {
  ONLINE: 'border-green-700 bg-green-950/40 text-green-300',
  BOOTING: 'border-amber-700 bg-amber-950/40 text-amber-200',
  PENDING_SHUTDOWN: 'border-orange-700 bg-orange-950/40 text-orange-200',
  SHUTTING_DOWN: 'border-orange-700 bg-orange-950/40 text-orange-200',
  OFFLINE: 'border-gray-700 bg-gray-900 text-gray-300',
};

export function ClusterCard({ cluster }: Props) {
  const data = useFragment(
    graphql`
      fragment ClusterCard_cluster on Cluster {
        id
        name
        status
        activeLeaseCount
        currentPowerW
      }
    `,
    cluster,
  );

  const statusClass = STATUS_STYLES[data.status] ?? STATUS_STYLES.OFFLINE;

  return (
    <li className="rounded-lg border border-gray-700 bg-gray-950/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-100">{data.name}</p>
          <p className="truncate text-xs text-gray-500">{data.id}</p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClass}`}
        >
          {data.status}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded border border-gray-800 bg-gray-900/60 px-3 py-2">
          <dt className="uppercase tracking-wide text-gray-500">Active leases</dt>
          <dd className="mt-0.5 text-sm font-semibold text-gray-100">
            Leases: {data.activeLeaseCount}
          </dd>
        </div>
        <div className="rounded border border-gray-800 bg-gray-900/60 px-3 py-2">
          <dt className="uppercase tracking-wide text-gray-500">Power snapshot</dt>
          <dd className="mt-0.5 text-sm font-semibold text-gray-100">
            Power: {data.currentPowerW} W
          </dd>
        </div>
      </dl>
    </li>
  );
}
