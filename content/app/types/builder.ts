export type BuilderValuePrimitive = string | number | boolean;

export type BuilderValue = BuilderValuePrimitive | BuilderValuePrimitive[] | Record<string, any>;

export interface ComponentPropSchema {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'boolean' | 'select' | 'json';
  required?: boolean;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
  description?: string;
  default?: BuilderValue;
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

export type BuilderNodeChild = BuilderNode | BuilderTextNode;

export interface BuilderNode {
  uid: string; // unique per node instance
  type: 'component';
  component: string; // from ComponentDefinition.id
  props: Record<string, BuilderValue>;
  children: BuilderNodeChild[];
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
