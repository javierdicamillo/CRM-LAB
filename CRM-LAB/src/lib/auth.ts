import { betterAuth } from 'better-auth';
import { pool } from './db';
function createAuth(){
  if(!process.env.BETTER_AUTH_URL||!process.env.BETTER_AUTH_SECRET)throw new Error('Falta configurar la identidad de la instalación.');
  return betterAuth({
  database: pool,
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : [],
  emailAndPassword: { enabled:true, minPasswordLength:12, maxPasswordLength:128, autoSignIn:false },
  session: { expiresIn:60*60*12, updateAge:60*60, cookieCache:{enabled:false} },
  rateLimit:{enabled:true,window:60,max:30},
  advanced: { useSecureCookies: process.env.BETTER_AUTH_URL?.startsWith('https://'), ipAddress:{ipAddressHeaders:['x-real-ip']} }
  });
}
let instance:ReturnType<typeof createAuth>|undefined;
function getAuth(){return instance??=createAuth();}
export const auth={get api(){return getAuth().api;},handler(request:Request){return getAuth().handler(request);}};
