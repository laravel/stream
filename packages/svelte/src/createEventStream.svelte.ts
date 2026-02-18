import { writable } from "svelte/store";
import { EventStreamOptions, EventStreamResult } from "./types";

const dataPrefix = "data: ";

/**
 * Creates a reactive event stream for handling server-sent events (SSE) in Svelte 5.
 * Returns a Svelte store: use `$eventStream` in templates so the component re-renders when events arrive.
 *
 * @param url - The URL to connect to for the EventSource (can be a function for reactivity)
 * @param options - Options for the stream
 *
 * @link https://laravel.com/docs/responses#event-streams
 *
 * @returns A store-like object: subscribe to react to changes, plus close and clearMessage
 */
export const createEventStream = (
    url: string | (() => string),
    {
        eventName = "update",
        endSignal = "</stream>",
        glue = " ",
        replace = false,
        onMessage = () => null,
        onComplete = () => null,
        onError = () => null,
    }: EventStreamOptions = {},
): EventStreamResult => {
    const getUrl = typeof url === "function" ? url : () => url;
    const eventNames = Array.isArray(eventName) ? eventName : [eventName];

    const store = writable<{ message: string; messageParts: string[] }>({
        message: "",
        messageParts: [],
    });

    let source: EventSource | null = null;
    let currentUrl = getUrl();

    const resetMessageState = () => {
        store.set({ message: "", messageParts: [] });
    };

    const closeConnection = (resetMessage: boolean = false) => {
        eventNames.forEach((eventName) => {
            source?.removeEventListener(eventName, handleMessage);
        });
        source?.removeEventListener("error", handleError);
        source?.close();
        source = null;

        if (resetMessage) {
            resetMessageState();
        }
    };

    const handleMessage = (event: MessageEvent<string>) => {
        if ([endSignal, `${dataPrefix}${endSignal}`].includes(event.data)) {
            closeConnection();
            onComplete();

            return;
        }

        store.update((state) => {
            let messageParts = [...state.messageParts];

            if (replace) {
                messageParts = [];
            }

            const newPart = event.data.startsWith(dataPrefix)
                ? event.data.substring(dataPrefix.length)
                : event.data;

            messageParts = [...messageParts, newPart];

            return {
                message: messageParts.join(glue),
                messageParts,
            };
        });

        onMessage(event);
    };

    const handleError = (e: Event | Error) => {
        const error =
            e instanceof Error ? e : new Error(e.type ? `EventSource ${e.type}` : "EventSource error");
        onError(error);
        closeConnection();
    };

    const setupConnection = () => {
        resetMessageState();

        source = new EventSource(getUrl());

        eventNames.forEach((eventName) => {
            source!.addEventListener(eventName, handleMessage);
        });
        source.addEventListener("error", handleError);
    };

    $effect.root(() => {
        $effect(() => {
            setupConnection();

            return () => {
                closeConnection();
            };
        });

        $effect(() => {
            const newUrl = getUrl();

            if (newUrl !== currentUrl) {
                currentUrl = newUrl;
                closeConnection();
                setupConnection();
            }
        });
    });

    return {
        subscribe: store.subscribe,
        close: closeConnection,
        clearMessage: resetMessageState,
    };
};
