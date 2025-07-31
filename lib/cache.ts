import { type Algebra, translate } from 'sparqlalgebrajs';
import {
  listOfEnpointsToString,
  RDF_FACTORY,
  type CacheHitFunction,
} from './util';
import { parseCache, type Cache, type CacheLocation } from './parse_cache';
import { SparqlJsonParser, type IBindings } from 'sparqljson-parse';
import * as pLimit from 'p-limit';
import {
  createSafePromise,
  isError,
  isResult,
  type Result,
  type SafePromise,
} from 'result-interface';

const SPARQL_JSON_PARSER = new SparqlJsonParser({
  dataFactory: RDF_FACTORY,
  prefixVariableQuestionMark: false,
});

export async function getCachedQuads(
  input: Readonly<ICacheQueryInputBinding>,
): SafePromise<ICacheResult<IBindings[]> | undefined, Error>;

export async function getCachedQuads(
  input: Readonly<ICacheQueryInputUrl>,
): SafePromise<ICacheResult<string> | undefined, Error>;

export async function getCachedQuads(
  input: Readonly<ICacheQueryInput>,
): SafePromise<ICacheResult<string> | undefined, Error>;

/**
 * Get cached quads if the selected cache hit algorithm hit.
 * @param {Readonly<ICacheQueryInput>} input - input arguments
 * @returns {SafePromise<CacheResult | undefined, string | Error>} - The cached results if they exist or an error
 */
export async function getCachedQuads(
  input: Readonly<ICacheQueryInput>,
): SafePromise<CacheResult | undefined, Error> {
  let cache: Cache | undefined;
  if ('path' in input.cache || 'url' in input.cache) {
    const cacheResp = await parseCache(input.cache);
    if (isError(cacheResp)) {
      return { error: cacheResp.error };
    }
    cache = cacheResp.value;
  } else {
    cache = input.cache;
  }
  const cacheResultOrError = await getRelevantCacheEntry({ ...input, cache });
  return cacheResultOrError;
}

async function getRelevantCacheEntry({
  cache,
  query,
  endpoints,
  cacheHitAlgorithms,
  outputOption,
  maxConcurentExecCacheHitAlgorithm,
}: Readonly<Omit<ICacheQueryInput, 'cache'> & { cache: Cache }>): SafePromise<
  CacheResult | undefined,
  Error
> {
  // check if there are cache results with this target endpoint
  // if no targetEndpoint is defined then it is a federated queries over mutiple sources with no Service clause
  // then we need to evaluate the whole cache
  const cacheForTarget = cache.get(listOfEnpointsToString(endpoints));

  if (cacheForTarget === undefined) {
    return { value: undefined };
  }
  const cachedResult: Partial<ICacheResult<string>> = {};
  const limitPromises = pLimit.default(
    maxConcurentExecCacheHitAlgorithm || Number.MAX_SAFE_INTEGER,
  );

  //  Check the cache with each cache hit algoritm
  for (const [
    index,
    { algorithm, time_limit },
  ] of cacheHitAlgorithms.entries()) {
    // we will run in concurence the algorithm for each cache entry.
    const operations: Map<
      string,
      Promise<[string, Result<boolean>]>
    > = new Map();

    // for each query in the cache
    for (const [cachedQuery, { resultUrl, endpoints }] of cacheForTarget) {
      // we skip the algorithm if the source are not equal in the cache if it is a federated query with no service clauses

      const checkOperation: Promise<[string, Result<boolean>]> = new Promise(
        async (resolve) => {
          let timer: Timer | undefined;
          if (time_limit) {
            timer = setTimeout(() => {
              resolve([resultUrl, { value: false }]);
            }, time_limit);
          }

          const resp = await algorithm(query, translate(cachedQuery), {
            sources: endpoints,
          });
          clearTimeout(timer);

          resolve([resultUrl, resp]);
        },
      );
      operations.set(
        resultUrl,
        limitPromises(() => checkOperation),
      );
    }
    // exit when one of the entries has hit the cache
    do {
      const [resultUrl, result] = await Promise.race(operations.values());
      if (isResult(result) && result.value) {
        cachedResult.cache = resultUrl;
        cachedResult.algorithmIndex = index;
      } else {
        operations.delete(resultUrl);
      }
    } while (operations.size > 0 && cachedResult.algorithmIndex === undefined);

    if (cachedResult.cache !== undefined) {
      break;
    }
  }

  if (!isNotPartialCacheResult(cachedResult)) {
    return { value: undefined };
  }

  if (outputOption === OutputOption.URL) {
    return { value: cachedResult };
  }

  const bindingsOrError = await fetchJsonSPARQL(cachedResult.cache);
  if (isError(bindingsOrError)) {
    return bindingsOrError;
  }

  return {
    value: {
      cache: bindingsOrError.value,
      algorithmIndex: cachedResult.algorithmIndex,
    },
  };
}

async function fetchJsonSPARQL(url: string): SafePromise<IBindings[], Error> {
  const resp = await createSafePromise(fetch(url));
  if (isError(resp)) {
    // should return errors
    return {
      error: <Error>resp.error,
    };
  }
  const respJson = await createSafePromise(resp.value.json());
  if (isError(respJson)) {
    // should return errors
    return {
      error: <Error>respJson.error,
    };
  }
  return { value: SPARQL_JSON_PARSER.parseJsonResults(respJson.value) };
}

function isNotPartialCacheResult<C extends string | IBindings[]>(
  cacheResult: Readonly<Partial<ICacheResult<C>>>,
): cacheResult is ICacheResult<C> {
  return (
    cacheResult.cache !== undefined && cacheResult.algorithmIndex !== undefined
  );
}

/**
 * Output option for the cache.
 */
export enum OutputOption {
  URL,
  BINDING_BAG,
}

export interface ICacheQueryInputBinding extends ICacheQueryInput {
  outputOption: OutputOption.BINDING_BAG
}

export interface ICacheQueryInputUrl extends ICacheQueryInput {
  outputOption: OutputOption.URL
}
/**
 * Input argument for getting information from a cache.
 */
export interface ICacheQueryInput {
  /**
   * A cache. Can be a cache object or an URL
   */
  cache: Cache | CacheLocation;
  /**
   * The query that we are trying to retrieve from the cache.
   */
  query: Readonly<Algebra.Operation>;
  /**
   * Sources of the query not specified in SERVICE clauses.
   */
  endpoints: readonly string[];
  /**
   * An array of cache hit algorithms with associated time limits (in milliseconds).
   * If the timeout is exceeded, the cache hit function is considered to return false.
   */
  cacheHitAlgorithms: readonly {
    algorithm: CacheHitFunction;
    time_limit?: number;
  }[];
  /**
   * Maximum number of concurent execution of the cache hit algorithms.
   * If set to undefined then an unlimited number of execution can be launch.
   */
  maxConcurentExecCacheHitAlgorithm?: number;
  /**
   * The output format of the cache if it hit.
   */
  outputOption: OutputOption;
}
/**
 * A cache results
 */
export interface ICacheResult<C extends string | IBindings[]> {
  /**
   * A cache results
   */
  cache: C;
  /**
   * Index of the algorithm used to get cache result
   */
  algorithmIndex: number;
}
/**
 * Cached quad
 */
export type CacheResult = ICacheResult<IBindings[]> | ICacheResult<string>;
