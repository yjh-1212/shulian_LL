import {BadRequestException} from '@nestjs/common';
import {SaxesParser} from 'saxes';
import {createHash} from 'node:crypto';
import {inflateRawSync} from 'node:zlib';

export const templateFileSelect={id:true,name:true,mime:true,size:true,digest:true,createdAt:true,previewText:true};
// Limit actual inflation as well as the sizes declared by the ZIP directory.
function safeZip(bytes:Buffer){
 let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(bytes.readUInt32LE(i)===0x06054b50){end=i;break;}
 if(end<0)throw new BadRequestException('DOCX 文件结构无效');
 const count=bytes.readUInt16LE(end+10),start=bytes.readUInt32LE(end+16);let offset=start,total=0;const entries=new Map<string,{size:number,compressed:number,method:number,local:number}>();
 if(!count||count>200||start>=end||bytes.readUInt16LE(end+4)||bytes.readUInt16LE(end+6)||bytes.readUInt16LE(end+8)!==count)throw new BadRequestException('DOCX 包含过多内容或结构无效');
 for(let i=0;i<count;i++){
  if(offset+46>end||bytes.readUInt32LE(offset)!==0x02014b50)throw new BadRequestException('DOCX 文件目录无效');
  const size=bytes.readUInt32LE(offset+24);total+=size;
  if(size>4*1024*1024||total>12*1024*1024||(bytes.readUInt16LE(offset+8)&1))throw new BadRequestException('DOCX 解压大小超限或文件已加密');
  const nameLength=bytes.readUInt16LE(offset+28),next=offset+46+nameLength+bytes.readUInt16LE(offset+30)+bytes.readUInt16LE(offset+32);
  if(next>end)throw new BadRequestException('DOCX 文件目录无效');
  const name=bytes.subarray(offset+46,offset+46+nameLength).toString('utf8');if(entries.has(name))throw new BadRequestException('DOCX 包含重复文件');
  entries.set(name,{size,compressed:bytes.readUInt32LE(offset+20),method:bytes.readUInt16LE(offset+10),local:bytes.readUInt32LE(offset+42)});offset=next;
 }
 const document=entries.get('word/document.xml');if(!document||!entries.has('[Content_Types].xml'))throw new BadRequestException('DOCX 缺少正文');
 const {local,compressed,method,size}=document;
 if(local+30>start||bytes.readUInt32LE(local)!==0x04034b50||bytes.readUInt16LE(local+8)!==method||(bytes.readUInt16LE(local+6)&1))throw new BadRequestException('DOCX 正文结构无效');
 const nameLength=bytes.readUInt16LE(local+26),dataStart=local+30+nameLength+bytes.readUInt16LE(local+28);
 if(dataStart+compressed>start||bytes.subarray(local+30,local+30+nameLength).toString('utf8')!=='word/document.xml')throw new BadRequestException('DOCX 正文结构无效');
 const packed=bytes.subarray(dataStart,dataStart+compressed),content=method===0?packed:method===8?inflateRawSync(packed,{maxOutputLength:4*1024*1024}):null;
 if(!content||content.length!==size||content.length>4*1024*1024)throw new BadRequestException('DOCX 正文大小无效');
 return new TextDecoder('utf-8',{fatal:true}).decode(content);
}
export async function readTemplateFile(file:any){
 if(!file?.buffer?.length)throw new BadRequestException('请选择合同模板文件');
 const bytes:Buffer=file.buffer;if(bytes.length>8*1024*1024)throw new BadRequestException('模板文件不能超过 8MB');
 const raw=String(file.originalname),decoded=Buffer.from(raw,'latin1').toString('utf8');
 const name=([...raw].every(c=>c.charCodeAt(0)<=255)&&!decoded.includes('\uFFFD')?decoded:raw).replace(/[\\/\x00-\x1f]/g,'').slice(0,180);
 let mime='',previewText='';
 if(/\.pdf$/i.test(name)&&bytes.subarray(0,5).toString()==='%PDF-'&&bytes.toString('latin1').includes('%%EOF'))mime='application/pdf';
 else if(/\.docx$/i.test(name)&&bytes.subarray(0,2).toString()==='PK'){
  try{
   const xml=safeZip(bytes);if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('Unsupported XML');
   const parser=new SaxesParser({xmlns:false});let inText=false;
   parser.on('opentag',(node:any)=>{if(node.name==='w:t')inText=true;if(node.name==='w:tab')previewText+='\t';});
   parser.on('text',(value:string)=>{if(inText)previewText+=value;});
   parser.on('closetag',(node:any)=>{if(node.name==='w:t')inText=false;if(node.name==='w:p')previewText+='\n';});parser.write(xml).close();
   previewText=previewText.trim();mime='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }catch{throw new BadRequestException('无法读取 DOCX，请上传有效的 Word 文档');}
 }else if(/\.txt$/i.test(name)){
  try{previewText=new TextDecoder('utf-8',{fatal:true}).decode(bytes).replace(/^\uFEFF/,'').trim();}catch{throw new BadRequestException('TXT 模板请使用 UTF-8 编码');}
  if(/[\x00-\x08\x0e-\x1f]/.test(previewText))throw new BadRequestException('TXT 文件包含无效字符');mime='text/plain';
 }else throw new BadRequestException('支持 PDF、DOCX、UTF-8 TXT，文件格式必须与扩展名一致');
 if(mime!=='application/pdf'&&(previewText.length<10||previewText.length>30000))throw new BadRequestException('模板正文须为 10–30000 字');
 return {name,mime,size:bytes.length,bytes,digest:createHash('sha256').update(bytes).digest('hex'),previewText};
}
