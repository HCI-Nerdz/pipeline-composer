import type { Pipeline } from "./types.ts";

/** Serialize a pipeline document to JSON for storage or interchange. */
export function serializePipeline(pipeline: Pipeline): string {
  return JSON.stringify(pipeline, null, 2);
}

/** Parse a pipeline document from JSON. */
export function parsePipeline(json: string): Pipeline {
  const data = JSON.parse(json) as Pipeline;
  if (typeof data.id !== "string" || !Array.isArray(data.steps)) {
    throw new Error("Invalid pipeline document");
  }
  return data;
}
