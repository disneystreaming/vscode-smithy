/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { workspace, ExtensionContext } from "vscode";
import * as vscode from "vscode";
import { SmithyFormatter } from "smithy-formatter-api";

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
    parseSmithyBuild(),
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

    const formatterChannel = vscode.window.createOutputChannel(
      "smithy-fmt",
      "smithy"
    );
    context.subscriptions.push(formatterChannel);

    const smithyContentProvider = createSmithyContentProvider(client);
    context.subscriptions.push(
      workspace.registerTextDocumentContentProvider(
        "smithyjar",
        smithyContentProvider
      ),
      // Start the client. This will also launch the server
      client.start()
    );

    context.subscriptions.push(
      vscode.languages.registerDocumentFormattingEditProvider(
        { language: "smithy" },
        {
          provideDocumentFormattingEdits(
            document: vscode.TextDocument
          ): vscode.TextEdit[] {
            var firstLine = document.lineAt(0);
            var lastLine = document.lineAt(document.lineCount - 1);
            var textRange = new vscode.Range(
              firstLine.range.start,
              lastLine.range.end
            );
            const content = document.getText();
            const newContent = SmithyFormatter.format(content);
            if (newContent.error) {
              vscode.window.showErrorMessage(
                "No formatting was applied, the formatter failed to parse the file."
              );
              formatterChannel.append(newContent.error);
              return [];
            } else {
              return [vscode.TextEdit.replace(textRange, newContent.value)];
            }
          },
        }
      )
    );
  });
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
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
