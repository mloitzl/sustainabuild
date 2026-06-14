/**
 * @generated SignedSource<<9c94a9bea3b6b39e7466754c01597288>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DashboardShell_query$data = {
  readonly health: {
    readonly ok: boolean;
    readonly version: string;
  };
  readonly " $fragmentSpreads": FragmentRefs<"ClusterOverview_query">;
  readonly " $fragmentType": "DashboardShell_query";
};
export type DashboardShell_query$key = {
  readonly " $data"?: DashboardShell_query$data;
  readonly " $fragmentSpreads": FragmentRefs<"DashboardShell_query">;
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
  "name": "DashboardShell_query",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "Health",
      "kind": "LinkedField",
      "name": "health",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "ok",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "version",
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    {
      "args": [
        {
          "kind": "Variable",
          "name": "first",
          "variableName": "first"
        }
      ],
      "kind": "FragmentSpread",
      "name": "ClusterOverview_query"
    }
  ],
  "type": "Query",
  "abstractKey": null
};

(node as any).hash = "5a132b7e294b254450612d8c677118ff";

export default node;
