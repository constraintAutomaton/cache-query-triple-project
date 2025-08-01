import { rdfDereferencer } from 'rdf-dereference';
import { listOfEnpointsToString } from './util';
import * as Vocabulary from './vocabulary';
import type * as RDF from '@rdfjs/types';
import type { SafePromise } from 'result-interface';
import type { Readable } from 'readable-stream';

export type CacheLocation = { url: string } | { path: string };
export type JsonResultLocation = CacheLocation;
/**
 * Parse a remote cache of query into a Javascript object.
 * @param {string} cacheLocation - The URL of the cache RDF resource.
 * @returns {SafePromise<Cache, Error>} - A cache object or an error. The promise is never rejected.
 */
export async function parseCache(cacheLocation: CacheLocation): SafePromise<Cache, Error> {
  let data: RDF.Stream<RDF.Quad> & Readable | undefined;
  if ('url' in cacheLocation) {
    const { data: d } = await rdfDereferencer.dereference(cacheLocation.url);
    data = d
  } else {
    const { data: d } = await rdfDereferencer.dereference(cacheLocation.path, { localFiles: true });
    data = d
  }

  const cacheProcessesing: Map<string, IRawCache> = new Map();
  const rdfLists: Map<string, IRDFList> = new Map();

  return new Promise((resolve) => {
    if (data.closed) {
      resolve({ value: new Map() });
    }

    data.on('data', (quad: RDF.Quad) => {
      collectRawCache(quad, cacheProcessesing, rdfLists);
    });

    data.on('error', (error) => {
      resolve({ error });
    });
    data.on('end', () => {
      const cache = rawCacheToCache(cacheProcessesing, rdfLists);

      resolve({ value: cache });
    });
  });
}

function collectRawCache(
  quad: Readonly<RDF.Quad>,
  cacheProcessesing: Map<string, IRawCache>,
  rdfLists: Map<string, IRDFList>,
) {
  // get the information about the RDF list
  const rdfListElement = rdfLists.get(quad.subject.value);
  if (quad.predicate.equals(Vocabulary.ELEMENT_OF_LIST_PREDICATE)) {
    if (rdfListElement === undefined) {
      rdfLists.set(quad.subject.value, {
        first: quad.object.value,
      });
    } else {
      rdfListElement.first = quad.object.value;
    }
  } else if (quad.predicate.equals(Vocabulary.NEXT_ELEMENT_OF_LIST_PREDICATE)) {
    if (rdfListElement === undefined) {
      rdfLists.set(quad.subject.value, {
        rest: quad.object.value,
      });
    } else {
      rdfListElement.rest = quad.object.value;
    }
  }
  // get the information from the cache
  const entry = cacheProcessesing.get(quad.subject.value);
  if (
    quad.predicate.equals(Vocabulary.RDF_TYPE) &&
    quad.object.equals(Vocabulary.QUERY_CLASS)
  ) {
    if (entry === undefined) {
      cacheProcessesing.set(quad.subject.value, { isACacheEntry: true });
    } else {
      entry.isACacheEntry = true;
    }
  } else if (quad.predicate.equals(Vocabulary.QUERY_PREDICATE)) {
    if (entry === undefined) {
      cacheProcessesing.set(quad.subject.value, {
        isACacheEntry: false,
        query: quad.object.value,
      });
    } else {
      entry.query = quad.object.value;
    }
  } else if (quad.predicate.equals(Vocabulary.RESULT_IRI_PREDICATE)) {
    if (entry === undefined) {
      cacheProcessesing.set(quad.subject.value, {
        isACacheEntry: false,
        results: quad.object.termType === "NamedNode"? {url: quad.object.value}: {path: quad.object.value},
      });
    } else {
      if (quad.object.termType === "NamedNode") {
        entry.results = {url: quad.object.value};
      }else{
        entry.results = {path: quad.object.value};
      }
    }
  } else if (quad.predicate.equals(Vocabulary.ENDPOINT_PREDICATE)) {
    if (entry === undefined) {
      cacheProcessesing.set(quad.subject.value, {
        isACacheEntry: false,
        endpoints: quad.object.value,
      });
    } else {
      entry.endpoints = quad.object.value;
    }
  }
}

function rawCacheToCache(
  rawCache: Map<string, IRawCache>,
  rdfLists: Map<string, IRDFList>,
): Cache {
  const cache: Cache = new Map();
  for (const rawCacheElement of rawCache.values()) {
    if (
      rawCacheElement.isACacheEntry &&
      rawCacheElement.results !== undefined &&
      rawCacheElement.endpoints !== undefined &&
      rawCacheElement.query !== undefined
    ) {
      const endpoints = getEndpointFromAnRdfList(
        rawCacheElement.endpoints,
        rdfLists,
      );
      if (endpoints.length === 0) {
        continue;
      }
      const targetEndpoint = listOfEnpointsToString(endpoints);

      const cacheEntry: ICacheEntry = {
        resultUrl: rawCacheElement.results,
        endpoints,
      };
      const cacheByEndpoint = cache.get(targetEndpoint);
      if (cacheByEndpoint !== undefined) {
        cacheByEndpoint.set(rawCacheElement.query, cacheEntry);
      } else {
        cache.set(
          targetEndpoint,
          new Map([[rawCacheElement.query, cacheEntry]]),
        );
      }
    }
  }
  return cache;
}

function getEndpointFromAnRdfList(
  root: string,
  rdfLists: Map<string, IRDFList>,
): Readonly<string[]> {
  const endpoints: string[] = [];
  let current = root;
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
  } while (current !== Vocabulary.LAST_ELEMENT_LIST.value);
  return endpoints;
}

/**
 * A cache of queries indexed by target endpoint (the endpoint from where the query as been executed) and then by queries.
 */
export type Cache = Map<string, Map<string, Readonly<ICacheEntry>>>;

/**
 * An element in a cache
 */
export interface ICacheEntry {
  /**
   * The URL of the result resource
   */
  resultUrl: JsonResultLocation;
  /**
   * The URL of the endpoints in the federation excluding the target endpoint.
   */
  endpoints: readonly string[];
}

interface IRawCache {
  query?: string;
  endpoints?: string;
  results?: JsonResultLocation;
  isACacheEntry: boolean;
}

interface IRDFList {
  first?: string;
  rest?: string;
}
