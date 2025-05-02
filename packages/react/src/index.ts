import { useCallback, useEffect, useRef, useState } from "react";

type StreamResult = {
    message: string;
    messageParts: string[];
    onMessage: (callback: (event: MessageEvent) => void) => void;
    onComplete: (callback: () => void) => void;
    onError: (callback: (error: Error) => void) => void;
};

const DEFAULT_EVENT_NAME = "update";
const DEFAULT_END_SIGNAL = "</stream>";
const DEFAULT_SEPARATOR = " ";

/**
 * Hook for handling server-sent event (SSE) streams
 *
 * @param url - The URL to connect to for the EventSource
 * @param eventName - Optional custom event name
 * @default "update"
 * @param endSignal - Optional custom end signal
 * @default "</stream>"
 * @param separator - Optional separator for joining message parts
 * @default " "
 *
 * @returns StreamResult object containing the accumulated message, onMessage callback, and stream status
 */
export const useStream = (
    url: string,
    eventName: string = DEFAULT_EVENT_NAME,
    endSignal: string = DEFAULT_END_SIGNAL,
    separator: string = DEFAULT_SEPARATOR,
): StreamResult => {
    const sourceRef = useRef<EventSource | null>(null);
    const messagePartsRef = useRef<string[]>([]);
    const onMessageCallbackRef = useRef<((event: MessageEvent) => void) | null>(
        null,
    );
    const onCompleteCallbackRef = useRef<(() => void) | null>(null);
    const onErrorCallbackRef = useRef<((error: Error) => void) | null>(null);

    const [message, setMessage] = useState("");
    const [messageParts, setMessageParts] = useState<string[]>([]);

    const resetStreamState = useCallback(() => {
        messagePartsRef.current = [];
        setMessage("");
        setMessageParts([]);
    }, []);

    const handleMessage = useCallback(
        (event: MessageEvent) => {
            if ([endSignal, `data: ${endSignal}`].includes(event.data)) {
                sourceRef.current?.close();
                onCompleteCallbackRef.current?.();

                return;
            }

            const cleanData = event.data.startsWith("data: ")
                ? event.data.substring(6)
                : event.data;

            messagePartsRef.current.push(cleanData);

            setMessage(messagePartsRef.current.join(separator));
            setMessageParts([...messagePartsRef.current]);

            onMessageCallbackRef.current?.(event);
        },
        [endSignal, separator],
    );

    const handleError = useCallback((error: Event) => {
        const err = new Error("EventSource connection error");

        onErrorCallbackRef.current?.(err);
        sourceRef.current?.close();
    }, []);

    useEffect(() => {
        resetStreamState();

        const source = new EventSource(url);
        sourceRef.current = source;

        source.addEventListener(eventName, handleMessage);
        source.onerror = handleError;

        return () => {
            source.removeEventListener(eventName, handleMessage);
            source.close();
            sourceRef.current = null;
        };
    }, [url, eventName, handleMessage, handleError, resetStreamState]);

    return {
        message,
        messageParts,
        onMessage: (callback: (event: MessageEvent) => void) => {
            onMessageCallbackRef.current = callback;
        },
        onComplete: (callback: () => void) => {
            onCompleteCallbackRef.current = callback;
        },
        onError: (callback: (error: Error) => void) => {
            onErrorCallbackRef.current = callback;
        },
    };
};
