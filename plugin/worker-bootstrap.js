'use strict';
if(new URLSearchParams(location.search).get('background')==='1'&&window.parent!==window){
  window.require=window.parent.require;
  window.eagle=window.parent.spineThumbnailRuntimeApi||window.parent.eagle;
  window.Buffer=window.parent.require('buffer').Buffer;
  const path=window.require('path');
  window.spinePluginRoot=window.parent.spineRendererRoot||path.join(window.parent.eagle.plugin.path,'renderer');
}
