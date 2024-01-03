/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { workspace, ExtensionContext } from "vscode";
import * as vscode from "vscode";

import {
  CancellationToken,
  LanguageClientOptions,
  ParameterStructures,
  RequestType,
  TextDocumentIdentifier,
} from "vscode-languageclient";
import { LanguageClient } from "vscode-languageclient/node";
import { getCoursierExecutable } from "./coursier/coursier";
import { TextDecoder } from "util";

type Organization = string;
type Artifact = string;
type Version = string;
type MavenCoordinate = `${Organization}:${Artifact}:${Version}`;

interface SmithyBuild {
  imports?: Array<string>;
  mavenRepositories?: Array<string>; //deprecated
  mavenDependencies?: Array<string>; //deprecated
  maven?: {
    dependencies?: Array<string>;
    repositories?: Array<{ url: string }>;
  };
  languageServer?: MavenCoordinate;
}

export function activate(context: ExtensionContext) {
  // Options to control the language client
  let clientOptions: LanguageClientOptions = {
    // Register the server for plain text documents
    documentSelector: [
      { scheme: "file", language: "smithy" },
      { scheme: "smithyjar", language: "smithy" },
    ],
    initializationOptions: {
      logToFile: "enabled",
    },
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

  const lspJavaOpt: string | undefined = vscode.workspace
    .getConfiguration("smithyLsp")
    .get("lspJavaOpt");

  const javaOptions: Array<string> = lspJavaOpt
    ? lspJavaOpt.split(" ").flatMap((o) => ["--java-opt", o])
    : [];

  return Promise.all([
    getCoursierExecutable(context.globalStoragePath),
    parseSmithyBuild(),
  ]).then(async ([csBinaryPath, smithyBuild]) => {
    console.info(`Resolved coursier's binary at ${csBinaryPath}`);

    const projectLanguageServerArtifact = smithyBuild?.languageServer;
    const finalLanguageServerArtifact = projectLanguageServerArtifact
      ? projectLanguageServerArtifact
      : `${lspCoordinates}:${version}`;

    const launcher = ["launch", finalLanguageServerArtifact];
    // m2Local is relevant when `gradle` is used to publish locally
    // coursier default resolvers are ivy2Local and maven central at the time of writing
    const coursierOptions = [
      "--ttl",
      "1h",
      "--repository",
      "m2Local",
      // Necessary since the inclusion of Smithy CLI in the LS dependencies
      "--main-class",
      "software.amazon.smithy.lsp.Main",
    ].concat(javaOptions);

    const split = ["--"];
    const lspArguments = ["0"]; // port 0 means we use std in/out to exchange with the language server
    const args = launcher.concat(coursierOptions, split, lspArguments);

    const startServer = { command: csBinaryPath, args };

    let client = new LanguageClient(
      "smithyLsp",
      "Smithy LSP",
      startServer,
      clientOptions
    );

    // Start the client. This will also launch the server.
    await client.start();

    const smithyContentProvider = createSmithyContentProvider(client);

    const registerRestartCommand = vscode.commands.registerCommand(
      "smithyLsp.restart",
      () => {
        client.restart();
      }
    );

    context.subscriptions.push(
      workspace.registerTextDocumentContentProvider(
        "smithyjar",
        smithyContentProvider
      ),
      client,
      registerRestartCommand
    );
  });
}

function parseSmithyBuild(): Thenable<SmithyBuild | null> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length != 1) {
    return Promise.resolve(null);
  } else {
    const root = folders[0].uri;
    const smithyBuildPath = vscode.Uri.parse(`${root}/smithy-build.json`);
    return vscode.workspace.fs
      .readFile(smithyBuildPath)
      .then((uint8array) => new TextDecoder().decode(uint8array))
      .then(
        (content) => JSON.parse(content) as SmithyBuild,
        (err) => {
          console.warn(`Unable to read ${smithyBuildPath}.`, err);
          return null;
        }
      );
  }
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
  export const type = new RequestType<TextDocumentIdentifier, string, void>(
    "smithy/jarFileContents",
    ParameterStructures.auto
  );
}
