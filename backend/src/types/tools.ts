export type ParameterPolicy = {
  defaults?: Record<string, unknown>;
  askIfMissing?: Record<string, boolean>;
  questions?: Record<string, string>;
};

export type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};
