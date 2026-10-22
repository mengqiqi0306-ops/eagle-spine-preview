'use strict';
// Read ZIP assets in memory, keeping atlas and textures together after Eagle import.
module.exports = function readZip(data) {
  const zlib=require('zlib'), files=new Map();
  let e=-1;
  for(let p=data.length-22;p>=Math.max(0,data.length-65557);p--)if(data.readUInt32LE(p)===0x06054b50){e=p;break;}
  if(e<0)throw new Error('ZIP 文件不完整');
  if(data.readUInt16LE(e+4)||data.readUInt16LE(e+6))throw new Error('不支持分卷 ZIP');
  const count=data.readUInt16LE(e+10);let p=data.readUInt32LE(e+16),total=0;
  for(let i=0;i<count;i++){
    if(p+46>data.length||data.readUInt32LE(p)!==0x02014b50)throw new Error('ZIP 目录错误');
    const flags=data.readUInt16LE(p+8), method=data.readUInt16LE(p+10), size=data.readUInt32LE(p+20), plain=data.readUInt32LE(p+24);
    const nl=data.readUInt16LE(p+28),el=data.readUInt16LE(p+30),cl=data.readUInt16LE(p+32),offset=data.readUInt32LE(p+42);
    const name=data.subarray(p+46,p+46+nl).toString('utf8').replace(/\\/g,'/');p+=46+nl+el+cl;
    if(name.endsWith('/'))continue;
    if(flags&1)throw new Error('不支持加密 ZIP');
    if(name.startsWith('/')||name.split('/').includes('..')||/^[a-z]:/i.test(name))throw new Error('无效 ZIP 路径');
    total+=plain;if(total>256*1024*1024||plain>128*1024*1024)throw new Error('素材包解压大小超过 256 MB');
    if(offset+30>data.length||data.readUInt32LE(offset)!==0x04034b50)throw new Error('ZIP 文件头错误');
    const start=offset+30+data.readUInt16LE(offset+26)+data.readUInt16LE(offset+28);
    if(start+size>data.length)throw new Error('ZIP 内容不完整');
    const raw=data.subarray(start,start+size);
    const output=method===0?Buffer.from(raw):method===8?zlib.inflateRawSync(raw,{maxOutputLength:128*1024*1024}):null;
    if(!output)throw new Error('不支持 ZIP 压缩方式 '+method);
    if(output.length!==plain)throw new Error('ZIP 解压长度错误');
    files.set(name,output);
  }return files;
};
