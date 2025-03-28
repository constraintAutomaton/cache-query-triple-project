import { expect, describe, mock, it, beforeEach, spyOn } from "bun:test";
import { getCachedQuads, OutputOption, type CacheResult, type ICacheQueryInput } from "../lib/cache";
import type { ICacheEntry, Cache } from "../lib/parse_cache";
import { translate } from 'sparqlalgebrajs';
import { isResult, listOfEnpointsToString, type IOptions } from "../lib/util";


describe(getCachedQuads.name, () => {
    const A_QUERY = translate("SELECT * WHERE {?s ?p ?o.}");
    const A_CACHE_QUERY = "SELECT * WHERE {?s1 ?p1 ?o1.}";
    const ANOTHER_CACHE_QUERY = "SELECT * WHERE {?s2 ?p2 ?o2.}";

    const endpoint1Entry: Map<string, ICacheEntry> = new Map([
        [A_CACHE_QUERY, { resultUrl: "R0", endpoints: ["endpoint"] }],
        [ANOTHER_CACHE_QUERY, { resultUrl: "R1", endpoints: ["endpoint"] }],
    ]);

    const endpoint2Entry: Map<string, ICacheEntry> = new Map([
        [A_CACHE_QUERY, { resultUrl: "R0", endpoints: ["endpoint2"] }],
        [ANOTHER_CACHE_QUERY, { resultUrl: "R1", endpoints: ["endpoint2"] }],
    ]);

    const A_CACHE: Cache = new Map([
        ["endpoint", endpoint1Entry],
        ["endpoint2", endpoint2Entry]
    ]);

    describe("return no cached data", () => {
        it("should return no cache data given no cache hit algorithm provided", async () => {
            const endpoints = ["endpoint"];

            const input: ICacheQueryInput = {
                cache: A_CACHE,
                query: A_QUERY,
                endpoints,
                cacheHitAlgorithms: [],
                outputOption: OutputOption.URL
            };

            const resultOrError = await getCachedQuads(input);

            expect(isResult(resultOrError)).toBe(true);
            const result: { value: CacheResult } = <{ value: CacheResult }>resultOrError;
            expect(result.value).toBeUndefined();
        });

        it("should return no cache data given a cache hit algorithm that return always false", async () => {
            const endpoints = ["endpoint"];
            const cacheHit = mock().mockResolvedValue({ value: false });
            const input: ICacheQueryInput = {
                cache: A_CACHE,
                query: A_QUERY,
                endpoints,
                cacheHitAlgorithms: [{ algorithm: cacheHit }],
                outputOption: OutputOption.URL
            };

            const resultOrError = await getCachedQuads(input);

            expect(isResult(resultOrError)).toBe(true);
            const result: { value: CacheResult } = <{ value: CacheResult }>resultOrError;
            expect(result.value).toBeUndefined();

            expect(cacheHit).toHaveBeenCalled();
            expect(cacheHit).toHaveBeenLastCalledWith(A_QUERY,expect.any(Object), {sources: endpoints});
        });

        it("should return no cache data given a cache hit algorithm that is slower than the timeout", async () => {
            const endpoints = ["endpoint"];
            const cacheHit = mock(() => {
                return new Promise((resolve) => {
                    setTimeout(() => {
                        resolve({ value: true });
                    }, 500 * 10_000);
                });
            })
            const input: ICacheQueryInput = {
                cache: A_CACHE,
                query: A_QUERY,
                endpoints,
                cacheHitAlgorithms: [{ algorithm: <any>cacheHit, time_limit: 100 }],
                outputOption: OutputOption.URL
            };

            const resultOrError = await getCachedQuads(input);

            expect(isResult(resultOrError)).toBe(true);
            const result: { value: CacheResult } = <{ value: CacheResult }>resultOrError;
            expect(result.value).toBeUndefined();

            expect(cacheHit).toHaveBeenCalled();
            expect(cacheHit).toHaveBeenLastCalledWith(A_QUERY,expect.any(Object), {sources: endpoints});
        });

        it("should return no cache data given an empty cache", async () => {
            const endpoints = ["endpoint"];
            const cacheHit = mock().mockResolvedValue({ value: true });
            const input: ICacheQueryInput = {
                cache: new Map(),
                query: A_QUERY,
                endpoints,
                cacheHitAlgorithms: [{ algorithm: cacheHit }],
                outputOption: OutputOption.URL
            };

            const resultOrError = await getCachedQuads(input);

            expect(isResult(resultOrError)).toBe(true);
            const result: { value: CacheResult } = <{ value: CacheResult }>resultOrError;
            expect(result.value).toBeUndefined();

            expect(cacheHit).not.toHaveBeenCalled();
        });

    });

    describe("return a cache", () => {
        it("should return an entry given a cache hit function that always hit", async () => {
            const endpoints = ["endpoint"];
            const cacheHit = mock().mockResolvedValue({ value: true });
            const input: ICacheQueryInput = {
                cache: A_CACHE,
                query: A_QUERY,
                endpoints,
                cacheHitAlgorithms: [{ algorithm: cacheHit }],
                outputOption: OutputOption.URL
            };

            const resultOrError = await getCachedQuads(input);

            expect(isResult(resultOrError)).toBe(true);
            const result: { value: CacheResult } = <{ value: CacheResult }>resultOrError;
            expect(result.value).toBeDefined();
            expect(result.value.algorithmIndex).toBe(0);

            expect(cacheHit).toHaveBeenCalled();
            expect(cacheHit).toHaveBeenLastCalledWith(A_QUERY,expect.any(Object), {sources: endpoints});
        });

        it("should return an entry given multiple cache hit function with one hitting the cache", async () => {
            const endpoints = ["endpoint"];
            const cacheMiss1 = mock().mockResolvedValue({ value: false });
            const cacheMiss2 = mock().mockResolvedValue({ value: false });
            const cacheMiss3 = mock().mockResolvedValue({ value: false });
            const cacheHit = mock().mockResolvedValue({ value: true });
            const input: ICacheQueryInput = {
                cache: A_CACHE,
                query: A_QUERY,
                endpoints,
                cacheHitAlgorithms: [
                    { algorithm: cacheMiss1 },
                    { algorithm: cacheMiss2 },
                    { algorithm: cacheHit },
                    { algorithm: cacheMiss3 }
                ],
                outputOption: OutputOption.URL
            };

            const resultOrError = await getCachedQuads(input);

            expect(isResult(resultOrError)).toBe(true);
            const result: { value: CacheResult } = <{ value: CacheResult }>resultOrError;
            expect(result.value).toBeDefined();
            expect(result.value.algorithmIndex).toBe(2);

            expect(cacheMiss1).toHaveBeenCalledTimes(2);
            expect(cacheMiss1).toHaveBeenNthCalledWith(1, A_QUERY,expect.any(Object), {sources: endpoints});
            expect(cacheMiss1).toHaveBeenNthCalledWith(2, A_QUERY,expect.any(Object), {sources: endpoints});

            expect(cacheMiss2).toHaveBeenCalledTimes(2);
            expect(cacheMiss2).toHaveBeenNthCalledWith(1, A_QUERY,expect.any(Object), {sources: endpoints});
            expect(cacheMiss2).toHaveBeenNthCalledWith(2, A_QUERY,expect.any(Object), {sources: endpoints});

            expect(cacheHit).toHaveBeenCalled();
            expect(cacheHit).toHaveBeenLastCalledWith(A_QUERY,expect.any(Object), {sources: endpoints});

            expect(cacheMiss3).not.toHaveBeenCalled();
        });
    });

    describe("with the URL of a cache", ()=>{
        beforeEach(()=>{

        });
        it("should return an entry given a cache hit function that always hit", async () => {
            throw new Error();
            const endpoints = ["endpoint"];
            const cacheHit = mock().mockResolvedValue({ value: true });
            const input: ICacheQueryInput = {
                cache: A_CACHE,
                query: A_QUERY,
                endpoints,
                cacheHitAlgorithms: [{ algorithm: cacheHit }],
                outputOption: OutputOption.URL
            };

            const resultOrError = await getCachedQuads(input);

            expect(isResult(resultOrError)).toBe(true);
            const result: { value: CacheResult } = <{ value: CacheResult }>resultOrError;
            expect(result.value).toBeDefined();
            expect(result.value.algorithmIndex).toBe(0);

            expect(cacheHit).toHaveBeenCalled();
            expect(cacheHit).toHaveBeenLastCalledWith(A_QUERY,expect.any(Object), {sources: endpoints});
        });
    })
});