import { hashPassword } from 'better-auth/crypto';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { userSchema } from './validation';
import { ApiError } from './errors';
export async function createUser(c:PoolClient,input:unknown) {
  const user=userSchema.parse(input), email=user.email.toLowerCase();
  if((await c.query('SELECT 1 FROM "user" WHERE email=$1',[email])).rowCount) throw new ApiError(409,'Ese correo ya tiene una cuenta.');
  const id=randomUUID();
  await c.query('INSERT INTO "user"(id,name,email) VALUES($1,$2,$3)',[id,user.name,email]);
  await c.query('INSERT INTO account(id,"accountId","providerId","userId",password) VALUES($1,$2,\'credential\',$2,$3)',[randomUUID(),id,await hashPassword(user.password)]);
  await c.query('INSERT INTO staff(user_id,role) VALUES($1,$2)',[id,user.role]);
  return id;
}
