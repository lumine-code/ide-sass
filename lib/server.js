const fs = require("fs");
const path = require("path");

// A managed install is an upgrade tier; removing it returns to the pinned
// dependency rather than leaving the adapter without a server.
exports.managedServer = {
  source: "npm",
  displayName: "Sass Language Server",
  packages: ["some-sass-language-server"],
  module: "node_modules/some-sass-language-server/bin/some-sass-language-server",
  bundled: true,
};

exports.resolveServer = async (context, configuredPath) => {
  const selection = await context.resolver.select({
    configuredPath,
    configuredKind: "auto",
    managed: () => {
      const install = context.getManagedServer();
      return install ? { path: install.modulePath, version: install.version } : null;
    },
    bundledPath: () => {
      // 2.3.8 exports a missing node-server.js; its public CLI is intact.
      const entry = require.resolve
        .paths("some-sass-language-server")
        .map((directory) =>
          path.join(directory, "some-sass-language-server", "bin", "some-sass-language-server"),
        )
        .find((candidate) => fs.existsSync(candidate));
      if (!entry) throw new Error("The bundled Sass language server is unavailable.");
      return entry;
    },
    kind: "node",
    allowShellWrapper: true,
  });
  if (!selection) return null;
  return context.resolver.launch(selection, {
    args: ["--stdio"],
    cwd: context.rootPath,
    transport: "stdio",
  });
};
