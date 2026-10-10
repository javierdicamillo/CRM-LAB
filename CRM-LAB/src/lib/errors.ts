import { timingSafeEqual,createHash } from 'node:crypto';
export class ApiError extends Error { constructor(public status:number,message:string){super(message);} }
export function validToken(value:string,expected:string|undefined){
  if(!expected||!value)return false;
  return timingSafeEqual(createHash('sha256').update(value).digest(),createHash('sha256').update(expected).digest());
}
