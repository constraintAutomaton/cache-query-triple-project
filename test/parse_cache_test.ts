import { expect, describe, mock, it, beforeEach, Mock} from "bun:test";
import { ArrayIterator, AsyncIterator, fromArray } from "asynciterator";
import type * as RDF from '@rdfjs/types';
import { parseCache, type Cache } from "../lib/parse_cache";
import { listOfEnpointsToString } from "../lib/util";
import * as Vocabulary from '../lib/vocabulary';
import { rdfParser } from "rdf-parse";
import { isError, isResult } from 'result-interface';
import Streamify from 'streamify-string';
import { rdfDereferencer } from "rdf-dereference";

let quadStream: AsyncIterator<RDF.Quad> = fromArray(new Array<RDF.Quad>());

mock.module("rdf-dereference", () => {
    return {
        rdfDereferencer: {
            dereference: mock(() => {
                return { data: quadStream }
            })
        },
    };
});

describe(parseCache.name, () => {
    beforeEach(() => {
        quadStream = fromArray(new Array<RDF.Quad>());
        (<Mock<any>>rdfDereferencer.dereference).mockClear();
        
    });

    it("should return an empty cache given a resource having no triples", async () => {
        const iteratorError = new Error("error");
        quadStream = <any>{
            on: (event: any, func: any) => {
                if (event === "error") {
                    func(iteratorError)
                }
            }
        }
        const result = await parseCache({ path: "foo" });
        expect(isError(result)).toBe(true);
        const error: Error = (<any>result).error;
        expect(error).toStrictEqual(iteratorError);
    });

    it("should return an empty cache given a resource having no triples", async () => {
        const result = await parseCache({ url: "foo" });
        expect(isResult(result)).toBe(true);
        const cache: Cache = (<any>result).value;
        expect(cache.size).toBe(0);
    });

    it("should return an empty cache give a resource having unrelated triples", async () => {
        const string_triples = `
        _:b1 <foo> _:b3 .
        `;
        const triplesStream = rdfParser.parse(Streamify(string_triples), { contentType: 'text/turtle' })
        const triples = await triplesStream.toArray();
        quadStream = new ArrayIterator(triples, { autoStart: false });

        const result = await parseCache({url: "foo"});
        expect(isResult(result)).toBe(true);
        let cache: Cache = (<any>result).value;
        expect(cache.size).toBe(0);
    });

    it("should return an empty cache give a resource having partial caches definition", async () => {
        const string_triples = `
        <foo> a "${Vocabulary.QUERY_CLASS.value}" .
        <foo1> a "${Vocabulary.QUERY_CLASS.value}" ;
            <${Vocabulary.QUERY_PREDICATE.value}> <bar> .
        <foo2> <${Vocabulary.QUERY_PREDICATE.value}> <bar> ;
            <${Vocabulary.RESULT_IRI_PREDICATE.value}> <fooR> ;
            a <${Vocabulary.QUERY_CLASS.value}>.
        <foo3> a <${Vocabulary.QUERY_CLASS.value}> ;
            <${Vocabulary.RESULT_IRI_PREDICATE.value}> <fooR> ;
            <${Vocabulary.ENDPOINT_PREDICATE.value}> ("endpoint1" "endpoint2" "endpoint3").
        `;

        const triplesStream = rdfParser.parse(Streamify(string_triples), { contentType: 'text/turtle' });
        const triples = await triplesStream.toArray();

        quadStream = new ArrayIterator(triples, { autoStart: false });

        const result = await parseCache({path: "foo"});
        expect(isResult(result)).toBe(true);
        let cache: Cache = (<any>result).value;
        expect(cache.size).toBe(0);
    });

    it("should return an empty cache given a resource having a full cache definition but no endpoint", async () => {
        const string_triples = `
        <foo>  <${Vocabulary.QUERY_PREDICATE.value}> <bar> ;
            <${Vocabulary.RESULT_IRI_PREDICATE.value}> <fooR> ;
            <${Vocabulary.ENDPOINT_PREDICATE.value}> <endpoint> ;
            a <${Vocabulary.QUERY_CLASS.value}>.
        `;

        const triplesStream = rdfParser.parse(Streamify(string_triples), { contentType: 'text/turtle' });
        const triples = await triplesStream.toArray();

        quadStream = new ArrayIterator(triples, { autoStart: false });

        const result = await parseCache({url: "foo"});
        expect(isResult(result)).toBe(true);
        let cache: Cache = (<any>result).value;
        expect(cache.size).toBe(0);
    });

    it("should return a cache entry given a resource having a full cache definition", async () => {
        const string_triples = `
        <foo>  <${Vocabulary.QUERY_PREDICATE.value}> <bar> ;
            <${Vocabulary.RESULT_IRI_PREDICATE.value}> "fooR" ;
            <${Vocabulary.ENDPOINT_PREDICATE.value}> ("endpoint1" "endpoint2" "endpoint3") ;
            a <${Vocabulary.QUERY_CLASS.value}> .
        `;

        const triplesStream = rdfParser.parse(Streamify(string_triples), { contentType: 'text/turtle' })
        const triples = await triplesStream.toArray();

        quadStream = new ArrayIterator(triples, { autoStart: false });

        const result = await parseCache({path: "foo"});
        expect(isResult(result)).toBe(true);
        let cache: Cache = (<any>result).value;

        expect(cache.size).toBe(1);
        const entryEndpoint = cache.get(listOfEnpointsToString(["endpoint1", "endpoint2", "endpoint3"]));
        expect(entryEndpoint).toBeDefined();
        expect(entryEndpoint?.size).toBe(1);
        const entryQuery = entryEndpoint?.get("bar");
        expect(entryQuery).toBeDefined();

        expect(new Set(entryQuery?.endpoints)).toStrictEqual(new Set(["endpoint1", "endpoint2", "endpoint3"]));
        expect(entryQuery?.resultUrl).toStrictEqual({path: "fooR"});
    });

    it("should return a cache entry given a resource having a full cache definition with an RDF list with a special order", async () => {
        const string_triples = `
        <foo>  <${Vocabulary.QUERY_PREDICATE.value}> <bar> ;
            <${Vocabulary.RESULT_IRI_PREDICATE.value}> <fooR> ;
            <${Vocabulary.ENDPOINT_PREDICATE.value}> <endpoints> ;
            a <${Vocabulary.QUERY_CLASS.value}>.

        <endpoints> <${Vocabulary.NEXT_ELEMENT_OF_LIST_PREDICATE.value}> <endpointsE2> ;
            <${Vocabulary.ELEMENT_OF_LIST_PREDICATE.value}> <endpoint1> .
        
        <endpointsE2>  <${Vocabulary.ELEMENT_OF_LIST_PREDICATE.value}> <endpoint2> ;
            <${Vocabulary.NEXT_ELEMENT_OF_LIST_PREDICATE.value}> <endpointsE3> .
        
        <endpointsE3> <${Vocabulary.NEXT_ELEMENT_OF_LIST_PREDICATE.value}> <${Vocabulary.LAST_ELEMENT_LIST.value}> ;
                <${Vocabulary.ELEMENT_OF_LIST_PREDICATE.value}> <endpoint3> .
        `;

        const triplesStream = rdfParser.parse(Streamify(string_triples), { contentType: 'text/turtle' })
        const triples = await triplesStream.toArray();

        quadStream = new ArrayIterator(triples, { autoStart: false });

        const result = await parseCache({url:"foo"});
        expect(isResult(result)).toBe(true);
        let cache: Cache = (<any>result).value;

        expect(cache.size).toBe(1);
        const entryEndpoint = cache.get(listOfEnpointsToString(["endpoint1", "endpoint2", "endpoint3"]));
        expect(entryEndpoint).toBeDefined();
        expect(entryEndpoint?.size).toBe(1);
        const entryQuery = entryEndpoint?.get("bar");
        expect(entryQuery).toBeDefined();

        expect(new Set(entryQuery?.endpoints)).toStrictEqual(new Set(["endpoint1", "endpoint2", "endpoint3"]));
        expect(entryQuery?.resultUrl).toStrictEqual({url:"fooR"});
    });

    it("should return multiple cache entries given a resource having a full cache definitions", async () => {

        const string_triples = `
        <foo>  <${Vocabulary.QUERY_PREDICATE.value}> <bar> ;
            <${Vocabulary.RESULT_IRI_PREDICATE.value}> <fooR> ;
            <${Vocabulary.ENDPOINT_PREDICATE.value}> ("endpoint1" "endpoint2" "endpoint3") ;
            a <${Vocabulary.QUERY_CLASS.value}>.
        
        <foo1>  <${Vocabulary.ENDPOINT_PREDICATE.value}> ("endpoint1" "endpoint2" "endpoint3") ;
            <${Vocabulary.RESULT_IRI_PREDICATE.value}> "fooR1" ;
            <${Vocabulary.QUERY_PREDICATE.value}> <bar1> ;
            a <${Vocabulary.QUERY_CLASS.value}>.

        <foo2>  <${Vocabulary.RESULT_IRI_PREDICATE.value}> <fooR2>;
            <${Vocabulary.ENDPOINT_PREDICATE.value}> ("endpoint4" "endpoint5");
            <${Vocabulary.QUERY_PREDICATE.value}> <foo> ;
            a <${Vocabulary.QUERY_CLASS.value}>.
        `;

        const triplesStream = rdfParser.parse(Streamify(string_triples), { contentType: 'text/turtle' })
        const triples = await triplesStream.toArray();

        quadStream = new ArrayIterator(triples, { autoStart: false });

        const result = await parseCache({path: "foo"});
        expect(isResult(result)).toBe(true);
        let cache: Cache = (<any>result).value;

        expect(cache.size).toBe(2);
        const entryEndpoint1 = cache.get(listOfEnpointsToString(["endpoint1", "endpoint2", "endpoint3"]));
        expect(entryEndpoint1).toBeDefined();
        expect(entryEndpoint1?.size).toBe(2);

        const entryQueryBar = entryEndpoint1?.get("bar");
        expect(entryQueryBar).toBeDefined();

        expect(new Set(entryQueryBar?.endpoints)).toStrictEqual(new Set(["endpoint1", "endpoint2", "endpoint3"]));
        expect(entryQueryBar?.resultUrl).toStrictEqual({url:"fooR"});

        const entryQueryBar1 = entryEndpoint1?.get("bar1");
        expect(entryQueryBar1).toBeDefined();

        expect(new Set(entryQueryBar1?.endpoints)).toStrictEqual(new Set(["endpoint1", "endpoint2", "endpoint3"]));
        expect(entryQueryBar1?.resultUrl).toStrictEqual({path:"fooR1"});

        const entryEndpoint4 = cache.get(listOfEnpointsToString(["endpoint4", "endpoint5"]));
        expect(entryEndpoint4).toBeDefined();
        expect(entryEndpoint4?.size).toBe(1);

        const entryQueryFoo = entryEndpoint4?.get("foo");
        expect(entryQueryFoo).toBeDefined();

        expect(new Set(entryQueryFoo?.endpoints)).toStrictEqual(new Set(["endpoint4", "endpoint5"]));
        expect(entryQueryFoo?.resultUrl).toStrictEqual({url:"fooR2"});
    });

    it("should use the custom fetch function given an URL is provided", async ()=>{
        const string_triples = `
        <foo>  <${Vocabulary.QUERY_PREDICATE.value}> <bar> ;
            <${Vocabulary.RESULT_IRI_PREDICATE.value}> "fooR" ;
            <${Vocabulary.ENDPOINT_PREDICATE.value}> ("endpoint1" "endpoint2" "endpoint3") ;
            a <${Vocabulary.QUERY_CLASS.value}> .
        `;

        const triplesStream = rdfParser.parse(Streamify(string_triples), { contentType: 'text/turtle' })
        const triples = await triplesStream.toArray();

        quadStream = new ArrayIterator(triples, { autoStart: false });
        const mockFetch:any = mock();
        
        const result = await parseCache({url: "foo"}, mockFetch);
        expect(isResult(result)).toBe(true);
        let cache: Cache = (<any>result).value;

        expect(cache.size).toBe(1);
        const entryEndpoint = cache.get(listOfEnpointsToString(["endpoint1", "endpoint2", "endpoint3"]));
        expect(entryEndpoint).toBeDefined();
        expect(entryEndpoint?.size).toBe(1);
        const entryQuery = entryEndpoint?.get("bar");
        expect(entryQuery).toBeDefined();

        expect(new Set(entryQuery?.endpoints)).toStrictEqual(new Set(["endpoint1", "endpoint2", "endpoint3"]));
        expect(entryQuery?.resultUrl).toStrictEqual({path: "fooR"});

        expect(rdfDereferencer.dereference).toHaveBeenCalledTimes(1);
        expect(rdfDereferencer.dereference).toHaveBeenLastCalledWith("foo", { fetch: mockFetch });
    });

    it("should not use the custom fetch function given an path is provided", async ()=>{
        const string_triples = `
        <foo>  <${Vocabulary.QUERY_PREDICATE.value}> <bar> ;
            <${Vocabulary.RESULT_IRI_PREDICATE.value}> "fooR" ;
            <${Vocabulary.ENDPOINT_PREDICATE.value}> ("endpoint1" "endpoint2" "endpoint3") ;
            a <${Vocabulary.QUERY_CLASS.value}> .
        `;

        const triplesStream = rdfParser.parse(Streamify(string_triples), { contentType: 'text/turtle' })
        const triples = await triplesStream.toArray();

        quadStream = new ArrayIterator(triples, { autoStart: false });
        const mockFetch:any = mock();
        
        const result = await parseCache({path: "foo"}, mockFetch);
        expect(isResult(result)).toBe(true);
        let cache: Cache = (<any>result).value;

        expect(cache.size).toBe(1);
        const entryEndpoint = cache.get(listOfEnpointsToString(["endpoint1", "endpoint2", "endpoint3"]));
        expect(entryEndpoint).toBeDefined();
        expect(entryEndpoint?.size).toBe(1);
        const entryQuery = entryEndpoint?.get("bar");
        expect(entryQuery).toBeDefined();

        expect(new Set(entryQuery?.endpoints)).toStrictEqual(new Set(["endpoint1", "endpoint2", "endpoint3"]));
        expect(entryQuery?.resultUrl).toStrictEqual({path: "fooR"});

        expect(rdfDereferencer.dereference).toHaveBeenCalledTimes(1);
        expect(rdfDereferencer.dereference).toHaveBeenLastCalledWith("foo", { localFiles: true });
    });
});