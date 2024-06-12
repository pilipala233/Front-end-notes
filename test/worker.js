// worker.js
const isb = new Int32Array(new SharedArrayBuffer(4));

function sleep(ms) {
  Atomics.wait(isb, 0, 0, ms);
  console.log(`Worker slept for ${ms} ms`);
}

self.onmessage = function(event) {
  if (event.data === 'start') {
    console.log('Worker started');
    sleep(2000); // Sleep for 2 seconds
    console.log('Worker finished sleeping');
    self.postMessage('done');
  }
};
