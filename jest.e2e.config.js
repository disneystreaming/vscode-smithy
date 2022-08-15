const path = require("path");

module.exports = {
  moduleFileExtensions: ["js"],
  testMatch: ["<rootDir>/out/it/suite/**.test.js"],
  testEnvironment: "./it/vscode-environment.js",
  verbose: true,
  moduleNameMapper: {
    vscode: path.join(__dirname, "it", "vscode.js"),
  },
};
