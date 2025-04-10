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
  let errorHandler = null;
  
  // Create the mock
  vi.stubGlobal('EventSource', vi.fn().mockImplementation(() => ({
    addEventListener: mockAddEventListener,
    removeEventListener: mockRemoveEventListener,
    close: mockClose,
    set onerror(handler) {
      errorHandler = handler;
    }
  })));
  
  return {
    addEventListener: mockAddEventListener,
    removeEventListener: mockRemoveEventListener,
    close: mockClose,
    errorHandler: () => errorHandler
  };
};

// Initialize the EventSource mock
createEventSourceMock();

// Export the mock creator for use in tests
global.createEventSourceMock = createEventSourceMock;