import { buildSchema, GraphQLError } from 'graphql';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { stitchSchemas } from '@graphql-tools/stitch';
import type { Executor } from '@graphql-tools/utils';
import type { GraphQLSchema } from 'graphql';
import { coreSdl } from './core-sdl.generated';
import { createCoreExecutor } from './core-executor';
import { viewerResolvers, type ViewerContext } from './viewer-resolvers';
import { viewerSubschemaSdl } from './viewer-sdl.mjs';

let stitchedSchema: GraphQLSchema | null = null;

/**
 * Builds the BFF's stitched schema ONCE per server instance:
 *  - the local subschema resolves `viewer` from the iron-session user, and
 *  - the Core API subschema is built from the generated SDL (no boot-time
 *    introspection) and delegates over HTTP, attaching the request-scoped JWT
 *    carried on ViewerContext.coreJwt.
 *
 * The JWT is minted per request (see the route's context factory); only the
 * schema is memoized.
 */
export function getStitchedSchema(): GraphQLSchema {
  if (stitchedSchema) {
    return stitchedSchema;
  }

  const localSubschema = {
    schema: makeExecutableSchema({
      typeDefs: viewerSubschemaSdl as string,
      resolvers: viewerResolvers,
    }),
  };

  const coreExecutor: Executor = (request) => {
    const jwt = (request.context as ViewerContext | undefined)?.coreJwt;
    if (!jwt) {
      return { errors: [new GraphQLError('Unauthorized')] };
    }
    return createCoreExecutor(jwt)(request);
  };

  const coreSubschema = {
    schema: buildSchema(coreSdl),
    executor: coreExecutor,
  };

  stitchedSchema = stitchSchemas({
    subschemas: [localSubschema, coreSubschema],
  });

  return stitchedSchema;
}
