'use strict';
const fs=require('fs'),path=require('path');
module.exports=async({src,dest,item})=>{
  let bytes;
  if(/\.spinezip$/i.test(src)){
    const files=require('./zip.js')(fs.readFileSync(src));
    const key=[...files.keys()].find(k=>/(^|\/)preview\.png$/i.test(k));
    if(key)bytes=files.get(key);
  }
  if(!bytes)bytes=fs.readFileSync(path.join(__dirname,'logo.png'));
  fs.writeFileSync(dest,bytes);
  // PNG IHDR: dimensions are stored in big-endian order.
  item.width=bytes.readUInt32BE(16);item.height=bytes.readUInt32BE(20);
  return item;
};
