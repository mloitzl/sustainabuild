/**
 * @generated SignedSource<<982b4d12059d93c5834b52257a021fb0>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type ClusterStatus = "BOOTING" | "OFFLINE" | "ONLINE" | "PENDING_SHUTDOWN" | "SHUTTING_DOWN" | "%future added value";
import { FragmentRefs } from "relay-runtime";
export type ClusterCard_cluster$data = {
  readonly activeLeaseCount: number;
  readonly currentPowerW: number;
  readonly id: string;
  readonly name: string;
  readonly status: ClusterStatus;
  readonly " $fragmentType": "ClusterCard_cluster";
};
export type ClusterCard_cluster$key = {
  readonly " $data"?: ClusterCard_cluster$data;
  readonly " $fragmentSpreads": FragmentRefs<"ClusterCard_cluster">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "ClusterCard_cluster",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "id",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "name",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "status",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "activeLeaseCount",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "currentPowerW",
      "storageKey": null
    }
  ],
  "type": "Cluster",
  "abstractKey": null
};

(node as any).hash = "092cde7f7d2e79a7dc8fb6bed8596a85";

export default node;
