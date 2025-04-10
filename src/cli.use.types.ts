// types.ts - Type definitions for the flow framework

export type FlowInput = any;
export type FlowOutput = any;

export interface Flow {
  name: string;
  description: string;
  execute: (input?: FlowInput) => Promise<FlowOutput>;
}

export interface FlowContext {
  clipboard: any;
  history: Array<{
    flowName: string;
    input: FlowInput;
    output: FlowOutput;
    timestamp: Date;
  }>;
}

export type Colors = {
  reset: string;
  cyan: string;
  yellow: string;
  green: string;
  red: string;
  bold: string;
};
