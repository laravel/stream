import { ref, onMounted, onUnmounted, watch, readonly } from 'vue';
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
export function useStream(url, callback, onComplete, eventName = DEFAULT_EVENT_NAME, endSignal = DEFAULT_END_SIGNAL, separator = DEFAULT_SEPARATOR) {
    // Refs to hold state
    const message = ref('');
    const messageParts = ref([]);
    const streamComplete = ref(false);
    const error = ref(null);
    // Ref to store the EventSource instance
    let source = null;
    // Ref to store onMessage callback
    let onMessageCallback = null;
    // Function to reset the stream state
    const resetState = () => {
        message.value = '';
        messageParts.value = [];
        streamComplete.value = false;
        error.value = null;
    };
    // Function to handle incoming messages
    const handleMessage = (event) => {
        // Check if this is the end signal
        if (event.data === endSignal || event.data === `data: ${endSignal}`) {
            // Close the connection
            source?.close();
            // Update the stream result to indicate completion
            streamComplete.value = true;
            // Call the onComplete callback if provided
            if (onComplete) {
                onComplete(event);
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
        // Call the callback with the event data if provided
        if (callback) {
            callback(event);
        }
    };
    // Function to handle errors
    const handleError = (e) => {
        console.error('EventSource error:', e);
        error.value = new Error('EventSource connection error');
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
    watch(() => url, (newUrl, oldUrl) => {
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
    // Function to set the onMessage callback
    const onMessage = (callback) => {
        onMessageCallback = callback;
    };
    // Return readonly refs and the onMessage function
    return {
        message: readonly(message),
        messageParts: readonly(messageParts),
        streamComplete: readonly(streamComplete),
        error: readonly(error),
        onMessage
    };
}
export default useStream;
