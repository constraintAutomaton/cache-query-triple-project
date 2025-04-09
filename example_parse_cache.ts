import { parseCache } from './lib/index';
import { isError } from 'result-interface';

const cacheUrl = "https://triple.ilabt.imec.be/test/querycache/queries.ttl";

// Retrieve and parse the cache
const response = await parseCache(cacheUrl);

// Handle error response if any
if (isError(response)) {
    console.error(`Unable to retrieve cache. Reason: ${response.error}`);
    process.exit(1);
}

// Log the entries in the cache
console.log(`The cache contains ${response.value.size} entries:`);

for (const [endpoint, cachedQueries] of response.value) {
    console.log(`- ${endpoint}`);
    let i = 0;
    for (const cacheInfo of cachedQueries.values()) {
        console.log(`\t[q${i}]: ${JSON.stringify(cacheInfo)}`);
        i++;
    }
}
