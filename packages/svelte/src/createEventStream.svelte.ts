import { $effect, $state } from "svelte";
import { EventStreamOptions, EventStreamResult } from "./types";

const dataPrefix = "data: ";

/**
 * Creates a reactive event stream for handling server-sent events (SSE) in Svelte 5
 *
 * @param url - The URL to connect to for the EventSource (can be a function for reactivity)
 * @param options - Options for the stream
 *
 * @link https://laravel.com/docs/responses#event-streams
 *
 * @returns StreamResult object containing the accumulated response, close, and reset functions
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
    let message = $state("");
    let messageParts = $state<string[]>([]);
    const eventNames = Array.isArray(eventName) ? eventName : [eventName];

    let source: EventSource | null = null;
    let currentUrl = getUrl();

    const resetMessageState = () => {
        message = "";
        messageParts = [];
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

        if (replace) {
            resetMessageState();
        }

        const newPart = event.data.startsWith(dataPrefix)
            ? event.data.substring(dataPrefix.length)
            : event.data;

        messageParts = [...messageParts, newPart];
        message = messageParts.join(glue);

        onMessage(event);
    };

    const handleError = (e: Event) => {
        onError(e);
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

    return {
        get message() {
            return message;
        },
        get messageParts() {
            return messageParts;
        },
        close: closeConnection,
        clearMessage: resetMessageState,
    };
};
