export class MedcheckError extends Error {
  constructor(message, { status = null, code = "request_failed" } = {}) {
    super(message);
    this.name = "MedcheckError";
    this.status = status;
    this.code = code;
  }
}

const conciseMessage = (value, fallback) => {
  const text = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  return text ? text.slice(0, 260) : fallback;
};

const parseBody = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return { error: text }; }
};

export async function requestMedcheck({ scan, profile, selectedId }, { signal, timeoutMs = 75_000 } = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const abortForParent = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", abortForParent, { once: true });
  }
  const timeout = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const payload = { scan, profile };
    if (selectedId) payload.selected_id = selectedId;
    const response = await fetch("/api/medcheck", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const body = await parseBody(response);
    if (!response.ok) {
      const message = conciseMessage(
        body?.error?.message || body?.error || body?.message,
        response.status >= 500 ? "The review service could not complete this request." : "Please check the label text and try again.",
      );
      throw new MedcheckError(message, { status: response.status, code: `http_${response.status}` });
    }
    if (!body || typeof body !== "object") {
      throw new MedcheckError("The review service returned an unreadable response.", { code: "invalid_response" });
    }
    return body;
  } catch (error) {
    if (error instanceof MedcheckError) throw error;
    if (controller.signal.aborted) {
      throw new MedcheckError(
        timedOut ? "This review took too long. Please try again." : "This review was cancelled.",
        { code: timedOut ? "timeout" : "aborted" },
      );
    }
    throw new MedcheckError("We could not reach the review service. Check your connection and try again.", { code: "network" });
  } finally {
    globalThis.clearTimeout(timeout);
    signal?.removeEventListener("abort", abortForParent);
  }
}
