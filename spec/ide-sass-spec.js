const { serverContext } = require("./helpers/server-context");
const fs = require("fs");
const { resolveServer: resolveServerWithContext, managedServer } = require("../lib/server");
const resolveServer = (configuredPath, managedServer = null) =>
  resolveServerWithContext(serverContext({ rootPath: __dirname, managedServer }), configuredPath);

const registerAdapter = () => {
  let adapter;
  const main = lumine.packages.getActivePackage("ide-sass").mainModule;
  const disposable = main.consumeIdeClient({
    registerAdapter(registered) {
      adapter = registered;
      return { dispose() {} };
    },
  });
  return { adapter, disposable };
};

describe("ide-sass server resolution", () => {
  it("prefers the configured executable", async () => {
    const launch = await resolveServer(process.execPath);
    expect(launch.command).toBe(process.execPath);
    expect(launch.args).toEqual(["--stdio"]);
  });

  it("launches the bundled public CLI despite the broken upstream package export", async () => {
    const launch = await resolveServer("");
    expect(launch.command).toBe(process.execPath);
    expect(fs.existsSync(launch.args[0])).toBe(true);
    expect(launch.args[0]).toMatch(
      /some-sass-language-server[/\\]bin[/\\]some-sass-language-server$/,
    );
    expect(launch.args[1]).toBe("--stdio");
    expect(launch.env.ELECTRON_RUN_AS_NODE).toBe("1");
  });

  it("prefers a managed upgrade and preserves the configured-path override", async () => {
    const managed = { modulePath: (await resolveServer("")).args[0], version: "9.9.9" };
    const launch = await resolveServer("", managed);
    expect(launch.args[0]).toBe(managed.modulePath);
    expect(launch.version).toBe(managed.version);
    expect((await resolveServer(process.execPath, managed)).command).toBe(process.execPath);
    expect(managedServer.source).toBe("npm");
    expect(managedServer.bundled).toBe(true);
    expect(managedServer.packages).toEqual(["some-sass-language-server"]);
  });
});

