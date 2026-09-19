import { describe, expect, it } from 'vitest';
import type { ValuationInput } from '../api/valuation-input.js';
import { projectCostPoolCheckpointStates } from '../domain/checkpoint-state.js';

function input(
  id: string,
  direction: 'INBOUND'|'OUTBOUND',
  sequence: bigint,
  quantity: string,
  basis?: string,
  specificIdentity?: string
): ValuationInput {
  return {
    businessDataId: id,
    businessDataType: direction === 'INBOUND'
      ? 'production.completed'
      : 'sales_shipment.created',
    direction,
    order: {
      effectiveAt: new Date(`2026-09-18T${String(Number(sequence)+8).padStart(2,'0')}:00:00.000Z`),
      semanticSequence: sequence,
      stableTieBreaker: id
    },
    poolKey: 'warehouse=HK|productId=P-100',
    poolDimensions: { warehouse: 'HK', productId: 'P-100' },
    quantity: { value: quantity, unit: 'EA', role: 'RESOURCE_QUANTITY' },
    ...(basis !== undefined
      ? { basis: { value: basis, unit: 'CNY', role: 'VALUATION_AMOUNT' as const } }
      : {}),
    ...(specificIdentity !== undefined ? { specificIdentity } : {})
  };
}

describe('cost checkpoint state projection', () => {
  it('preserves the remaining FIFO layer at a checkpoint boundary', () => {
    const states = projectCostPoolCheckpointStates('FIFO',[
      input('prod-1','INBOUND',1n,'10','100'),
      input('ship-1','OUTBOUND',2n,'2')
    ]);

    expect(states).toHaveLength(1);
    expect(states[0]?.layers).toEqual([
      expect.objectContaining({
        sourceBusinessDataId: 'prod-1',
        remainingQuantity: '8',
        unitCost: '10',
        semanticSequence: '1'
      })
    ]);
  });

  it('uses newest remaining layers for LIFO checkpoint state', () => {
    const states = projectCostPoolCheckpointStates('LIFO',[
      input('prod-1','INBOUND',1n,'5','50'),
      input('prod-2','INBOUND',2n,'5','100'),
      input('ship-1','OUTBOUND',3n,'6')
    ]);

    expect(states[0]?.layers.map((layer) => ({
      id: layer.sourceBusinessDataId,
      qty: layer.remainingQuantity,
      unit: layer.unitCost
    }))).toEqual([
      { id:'prod-1', qty:'4', unit:'10' }
    ]);
  });

  it('preserves moving-average quantity, amount and contributors', () => {
    const states = projectCostPoolCheckpointStates('MOVING_AVERAGE',[
      input('prod-1','INBOUND',1n,'10','100'),
      input('prod-2','INBOUND',2n,'10','300'),
      input('ship-1','OUTBOUND',3n,'5')
    ]);

    expect(states[0]?.movingAverage).toEqual({
      quantity:'15',
      amount:'300',
      contributorBusinessDataIds:['prod-1','prod-2']
    });
    expect(states[0]?.layers).toEqual([]);
  });

  it('closes moving-average residual exactly when the pool is fully consumed', () => {
    const states = projectCostPoolCheckpointStates('MOVING_AVERAGE',[
      input('prod-1','INBOUND',1n,'3','10'),
      input('ship-1','OUTBOUND',2n,'3')
    ]);

    expect(states[0]?.movingAverage).toEqual({
      quantity:'0',
      amount:'0',
      contributorBusinessDataIds:[]
    });
  });

  it('rejects a checkpoint prefix that would create negative inventory', () => {
    expect(() => projectCostPoolCheckpointStates('FIFO',[
      input('prod-1','INBOUND',1n,'1','10'),
      input('ship-1','OUTBOUND',2n,'2')
    ])).toThrow(/negative/i);
  });
});
