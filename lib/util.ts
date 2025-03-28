
import { Algebra } from 'sparqlalgebrajs';
import { DataFactory } from 'rdf-data-factory';
import type * as RDF from '@rdfjs/types';

export const RDF_FACTORY: RDF.DataFactory = new DataFactory();

export type Result<R, E = string> = { value: R } | { error: E };

export function isResult<R, E>(r: Result<R, E>): r is { value: R } {
    return "value" in r;
}

export function isError<R, E>(r: Result<R, E>): r is { error: E } {
    return "error" in r;
}
/**
 * A function to determine if the cache has been hit. Return false if the cache was miss.
 */
export type CacheHitFunction = (q1: Algebra.Operation, q2: Algebra.Operation, options?: IOptions) => Promise<Result<boolean>>;

/**
 * Option of for the CacheHitFunction
 */
export type IOptions = {
    /**
     * Sources of the query
     */
    sources: Readonly<string[]>,
} & Record<string, any>;

/**
 * Convert a list of endpoint to the same string regardless of the order in the list.
 * @param {string[]} endpoints
 * @returns {string} 
 */
export function listOfEnpointsToString(endpoints: Readonly<string[]>): string {
    const newListofEndpoint = [...endpoints];
    return newListofEndpoint.sort((a, b) => a.localeCompare(b)).toString();
}