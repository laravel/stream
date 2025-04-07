/**
 * Composable for handling server-sent events (SSE) streams in Vue
 *
 * @param url - The URL to connect to for the EventSource
 * @param eventName - Optional custom event name (defaults to 'update')
 * @param endSignal - Optional custom end signal (defaults to '</stream>')
 * @param separator - Optional separator for joining message parts (defaults to ' ')
 * @param callback - Optional function to be called when an event is received
 * @param onComplete - Optional callback to be executed when the stream ends
 * @returns StreamResult object containing the accumulated message, onMessage callback, and stream status
 */
export declare function useStream(url: string, eventName?: string, endSignal?: string, separator?: string, callback?: (event: MessageEvent) => void, onComplete?: (event: MessageEvent) => void): {
    message: Readonly<import("vue").Ref<string, string>>;
    messageParts: Readonly<import("vue").Ref<readonly string[], readonly string[]>>;
    streamComplete: Readonly<import("vue").Ref<boolean, boolean>>;
    error: Readonly<import("vue").Ref<Error | null, Error | null>>;
    onMessage: (callback: (chunk: string) => void) => void;
};
export default useStream;
