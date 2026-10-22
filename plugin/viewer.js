'use strict';
const $=id=>document.getElementById(id),canvas=$('canvas');
let gl,renderer,atlas,skeleton,state,model,playing=true,seconds=0,duration=0,baseScale=1,zoom=1,last=0,pan={x:0,y:0},center={x:0,y:0};
let runtime=window.spine,gfx=runtime.webgl,runtimeBranch='3.6';
let capturingThumbnail=false;
let originalPreviewPath="";
let sourcePath='',loadToken=0;
let node=false,fs=null,path=null,pluginRoot=null;
function initNode(){
  if(typeof require!=='function')return false;
  fs=require('fs');path=require('path');node=true;
  const candidates=[window.spinePluginRoot,eagleApi()?.plugin?.path];
  if(typeof global!=='undefined')candidates.push(global.__dirname);
  if(typeof __dirname!=='undefined')candidates.push(__dirname);
  // Eagle can serve plugin pages through its own protocol. Only actual file:
  // URLs may be passed to Node's fileURLToPath.
  const pageURL=new URL(window.location.href);
  if(pageURL.protocol==='file:')candidates.push(require('url').fileURLToPath(new URL('.',pageURL)));
  const found=candidates.find(dir=>typeof dir==='string'&&path.isAbsolute(dir)&&fs.existsSync(path.join(dir,'viewer.js'))&&fs.existsSync(path.join(dir,'selection.js')));
  if(found)pluginRoot=found;
  return !!pluginRoot;
}
// Eagle injects a require bound to api.js; use its supplied plugin directory.
const pluginRequire=name=>{if(!pluginRoot)throw new Error('Eagle 尚未提供插件目录');return require(path.join(pluginRoot,name));};
const status=(text,kind='')=>{$('status').textContent=text;$('status').className=kind;};
window.addEventListener('error',e=>status('初始化错误：'+e.message,'error'));
window.addEventListener('unhandledrejection',e=>status('初始化错误：'+(e.reason?.message||e.reason),'error'));
try{initNode();}catch(e){status('运行环境初始化失败：'+e.message,'error');}
function eagleApi(){if(typeof eagle!=='undefined'&&eagle?.item?.getSelected)return eagle;if(typeof global!=='undefined'&&global.eagle?.item?.getSelected)return global.eagle;if(globalThis.eagle?.item?.getSelected)return globalThis.eagle;if(window.eagle?.item?.getSelected)return window.eagle;return null;}
async function waitForEagle(){for(let i=0;i<50;i++){initNode();const api=eagleApi();if(node&&api&&pluginRoot)return api;await new Promise(r=>setTimeout(r,100));}throw new Error('Eagle 插件接口或插件目录尚未就绪（v1.0.0）。请关闭此窗口并重新运行插件。');}
function dispose(){if(atlas)atlas.dispose();atlas=null;skeleton=null;state=null;model=null;}
function initGL(){if(renderer)return;gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:false,preserveDrawingBuffer:true});if(!gl)throw new Error('无法创建 WebGL，请检查 Eagle 的硬件加速设置');renderer=new gfx.SceneRenderer(canvas,gl,true);}
function setupPose(){if(skeleton.setToSetupPose)skeleton.setToSetupPose();else skeleton.setupPose();}
function currentTrack(){return state?(state.getCurrent?state.getCurrent(0):state.getTrack(0)):null;}
function findFile(files,name){const normalized=name.replace(/\\/g,'/');if(files.has(normalized))return files.get(normalized);const matches=[...files.keys()].filter(k=>k.split('/').pop().toLowerCase()===normalized.split('/').pop().toLowerCase());if(matches.length!==1)throw new Error('找不到唯一的配套文件：'+name);return files.get(matches[0]);}
function image(bytes,name){return new Promise((resolve,reject)=>{const url=URL.createObjectURL(new Blob([bytes],{type:/\.jpe?g$/i.test(name)?'image/jpeg':/\.webp$/i.test(name)?'image/webp':'image/png'}));const im=new Image();im.onload=()=>{URL.revokeObjectURL(url);resolve(im);};im.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('贴图读取失败：'+name));};im.src=url;});}
async function loadFiles(files,preferred){const token=++loadToken;status('正在读取骨骼与贴图…');
  try{
    const names=[...files.keys()];const isSkeleton=n=>['binary','json'].includes(SpineFormats.kind(n,files.get(n)));let skel=preferred&&files.has(preferred)&&isSkeleton(preferred)?preferred:names.find(n=>SpineFormats.kind(n,files.get(n))==='binary')||names.find(isSkeleton);
    if(!skel)throw new Error('素材包内没有 .skel 或 Spine JSON');
    const bytes=files.get(skel),text=new TextDecoder();let json=SpineFormats.json(bytes);const binary=!json;
    const version=binary?spineRuntimes.detectBinary(bytes):json.skeleton?.spine;
    const branch=spineRuntimes.branch(version),api=await spineRuntimes.load(version);
    if(binary&&(branch==='3.6'||branch==='3.7'))json=decodeSpine36(bytes);
    const stem=SpineFormats.stem(skel);let atlasName=names.find(n=>[stem.toLowerCase()+'.atlas',stem.toLowerCase()+'.atlas.txt',stem.toLowerCase()+'.atlas.bytes'].includes(n.toLowerCase()));
    if(!atlasName){const choices=names.filter(n=>/\.atlas(?:\.(?:txt|bytes))?$/i.test(n));if(choices.length===1)atlasName=choices[0];}
    if(!atlasName)throw new Error('缺少匹配的 .atlas。请点击“选择配套文件夹”，或导入包含全部文件的 .spinezip');
    const atlasText=text.decode(files.get(atlasName)),pageNames=[];let next=true;
    for(const line of atlasText.split(/\r?\n/)){if(!line.trim()){next=true;continue;}if(next){pageNames.push(line.trim());next=false;}}
    const images=new Map();for(const name of pageNames){const folder=atlasName.includes('/')?atlasName.slice(0,atlasName.lastIndexOf('/')+1):'';images.set(name,await image(findFile(files,folder+name),name));}
    if(token!==loadToken)return;
    dispose();if(runtime!==api&&renderer){renderer.dispose();renderer=null;}runtime=api;gfx=runtime.webgl||runtime;runtimeBranch=branch;initGL();
    if(branch.startsWith('3.'))atlas=new runtime.TextureAtlas(atlasText,name=>new gfx.GLTexture(gl,images.get(name)));
    else{atlas=new runtime.TextureAtlas(atlasText);for(const page of atlas.pages)page.setTexture(new gfx.GLTexture(gl,images.get(page.name)));}
    $('pma').checked=atlas.pages.some(page=>page.pma===true);
    const loader=new runtime.AtlasAttachmentLoader(atlas);
    model=json?new runtime.SkeletonJson(loader).readSkeletonData(json):new runtime.SkeletonBinary(loader).readSkeletonData(bytes);
    skeleton=new runtime.Skeleton(model);setupPose();updateWorld();state=new runtime.AnimationState(new runtime.AnimationStateData(model));
    $('animation').replaceChildren(...model.animations.map(a=>new Option(a.name,a.name)));
    $('skin').replaceChildren(...model.skins.map(a=>new Option(a.name,a.name)));
    if(model.animations.some(a=>a.name==='standby_loop'))$('animation').value='standby_loop';
    if(!model.findAnimation($('animation').value)?.duration){const moving=model.animations.find(a=>a.duration>0);if(moving)$('animation').value=moving.name;}
    $('empty').style.display='none';chooseAnimation();fit();status('已加载 '+skel.split('/').pop()+' · Spine '+model.version+' · '+model.animations.length+' 个动作','ok');
    window.previewReady=true;if(params.get('background')!=='1')setTimeout(()=>generateThumbnail(false),400);
  }catch(e){if(token===loadToken){dispose();$('empty').style.display='grid';status(e.message,'error');window.previewError=e.message;}console.error(e);}
}
function chooseAnimation(){if(!state)return;seconds=0;setupPose();const name=$('animation').value;
  if(name){state.clearTracks();state.setAnimation(0,name,$('loop').checked);state.apply(skeleton);duration=model.findAnimation(name).duration;}else duration=0;
  updateWorld();playing=true;$('play').textContent='暂停';}
