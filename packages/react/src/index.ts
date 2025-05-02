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
 * Hook for handling server-sent events (SSE) streams
 *
 * @param url - The URL to connect to for the EventSource
 * @param eventName - Optional custom event name (defaults to 'update')
 * @param endSignal - Optional custom end signal (defaults to '</stream>')
 * @param separator - Optional separator for joining message parts (defaults to ' ')
 *
 * @returns StreamResult object containing the accumulated message, onMessage callback, and stream status
 */
export function useStream(
    url: string,
    eventName: string = DEFAULT_EVENT_NAME,
    endSignal: string = DEFAULT_END_SIGNAL,
    separator: string = DEFAULT_SEPARATOR,
): StreamResult {
    // Refs for managing callbacks and connection state
    const sourceRef = useRef<EventSource | null>(null);
    const messagePartsRef = useRef<string[]>([]);
    const onMessageCallbackRef = useRef<((event: MessageEvent) => void) | null>(
        null,
    );
    const onCompleteCallbackRef = useRef<(() => void) | null>(null);
    const onErrorCallbackRef = useRef<((error: Error) => void) | null>(null);

    // State for message and message parts
    const [message, setMessage] = useState("");
    const [messageParts, setMessageParts] = useState<string[]>([]);

    // Function to reset stream state
    const resetStreamState = useCallback(() => {
        messagePartsRef.current = [];
        setMessage("");
        setMessageParts([]);
    }, []);

    // Function to handle incoming messages
    const handleMessage = useCallback(
        (event: MessageEvent) => {
            // Check if this is the end signal
            if (
                event.data === endSignal ||
                event.data === `data: ${endSignal}`
            ) {
                // Close the connection
                if (sourceRef.current) {
                    sourceRef.current.close();
                }

                // Call the onComplete callback if provided
                if (onCompleteCallbackRef.current) {
                    onCompleteCallbackRef.current();
                }

                return;
            }

            // Clean the data by removing 'data: ' prefix if present
            const cleanData = event.data.startsWith("data: ")
                ? event.data.substring(6) // Remove 'data: ' prefix
                : event.data;

            // Add the cleaned message part to our array
            messagePartsRef.current.push(cleanData);

            // Update the state with the new message
            setMessage(messagePartsRef.current.join(separator));
            setMessageParts([...messagePartsRef.current]);

            // Call the onMessage callback with the event data
            if (onMessageCallbackRef.current) {
                onMessageCallbackRef.current(event);
            }
        },
        [endSignal, separator],
    );

    // Function to handle errors
    const handleError = useCallback((error: Event) => {
        const err = new Error("EventSource connection error");
        if (onErrorCallbackRef.current) {
            onErrorCallbackRef.current(err);
        }

        if (sourceRef.current) {
            sourceRef.current.close();
        }
    }, []);

    // Create a new event source connection or close it when the component unmounts
    useEffect(() => {
        // Reset state when creating a new connection
        resetStreamState();

        // Create a new EventSource
        const source = new EventSource(url);
        sourceRef.current = source;

        // Add event listeners
        source.addEventListener(eventName, handleMessage);
        source.onerror = handleError;

        // Cleanup function to close the connection when the component unmounts
        // or when dependencies change
        return () => {
            source.removeEventListener(eventName, handleMessage);
            source.close();
            sourceRef.current = null;
        };
    }, [url, eventName, handleMessage, handleError, resetStreamState]);

    // Return the stream result with the onMessage, onComplete, and onError registration functions
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
}

export default useStream;
