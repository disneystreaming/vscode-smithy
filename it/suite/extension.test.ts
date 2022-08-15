import * as vscode from "vscode";

test("Sample test", () => {
  vscode.window.showInformationMessage("Start all tests.");

  expect([1, 2, 3].indexOf(5)).toEqual(-1);
  expect([1, 2, 3].indexOf(0)).toEqual(-1);
});
