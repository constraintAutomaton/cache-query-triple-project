import { RDF_FACTORY } from './util';

export const ENDPOINT_PREDICATE = RDF_FACTORY.namedNode("http://www.w3.org/ns/sparql-service-description#endpoint");
export const RESULT_IRI_PREDICATE = RDF_FACTORY.namedNode("http://www.w3.org/2001/sw/DataAccess/tests/test-manifest#result");
export const QUERY_IRI_PREDICATE = RDF_FACTORY.namedNode("http://www.w3.org/2001/sw/DataAccess/tests/test-query#query");
export const QUERY_CLASS = RDF_FACTORY.literal("Query");
export const RDF_TYPE = RDF_FACTORY.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");
export const ELEMENT_OF_LIST_PREDICATE = RDF_FACTORY.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#first");
export const NEXT_ELEMENT_OF_LIST_PREDICATE = RDF_FACTORY.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#rest");
export const LAST_ELEMENT_LIST = RDF_FACTORY.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#nil");