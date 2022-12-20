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

  const lspJavaOpt: string | undefined = vscode.workspace
    .getConfiguration("smithyLsp")
    .get("lspJavaOpt");

  const javaOptions: Array<string> = lspJavaOpt
    ? lspJavaOpt.split(" ").flatMap((o) => ["--java-opt", o])
    : [];

  return Promise.all([
    getCoursierExecutable(context.globalStoragePath),
    parseSmithyBuild(), registerFormatter()
  ]).then(([csBinaryPath, smithyBuild]) => {
    console.info(`Resolved coursier's binary at ${csBinaryPath}`);

    const projectLanguageServerArtifact = smithyBuild?.languageServer;
    const finalLanguageServerArtifact = projectLanguageServerArtifact
      ? projectLanguageServerArtifact
      : `${lspCoordinates}:${version}`;

    const launcher = ["launch", finalLanguageServerArtifact];
    // m2Local is relevant when `gradle` is used to publish locally
    // coursier default resolvers are ivy2Local and maven central at the time of writing
    const coursierOptions = ["--ttl", "1h", "--repository", "m2Local"].concat(
      javaOptions
    );
    const split = ["--"];
    const lspArguments = ["0"]; // port 0 means we use std in/out to exchange with the language server
    const args = launcher.concat(coursierOptions, split, lspArguments);

    const startServer = { command: csBinaryPath, args };

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
      ),
      // Start the client. This will also launch the server
      client.start()
    );
  });
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}

function fixWhitespace(line: string) {

  const tooMuchWhiteSpace = /:\s{2,}/
  const notEnoughWhiteSpace = /:\w+/
  if (tooMuchWhiteSpace.test(line)) {
    return line.replace(tooMuchWhiteSpace, ": ")
  }
  else if (notEnoughWhiteSpace.test(line)) {
    return line.replace(':', ": ")
  } else
    return line
}

function registerFormatter() {
  vscode.languages.registerDocumentFormattingEditProvider('smithy', {
    provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
      let ret = []
      let indentation = 0
      for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i)
        if (line.isEmptyOrWhitespace)
          continue
        const correctWhiteSpace = fixWhitespace(line.text)

        if (line.text.includes('}')) // this is here because we want to unindent a single closed curly brace
          indentation--
        const indented = "\t".repeat(indentation)
        const newLine = correctWhiteSpace.replace(/^\s+/, indented)
        ret.push(vscode.TextEdit.replace(line.range, newLine))

        if (line.text.includes('{'))
          indentation++

      }
      return ret
    }
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
  export const type = new RequestType<
    TextDocumentIdentifier,
    string,
    void,
    void
  >("smithy/jarFileContents");
}
