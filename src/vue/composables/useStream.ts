import { ref, onMounted, onUnmounted, watch, readonly } from 'vue';

interface StreamResult {
  message: string;        // The accumulated message
  messageParts: string[]; // Array of individual message parts
  streamComplete: boolean; // Whether the stream has completed
  error: Error | null;    // Any error that occurred
}

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
export function useStream(
  url: string,
  eventName: string = 'update',
  endSignal: string = '</stream>',
  separator: string = ' ',
  callback?: (event: MessageEvent) => void,
  onComplete?: (event: MessageEvent) => void
) {
  // Refs to hold state
  const message = ref('');
  const messageParts = ref<string[]>([]);
  const streamComplete = ref(false);
  const error = ref<Error | null>(null);
  
  // Ref to store the EventSource instance
  let source: EventSource | null = null;
  
  // Ref to store onMessage callback
  let onMessageCallback: ((chunk: string) => void) | null = null;
  
  // Function to set up the EventSource connection
  const setupConnection = () => {
    // Reset state
    message.value = '';
    messageParts.value = [];
    streamComplete.value = false;
    error.value = null;
    
    // Create a new EventSource
    source = new EventSource(url);
    
    // Add event listener for the specified event name
    source.addEventListener(eventName, (event: MessageEvent) => {
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
      
      // Call the onMessage callback with the new chunk if it exists
      if (onMessageCallback) {
        onMessageCallback(cleanData);
      }
      
      // Call the callback with the event data if provided
      if (callback) {
        callback(event);
      }
    });
    
    // Error handling
    source.onerror = (e) => {
      console.error('EventSource error:', e);
      error.value = new Error('EventSource connection error');
      source?.close();
    };
  };
  
  // Set up the connection when the component is mounted
  onMounted(() => {
    setupConnection();
  });
  
  // Clean up the connection when the component is unmounted
  onUnmounted(() => {
    if (source) {
      source.close();
      source = null;
    }
  });
  
  // Watch for changes to the URL and reconnect if it changes
  watch(() => url, (newUrl, oldUrl) => {
    if (newUrl !== oldUrl) {
      // Close the old connection
      if (source) {
        source.close();
      }
      
      // Set up a new connection
      setupConnection();
    }
  });
  
  // Function to set the onMessage callback
  const onMessage = (callback: (chunk: string) => void) => {
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