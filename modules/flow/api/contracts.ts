export interface FlowProjection {
  projectCommand(commandExecutionId: string): Promise<void>;
}
