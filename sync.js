const canvas = document.querySelector('canvas'), ctx = canvas.getContext('2d');
document.body.style.cssText='margin:0;background:black;overflow:hidden';
canvas.style.cssText='width:100vw;height:100vh;object-fit:contain';
let generation=0, stream, reader, frames=[];
function clear(){generation++; reader?.cancel().catch(()=>{}); stream?.getTracks().forEach(t=>t.stop()); stream=null; frames.forEach(x=>x.frame.close()); frames=[];}
controls.on('sync-offset', async offset => {
 clear(); if(!offset)return; const token=generation;
 try {
 const captured=await navigator.mediaDevices.getDisplayMedia({video:{width:{max:1920},height:{max:1080},frameRate:{max:30}},audio:false});
 if(token!==generation){captured.getTracks().forEach(t=>t.stop());return;}
 stream=captured; reader=new MediaStreamTrackProcessor({track:stream.getVideoTracks()[0]}).readable.getReader();
 while(token===generation){const {value:frame,done}=await reader.read();if(done)break;if(token!==generation){frame.close();break;}
 frames.push({frame,time:performance.now()});
 if(frames.length>40 || frames.reduce((n,x)=>n+x.frame.allocationSize(),0)>320*1024*1024)throw Error('Buffer limit');
 const target=performance.now()-offset;
 while(frames.length && frames[0].time<=target){const item=frames.shift();canvas.width=item.frame.displayWidth;canvas.height=item.frame.displayHeight;ctx.drawImage(item.frame,0,0);item.frame.close();}
 }
 }catch(e){if(token===generation){clear();controls.syncFailed();}}
});
for(const [dom,type] of [['mousemove','mouseMove'],['mousedown','mouseDown'],['mouseup','mouseUp'],['wheel','mouseWheel']])document.addEventListener(dom,e=>{e.preventDefault();controls.syncInput({type,x:Math.round(e.clientX),y:Math.round(e.clientY),button:['left','middle','right'][e.button]||'left',clickCount:1,...(dom==='wheel'?{deltaX:-e.deltaX,deltaY:-e.deltaY}:{})});},{passive:false});
for(const [dom,type] of [['keydown','keyDown'],['keyup','keyUp']])document.addEventListener(dom,e=>{e.preventDefault();controls.syncInput({type,keyCode:e.key,modifiers:[e.shiftKey?'shift':null,e.ctrlKey?'control':null,e.altKey?'alt':null].filter(Boolean)});if(dom==='keydown'&&e.key.length===1)controls.syncInput({type:'char',keyCode:e.key});});
window.addEventListener('beforeunload',clear);
