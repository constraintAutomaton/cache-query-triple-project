

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