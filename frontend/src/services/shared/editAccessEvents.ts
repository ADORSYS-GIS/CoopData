/**
 * Broadcasts "you no longer hold this submission" refusals from the backend.
 *
 * When an Apex reclaims a draft (or a colleague takes it over), every write from
 * the previous editor is refused with HTTP 409 `{ error: "not_editor" }`. Calls go
 * through two paths — the openapi client and a few raw `fetch` hooks — so both
 * report here, and the open submission page reacts once: it locks and explains.
 */

export const EDIT_ACCESS_LOST_EVENT = "coopdata:edit-access-lost";

export interface EditAccessLostDetail {
  /** Backend explanation, e.g. "The Apex has taken this submission back…". */
  message: string;
}

const isNotEditorBody = (body: unknown): body is { error: string; message?: string } =>
  typeof body === "object" && body !== null && (body as { error?: unknown }).error === "not_editor";

/** Dispatches the event when `response` is a `not_editor` refusal; never consumes the body. */
export const reportIfEditAccessLost = async (response: Response): Promise<void> => {
  if (response.status !== 409) return;
  try {
    const body: unknown = await response.clone().json();
    if (isNotEditorBody(body)) {
      window.dispatchEvent(
        new CustomEvent<EditAccessLostDetail>(EDIT_ACCESS_LOST_EVENT, {
          detail: { message: body.message ?? "" },
        }),
      );
    }
  } catch {
    // Not JSON: an ordinary conflict, not a lost edit lock.
  }
};

let installed = false;

/** Wraps `window.fetch` once so raw `fetch` calls report lost edit access too. */
export const installEditAccessInterceptor = (): void => {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const original = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const response = await original(...args);
    void reportIfEditAccessLost(response);
    return response;
  };
};

/** Subscribes to lost-edit-access events; returns the unsubscribe function. */
export const onEditAccessLost = (handler: (detail: EditAccessLostDetail) => void): (() => void) => {
  const listener = (event: Event) => handler((event as CustomEvent<EditAccessLostDetail>).detail);
  window.addEventListener(EDIT_ACCESS_LOST_EVENT, listener);
  return () => window.removeEventListener(EDIT_ACCESS_LOST_EVENT, listener);
};
