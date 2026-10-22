'use strict';
let serviceRoot='',serviceFS=null;
(async()=>{
  const fs=require('fs'),path=require('path'),url=require('url');serviceFS=fs;
  const getSdk=()=>{const list=[];if(typeof eagle!=='undefined')list.push(eagle);if(typeof global!=='undefined')list.push(global.eagle);list.push(globalThis.eagle,window.eagle);return list.find(a=>a?.item?.get&&a?.plugin?.path);};
  const sdk=getSdk();const roots=[sdk?.plugin?.path];if(new URL(location.href).protocol==='file:')roots.push(url.fileURLToPath(new URL('.',location.href)));roots.push(path.join(require('os').homedir(),'AppData','Roaming','Eagle','Plugins','eagle-spine-preview-36-local'));
  const root=roots.find(p=>p&&fs.existsSync(path.join(p,'scanner.js')));if(!root)throw Error('找不到后台服务目录');serviceRoot=root;
  const Scanner=require(path.join(root,'scanner.js'));
  const candidates=[path.join(root,'viewer.html')],viewer=candidates.find(p=>fs.existsSync(p));if(!viewer)throw Error('找不到 Spine 动画预览插件');
  async function request(route,args){const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),12000);try{const response=await fetch('http://127.0.0.1:41595/api/v2/'+route,{method:args?'POST':'GET',headers:args?{'Content-Type':'application/json'}:{},body:args?JSON.stringify(args):undefined,signal:ctrl.signal});if(!response.ok)throw Error('Eagle 接口 HTTP '+response.status);const r=await response.json();if(r.status!=='success')throw Error(r.message||r.error||'Eagle 接口尚未就绪');return r.data;}finally{clearTimeout(timer);}}
  let libraryPath='';
  const backend=window.spineThumbnailBackend||{refreshLibrary:async()=>{libraryPath=(await request('library/info')).path;},plugin:{path:path.dirname(viewer)},item:{
    get:async({ext})=>{if(!libraryPath)libraryPath=(await request('library/info')).path;const items=[];for(let offset=0;;offset+=1000){const result=await request('item/get',{ext,limit:1000,offset});for(const i of result.data)items.push({...i,filePath:path.join(libraryPath,'images',i.id+'.info',i.name+'.'+i.ext)});if(offset+result.data.length>=result.total)break;}return items;},
    getSelected:async()=>[],
    getById:async id=>{const info=await request('library/info'),result=await request('item/get',{id,limit:1}),item=result.data[0];if(!item)return null;return {...item,filePath:path.join(info.path,'images',id+'.info',item.name+'.'+item.ext),setCustomThumbnail:async(filePath,options)=>request('item/setCustomThumbnail',{itemId:id,filePath,...options})};}
  }};
  // Child frames have no Node preload. Explicitly expose the APIs they use.
  window.require=require;window.spineThumbnailRuntimeApi=backend;window.spineRendererRoot=path.dirname(viewer);window.Buffer=require('buffer').Buffer;
  function update(stats){document.getElementById('status').textContent=`后台自动生成：已完成 ${stats.generated}，已保留 ${stats.preserved}，等待配套文件 ${stats.pending}`+(stats.lastError?' · '+stats.lastError:'');fs.writeFileSync(path.join(root,'status.json'),JSON.stringify({version:'1.0.0',updatedAt:new Date().toISOString(),...stats},null,2));}
  async function render(item){const frame=document.createElement('iframe');document.body.append(frame);frame.src=new URL('viewer.html',location.href).href+'?background=1&id='+encodeURIComponent(item.id)+'&path='+encodeURIComponent(item.filePath);
    try{const deadline=Date.now()+30000;let child;while(Date.now()<deadline){child=frame.contentWindow;if(child?.previewReady)break;const err=child?.previewError||child?.document?.querySelector('#status.error')?.textContent;if(err)throw Error(err);await new Promise(r=>setTimeout(r,100));}if(!child?.previewReady)throw Error('后台读取素材超时');
      let timer;try{const result=await Promise.race([child.generateThumbnail(false),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('后台生成缩略图超时')),30000);})]);if(!result)throw Error(child.document.querySelector('#status')?.textContent||'缩略图生成失败');}finally{clearTimeout(timer);}
    }finally{frame.remove();}}
  const scanner=new Scanner({getItems:async()=>{await backend.refreshLibrary?.();const items=[];for(const ext of ['skel','bytes','json','spinezip','atlas','txt'])items.push(...await backend.item.get({ext}));return items;},render,onStatus:update});
  window.spineThumbnailService=scanner;update(scanner.stats);
  // Start the timer before any requests: early library startup cannot stop polling.
  setInterval(()=>scanner.scan(),5000);sdk?.onLibraryChanged?.(()=>scanner.scan());
  const started=Date.now();let hooked=false;
  const hookTimer=setInterval(()=>{const readySdk=getSdk();if(hooked||!readySdk?.onPluginRun)return;hooked=true;clearInterval(hookTimer);readySdk.onPluginHide?.(()=>document.getElementById('foreground')?.remove());readySdk.onPluginRun(async()=>{scanner.scan();if(Date.now()-started<1000)return;try{const selected=await require(path.join(root,'selection.js'))(readySdk);let foreground=document.getElementById('foreground');if(!foreground){foreground=document.createElement('iframe');foreground.id='foreground';document.body.append(foreground);}foreground.src=new URL('viewer.html',location.href).href+'?background=1&path='+encodeURIComponent(selected);await readySdk.window.show();await readySdk.window.focus();}catch(e){update({...scanner.stats,lastError:e.message});await readySdk.window.show();}});},100);await scanner.scan();

})().catch(e=>{document.getElementById('status').textContent='后台服务启动失败：'+e.message;try{if(serviceRoot&&serviceFS)serviceFS.writeFileSync(serviceRoot+'/status.json',JSON.stringify({version:'1.0.0',lastError:e.message,updatedAt:new Date().toISOString()},null,2));}catch{}console.error(e);});
