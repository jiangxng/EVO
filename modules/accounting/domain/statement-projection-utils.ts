import { createHash } from 'node:crypto';
import { AppError } from '../../../platform/contracts/src/index.js';

export function isObject(value:unknown):value is Record<string,unknown>{
  return typeof value==='object'&&value!==null&&!Array.isArray(value);
}

export function valueAt(payload:Record<string,unknown>,path:string):unknown{
  let current:unknown=payload;
  for(const part of path.split('.')){
    if(!isObject(current)) return undefined;
    current=current[part];
  }
  return current;
}

export function evaluateStatementCondition(ast:Record<string,unknown>,payload:Record<string,unknown>):boolean{
  const type=ast.type;
  if(type==='literal') return ast.value===true;
  if(type==='eq'){
    const field=typeof ast.field==='string'?ast.field:'';
    return valueAt(payload,field)===ast.value;
  }
  if(type==='and'){
    const conditions=Array.isArray(ast.conditions)?ast.conditions:[];
    return conditions.every(condition=>isObject(condition)&&evaluateStatementCondition(condition,payload));
  }
  if(type==='or'){
    const conditions=Array.isArray(ast.conditions)?ast.conditions:[];
    return conditions.some(condition=>isObject(condition)&&evaluateStatementCondition(condition,payload));
  }
  throw new AppError({
    code:'STATEMENT_CONDITION_UNSUPPORTED',
    message:'Unsupported statement condition type '+String(type)+'.',
    module:'accounting',
    operation:'projectStatement'
  });
}

function canonical(value:unknown):string{
  if(value===null||typeof value==='boolean'||typeof value==='number'||typeof value==='string') return JSON.stringify(value);
  if(Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  if(typeof value==='object'){
    const object=value as Record<string,unknown>;
    return '{'+Object.keys(object).sort().map(key=>JSON.stringify(key)+':'+canonical(object[key])).join(',')+'}';
  }
  return JSON.stringify(String(value));
}

export function statementDigest(value:unknown):string{
  return createHash('sha256').update(canonical(value)).digest('hex');
}
