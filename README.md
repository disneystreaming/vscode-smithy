# Smithy VS Code extension

[Smithy](https://awslabs.github.io/smithy/) is an open-source protocol-agnostic interface definition language maintained and published by AWS.

This VSCode extension provides syntax coloring and rich editor features when editing .smithy files.

It works by communicating to a language-server published in
https://github.com/disneystreaming/smithy-language-server/

## Installation

## This extension contains:

* Client code to communicate with a [Smithy LSP server](https://github.com/disnenystreaming/smithy-language-server). In particular, this should handle :
	* Jump to definition
	* Diagnostics
	* Basic auto-completion
* Simple grammar for Smithy syntax highlighting


## Smithy build

You can configure your Smithy projects using a Smithy build file.

The name of the file is `smithy-build.json`. This build file is a JSON file has the following structure:

- imports: `Array[String]` - a list of path to directories or file to include in the Smithy model - default: `["$PWD"]`
- mavenDependencies: `Array[String]` - maven dependencies that contains Smithy definitions - default: `[]`
- mavenRepositories: `Array[String]` - maven repositories to fetch mavenDependencies from - default: `m2local` and maven central

An example Smithy build file looks like this:

```json
{
	"imports": ["./specs"],
	"mavenDependencies": ["com.disneystreaming.smithy4s:smithy4s-protocol_2.13:latest.stable"],
	"mavenRepositories": ["https://full.url.to.your.mavenrepository.tld"]
}
```

## Debugging guide

This guide is to help you work on the VS Code extension along with the [Smithy Language Server](https://github.com/awslabs/smithy-language-server).

### Editor

We recommend that you use VS Code to debug the extension. The support exists out of the box.

### Debuging the extension

To start a debug session:

1. Open this project in VS Code
2. In a terminal, launch: `yarn && yarn run watch`. This will start a compile watch loop for the extension sources
3. Open the `src/extension.ts` file and press F5. this launches a new VS Code window with the extension installed and in debug mode.
4. Add debug point in the extesion source.

Note that this extension activates when you open a Smithy file. So to trigger the execution, once you press F5, make sure to open a Smithy file in the `Extension Development Host` VS Code window.

#### Debugging the language server

If you believe the issue exists in the language server rather than the extension itself, you may want to use a Java debugger and attach to the language server.

1. Checkout the code at the link above and cd into it
2. Open the code in your IDE, we suggest IntelliJ because it's the best in class with Java
3. Update the version number in `./VERSION`, and append `-SNAPSHOT`, eg: `0.2.1-SNAPSHOT`
4. In a terminal, launch: `./gradlew -t publishToMavenLocal`. this will publish to your local maven repository (usually somewhere under `~/.m2`) with the following artifact coordinates: `software.amazon.smithy:smithy-language-server:$VERSION`
5. Configure your IDE to use the new language server artifact:
   1. Extension settings: change the `lspCoordinates` value
   2. Per project, via a `smithy-build.json` file that contains: `{"languageServer":"software.amazon.smithy:smithy-language-server:0.2.1-SNAPSHOT"}`

At this point, you should be able to run custom code within the language-server to work on your issue. To have good visibility though, you may want to use `System.out.println`. **Don't**. Instead, use `LspLog.println("message")` and your message will be printed to a file in the directory where the extension is opened. See below for more information on why you should not print to standard out.

If you want to start debugging the JVM, change the Extension settings `lspJavaOpts` and set: `-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005,quiet=y`. The important bit here is: `quiet=y`, because as I've said already, it's important to avoid printing to standard out.

With that, you can reload your VS Code window. At that point, when the extension starts the language server with a debug agent and you'll be able to connect on port `5005`. You can also use `suspend=y` as opposed to `suspend=n` if you have to troubleshoot something in the startup of the language server.

### Known errors:

Error in `Log(Extension Host)` channel:

```
2022-11-17 10:33:51.138 [error] Error: Header must provide a Content-Length property.
	at StreamMessageReader.onData (/Users/David.Francoeur/.vscode/extensions/disneystreaming.smithy-0.0.0/node_modules/vscode-jsonrpc/lib/messageReader.js:163:27)
	at Socket.<anonymous> (/Users/David.Francoeur/.vscode/extensions/disneystreaming.smithy-0.0.0/node_modules/vscode-jsonrpc/lib/messageReader.js:148:18)
	at Socket.emit (node:events:526:28)
	at addChunk (node:internal/streams/readable:315:12)
	at readableAddChunk (node:internal/streams/readable:289:9)
	at Readable.push (node:internal/streams/readable:228:10)
	at Pipe.onStreamRead (node:internal/stream_base_commons:190:23)
```

This happens because the extension exchange with the language server via std in/out of the child process. If any of the code that runs in the language server prints to the standard out, VS Code will complain (unless it is specifically formatted that way).