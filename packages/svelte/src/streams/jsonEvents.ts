import { csrfHeaders } from "./csrf";
import { readEventStream } from "./events";

export class StreamResponseError extends Error {
    constructor(
        public readonly response: Response,
        public readonly body: string,
    ) {
        super(
            body || `The stream request failed with status ${response.status}.`,
        );

        this.name = "StreamResponseError";
    }

    get status(): number {
        return this.response.status;
    }
}

export type JsonEventStreamRequest<
    TEvent = unknown,
    TSendBody extends Record<string, any> = {},
> = {
    url: string;
    body?: TSendBody;
    signal: AbortSignal;
    headers?: Record<string, string>;
    csrfToken?: string;
    xsrfCookieName?: string;
    xsrfHeaderName?: string;
    credentials?: RequestCredentials;
    eventName?: string | string[];
    endSignal?: string;
    onEvent: (event: TEvent) => void;
    onSend?: () => void;
    onResponse?: (response: Response) => void;
    onParseError?: (error: Error, data: string) => void;
    onBeforeSend?: (request: RequestInit) => boolean | RequestInit | void;
};

/**
 * Post a body and read a stream of JSON events back
 *
 * The primitive `useJsonEventStream` is built on, for events folded into state
 * the caller already owns rather than collected into an array.
 *
 * @param request - The URL, body, signal and callbacks for the stream
 *
 * @link https://laravel.com/docs/responses#event-streams
 *
 * @returns False when onBeforeSend refused the request, otherwise true
 */
export const streamJsonEvents = async <
    TEvent = unknown,
    TSendBody extends Record<string, any> = {},
>({
    url,
    body,
    signal,
    headers,
    csrfToken,
    xsrfCookieName,
    xsrfHeaderName,
    credentials,
    eventName,
    endSignal = "</stream>",
    onEvent,
    onSend,
    onResponse,
    onParseError,
    onBeforeSend,
}: JsonEventStreamRequest<TEvent, TSendBody>): Promise<boolean> => {
    const request: RequestInit = {
        method: "POST",
        signal,
        credentials: credentials ?? "same-origin",
        headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            ...csrfHeaders({ csrfToken, xsrfCookieName, xsrfHeaderName }),
            ...(headers ?? {}),
        },
        body: JSON.stringify(body ?? {}),
    };

    const modified = onBeforeSend?.(request);

    if (modified === false) {
        return false;
    }

    onSend?.();

    const response = await fetch(
        url,
        typeof modified === "object" && modified !== null ? modified : request,
    );

    if (!response.ok) {
        throw new StreamResponseError(response, await response.text());
    }

    if (!response.body) {
        throw new Error("ReadableStream not yet supported in this browser.");
    }

    const contentType = response.headers.get("Content-Type") ?? "";

    if (!contentType.includes("text/event-stream")) {
        throw new Error(
            `Expected a text/event-stream response, received "${contentType}".`,
        );
    }

    onResponse?.(response);

    const eventNames = eventName === undefined ? null : [eventName].flat();

    await readEventStream(response.body, (frame) => {
        if (signal.aborted) {
            return false;
        }

        // Before the event name filter, so a terminator sent under a
        // different name still ends the stream.
        if (frame.data === endSignal) {
            return false;
        }

        // A frame with no event field is of type "message".
        if (
            eventNames !== null &&
            !eventNames.includes(frame.event ?? "message")
        ) {
            return true;
        }

        let event: TEvent;

        try {
            event = JSON.parse(frame.data) as TEvent;
        } catch (error) {
            onParseError?.(error as Error, frame.data);

            return true;
        }

        // Outside the try, so a throw from the caller is not mistaken for
        // a malformed frame.
        onEvent(event);

        return true;
    });

    if (signal.aborted) {
        throw new DOMException("The operation was aborted.", "AbortError");
    }

    return true;
};
