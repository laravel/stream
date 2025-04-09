import { useEffect, useRef, useState, useCallback } from 'react';

interface StreamResult {
    message: string;        // The accumulated message
    onMessage: (callback: (event: MessageEvent) => void) => void; // Function to run when a message event is received
    messageParts: string[]; // Array of individual message parts
    streamComplete: boolean; // Whether the stream has completed
    error: Error | null;    // Any error that occurred
}

// Type for internal state management (without the function property)
type StreamState = Omit<StreamResult, 'onMessage'>;

// Default values for optional parameters
const DEFAULT_EVENT_NAME = 'update';
const DEFAULT_END_SIGNAL = '</stream>';
const DEFAULT_SEPARATOR = ' ';

/**
 * Hook for handling server-sent events (SSE) streams
 * 
 * @param url - The URL to connect to for the EventSource
 * @param callback - Optional function to be called when an event is received
 * @param onComplete - Optional callback to be executed when the stream ends
 * @param eventName - Optional custom event name (defaults to 'update')
 * @param endSignal - Optional custom end signal (defaults to '</stream>')
 * @param separator - Optional separator for joining message parts (defaults to ' ')
 * @returns StreamResult object containing the accumulated message, onMessage callback, and stream status
 */
export function useStream(
    url: string,
    callback?: (event: MessageEvent) => void,
    onComplete?: (event: MessageEvent) => void,
    eventName: string = DEFAULT_EVENT_NAME,
    endSignal: string = DEFAULT_END_SIGNAL,
    separator: string = DEFAULT_SEPARATOR
): StreamResult {
    // Refs for managing callbacks and connection state
    const sourceRef = useRef<EventSource | null>(null);
    const messagePartsRef = useRef<string[]>([]);
    const callbackRef = useRef(callback);
    const onCompleteRef = useRef(onComplete);
    const onMessageCallbackRef = useRef<((event: MessageEvent) => void) | null>(null);

    // Update refs when callbacks change
    useEffect(() => {
        callbackRef.current = callback;
        onCompleteRef.current = onComplete;
    }, [callback, onComplete]);

    // Initialize stream state
    const [streamState, setStreamState] = useState<StreamState>({
        message: '',
        messageParts: [],
        streamComplete: false,
        error: null
    });

    // Stable callback to update the stream state
    const updateStreamState = useCallback((updates: Partial<StreamState>) => {
        setStreamState((prev: StreamState) => ({
            ...prev,
            ...updates
        }));
    }, []);

    // Function to reset stream state
    const resetStreamState = useCallback(() => {
        messagePartsRef.current = [];
        updateStreamState({
            message: '',
            messageParts: [],
            streamComplete: false,
            error: null
        });
    }, [updateStreamState]);

    // Function to handle incoming messages
    const handleMessage = useCallback((event: MessageEvent) => {
        // Check if this is the end signal
        if (event.data === endSignal || event.data === `data: ${endSignal}`) {
            // Close the connection
            if (sourceRef.current) {
                sourceRef.current.close();
            }
            
            // Update the stream state to indicate completion
            updateStreamState({ streamComplete: true });
            
            // Call the onComplete callback if provided
            if (onCompleteRef.current) {
                onCompleteRef.current(event);
            }
            
            return;
        }
        
        // Clean the data by removing 'data: ' prefix if present
        const cleanData = event.data.startsWith('data: ')
            ? event.data.substring(6) // Remove 'data: ' prefix
            : event.data;
        
        // Add the cleaned message part to our array
        messagePartsRef.current.push(cleanData);
        
        // Update the stream state with the new message
        updateStreamState({
            message: messagePartsRef.current.join(separator),
            messageParts: [...messagePartsRef.current]
        });
        
        // Call the onMessage callback with the event data
        if (onMessageCallbackRef.current) {
            onMessageCallbackRef.current(event);
        }
        
        // Call the callback with the event data if provided
        if (callbackRef.current) {
            callbackRef.current(event);
        }
    }, [endSignal, separator, updateStreamState]);

    // Function to handle errors
    const handleError = useCallback((error: Event) => {
        console.error('EventSource error:', error);
        updateStreamState({ error: new Error('EventSource connection error') });
        
        if (sourceRef.current) {
            sourceRef.current.close();
        }
    }, [updateStreamState]);

    // Set up and tear down the EventSource connection
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

    // Return the stream result with the onMessage function
    return {
        ...streamState,
        onMessage: (callback: (event: MessageEvent) => void) => {
            onMessageCallbackRef.current = callback;
        }
    };
}

export default useStream;
