const fs = require("fs");
const os = require("os");
const path = require("path");
const { LiveLspClient, fileUri, position, positionParams } = require("./helpers/live-lsp-client");

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

describe("ide-sass bundled server", () => {
  let adapter, client, disposable, rootPath;
  let originalTimeout;

  beforeAll(() => {
    originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 20000;
  });

  afterAll(() => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
  });

  beforeEach(async () => {
    jasmine.useRealClock();
    await lumine.packages.activatePackage("ide-sass");
    ({ adapter, disposable } = registerAdapter());
    rootPath = fs.mkdtempSync(path.join(os.tmpdir(), "ide-sass-live-"));
    client = new LiveLspClient(adapter, rootPath);
  });

  afterEach(async () => {
    await client.stop();
    disposable.dispose();
    fs.rmSync(rootPath, { recursive: true, force: true });
    await lumine.packages.deactivatePackage("ide-sass");
  });

  it("completes native Sass, preserves positions and provides mixin signature help", async () => {
    const source = "$brand: #ff0000\n.card\n  disp\n  color: $br\n";
    const uri = fileUri(path.join(rootPath, "fixture.sass"));
    fs.writeFileSync(path.join(rootPath, "fixture.sass"), source);
    const { capabilities } = await client.start();
    client.open(uri, "sass", source);
    expect(capabilities.documentFormattingProvider).toBeUndefined();
    expect(capabilities.documentRangeFormattingProvider).toBeUndefined();

    const properties = await client.request("textDocument/completion", positionParams(uri, 2, 6));
    const display = properties.items.find(({ label }) => label === "display");
    expect(display.textEdit.range).toEqual({ start: position(2, 2), end: position(2, 6) });
    expect(display.textEdit.newText).toBe("display: $0");
    expect(display.insertTextFormat).toBe(2);
    expect(display.command.command).toBe("editor.action.triggerSuggest");
    expect(display.documentation.value).toContain("MDN Reference");

    const variables = await client.request("textDocument/completion", positionParams(uri, 3, 12));
    expect(variables.items.map(({ label }) => label)).toContain("$brand");

    client.change(uri, "$brand: #ff0000\n.card\n  display: gr\n  color: $brand\n");
    const values = await client.request("textDocument/completion", positionParams(uri, 2, 13));
    const grid = values.items.find(({ label }) => label === "grid");
    expect(grid.textEdit.newText).toBe("grid");
    const definition = await client.request("textDocument/definition", positionParams(uri, 3, 12));
    expect(definition.range.start.line).toBe(0);

    client.change(uri, ".card:ho\n  color: red\n", 3);
    const pseudo = await client.request("textDocument/completion", positionParams(uri, 0, 8));
    expect(pseudo.items.map(({ label }) => label)).toContain(":hover");

    const mixinSource = [
      "@mixin card($color, $padding: 1rem)",
      "  color: $color",
      ".card",
      "  @include card(red, )",
      "",
    ];
    client.change(uri, mixinSource.join("\n"), 4);
    expect(capabilities.signatureHelpProvider).toBeDefined();
    const signature = await client.request(
      "textDocument/signatureHelp",
      positionParams(uri, 3, mixinSource[3].indexOf(")")),
    );
    expect(signature.signatures[0].label).toBe("card($color, $padding: 1rem)");
    expect(signature.activeParameter).toBe(1);
  });

  it("validates Sass at its original ranges and clears resolved problems", async () => {
    const uri = fileUri(path.join(rootPath, "invalid.sass"));
    const source = ".card\n  colr: red\n";
    fs.writeFileSync(path.join(rootPath, "invalid.sass"), source);
    await client.start();
    client.open(uri, "sass", source);
    const published = await client.waitFor(
      () =>
        client
          .messages("textDocument/publishDiagnostics")
          .find(({ params }) => params.uri === uri && params.diagnostics.length),
      "Sass diagnostics",
    );
    const unknown = published.params.diagnostics.find(({ code }) => code === "unknownProperties");
    expect(unknown.range).toEqual({ start: position(1, 2), end: position(1, 6) });
    expect(unknown.source).toBe("sass");

    client.change(uri, source.replace("colr:", "color:"));
    await client.waitFor(
      () =>
        client
          .messages("textDocument/publishDiagnostics")
          .find(({ params }) => params.uri === uri && params.diagnostics.length === 0),
      "Resolved Sass diagnostics",
    );
  });

  it("completes an unsaved Sass document with an untitled URI and no file on disk", async () => {
    const uri = "untitled:lumine-sass.sass";
    await client.start();
    client.open(uri, "sass", ".card\n  disp\n");

    const properties = await client.request("textDocument/completion", positionParams(uri, 1, 6));
    expect(properties?.items?.map(({ label }) => label) || []).toContain("display");

    client.change(uri, ".card\n  display: gr\n");
    const values = await client.request("textDocument/completion", positionParams(uri, 1, 13));
    expect(values?.items?.map(({ label }) => label) || []).toContain("grid");
    expect(fs.readdirSync(rootPath)).toEqual([]);
  });
});
