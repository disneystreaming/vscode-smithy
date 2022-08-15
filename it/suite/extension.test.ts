import * as path from "path";
import { setTimeout } from "timers/promises";
import * as vscode from "vscode";

import { extensionId } from "./../../src/constants";

const testTimeout = 20 * 1000;

test(
  "Sample test",
  () => {
    const file = path.join(process.cwd(), "it/suite/weather.smithy");
    // this activates the extension
    const openSmithyFile = vscode.workspace.openTextDocument(
      vscode.Uri.file(file)
    );

    return openSmithyFile
      .then(() => waitActive(timeout(testTimeout)))
      .then((active) => expect(active).toBeTruthy());
  },
  testTimeout + 1000
);

function getExt(): vscode.Extension<any> {
  return vscode.extensions.getExtension(extensionId);
}

function timeout(ms: number): number {
  return Date.now() + ms;
}

function waitActive(expired: number): Promise<boolean> {
  const ext = getExt();
  const isActive = ext ? ext.isActive : false;
  if (isActive) {
    return Promise.resolve(true);
  } else if (Date.now() > expired) {
    return Promise.resolve(false);
  } else {
    const delayMs = 1000;
    console.log(`Retrying active check in ${delayMs} ms.`);
    return setTimeout(1000).then(() => waitActive(expired));
  }
}
