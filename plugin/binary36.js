/* Spine 3.6 binary -> JSON adapter. Format reference: Esoteric Software
 * spine-runtimes 3.6 SkeletonBinary.java; see vendor/LICENSE.txt. */
(function(root) {
'use strict';
function decode36(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let p = 0;
  const need = n => { if (p+n > v.byteLength) throw new Error('骨骼文件不完整（偏移 '+p+'）'); };
  const u8 = () => {need(1); return v.getUint8(p++);};
  const bool = () => !!u8();
  const f = () => {need(4); const x=v.getFloat32(p); p+=4; if(!Number.isFinite(x)) throw new Error('无效骨骼数值'); return x;};
  const int = () => {need(4); const x=v.getUint32(p); p+=4; return x;};
  const vi = (positive=true) => {let x=0,s=0,b; do { b=u8(); x|=(b&127)<<s; s+=7; if(s>35) throw new Error('无效整数'); } while(b&128); return positive ? x>>>0 : (x>>>1)^-(x&1);};
  const str = () => {let n=vi(); if(n===0)return null; need(--n); const x=new TextDecoder().decode(bytes.subarray(p,p+n)); p+=n; return x;};
  const color = () => int().toString(16).padStart(8,'0');
  const floats = n => Array.from({length:n},f);
  const shorts = () => Array.from({length:vi()},()=>{need(2);const x=v.getUint16(p);p+=2;return x;});
  const count = fn => {const n=vi(); if(n>100000) throw new Error('骨骼数量超限'); for(let i=0;i<n;i++)fn(i);};
  const curve = frame => {const type=u8();if(type===1)frame.curve='stepped';else if(type===2)frame.curve=floats(4);else if(type!==0)throw new Error('未知曲线');};
  const frames = (read, curved=true) => {const n=vi(),a=[]; for(let i=0;i<n;i++){const x=read();if(curved&&i<n-1)curve(x);a.push(x);}return a;};
  const j={skeleton:{hash:str(),spine:str(),width:f(),height:f()},bones:[],slots:[],ik:[],transform:[],path:[],skins:{},events:{},animations:{}};
  if(!/^3\.[67]\./.test(j.skeleton.spine||'')) throw new Error('旧格式解析器仅支持 Spine 3.6 / 3.7，文件版本为 '+j.skeleton.spine);
  const is37=j.skeleton.spine.startsWith('3.7.');
  const ne=bool();if(ne){j.skeleton.fps=f();j.skeleton.images=str();if(is37)j.skeleton.audio=str();}
  count(i=>{const b={name:str()};if(i)b.parent=j.bones[vi()].name; for(const k of ['rotation','x','y','scaleX','scaleY','shearX','shearY','length'])b[k]=f();b.transform=['normal','onlyTranslation','noRotationOrReflection','noScale','noScaleOrReflection'][vi()];if(ne)b.color=color();j.bones.push(b);});
  count(()=>{const s={name:str(),bone:j.bones[vi()].name,color:color()};const dark=int();if(dark!==0xffffffff)s.dark=(dark&0xffffff).toString(16).padStart(6,'0');s.attachment=str();s.blend=['normal','additive','multiply','screen'][vi()];j.slots.push(s);});
  count(()=>{const c={name:str(),order:vi(),bones:[]};count(()=>c.bones.push(j.bones[vi()].name));c.target=j.bones[vi()].name;c.mix=f();c.bendPositive=u8()===1;if(is37){c.compress=bool();c.stretch=bool();c.uniform=bool();}j.ik.push(c);});
  count(()=>{const c={name:str(),order:vi(),bones:[]};count(()=>c.bones.push(j.bones[vi()].name));c.target=j.bones[vi()].name;c.local=bool();c.relative=bool();for(const k of ['rotation','x','y','scaleX','scaleY','shearY','rotateMix','translateMix','scaleMix','shearMix'])c[k]=f();j.transform.push(c);});
  count(()=>{const c={name:str(),order:vi(),bones:[]};count(()=>c.bones.push(j.bones[vi()].name));c.target=j.slots[vi()].name;c.positionMode=['fixed','percent'][vi()];c.spacingMode=['length','fixed','percent'][vi()];c.rotateMode=['tangent','chain','chainScale'][vi()];for(const k of ['rotation','position','spacing','rotateMix','translateMix'])c[k]=f();j.path.push(c);});
  function vertices(n){if(!bool())return floats(n*2);const a=[];for(let i=0;i<n;i++){const c=vi();a.push(c);for(let k=0;k<c;k++)a.push(vi(),f(),f(),f());}return a;}
  function attachment(key){const a={name:str()||key};const type=u8();a.type=['region','boundingbox','mesh','linkedmesh','path','point','clipping'][type];
    switch(type){
      case 0: a.path=str()||a.name;for(const k of ['rotation','x','y','scaleX','scaleY','width','height'])a[k]=f();a.color=color();break;
      case 1:a.vertexCount=vi();a.vertices=vertices(a.vertexCount);if(ne)a.color=color();break;
      case 2:a.path=str()||a.name;a.color=color();{const n=vi();a.uvs=floats(n*2);a.triangles=shorts();a.vertices=vertices(n);a.hull=vi();if(ne){a.edges=shorts();a.width=f();a.height=f();}}break;
      case 3:a.path=str()||a.name;a.color=color();a.skin=str()||'default';a.parent=str();a.deform=bool();if(ne){a.width=f();a.height=f();}break;
      case 4:a.closed=bool();a.constantSpeed=bool();a.vertexCount=vi();a.vertices=vertices(a.vertexCount);a.lengths=floats(Math.floor(a.vertexCount/3));if(ne)a.color=color();break;
      case 5:a.rotation=f();a.x=f();a.y=f();if(ne)a.color=color();break;
      case 6:a.end=j.slots[vi()].name;a.vertexCount=vi();a.vertices=vertices(a.vertexCount);if(ne)a.color=color();break;
      default:throw new Error('未知附件类型 '+type);
    }return a;
  }
  const skinNames=[];
  function skin(name){const n=vi();if(!n)return;const s={};for(let i=0;i<n;i++){const sn=j.slots[vi()].name;const entries=s[sn]={};count(()=>{const key=str();entries[key]=attachment(key);});}j.skins[name]=s;skinNames.push(name);}
  skin('default');count(()=>skin(str()));
  const eventNames=[];count(()=>{const name=str();eventNames.push(name);const e=j.events[name]={int:vi(false),float:f(),string:str()};if(is37){e.audio=str();if(e.audio!==null){e.volume=f();e.balance=f();}}});
  count(()=>{const name=str();const a={slots:{},bones:{},ik:{},transform:{},paths:{},deform:{},drawOrder:[],events:[]};
    count(()=>{const sn=j.slots[vi()].name;const t=a.slots[sn]={};count(()=>{const ty=u8();if(ty===0)t.attachment=frames(()=>({time:f(),name:str()}),false);else if(ty===1)t.color=frames(()=>({time:f(),color:color()}));else if(ty===2)t.twoColor=frames(()=>({time:f(),light:color(),dark:color().slice(2)}));else throw new Error('未知插槽时间线');});});
    count(()=>{const bn=j.bones[vi()].name;const t=a.bones[bn]={};count(()=>{const ty=u8();if(ty>3)throw new Error('未知骨骼时间线');t[['rotate','translate','scale','shear'][ty]]=frames(()=>ty===0?{time:f(),angle:f()}:{time:f(),x:f(),y:f()});});});
    count(()=>{const cn=j.ik[vi()].name;a.ik[cn]=frames(()=>{const x={time:f(),mix:f(),bendPositive:u8()===1};if(is37){x.compress=bool();x.stretch=bool();}return x;});});
    count(()=>{const cn=j.transform[vi()].name;a.transform[cn]=frames(()=>({time:f(),rotateMix:f(),translateMix:f(),scaleMix:f(),shearMix:f()}));});
    count(()=>{const cn=j.path[vi()].name;const t=a.paths[cn]={};count(()=>{const ty=u8();if(ty>2)throw new Error('未知路径时间线');t[['position','spacing','mix'][ty]]=frames(()=>ty===2?{time:f(),rotateMix:f(),translateMix:f()}:{time:f(),[['position','spacing'][ty]]:f()});});});
    count(()=>{const sn=skinNames[vi()];const s=a.deform[sn]={};count(()=>{const slot=j.slots[vi()].name;const t=s[slot]={};count(()=>{const key=str();t[key]=frames(()=>{const x={time:f()};const n=vi();if(n){x.offset=vi();x.vertices=floats(n);}return x;});});});});
    count(()=>{const x={time:f(),offsets:[]};count(()=>x.offsets.push({slot:j.slots[vi()].name,offset:vi()|0}));a.drawOrder.push(x);});
    count(()=>{const x={time:f(),name:eventNames[vi()],int:vi(false),float:f()};x.string=bool()?str():j.events[x.name].string;if(is37&&j.events[x.name].audio!==null){x.volume=f();x.balance=f();}a.events.push(x);});
    if(!a.drawOrder.length)delete a.drawOrder;
    if(!a.events.length)delete a.events;
    j.animations[name]=a;
  });
  if(p!==bytes.byteLength)throw new Error('骨骼格式未完整解析：'+p+'/'+bytes.byteLength);
  return j;
}
if(typeof module!=='undefined'&&module.exports)module.exports=decode36;
root.decodeSpine36=decode36;
})(typeof window!=='undefined'?window:globalThis);
