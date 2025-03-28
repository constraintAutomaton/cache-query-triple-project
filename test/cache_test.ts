import { expect, describe, mock, it, beforeEach, spyOn } from "bun:test";
import { getCachedQuads, OutputOption, type CacheResult, type ICacheQueryInput } from "../lib/cache";
import type { ICacheElement, Cache } from "../lib/parse_cache";
import { Algebra, translate } from 'sparqlalgebrajs';
import { isResult, type IOptions } from "../lib/util";


describe("getCachedQuads", () => {
    const A_QUERY = translate("SELECT * WHERE {?s ?p ?o.}");
    const A_CACHE_QUERY = "SELECT * WHERE {?s1 ?p1 ?o1.}";
    const ANOTHER_CACHE_QUERY = "SELECT * WHERE {?s2 ?p2 ?o2.}";

    const endpoint1Entry: Map<string, ICacheElement> = new Map([
        [A_CACHE_QUERY, { resultUrl: "R0", endpoints: ["endpoint0", "endpoint0P"] }],
        [ANOTHER_CACHE_QUERY, { resultUrl: "R1", endpoints: ["endpoint1"] }],
    ]);

    const A_CACHE: Cache = new Map([
        ["endpoint", endpoint1Entry]
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
        });

    });

    describe("return a cache", () => {
        it("should return an entry given a cache it function that always hit", async () => {
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
        });
    });
});