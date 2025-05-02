import { ref, onMounted, onUnmounted, watch, readonly, Ref } from 'vue';

interface StreamResult {
    message: Readonly<Ref<string>>;        // The accumulated message
    messageParts: Readonly<Ref<readonly string[]>>; // Array of individual message parts
    onMessage: (callback: (event: MessageEvent) => void) => void; // Register a callback for message events
    onComplete: (callback: () => void) => void; // Register a callback for stream completion
    onError: (callback: (error: Error) => void) => void; // Register a callback for errors
}

// Default values for optional parameters
const DEFAULT_EVENT_NAME = 'update';
const DEFAULT_END_SIGNAL = '</stream>';
const DEFAULT_SEPARATOR = ' ';

/**
 * Composable for handling server-sent events (SSE) streams in Vue
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
    eventName: string = DEFAULT_EVENT_NAME,
    endSignal: string = DEFAULT_END_SIGNAL,
    separator: string = DEFAULT_SEPARATOR
): StreamResult {
    // Refs to hold state
    const message = ref('');
    const messageParts = ref<string[]>([]);

    // Ref to store the EventSource instance
    let source: EventSource | null = null;

    // Store the user-provided handlers
    let onMessageCallback: ((event: MessageEvent) => void) | null = null;
    let onCompleteCallback: (() => void) | null = null;
    let onErrorCallback: ((error: Error) => void) | null = null;

    // Function to reset the stream state
    const resetState = () => {
        message.value = '';
        messageParts.value = [];
    };

    // Function to handle incoming messages
    const handleMessage = (event: MessageEvent) => {
        // Check if this is the end signal
        if (event.data === endSignal || event.data === `data: ${endSignal}`) {
            // Close the connection
            source?.close();

            // Call the onComplete callback if provided
            if (onCompleteCallback) {
                onCompleteCallback();
            }

            return;
        }

        // Clean the data by removing 'data: ' prefix if present
        const cleanData = event.data.startsWith('data: ')
            ? event.data.substring(6) // Remove 'data: ' prefix
            : event.data;

        // Add the cleaned message part to our array
        messageParts.value.push(cleanData);

        // Update the message
        message.value = messageParts.value.join(separator);

        // Call the onMessage callback with the new event if it exists
        if (onMessageCallback) {
            onMessageCallback(event);
        }
    };

    // Function to handle errors
    const handleError = (e: Event) => {
        const err = new Error('EventSource connection error');
        if (onErrorCallback) {
            onErrorCallback(err);
        }
        source?.close();
    };

    // Function to set up the EventSource connection
    const setupConnection = () => {
        // Reset state
        resetState();

        // Create a new EventSource
        source = new EventSource(url);

        // Add event listeners
        source.addEventListener(eventName, handleMessage);
        source.onerror = handleError;
    };

    // Set up the connection when the component is mounted
    onMounted(() => {
        setupConnection();
    });

    // Clean up the connection when the component is unmounted
    onUnmounted(() => {
        if (source) {
            source.removeEventListener(eventName, handleMessage);
            source.close();
            source = null;
        }
    });

    // Watch for changes to the URL and reconnect if it changes
    watch(() => url, (newUrl: string, oldUrl: string) => {
        if (newUrl !== oldUrl) {
            // Close the old connection
            if (source) {
                source.removeEventListener(eventName, handleMessage);
                source.close();
            }

            // Set up a new connection
            setupConnection();
        }
    });

    // Registration functions for handlers
    const onMessage = (callback: (event: MessageEvent) => void) => {
        onMessageCallback = callback;
    };
    const onComplete = (callback: () => void) => {
        onCompleteCallback = callback;
    };
    const onError = (callback: (error: Error) => void) => {
        onErrorCallback = callback;
    };

    // Return readonly refs and the registration functions
    return {
        message: readonly(message),
        messageParts: readonly(messageParts),
        onMessage,
        onComplete,
        onError
    };
}

export default useStream;
