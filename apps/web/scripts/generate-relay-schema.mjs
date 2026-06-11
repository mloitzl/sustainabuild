import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const coreSchemaSource = path.resolve(__dirname, '../../core-api/src/graphql/schema.ts');
const relaySchemaTarget = path.resolve(__dirname, '../schema.graphql');

const source = fs.readFileSync(coreSchemaSource, 'utf8');
const match = source.match(/export const typeDefs = \/\* GraphQL \*\/ `([\s\S]*?)`;\s*$/m);

if (!match || !match[1]) {
  throw new Error(`Unable to extract GraphQL SDL from ${coreSchemaSource}`);
}

const sdl = `${match[1].trim()}\n`;
fs.writeFileSync(relaySchemaTarget, sdl, 'utf8');

console.log(`[relay:schema] Wrote ${relaySchemaTarget}`);
