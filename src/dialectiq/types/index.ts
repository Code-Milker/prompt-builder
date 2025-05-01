// types/index.ts

export interface Transformation {
  name: string;
  description: string;
  apply: <T>(selections: T[], getName: (option: T) => string) => any;
}

export interface SelectOptionParams<T, S extends Record<string, any>> {
  options: T[];
  getName: (option: T) => string;
  display?: (option: T, input: string) => string;
  history: string[];
  state: S;
  maxDisplay?: number;
  maxSelections?: number | null;
  transformations?: Transformation[];
  commands?: string[]; // Specify full command list
  customCommands?: string[]; // For backward compatibility
}

export type SelectOptionReturn<T, S extends Record<string, any>> = S & {
  selections: T[];
  transformations: Record<string, any>;
};

export interface SelectionContext<T> {
  currentInput: string;
  selectedOptions: T[];
  availableOptions: T[];
  errorMessage: string;
  selectionTypes: readonly string[];
  currentSelectionTypeIndex: number;
  MAX_DISPLAY_SELECTED: number;
  activeTransformations: string[];
  availableTransformations: Transformation[];
  inputMode: 'input' | 'command' | 'transformation';
}

export interface TerminalDimensions {
  rows: number;
  cols: number;
  paddingTop: number;
  paddingLeft: number;
  indent: number;
}

export type SelectionType =
  | 'single'
  | 'range'
  | 'selectAll'
  | 'unselectAll'
  | 'done';
