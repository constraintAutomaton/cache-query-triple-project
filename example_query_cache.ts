import { Algebra, toSparql, translate } from 'sparqlalgebrajs';
import {
  CacheHitFunction,
  getCachedQuads,
  IOptions,
  OutputOption,
  type ICacheQueryInput
} from './lib/index';
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
