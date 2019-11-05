// jest.config.js
module.exports = {
    verbose: true,
    debug: true,
    collectCoverage: true,
    collectCoverageFrom: [
        "src/**/*.{ts}",
        "!**/node_modules/**",
        "!**/vendor/**"
      ],
};