import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";

console.log("🚀 INITIATION DE LANGFUSE OTEL (Node.js)...");
console.log("Clé publique trouvée ?", !!process.env.LANGFUSE_PUBLIC_KEY);

const sdk = new NodeSDK({
  spanProcessors: [new LangfuseSpanProcessor()],
});

sdk.start();
