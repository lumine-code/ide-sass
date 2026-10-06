# ide-sass

Indented Sass language-server adapter.

Registers [Some Sass](https://github.com/wkillerud/some-sass) with the `ide` package, providing completion, validation, documentation, signature help, navigation, refactoring, colors, links, folding, and selection ranges for indented Sass.

## Features

- **Bundled server**: ships an exact server version, with an optional custom executable path.
- **Managed upgrade**: installs a newer server from npm, and removing it returns to the bundled copy.
- **Native syntax**: serves indented Sass with the native `sass` language ID and preserves document positions.
- **Completion**: suggests properties, values, pseudo-selectors, variables, mixins, and functions without adding semicolons.
- **Validation**: reports syntax and configurable lint problems through LSP diagnostics.
- **Documentation**: shows CSS and Sass documentation, SassDoc, and parameter hints for functions and mixins.
- **Navigation and refactoring**: finds definitions and references and renames Sass symbols.
- **Document tools**: provides document and workspace symbols, import links, colors, highlights, folding, and selection ranges.
- **Feature switches**: each editor-facing capability can be handed to another language server serving the same file.

## Installation

To install `ide-sass` search for it in the Install pane of the Lumine settings, or run the command `lumine --install lumine-code/ide-sass`.

Install `ide` first.

## Usage

The adapter serves `.sass` files and unsaved editors with the indented Sass grammar. CSS, SCSS, and Less are served by `ide-css`. Some Sass does not provide formatting.

One server starts lazily per project root when the first supported editor opens.

## Services

- `ide`: consumed to register the indented Sass adapter with the editor's language-server client.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
