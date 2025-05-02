import { vi } from "vitest";

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

    let onCompleteHandler: null | (() => void) = null;
    let onErrorHandler: null | ((error: any) => void) = null;

    const onComplete = vi.fn((cb) => {
        onCompleteHandler = cb;
    });

    const onError = vi.fn((cb) => {
        onErrorHandler = cb;
    });

    vi.stubGlobal(
        "EventSource",
        vi.fn().mockImplementation(() => ({
            addEventListener: mockAddEventListener,
            removeEventListener: mockRemoveEventListener,
            close: mockClose,
            set onerror(handler) {
                // Legacy: for direct assignment, not used in new API
                onErrorHandler = handler;
            },
        })),
    );

    return {
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
        close: mockClose,
        // New handlers for test access
        onComplete,
        onError,
        triggerComplete: () => {
            if (onCompleteHandler) {
                onCompleteHandler();
            }
        },
        triggerError: (err = new Error("EventSource connection error")) => {
            if (onErrorHandler) {
                onErrorHandler(err);
            }
        },
    };
};

createEventSourceMock();

global.createEventSourceMock = createEventSourceMock;
