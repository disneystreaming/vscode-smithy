/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { workspace, ExtensionContext } from "vscode";
import * as vscode from "vscode";

import {
  CancellationToken,
  LanguageClient,
  LanguageClientOptions,
  RequestType,
  TextDocumentIdentifier,
} from "vscode-languageclient";
import { getCoursierExecutable } from "./coursier/coursier";

let client: LanguageClient;

export function activate(context: ExtensionContext) {
  // Options to control the language client
  let clientOptions: LanguageClientOptions = {
    // Register the server for plain text documents
    documentSelector: [
      { scheme: "file", language: "smithy" },
      { scheme: "smithyjar", language: "smithy" },
    ],
    synchronize: {
      // Notify the server about file changes to 'smithy-build.json' files contained in the workspace
      fileEvents: workspace.createFileSystemWatcher("**/{smithy-build}.json"),
    },
  };

  // Create the language client and start the client.

  const version = vscode.workspace
    .getConfiguration("smithyLsp")
    .get("version", "`");

  const lspCoordinates = vscode.workspace
    .getConfiguration("smithyLsp")
    .get("lspCoordinates", "`");

  return getCoursierExecutable(context.globalStoragePath).then(
    (csBinaryPath) => {
      console.info(`Resolved coursier's binary at ${csBinaryPath}`);

      const startServer = {
        command: csBinaryPath,
        args: ["launch", `${lspCoordinates}:${version}`, "--", "0"],
      };

      client = new LanguageClient(
        "smithyLsp",
        "Smithy LSP",
        startServer,
        clientOptions
      );

      const smithyContentProvider = createSmithyContentProvider(client);
      context.subscriptions.push(
        workspace.registerTextDocumentContentProvider(
          "smithyjar",
          smithyContentProvider
        )
      );

      // Start the client. This will also launch the server
      client.start();
    }
  );
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}

function createSmithyContentProvider(
  languageClient: LanguageClient
): vscode.TextDocumentContentProvider {
  return <vscode.TextDocumentContentProvider>{
    provideTextDocumentContent: async (
      uri: vscode.Uri,
      token: CancellationToken
    ): Promise<string> => {
      return languageClient
        .sendRequest(
          ClassFileContentsRequest.type,
          { uri: uri.toString() },
          token
        )
        .then((v: string): string => {
          return v || "";
        });
    },
  };
}

export namespace ClassFileContentsRequest {
  export const type = new RequestType<
    TextDocumentIdentifier,
    string,
    void,
    void
  >("smithy/jarFileContents");
}
