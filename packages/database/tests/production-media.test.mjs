import test from "node:test";
import assert from "node:assert/strict";
import {productionVideoSource,productionMediaId} from "../src/production-media-shared.ts";
import {productionByteRange} from "../src/production-media-http.ts";
test("only recognized video URLs and scoped UUID references produce embeds",()=>{
 const id="9b27356c-f6bb-4a54-a337-7f843ee917aa";
 assert.equal(productionMediaId(`production-media:${id}`),id);
 assert.deepEqual(productionVideoSource(`production-media:${id}`),{kind:"video",src:`/api/production/media/${id}`});
 for(const url of ["https://youtu.be/aqz-KE-bpKQ","https://www.youtube.com/watch?v=aqz-KE-bpKQ","https://www.youtube.com/shorts/aqz-KE-bpKQ"])
 assert.equal(productionVideoSource(url).src,"https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ");
 for(const url of ["javascript:alert(1)","https://youtube.com.evil.org/watch?v=aqz-KE-bpKQ","https://user:pass@youtube.com/watch?v=aqz-KE-bpKQ","production-media:../../secret"])
 assert.equal(productionVideoSource(url),null);
});
test("byte ranges support seeking and reject invalid or multiple ranges",()=>{
 assert.equal(productionByteRange(null,100),null);
 assert.deepEqual(productionByteRange("bytes=10-20",100),{start:10,end:20});
 assert.deepEqual(productionByteRange("bytes=10-",100),{start:10,end:99});
 assert.deepEqual(productionByteRange("bytes=-20",100),{start:80,end:99});
 assert.deepEqual(productionByteRange("bytes=0-200",100),{start:0,end:99});
 for(const value of ["bytes=100-","bytes=30-10","bytes=-0","bytes=0-1,3-4","bytes=-","bytes=999999999999999999999-"])
 assert.equal(productionByteRange(value,100),false,value);
});
