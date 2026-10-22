'use strict';
const fs=require('fs'),path=require('path');
const formats=require('./formats.js');
class ThumbnailScanner{
  constructor({getItems,render,now=Date.now,onStatus=()=>{}}){Object.assign(this,{getItems,render,now,onStatus});this.records=new Map();this.busy=false;this.stats={generated:0,preserved:0,pending:0,lastError:''};}
  inspect(item){
    const src=item.filePath,ext=String(item.ext).toLowerCase();if(!src||!['skel','atlas','spinezip','json','txt','bytes'].includes(ext))return null;
    const stat=fs.statSync(src);if(!stat.size||this.now()-stat.mtimeMs<3000)return null;
    const stamp=stat.size+':'+stat.mtimeMs,key=src.toLowerCase();let rec=this.records.get(key);
    if(rec?.stamp===stamp&&rec.done)return null;
    if(['json','txt','bytes','skel'].includes(ext)&&!formats.isAtlas(src)){if(!['json','binary'].includes(formats.kind(src,fs.readFileSync(src)))){this.records.set(key,{stamp,done:true});return null;}}
    const dir=path.dirname(src),thumbnail=path.join(dir,path.basename(src).replace(/\.[^.]+$/,'')+'_thumbnail.png');
    if(fs.existsSync(thumbnail)){let custom=false;try{custom=JSON.parse(fs.readFileSync(path.join(dir,'metadata.json'),'utf8')).customThumbnail===true;}catch{}
      if(custom||fs.readFileSync(thumbnail).includes(Buffer.from('acTL'))){this.records.set(key,{stamp,done:true});this.stats.preserved++;return null;}}
    if(!rec||rec.stamp!==stamp)rec={stamp,attempts:0,next:0,done:false};this.records.set(key,rec);return {key,rec,item};
  }
  async scan(){if(this.busy)return;this.busy=true;this.stats.pending=0;
    try{const items=await this.getItems();this.stats.lastError='';for(const item of items){let job;try{job=this.inspect(item);}catch(e){this.stats.lastError=e.message;continue;}if(!job)continue;this.stats.pending++;const {rec}=job;if(rec.next>this.now())continue;
      try{await this.render(item);rec.done=true;rec.error='';this.stats.generated++;this.stats.pending--;this.stats.lastError='';}catch(e){rec.attempts++;rec.next=this.now()+Math.min(300000,20000*Math.pow(2,Math.min(rec.attempts-1,4)));rec.error=item.name+': '+e.message;this.stats.lastError=rec.error;}this.onStatus({...this.stats});}
    }catch(e){this.stats.lastError=e.message;}finally{this.busy=false;if(!this.stats.lastError)this.stats.lastError=[...this.records.values()].find(r=>!r.done&&r.error)?.error||'';this.onStatus({...this.stats});}}
}
module.exports=ThumbnailScanner;
