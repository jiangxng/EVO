import type { BusinessDataRecord } from './contracts.js';

export interface BusinessDataReader {
  getBusinessData(
    enterpriseId: string,
    businessDataId: string
  ): Promise<BusinessDataRecord | null>;
}
