import "server-only";

type JsonSchema = Record<string, unknown>;

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

const GEMINI_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.6-flash",
  "gemini-3.8-flash",
  "gemini-3.1-flash-lite",
] as const;
const GEMINI_REQUEST_TIMEOUT_MS = 20_000;
const GEMINI_RETRY_BACKOFF_MS = 1_500;

export class GeminiConfigurationError extends Error {
  constructor() {
    super("GEMINI_API_KEY is not configured.");
    this.name = "GeminiConfigurationError";
  }
}

export class GeminiRequestError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly model?: string,
  ) {
    super(message);
    this.name = "GeminiRequestError";
  }
}

type GeminiAttempt = {
  response: Response;
  payload: GeminiResponse | null;
};

async function requestGemini(
  model: string,
  apiKey: string,
  prompt: string,
): Promise<GeminiAttempt> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.35,
          },
        }),
        cache: "no-store",
        signal: controller.signal,
      },
    );
    const payload = (await response.json().catch(() => null)) as GeminiResponse | null;
    return { response, payload };
  } catch (error) {
    if (controller.signal.aborted) {
      throw new GeminiRequestError(`Gemini request timed out for ${model}.`, 503, model);
    }
    throw new GeminiRequestError(
      error instanceof Error ? `Could not reach Gemini (${model}): ${error.message}` : `Could not reach Gemini (${model}).`,
      503,
      model,
    );
  } finally {
    clearTimeout(timeout);
  }
}

function parseGeminiJson<T>(text: string, responseSchema: JsonSchema): T {
  const jsonText = text
    .trim()
    .replace(/^```(?:json)?[ \t]*\r?\n?/i, "")
    .replace(/\s*```$/, "")
    .trim();
  const parsed: unknown = JSON.parse(jsonText);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected a JSON object.");
  }

  const required = responseSchema.required;
  if (
    Array.isArray(required) &&
    required.some(
      (key) => typeof key !== "string" || !Object.prototype.hasOwnProperty.call(parsed, key),
    )
  ) {
    throw new Error("Required fields are missing.");
  }
  return parsed as T;
}

export async function generateGeminiJson<T>(
  prompt: string,
  responseSchema: JsonSchema,
): Promise<{ data: T; modelUsed: string }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new GeminiConfigurationError();

  let lastError: GeminiRequestError | null = null;
  for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, GEMINI_RETRY_BACKOFF_MS));
      }

      let result: GeminiAttempt;
      try {
        result = await requestGemini(model, apiKey, prompt);
      } catch (error) {
        lastError =
          error instanceof GeminiRequestError
            ? error
            : new GeminiRequestError("Could not reach the Gemini API.", 503, model);
        if (attempt === 0) continue;
        break;
      }

      if (result.response.ok) {
        const text = result.payload?.candidates?.[0]?.content?.parts
          ?.map((part) => part.text ?? "")
          .join("")
          .trim();
        if (!text) {
          throw new GeminiRequestError("Gemini returned an empty response.", 502, model);
        }
        try {
          return { data: parseGeminiJson<T>(text, responseSchema), modelUsed: model };
        } catch {
          throw new GeminiRequestError(
            "Gemini returned invalid structured JSON or omitted required fields.",
            502,
            model,
          );
        }
      }

      const message = result.payload?.error?.message ?? "Unknown Gemini API error.";
      lastError = new GeminiRequestError(
        `Gemini request failed (${model}, HTTP ${result.response.status}): ${message}`,
        result.response.status,
        model,
      );

      if ([400, 404].includes(result.response.status)) break;
      if (![429, 503].includes(result.response.status)) throw lastError;
      if (attempt === 1) break;
    }
  }

  if (lastError) throw lastError;
  throw new GeminiRequestError("No Gemini models were available.", 503);
}