describe("ide-sass adapter", () => {
  let adapter, disposable;

  beforeEach(async () => {
    await lumine.packages.activatePackage("ide-sass");
    ({ adapter, disposable } = registerAdapter());
  });

  afterEach(async () => {
    disposable.dispose();
    await lumine.packages.deactivatePackage("ide-sass");
  });

  it("registers only indented Sass with its own settings and managed-server identity", async () => {
    expect(adapter.id).toBe("ide-sass");
    expect(adapter.grammarScopes).toEqual(["source.sass"]);
    expect(adapter.languageId).toBe("sass");
    expect(adapter.sessionScope).toBe("project-root");
    expect(adapter.settingsKeyPaths).toEqual(["ide-sass"]);
    expect(adapter.restartKeyPaths).toEqual(["ide-sass.serverPath"]);
    expect(adapter.managedServer.packages).toEqual(["some-sass-language-server"]);
    const launch = await adapter.resolveServer(serverContext({ rootPath: __dirname }));
    expect(launch.cwd).toBe(__dirname);
    expect(launch.transport).toBe("stdio");
  });

  it("forwards validation, completion, lint and documentation settings", () => {
    lumine.config.set("ide-sass.completion.triggerPropertyValueCompletion", false);
    lumine.config.set("ide-sass.hover.references", false);
    lumine.config.set("ide-sass.lint.unknownProperties", "error");
    lumine.config.set("ide-sass.lint.validProperties", ["custom-prop"]);
    const settings = adapter.getWorkspaceConfiguration("somesass").sass;
    expect(settings.diagnostics.enabled).toBe(true);
    expect(settings.diagnostics.lint.enabled).toBe(true);
    expect(settings.diagnostics.lint.unknownProperties).toBe("error");
    expect(settings.diagnostics.lint.validProperties).toEqual(["custom-prop"]);
    expect(settings.completion.triggerPropertyValueCompletion).toBe(false);
    expect(settings.hover.references).toBe(false);
    expect(adapter.getSettings().somesass.sass).toEqual(settings);
    expect(adapter.getWorkspaceConfiguration()).toEqual(adapter.getSettings());
    expect(adapter.getWorkspaceConfiguration("editor")).toEqual({});
    expect(adapter.getWorkspaceConfiguration("unknown")).toBeUndefined();
  });

  it("preserves grammar-scoped diagnostic overrides", () => {
    lumine.config.set("ide-sass.features.diagnostics", false);
    expect(adapter.getSettings().somesass.sass.diagnostics.enabled).toBe(false);
    lumine.config.set("ide-sass.features.diagnostics", true, { scopeSelector: ".source.sass" });
    expect(adapter.getSettings().somesass.sass.diagnostics.enabled).toBe(true);
  });

  it("returns the single adapter registration's disposable", () => {
    const main = lumine.packages.getActivePackage("ide-sass").mainModule;
    const registration = { dispose: jasmine.createSpy("dispose") };
    const service = {
      registerAdapter: jasmine.createSpy("registerAdapter").and.returnValue(registration),
    };
    const result = main.consumeIdeClient(service);
    expect(service.registerAdapter).toHaveBeenCalledTimes(1);
    expect(result).toBe(registration);
    result.dispose();
    expect(registration.dispose).toHaveBeenCalledTimes(1);
  });

  it("offers only the editor capabilities supported by the Sass server", () => {
    const { configSchema } = require("../package.json");
    expect(Object.keys(configSchema.features.properties)).toEqual([
      "diagnostics",
      "autocomplete",
      "hover",
      "signature",
      "definition",
      "references",
      "symbols",
      "rename",
      "codeActions",
    ]);
    expect(configSchema.customData).toBeUndefined();
    expect(configSchema.languages).toBeUndefined();
    expect(configSchema.completion.properties.completePropertyWithSemicolon).toBeUndefined();
  });

  it("describes every setting and keeps package metadata consistent", () => {
    const pkg = require("../package.json");
    const missing = [];
    const visit = (value, keyPath = "") => {
      if (value?.title && !value.description) missing.push(keyPath);
      for (const [key, child] of Object.entries(value?.properties || {}))
        visit(child, keyPath ? `${keyPath}.${key}` : key);
    };
    visit({ properties: pkg.configSchema });
    expect(missing).toEqual([]);
    expect(pkg.description).toBe("Indented Sass language-server adapter.");
    expect(pkg.dependencies).toEqual({ "some-sass-language-server": "2.3.8" });
    expect(pkg.keywords.some((keyword) => pkg.name.includes(keyword))).toBe(false);
  });
});

describe("ide-sass feature contracts", () => {
  const features = [
    "diagnostics",
    "autocomplete",
    "hover",
    "signature",
    "definition",
    "references",
    "symbols",
    "rename",
    "codeActions",
  ];
  const definitions = require("../package.json").configSchema.features.properties;

  beforeEach(async () => {
    await lumine.packages.activatePackage("ide-sass");
  });

  afterEach(async () => {
    for (const feature of features) lumine.config.unset(`ide-sass.features.${feature}`);
    await lumine.packages.deactivatePackage("ide-sass");
  });

  for (const feature of features) {
    it(`exposes ${feature} as an independent enabled-by-default switch`, () => {
      expect(definitions[feature].type).toBe("boolean");
      expect(definitions[feature].default).toBe(true);
      const keyPath = `ide-sass.features.${feature}`;
      expect(lumine.config.get(keyPath)).toBe(true);
      lumine.config.set(keyPath, false);
      expect(lumine.config.get(keyPath)).toBe(false);
    });
  }
});

describe("ide-sass shared server resolution", () => {
  it("preserves an unavailable selection as null", async () => {
    const { resolveServer: resolveWithContext } = require("../lib/server");
    const resolver = { select: jasmine.createSpy("select").and.resolveTo(null) };
    expect(await resolveWithContext({ rootPath: __dirname, resolver }, "")).toBeNull();
  });
});
