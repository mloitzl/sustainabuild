import { print } from 'graphql';
import type { Executor } from '@graphql-tools/utils';

const CORE_API_URL = process.env.CORE_API_URL ?? 'http://localhost:4000/graphql';

/**
 * Builds an Executor that delegates a planned sub-operation to the Core API over
 * HTTP, attaching the supplied short-lived Core-API JWT. Created per request so
 * the JWT is request-scoped; the stitched schema itself is built once.
 */
export function createCoreExecutor(jwt: string): Executor {
  return async ({ document, variables }) => {
    const query = print(document);

    const response = await fetch(CORE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ query, variables }),
    });

    return response.json();
  };
}
