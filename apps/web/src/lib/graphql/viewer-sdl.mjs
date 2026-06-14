// Canonical SDL for the BFF-local `viewer`/`User` concern.
//
// This is the single source of truth, imported by BOTH:
//   - scripts/generate-relay-schema.mjs (splices the viewer field into the Core
//     Query block and appends the User type to produce schema.graphql), and
//   - src/lib/graphql/gateway.ts (builds the local subschema from
//     `viewerSubschemaSdl` and stitches it with the delegated Core API schema).
//
// It is a plain .mjs module (no TypeScript) because the relay schema script runs
// under bare `node` with no TS loader. See viewer-sdl.d.mts for the typings the
// strict-mode gateway imports.

// The local User type, appended to the Core SDL for relay-compiler.
export const userTypeSdl = `type User implements Node {
  id: ID!
  username: String!
  providerId: String
  avatarUrl: String
  email: String
}
`;

// The viewer root field. This must be spliced INTO the Core `type Query { ... }`
// block rather than added via `extend type Query`: relay-compiler treats fields
// introduced through `extend` as client-only schema extensions (emitting a
// ClientExtension node with no server query text), which breaks delegation.
export const viewerQueryField = `  viewer: User`;

// Self-contained form: the local subschema is built in isolation before stitching,
// so it must declare its own `Node` interface and a non-extended `Query`. Stitching
// merges this `Query` with the Core `Query` at runtime.
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
