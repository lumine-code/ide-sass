const { resolveServer, managedServer } = require("./server");

const setting = (key, scope) =>
  scope
    ? lumine.config.get(`ide-sass.${key}`, { scope: [scope] })
    : lumine.config.get(`ide-sass.${key}`);

const lintSettings = () => ({
  compatibleVendorPrefixes: setting("lint.compatibleVendorPrefixes"),
  vendorPrefix: setting("lint.vendorPrefix"),
  duplicateProperties: setting("lint.duplicateProperties"),
  emptyRules: setting("lint.emptyRules"),
  importStatement: setting("lint.importStatement"),
  boxModel: setting("lint.boxModel"),
  universalSelector: setting("lint.universalSelector"),
  zeroUnits: setting("lint.zeroUnits"),
  fontFaceProperties: setting("lint.fontFaceProperties"),
  hexColorLength: setting("lint.hexColorLength"),
  argumentsInColorFunction: setting("lint.argumentsInColorFunction"),
  unknownProperties: setting("lint.unknownProperties"),
  unknownAtRules: setting("lint.unknownAtRules"),
  ieHack: setting("lint.ieHack"),
  unknownVendorSpecificProperties: setting("lint.unknownVendorSpecificProperties"),
  propertyIgnoredDueToDisplay: setting("lint.propertyIgnoredDueToDisplay"),
  important: setting("lint.important"),
  float: setting("lint.float"),
  idSelector: setting("lint.idSelector"),
  validProperties: setting("lint.validProperties") || [],
});

const serverSettings = () => ({
  sass: {
    diagnostics: {
      enabled: setting("features.diagnostics", "source.sass"),
      lint: { enabled: true, ...lintSettings() },
    },
    completion: {
      triggerPropertyValueCompletion: setting("completion.triggerPropertyValueCompletion"),
    },
    hover: {
      documentation: setting("hover.documentation"),
      references: setting("hover.references"),
    },
  },
});

module.exports = {
  consumeIdeClient(service) {
    const adapter = {
      id: "ide-sass",
      displayName: "Sass Language Server",
      grammarScopes: ["source.sass"],
      languageId: "sass",
      sessionScope: "project-root",
      settingsKeyPaths: ["ide-sass"],
      restartKeyPaths: ["ide-sass.serverPath"],
      managedServer,
      async resolveServer(context) {
        const launch = await resolveServer(setting("serverPath"), context.managedServer);
        return { ...launch, cwd: context.rootPath, transport: "stdio" };
      },
      getSettings() {
        return { somesass: serverSettings() };
      },
      getWorkspaceConfiguration(section) {
        if (!section) return { somesass: serverSettings() };
        if (section === "somesass") return serverSettings();
        if (section === "editor") return {};
        return undefined;
      },
    };

    return service.registerAdapter(adapter);
  },
};
