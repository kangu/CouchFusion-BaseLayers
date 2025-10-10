export type BuilderValuePrimitive = string | number | boolean;

export type BuilderValue =
  | BuilderValuePrimitive
  | BuilderValuePrimitive[]
  | Record<string, any>
  | Array<Record<string, any>>;

export type ComponentFieldType =
  | 'text'
  | 'textarea'
  | 'boolean'
  | 'select'
  | 'json'
  | 'jsonarray'
  | 'stringarray'
  | 'number';

export interface ComponentFieldUiConfig {
  component?: string;
  widget?: string;
  [key: string]: unknown;
}

export interface ComponentArrayItemFieldBase {
  key: string;
  label: string;
  description?: string;
  ui?: ComponentFieldUiConfig;
}

export interface ComponentArrayPrimitiveField extends ComponentArrayItemFieldBase {
  type: Exclude<ComponentFieldType, 'jsonarray' | 'stringarray' | 'select'>;
}

export interface ComponentArrayNestedField extends ComponentArrayItemFieldBase {
  type: 'jsonarray';
  items: ComponentArrayItemField[];
}

export interface ComponentArrayPrimitiveListField extends ComponentArrayItemFieldBase {
  type: 'stringarray';
}

export type ComponentArrayItemField =
  | ComponentArrayPrimitiveField
  | ComponentArrayNestedField
  | ComponentArrayPrimitiveListField;

export interface ComponentPropSchema {
  key: string;
  label: string;
  type: ComponentFieldType;
  required?: boolean;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
  description?: string;
  default?: BuilderValue;
  items?: ComponentArrayItemField[];
  elementType?: 'string' | 'number' | 'boolean';
  ui?: ComponentFieldUiConfig;
}

export interface ComponentDefinition {
  id: string; // used internally by registry
  label: string; // display name in UI
  description?: string;
  icon?: string;
  props?: ComponentPropSchema[];
  allowChildren?: boolean;
  childHint?: string;
}

export type BuilderMarginBreakpoint = 'base' | 'sm' | 'md' | 'lg' | 'xl';

export interface BuilderResponsiveMargin {
  base?: string;
  sm?: string;
  md?: string;
  lg?: string;
  xl?: string;
}

export interface BuilderNodeMargins {
  top?: BuilderResponsiveMargin;
  right?: BuilderResponsiveMargin;
  bottom?: BuilderResponsiveMargin;
  left?: BuilderResponsiveMargin;
}

export type BuilderNodeChild = BuilderNode | BuilderTextNode;

export interface BuilderNode {
  uid: string; // unique per node instance
  type: 'component';
  component: string; // from ComponentDefinition.id
  props: Record<string, BuilderValue>;
  children: BuilderNodeChild[];
  margins?: BuilderNodeMargins;
}

export interface BuilderTextNode {
  uid: string;
  type: 'text';
  value: string;
}

export type BuilderTree = Array<BuilderNodeChild>;

export interface ComponentRegistry {
  lookup: Record<string, ComponentDefinition>;
  list: ComponentDefinition[];
}
