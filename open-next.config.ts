// OpenNext configuration for deploying the Aster Next.js backend on Cloudflare Workers.
// Docs: https://opennext.js.org/cloudflare
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // Enable ISR / data caching on Workers KV or R2 when you add server-rendered pages:
  // incrementalCache: r2IncrementalCache,
});
