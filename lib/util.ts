import { Algebra } from 'sparqlalgebrajs';
import { DataFactory } from 'rdf-data-factory';
import type * as RDF from '@rdfjs/types';
import { type SafePromise } from 'result-interface';

export const RDF_FACTORY: RDF.DataFactory = new DataFactory();

/**
 * A function to determine if the cache has been hit. Return false if the cache was miss.
 */
export type CacheHitFunction = (
  q1: Readonly<Algebra.Operation>,
  q2: Readonly<Algebra.Operation>,
  options?: IOptions,
) => SafePromise<boolean>;

/**
 * Option of for the CacheHitFunction
 */
export type IOptions = {
  /**
   * Sources of the query
   */
  sources: readonly string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} & Readonly<Record<string, any>>;

/**
 * Convert a list of endpoint to the same string regardless of the order in the list.
 * @param {string[]} endpoints
 * @returns {string}
 */
export function listOfEnpointsToString(endpoints: readonly string[]): string {
  const newListofEndpoint = [...endpoints];
  return newListofEndpoint.sort((a, b) => a.localeCompare(b)).toString();
}
