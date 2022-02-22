/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import * as https from 'https';
import * as net from 'net';
import * as fs from "fs";
import * as child_process from "child_process";
import { workspace, ExtensionContext, } from 'vscode';
import * as vscode from 'vscode';

import {
    CancellationToken,
    LanguageClient,
    LanguageClientOptions,
    RequestType,
    StreamInfo,
    TextDocumentIdentifier
} from 'vscode-languageclient';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
    function createServer(): Promise<StreamInfo> {
        function startServer(executable: string): Promise<StreamInfo> {
            console.log(`Executable located at" ${executable}.`)
            return new Promise((resolve, reject) => {
                var server = net.createServer((socket) => {
                    console.log("Creating server");

                    resolve({
                        reader: socket,
                        writer: socket
                    });

                    socket.on('end', () => console.log("Disconnected"));
                }).on('error', (err) => {
                    // handle errors here
                    reject(err);
                });

                // grab a random port.
                server.listen(() => {
                    // Start the child java process
                    let options = { cwd: context.extensionPath };

                    let port = (server.address() as net.AddressInfo).port

                    let version = vscode.workspace.getConfiguration('smithyLsp').get("version", "`")

                    // Downloading latest poms
                    let resolveArgs = ["resolve", "--mode", "force", "com.disneystreaming.smithy:smithy-language-server:" + version, "-r", "m2local"]
                    let resolveProcess = child_process.spawn(executable, resolveArgs, options)
                    resolveProcess.on('exit', exitCode => {
                        console.log("Exit code : " + exitCode)
                        if (exitCode == 0) {
                            console.log("Launching smithy-language-server version:" + version)

                            let launchargs = ["launch", "com.disneystreaming.smithy:smithy-language-server:" + version, "-r", "m2local", "--", port.toString()]

                            let childProcess = child_process.spawn(executable, launchargs, options);

                            childProcess.stdout.on('data', (data) => {
                                console.log(`stdout: ${data}`);
                            });

                            childProcess.stderr.on('data', (data) => {
                                console.error(`stderr: ${data}`);
                            });

                            childProcess.on('close', (code) => {
                                console.log(`LSP exited with code ${code}`);
                            });
                        } else {
                            console.log(`Could not resolve smithy-language-server implementation`)
                        }
                    })

                    // Send raw output to a file
                    if (!fs.existsSync(context.storagePath))
                        fs.mkdirSync(context.storagePath);
                });
            });
        };

        return getCoursier(context.extensionPath)
            .then(binaryPath => startServer(binaryPath))
    };

    // Options to control the language client
    let clientOptions: LanguageClientOptions = {
        // Register the server for plain text documents
        documentSelector: [{ scheme: 'file', language: 'smithy' }, { scheme: 'smithyjar', language: 'smithy' }],
        synchronize: {
            // Notify the server about file changes to 'smithy-build.json' or 'smithy.json' files contained in the workspace
            fileEvents: workspace.createFileSystemWatcher('**/{smithy-build}.json')
        }
    };

    // Create the language client and start the client.

    client = new LanguageClient(
        'smithyLsp',
        'Smithy LSP',
        createServer,
        clientOptions
    );
    const smithyContentProvider = createSmithyContentProvider(client);
    context.subscriptions.push(workspace.registerTextDocumentContentProvider('smithyjar', smithyContentProvider));

    // Start the client. This will also launch the server
    client.start();
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}

function createSmithyContentProvider(languageClient: LanguageClient): vscode.TextDocumentContentProvider {
    return <vscode.TextDocumentContentProvider>{
        provideTextDocumentContent: async (uri: vscode.Uri, token: CancellationToken): Promise<string> => {
            return languageClient.sendRequest(ClassFileContentsRequest.type, { uri: uri.toString() }, token).then((v: string): string => {
                return v || '';
            });
        }
    }
}

function getCoursier(extensionPath: string): Promise<string> {
    function binPath(filename: string) { 
        return path.join(extensionPath, filename);
    }
    const urls = {
        darwin: "https://github.com/coursier/coursier/releases/download/v2.0.6/cs-x86_64-apple-darwin",
        linux: "https://github.com/coursier/coursier/releases/download/v2.0.6/cs-x86_64-pc-linux",
        win32: "https://github.com/coursier/coursier/releases/download/v2.0.6/cs-x86_64-pc-win32.exe"
    }
    const targets = {
        darwin: binPath("coursier"),
        linux: binPath("coursier"),
        win32: binPath("coursier.exe")
    }
    return downloadFile(urls[process.platform], targets[process.platform])
}

function downloadFile(url: string, targetFile: string): Promise<string> {
    function get(url: string, resolve: (res: string) => void, reject: (err: Error) => void) {
        https.get(url, response => {
            if(response.statusCode === 301 || response.statusCode === 302) {
                const newUrl = response.headers.location;
                console.log(`Following redirection to ${newUrl}.`);
                return get(newUrl, resolve, reject)
              } else if (response.statusCode === 200) {
                const file = fs.createWriteStream(targetFile, { flags: "wx", mode: 0o755 });
                response.pipe(file);

                file.on("finish", () => {
                    console.log(`Finished downloaded file at ${targetFile}`);
                    resolve(targetFile);
                });
        
                file.on("error", err => {
                    if (file) {
                        file.close();
                        fs.unlink(targetFile, () => {}); // Delete temp file
                    }
        
                    if (err.code === "EEXIST") {
                        console.log(`File already exists at ${targetFile}`);
                        resolve(targetFile);
                    } else {
                        console.error(`File error while downloading file at ${targetFile}`);
                        console.error(err);
                        reject(err);
                    }
                });
            } else {
                console.log(`OOPS got ${response.statusCode}`);
                reject(new Error(`Server responded with ${response.statusCode}: ${response.statusMessage}`));
            }
        });
    }
    // adapted from https://stackoverflow.com/a/45007624
    return new Promise((resolve, reject) => {
        get(url, resolve, reject)
    });
}

export namespace ClassFileContentsRequest {
    export const type = new RequestType<TextDocumentIdentifier, string, void, void>('smithy/jarFileContents');
}

