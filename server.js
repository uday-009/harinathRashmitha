// Dependency-free Node server: serves the invitation + photo upload API.
// Set UPLOAD_PASSWORD before starting the server.
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const ROOT=__dirname,PORT=process.env.PORT||3000,UPLOADS=process.env.UPLOAD_DIR||path.join(ROOT,'uploads');
const PASSWORD=process.env.UPLOAD_PASSWORD;
if(!PASSWORD)throw new Error('UPLOAD_PASSWORD environment variable is required');
const MAX_FILE=8*1024*1024,MAX_FILES=300,NAME=/^[\w-]{6,60}\.jpg$/;
const PORTRAIT_NAMES={groom:'groom-portrait.jpg',bride:'bride-portrait.jpg'};
fs.mkdirSync(UPLOADS,{recursive:true});
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.json':'application/json'};
const H=s=>crypto.createHash('sha256').update(String(s)).digest();
const okPw=r=>crypto.timingSafeEqual(H(r.headers['x-password']||''),H(PASSWORD));
const send=(res,code,body,type='application/json',extra={})=>{res.writeHead(code,{'Content-Type':type,'X-Content-Type-Options':'nosniff',...extra});res.end(typeof body==='string'||Buffer.isBuffer(body)?body:JSON.stringify(body))};
const json=(res,code,o)=>send(res,code,o,'application/json',{'Cache-Control':'no-store'});
const deny=async(res)=>{await new Promise(r=>setTimeout(r,800));json(res,401,{ok:false,error:'Wrong password'})};
const list=()=>fs.readdirSync(UPLOADS).filter(f=>NAME.test(f)&&!Object.values(PORTRAIT_NAMES).includes(f)).map(f=>({f,t:fs.statSync(path.join(UPLOADS,f)).mtimeMs})).sort((a,b)=>b.t-a.t).map(x=>x.f);

function serveFile(req,res,file,cache){
  fs.stat(file,(e,st)=>{if(e||!st.isFile())return send(res,404,'Not found','text/plain');
    const type=MIME[path.extname(file).toLowerCase()]||'application/octet-stream',h={'Content-Type':type,'X-Content-Type-Options':'nosniff','Cache-Control':cache,'Accept-Ranges':'bytes'};
    const m=/bytes=(\d*)-(\d*)/.exec(req.headers.range||'');
    if(m){let s=m[1]?+m[1]:0,e2=m[2]?+m[2]:st.size-1;if(!m[1]&&m[2]){s=st.size-(+m[2]);e2=st.size-1}
      if(s>e2||s>=st.size){res.writeHead(416,{'Content-Range':`bytes */${st.size}`});return res.end()}
      res.writeHead(206,{...h,'Content-Range':`bytes ${s}-${e2}/${st.size}`,'Content-Length':e2-s+1});return fs.createReadStream(file,{start:s,end:e2}).pipe(res)}
    res.writeHead(200,{...h,'Content-Length':st.size});fs.createReadStream(file).pipe(res)})}
const inside=(base,p)=>{const f=path.resolve(base,'.'+path.sep+p);return f.startsWith(base+path.sep)?f:null};

http.createServer(async(req,res)=>{
  let url;try{url=new URL(req.url,'http://x');}catch(_){return send(res,400,'Bad request','text/plain')}
  let p;try{p=decodeURIComponent(url.pathname)}catch(_){return send(res,400,'Bad request','text/plain')}
  if(p.includes('\0'))return send(res,400,'Bad request','text/plain');
  const GET=req.method==='GET'||req.method==='HEAD';
  if(GET&&p==='/api/portraits'){
    const portraits={};
    for(const [role,name] of Object.entries(PORTRAIT_NAMES)){
      const file=path.join(UPLOADS,name);
      portraits[role]=fs.existsSync(file)?`uploads/${name}?v=${fs.statSync(file).mtimeMs}`:null;
    }
    return json(res,200,portraits)
  }
  const portraitMatch=/^\/api\/portraits\/(groom|bride)$/.exec(p);
  if(req.method==='POST'&&portraitMatch){
    if(!okPw(req))return deny(res);
    const chunks=[];let n=0,bad=false;
    req.on('data',c=>{n+=c.length;if(n>MAX_FILE){bad=true;req.destroy()}else chunks.push(c)});
    req.on('error',()=>{});
    return req.on('end',()=>{if(bad)return;const b=Buffer.concat(chunks);
      if(b.length<100||b[0]!==0xFF||b[1]!==0xD8||b[2]!==0xFF)return json(res,400,{ok:false,error:'Only JPEG images are accepted (the upload page converts other formats)'});
      const name=PORTRAIT_NAMES[portraitMatch[1]];
      fs.writeFileSync(path.join(UPLOADS,name),b);json(res,200,{ok:true,url:`uploads/${name}?v=${Date.now()}`})})
  }
  if(GET&&p==='/api/photos')return json(res,200,list().map(f=>'uploads/'+f));
  if(GET&&p==='/api/check'){return okPw(req)?json(res,200,{ok:true}):deny(res)}
  if(req.method==='POST'&&p==='/api/upload'){
    if(!okPw(req))return deny(res);
    if(list().length>=MAX_FILES)return json(res,400,{ok:false,error:'Photo limit reached'});
    const chunks=[];let n=0,bad=false;
    req.on('data',c=>{n+=c.length;if(n>MAX_FILE){bad=true;req.destroy()}else chunks.push(c)});
    req.on('error',()=>{});
    return req.on('end',()=>{if(bad)return;const b=Buffer.concat(chunks);
      if(b.length<100||b[0]!==0xFF||b[1]!==0xD8||b[2]!==0xFF)return json(res,400,{ok:false,error:'Only JPEG images are accepted (the upload page converts other formats)'});
      const name=Date.now()+'-'+crypto.randomBytes(4).toString('hex')+'.jpg';fs.writeFileSync(path.join(UPLOADS,name),b);json(res,200,{ok:true,name})})}
  if(req.method==='DELETE'&&p.startsWith('/api/photos/')){
    if(!okPw(req))return deny(res);const name=p.slice(12);
    if(!NAME.test(name))return json(res,400,{ok:false,error:'Bad name'});
    return fs.unlink(path.join(UPLOADS,name),e=>json(res,e?404:200,{ok:!e}))}
  if(!GET)return send(res,405,'Method not allowed','text/plain');
  if(p==='/')return serveFile(req,res,path.join(ROOT,'index.html'),'no-cache');
  if(p==='/uploadimages'||p==='/uploadimages/')return serveFile(req,res,path.join(ROOT,'upload.html'),'no-cache');
  if(p==='/style.css'||p==='/script.js')return serveFile(req,res,path.join(ROOT,p),'no-cache');
  if(p.startsWith('/assests/')){const f=inside(path.join(ROOT,'assests'),p.slice(9));return f?serveFile(req,res,f,'public, max-age=86400'):send(res,404,'Not found','text/plain')}
  if(p.startsWith('/uploads/')){const n=p.slice(9);return NAME.test(n)?serveFile(req,res,path.join(UPLOADS,n),'public, max-age=31536000, immutable'):send(res,404,'Not found','text/plain')}
  send(res,404,'Not found','text/plain')
}).listen(PORT,'0.0.0.0',()=>console.log('Wedding invite running on http://localhost:'+PORT+'  |  upload page: /uploadimages'));
