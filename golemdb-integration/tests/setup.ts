// Test setup file
// Increase timeout for tests that involve network calls
jest.setTimeout(30000);

// Mock environment variables
process.env.PRIVATE_KEY = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
process.env.LOG_LEVEL = 'error';