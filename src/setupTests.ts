Object.defineProperty(window, 'electron', {
  value: {
    recommendation: {
      getModels: jest.fn().mockResolvedValue({}),
    },
    modelManagement: {
      getModelList: jest.fn().mockResolvedValue([]),
    },
    runtime: {
      getStatus: jest.fn().mockResolvedValue({}),
    },
    settings: {
      get: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue(true),
    },
    semantic: {
      getStatus: jest.fn().mockResolvedValue({}),
    },
  },
  writable: true,
});
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // Deprecated
    removeListener: jest.fn(), // Deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});
Object.assign(window.electron, {
  transcription: {
    onStatus: jest.fn(() => jest.fn()),
    onPartial: jest.fn(() => jest.fn()),
    getStatus: jest.fn().mockResolvedValue({}),
  },
  ipcRenderer: {
    on: jest.fn(),
    once: jest.fn(),
    removeListener: jest.fn(),
    sendMessage: jest.fn(),
  },
  store: {
    get: jest.fn(),
    set: jest.fn(),
  },
  app: {
    getVersion: jest.fn().mockResolvedValue('1.0.0'),
  },
});
Object.assign(window.electron, {
  agent: {
    onEvent: jest.fn(() => jest.fn()),
  },
});
Object.assign(window.electron, {
  workspace: {
    getList: jest.fn().mockResolvedValue([]),
    get: jest.fn().mockResolvedValue(null),
  },
});
