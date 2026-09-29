import type {
  EvoRuntimeRevisionReaderV010,
  EvoRuntimeRevisionV010
} from "../api/runtime-revision.js";

export class RuntimeRevisionServiceV010 {
  constructor(private readonly reader: EvoRuntimeRevisionReaderV010) {}

  async get(enterpriseId: string): Promise<EvoRuntimeRevisionV010> {
    if (!enterpriseId.trim()) throw new Error("EVO_RUNTIME_REVISION_ENTERPRISE_REQUIRED");
    return {
      contractVersion: "0.1.0",
      enterpriseId,
      components: await this.reader.read(enterpriseId)
    };
  }
}
