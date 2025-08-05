import {
    parseCache
} from 'sparql-cache-client';
import { rdfDereferencer } from 'rdf-dereference';

const cacheLocation = { path: "./cache.ttl" };

//const { data: d } = await rdfDereferencer.dereference(cacheLocation.path, { localFiles: true });
//console.log(d);

const cache = await parseCache(cacheLocation);
console.log(cache);

//a();

async function a() {
    const { data: d } = await rdfDereferencer.dereference(cacheLocation.path, { localFiles: true });
    console.log(d);
}