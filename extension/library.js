const list=document.getElementById('sessions'),message=document.getElementById('message');
async function command(type,data={}){const answer=await chrome.runtime.sendMessage({scope:'meetscribe',target:'worker',type,...data});if(!answer?.ok)throw Error(answer?.error||'Không kết nối được tiện ích.');return answer;}
function el(tag,text,cls){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;}
function button(label,fn,cls){const node=el('button',label,cls);node.onclick=async()=>{node.disabled=true;try{message.textContent='';await fn();}catch(e){message.textContent=e.message;}finally{node.disabled=false;}};return node;}
async function render(){
 try{
  const {sessions}=await command('list');document.getElementById('sessionCount').textContent=sessions.length;list.replaceChildren();
  if(!sessions.length){list.append(el('div','Chưa có phiên nào. Mở Meet/Zoom web và bấm biểu tượng MeetScribe để bắt đầu.','empty'));return;}
  for(const s of sessions){
   const card=el('article',undefined,'session'),info=el('div'),title=el('h3',s.title),meta=el('p',undefined,'meta');
   const status={recording:'Đang thu',stopping:'Đang đóng',completed:'Đã dừng',interrupted:'Gián đoạn'}[s.status]||s.status;
   meta.append(el('span',status,'state'),document.createTextNode(`${new Date(s.createdAt).toLocaleString('vi-VN')} · ${s.count||0} caption · ${s.images||0} ảnh`));
   info.append(title,meta,el('p',s.folder,'path'));
   if(s.pendingExports)info.append(el('p',`${s.pendingExports} file chờ xuất · dữ liệu đã ở bản dự phòng`,'meta warning'));
   else info.append(el('p','Đã xác nhận xuất các file hiện có.','meta'));
   if(s.exportError)info.append(el('p','Lỗi tải: '+s.exportError,'meta warning'));
   if(s.status==='interrupted')info.append(el('p','Phiên có khoảng gián đoạn. Kiểm tra phạm vi caption trước khi lập biên bản.','meta warning'));
   const actions=el('div',undefined,'actions');
   if(s.pendingExports)actions.append(button('Thử xuất lại',async()=>{await command('retry',{sid:s.id});await render();},'retry'));
   actions.append(button('Mở thư mục',()=>command('show-folder',{sid:s.id})));
   if(['recording','stopping'].includes(s.status))actions.append(button('Dừng và lưu',async()=>{await command('stop',{sid:s.id});await render();}));
   card.append(info,actions);list.append(card);
  }
 }catch(e){message.textContent='Chưa đọc được thư viện: '+e.message;}
}
document.getElementById('refresh').onclick=render;render();
