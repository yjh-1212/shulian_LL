const assert=require('node:assert/strict'),fs=require('node:fs'),JSZip=require('jszip');
const {readTemplateFile}=require('../apps/api/dist/contract-files');
const read=(buffer,originalname)=>readTemplateFile({buffer,originalname});
async function reject(bytes,name){await assert.rejects(()=>read(bytes,name),e=>e.getStatus()===400);}
(async()=>{
 const text='粮食运输合同：约定运输区段、交接责任、结算周期与异常处理，仅用于本地功能验证。';
 const docx=async xml=>{const z=new JSZip();z.file('[Content_Types].xml','<Types/>');z.file('word/document.xml',xml);return z.generateAsync({type:'nodebuffer',compression:'DEFLATE'});};
 const valid=await docx('<w:document xmlns:w="urn:test"><w:p><w:r><w:t>'+text+'</w:t></w:r></w:p></w:document>');
 assert.equal((await read(valid,'grain.docx')).previewText,text);
 assert.equal((await read(Buffer.from(text),'grain.txt')).previewText,text);
 await reject(Buffer.from([0xff,0xfe,0x00]),'grain.txt');
 await reject(Buffer.from('%PDF-fake'),'grain.pdf');
 await reject(valid.subarray(0,valid.length-30),'grain.docx');
 await reject(await docx('<!DOCTYPE test [<!ENTITY x SYSTEM "file:///local">]><w:p>&x;</w:p>'),'grain.docx');
 // Forge a tiny declared size; the compressed document actually expands beyond the limit.
 const bomb=await docx('x'.repeat(6*1024*1024));let eocd=-1;
 for(let i=bomb.length-22;i>=0;i--)if(bomb.readUInt32LE(i)===0x06054b50){eocd=i;break;}
 let offset=bomb.readUInt32LE(eocd+16);
 for(let i=0;i<bomb.readUInt16LE(eocd+10);i++){
  const length=bomb.readUInt16LE(offset+28),name=bomb.subarray(offset+46,offset+46+length).toString();
  if(name==='word/document.xml'){bomb.writeUInt32LE(100,offset+24);bomb.writeUInt32LE(100,bomb.readUInt32LE(offset+42)+22);}
  offset+=46+length+bomb.readUInt16LE(offset+30)+bomb.readUInt16LE(offset+32);
 }
 await reject(bomb,'grain.docx');
 const result={at:new Date().toISOString(),result:'PASS',checks:['有效 DOCX / UTF-8 TXT','格式伪装与截断文件','外部 XML 实体','伪造解压大小的压缩文件']};
 fs.writeFileSync('docs/acceptance/contract-file-boundaries.json',JSON.stringify(result,null,2));console.log('PASS 合同模板文件边界校验');
})().catch(e=>{console.error(e);process.exitCode=1;});
