import { checkValidJson, LegacyEventStream } from './v1-to-packed';

import { readFile, createWriteStream } from 'fs';

import { createEncodeStream } from 'msgpack-lite';

function readJson(path) {
  return new Promise((resolve, reject) => {
    readFile(path, 'utf8', (error, contents) => {
      if (error) {
        reject(error);
      } else {
        resolve(JSON.parse(contents));
      }
    });
  });
}

(async () => {
  const filename = process.argv[2];
  const filename2 = process.argv[3];
  if (!filename || !filename2) {
    throw new Error('need two filenames');
  }
  console.log(`Reading ${filename}…`);
  const json = await readJson(filename);
  checkValidJson(json);
  console.log(`Found ${json.events.length}`);

  const writeStream = createWriteStream(filename2);
  const encodeStream = createEncodeStream();
  encodeStream.pipe(writeStream);
  const stream = new LegacyEventStream((event) => {
    console.log('event', event);
    encodeStream.write(event);
  });
  stream.supplyArray(json.events);
  encodeStream.end();
})().catch((error) => {
  console.error(error);
  process.exit(-1);
});
