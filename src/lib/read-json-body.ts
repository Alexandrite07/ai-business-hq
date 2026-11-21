import "server-only";

export class JsonRequestBodyError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413,
  ) {
    super(message);
    this.name = "JsonRequestBodyError";
  }
}

export async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) {
      throw new JsonRequestBodyError("Content-Length header is invalid.", 400);
    }
    if (Number(contentLength) > maxBytes) {
      throw new JsonRequestBodyError("Request body is too large.", 413);
    }
  }

  if (!request.body) throw new JsonRequestBodyError("Request body must be valid JSON.", 400);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new JsonRequestBodyError("Request body is too large.", 413);
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof JsonRequestBodyError) throw error;
    throw new JsonRequestBodyError("Request body could not be read.", 400);
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw new JsonRequestBodyError("Request body must be valid JSON.", 400);
  }
}
