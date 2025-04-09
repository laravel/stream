interface StreamResult {
    message: string;
    onMessage: (callback: (event: MessageEvent) => void) => void;
    messageParts: string[];
    streamComplete: boolean;
    error: Error | null;
}
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
export declare function useStream(url: string, callback?: (event: MessageEvent) => void, onComplete?: (event: MessageEvent) => void, eventName?: string, endSignal?: string, separator?: string): StreamResult;
export default useStream;
