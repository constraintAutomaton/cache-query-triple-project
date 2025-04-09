# sparql-cache-client


![npm version](https://img.shields.io/npm/v/sparql-cache-client)
![Unit Tests Status](https://img.shields.io/github/actions/workflow/status/constraintAutomaton/cache-query-triple-project/ci.yml?label=unit+test
)
![Lint](https://img.shields.io/github/actions/workflow/status/constraintAutomaton/cache-query-triple-project/format.yml?label=linter
)

A TypeScript library for working with remote SPARQL query result caches.

It allows you to:

- Parse and inspect SPARQL query caches
- Define custom cache-hit strategies
- Retrieve cached query results (as URLs or bindings)

## Instalation

```bash
npm i sparql-cache-client
```

## Cache format

The cache is expected to be in an RDF serialization and respect the [vocabulary of the example below](./cache_example.ttl). 

```ttl
<#Nu2rZB> a <http://www.w3.org/2001/sw/DataAccess/tests/test-query#QueryForm>, <http://www.w3.org/2001/sw/DataAccess/tests/test-query#QuerySelect>, <http://www.w3.org/ns/shacl#SPARQLExecutable>;
    <http://www.w3.org/2001/sw/DataAccess/tests/test-query#query> <https://triple.ilabt.imec.be/test/querycache/Nu2rZB.rq>;
    <http://www.w3.org/ns/shacl#select> "SELECT DISTINCT ?p WHERE {\n\t?s ?p ?o .\n}LIMIT 10";
    <http://www.w3.org/2001/sw/DataAccess/tests/test-manifest#result> <https://triple.ilabt.imec.be/test/querycache/Nu2rZB.json>;
    <http://www.w3.org/ns/sparql-service-description#endpoint> <#384404ed-bbc7-4f35-a4e3-efa7c31b518a>;
    <http://purl.org/dc/terms/created> "2025-04-09T11:17:29.434Z"^^<http://www.w3.org/2001/XMLSchema#dateTime>.
<#384404ed-bbc7-4f35-a4e3-efa7c31b518a> <http://www.w3.org/1999/02/22-rdf-syntax-ns#first> <https://sparql.rhea-db.org/sparql/>;
    <http://www.w3.org/1999/02/22-rdf-syntax-ns#rest> <http://www.w3.org/1999/02/22-rdf-syntax-ns#nil>.
<#C7ialK> a <http://www.w3.org/2001/sw/DataAccess/tests/test-query#QueryForm>, <http://www.w3.org/2001/sw/DataAccess/tests/test-query#QuerySelect>, <http://www.w3.org/ns/shacl#SPARQLExecutable>;
    <http://www.w3.org/2001/sw/DataAccess/tests/test-query#query> <https://triple.ilabt.imec.be/test/querycache/C7ialK.rq>;
    <http://www.w3.org/ns/shacl#select> "PREFIX rh: <http://rdf.rhea-db.org/>\nPREFIX taxon: <http://purl.uniprot.org/taxonomy/>\nPREFIX up: <http://purl.uniprot.org/core/>\nSELECT ?uniprot ?mnemo ?rhea ?accession ?equation \nWHERE {\n\tSERVICE <https://sparql.uniprot.org/sparql> {\n\t\tVALUES (?taxid) { (taxon:83333) }\n\t\tGRAPH <http://sparql.uniprot.org/uniprot> {\n\t\t\t?uniprot up:reviewed true .\n\t\t\t?uniprot up:mnemonic ?mnemo .\n\t\t\t?uniprot up:organism ?taxid .\n\t\t\t?uniprot up:annotation/up:catalyticActivity/up:catalyzedReaction ?rhea .\n\t\t}\n\t}\n\t?rhea rh:accession ?accession .\n\t?rhea rh:equation ?equation .\n}";
    <http://www.w3.org/2001/sw/DataAccess/tests/test-manifest#result> <https://triple.ilabt.imec.be/test/querycache/C7ialK.json>;
    <http://www.w3.org/ns/sparql-service-description#endpoint> <#1b7d61ea-d142-4be2-8e9b-b3b7f117b9ae>;
    <http://purl.org/dc/terms/created> "2025-04-09T11:19:23.986Z"^^<http://www.w3.org/2001/XMLSchema#dateTime>;
    <https://purl.expasy.org/sparql-examples/ontology#federatesWith> <https://sparql.uniprot.org/sparql>.
<#1b7d61ea-d142-4be2-8e9b-b3b7f117b9ae> <http://www.w3.org/1999/02/22-rdf-syntax-ns#first> <https://sparql.rhea-db.org/sparql/>;
    <http://www.w3.org/1999/02/22-rdf-syntax-ns#rest> <http://www.w3.org/1999/02/22-rdf-syntax-ns#nil>.
<#qeSzrD> a <http://www.w3.org/2001/sw/DataAccess/tests/test-query#QueryForm>, <http://www.w3.org/2001/sw/DataAccess/tests/test-query#QuerySelect>, <http://www.w3.org/ns/shacl#SPARQLExecutable>;
    <http://www.w3.org/2001/sw/DataAccess/tests/test-query#query> <https://triple.ilabt.imec.be/test/querycache/qeSzrD.rq>;
    <http://www.w3.org/ns/shacl#select> "PREFIX rh: <http://rdf.rhea-db.org/>\nPREFIX taxon: <http://purl.uniprot.org/taxonomy/>\nPREFIX up: <http://purl.uniprot.org/core/>\nSELECT ?uniprot ?mnemo ?rhea ?accession ?equation \nWHERE {\n\t{\n\t\tVALUES (?taxid) { (taxon:83333) }\n\t\tGRAPH <http://sparql.uniprot.org/uniprot> {\n\t\t\t?uniprot up:reviewed true .\n\t\t\t?uniprot up:mnemonic ?mnemo .\n\t\t\t?uniprot up:organism ?taxid .\n\t\t\t?uniprot up:annotation/up:catalyticActivity/up:catalyzedReaction ?rhea .\n\t\t}\n\t}\n\t?rhea rh:accession ?accession .\n\t?rhea rh:equation ?equation .\n}";
    <http://www.w3.org/2001/sw/DataAccess/tests/test-manifest#result> <https://triple.ilabt.imec.be/test/querycache/qeSzrD.json>;
    <http://www.w3.org/ns/sparql-service-description#endpoint> <#25892f49-953b-4742-be4f-c2431ee7f758>;
    <http://purl.org/dc/terms/created> "2025-04-09T11:21:05.649Z"^^<http://www.w3.org/2001/XMLSchema#dateTime>.
<#25892f49-953b-4742-be4f-c2431ee7f758> <http://www.w3.org/1999/02/22-rdf-syntax-ns#first> <https://sparql.rhea-db.org/sparql/>;
    <http://www.w3.org/1999/02/22-rdf-syntax-ns#rest> <#a5c4faeb-3f1a-45bb-b246-ccc93e563a61>.
<#a5c4faeb-3f1a-45bb-b246-ccc93e563a61> <http://www.w3.org/1999/02/22-rdf-syntax-ns#first> <https://sparql.uniprot.org/sparql>;
    <http://www.w3.org/1999/02/22-rdf-syntax-ns#rest> <http://www.w3.org/1999/02/22-rdf-syntax-ns#nil>.
<#385VC2> a <http://www.w3.org/2001/sw/DataAccess/tests/test-query#QueryForm>, <http://www.w3.org/2001/sw/DataAccess/tests/test-query#QuerySelect>, <http://www.w3.org/ns/shacl#SPARQLExecutable>;
    <http://www.w3.org/2001/sw/DataAccess/tests/test-query#query> <https://triple.ilabt.imec.be/test/querycache/385VC2.rq>;
    <http://www.w3.org/ns/shacl#select> "SELECT DISTINCT ?p WHERE {\n\t?s ?p ?o .\n}LIMIT 10";
    <http://www.w3.org/2001/sw/DataAccess/tests/test-manifest#result> <https://triple.ilabt.imec.be/test/querycache/385VC2.json>;
    <http://www.w3.org/ns/sparql-service-description#endpoint> <#79ab3c14-89ac-4bd1-b45b-bff650405ac0>;
    <http://purl.org/dc/terms/created> "2025-04-09T11:24:11.307Z"^^<http://www.w3.org/2001/XMLSchema#dateTime>.
<#79ab3c14-89ac-4bd1-b45b-bff650405ac0> <http://www.w3.org/1999/02/22-rdf-syntax-ns#first> <https://triple.ilabt.imec.be/test/>;
    <http://www.w3.org/1999/02/22-rdf-syntax-ns#rest> <http://www.w3.org/1999/02/22-rdf-syntax-ns#nil>.
```

## Usage

**We rely on the [`result-interface`](https://www.npmjs.com/package/result-interface) and [`sparqlalgebrajs`](https://www.npmjs.com/package/sparqlalgebrajs) libraries in the examples**

Use `parseCache` to load a Cache file:

```ts
import { parseCache } from 'sparql-cache-client';
import { isError } from 'result-interface';

const cacheUrl = "https://triple.ilabt.imec.be/test/querycache/queries.ttl";

// Retrieve and parse the cache
const response = await parseCache(cacheUrl);

// Handle error response if any
if (isError(response)) {
    console.error(`Unable to retrieve cache. Reason: ${response.error}`);
    process.exit(1);
}

// Log the entries in the cache
console.log(`The cache contains ${response.value.size} entries:`);

for (const [endpoint, cachedQueries] of response.value) {
    console.log(`- ${endpoint}`);
    let i = 0;
    for (const cacheInfo of cachedQueries.values()) {
        console.log(`\t[q${i}]: ${JSON.stringify(cacheInfo)}`);
        i++;
    }
}
```
Use `getCachedQuads` to query a cache with a custom cache hit algorithm:

```ts
import { Algebra, toSparql, translate } from 'sparqlalgebrajs';
import {
  CacheHitFunction,
  getCachedQuads,
  IOptions,
  OutputOption,
  type ICacheQueryInput
} from 'sparql-cache-client';
import { isError, SafePromise } from 'result-interface';

const CACHE_URL = 'https://triple.ilabt.imec.be/test/querycache/queries.ttl';

// Query that we looking into the cache
const query = translate(`
  PREFIX rh: <http://rdf.rhea-db.org/>
  PREFIX taxon: <http://purl.uniprot.org/taxonomy/>
  PREFIX up: <http://purl.uniprot.org/core/>
  SELECT ?uniprot ?mnemo ?rhea ?accession ?equation 
  WHERE {
    SERVICE <https://sparql.uniprot.org/sparql> {
      VALUES (?taxid) { (taxon:83333) }
      GRAPH <http://sparql.uniprot.org/uniprot> {
        ?uniprot up:reviewed true .
        ?uniprot up:mnemonic ?mnemo .
        ?uniprot up:organism ?taxid .
        ?uniprot up:annotation/up:catalyticActivity/up:catalyzedReaction ?rhea .
      }
    }
    ?rhea rh:accession ?accession .
    ?rhea rh:equation ?equation .
  }
