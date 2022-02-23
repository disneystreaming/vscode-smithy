/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from "path";
import * as net from "net";
import * as fs from "fs";
import * as child_process from "child_process";
import {
  workspace,
  ExtensionContext,
  TextDocument,
  DefinitionLink,
  DocumentSelector,
} from "vscode";
import * as vscode from "vscode";

import {
  CancellationToken,
  Definition,
  DefinitionRequest,
  DefinitionParams,
  LanguageClient,
  LanguageClientOptions,
  Position,
  RequestType,
  StreamInfo,
  Location,
  LocationLink,
  TextDocumentIdentifier,
} from "vscode-languageclient";
import { Address } from "cluster";
import { exit, exitCode } from "process";

let client: LanguageClient;

interface Resolution {
  artifacts: Array<string>;
}

export function activate(context: ExtensionContext) {
  function createServer(): Promise<StreamInfo> {
    let smithyJsonPath = path.join(
      vscode.workspace.workspaceFolders[0].uri.path,
      "smithy.json"
    );

    let resolution: Resolution = fs.existsSync(smithyJsonPath)
      ? JSON.parse(fs.readFileSync(smithyJsonPath, "utf8"))
      : { artifacts: [] };

    return new Promise((resolve, reject) => {
      var server = net
        .createServer((socket) => {
          console.log("Creating server");

          resolve({
            reader: socket,
            writer: socket,
          });

          socket.on("end", () => console.log("Disconnected"));
        })
        .on("error", (err) => {
          // handle errors here
          throw err;
        });

      // grab a random port.
      server.listen(() => {
        // Start the child java process
        let options = { cwd: context.extensionPath };
        let launcherPath = context.extensionPath + "/coursier";

        let port = (server.address() as net.AddressInfo).port;

        let version = vscode.workspace
          .getConfiguration("smithyLsp")
          .get("version", "`");

        // Downloading latest poms
        let resolveArgs = [
          "resolve",
          "--mode",
          "force",
          "com.disneystreaming.smithy:smithy-language-server:" + version,
          "-r",
          "m2local",
        ];
        let resolveProcess = child_process.spawn(
          launcherPath,
          resolveArgs,
          options
        );
        resolveProcess.on("exit", (exitCode) => {
          console.log("Exit code : " + exitCode);
          if (exitCode == 0) {
            console.log("Launching smithy-language-server version:" + version);

            let launchargs = [
              "launch",
              "com.disneystreaming.smithy:smithy-language-server:" + version,
              "-r",
              "m2local",
              "--",
              port.toString(),
            ];

            let childProcess = child_process.spawn(
              launcherPath,
              launchargs,
              options
            );

            childProcess.stdout.on("data", (data) => {
              console.log(`stdout: ${data}`);
            });

            childProcess.stderr.on("data", (data) => {
              console.error(`stderr: ${data}`);
            });

            childProcess.on("close", (code) => {
              console.log(`LSP exited with code ${code}`);
            });
          } else {
            console.log(
              `Could not resolve smithy-language-server implementation`
            );
          }
        });

        // Send raw output to a file
        if (!fs.existsSync(context.storagePath))
          fs.mkdirSync(context.storagePath);
      });
    });
  }

  // Options to control the language client
  let clientOptions: LanguageClientOptions = {
    // Register the server for plain text documents
    documentSelector: [
      { scheme: "file", language: "smithy" },
      { scheme: "smithyjar", language: "smithy" },
    ],
    synchronize: {
      // Notify the server about file changes to 'smithy-build.json' or 'smithy.json' files contained in the workspace
      fileEvents: workspace.createFileSystemWatcher(
        "**/{smithy-build, smithy}.json"
      ),
    },
  };

  // Create the language client and start the client.

  client = new LanguageClient(
    "smithyLsp",
    "Smithy LSP",
    createServer,
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
