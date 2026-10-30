// Queue different operations, coalesce only identical pending commands.
export class CommandQueue {
 constructor(){this.tails=new Map();this.pending=new Map();}
 run(key,kind,fn){
  const id=key+':'+kind;if(this.pending.has(id))return this.pending.get(id);
  const previous=this.tails.get(key)||Promise.resolve();
  const job=previous.catch(()=>{}).then(fn).finally(()=>{this.pending.delete(id);if(this.tails.get(key)===job)this.tails.delete(key);});
  this.pending.set(id,job);this.tails.set(key,job);return job;
 }
}
