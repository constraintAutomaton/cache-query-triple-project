import { rdfDereferencer } from "rdf-dereference";
import type { Result } from "./util";
import * as Vocabulary from './vocabulary';
import type * as RDF from '@rdfjs/types';

/**
 * Parse a remote cache of query into a Javascript object.
 * @param {Readonly<string>} cacheUrl - The URL of the cache RDF resource.
 * @returns {Promise<Result<Cache, Error>>} - A cache object or an error. The promise is never rejected.
 */
export async function parseCache(cacheUrl: Readonly<string>): Promise<Result<Cache, Error>> {
    const { data } = await rdfDereferencer.dereference(cacheUrl);

    const cacheProcessesing: Map<string, IRawCache> = new Map();
    const rdfLists: Map<string, IRDFList> = new Map();

    return new Promise(resolve => {
        if(data.closed){
            resolve({ value: new Map() });
        }

        data.on('data', (quad: RDF.Quad) => {
            collectRawCache(quad, cacheProcessesing, rdfLists);
        });

        data.on("error", (error) => {
            resolve({ error })
        });
        data.on("end", () => {
            const cache = rawCacheToCache(cacheProcessesing, rdfLists);

            resolve({ value: cache })
        })
    });
}

function collectRawCache(quad: Readonly<RDF.Quad>, cacheProcessesing: Readonly<Map<string, IRawCache>>, rdfLists: Readonly<Map<string, IRDFList>>) {
    // get the information about the RDF list
    const rdfListElement = rdfLists.get(quad.subject.value);
    if (quad.predicate.equals(Vocabulary.ELEMENT_OF_LIST_PREDICATE)) {
        if (rdfListElement === undefined) {
            rdfLists.set(quad.subject.value, {
                first: quad.object.value
            });
        } else {
            rdfListElement.first = quad.object.value;
        }
    } else if (quad.predicate.equals(Vocabulary.NEXT_ELEMENT_OF_LIST_PREDICATE)) {
        if (rdfListElement === undefined) {
            rdfLists.set(quad.subject.value, {
                rest: quad.object.value
            });
        } else {
            rdfListElement.rest = quad.object.value;
        }
    }
    // get the information from the cache
    const entry = cacheProcessesing.get(quad.subject.value);
    if (quad.predicate.equals(Vocabulary.RDF_TYPE) && quad.object.equals(Vocabulary.QUERY_CLASS)) {
        if (entry === undefined) {
            cacheProcessesing.set(quad.subject.value, { isACacheEntry: true });
        } else {
            entry.isACacheEntry = true;
        }
    } else if (quad.predicate.equals(Vocabulary.QUERY_IRI_PREDICATE)) {
        if (entry === undefined) {
            cacheProcessesing.set(quad.subject.value, {
                isACacheEntry: false,
                query: quad.object.value
            });
        } else {
            entry.query = quad.object.value;
        }
    } else if (quad.predicate.equals(Vocabulary.RESULT_IRI_PREDICATE)) {
        if (entry === undefined) {
            cacheProcessesing.set(quad.subject.value, {
                isACacheEntry: false,
                results: quad.object.value
            });
        } else {
            entry.results = quad.object.value;
        }
    } else if (quad.predicate.equals(Vocabulary.ENDPOINT_PREDICATE)) {
        if (entry === undefined) {
            cacheProcessesing.set(quad.subject.value, {
                isACacheEntry: false,
                endpoints: quad.object.value
            });
        } else {
            entry.endpoints = quad.object.value;
        }
    }
}

function rawCacheToCache(rawCache: Readonly<Map<string, IRawCache>>, rdfLists: Readonly<Map<string, IRDFList>>): Cache {
    const cache: Cache = new Map();
    for (const rawCacheElement of rawCache.values()) {
        if (rawCacheElement.isACacheEntry &&
            rawCacheElement.results !== undefined &&
            rawCacheElement.endpoints !== undefined &&
            rawCacheElement.query !== undefined) {
            let endpoints = getEndpointFromAnRdfList(rawCacheElement.endpoints, rdfLists);
            endpoints = endpoints.reverse()
            const targetEndpoint = endpoints.pop();
            const cacheEntry: ICacheElement = {
                resultUrl: rawCacheElement.results,
                endpoints
            };
            if (targetEndpoint !== undefined) {
                const cacheByEndpoint = cache.get(targetEndpoint);
                if (cacheByEndpoint !== undefined) {

                    cacheByEndpoint.set(rawCacheElement.query, cacheEntry);
                } else {
                    cache.set(targetEndpoint, new Map([[rawCacheElement.query, cacheEntry]]))
                }
            }
        }
    }
    return cache;
}

function getEndpointFromAnRdfList(root: Readonly<string>, rdfLists: Readonly<Map<string, IRDFList>>): string[] {
    const endpoints: string[] = [];
    let current = root;
    const maxLenght = 100_000;
    let i = 0;
    do {
        const listElement = rdfLists.get(current);
        if (listElement === undefined) {
            break;
        }
        const { first, rest } = listElement;
        if (first !== undefined) {
            endpoints.push(first);
        }
        if (rest === undefined) {
            break;
        }
        current = rest;
        i += 1;
    } while (current !== Vocabulary.LAST_ELEMENT_LIST.value || i < maxLenght);
    return endpoints;
}

/**
 * A cache of queries indexed by target endpoint (the endpoint from where the query as been executed) and then by queries.
 */
export type Cache = Map<string, Map<string, ICacheElement>>;

/**
 * An element in a cache
 */
export interface ICacheElement {
    /**
     * The URL of the result resource
     */
    resultUrl: string,
    /**
     * The URL of the endpoints in the federation excluding the target endpoint.
     */
    endpoints: string[]
}

interface IRawCache {
    query?: string,
    endpoints?: string,
    results?: string,
    isACacheEntry: boolean
}

interface IRDFList {
    first?: string,
    rest?: string
}

