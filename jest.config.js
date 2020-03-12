module.exports = {
  clearMocks: true,
  globals: {
    "ts-jest": {
      diagnostics: {
        ignoreCodes: [151001],
      },
    },
  },
  preset: "ts-jest",
  setupFiles: [],
  testPathIgnorePatterns: ["/node_modules/", "/lib/"],
}
