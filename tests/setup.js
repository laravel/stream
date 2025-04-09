import { vi } from 'vitest';

// tests/setup.js
class MockEventSource {
    constructor() {
      this.addEventListener = vi.fn();
      this.removeEventListener = vi.fn();
      this.close = vi.fn();
    }
  }
  
  // Add EventSource to the global object
  global.EventSource = MockEventSource;