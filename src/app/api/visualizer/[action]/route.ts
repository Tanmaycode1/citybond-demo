import { assertOrigin, allowAttempt, clientIp } from "@/lib/cms/auth";
import { VisualizerError } from "@/lib/visualizer/fast-server";
import { createVisualizerSession, prepareVisualizerSession, saveVisualizerLead, getVisualizerResult } from "@/lib/visualizer/neutral-server";
export const runtime="nodejs";
export const maxDuration=240;
async function limitedBody(request:Request,max:number){if(Number(request.headers.get("content-length"))>max)throw new VisualizerError("Choose a smaller photo.",413);const reader=request.body?.getReader();if(!reader)throw new VisualizerError("Request body missing.",400);const chunks:Uint8Array[]=[];let size=0;while(true){const{done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw new VisualizerError("Choose a smaller photo.",413);}chunks.push(value);}return Buffer.concat(chunks);}
function failure(error:unknown){if(error instanceof Error&&error.message==="Invalid request origin")return Response.json({error:"Invalid request origin."},{status:403});if(error instanceof VisualizerError)return Response.json({error:error.message},{status:error.status});if(error&&typeof error==="object"&&"issues"in error)return Response.json({error:"Please check your name, email, phone, city and consent."},{status:400});return Response.json({error:"Your preview could not be completed. Please try again."},{status:503});}
export async function POST(request:Request,{params}:{params:Promise<{action:string}>}){
 try{assertOrigin(request);const{action}=await params;
  if(action==="session"){
   if(!/^image\/(jpeg|png|webp)(;|$)/.test(request.headers.get("content-type")||""))throw new VisualizerError("Choose a JPG, PNG or WebP photo.",415);
   const bytes=await limitedBody(request,3_500_000);
   if(!process.env.MODEL_API_KEY)throw new VisualizerError("The preview service has not been configured yet.",503);
   if(!await allowAttempt("neutral-upload",clientIp(request),3,60*60_000))throw new VisualizerError("You have tried several photos. Please return in an hour or contact CityBond.",429);
   return Response.json(await createVisualizerSession(bytes),{headers:{"Cache-Control":"no-store"}});
  }
  if(!["prepare","lead"].includes(action))return Response.json({error:"Not found"},{status:404});
  let body;try{body=JSON.parse((await limitedBody(request,16_000)).toString());}catch(e){if(e instanceof VisualizerError)throw e;throw new VisualizerError("Invalid request.",400);}
  if(!body||typeof body.id!=="string")throw new VisualizerError("Preview session missing.",400);
  if(action==="prepare"){
   const token=process.env.MODEL_API_KEY;if(!token)throw new VisualizerError("The preview service has not been configured yet.",503);
   await prepareVisualizerSession(body.id,token,async()=>{if(!await allowAttempt("neutral-retry",body.id,3,60*60_000))throw new VisualizerError("This photo has reached its retry limit. Please contact CityBond.",429);});return Response.json({ready:true});
  }
  if(!await allowAttempt("neutral-lead",clientIp(request),12,60*60_000))throw new VisualizerError("Please wait before submitting again.",429);
  return Response.json(await saveVisualizerLead(body.id,body.data),{headers:{"Cache-Control":"no-store"}});
 }catch(e){return failure(e);}
}
export async function GET(request:Request,{params}:{params:Promise<{action:string}>}){try{const{action}=await params;if(action!=="result")return Response.json({error:"Not found"},{status:404});return Response.json(await getVisualizerResult(new URL(request.url).searchParams.get("id")||""),{headers:{"Cache-Control":"private, no-store"}});}catch(e){return failure(e);}}
