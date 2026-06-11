/**
 * @generated SignedSource<<dcf93c6e11b26bdf324e2463b254775a>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DashboardRouteEntryQuery$variables = {
  first?: number | null | undefined;
};
export type DashboardRouteEntryQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"DashboardShell_query">;
};
export type DashboardRouteEntryQuery = {
  response: DashboardRouteEntryQuery$data;
  variables: DashboardRouteEntryQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "first"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "first",
    "variableName": "first"
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "DashboardRouteEntryQuery",
    "selections": [
      {
        "args": (v1/*: any*/),
        "kind": "FragmentSpread",
        "name": "DashboardShell_query"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "DashboardRouteEntryQuery",
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
        "alias": null,
        "args": (v1/*: any*/),
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
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "5b4cbf7e79ce8a39bb2fcc082f9a9efd",
    "id": null,
    "metadata": {},
    "name": "DashboardRouteEntryQuery",
    "operationKind": "query",
    "text": "query DashboardRouteEntryQuery(\n  $first: Int\n) {\n  ...DashboardShell_query_3ASum4\n}\n\nfragment ClusterListItem_cluster on Cluster {\n  id\n  name\n  status\n  activeLeaseCount\n  currentPowerW\n}\n\nfragment DashboardShell_query_3ASum4 on Query {\n  health {\n    ok\n    version\n  }\n  clusters(first: $first) {\n    edges {\n      node {\n        id\n        ...ClusterListItem_cluster\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "38a1a027b55d78250dc07d75e0be542d";

export default node;
