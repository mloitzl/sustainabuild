/**
 * @generated SignedSource<<8a45063f669381c841e5907216ba987c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type ClusterStatus = "BOOTING" | "OFFLINE" | "ONLINE" | "PENDING_SHUTDOWN" | "SHUTTING_DOWN" | "%future added value";
import { FragmentRefs } from "relay-runtime";
export type ClusterOverview_query$data = {
  readonly clusters: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly currentPowerW: number;
        readonly id: string;
        readonly status: ClusterStatus;
        readonly " $fragmentSpreads": FragmentRefs<"ClusterCard_cluster">;
      };
    }>;
  };
  readonly " $fragmentType": "ClusterOverview_query";
};
export type ClusterOverview_query$key = {
  readonly " $data"?: ClusterOverview_query$data;
  readonly " $fragmentSpreads": FragmentRefs<"ClusterOverview_query">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [
    {
      "defaultValue": 20,
      "kind": "LocalArgument",
      "name": "first"
    }
  ],
  "kind": "Fragment",
  "metadata": null,
  "name": "ClusterOverview_query",
  "selections": [
    {
      "alias": null,
      "args": [
        {
          "kind": "Variable",
          "name": "first",
          "variableName": "first"
        }
      ],
      "concreteType": "ClusterConnection",
      "kind": "LinkedField",
      "name": "clusters",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "ClusterEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "Cluster",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
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
                  "name": "status",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "currentPowerW",
                  "storageKey": null
                },
                {
                  "args": null,
                  "kind": "FragmentSpread",
                  "name": "ClusterCard_cluster"
                }
              ],
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Query",
  "abstractKey": null
};

(node as any).hash = "29a8e8c79508bf190a992bbbec306b90";

export default node;
