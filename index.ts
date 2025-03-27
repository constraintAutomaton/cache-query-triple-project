export * from "./lib/cache";
export * from './lib/parse_cache';
export * from './lib/util';

import { translate } from "sparqlalgebrajs";
const query = `
prefix : <https://stackoverflow.com/questions/19587520/sparql-path-between-two-instance/>

select *
where {
  ?s ^(:p/:p*/:p*) ?o .
}
`;

console.log(JSON.stringify(translate(query), null, 2));