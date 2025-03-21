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
    const cacheResult = await getRelevantCacheElement({ ...input, cache });

    return { value: cacheResult };
}

async function getRelevantCacheElement(
    { cache, query, targetEndpoint, sources, cacheHitAlgorithms: relevantQueryAlgorithms, outputOption }: Readonly<Omit<ICacheQueryInput, "cache"> & { cache: Cache }>
): Promise<CacheQuads | undefined> {
    const cacheForTarget = cache.get(targetEndpoint);
    if (cacheForTarget === undefined) {
        return undefined;
    }
    let cachedQuadUrl: string | undefined;
    let cacheHitAlgorithmIndex = 0;

    for (const [index, algorithm] of relevantQueryAlgorithms.entries()) {
        const operations: Map<string, Promise<[string, Result<boolean>]>> = new Map();

        for (const [cachedQuery, { resultUrl }] of cacheForTarget) {
            const checkOperation: Promise<[string, Result<boolean>]> = new Promise(async (resolve) => {
                const resp = await algorithm(query, translate(cachedQuery), { sources });
                resolve([resultUrl, resp]);
            });
            operations.set(resultUrl, checkOperation);
        }
        do {
            const [resultUrl, result] = await Promise.race(operations.values());
            if (isResult(result) && result.value) {
                cachedQuadUrl = resultUrl;
            } else {
                operations.delete(resultUrl);
            }
        } while (operations.size > 0 && cachedQuadUrl !== undefined);

        if (cachedQuadUrl !== undefined) {
            cacheHitAlgorithmIndex = index;
            break;
        }
    }
    if (cachedQuadUrl === undefined) {
        return undefined;
    }

    if (outputOption === OutputOption.URL) {
        return {
            cache: cachedQuadUrl,
            algorithmIndex: cacheHitAlgorithmIndex
        }
    } else if (cachedQuadUrl !== undefined) {
        const { data: quadStream } = await rdfDereferencer.dereference(cachedQuadUrl);
        return {
            cache: quadStream,
            algorithmIndex: cacheHitAlgorithmIndex
        };
    }
    return undefined
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