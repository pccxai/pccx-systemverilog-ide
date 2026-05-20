// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

export const CHECKED_EXAMPLE_DEFINITION_PROVIDER_ID =
  "pccxSystemVerilog.definitionProvider.checkedExample";

export const CHECKED_EXAMPLE_DEFINITION_SELECTOR = Object.freeze([
  Object.freeze({ language: "systemverilog", scheme: "file" }),
  Object.freeze({ language: "verilog", scheme: "file" }),
  Object.freeze({ scheme: "file", pattern: "**/*.sv" }),
  Object.freeze({ scheme: "file", pattern: "**/*.svh" }),
  Object.freeze({ scheme: "file", pattern: "**/*.v" }),
]);

function locationFromRecord(record) {
  if (record?.location) {
    return record.location;
  }
  if (record?.uri && record?.range) {
    return { uri: record.uri, range: record.range };
  }
  return null;
}

export function checkedExampleDefinitionProvider(options = {}) {
  if (typeof options.runCheckedExampleNavigationLocations !== "function") {
    throw new Error("runCheckedExampleNavigationLocations dependency is required");
  }

  return {
    async provideDefinition(_document, _position, token) {
      if (token?.isCancellationRequested) {
        return [];
      }

      const result = await options.runCheckedExampleNavigationLocations();
      if (!result?.ok || token?.isCancellationRequested) {
        return [];
      }

      return (Array.isArray(result.locations) ? result.locations : [])
        .map(locationFromRecord)
        .filter(Boolean);
    },
  };
}

export function registerCheckedExampleDefinitionProvider(vscodeApi, context, options = {}) {
  const registration = {
    id: CHECKED_EXAMPLE_DEFINITION_PROVIDER_ID,
    selector: CHECKED_EXAMPLE_DEFINITION_SELECTOR,
    active: false,
  };

  if (typeof vscodeApi?.languages?.registerDefinitionProvider !== "function") {
    return registration;
  }

  const provider = checkedExampleDefinitionProvider(options);
  const disposable = vscodeApi.languages.registerDefinitionProvider(
    CHECKED_EXAMPLE_DEFINITION_SELECTOR,
    provider,
  );
  context?.subscriptions?.push?.(disposable);

  return {
    ...registration,
    active: true,
  };
}