`);

// Simple cache hit function: checks structural equality via SPARQL string comparison
const simpleCacheHit: CacheHitFunction = async (
  q1: Readonly<Algebra.Operation>,
  q2: Readonly<Algebra.Operation>,
  _options?: IOptions
): SafePromise<boolean> => {
  return {
    value: toSparql(q1) === toSparql(q2)
  };
};

const input: ICacheQueryInput = {
  cache: CACHE_URL,
  query,
  // Only includes non-SERVICE endpoint(s)
  endpoints: ['https://sparql.rhea-db.org/sparql/'],
  cacheHitAlgorithms: [
    {
      algorithm: simpleCacheHit,
      time_limit: 1_000 // 1 second
    }
  ],
  maxConcurentExecCacheHitAlgorithm: undefined,
  // Request the URL of the cached result (instead of full result bindings)
  outputOption: OutputOption.URL
};

const cacheResult = await getCachedQuads(input);

if (isError(cacheResult)) {
  console.error(`Failed to access cache: ${cacheResult.error}`);
  process.exit(1);
}

console.log(`Cache result is available at: ${cacheResult.value?.cache}`);

```


## Testing

```
bun test
```

## Idea

- Make the parsing of cache work with local files
- Give the option to start reading the cache while it is parsing
- Give the option to use web worker to run the cache hit algorithms