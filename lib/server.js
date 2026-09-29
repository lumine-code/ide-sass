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

exports.resolveServer = async (configuredPath, managed = null) => {
  if (configuredPath) {
    await fs.promises.access(configuredPath, fs.constants.X_OK);
    return { command: configuredPath, args: ["--stdio"] };
  }

  // 2.3.8's package export points at an absent node-server.js. Its public CLI
  // is intact, so find that entry point along Node's normal package paths;
  // this also works when npm hoists the dependency into the editor's tree.
  const serverModule =
    managed?.modulePath ||
    require.resolve
      .paths("some-sass-language-server")
      .map((directory) =>
        path.join(directory, "some-sass-language-server", "bin", "some-sass-language-server"),
      )
      .find((entry) => fs.existsSync(entry));
  if (!serverModule) throw new Error("The bundled Sass language server is unavailable.");

  return {
    command: process.execPath,
    args: [serverModule, "--stdio"],
    env: { ELECTRON_RUN_AS_NODE: "1" },
    version: managed?.version,
  };
};
