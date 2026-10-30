import {markExported} from './store.mjs';
export async function exportFile(file,downloads,sleep=ms=>new Promise(r=>setTimeout(r,ms))){
 const url=file.isDataURL?file.data:`data:${file.mime};charset=utf-8,`+encodeURIComponent(file.data);
 const id=await downloads.download({url,filename:file.name,saveAs:false,conflictAction:'overwrite'});
 for(let n=0;n<120;n++){
  const [item]=await downloads.search({id});
  if(!item)throw Error('Không tìm thấy lượt tải; bản dự phòng vẫn còn.');
  if(item.state==='complete'){await markExported(file,item);return item;}
  if(item.state==='interrupted')throw Error(item.error||'Download interrupted');
  await sleep(250);
 }
 throw Error('Chưa xác nhận tải xong; dữ liệu vẫn trong bản dự phòng.');
}
