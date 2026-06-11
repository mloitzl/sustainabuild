import { Environment, Network, RecordSource, Store } from 'relay-runtime';
import { fetchGraphQL } from './fetch-graphql';

function createEnvironment() {
  return new Environment({
    network: Network.create(fetchGraphQL),
    store: new Store(new RecordSource()),
    isServer: typeof window === 'undefined',
  });
}

let clientEnvironment: Environment | null = null;

export function getRelayEnvironment(): Environment {
  if (typeof window === 'undefined') {
    return createEnvironment();
  }

  if (clientEnvironment === null) {
    clientEnvironment = createEnvironment();
  }

  return clientEnvironment;
}
