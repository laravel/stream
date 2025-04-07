import { useEffect, useRef, useState, useCallback } from 'react';
/**
 * Hook for handling server-sent events (SSE) streams
 *
 * @param url - The URL to connect to for the EventSource
 * @param eventName - Optional custom event name (defaults to 'update')
 * @param endSignal - Optional custom end signal (defaults to '</stream>')
 * @param separator - Optional separator for joining message parts (defaults to ' ')
 * @param callback - Optional function to be called when an event is received
 * @param onComplete - Optional callback to be executed when the stream ends
 * @returns StreamResult object containing the accumulated message, onMessage callback, and stream status
 */
export function useStream(url, eventName = 'update', endSignal = '</stream>', separator = ' ', callback, onComplete) {
    const sourceRef = useRef(null);
    const messagePartsRef = useRef([]);
    const callbackRef = useRef(callback);
    const onCompleteRef = useRef(onComplete);
    // Update refs when callbacks change
    useEffect(() => {
        callbackRef.current = callback;
        onCompleteRef.current = onComplete;
    }, [callback, onComplete]);
    const [streamResult, setStreamResult] = useState({
        message: '',
        messageParts: [],
        streamComplete: false,
        error: null
    });
    // Store the onMessage callback in a ref to avoid dependency issues
    const onMessageCallbackRef = useRef(null);
    // Stable callback to update the stream result
    const updateStreamResult = useCallback((updates) => {
        setStreamResult(prev => ({
            ...prev,
            ...updates
        }));
    }, []);
    useEffect(() => {
        // Reset message parts when creating a new connection
        messagePartsRef.current = [];
        // Reset the stream result
        updateStreamResult({
            message: '',
            messageParts: [],
            streamComplete: false,
            error: null
        });
        // Create a new EventSource
        const source = new EventSource(url);
        sourceRef.current = source;
        // Add event listener for the specified event name
        source.addEventListener(eventName, (event) => {
            // Check if this is the end signal
            if (event.data === endSignal || event.data === `data: ${endSignal}`) {
                // Close the connection
                source.close();
                // Update the stream result to indicate completion
                updateStreamResult({ streamComplete: true });
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
            // Update the stream result with the new message
            updateStreamResult({
                message: messagePartsRef.current.join(separator),
                messageParts: [...messagePartsRef.current]
            });
            // Call the onMessage callback with the new chunk if it exists
            if (onMessageCallbackRef.current) {
                onMessageCallbackRef.current(cleanData);
            }
            // Call the callback with the event data if provided
            if (callbackRef.current) {
                callbackRef.current(event);
            }
        });
        // Error handling
        source.onerror = (error) => {
            console.error('EventSource error:', error);
            updateStreamResult({ error: new Error('EventSource connection error') });
            source.close();
        };
        // Cleanup function to close the connection when the component unmounts
        return () => {
            if (sourceRef.current) {
                sourceRef.current.close();
            }
        };
    }, [url, eventName, endSignal, separator, updateStreamResult]); // Removed callback and onComplete from dependencies
    // Return the stream result with the onMessage function
    return {
        ...streamResult,
        onMessage: (callback) => {
            onMessageCallbackRef.current = callback;
        }
    };
}
export default useStream;
