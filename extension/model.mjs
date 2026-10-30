export const VERSION='1.1.0';
export function safeName(value=''){
 let name=String(value).normalize('NFC').replace(/[\x00-\x1f\x7f]+/g,' ').replace(/[<>:"/\\|?*]+/g,'-').replace(/^[.\s-]+|[.\s-]+$/g,'').replace(/\s+/g,' ').slice(0,80).trim();
 if(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(name))name='_'+name;
 return name||'Cuộc họp';
}
export function sessionFolder(title,date=new Date(),id=crypto.randomUUID().slice(0,8)){
 const pad=n=>String(n).padStart(2,'0');
 return `MeetScribe/${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}/${safeName(title)}--${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}--${id}`;
}
export function isMeet(url){try{const u=new URL(url);return u.protocol==='https:'&&u.hostname==='meet.google.com';}catch{return false;}}
export function meetingPlatform(url){
 try{const u=new URL(url);if(u.protocol!=='https:')return null;
 if(u.hostname==='meet.google.com')return 'meet';
 if(/(^|\.)zoom\.(us|com)$/.test(u.hostname)&&/^\/(?:wc(?:\/|$)|j\/|s\/|w\/)/.test(u.pathname))return 'zoom';
 }catch{}return null;
}
export const isSupportedMeeting=url=>meetingPlatform(url)!==null;
export function validEntries(entries){
 return Array.isArray(entries)&&entries.length>0&&entries.length<=100&&entries.every((e,i)=>e&&Number.isSafeInteger(e.sequence)&&e.sequence>0&&(!i||e.sequence===entries[i-1].sequence+1)&&typeof e.text==='string'&&e.text.length<=2000000&&typeof e.timestamp==='string'&&Number.isFinite(Date.parse(e.timestamp)));
}
