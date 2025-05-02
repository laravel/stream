import { vi } from 'vitest';

/**
 * Creates a unified EventSource mock for testing
 * Includes both basic functionality and error handling
 * 
 * @returns {Object} Mock implementation with event handler and error handler access
 */
const createEventSourceMock = () => {
    const mockAddEventListener = vi.fn();
    const mockRemoveEventListener = vi.fn();
    const mockClose = vi.fn();

    // Handlers for our new API
    let onCompleteHandler = null;
    let onErrorHandler = null;

    // Simulate registration functions
    const onComplete = vi.fn(cb => { onCompleteHandler = cb; });
    const onError = vi.fn(cb => { onErrorHandler = cb; });

    // Create the mock
    vi.stubGlobal('EventSource', vi.fn().mockImplementation(() => ({
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
        close: mockClose,
        set onerror(handler) {
            // Legacy: for direct assignment, not used in new API
            onErrorHandler = handler;
        }
    })));

    return {
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
        close: mockClose,
        // New handlers for test access
        onComplete,
        onError,
        triggerComplete: () => { if (onCompleteHandler) onCompleteHandler(); },
        triggerError: (err = new Error('EventSource connection error')) => { if (onErrorHandler) onErrorHandler(err); }
    };
};

// Initialize the EventSource mock
createEventSourceMock();

// Export the mock creator for use in tests
global.createEventSourceMock = createEventSourceMock;