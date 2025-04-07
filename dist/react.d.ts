interface StreamResult {
    message: string;
    messageParts: string[];
    streamComplete: boolean;
    error: Error | null;
}
interface StreamHookResult extends StreamResult {
    onMessage: (callback: (chunk: string) => void) => void;
}
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
export declare function useStream(url: string, eventName?: string, endSignal?: string, separator?: string, callback?: (event: MessageEvent) => void, onComplete?: (event: MessageEvent) => void): StreamHookResult;
export default useStream;
