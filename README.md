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

