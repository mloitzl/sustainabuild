// Canonical SDL for the BFF-local `viewer`/`User` concern.
//
// This is the single source of truth, imported by BOTH:
//   - scripts/generate-relay-schema.mjs (concatenates `viewerSdl` onto the
//     extracted Core API SDL to produce schema.graphql for relay-compiler), and
//   - src/lib/graphql/gateway.ts (builds the local subschema from
//     `viewerSubschemaSdl` and stitches it with the delegated Core API schema).
//
// It is a plain .mjs module (no TypeScript) because the relay schema script runs
// under bare `node` with no TS loader. See viewer-sdl.d.mts for the typings the
// strict-mode gateway imports.

// Additive form: merged onto the Core SDL (which already declares `Query` and the
// `Node` interface), so it uses `extend type Query` and reuses Core's `Node`.
export const viewerSdl = `type User implements Node {
  id: ID!
  username: String!
  providerId: String
  avatarUrl: String
  email: String
}

extend type Query {
  viewer: User
}
`;

// Self-contained form: the local subschema is built in isolation before stitching,
// so it must declare its own `Node` interface and a non-extended `Query`.
export const viewerSubschemaSdl = `interface Node {
  id: ID!
}

type User implements Node {
  id: ID!
  username: String!
  providerId: String
  avatarUrl: String
  email: String
}

type Query {
  viewer: User
}
`;
