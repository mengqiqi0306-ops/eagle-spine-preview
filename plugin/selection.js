'use strict';
const formats=require('./formats.js'),fs=require('fs');
// Context-menu launches use the SDK selection, not the preview's ?path=.
module.exports=async function selectedPath(eagle){
  const items=await eagle.item.getSelected();
  if(!items.length)throw new Error('请先在 Eagle 中选中骨骼、图集或 Spine 素材包，再运行插件。');
  const extensions=['skel','bytes','spinezip','zip','atlas','json','txt','png','jpg','jpeg','webp'];
  let selected;
  for(const ext of extensions){const candidates=items.filter(i=>i.ext?.toLowerCase()===ext&&(ext!=='txt'||formats.isAtlas(i.filePath||i.name+'.'+i.ext)||(()=>{try{return !!formats.kind(i.filePath,fs.readFileSync(i.filePath));}catch{return false;}})()));if(candidates.length>1)throw new Error('选中了多个模型，请只选一个骨骼或图集。');if(candidates.length){selected=candidates[0];break;}}
  if(!selected)throw new Error('选中的文件不是 Spine 骨骼、图集、贴图或素材包。');
  if(!selected.filePath)throw new Error('Eagle 没有返回选中素材的文件路径。');
  return selected.filePath;
};
