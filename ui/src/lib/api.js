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

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(",", 2)[1] || "");
  reader.onerror = () => reject(new MedcheckError("That image could not be read.", { code: "image_read" }));
  reader.readAsDataURL(file);
});

// Read a bottle-label photo with real Bedrock Nova Pro vision. Returns { readable, query, product, brand, expiry, note }.
export async function scanLabel(file, { timeoutMs = 75_000 } = {}) {
  if (!file || !/^image\//.test(file.type || "")) {
    throw new MedcheckError("Please choose a photo of the bottle label.", { code: "not_image" });
  }
  const image = await fileToBase64(file);
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image }),
      signal: controller.signal,
    });
    const body = await parseBody(response);
    if (!response.ok) {
      throw new MedcheckError(
        conciseMessage(body?.error?.message || body?.error, "Couldn't read that photo. Retake it, or type the name."),
        { status: response.status, code: `http_${response.status}` },
      );
    }
    return body || {};
  } catch (error) {
    if (error instanceof MedcheckError) throw error;
    if (controller.signal.aborted) throw new MedcheckError("Reading the photo took too long. Try again.", { code: "timeout" });
    throw new MedcheckError("We could not reach the scan service. Check your connection.", { code: "network" });
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

// Ask a grounded follow-up question about the current product's evidence. Returns { answer, source }.
export async function askAgent(question, context, { timeoutMs = 75_000 } = {}) {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, context }),
      signal: controller.signal,
    });
    const body = await parseBody(response);
    if (!response.ok) {
      throw new MedcheckError(
        conciseMessage(body?.error?.message || body?.error, "The agent couldn't answer just now. Try again."),
        { status: response.status, code: `http_${response.status}` },
      );
    }
    return body || {};
  } catch (error) {
    if (error instanceof MedcheckError) throw error;
    if (controller.signal.aborted) throw new MedcheckError("That took too long. Try again.", { code: "timeout" });
    throw new MedcheckError("We could not reach the agent. Check your connection.", { code: "network" });
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

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
