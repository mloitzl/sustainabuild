/**
 * @generated SignedSource<<b8f1b3fce9ed1f2dde116f2ca95e29fc>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type ClusterStatus = "BOOTING" | "OFFLINE" | "ONLINE" | "PENDING_SHUTDOWN" | "SHUTTING_DOWN" | "%future added value";
import { FragmentRefs } from "relay-runtime";
export type ClusterListItem_cluster$data = {
  readonly activeLeaseCount: number;
  readonly currentPowerW: number;
  readonly id: string;
  readonly name: string;
  readonly status: ClusterStatus;
  readonly " $fragmentType": "ClusterListItem_cluster";
};
export type ClusterListItem_cluster$key = {
  readonly " $data"?: ClusterListItem_cluster$data;
  readonly " $fragmentSpreads": FragmentRefs<"ClusterListItem_cluster">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "ClusterListItem_cluster",
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

(node as any).hash = "ed37685b426b8ed8f63128a59e8a203d";

export default node;
