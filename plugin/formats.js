(function(root){
'use strict';
const atlas=/\.atlas(?:\.(?:txt|bytes))?$/i;
function stem(name){return name.replace(/\.(?:skel|json)(?:\.(?:bytes|txt))?$/i,'').replace(/\.atlas(?:\.(?:txt|bytes))?$/i,'').replace(/\.(?:bytes|txt)$/i,'');}
function json(bytes){try{const j=JSON.parse(new TextDecoder().decode(bytes).replace(/^\uFEFF/,''));return j.skeleton?.spine&&Array.isArray(j.bones)?j:null;}catch{return null;}}
function binaryVersion(bytes){function str(p){let n=0,shift=0,b;do{if(p>=bytes.length||shift>28)throw Error();b=bytes[p++];n|=(b&127)<<shift;shift+=7;}while(b&128);if(n<1||n>256||p+n-1>bytes.length)throw Error();return {text:new TextDecoder().decode(bytes.subarray(p,p+n-1)),next:p+n-1};}for(const offset of [0,8])try{let f=str(offset);if(!offset)f=str(f.next);if(/^\d+\.\d+\.\d+/.test(f.text))return f.text;}catch{}return null;}
function kind(name,bytes){if(atlas.test(name))return 'atlas';if(!/\.(?:skel|json|bytes|txt)$/i.test(name))return null;if(bytes){if(json(bytes))return 'json';if(binaryVersion(bytes))return 'binary';return null;}if(/\.skel(?:\.bytes)?$/i.test(name))return 'binary';if(/\.json(?:\.(?:txt|bytes))?$/i.test(name))return 'json';return null;}
const api={stem,json,kind,binaryVersion,isAtlas:name=>atlas.test(name)};root.SpineFormats=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
