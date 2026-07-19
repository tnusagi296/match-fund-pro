/**
 * Calls the runtime-provided fetch without leaking a caller's `this` value.
 *
 * Cloudflare Workers rejects runtime APIs invoked with the wrong receiver.
 * Passing the native fetch function around directly and later calling it as an
 * adapter method makes the adapter instance its receiver and causes an
 * `Illegal invocation` error. This wrapper keeps the runtime binding direct.
 */
export const runtimeFetch: typeof fetch = (input, init) => fetch(input, init);
