(function(root){
'use strict';
const supported=['3.6','3.7','3.8','4.0','4.1','4.2','4.3'];
function detectBinary(bytes){
  function stringAt(start){let p=start,n=0,shift=0,b;do{if(p>=bytes.length||shift>28)throw new Error('无效骨骼文件头');b=bytes[p++];n|=(b&127)<<shift;shift+=7;}while(b&128);if(n<1||n>256||p+n-1>bytes.length)throw new Error('无效骨骼版本字段');return {text:new TextDecoder().decode(bytes.subarray(p,p+n-1)),next:p+n-1};}
  for(const offset of [0,8])try{let field=stringAt(offset);if(offset===0)field=stringAt(field.next);if(/^[34]\.\d+\.\d+/.test(field.text))return field.text;}catch{}
  throw new Error('无法识别 Spine 骨骼版本，请确认使用导出的 .skel 文件');
}
function branch(version){const result=String(version||'').match(/^(\d+\.\d+)(?:\.|$)/)?.[1];if(!supported.includes(result))throw new Error('暂不支持 Spine '+version+'；支持 '+supported.join('、'));return result;}
const cache=new Map();if(root.spine)cache.set('3.6',root.spine);
let loading=Promise.resolve();
function load(version){const key=branch(version);if(cache.has(key))return Promise.resolve(cache.get(key));const result=loading.then(()=>{if(cache.has(key))return cache.get(key);return new Promise((resolve,reject)=>{const script=document.createElement('script');root.spine=undefined;script.src='vendor/spine-'+key+'.js';script.onload=()=>{const api=root.spine;if(!api?.Skeleton)reject(new Error('运行库加载失败：'+key));else{cache.set(key,api);resolve(api);}script.remove();};script.onerror=()=>{script.remove();reject(new Error('找不到 Spine '+key+' 运行库'));};document.head.append(script);});});loading=result.catch(()=>{});return result;}
const api={supported,detectBinary,branch,load};root.spineRuntimes=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
