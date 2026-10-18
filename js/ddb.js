// D&D Beyond character sheet: PDF-export met formuliervelden → speler met slots en resources.
// parseDdbFields is puur (testbaar); readSheetPdf laadt pdf.js pas als het nodig is.

export function parseDdbFields(annots){
  const F={}; // genormaliseerde naam -> waarde (eerste niet-lege wint)
  for(const a of annots){ if(!a.fieldName) continue;
    const k=a.fieldName.replace(/\s+/g," ").trim(); const v=(a.fieldValue==null?"":String(a.fieldValue)).trim();
    if(v&&v!=="None"&&!(k in F)) F[k]=v; }
  const g=(...ks)=>{for(const k of ks) if(F[k]) return F[k]; return "";};
  const num=s=>{const m=String(s).match(/[+-]?\d+/);return m?+m[0]:0};
  if(!g("CharacterName")&&!g("MaxHP")) return null;
  const ab=["STR","DEX","CON","INT","WIS","CHA"].map(k=>num(g(k))||10);
  const saves=["Strength","Dexterity","Constitution","Intelligence","Wisdom","Charisma"].map(n=>[n.slice(0,3),g("ST "+n)]).filter(x=>x[1]);
  const SK=[["Acrobatics","Acrobatics"],["Animal Handling","Animal"],["Arcana","Arcana"],["Athletics","Athletics"],["Deception","Deception"],["History","History"],["Insight","Insight"],["Intimidation","Intimidation"],["Investigation","Investigation"],["Medicine","Medicine"],["Nature","Nature"],["Perception","Perception"],["Performance","Performance"],["Persuasion","Persuasion"],["Religion","Religion"],["Sleight of Hand","SleightofHand"],["Stealth","Stealth"],["Survival","Survival"]];
  const skills=SK.map(([n,k])=>[n,g(k)]).filter(x=>x[1]);
  // aanvallen
  const attacks=[];
  for(let i=1;i<=12;i++){
    const n=g(i===1?"Wpn Name":"Wpn Name "+i); if(!n) continue;
    attacks.push({n,hit:g(`Wpn${i} AtkBonus`),dmg:g(`Wpn${i} Damage`),notes:g("Wpn Notes "+i)});
  }
  // spells: koppen en regels sorteren op pagina, kolom, hoogte
  const rows=annots.filter(a=>/^(spellHeader|spellSlotHeader|spellName)\d+$/.test(a.fieldName.trim())&&String(a.fieldValue||"").trim())
    .map(a=>({...a,k:a.fieldName.trim(),v:String(a.fieldValue).trim(),x:a.rect[0],y:a.rect[1]}));
  const col=x=>Math.round(x/150);
  rows.sort((a,b)=>a.page-b.page||col(a.x)-col(b.x)||b.y-a.y||a.x-b.x);
  const byIdx=(pre,i)=>{const r=annots.find(a=>a.fieldName.trim()===pre+i);return r?String(r.fieldValue||"").trim():""};
  const lv=[]; let cur=null;
  for(const r of rows){
    if(r.k.startsWith("spellHeader")){ const m=r.v.match(/(\d)(?:st|nd|rd|th)\s+LEVEL/i);
      cur={lvl:m?+m[1]:0,max:0,spells:[]}; lv.push(cur);
      const sh=byIdx("spellSlotHeader",r.k.replace("spellHeader","")); const sm=sh.match(/(\d+)\s*Slots?/i); if(sm) cur.max=+sm[1]; }
    else if(r.k.startsWith("spellName")&&cur){ const i=r.k.replace("spellName","");
      cur.spells.push({n:r.v,src:byIdx("spellSource",i),hit:byIdx("spellSaveHit",i),time:byIdx("spellCastingTime",i),range:byIdx("spellRange",i),dur:byIdx("spellDuration",i),notes:byIdx("spellNotes",i)}); }
  }
  // samenvoegen per level (meerdere spellcasting-klassen)
  const levels=[]; for(const l of lv){ const e=levels.find(x=>x.lvl===l.lvl); if(e){e.max=Math.max(e.max,l.max);e.spells.push(...l.spells)} else levels.push(l); }
  levels.sort((a,b)=>a.lvl-b.lvl);
  const slots=levels.filter(l=>l.lvl>0&&l.max>0).map(l=>({lvl:l.lvl,max:l.max,left:l.max,spells:l.spells.map(s=>s.n).filter((v,i,a)=>a.indexOf(v)===i).join(", ")}));
  // beperkte resources: "Sorcery Points • 8 / Long Rest" of "Sorcery Points: 8 / Long Rest"
  const text=Object.entries(F).filter(([k])=>/^(Actions\d|FeaturesTraits\d)$/.test(k)).map(([,v])=>v).join("\n");
  const res=[], seen=new Set();
  for(const m of text.matchAll(/(?:^|\n|\|)\s*([A-Z][A-Za-z' ()-]{2,40}?)\s*[•:]\s*(\d+)\s*\/\s*(Long Rest|Short Rest)/g)){
    const n=m[1].trim(); if(seen.has(n.toLowerCase())) continue; seen.add(n.toLowerCase());
    res.push({n,max:+m[2],left:+m[2],rest:m[3]}); }
  const dexmod=num(g("DEXmod"));
  return {
    name:g("CharacterName"), cls:g("CLASS LEVEL"), race:g("RACE"), ac:num(g("AC")), max:num(g("MaxHP")),
    initBonus:g("Init")?num(g("Init")):dexmod, dex:dexmod, speed:g("Speed"), prof:g("ProfBonus"),
    ab, saves, saveNotes:g("SaveModifiers"), skills, senses:[g("AdditionalSenses"),g("Passive1")&&`passive Perception ${g("Passive1")}`].filter(Boolean).join(", "),
    attacks, levels, spellDC:g("spellSaveDC0"), spellAtk:g("spellAtkBonus0"), spellAbility:g("spellCastingAbility0"),
    features:[g("Actions1"),g("Actions2"),g("FeaturesTraits1"),g("FeaturesTraits2"),g("FeaturesTraits3")].filter(Boolean).join("\n\n"),
    casting: slots.length?{slots,daily:[]}:null, res
  };
}

let pdfjsReady = null;
const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";

function loadScript(src) {
  return new Promise((ok, err) => {
    const s = document.createElement("script");
    s.src = src; s.crossOrigin = "anonymous";
    s.onload = ok; s.onerror = () => err(new Error(src));
    document.head.appendChild(s);
  });
}
function loadPdfJs() {
  if (!pdfjsReady) {
    // Worker-script eerst: pdf.js draait dan op de hoofdthread, wat cross-origin worker-problemen voorkomt
    pdfjsReady = loadScript(PDFJS + "pdf.worker.min.js")
      .then(() => loadScript(PDFJS + "pdf.min.js"))
      .then(() => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js"; return window.pdfjsLib; })
      .catch((e) => { pdfjsReady = null; throw e; });
  }
  return pdfjsReady;
}

export async function readSheetPdf(file) {
  const lib = await loadPdfJs();
  const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const annots = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const pg = await doc.getPage(i);
    for (const a of await pg.getAnnotations()) if (a.fieldName) annots.push({ page: i, fieldName: a.fieldName, fieldValue: a.fieldValue, rect: a.rect });
  }
  return parseDdbFields(annots);
}
