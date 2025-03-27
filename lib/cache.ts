import { type Algebra, translate } from 'sparqlalgebrajs';
import { isError, isResult, RDF_FACTORY, type CacheHitFunction, type Result } from './util';
import { parseCache, type Cache } from './parse_cache';
import { SparqlJsonParser, type IBindings } from "sparqljson-parse";
import * as pLimit from 'p-limit';

const SPARQL_JSON_PARSER = new SparqlJsonParser({
    dataFactory: RDF_FACTORY,
    prefixVariableQuestionMark: false,
});

/**
 * Get cached quads if the selected cache hit algorithm hit.
 * @param {Readonly<ICacheQueryInput>} input - input arguments 
 * @returns {Promise<Result<CacheResult | undefined, string | Error>>} - The cached results if they exist or an error
 */
export async function getCachedQuads(input: Readonly<ICacheQueryInput>): Promise<Result<CacheResult | undefined, string | Error>> {
    let cache: Cache | undefined;
    if (typeof input.cache === "string") {
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

async function getRelevantCacheEntry(
    { cache, query, targetEndpoint, sources, cacheHitAlgorithms, outputOption, maxConcurentExecCacheHitAlgorithm }: Readonly<Omit<ICacheQueryInput, "cache"> & { cache: Cache }>
): Promise<Result<CacheResult | undefined, Error>> {
    // check if there are cache results with this target endpoint
    const cacheForTarget = cache.get(targetEndpoint);
    if (cacheForTarget === undefined) {
        return { value: undefined };
    }
    const cachedResult: Partial<ICacheResult<string>> = {};
    const limitPromises = pLimit.default(maxConcurentExecCacheHitAlgorithm || Number.MAX_SAFE_INTEGER);

    //  Check the cache with each cache hit algoritm
    for (const [index, { algorithm, time_limit }] of cacheHitAlgorithms.entries()) {
        // we will run in concurence the algorithm for each cache entry.
        // TODO add a rate limiter so that if we have too many entries we don't use too much memory
        const operations: Map<string, Promise<[string, Result<boolean>]>> = new Map();

        // for each query in the cache
        for (const [cachedQuery, { resultUrl }] of cacheForTarget) {
            const checkOperation: Promise<[string, Result<boolean>]> = new Promise(async (resolve) => {
                let timer: Timer | undefined;
                if (time_limit) {
                    timer = setTimeout(() => {
                        resolve([resultUrl, { value: false }]);
                    }, time_limit);
                }

                const resp = await algorithm(query, translate(cachedQuery), { sources });
                clearTimeout(timer);

                resolve([resultUrl, resp]);
            });
            operations.set(resultUrl, limitPromises(() => checkOperation));
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
        } while (operations.size > 0 && cachedResult.cache !== undefined);

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
            algorithmIndex: cachedResult.algorithmIndex
        }
    };

}

async function fetchJsonSPARQL(url: string): Promise<Result<IBindings[], Error>> {
    return new Promise(resolve => {
        fetch(url)
            .then(data => data.json())
            .then(json => {
                try {
                    resolve({ value: SPARQL_JSON_PARSER.parseJsonResults(json) });
                } catch (error: unknown) {
                    if (error instanceof Error) {
                        resolve({ error });
                    } else {
                        resolve({ error: new Error(`there was an error of unknown type ${error}`) });
                    }
                }
            })
            .catch((error) => resolve({ error }));
    });
}

function isNotPartialCacheResult<C extends string | IBindings[]>(cacheResult: Readonly<Partial<ICacheResult<C>>>): cacheResult is ICacheResult<C> {
    return cacheResult.cache !== undefined && cacheResult.algorithmIndex !== undefined
}

/**
 * Output option for the cache.
 */
export enum OutputOption {
    URL,
    Bindings_BAG
};

/**
 * Input argument for getting information from a cache.
 */
export interface ICacheQueryInput {
    /**
     * A cache. Can be a cache object or an URL
     */
    cache: Readonly<Cache> | string,
    /**
     * The query that we are trying to retrieve from the cache.
     */
    query: Algebra.Operation,
    targetEndpoint: string,
    sources: string[],
    /**
    * An array of cache hit algorithms with associated time limits (in milliseconds).
    * If the timeout is exceeded, the cache hit function is considered to return false.
    */
    cacheHitAlgorithms: { algorithm: CacheHitFunction, time_limit?: number }[],
    maxConcurentExecCacheHitAlgorithm?: number,

    outputOption: OutputOption
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
