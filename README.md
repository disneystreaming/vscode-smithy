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

You can configure your Smithy projects using a Smithy build file. This build file is a JSON file has the following structure:

- imports: `Array[String]` - ???
- mavenDependencies: `Array[String]` - maven dependencies that contains Smithy definitions
- mavenRepositories: `Array[String]` - maven repositories to fetch mavenDependencies from

An example Smithy build file looks like this:

```json
{
	"imports": [""],
	"mavenDependencies": ["com.disneystreaming.smithy4s:smithy4s-protocol_2.13:latest.stable"],
	"mavenRepositories": ["https://full.url.to.your.mavenrepository.tld"]
}
```
