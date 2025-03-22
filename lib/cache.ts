import { Algebra, translate } from 'sparqlalgebrajs';
import { isError, isResult, type CacheHitFunction, type Result } from './util';
import { parseCache, type Cache } from './parse_cache';
import type * as RDF from '@rdfjs/types';
import { rdfDereferencer } from "rdf-dereference";

/**
 * Get cached quads if the selected cache hit algorithm hit.
 * @param {Readonly<ICacheQueryInput>} input - input arguments 
 * @returns {Promise<Result<CacheQuads | undefined, string | Error>>} - The cached results if they exist or an error
 */
export async function getCachedQuads(input: Readonly<ICacheQueryInput>): Promise<Result<CacheQuads | undefined, string | Error>> {
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
    const cacheResult = await getRelevantCacheEntry({ ...input, cache });

    return { value: cacheResult };
}

async function getRelevantCacheEntry(
    { cache, query, targetEndpoint, sources, cacheHitAlgorithms, outputOption }: Readonly<Omit<ICacheQueryInput, "cache"> & { cache: Cache }>
): Promise<CacheQuads | undefined> {
    // check if there are cache results with this target endpoint
    const cacheForTarget = cache.get(targetEndpoint);
    if (cacheForTarget === undefined) {
        return undefined;
    }
    const cachedResult: Partial<ICacheResult<string>> = {};

    //  Check the cache with each cache hit algoritm
    for (const [index, algorithm] of cacheHitAlgorithms.entries()) {
        // we will run in concurence the algorithm for each cache entry.
        // TODO add a rate limiter so that if we have too many entries we don't use too much memory
        const operations: Map<string, Promise<[string, Result<boolean>]>> = new Map();

        // for each query in the cache
        for (const [cachedQuery, { resultUrl }] of cacheForTarget) {
            const checkOperation: Promise<[string, Result<boolean>]> = new Promise(async (resolve) => {
                const resp = await algorithm(query, translate(cachedQuery), { sources });
                resolve([resultUrl, resp]);
            });
            operations.set(resultUrl, checkOperation);
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
        return undefined;
    }

    if (outputOption === OutputOption.URL) {
        return cachedResult;

    } else if (cachedResult.cache !== undefined) {
        const { data: quadStream } = await rdfDereferencer.dereference(cachedResult.cache);
        return {
            cache: quadStream,
            algorithmIndex: cachedResult.algorithmIndex
        };
    }
    return undefined
}

function isNotPartialCacheResult(cacheResult: Readonly<Partial<ICacheResult>>): cacheResult is ICacheResult {
    return cacheResult.cache !== undefined && cacheResult.algorithmIndex !== undefined
}

/**
 * Output option for the cache.
 */
export enum OutputOption {
    URL,
    QUAD_STREAM
};

/**
 * Input argument for getting information from a cache.
 */
export interface ICacheQueryInput {
    /**
     * A cache. Can be a cache object or an URL
     */
    cache: Cache | string,
    /**
     * The query that we are trying to retrieve from the cache.
     */
    query: Algebra.Operation,
    targetEndpoint: string,
    sources: string[],

    cacheHitAlgorithms: CacheHitFunction[],

    outputOption: OutputOption
}
/**
 * A cache results
 */
export interface ICacheResult<C = RDF.Stream<RDF.Quad> | string> {
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
export type CacheQuads = ICacheResult<RDF.Stream<RDF.Quad>> | ICacheResult<string>;