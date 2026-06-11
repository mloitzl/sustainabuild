import { CacheConfig, GraphQLResponse, RequestParameters, Variables } from 'relay-runtime';

type CachedEntry = {
  expiresAt: number;
  payload: GraphQLResponse;
};

const CACHE_TTL_MS = 60 * 1000;
const CACHE_MAX_SIZE = 128;
const responseCache = new Map<string, CachedEntry>();

function createCacheKey(requestKey: string, variables: Variables): string {
  return `${requestKey}:${JSON.stringify(variables)}`;
}

function readFromCache(key: string): GraphQLResponse | null {
  const entry = responseCache.get(key);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    responseCache.delete(key);
    return null;
  }

  return entry.payload;
}

function writeToCache(key: string, payload: GraphQLResponse): void {
  if (responseCache.size >= CACHE_MAX_SIZE) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey) {
      responseCache.delete(oldestKey);
    }
  }

  responseCache.set(key, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    payload,
  });
}

export async function fetchGraphQL(
  params: RequestParameters,
  variables: Variables,
  cacheConfig: CacheConfig,
): Promise<GraphQLResponse> {
  const requestKey = params.id ?? params.cacheID ?? params.name;
  const cacheKey = createCacheKey(requestKey, variables);
  const isMutation = params.operationKind === 'mutation';

  if (!isMutation && cacheConfig.force !== true) {
    const cached = readFromCache(cacheKey);
    if (cached != null) {
      return cached;
    }
  } else if (isMutation) {
    responseCache.clear(); // Invalidate query cache on writes.
  }

  const response = await fetch('/api/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: params.text,
      variables,
    }),
  });

  const json = (await response.json()) as GraphQLResponse;

  if (!isMutation && response.ok) {
    writeToCache(cacheKey, json);
  }

  return json;
}
