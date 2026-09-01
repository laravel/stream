import { useCallback, useEffect, useRef, useState } from "react";
import { streamJsonEvents } from "../streams/jsonEvents";
import { JsonEventStreamOptions, JsonEventStreamResult } from "../types";

/**
 * Hook for posting a body and reading a stream of JSON events back
 *
 * @param url - The URL to post to
 * @param options - Options for the stream
 *
 * @link https://laravel.com/docs/responses#event-streams
 *
 * @returns Result object containing the received events, send, and cancel functions
 */
export const useJsonEventStream = <
    TEvent = unknown,
    TSendBody extends Record<string, any> = {},
>(
    url: string,
    options: JsonEventStreamOptions<TEvent, TSendBody> = {},
): JsonEventStreamResult<TEvent, TSendBody> => {
    const controllerRef = useRef<AbortController | null>(null);
    const optionsRef = useRef(options);

    optionsRef.current = options;

    const [events, setEvents] = useState<TEvent[]>([]);
    const [isFetching, setIsFetching] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);

    const clearEvents = useCallback(() => {
        setEvents([]);
    }, []);

    const cancel = useCallback(() => {
        if (controllerRef.current === null) {
            return;
        }

        controllerRef.current.abort();
        controllerRef.current = null;

        setIsFetching(false);
        setIsStreaming(false);

        optionsRef.current.onCancel?.();
    }, []);

    const send = useCallback(
        async (body?: TSendBody) => {
            const current = optionsRef.current;

            cancel();

            const pending = new AbortController();

            const finish = () => {
                controllerRef.current = null;

                setIsFetching(false);
                setIsStreaming(false);

                current.onFinish?.();
            };

            try {
                const sent = await streamJsonEvents<TEvent, TSendBody>({
                    url,
                    body,
                    signal: pending.signal,
                    headers: current.headers,
                    csrfToken: current.csrfToken,
                    xsrfCookieName: current.xsrfCookieName,
                    xsrfHeaderName: current.xsrfHeaderName,
                    credentials: current.credentials,
                    eventName: current.eventName,
                    endSignal: current.endSignal,
                    onBeforeSend: current.onBeforeSend,
                    onParseError: current.onParseError,
                    onSend: () => {
                        setEvents([]);

                        controllerRef.current = pending;

                        setIsFetching(true);
                    },
                    onResponse: (response) => {
                        setIsFetching(false);
                        setIsStreaming(true);

                        current.onResponse?.(response);
                    },
                    onEvent: (event) => {
                        setEvents((previous) => [...previous, event]);

                        current.onEvent?.(event);
                    },
                });

                if (sent) {
                    finish();
                }
            } catch (error) {
                if ((error as Error).name === "AbortError") {
                    return;
                }

                setIsFetching(false);
                setIsStreaming(false);

                current.onError?.(error as Error);

                finish();
            }
        },
        [url, cancel],
    );

    useEffect(() => {
        window.addEventListener("beforeunload", cancel);

        return () => {
            window.removeEventListener("beforeunload", cancel);

            cancel();
        };
    }, [cancel]);

    useEffect(() => {
        if (optionsRef.current.initialInput) {
            void send(optionsRef.current.initialInput);
        }
        // Fires once on mount, like useStream's initial request...
    }, []);

    return {
        events,
        isFetching,
        isStreaming,
        send,
        cancel,
        clearEvents,
    };
};
