import type {
  ComponentArrayItemField,
  ComponentDefinition,
  ComponentPropSchema,
} from "#content/types/builder";

export type FixedBodyPath = string;

type MinimalBodyEntry = unknown;
type PathSegment = string | number;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isComponentEntry = (value: unknown): value is [string, Record<string, unknown>, ...unknown[]] =>
  Array.isArray(value) &&
  typeof value[0] === "string" &&
  isPlainObject(value[1]);

const isNestedArrayField = (
  field: ComponentArrayItemField,
): field is Extract<ComponentArrayItemField, { type: "jsonarray" }> =>
  field.type === "jsonarray";

const isObjectField = (
  field: ComponentArrayItemField,
): field is Extract<ComponentArrayItemField, { type: "jsonobject" }> =>
  field.type === "jsonobject";

const escapePathSegment = (segment: PathSegment): string =>
  String(segment).replace(/~/g, "~0").replace(/\//g, "~1");

const toPointer = (segments: PathSegment[]): string =>
  `/${segments.map((segment) => escapePathSegment(segment)).join("/")}`;

const propShouldBeSkipped = (key: string): boolean =>
  key.startsWith("__builder") || key.startsWith("__content");

const parseSerializedPropValue = (value: unknown): unknown => {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const collectFixedValuePaths = (
  value: unknown,
  schema: ComponentPropSchema | ComponentArrayItemField | undefined,
  inheritedLocalized: boolean,
  path: PathSegment[],
  output: Set<FixedBodyPath>,
) => {
  const localized = inheritedLocalized || Boolean(schema?.localized);
  if (localized) {
    return;
  }

  const type = schema?.type;

  if (type === "jsonobject") {
    if (!isPlainObject(value)) {
      output.add(toPointer(path));
      return;
    }

    const fields = schema.fields ?? [];
    if (!fields.length) {
      output.add(toPointer(path));
      return;
    }

    const fieldsByKey = new Map(fields.map((field) => [field.key, field]));
    const keys = new Set<string>([
      ...Object.keys(value),
      ...fields.map((field) => field.key),
    ]);

    for (const key of keys) {
      collectFixedValuePaths(
        (value as Record<string, unknown>)[key],
        fieldsByKey.get(key),
        localized,
        [...path, key],
        output,
      );
    }

    return;
  }

  if (type === "jsonarray") {
    if (!Array.isArray(value)) {
      output.add(toPointer(path));
      return;
    }

    const fields = schema.items ?? [];
    if (!fields.length) {
      output.add(toPointer(path));
      return;
    }

    const fieldsByKey = new Map(fields.map((field) => [field.key, field]));

    value.forEach((item, itemIndex) => {
      if (!isPlainObject(item)) {
        output.add(toPointer([...path, itemIndex]));
        return;
      }

      const keys = new Set<string>([
        ...Object.keys(item),
        ...fields.map((field) => field.key),
      ]);

      for (const key of keys) {
        collectFixedValuePaths(
          (item as Record<string, unknown>)[key],
          fieldsByKey.get(key),
          localized,
          [...path, itemIndex, key],
          output,
        );
      }
    });

    return;
  }

  output.add(toPointer(path));
};

export const buildComponentDefinitionLookup = (
  definitions: ComponentDefinition[],
): Record<string, ComponentDefinition> => {
  const lookup: Record<string, ComponentDefinition> = {};

  for (const definition of definitions) {
    if (!definition?.id) {
      continue;
    }
    lookup[definition.id] = definition;
  }

  return lookup;
};

export const collectFixedBodyPaths = (
  bodyValue: MinimalBodyEntry[],
  definitionLookup: Record<string, ComponentDefinition>,
): FixedBodyPath[] => {
  const fixedPaths = new Set<FixedBodyPath>();

  const visitEntry = (entry: unknown, basePath: PathSegment[]) => {
    if (typeof entry === "string") {
      // Plain minimark text nodes are localizable by default.
      return;
    }

    if (!isComponentEntry(entry)) {
      return;
    }

    const componentId = entry[0];
    const rawProps = entry[1];
    const children = entry.slice(2);

    const definition = definitionLookup[componentId];
    const schemaByKey = new Map(
      (definition?.props ?? []).map((schema) => [schema.key, schema]),
    );

    for (const [rawPropKey, rawPropValue] of Object.entries(rawProps)) {
      if (propShouldBeSkipped(rawPropKey)) {
        continue;
      }

      const normalizedPropKey = rawPropKey.startsWith(":")
        ? rawPropKey.slice(1)
        : rawPropKey;
      const propKey = normalizedPropKey || rawPropKey;
      const propValue = rawPropKey.startsWith(":")
        ? parseSerializedPropValue(rawPropValue)
        : rawPropValue;

      collectFixedValuePaths(
        propValue,
        schemaByKey.get(propKey),
        false,
        [...basePath, 1, propKey],
        fixedPaths,
      );
    }

    children.forEach((child, childIndex) => {
      visitEntry(child, [...basePath, childIndex + 2]);
    });
  };

  if (!Array.isArray(bodyValue)) {
    return [];
  }

  bodyValue.forEach((entry, index) => {
    visitEntry(entry, [index]);
  });

  return Array.from(fixedPaths).sort();
};

export const collectFixedBodyPathsFromDefinitions = (
  bodyValue: unknown,
  definitions: ComponentDefinition[],
): FixedBodyPath[] => {
  return collectFixedBodyPaths(
    Array.isArray(bodyValue) ? bodyValue : [],
    buildComponentDefinitionLookup(definitions),
  );
};
