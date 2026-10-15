import { requireInput } from '../domain/errors.js';
export const ADGM_PROSPECTUS_REGISTER='https://www.adgm.com/financial-services-regulatory-authority/listing-authority/approved-prospectuses';
const endpoint='https://www.adgm.com/ADGMApprovedProspectus/GetProspectusesAjax';
export interface ProspectusEntry {readonly sourceUrl:string;readonly approvalDate:string;readonly type:string}
const text=(s:string)=>s.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').trim();
/** Discover the current primary and every potentially applicable issuer supplement. */
export async function discoverNvdabProspectuses(fetcher:typeof fetch=fetch):Promise<readonly ProspectusEntry[]> {
  const rows:{cells:string[];sourceUrl:string}[]=[];let total:number|undefined;
  for(let page=1;page<=20;page++) {
    const response=await fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({itemsperpage:100,sortby:'date#desc',currentpage:page,issuer:'351353',
        prospectusyear:'',prospectustype:'',securitytype:'',Table:{IssuerNameColumn:'Issuer',IssuerNameColumnWidth:15,
          SecurityDescriptionColumn:'Security Description',SecurityDescriptionColumnWidth:15,TickerColumn:'Ticker',TickerColumnWidth:15,
          SecurityTypeColumn:'Security Type',SecurityTypeColumnWidth:15,ProspectusTypeColumn:'Prospectus Type',ProspectusTypeColumnWidth:15,
          ApprovalDateColumn:'Approval Date',ApprovalDateColumnWidth:15,LinkColumn:'Link to Prospectus',LinkColumnWidth:10,DocumentLinkTarget:'_blank'},
        noRecordsViewModel:{MessageType:'info',MessageTitle:'Nothing found',MessageDescription:'No results'}}),
      signal:AbortSignal.timeout(10000)});
    requireInput(response.ok,'PROSPECTUS_REGISTER_UNAVAILABLE','ADGM register must load for each trade.');
    const html=await response.text(), count=/TotalItems\s*:\s*(\d+)/.exec(html);
    requireInput(html.length<=4_000_000&&!!count,'PROSPECTUS_REGISTER_UNKNOWN','Register completeness must be observable.');
    const currentTotal=Number(count[1]);
    requireInput(currentTotal>0&&currentTotal<=2000&&(total===undefined||currentTotal===total),
      'PROSPECTUS_REGISTER_CHANGED','Register changed during pagination.');total=currentTotal;
    const batch=[...html.matchAll(/<adgm-table-row\b[^>]*>([\s\S]*?)<\/adgm-table-row>/gi)].flatMap(match=>{
      const cells=[...match[1]!.matchAll(/<adgm-table-cell\b[^>]*>([\s\S]*?)<\/adgm-table-cell>/gi)].map(x=>text(x[1]!));
      if(!cells.length)return [];
      const href=/href="([^"]+)"/.exec(match[1]!);
      requireInput(cells.length===7&&cells[0]==='BTech Holdings Limited'&&!!href,
        'PROSPECTUS_REGISTER_UNKNOWN','Unexpected register row requires review.');
      const url=new URL(href[1]!.replace(/&amp;/g,'&'),'https://www.adgm.com');
      requireInput(url.protocol==='https:'&&url.hostname==='www.adgm.com'&&!url.search&&!url.hash&&!url.username&&!url.password,
        'PROSPECTUS_REGISTER_UNKNOWN','Only primary ADGM document links are accepted.');
      return [{cells,sourceUrl:url.href}];
    });
    requireInput(batch.length>0&&batch.length<=100,'PROSPECTUS_REGISTER_UNKNOWN','Incomplete register page.');
    rows.push(...batch);
    if(rows.length===total)break;
    requireInput(rows.length<total,'PROSPECTUS_REGISTER_UNKNOWN','Register total does not match its rows.');
  }
  requireInput(rows.length===total&&new Set(rows.map(r=>r.sourceUrl)).size===rows.length,
    'PROSPECTUS_REGISTER_UNKNOWN','Complete unique register required.');
  const relevant=rows.filter(r=>r.cells[2]==='NVDAB'||r.cells[4]!=='Primary');
  const date=(r:typeof rows[number])=>{const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(r.cells[5]!);
    requireInput(!!m,'PROSPECTUS_REGISTER_UNKNOWN','Dated documents required.');return `${m[3]}-${m[2]}-${m[1]}`;};
  const primary=relevant.filter(r=>r.cells[2]==='NVDAB'&&r.cells[4]==='Primary').sort((a,b)=>date(b).localeCompare(date(a)));
  requireInput(primary.length>0&&(primary.length===1||date(primary[0]!)!==date(primary[1]!)),
    'PROSPECTUS_REGISTER_UNKNOWN','A unique latest NVDAB primary prospectus is required.');
  return relevant.filter(r=>r===primary[0]||r.cells[4]!=='Primary').map(r=>({sourceUrl:r.sourceUrl,approvalDate:date(r),type:r.cells[4]!}))
    .sort((a,b)=>a.sourceUrl.localeCompare(b.sourceUrl));
}