function updateWorld(advance=false){skeleton.updateWorldTransform(runtime.Physics?(advance?runtime.Physics.update:runtime.Physics.pose):undefined);
  // The 3.6 runtime divides by zero for hidden no-scale bones. Keep those
  // attachments collapsed rather than letting NaN poison the camera/mesh.
  if(runtimeBranch!=='4.3')for(const b of skeleton.bones)if(![b.a,b.b,b.c,b.d,b.worldX,b.worldY].every(Number.isFinite)){b.a=b.b=b.c=b.d=0;b.worldX=b.parent?.worldX||0;b.worldY=b.parent?.worldY||0;}
}
function fit(){if(!skeleton)return;updateWorld();let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  if(runtimeBranch==='4.3'){const offset=new runtime.Vector2(),size=new runtime.Vector2();skeleton.getBounds(offset,size,[]);minX=offset.x;minY=offset.y;maxX=minX+size.x;maxY=minY+size.y;}
  else for(const slot of skeleton.drawOrder){const a=slot.attachment;if(!a||slot.color.a<0.01||a.color?.a<0.01)continue;let v=[];
    if(a instanceof runtime.RegionAttachment)a.computeWorldVertices(['4.1','4.2'].includes(runtimeBranch)?slot:slot.bone,v,0,2);
    else if(a instanceof runtime.MeshAttachment){v=new Array(a.worldVerticesLength);a.computeWorldVertices(slot,0,a.worldVerticesLength,v,0,2);}else continue;
    for(let i=0;i<v.length;i+=2){const x=v[i],y=v[i+1];if(!Number.isFinite(x)||!Number.isFinite(y))continue;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
  }
  if(!Number.isFinite(minX)){minX=minY=0;maxX=model.width||300;maxY=model.height||300;}
  center={x:(minX+maxX)/2,y:(minY+maxY)/2};baseScale=Math.max((maxX-minX)/Math.max(1,canvas.clientWidth),(maxY-minY)/Math.max(1,canvas.clientHeight))*1.35||1;zoom=1;pan={x:0,y:0};}
function render(t){requestAnimationFrame(render);if(!capturingThumbnail)drawFrame(t);}
function drawFrame(t){const dt=Math.min((t-last)/1000,0.1);last=t;if(!skeleton)return;
  if(playing&&duration){const d=dt*Number($('speed').value);skeleton.update?.(d);state.update(d);state.apply(skeleton);seconds+=d;if($('loop').checked)seconds%=duration;else if(seconds>=duration){seconds=duration;playing=false;$('play').textContent='播放';}}
  updateWorld(playing);const ratio=Math.min(devicePixelRatio||1,2);const w=Math.max(1,Math.round(canvas.clientWidth*ratio)),h=Math.max(1,Math.round(canvas.clientHeight*ratio));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);const scale=baseScale/zoom;renderer.camera.viewportWidth=canvas.clientWidth*scale;renderer.camera.viewportHeight=canvas.clientHeight*scale;renderer.camera.position.x=center.x+pan.x;renderer.camera.position.y=center.y+pan.y;renderer.begin();if(runtimeBranch==='4.3'){for(const page of atlas.pages)page.pma=$('pma').checked;renderer.drawSkeleton(skeleton);}else renderer.drawSkeleton(skeleton,$('pma').checked);renderer.end();
  $('timeline').value=duration?seconds/duration:0;$('clock').textContent=seconds.toFixed(2)+' / '+duration.toFixed(2)+'s';
  window.previewSnapshot=()=>({version:model.version,animation:$('animation').value,seconds,duration,playing,bones:skeleton.bones.map(b=>{const p=b.appliedPose||b;return[p.worldX,p.worldY,p.a,p.b,p.c,p.d];}),skins:model.skins.map(s=>s.name),animations:model.animations.map(a=>({name:a.name,duration:a.duration}))});
}
$('animation').onchange=()=>{chooseAnimation();fit();};$('skin').onchange=()=>{if(!skeleton)return;skeleton.setSkinByName($('skin').value);chooseAnimation();fit();};$('loop').onchange=()=>{const track=currentTrack();if(track)track.loop=$('loop').checked;};
$('play').onclick=()=>{playing=!playing;$('play').textContent=playing?'暂停':'播放';};$('fit').onclick=fit;
$('timeline').oninput=()=>{if(!state||!duration)return;seconds=Number($('timeline').value)*duration;const entry=currentTrack();entry.trackTime=seconds;setupPose();state.apply(skeleton);playing=false;$('play').textContent='播放';};
canvas.onwheel=e=>{e.preventDefault();zoom=Math.max(0.1,Math.min(10,zoom*Math.exp(-e.deltaY*0.001)));};
let drag=null;canvas.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY,px:pan.x,py:pan.y};canvas.setPointerCapture(e.pointerId);};canvas.onpointermove=e=>{if(drag){pan.x=drag.px-(e.clientX-drag.x)*baseScale/zoom;pan.y=drag.py+(e.clientY-drag.y)*baseScale/zoom;}};canvas.onpointerup=()=>drag=null;
$('open').onclick=()=>$('file').click();$('locate').onclick=()=>$('folder').click();
async function pick(list){try{const files=new Map();for(const file of list){const bytes=new Uint8Array(await file.arrayBuffer());if(/\.(zip|spinezip)$/i.test(file.name)){if(!node)throw new Error('ZIP 素材包请在 Eagle 插件中打开');const entries=pluginRequire('zip.js')(Buffer.from(bytes));for(const [k,v]of entries)files.set(k,v);}else files.set(file.webkitRelativePath||file.name,bytes);}await loadFiles(files,sourcePath?sourcePath.split(/[\\/]/).pop():null);}catch(e){status(e.message,'error');}}
$('file').onchange=e=>pick(e.target.files);$('folder').onchange=e=>pick(e.target.files);
function diskFiles(filePath){const files=new Map();if(/\.(zip|spinezip)$/i.test(filePath))return pluginRequire('zip.js')(fs.readFileSync(filePath));const folder=path.dirname(filePath);const visit=(dir,depth=0)=>{if(depth>4)return;for(const e of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,e.name);if(e.isDirectory())visit(full,depth+1);else if(/\.(skel(?:\.bytes)?|json(?:\.(?:txt|bytes))?|bytes|txt|atlas(?:\.(?:txt|bytes))?|png|jpe?g|webp)$/i.test(e.name))files.set(path.relative(folder,full).replace(/\\/g,'/'),fs.readFileSync(full));}};visit(folder);return files;}
const params=new URLSearchParams(location.search);sourcePath=params.get('path')||'';originalPreviewPath=sourcePath;
async function openPath(filePath){try{originalPreviewPath=filePath;if(filePath.startsWith('file:'))filePath=require('url').fileURLToPath(filePath);if(/\.(json|txt)$/i.test(filePath)&&!SpineFormats.isAtlas(filePath)&&SpineFormats.kind(filePath,fs.readFileSync(filePath))!=='binary'){
    const raw=fs.readFileSync(filePath,'utf8');let parsed=null;try{parsed=JSON.parse(raw.replace(/^\uFEFF/,''));}catch{}
    if(!parsed?.skeleton?.spine||!Array.isArray(parsed.bones)){
      dispose();const pre=document.createElement('pre');pre.id='textPreview';pre.style.cssText='position:absolute;inset:0;margin:0;padding:20px;overflow:auto;background:#191f2b;color:#e7edf8;white-space:pre-wrap;word-break:break-word;font:14px/1.6 monospace';pre.textContent=parsed?JSON.stringify(parsed,null,2):raw;
      $('textPreview')?.remove();$('stage').append(pre);$('empty').style.display='none';document.querySelector('header').style.display='none';status(path.basename(filePath));window.textPreviewReady=true;return;
    }
  }
  $('textPreview')?.remove();document.querySelector('header').style.display='';status('正在查找 Eagle 中的骨骼、图集和贴图…');filePath=await pluginRequire('eagle-files.js').findSkeleton(filePath);sourcePath=filePath;let files=diskFiles(filePath);if(['binary','json'].includes(SpineFormats.kind(filePath,fs.readFileSync(filePath))))files=await pluginRequire('eagle-files.js')(filePath,files);await loadFiles(files,path.basename(filePath));}catch(e){status(e.message,'error');console.error(e);}}
