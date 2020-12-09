require('./env.js');

module.exports = {
  preset: 'ts-jest',
  roots: ['<rootDir>'],
  moduleFileExtensions: [
    'js',
    'jsx',
    'ts',
    'tsx',
    'd.ts',
    'json',
    'node',
  ],
  moduleDirectories: ['__tests__', 'node_modules', '.'],
  moduleNameMapper: {
    src: ['<rootDir>/src/'],
  },
  transform: {
    '^.+\\.(ts|tsx)?$': 'babel-jest',
    '^.+\\.(js|jsx)?$': 'babel-jest',
  },
  testMatch: ['**/*.test.(js|jsx|ts|tsx)'],
  testPathIgnorePatterns: [
    /** Dist Folder */
    '<rootDir>/.next/',
    '<rootDir>/.now/',
    '<rootDir>/_docs/',
    '<rootDir>/out/',
    /** External Services */
    '<rootDir>/.gitlab/',
    '<rootDir>/.firebase/',
    '<rootDir>/functions/',
    '<rootDir>/firestore/',
    /** Deps */
    '<rootDir>/node_modules/',
  ],
  coveragePathIgnorePatterns: [
    /** Dist Folder */
    '<rootDir>/.next/',
    '<rootDir>/.now/',
    '<rootDir>/_docs/',
    '<rootDir>/out/',
    /** External Services */
    '<rootDir>/.gitlab/',
    '<rootDir>/.firebase/',
    '<rootDir>/functions/',
    '<rootDir>/firestore/',
    /** Deps */
    '<rootDir>/node_modules/',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/utils/setup-tests.tsx'],
};
