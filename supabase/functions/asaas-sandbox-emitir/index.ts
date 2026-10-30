import { createClient } from "npm:@supabase/supabase-js@2.57.0";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const respond=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:cors});
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return respond({error:"Método não permitido"},405);
 const token=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
 const url=Deno.env.get("SUPABASE_URL");
 const pub=Deno.env.get("SUPABASE_ANON_KEY")??Object.values(JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")??"{}"))[0] as string|undefined;
 const secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??Object.values(JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")??"{}"))[0] as string|undefined;
 const key=Deno.env.get("ASAAS_SANDBOX_API_KEY");
 if(!token)return respond({error:"Sessão necessária"},401);
 if(!url||!pub||!secret||!key)return respond({error:"Configuração da função incompleta"},503);
 const auth=createClient(url,pub,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:ue}=await auth.auth.getUser(token);
 if(ue||!user)return respond({error:"Sessão inválida"},401);
 const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:perfil}=await db.from("perfis").select("papel").eq("user_id",user.id).maybeSingle();
 if(perfil?.papel!=="admin")return respond({error:"Acesso restrito ao Administrador Geral"},403);
 let body:{cobranca_id?:string;forma?:string};
 try{body=await req.json();}catch{return respond({error:"JSON inválido"},400);}
 if(!body.cobranca_id||!["PIX","BOLETO"].includes(body.forma??""))return respond({error:"Informe cobrança e forma PIX ou BOLETO"},400);
 const {data:c,error:ce}=await db.from("cobrancas_assinatura").select("id,titular_user_id,status,valor,vencimento_em,provedor_cobranca_id,asaas_invoice_url,asaas_billing_type").eq("id",body.cobranca_id).maybeSingle();
 if(ce||!c)return respond({error:"Cobrança não localizada"},404);
 if(c.provedor_cobranca_id)return respond({ok:true,reutilizada:true,invoiceUrl:c.asaas_invoice_url,billingType:c.asaas_billing_type,externalId:c.provedor_cobranca_id});
 if(c.status!=="pendente"&&c.status!=="vencida")return respond({error:"Somente cobranças pendentes ou vencidas podem ser emitidas"},409);
 if(Number(c.valor)<=0)return respond({error:"Valor precisa ser maior que zero"},400);
 const {data:perfilPagador}=await db.from("perfis").select("nome,documento").eq("user_id",c.titular_user_id).maybeSingle();
 if(!perfilPagador?.nome||!perfilPagador?.documento)return respond({error:"Titular precisa completar nome e CPF/CNPJ no cadastro antes da emissão"},422);
 const {data:mapa}=await db.from("asaas_clientes_sandbox").select("asaas_customer_id").eq("titular_user_id",c.titular_user_id).maybeSingle();
 const api=async(path:string,opts:RequestInit={})=>{
  const r=await fetch("https://api-sandbox.asaas.com/v3/"+path,{...opts,headers:{"access_token":key,"Content-Type":"application/json","User-Agent":"TorresGestorComercial/1.0",...opts.headers},signal:AbortSignal.timeout(15000)});
  const j=await r.json().catch(()=>({}));if(!r.ok)throw Error("Asaas respondeu HTTP "+r.status+": "+JSON.stringify(j).slice(0,400));return j;
 };
 try{
 let cid=mapa?.asaas_customer_id;
 if(!cid){
   const clientes=await api("customers?externalReference="+encodeURIComponent(c.titular_user_id)+"&limit=1");
   cid=clientes.data?.[0]?.id;
   if(!cid){
     const userData=await db.auth.admin.getUserById(c.titular_user_id);
     const novo=await api("customers",{method:"POST",body:JSON.stringify({name:perfilPagador.nome,cpfCnpj:perfilPagador.documento.replace(/\D/g,""),email:userData.data.user?.email,externalReference:c.titular_user_id,notificationDisabled:true})});
     cid=novo.id;
   }
   if(!cid)throw Error("Asaas não retornou um cliente válido");
   const {error:mapError}=await db.from("asaas_clientes_sandbox").upsert({titular_user_id:c.titular_user_id,asaas_customer_id:cid},{onConflict:"titular_user_id"});
   if(mapError)throw Error("Cliente criado no Asaas; falha ao registrar vínculo: "+mapError.message);
 }
 const busca=await api("payments?externalReference="+encodeURIComponent(c.id)+"&limit=10");
 let pagamento=busca.data?.find((p:{externalReference?:string})=>p.externalReference===c.id);
 if(!pagamento)pagamento=await api("payments",{method:"POST",body:JSON.stringify({customer:cid,billingType:body.forma,value:Number(c.valor),dueDate:c.vencimento_em,externalReference:c.id,description:"Torres Gestor Comercial - cobrança de teste",postalService:false})});
 if(!pagamento?.id)throw Error("Asaas não retornou identificador da cobrança");
 const {error:saveError}=await db.from("cobrancas_assinatura").update({provedor:"asaas_sandbox",provedor_cobranca_id:pagamento.id,asaas_invoice_url:pagamento.invoiceUrl??null,asaas_billing_type:pagamento.billingType??body.forma,updated_at:new Date().toISOString()}).eq("id",c.id).is("provedor_cobranca_id",null);
 if(saveError)throw Error("Emitida no Asaas, mas houve falha de sincronização: "+saveError.message);
 return respond({ok:true,invoiceUrl:pagamento.invoiceUrl??null,billingType:pagamento.billingType??body.forma,externalId:pagamento.id});
 }catch(e){return respond({error:e instanceof Error?e.message:"Falha ao emitir cobrança"},502);}
});