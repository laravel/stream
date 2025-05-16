import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EventStreamOptions, EventStreamResult } from "../types";

const dataPrefix = "data: ";

/**
 * Hook for handling server-sent event (SSE) streams
 *
 * @param url - The URL to connect to for the EventSource
 * @param options - Options for the stream
 *
 * @link https://laravel.com/docs/responses#event-streams
 *
 * @returns StreamResult object containing the accumulated response, close, and reset functions
 */
export const useEventStream = (
    url: string,
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
    const sourceRef = useRef<EventSource | null>(null);
    const messagePartsRef = useRef<string[]>([]);
    const eventNames = useMemo(
        () => (Array.isArray(eventName) ? eventName : [eventName]),
        Array.isArray(eventName) ? eventName : [eventName],
    );

    const [message, setMessage] = useState("");
    const [messageParts, setMessageParts] = useState<string[]>([]);

    const resetMessageState = useCallback(() => {
        messagePartsRef.current = [];
        setMessage("");
        setMessageParts([]);
    }, []);

    const handleMessage = useCallback(
        (event: MessageEvent<string>) => {
            if ([endSignal, `${dataPrefix}${endSignal}`].includes(event.data)) {
                closeConnection();
                onComplete();

                return;
            }

            if (replace) {
                resetMessageState();
            }

            messagePartsRef.current.push(
                event.data.startsWith(dataPrefix)
                    ? event.data.substring(dataPrefix.length)
                    : event.data,
            );

            setMessage(messagePartsRef.current.join(glue));
            setMessageParts(messagePartsRef.current);

            onMessage(event);
        },
        [eventNames, glue],
    );

    const handleError = useCallback((error: Event) => {
        onError(error);
        closeConnection();
    }, []);

    const closeConnection = useCallback((resetMessage: boolean = false) => {
        eventNames.forEach((name) => {
            sourceRef.current?.removeEventListener(name, handleMessage);
        });
        sourceRef.current?.removeEventListener("error", handleError);
        sourceRef.current?.close();
        sourceRef.current = null;

        if (resetMessage) {
            resetMessageState();
        }
    }, []);

    useEffect(() => {
        resetMessageState();

        sourceRef.current = new EventSource(url);

        eventNames.forEach((name) => {
            sourceRef.current?.addEventListener(name, handleMessage);
        });
        sourceRef.current.addEventListener("error", handleError);

        return closeConnection;
    }, [url, eventNames, handleMessage, handleError, resetMessageState]);

    return {
        message,
        messageParts,
        close: closeConnection,
        clearMessage: resetMessageState,
    };
};
