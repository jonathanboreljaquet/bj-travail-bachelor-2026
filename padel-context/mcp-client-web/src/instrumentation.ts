export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // @ts-expect-error : dynamic import of a .ts file, which is not supported by TypeScript, but is supported by the bundler (esbuild) and the runtime (Node.js)
    await import("./instrumentation.node.ts");
  }
}
