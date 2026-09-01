import { get, writable } from "svelte/store";
import { streamJsonEvents } from "./streams/jsonEvents";
import { JsonEventStreamOptions } from "./types";

export type JsonEventStreamState<TEvent = unknown> = {
    events: TEvent[];
    isFetching: boolean;
    isStreaming: boolean;
};

export type JsonEventStream<
    TEvent = unknown,
    TSendBody extends Record<string, any> = {},
> = {
    subscribe: (
        run: (value: JsonEventStreamState<TEvent>) => void,
    ) => () => void;
    send: (body?: TSendBody) => Promise<void>;
    cancel: () => void;
    clearEvents: () => void;
};

/**
 * Creates a reactive stream that posts a body and reads JSON events back.
 * Returns a Svelte store: use `$stream` in templates so the component re-renders when events arrive.
 *
 * @param url - The URL to POST to (or a getter for reactive URLs)
 * @param options - Stream options (initialInput, callbacks, etc.)
 * @returns A store-like object: subscribe to react to changes, plus send, cancel, clearEvents
 *
 * @see https://laravel.com/docs/responses#event-streams
 */
export const useJsonEventStream = <
    TEvent = unknown,
    TSendBody extends Record<string, any> = {},
>(
    url: string | (() => string),
    options: JsonEventStreamOptions<TEvent, TSendBody> = {},
): JsonEventStream<TEvent, TSendBody> => {
    const getUrl = typeof url === "function" ? url : () => url;

    const store = writable<JsonEventStreamState<TEvent>>({
        events: [],
        isFetching: false,
        isStreaming: false,
    });

    let controller: AbortController | null = null;

    const patch = (state: Partial<JsonEventStreamState<TEvent>>) => {
        store.update((current) => ({ ...current, ...state }));
    };

    const clearEvents = () => {
        patch({ events: [] });
    };

    const cancel = () => {
        if (controller === null) {
            return;
        }

        controller.abort();
        controller = null;

        patch({ isFetching: false, isStreaming: false });

        options.onCancel?.();
    };

    const finish = () => {
        controller = null;

        patch({ isFetching: false, isStreaming: false });

        options.onFinish?.();
    };

    const send = async (body?: TSendBody) => {
        cancel();

        const pending = new AbortController();

        try {
            const sent = await streamJsonEvents<TEvent, TSendBody>({
                url: getUrl(),
                body,
                signal: pending.signal,
                headers: options.headers,
                csrfToken: options.csrfToken,
                xsrfCookieName: options.xsrfCookieName,
                xsrfHeaderName: options.xsrfHeaderName,
                credentials: options.credentials,
                eventName: options.eventName,
                endSignal: options.endSignal,
                onBeforeSend: options.onBeforeSend,
                onParseError: options.onParseError,
                onSend: () => {
                    controller = pending;

                    patch({ events: [], isFetching: true });
                },
                onResponse: (response) => {
                    patch({ isFetching: false, isStreaming: true });

                    options.onResponse?.(response);
                },
                onEvent: (event) => {
                    patch({ events: [...get(store).events, event] });

                    options.onEvent?.(event);
                },
            });

            if (sent) {
                finish();
            }
        } catch (error) {
            if ((error as Error).name === "AbortError") {
                return;
            }

            patch({ isFetching: false, isStreaming: false });

            options.onError?.(error as Error);

            finish();
        }
    };

    let currentUrl = getUrl();

    $effect.root(() => {
        $effect(() => {
            window.addEventListener("beforeunload", cancel);

            if (options.initialInput) {
                void send(options.initialInput);
            }

            return () => {
                window.removeEventListener("beforeunload", cancel);

                cancel();
            };
        });

        $effect(() => {
            const newUrl = getUrl();

            if (newUrl !== currentUrl) {
                currentUrl = newUrl;

                cancel();
                clearEvents();
            }
        });
    });

    return {
        subscribe: store.subscribe,
        send,
        cancel,
        clearEvents,
    };
};
