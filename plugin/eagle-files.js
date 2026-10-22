'use strict';
const fs=require('fs'),path=require('path'),http=require('http');
const formats=require('./formats.js');
function requestItems(keyword){return new Promise((resolve,reject)=>{
  const req=http.get('http://127.0.0.1:41595/api/item/list?limit=200&keyword='+encodeURIComponent(keyword),res=>{let body='';res.setEncoding('utf8');res.on('data',s=>{body+=s;if(body.length>8*1024*1024)req.destroy(new Error('素材查询结果过大'));});res.on('end',()=>{try{const result=JSON.parse(body);if(result.status!=='success'||!Array.isArray(result.data))throw new Error('Eagle 素材查询失败');resolve(result.data);}catch(e){reject(e);}});});req.setTimeout(5000,()=>req.destroy(new Error('Eagle 本地接口没有响应')));req.on('error',reject);
});}
function sameFolder(item,current){return (item.folders||[]).some(f=>(current.folders||[]).includes(f));}
function choose(items,name,ext,current){let found=items.filter(i=>!i.isDeleted&&i.ext?.toLowerCase()===ext.toLowerCase()&&i.name.toLowerCase()===name.toLowerCase());const nearby=found.filter(i=>sameFolder(i,current));if(nearby.length)found=nearby;if(found.length>1)throw new Error('Eagle 中有多个同名配套素材：'+name+'.'+ext+'。请放入单独文件夹或使用 .spinezip');return found[0];}
function chooseAtlas(items,name,current){let found=items.filter(i=>!i.isDeleted&&(i.name+'.'+i.ext).replace(/\.atlas(?:\.(?:txt|bytes))?$/i,'').toLowerCase()===name.toLowerCase()&&/\.atlas(?:\.(?:txt|bytes))?$/i.test(i.name+'.'+i.ext));const nearby=found.filter(i=>sameFolder(i,current));if(nearby.length)found=nearby;if(found.length>1)throw new Error('有多个同名图集：'+name+'，请将配套素材放入单独文件夹。');return found[0];}
function itemFile(library,item){const dir=path.join(library,'images',item.id+'.info');let candidates=fs.readdirSync(dir).filter(n=>n.toLowerCase().endsWith('.'+item.ext.toLowerCase())&&!/_thumbnail\./i.test(n));const exact=candidates.find(n=>n===item.name+'.'+item.ext);if(exact)return path.join(dir,exact);if(candidates.length!==1)throw new Error('配套素材文件不唯一：'+item.name);return path.join(dir,candidates[0]);}
function atlasPages(text){let next=true;const names=[];for(const line of text.split(/\r?\n/)){if(!line.trim()){next=true;continue;}if(next){names.push(line.trim());next=false;}}return names;}
module.exports=async function resolveEagleFiles(filePath,files){
  const itemDir=path.dirname(filePath);if(!itemDir.toLowerCase().endsWith('.info'))return files;
  const metadata=path.join(itemDir,'metadata.json');if(!fs.existsSync(metadata))return files;
  const current=JSON.parse(fs.readFileSync(metadata,'utf8')),library=path.dirname(path.dirname(itemDir));
  const basename=path.basename(filePath),stem=formats.stem(basename);
  const atlasKey=[...files.keys()].find(n=>[stem.toLowerCase()+'.atlas',stem.toLowerCase()+'.atlas.txt',stem.toLowerCase()+'.atlas.bytes'].includes(n.toLowerCase()));let atlasName=atlasKey;
  if(!atlasName){const candidates=await requestItems(stem);const item=chooseAtlas(candidates,stem,current);if(!item)return files;atlasName=stem+'.atlas';files.set(atlasName,fs.readFileSync(itemFile(library,item)));}
  const pages=atlasPages(files.get(atlasName).toString('utf8'));
  for(const page of pages){const target=page.replace(/\\/g,'/');if([...files.keys()].some(k=>k.toLowerCase()===target.toLowerCase()))continue;const base=path.basename(target),ext=path.extname(base).slice(1),name=base.slice(0,-ext.length-1);const item=choose(await requestItems(name),name,ext,current);if(item)files.set(target,fs.readFileSync(itemFile(library,item)));}
  return files;
};
function chooseSkeleton(items,stem,current,library){
  let found=items.filter(i=>!i.isDeleted&&formats.stem(i.name+'.'+i.ext).toLowerCase()===stem.toLowerCase()&&['skel','json','bytes','txt'].includes(i.ext.toLowerCase()));
  found=found.filter(i=>{try{return ['binary','json'].includes(formats.kind(i.name+'.'+i.ext,fs.readFileSync(itemFile(library,i))));}catch{return false;}});
  const nearby=found.filter(i=>sameFolder(i,current));if(nearby.length)found=nearby;
  const binary=found.filter(i=>formats.kind(i.name+'.'+i.ext)==='binary');if(binary.length)found=binary;
  if(found.length>1)throw Error('有多个同名骨骼：'+stem+'。请将配套文件放入单独的 Eagle 文件夹。');return found[0];
}
module.exports.findSkeleton=async function(filePath){
  if(/\.(spinezip|zip)$/i.test(filePath))return filePath;
  const bytes=fs.readFileSync(filePath);if(['binary','json'].includes(formats.kind(filePath,bytes)))return filePath;
  const dir=path.dirname(filePath),stem=formats.stem(path.basename(filePath)).replace(/\.(png|jpe?g|webp)$/i,'');
  for(const name of fs.readdirSync(dir)){if(formats.stem(name).toLowerCase()!==stem.toLowerCase())continue;const candidate=path.join(dir,name);if(fs.statSync(candidate).isFile()&&['binary','json'].includes(formats.kind(name,fs.readFileSync(candidate))))return candidate;}
  const metadata=path.join(dir,'metadata.json');
  if(fs.existsSync(metadata)&&dir.toLowerCase().endsWith('.info')){const current=JSON.parse(fs.readFileSync(metadata,'utf8')),library=path.dirname(path.dirname(dir));const item=chooseSkeleton(await requestItems(stem),stem,current,library);if(item)return itemFile(library,item);}
  throw Error('没有找到对应骨骼。请将同名 .skel、.skel.bytes 或 Spine JSON 与图集、贴图放在同一 Eagle 文件夹中。');
};