async function openSelection(){try{status('正在连接 Eagle 并读取选中素材…');const api=await waitForEagle();const filePath=await pluginRequire('selection.js')(api);await openPath(filePath);}catch(e){status(e.message,'error');console.error(e);}}
if(sourcePath){(async()=>{try{if(!initNode())await waitForEagle();await openPath(sourcePath);}catch(e){status(e.message,'error');}})();}
else {
  const selectedButton=document.createElement('button');selectedButton.id='selected';selectedButton.textContent='读取当前选中';selectedButton.onclick=openSelection;$('open').before(selectedButton);
  let pending;const schedule=()=>{clearTimeout(pending);pending=setTimeout(openSelection,80);};
  $('note').textContent='v1.0.0 · 自动读取 Eagle 选中素材';
  (async()=>{try{status('正在等待 Eagle 插件接口初始化…');const api=await waitForEagle();api.onPluginCreate?.(schedule);api.onPluginRun?.(schedule);schedule();}catch(e){status(e.message,'error');}})();
}
requestAnimationFrame(render);
window.addEventListener('beforeunload',()=>{dispose();if(renderer)renderer.dispose();});

async function generateThumbnail(force=true){
  if(capturingThumbnail||!model||!node||!sourcePath||!/[\\/]images[\\/][^\\/]+\.info[\\/]/i.test(originalPreviewPath))return;
  const button=$('thumbnail');
  try{
    const api=await waitForEagle();const id=params.get('id')||originalPreviewPath.match(/[\\/]([^\\/]+)\.info[\\/]/)?.[1];
    let item=api.item.getById?await api.item.getById(id):(await api.item.getSelected()).find(i=>i.id===id);
    if(!item?.setCustomThumbnail)throw Error('Eagle 未提供设置缩略图接口');
    if(item.filePath&&path.resolve(item.filePath)!==path.resolve(originalPreviewPath))throw Error('素材库已切换，稍后重新生成');
    const thumb=path.join(path.dirname(originalPreviewPath),path.basename(originalPreviewPath).replace(/\.[^.]+$/,'')+'_thumbnail.png');
    let existingCustom=false;try{existingCustom=JSON.parse(fs.readFileSync(path.join(path.dirname(originalPreviewPath),'metadata.json'),'utf8')).customThumbnail===true;}catch{}
    if(!force&&(existingCustom||item.customThumbnail||(fs.existsSync(thumb)&&fs.readFileSync(thumb).includes(Buffer.from('acTL')))))return true;
    button.disabled=true;capturingThumbnail=true;status('正在生成动态缩略图…');
    const old={playing,seconds,animation:$('animation').value,zoom,pan:{...pan},center:{...center},baseScale};
    let temp;
    try{
      chooseAnimation();fit();playing=true;
      const ratio=canvas.clientHeight/Math.max(1,canvas.clientWidth),w=Math.max(1,Math.round(256/Math.max(1,ratio))),h=Math.max(1,Math.round(w*ratio));const out=document.createElement('canvas');out.width=w;out.height=h;const ctx=out.getContext('2d'),frames=[],fps=20,count=Math.max(2,Math.ceil(Math.min(duration||1,3)*fps));
      for(let i=0;i<count;i++){drawFrame(last+(i?1000/fps:0));ctx.clearRect(0,0,w,h);ctx.drawImage(canvas,0,0,w,h);frames.push(new Uint8Array(ctx.getImageData(0,0,w,h).data));if(i%5===0)await new Promise(r=>setTimeout(r,0));}
      const data=pluginRequire('apng.js')(frames,w,h,fps);temp=fs.mkdtempSync(path.join(require('os').tmpdir(),'eagle-spine-thumb-'));const output=path.join(temp,'preview.png');fs.writeFileSync(output,data);
      if(!await item.setCustomThumbnail(output,{width:w,height:h}))throw Error('Eagle 更新缩略图超时，请重试');
      status('动态缩略图已生成，返回素材列表即可播放','ok');return true;
    }finally{
      if(temp){try{fs.unlinkSync(path.join(temp,'preview.png'));fs.rmdirSync(temp);}catch{}}
      $('animation').value=old.animation;chooseAnimation();seconds=old.seconds;const track=currentTrack();if(track)track.trackTime=seconds;setupPose();state.apply(skeleton);updateWorld();playing=old.playing;zoom=old.zoom;pan=old.pan;center=old.center;baseScale=old.baseScale;$('play').textContent=playing?'暂停':'播放';last=performance.now();
    }
  }catch(e){console.error(e);status('动态缩略图：'+e.message,'error');return false;}finally{capturingThumbnail=false;button.disabled=false;}
}
$('thumbnail').onclick=()=>generateThumbnail(true);
