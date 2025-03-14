import { Algebra } from 'sparqlalgebrajs';
import { QueryEngine } from '@comunica/query-sparql';
import type { BindingsStream } from '@comunica/types';
import type * as RDF from '@rdfjs/types';
import { isError, type Result } from './util';
import { rdfDereferencer } from "rdf-dereference";
import * as Vocabulary from './vocabulary';

export interface ICacheQueryInput {
    query: Algebra.Operation,
    engine: QueryEngine,
    context: {
        sources: string[],
    },
    cacheUrl: string,
    cachePickingAlgorithm: (q1: Algebra.Operation, q2: Algebra.Operation, options?: Record<string, any>) => Promise<Result<boolean>>
}

export interface IQueryResult {
    bindings: BindingsStream,
    comeFromCache: boolean
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

export interface ICacheElement {
    resultUrl: string,
    targetEndpoint: string,
    endpoints: string[]
}

type Cache = Map<string, ICacheElement>;


export async function queryWithCache(input: ICacheQueryInput): Promise<Result<BindingsStream, string>> {
    const cacheResp = await parseCache(input.cacheUrl);
    if (isError(cacheResp)) {
        return { error: cacheResp.error.message };
    }
    const cache = cacheResp.value;

    for(const entry of cache){

    }

    return { error: "" }
}

export async function parseCache(cacheUrl: string): Promise<Result<Cache, Error>> {
    const { data } = await rdfDereferencer.dereference(cacheUrl);

    const cacheProcessesing: Map<string, IRawCache> = new Map();
    const rdfLists: Map<string, IRDFList> = new Map();

    return new Promise(resolve => {
        data.on('data', (quad: RDF.Quad) => {
            // get the information about the RDF list
            const rdfListElement = rdfLists.get(quad.subject.value);
            if (quad.predicate.equals(Vocabulary.ELEMENT_OF_LIST_PREDICATE)) {
                if (rdfListElement === undefined) {
                    rdfLists.set(quad.subject.value, {
                        first: quad.object.value
                    })
                } else {
                    rdfListElement.first = quad.object.value;
                }
            } else if (quad.predicate.equals(Vocabulary.NEXT_ELEMENT_OF_LIST_PREDICATE)) {
                if (rdfListElement === undefined) {
                    rdfLists.set(quad.subject.value, {
                        rest: quad.object.value
                    })
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
                    })
                } else {
                    entry.query = quad.object.value;
                }
            } else if (quad.predicate.equals(Vocabulary.RESULT_IRI_PREDICATE)) {
                if (entry === undefined) {
                    cacheProcessesing.set(quad.subject.value, {
                        isACacheEntry: false,
                        results: quad.object.value
                    })
                } else {
                    entry.results = quad.object.value;
                }
            } else if (quad.predicate.equals(Vocabulary.ENDPOINT_PREDICATE)) {
                if (entry === undefined) {
                    cacheProcessesing.set(quad.subject.value, {
                        isACacheEntry: false,
                        endpoints: quad.object.value
                    })
                } else {
                    entry.endpoints = quad.object.value;
                }
            }
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

function rawCacheToCache(rawCache: Map<string, IRawCache>, rdfLists: Map<string, IRDFList>): Cache {
    const cache: Cache = new Map();
    for (const rawCacheElement of rawCache.values()) {
        if (rawCacheElement.isACacheEntry &&
            rawCacheElement.results !== undefined &&
            rawCacheElement.endpoints !== undefined &&
            rawCacheElement.query !== undefined) {
            let endpoints = getEndpointFromAnRdfList(rawCacheElement.endpoints, rdfLists);
            endpoints = endpoints.reverse()
            const targetEndpoint = endpoints.pop();
            if (targetEndpoint !== undefined) {
                cache.set(rawCacheElement.query, {
                    resultUrl: rawCacheElement.results,
                    targetEndpoint,
                    endpoints
                })
            }
        }
    }
    return cache;
}

function getEndpointFromAnRdfList(root: string, rdfLists: Map<string, IRDFList>): string[] {
    const endpoints: string[] = [];
    let current = root;
    const maxLenght = 10_000;
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

