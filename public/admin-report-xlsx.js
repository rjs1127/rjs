// Loaded only when the administrator requests an XLSX export. No CDN dependency.
(function () {
  'use strict';
  const encode = text => new TextEncoder().encode(text);
  const xml = text => String(text).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  function column(index) { let result='';for(index++;index;index=Math.floor((index-1)/26))result=String.fromCharCode(65+(index-1)%26)+result;return result; }
  function crc32(bytes) { let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let b=0;b<8;b++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0; }
  function zip(files) {
    const parts=[],central=[];let offset=0;
    for(const [name,text]of files){const filename=encode(name),body=encode(text),crc=crc32(body);const h=new Uint8Array(30+filename.length);const v=new DataView(h.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(12,33,true);v.setUint32(14,crc,true);v.setUint32(18,body.length,true);v.setUint32(22,body.length,true);v.setUint16(26,filename.length,true);h.set(filename,30);parts.push(h,body);
      const c=new Uint8Array(46+filename.length),w=new DataView(c.buffer);w.setUint32(0,0x02014b50,true);w.setUint16(4,20,true);w.setUint16(6,20,true);w.setUint16(14,33,true);w.setUint32(16,crc,true);w.setUint32(20,body.length,true);w.setUint32(24,body.length,true);w.setUint16(28,filename.length,true);w.setUint32(42,offset,true);c.set(filename,46);central.push(c);offset+=h.length+body.length;
    }
    const size=central.reduce((n,b)=>n+b.length,0),end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true);v.setUint32(12,size,true);v.setUint32(16,offset,true);return new Blob([...parts,...central,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  }
  function cell(value,ref,type,header=false) {
    if(value&&typeof value==='object'){type=value.type||type;value=value.value;}
    if(value==null)return `<c r="${ref}"/>`;
    if(['date','datetime','month'].includes(type)){
      const ms=typeof value==='number'?value:Date.parse(value);if(!Number.isFinite(ms))throw new Error('날짜 형식이 올바르지 않습니다: '+ref);
      const serial=(ms+9*3600000)/86400000+25569;return `<c r="${ref}" s="${type==='datetime'?4:type==='month'?6:3}"><v>${serial}</v></c>`;
    }
    if(typeof value==='number'){if(!Number.isFinite(value))throw new Error('숫자 형식이 올바르지 않습니다: '+ref);return `<c r="${ref}" s="${type==='percent'?5:Number.isInteger(value)?2:10}"><v>${value}</v></c>`;}
    const text=String(value);if(text.length>32767)throw new Error('Excel 셀 길이 제한을 넘었습니다. 데이터를 잘라서 저장하지 않습니다.');
    const style=header?1:text==='FAIL'||text==='CHECK'?8:text==='PASS'||text==='OK'?7:text==='N/A'?9:0;
    return `<c r="${ref}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${xml(text)}</t></is></c>`;
  }
  const styles=`<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="${ns}"><numFmts count="5"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/><numFmt numFmtId="165" formatCode="yyyy-mm-dd hh:mm:ss"/><numFmt numFmtId="166" formatCode="0.0%"/><numFmt numFmtId="167" formatCode="yyyy-mm"/><numFmt numFmtId="168" formatCode="#,##0.00"/></numFmts><fonts count="4"><font><sz val="11"/><name val="Calibri"/><color rgb="FF292524"/></font><font><b/><sz val="11"/><name val="Calibri"/><color rgb="FFFFFFFF"/></font><font><sz val="11"/><name val="Calibri"/><color rgb="FF166534"/></font><font><b/><sz val="11"/><name val="Calibri"/><color rgb="FFB91C1C"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF574B3F"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="11">${[
    [0,0,0,'left'],[0,1,2,'center'],[3,0,0,'right'],[164,0,0,'left'],[165,0,0,'left'],[166,0,0,'right'],[167,0,0,'left'],[0,2,0,'center'],[0,3,0,'center'],[0,0,0,'center'],[168,0,0,'right'],
  ].map(([fmt,font,fill,align])=>`<xf numFmtId="${fmt}" fontId="${font}" fillId="${fill}" borderId="0" xfId="0" applyAlignment="1" applyNumberFormat="1" applyFont="1" applyFill="1"><alignment horizontal="${align}" vertical="center" wrapText="1"/></xf>`).join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  function sheetXml(sheet) {
    const rows=[sheet.columns.map(c=>c.label),...sheet.rows];if(rows.length>1048576)throw new Error('Excel 행 제한 초과');
    const cols=sheet.columns.map((c,i)=>{const max=Math.max(c.label.length,...sheet.rows.slice(0,60).map(r=>String(r[i]?.value??r[i]??'').length));const width=['date','datetime','month'].includes(c.type)?23:Math.min(55,Math.max(16,max+3));return `<col min="${i+1}" max="${i+1}" width="${width}" customWidth="1"/>`;}).join('');
    const dimension=`A1:${column(sheet.columns.length-1)}${rows.length}`;
    return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${ns}"><dimension ref="${dimension}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="26"/><cols>${cols}</cols><sheetData>${rows.map((row,i)=>`<row r="${i+1}" ht="${i===0?30:sheet.name.startsWith('12_')||sheet.name.startsWith('00_')?58:28}" customHeight="1">${row.map((v,j)=>cell(v,column(j)+(i+1),i?sheet.columns[j]?.type:null,i===0)).join('')}</row>`).join('')}</sheetData><autoFilter ref="${dimension}"/><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/></worksheet>`;
  }
  window.AdminReportXlsx={ create(report) {
    if(report.exportSchemaVersion!==1||report.sheets.length!==14)throw new Error('지원하지 않는 보고서 schema입니다.');
    const generatedAt=new Date().toISOString();
    const sheets=report.sheets.map(s=>s.name==='00_내보내기정보'?{...s,rows:s.rows.map(r=>r[0]==='파일 생성 시각'?[r[0],{value:generatedAt,type:'datetime'}]:r)}:s);
    const files=[['[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((s,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],['_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],['xl/styles.xml',styles],['xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${sheets.map((s,i)=>`<sheet name="${xml(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`],['xl/_rels/workbook.xml.rels',`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${report.sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],...sheets.map((s,i)=>[`xl/worksheets/sheet${i+1}.xml`,sheetXml(s)])];
    const blob=zip(files);if(blob.size>40*1024*1024)throw new Error('XLSX 파일 크기 한도 40MiB를 넘었습니다. 기간을 줄여 주세요.');return blob;
  }};
})();
