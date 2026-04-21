import { useState, useEffect } from "react";

const STORAGE_KEY = "skyoutfit-inventory-v2";
const AUTH_KEY    = "skyoutfit-auth-users";
const SESSION_KEY = "skyoutfit-session";

function loadData() {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}
function saveData(d) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch {}
}

// ── AUTH helpers ─────────────────────────────────────────────────────────────
const DEFAULT_USERS = [
  { id:"U001", name:"Admin", username:"admin", password:"skyoutfit123", role:"admin", createdAt:"2025-01-01" },
];

function hashPass(p) {
  // simple deterministic obfuscation (not cryptographic — fine for local use)
  let h = 0;
  for (let i = 0; i < p.length; i++) { h = ((h << 5) - h) + p.charCodeAt(i); h |= 0; }
  return "h" + Math.abs(h).toString(36);
}

function loadUsers() {
  try { const r = localStorage.getItem(AUTH_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}
function saveUsers(u) {
  try { localStorage.setItem(AUTH_KEY, JSON.stringify(u)); } catch {}
}
function getSession() {
  try { const r = localStorage.getItem(SESSION_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}
function setSession(u) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(u)); } catch {}
}
function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
}

const SEED = {
  products: [
    { id:"P001", name:"Newborn Bodysuit Set", category:"Bodysuits", ageRange:"0-3M", color:"Sky Blue", sku:"SO-BS-001", manufacturing:280, packaging:25, platformFee:15, delivery:18, price:520, stock:85, reorderPoint:30, platform:["Own Store","Daraz"] },
    { id:"P002", name:"Sleep Suit - Pastel Stars", category:"Sleep Suits", ageRange:"3-6M", color:"Cloud White", sku:"SO-SS-002", manufacturing:330, packaging:28, platformFee:20, delivery:18, price:620, stock:12, reorderPoint:25, platform:["Own Store","Daraz","Cartup"] },
    { id:"P003", name:"Baby Gift Set (3-Piece)", category:"Gift Sets", ageRange:"0-6M", color:"Navy", sku:"SO-GS-003", manufacturing:650, packaging:55, platformFee:0, delivery:22, price:1200, stock:34, reorderPoint:20, platform:["Own Store"] },
    { id:"P004", name:"Cotton Romper - Sunshine", category:"Rompers", ageRange:"6-12M", color:"Golden", sku:"SO-RM-004", manufacturing:250, packaging:22, platformFee:18, delivery:18, price:480, stock:0, reorderPoint:20, platform:["Daraz","Cartup"] },
    { id:"P005", name:"Winter Sleep Suit - Fleece", category:"Sleep Suits", ageRange:"6-12M", color:"Navy", sku:"SO-WS-005", manufacturing:470, packaging:32, platformFee:20, delivery:20, price:850, stock:60, reorderPoint:15, platform:["Own Store","Daraz"] },
    { id:"P006", name:"Eid Special Set (5-Piece)", category:"Gift Sets", ageRange:"0-12M", color:"Gold & White", sku:"SO-EID-006", manufacturing:1080, packaging:80, platformFee:0, delivery:25, price:1950, stock:8, reorderPoint:10, platform:["Own Store"] },
    { id:"P007", name:"Classic Bodysuit 3-Pack", category:"Bodysuits", ageRange:"0-6M", color:"Mixed", sku:"SO-BS-007", manufacturing:600, packaging:45, platformFee:20, delivery:20, price:1100, stock:47, reorderPoint:20, platform:["Own Store","Daraz"] },
    { id:"P008", name:"Baby Socks Set (6-Pack)", category:"Accessories", ageRange:"0-12M", color:"Mixed", sku:"SO-AC-008", manufacturing:148, packaging:18, platformFee:14, delivery:16, price:320, stock:150, reorderPoint:40, platform:["Daraz","Cartup"] },
  ],
  transactions: [
    { id:"T001", type:"sale", productId:"P001", qty:5, platform:"Daraz", date:"2025-04-18", note:"Order #DZ-8821" },
    { id:"T002", type:"restock", productId:"P002", qty:50, platform:"Supplier", date:"2025-04-17", note:"Batch restock" },
    { id:"T003", type:"sale", productId:"P003", qty:3, platform:"Own Store", date:"2025-04-17", note:"" },
    { id:"T004", type:"sale", productId:"P007", qty:8, platform:"Daraz", date:"2025-04-16", note:"" },
    { id:"T005", type:"adjustment", productId:"P004", qty:-2, platform:"-", date:"2025-04-15", note:"QC rejection" },
  ],
  upcomingStock: [
    { id:"US001", productId:"P002", supplierName:"Dhaka Textile Mills", qty:100, unitCost:380, orderDate:"2025-04-15", expectedDate:"2025-04-28", status:"In Transit", note:"Batch #DTM-221", invoiceNo:"INV-2025-041" },
    { id:"US002", productId:"P004", supplierName:"Gazipur Garments", qty:60, unitCost:290, orderDate:"2025-04-18", expectedDate:"2025-05-02", status:"Ordered", note:"", invoiceNo:"INV-2025-042" },
    { id:"US003", productId:"P006", supplierName:"Premium Stitch BD", qty:40, unitCost:1200, orderDate:"2025-04-20", expectedDate:"2025-04-30", status:"Confirmed", note:"Eid special batch", invoiceNo:"INV-2025-043" },
  ],
  nextTxId:6, nextPId:9, nextUsId:4,
};

const CATEGORIES = ["Bodysuits","Sleep Suits","Rompers","Gift Sets","Accessories","Menswear"];
const AGE_RANGES = ["0-3M","3-6M","6-12M","12-18M","18-24M","24-36M","Adult"];
const PLATFORMS = ["Own Store","Daraz","Cartup"];
const US_STATUSES = ["Ordered","Confirmed","In Transit","Arrived","Cancelled"];

const C = { navy:"#1B3A6B", sky:"#4A90D9", gold:"#C9A84C", lightSky:"#D6EAFB", lightNavy:"#E8EDF5", lightGold:"#FDF3DC" };

function calcCost(p) { return (p.manufacturing||0)+(p.packaging||0)+(p.platformFee||0)+(p.delivery||0); }
function calcMargin(p) { const c=calcCost(p); return p.price>0?Math.round(((p.price-c)/p.price)*100):0; }
function stockStatus(p) {
  if(p.stock===0) return {label:"Out of Stock",color:"#ef4444",bg:"#fef2f2",dot:"#ef4444"};
  if(p.stock<=p.reorderPoint) return {label:"Low Stock",color:"#f59e0b",bg:"#fffbeb",dot:"#f59e0b"};
  return {label:"In Stock",color:"#10b981",bg:"#ecfdf5",dot:"#10b981"};
}

const US_STATUS_CFG = {
  "Ordered":   {color:"#7c3aed",bg:"#ede9fe"},
  "Confirmed": {color:C.sky,bg:C.lightSky},
  "In Transit":{color:"#f59e0b",bg:"#fffbeb"},
  "Arrived":   {color:"#10b981",bg:"#ecfdf5"},
  "Cancelled": {color:"#ef4444",bg:"#fef2f2"},
};

// ── ICONS ─────────────────────────────────────────────────────────────────────
const Ic = {
  box:      ()=><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  plus:     ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  search:   ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  edit:     ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  trash:    ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>,
  chart:    ()=><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  truck:    ()=><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  incoming: ()=><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2v10M8 8l4 4 4-4"/><path d="M20 12v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6"/></svg>,
  cost:     ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 6v2M12 16v2M8 12h2a2 2 0 000-4H9a2 2 0 000 4h2a2 2 0 010 4H8M12 18v2"/></svg>,
  x:        ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  check:    ()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
  receive:  ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0018 9h-1.26A8 8 0 103 16.29"/></svg>,
};

// ── UI PRIMITIVES ─────────────────────────────────────────────────────────────
const inp = {width:"100%",padding:"0.52rem 0.72rem",border:"1.5px solid #e2e8f0",borderRadius:"8px",fontSize:"0.86rem",outline:"none",fontFamily:"inherit",boxSizing:"border-box",background:"#fafbfc"};
const sel = {...inp,cursor:"pointer"};

function Field({label,children}) {
  return <div style={{marginBottom:"0.85rem"}}>
    <label style={{display:"block",fontSize:"0.68rem",fontWeight:700,color:C.navy,marginBottom:"0.28rem",textTransform:"uppercase",letterSpacing:"0.05em"}}>{label}</label>
    {children}
  </div>;
}

function Badge({children,color=C.sky,bg=C.lightSky}) {
  return <span style={{fontSize:"0.68rem",fontWeight:700,color,background:bg,padding:"2px 7px",borderRadius:"20px",whiteSpace:"nowrap"}}>{children}</span>;
}

function Modal({title,onClose,children,wide}) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(10,20,40,0.72)",backdropFilter:"blur(5px)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}>
      <div style={{background:"#fff",borderRadius:"14px",width:"100%",maxWidth:wide?"700px":"540px",maxHeight:"92vh",overflowY:"auto",boxShadow:"0 30px 70px rgba(10,20,40,0.35)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"1.1rem 1.4rem",borderBottom:"1.5px solid #e8edf5",position:"sticky",top:0,background:"#fff",zIndex:1}}>
          <h3 style={{margin:0,fontSize:"1rem",fontFamily:"'DM Sans','Segoe UI',sans-serif",fontWeight:800,color:C.navy}}>{title}</h3>
          <button onClick={onClose} style={{background:"#f1f5f9",border:"none",borderRadius:"6px",padding:"6px",cursor:"pointer",display:"flex",color:"#64748b"}}><Ic.x /></button>
        </div>
        <div style={{padding:"1.4rem"}}>{children}</div>
      </div>
    </div>
  );
}

// ── COST BREAKDOWN MODAL ──────────────────────────────────────────────────────
function CostModal({p,onClose}) {
  const cost = calcCost(p);
  const profit = p.price - cost;
  const margin = calcMargin(p);
  const segments = [
    {label:"Manufacturing",value:p.manufacturing||0,color:"#4A90D9",pct:0},
    {label:"Packaging",value:p.packaging||0,color:"#1B3A6B",pct:0},
    {label:"Platform Fee",value:p.platformFee||0,color:"#C9A84C",pct:0},
    {label:"Delivery",value:p.delivery||0,color:"#10b981",pct:0},
  ].map(s=>({...s,pct:cost>0?Math.round(s.value/cost*100):0}));

  return (
    <Modal title={`Cost Breakdown — ${p.name}`} onClose={onClose}>
      <div style={{display:"flex",alignItems:"center",gap:"0.6rem",marginBottom:"0.5rem"}}>
        <span style={{fontFamily:"monospace",fontSize:"0.75rem",background:C.lightSky,color:C.navy,padding:"2px 7px",borderRadius:"4px"}}>{p.sku}</span>
        <Badge color="#475569" bg="#f1f5f9">{p.ageRange}</Badge>
        <Badge color="#475569" bg="#f1f5f9">{p.category}</Badge>
      </div>

      {/* stacked bar */}
      <div style={{height:"20px",borderRadius:"10px",overflow:"hidden",display:"flex",gap:"2px",marginBottom:"0.65rem"}}>
        {segments.map(s=>s.value>0&&(
          <div key={s.label} title={`${s.label}: ৳${s.value} (${s.pct}%)`} style={{flex:s.value,background:s.color}}/>
        ))}
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:"0.5rem",marginBottom:"1.2rem"}}>
        {segments.map(s=>(
          <div key={s.label} style={{display:"flex",alignItems:"center",gap:"4px",fontSize:"0.72rem",color:"#475569"}}>
            <span style={{width:"9px",height:"9px",borderRadius:"2px",background:s.color,flexShrink:0}}/>
            {s.label} ({s.pct}%)
          </div>
        ))}
      </div>

      {/* line items table */}
      <div style={{border:"1.5px solid #e8edf5",borderRadius:"10px",overflow:"hidden",marginBottom:"1.2rem"}}>
        {segments.map((s,i)=>(
          <div key={s.label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"0.65rem 1rem",background:i%2===0?"#fafbfd":"#fff",borderBottom:"1px solid #f1f5f9"}}>
            <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
              <span style={{width:"9px",height:"9px",borderRadius:"2px",background:s.color,flexShrink:0}}/>
              <span style={{fontSize:"0.86rem",color:"#334155"}}>{s.label}</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:"1rem"}}>
              <span style={{fontSize:"0.75rem",color:"#94a3b8",width:"36px",textAlign:"right"}}>{s.pct}%</span>
              <span style={{fontWeight:700,fontSize:"0.9rem",color:"#1e293b",width:"70px",textAlign:"right"}}>৳ {s.value.toLocaleString()}</span>
            </div>
          </div>
        ))}
        <div style={{display:"flex",justifyContent:"space-between",padding:"0.7rem 1rem",background:C.lightNavy,borderTop:"2px solid #c8d6e8"}}>
          <span style={{fontWeight:700,color:C.navy}}>Total Unit Cost</span>
          <span style={{fontWeight:800,fontSize:"1rem",color:C.navy}}>৳ {cost.toLocaleString()}</span>
        </div>
      </div>

      {/* P&L summary */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0.7rem",marginBottom:"1rem"}}>
        {[
          {label:"Selling Price",value:`৳ ${p.price.toLocaleString()}`,color:"#1e293b",bg:"#f8fafc"},
          {label:"Profit / Unit",value:`৳ ${profit.toLocaleString()}`,color:profit>=0?"#10b981":"#ef4444",bg:profit>=0?"#ecfdf5":"#fef2f2"},
          {label:"Gross Margin",value:`${margin}%`,color:margin>=35?"#10b981":margin>=20?"#f59e0b":"#ef4444",bg:margin>=35?"#ecfdf5":margin>=20?"#fffbeb":"#fef2f2"},
        ].map(x=>(
          <div key={x.label} style={{background:x.bg,borderRadius:"10px",padding:"0.8rem",textAlign:"center"}}>
            <div style={{fontSize:"1.2rem",fontFamily:"'DM Sans','Segoe UI',sans-serif",fontWeight:800,color:x.color}}>{x.value}</div>
            <div style={{fontSize:"0.67rem",color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.04em",marginTop:"2px"}}>{x.label}</div>
          </div>
        ))}
      </div>

      <div style={{background:C.lightSky,borderRadius:"10px",padding:"0.8rem 1rem",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:"0.82rem",color:C.navy,fontWeight:500}}>{p.stock} units in stock × ৳{cost} cost</span>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:"0.68rem",color:"#64748b"}}>Total stock cost</div>
          <div style={{fontFamily:"'DM Sans','Segoe UI',sans-serif",fontWeight:800,fontSize:"1.05rem",color:C.navy}}>৳ {(p.stock*cost).toLocaleString()}</div>
        </div>
      </div>
    </Modal>
  );
}

// ── PRODUCT FORM ──────────────────────────────────────────────────────────────
function ProductForm({initial,onSave,onClose}) {
  const blank = {name:"",category:"Bodysuits",ageRange:"0-3M",color:"",sku:"",manufacturing:0,packaging:0,platformFee:0,delivery:0,price:0,stock:0,reorderPoint:20,platform:["Own Store"]};
  const [f,setF] = useState(initial?{...initial}:blank);
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const togglePl=pl=>set("platform",f.platform.includes(pl)?f.platform.filter(x=>x!==pl):[...f.platform,pl]);
  const cost=calcCost(f); const margin=f.price>0?Math.round(((f.price-cost)/f.price)*100):0;

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 1rem"}}>
        <div style={{gridColumn:"1/-1"}}><Field label="Product Name"><input style={inp} value={f.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. Newborn Bodysuit Set"/></Field></div>
        <Field label="Category"><select style={sel} value={f.category} onChange={e=>set("category",e.target.value)}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></Field>
        <Field label="Age Range"><select style={sel} value={f.ageRange} onChange={e=>set("ageRange",e.target.value)}>{AGE_RANGES.map(a=><option key={a}>{a}</option>)}</select></Field>
        <Field label="SKU"><input style={inp} value={f.sku} onChange={e=>set("sku",e.target.value)} placeholder="SO-XX-000"/></Field>
        <Field label="Color"><input style={inp} value={f.color} onChange={e=>set("color",e.target.value)} placeholder="Sky Blue"/></Field>
        <Field label="Current Stock"><input style={inp} type="number" value={f.stock} onChange={e=>set("stock",+e.target.value)}/></Field>
        <Field label="Reorder Point"><input style={inp} type="number" value={f.reorderPoint} onChange={e=>set("reorderPoint",+e.target.value)}/></Field>
      </div>

      <div style={{background:"#f8fafc",borderRadius:"10px",padding:"1rem",marginBottom:"0.9rem",border:"1.5px solid #e8edf5"}}>
        <div style={{fontSize:"0.7rem",fontWeight:700,color:C.navy,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"0.7rem"}}>💰 Cost Breakdown (per unit in ৳)</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 1rem"}}>
          <Field label="Manufacturing"><input style={inp} type="number" value={f.manufacturing} onChange={e=>set("manufacturing",+e.target.value)}/></Field>
          <Field label="Packaging"><input style={inp} type="number" value={f.packaging} onChange={e=>set("packaging",+e.target.value)}/></Field>
          <Field label="Platform Fee"><input style={inp} type="number" value={f.platformFee} onChange={e=>set("platformFee",+e.target.value)}/></Field>
          <Field label="Delivery Cost"><input style={inp} type="number" value={f.delivery} onChange={e=>set("delivery",+e.target.value)}/></Field>
        </div>
        <div style={{display:"flex",gap:"0.65rem"}}>
          <div style={{flex:1,background:C.lightNavy,borderRadius:"8px",padding:"0.55rem",textAlign:"center"}}>
            <div style={{fontSize:"0.65rem",color:"#64748b",textTransform:"uppercase",fontWeight:600}}>Total Cost</div>
            <div style={{fontFamily:"'DM Sans','Segoe UI',sans-serif",fontWeight:800,color:C.navy}}>৳ {cost}</div>
          </div>
          <div style={{flex:1,background:C.lightSky,borderRadius:"8px",padding:"0.55rem",textAlign:"center"}}>
            <div style={{fontSize:"0.65rem",color:"#64748b",textTransform:"uppercase",fontWeight:600}}>Selling Price</div>
            <input style={{...inp,textAlign:"center",background:"transparent",border:"none",fontFamily:"'DM Sans','Segoe UI',sans-serif",fontWeight:800,color:C.sky,fontSize:"0.95rem",padding:0,width:"100%"}} type="number" value={f.price} onChange={e=>set("price",+e.target.value)}/>
          </div>
          <div style={{flex:1,background:margin>=35?"#ecfdf5":margin>=20?"#fffbeb":"#fef2f2",borderRadius:"8px",padding:"0.55rem",textAlign:"center"}}>
            <div style={{fontSize:"0.65rem",color:"#64748b",textTransform:"uppercase",fontWeight:600}}>Margin</div>
            <div style={{fontFamily:"'DM Sans','Segoe UI',sans-serif",fontWeight:800,color:margin>=35?"#10b981":margin>=20?"#f59e0b":"#ef4444"}}>{margin}%</div>
          </div>
        </div>
      </div>

      <Field label="Sales Platforms">
        <div style={{display:"flex",gap:"0.45rem",flexWrap:"wrap"}}>
          {PLATFORMS.map(p=>(
            <button key={p} onClick={()=>togglePl(p)} style={{padding:"0.32rem 0.85rem",borderRadius:"20px",border:"1.5px solid",borderColor:f.platform.includes(p)?C.sky:"#e2e8f0",background:f.platform.includes(p)?C.lightSky:"#fff",color:f.platform.includes(p)?C.navy:"#64748b",fontSize:"0.76rem",fontWeight:600,cursor:"pointer"}}>{p}</button>
          ))}
        </div>
      </Field>

      <div style={{display:"flex",gap:"0.65rem",marginTop:"0.9rem"}}>
        <button onClick={()=>onSave(f)} style={{flex:1,padding:"0.68rem",background:C.navy,color:"#fff",border:"none",borderRadius:"8px",fontWeight:700,fontSize:"0.86rem",cursor:"pointer",fontFamily:"inherit"}}>{initial?"Update Product":"Add Product"}</button>
        <button onClick={onClose} style={{padding:"0.68rem 1.1rem",background:"#f1f5f9",color:"#64748b",border:"none",borderRadius:"8px",cursor:"pointer",fontFamily:"inherit"}}>Cancel</button>
      </div>
    </div>
  );
}

// ── UPCOMING STOCK FORM ───────────────────────────────────────────────────────
function UpcomingForm({initial,products,onSave,onClose}) {
  const today = new Date().toISOString().split("T")[0];
  const blank = {productId:products[0]?.id||"",supplierName:"",qty:50,unitCost:0,orderDate:today,expectedDate:"",status:"Ordered",note:"",invoiceNo:""};
  const [f,setF] = useState(initial?{...initial}:blank);
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const prod=products.find(p=>p.id===f.productId);

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 1rem"}}>
        <div style={{gridColumn:"1/-1"}}>
          <Field label="Product">
            <select style={sel} value={f.productId} onChange={e=>{const p=products.find(x=>x.id===e.target.value);set("productId",e.target.value);if(p)set("unitCost",calcCost(p));}}>
              {products.map(p=><option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
            </select>
          </Field>
        </div>
        <Field label="Supplier Name"><input style={inp} value={f.supplierName} onChange={e=>set("supplierName",e.target.value)} placeholder="e.g. Dhaka Textile Mills"/></Field>
        <Field label="Invoice No."><input style={inp} value={f.invoiceNo} onChange={e=>set("invoiceNo",e.target.value)} placeholder="INV-2025-000"/></Field>
        <Field label="Quantity (Units)"><input style={inp} type="number" value={f.qty} onChange={e=>set("qty",+e.target.value)}/></Field>
        <Field label="Unit Cost (৳)"><input style={inp} type="number" value={f.unitCost} onChange={e=>set("unitCost",+e.target.value)}/></Field>
        <Field label="Order Date"><input style={inp} type="date" value={f.orderDate} onChange={e=>set("orderDate",e.target.value)}/></Field>
        <Field label="Expected Arrival"><input style={inp} type="date" value={f.expectedDate} onChange={e=>set("expectedDate",e.target.value)}/></Field>
        <div style={{gridColumn:"1/-1"}}>
          <Field label="Status">
            <div style={{display:"flex",gap:"0.4rem",flexWrap:"wrap"}}>
              {US_STATUSES.map(s=>{const cfg=US_STATUS_CFG[s];const a=f.status===s;return <button key={s} onClick={()=>set("status",s)} style={{padding:"0.3rem 0.8rem",borderRadius:"20px",border:`1.5px solid ${a?cfg.color:"#e2e8f0"}`,background:a?cfg.bg:"#fff",color:a?cfg.color:"#64748b",fontSize:"0.75rem",fontWeight:600,cursor:"pointer"}}>{s}</button>;})}</div>
          </Field>
        </div>
        <div style={{gridColumn:"1/-1"}}><Field label="Note"><input style={inp} value={f.note} onChange={e=>set("note",e.target.value)} placeholder="Batch notes, special instructions..."/></Field></div>
      </div>

      <div style={{background:C.lightSky,borderRadius:"10px",padding:"0.8rem 1rem",marginBottom:"1rem",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:"0.82rem",color:C.navy}}>
          <strong>{f.qty} units</strong> of <strong>{prod?.name||"—"}</strong>
          {f.expectedDate&&<> · Expected <strong>{f.expectedDate}</strong></>}
        </div>
        <div style={{fontFamily:"'DM Sans','Segoe UI',sans-serif",fontWeight:800,fontSize:"1.05rem",color:C.navy}}>৳ {(f.qty*f.unitCost).toLocaleString()}</div>
      </div>

      <div style={{display:"flex",gap:"0.65rem"}}>
        <button onClick={()=>onSave(f)} style={{flex:1,padding:"0.68rem",background:C.sky,color:"#fff",border:"none",borderRadius:"8px",fontWeight:700,fontSize:"0.86rem",cursor:"pointer",fontFamily:"inherit"}}>{initial?"Update Order":"Add Incoming Stock"}</button>
        <button onClick={onClose} style={{padding:"0.68rem 1.1rem",background:"#f1f5f9",color:"#64748b",border:"none",borderRadius:"8px",cursor:"pointer",fontFamily:"inherit"}}>Cancel</button>
      </div>
    </div>
  );
}

// ── TRANSACTION FORM ──────────────────────────────────────────────────────────
function TxForm({products,onSave,onClose}) {
  const [f,setF]=useState({type:"sale",productId:products[0]?.id||"",qty:1,platform:"Daraz",date:new Date().toISOString().split("T")[0],note:""});
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const prod=products.find(p=>p.id===f.productId);
  const delta=f.type==="sale"?-Math.abs(f.qty):Math.abs(f.qty);
  return (
    <div>
      <Field label="Type">
        <div style={{display:"flex",gap:"0.45rem"}}>
          {["sale","restock","adjustment"].map(t=><button key={t} onClick={()=>set("type",t)} style={{flex:1,padding:"0.48rem",borderRadius:"8px",border:"1.5px solid",borderColor:f.type===t?C.sky:"#e2e8f0",background:f.type===t?C.lightSky:"#fff",color:f.type===t?C.navy:"#64748b",fontWeight:600,fontSize:"0.78rem",cursor:"pointer",textTransform:"capitalize"}}>{t}</button>)}
        </div>
      </Field>
      <Field label="Product"><select style={sel} value={f.productId} onChange={e=>set("productId",e.target.value)}>{products.map(p=><option key={p.id} value={p.id}>{p.name} (Stock: {p.stock})</option>)}</select></Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 1rem"}}>
        <Field label="Quantity"><input style={inp} type="number" value={f.qty} onChange={e=>set("qty",+e.target.value)}/></Field>
        <Field label="Date"><input style={inp} type="date" value={f.date} onChange={e=>set("date",e.target.value)}/></Field>
      </div>
      <Field label="Platform"><input style={inp} value={f.platform} onChange={e=>set("platform",e.target.value)}/></Field>
      <Field label="Note"><input style={inp} value={f.note} onChange={e=>set("note",e.target.value)}/></Field>
      {prod&&<div style={{background:"#f0f7ff",borderRadius:"8px",padding:"0.65rem 1rem",marginBottom:"1rem",fontSize:"0.8rem",color:C.navy}}><strong>{prod.name}</strong> · Stock: <strong>{prod.stock}</strong> → <strong style={{color:f.type==="sale"?"#ef4444":"#10b981"}}>{Math.max(0,prod.stock+delta)}</strong></div>}
      <div style={{display:"flex",gap:"0.65rem"}}>
        <button onClick={()=>onSave(f)} style={{flex:1,padding:"0.68rem",background:C.sky,color:"#fff",border:"none",borderRadius:"8px",fontWeight:700,fontSize:"0.86rem",cursor:"pointer",fontFamily:"inherit"}}>Record</button>
        <button onClick={onClose} style={{padding:"0.68rem 1.1rem",background:"#f1f5f9",color:"#64748b",border:"none",borderRadius:"8px",cursor:"pointer",fontFamily:"inherit"}}>Cancel</button>
      </div>
    </div>
  );
}


// ── LOGIN SCREEN ──────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleLogin = () => {
    if (!username.trim() || !password.trim()) { setError("Please fill in all fields."); return; }
    setLoading(true);
    setTimeout(() => {
      let users = loadUsers();
      if (!users) {
        // first-run: seed default users with hashed passwords
        users = DEFAULT_USERS.map(u => ({ ...u, password: hashPass(u.password) }));
        saveUsers(users);
      }
      const found = users.find(u => u.username === username.trim().toLowerCase() && u.password === hashPass(password));
      if (found) {
        const session = { id: found.id, name: found.name, username: found.username, role: found.role };
        setSession(session);
        onLogin(session);
      } else {
        setError("Incorrect username or password.");
        setLoading(false);
      }
    }, 400);
  };

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#1B3A6B 0%,#2d5aa0 50%,#4A90D9 100%)", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans','Segoe UI',sans-serif", padding:"1rem" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/>
      <div style={{ width:"100%", maxWidth:"400px" }}>
        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:"2rem" }}>
          <div style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:"56px", height:"56px", background:"rgba(255,255,255,0.15)", borderRadius:"14px", marginBottom:"0.9rem", backdropFilter:"blur(10px)" }}>
            <span style={{ color:"#fff", fontWeight:800, fontSize:"1.4rem" }}>S</span>
          </div>
          <div>
            <span style={{ color:"#7ec8f7", fontWeight:800, fontSize:"1.5rem" }}>SKY</span>
            <span style={{ color:"#fff", fontWeight:800, fontSize:"1.5rem" }}>OUTFIT</span>
            <span style={{ color:"rgba(255,255,255,0.5)", fontSize:"0.8rem", marginLeft:"0.5rem" }}>IMS</span>
          </div>
          <p style={{ color:"rgba(255,255,255,0.6)", fontSize:"0.82rem", marginTop:"0.3rem" }}>Inventory Management System</p>
        </div>

        {/* Card */}
        <div style={{ background:"#fff", borderRadius:"18px", padding:"2rem", boxShadow:"0 30px 80px rgba(0,0,0,0.3)" }}>
          <h2 style={{ margin:"0 0 1.5rem", fontSize:"1.15rem", fontWeight:800, color:"#1B3A6B", textAlign:"center" }}>Sign in to your account</h2>

          {error && (
            <div style={{ background:"#fef2f2", border:"1.5px solid #fecaca", borderRadius:"8px", padding:"0.65rem 0.9rem", marginBottom:"1rem", fontSize:"0.8rem", color:"#dc2626", display:"flex", alignItems:"center", gap:"0.5rem" }}>
              ⚠️ {error}
            </div>
          )}

          <div style={{ marginBottom:"1rem" }}>
            <label style={{ display:"block", fontSize:"0.7rem", fontWeight:700, color:"#1B3A6B", marginBottom:"0.3rem", textTransform:"uppercase", letterSpacing:"0.05em" }}>Username</label>
            <input
              value={username}
              onChange={e=>{ setUsername(e.target.value); setError(""); }}
              onKeyDown={e=>e.key==="Enter"&&handleLogin()}
              placeholder="Enter username"
              style={{ width:"100%", padding:"0.65rem 0.85rem", border:"1.5px solid #e2e8f0", borderRadius:"9px", fontSize:"0.9rem", outline:"none", fontFamily:"inherit", boxSizing:"border-box", background:"#fafbfc", transition:"border 0.15s" }}
              autoFocus
            />
          </div>

          <div style={{ marginBottom:"1.4rem" }}>
            <label style={{ display:"block", fontSize:"0.7rem", fontWeight:700, color:"#1B3A6B", marginBottom:"0.3rem", textTransform:"uppercase", letterSpacing:"0.05em" }}>Password</label>
            <div style={{ position:"relative" }}>
              <input
                type={showPass?"text":"password"}
                value={password}
                onChange={e=>{ setPassword(e.target.value); setError(""); }}
                onKeyDown={e=>e.key==="Enter"&&handleLogin()}
                placeholder="Enter password"
                style={{ width:"100%", padding:"0.65rem 2.5rem 0.65rem 0.85rem", border:"1.5px solid #e2e8f0", borderRadius:"9px", fontSize:"0.9rem", outline:"none", fontFamily:"inherit", boxSizing:"border-box", background:"#fafbfc" }}
              />
              <button onClick={()=>setShowPass(v=>!v)} style={{ position:"absolute", right:"10px", top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"#94a3b8", fontSize:"0.8rem", padding:"2px" }}>
                {showPass?"🙈":"👁️"}
              </button>
            </div>
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{ width:"100%", padding:"0.75rem", background: loading?"#94a3b8":"#1B3A6B", color:"#fff", border:"none", borderRadius:"9px", fontWeight:700, fontSize:"0.9rem", cursor: loading?"not-allowed":"pointer", fontFamily:"inherit", transition:"background 0.15s" }}
          >
            {loading ? "Signing in…" : "Sign In →"}
          </button>
        </div>

        <p style={{ textAlign:"center", color:"rgba(255,255,255,0.4)", fontSize:"0.72rem", marginTop:"1.2rem" }}>
          SkyOutfit IMS · Secure Access Only
        </p>
      </div>
    </div>
  );
}

// ── USER MANAGEMENT MODAL ─────────────────────────────────────────────────────
function UserManager({ currentUser, onClose }) {
  const [users, setUsers]       = useState(()=>{ const u=loadUsers(); return u||DEFAULT_USERS.map(u=>({...u,password:hashPass(u.password)})); });
  const [form, setForm]         = useState({ name:"", username:"", password:"", role:"staff" });
  const [editId, setEditId]     = useState(null);
  const [err, setErr]           = useState("");
  const [tab, setTab]           = useState("list");
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const saveUser = () => {
    if (!form.name.trim() || !form.username.trim()) { setErr("Name and username are required."); return; }
    if (!editId && !form.password.trim()) { setErr("Password is required for new users."); return; }
    const uname = form.username.trim().toLowerCase();
    const duplicate = users.find(u => u.username === uname && u.id !== editId);
    if (duplicate) { setErr("Username already exists."); return; }
    let updated;
    if (editId) {
      updated = users.map(u => u.id === editId ? {
        ...u, name: form.name.trim(), username: uname, role: form.role,
        ...(form.password ? { password: hashPass(form.password) } : {})
      } : u);
    } else {
      const id = "U" + String(Date.now()).slice(-4);
      updated = [...users, { id, name: form.name.trim(), username: uname, password: hashPass(form.password), role: form.role, createdAt: new Date().toISOString().split("T")[0] }];
    }
    saveUsers(updated);
    setUsers(updated);
    setForm({ name:"", username:"", password:"", role:"staff" });
    setEditId(null);
    setErr("");
    setTab("list");
  };

  const deleteUser = (id) => {
    if (id === currentUser.id) { alert("You cannot delete your own account."); return; }
    if (!confirm("Delete this user?")) return;
    const updated = users.filter(u => u.id !== id);
    saveUsers(updated);
    setUsers(updated);
  };

  const startEdit = (u) => {
    setForm({ name: u.name, username: u.username, password:"", role: u.role });
    setEditId(u.id);
    setTab("form");
    setErr("");
  };

  const ROLE_CFG = { admin:{ color:"#7c3aed",bg:"#ede9fe",label:"Admin" }, staff:{ color:"#0369a1",bg:"#e0f2fe",label:"Staff" } };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(10,20,40,0.72)", backdropFilter:"blur(5px)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}>
      <div style={{ background:"#fff", borderRadius:"14px", width:"100%", maxWidth:"560px", maxHeight:"88vh", overflowY:"auto", boxShadow:"0 30px 70px rgba(10,20,40,0.35)", fontFamily:"'DM Sans','Segoe UI',sans-serif" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"1.1rem 1.4rem", borderBottom:"1.5px solid #e8edf5", position:"sticky", top:0, background:"#fff", zIndex:1 }}>
          <h3 style={{ margin:0, fontSize:"1rem", fontWeight:800, color:"#1B3A6B" }}>👥 User Management</h3>
          <button onClick={onClose} style={{ background:"#f1f5f9", border:"none", borderRadius:"6px", padding:"6px 10px", cursor:"pointer", fontSize:"0.8rem", color:"#64748b" }}>✕ Close</button>
        </div>

        <div style={{ padding:"1.2rem 1.4rem" }}>
          <div style={{ display:"flex", gap:"0.5rem", marginBottom:"1.2rem" }}>
            <button onClick={()=>{setTab("list");setEditId(null);setForm({name:"",username:"",password:"",role:"staff"});setErr("");}} style={{ padding:"0.4rem 0.9rem", borderRadius:"7px", border:"none", background:tab==="list"?"#1B3A6B":"#f1f5f9", color:tab==="list"?"#fff":"#475569", fontWeight:600, fontSize:"0.78rem", cursor:"pointer" }}>All Users ({users.length})</button>
            <button onClick={()=>{setTab("form");setEditId(null);setForm({name:"",username:"",password:"",role:"staff"});setErr("");}} style={{ padding:"0.4rem 0.9rem", borderRadius:"7px", border:"none", background:tab==="form"&&!editId?"#4A90D9":"#f1f5f9", color:tab==="form"&&!editId?"#fff":"#475569", fontWeight:600, fontSize:"0.78rem", cursor:"pointer" }}>+ Add User</button>
          </div>

          {tab==="list" && (
            <div style={{ display:"flex", flexDirection:"column", gap:"0.6rem" }}>
              {users.map(u => {
                const rc = ROLE_CFG[u.role]||ROLE_CFG.staff;
                return (
                  <div key={u.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0.75rem 1rem", border:"1.5px solid #e8edf5", borderRadius:"10px", background: u.id===currentUser.id?"#f0f7ff":"#fafbfc" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:"0.75rem" }}>
                      <div style={{ width:"36px", height:"36px", borderRadius:"50%", background:"#1B3A6B", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:800, fontSize:"0.9rem", flexShrink:0 }}>
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight:700, fontSize:"0.88rem", color:"#1e293b" }}>{u.name} {u.id===currentUser.id&&<span style={{fontSize:"0.65rem",color:"#4A90D9"}}>(you)</span>}</div>
                        <div style={{ fontSize:"0.72rem", color:"#94a3b8" }}>@{u.username} · Joined {u.createdAt}</div>
                      </div>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:"0.5rem" }}>
                      <span style={{ fontSize:"0.68rem", fontWeight:700, color:rc.color, background:rc.bg, padding:"2px 8px", borderRadius:"20px" }}>{rc.label}</span>
                      {currentUser.role==="admin" && (
                        <>
                          <button onClick={()=>startEdit(u)} style={{ padding:"5px 8px", background:"#f0f7ff", border:"none", borderRadius:"6px", cursor:"pointer", color:"#4A90D9", fontSize:"0.72rem", fontWeight:600 }}>Edit</button>
                          {u.id!==currentUser.id&&<button onClick={()=>deleteUser(u.id)} style={{ padding:"5px 8px", background:"#fff0f0", border:"none", borderRadius:"6px", cursor:"pointer", color:"#ef4444", fontSize:"0.72rem", fontWeight:600 }}>Delete</button>}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab==="form" && (
            <div>
              <h4 style={{ margin:"0 0 1rem", fontSize:"0.9rem", fontWeight:700, color:"#1B3A6B" }}>{editId?"Edit User":"Add New User"}</h4>
              {err&&<div style={{background:"#fef2f2",border:"1.5px solid #fecaca",borderRadius:"8px",padding:"0.6rem 0.9rem",marginBottom:"0.9rem",fontSize:"0.78rem",color:"#dc2626"}}>⚠️ {err}</div>}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 1rem" }}>
                <div style={{ marginBottom:"0.85rem" }}>
                  <label style={{ display:"block", fontSize:"0.68rem", fontWeight:700, color:"#1B3A6B", marginBottom:"0.28rem", textTransform:"uppercase", letterSpacing:"0.05em" }}>Full Name</label>
                  <input value={form.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. Rahim Uddin" style={{ width:"100%", padding:"0.52rem 0.72rem", border:"1.5px solid #e2e8f0", borderRadius:"8px", fontSize:"0.86rem", outline:"none", fontFamily:"inherit", boxSizing:"border-box", background:"#fafbfc" }}/>
                </div>
                <div style={{ marginBottom:"0.85rem" }}>
                  <label style={{ display:"block", fontSize:"0.68rem", fontWeight:700, color:"#1B3A6B", marginBottom:"0.28rem", textTransform:"uppercase", letterSpacing:"0.05em" }}>Username</label>
                  <input value={form.username} onChange={e=>set("username",e.target.value)} placeholder="e.g. rahim" style={{ width:"100%", padding:"0.52rem 0.72rem", border:"1.5px solid #e2e8f0", borderRadius:"8px", fontSize:"0.86rem", outline:"none", fontFamily:"inherit", boxSizing:"border-box", background:"#fafbfc" }}/>
                </div>
                <div style={{ marginBottom:"0.85rem" }}>
                  <label style={{ display:"block", fontSize:"0.68rem", fontWeight:700, color:"#1B3A6B", marginBottom:"0.28rem", textTransform:"uppercase", letterSpacing:"0.05em" }}>{editId?"New Password (blank = unchanged)":"Password"}</label>
                  <input type="password" value={form.password} onChange={e=>set("password",e.target.value)} placeholder="Enter password" style={{ width:"100%", padding:"0.52rem 0.72rem", border:"1.5px solid #e2e8f0", borderRadius:"8px", fontSize:"0.86rem", outline:"none", fontFamily:"inherit", boxSizing:"border-box", background:"#fafbfc" }}/>
                </div>
                <div style={{ marginBottom:"0.85rem" }}>
                  <label style={{ display:"block", fontSize:"0.68rem", fontWeight:700, color:"#1B3A6B", marginBottom:"0.28rem", textTransform:"uppercase", letterSpacing:"0.05em" }}>Role</label>
                  <select value={form.role} onChange={e=>set("role",e.target.value)} style={{ width:"100%", padding:"0.52rem 0.72rem", border:"1.5px solid #e2e8f0", borderRadius:"8px", fontSize:"0.86rem", outline:"none", fontFamily:"inherit", boxSizing:"border-box", background:"#fafbfc", cursor:"pointer" }}>
                    <option value="admin">Admin (full access)</option>
                    <option value="staff">Staff (view + transactions)</option>
                  </select>
                </div>
              </div>
              <div style={{ display:"flex", gap:"0.6rem", marginTop:"0.5rem" }}>
                <button onClick={saveUser} style={{ flex:1, padding:"0.65rem", background:"#1B3A6B", color:"#fff", border:"none", borderRadius:"8px", fontWeight:700, fontSize:"0.86rem", cursor:"pointer", fontFamily:"inherit" }}>{editId?"Update User":"Add User"}</button>
                <button onClick={()=>{setTab("list");setEditId(null);setErr("");}} style={{ padding:"0.65rem 1rem", background:"#f1f5f9", color:"#64748b", border:"none", borderRadius:"8px", cursor:"pointer", fontFamily:"inherit" }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [data,setData]=useState(null);
  const [tab,setTab]=useState("inventory");
  const [search,setSearch]=useState("");
  const [filterCat,setFilterCat]=useState("All");
  const [filterPlatform,setFilterPlatform]=useState("All");
  const [modal,setModal]=useState(null);
  const [editTarget,setEditTarget]=useState(null);
  const [costProd,setCostProd]=useState(null);
  const [toast,setToast]=useState(null);
  const [loaded,setLoaded]=useState(false);
  const [currentUser,setCurrentUser]=useState(()=>getSession());
  const [showUserMgr,setShowUserMgr]=useState(false);

  useEffect(()=>{const d=loadData();setData(d||SEED);setLoaded(true);},[]);
  useEffect(()=>{if(loaded&&data)saveData(data);},[data,loaded]);

  const showToast=(msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast(null),3000);};

  // ── Not logged in → show login screen ──
  if(!currentUser) return <LoginScreen onLogin={u=>{setCurrentUser(u);}}/>;

  if(!loaded) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",color:C.sky,fontFamily:"sans-serif"}}>Loading SkyOutfit IMS…</div>;

  const {products,transactions,upcomingStock}=data;

  const saveProduct=f=>{
    if(editTarget){setData(d=>({...d,products:d.products.map(p=>p.id===editTarget.id?{...f,id:p.id}:p)}));showToast("Updated!");}
    else{const id="P"+String(data.nextPId).padStart(3,"0");setData(d=>({...d,products:[...d.products,{...f,id}],nextPId:d.nextPId+1}));showToast("Product added!");}
    setModal(null);setEditTarget(null);
  };
  const deleteProduct=id=>{if(!confirm("Delete?"))return;setData(d=>({...d,products:d.products.filter(p=>p.id!==id)}));showToast("Deleted.","info");};
  const saveTx=f=>{
    const id="T"+String(data.nextTxId).padStart(3,"0");
    const delta=f.type==="sale"?-Math.abs(f.qty):Math.abs(f.qty);
    setData(d=>({...d,transactions:[{...f,id},...d.transactions],nextTxId:d.nextTxId+1,products:d.products.map(p=>p.id===f.productId?{...p,stock:Math.max(0,p.stock+delta)}:p)}));
    setModal(null);showToast("Transaction recorded!");
  };
  const saveUpcoming=f=>{
    if(editTarget){setData(d=>({...d,upcomingStock:d.upcomingStock.map(u=>u.id===editTarget.id?{...f,id:u.id}:u)}));showToast("Order updated!");}
    else{const id="US"+String(data.nextUsId).padStart(3,"0");setData(d=>({...d,upcomingStock:[{...f,id},...d.upcomingStock],nextUsId:d.nextUsId+1}));showToast("Incoming stock added!");}
    setModal(null);setEditTarget(null);
  };
  const receiveStock=us=>{
    if(!confirm(`Receive ${us.qty} units of "${products.find(p=>p.id===us.productId)?.name}"?`))return;
    setData(d=>({
      ...d,
      upcomingStock:d.upcomingStock.map(u=>u.id===us.id?{...u,status:"Arrived"}:u),
      products:d.products.map(p=>p.id===us.productId?{...p,stock:p.stock+us.qty}:p),
      transactions:[{id:"T"+String(d.nextTxId).padStart(3,"0"),type:"restock",productId:us.productId,qty:us.qty,platform:us.supplierName||"Supplier",date:new Date().toISOString().split("T")[0],note:`PO ${us.id} received`},...d.transactions],
      nextTxId:d.nextTxId+1,
    }));
    showToast("Stock received & added!");
  };
  const deleteUpcoming=id=>{if(!confirm("Remove order?"))return;setData(d=>({...d,upcomingStock:d.upcomingStock.filter(u=>u.id!==id)}));showToast("Removed.","info");};

  // stats
  const totalUnits=products.reduce((s,p)=>s+p.stock,0);
  const totalValue=products.reduce((s,p)=>s+p.stock*calcCost(p),0);
  const lowStock=products.filter(p=>p.stock>0&&p.stock<=p.reorderPoint).length;
  const outOfStock=products.filter(p=>p.stock===0).length;
  const avgMargin=products.length?Math.round(products.reduce((s,p)=>s+calcMargin(p),0)/products.length):0;
  const pendingOrders=upcomingStock.filter(u=>u.status!=="Arrived"&&u.status!=="Cancelled").length;
  const incomingUnits=upcomingStock.filter(u=>u.status!=="Arrived"&&u.status!=="Cancelled").reduce((s,u)=>s+u.qty,0);

  const filtered=products.filter(p=>{
    const ms=p.name.toLowerCase().includes(search.toLowerCase())||p.sku.toLowerCase().includes(search.toLowerCase());
    const mc=filterCat==="All"||p.category===filterCat;
    const mp=filterPlatform==="All"||p.platform.includes(filterPlatform);
    return ms&&mc&&mp;
  });

  const NAV=[
    {id:"inventory",label:"Inventory",icon:Ic.box},
    {id:"upcoming",label:"Upcoming Stock",icon:Ic.incoming},
    {id:"transactions",label:"Transactions",icon:Ic.truck},
    {id:"analytics",label:"Analytics",icon:Ic.chart},
  ];

  return (
    <div style={{minHeight:"100vh",background:"#EFF3FA",fontFamily:"'DM Sans','Segoe UI',sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/>

      {/* HEADER */}
      <header style={{background:C.navy,padding:"0 1.4rem",display:"flex",alignItems:"center",justifyContent:"space-between",height:"56px",position:"sticky",top:0,zIndex:50,boxShadow:"0 2px 20px rgba(0,0,0,0.2)"}}>
        <div style={{display:"flex",alignItems:"center",gap:"0.65rem"}}>
          <div style={{background:C.sky,borderRadius:"7px",width:"29px",height:"29px",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{color:"#fff",fontFamily:"'DM Sans','Segoe UI',sans-serif",fontWeight:800,fontSize:"0.78rem"}}>S</span>
          </div>
          <div>
            <span style={{color:C.sky,fontFamily:"'DM Sans','Segoe UI',sans-serif",fontWeight:800,fontSize:"0.98rem"}}>SKY</span>
            <span style={{color:"#fff",fontFamily:"'DM Sans','Segoe UI',sans-serif",fontWeight:800,fontSize:"0.98rem"}}>OUTFIT</span>
            <span style={{color:"#7fa8d4",fontSize:"0.68rem",marginLeft:"0.4rem"}}>IMS</span>
          </div>
        </div>
        <nav style={{display:"flex",gap:"0.1rem"}}>
          {NAV.map(n=>(
            <button key={n.id} onClick={()=>setTab(n.id)} style={{padding:"0.4rem 0.9rem",borderRadius:"6px",border:"none",background:tab===n.id?"rgba(74,144,217,0.22)":"transparent",color:tab===n.id?C.sky:"#7fa8d4",fontWeight:600,fontSize:"0.78rem",cursor:"pointer",display:"flex",alignItems:"center",gap:"0.35rem",transition:"all 0.15s",position:"relative",fontFamily:"inherit",whiteSpace:"nowrap"}}>
              <n.icon/>{n.label}
              {n.id==="upcoming"&&pendingOrders>0&&<span style={{position:"absolute",top:"2px",right:"2px",background:"#f59e0b",color:C.navy,fontSize:"0.58rem",fontWeight:800,borderRadius:"20px",padding:"0 4px",lineHeight:"14px"}}>{pendingOrders}</span>}
            </button>
          ))}
        </nav>
        <div style={{display:"flex",gap:"0.45rem",alignItems:"center"}}>
          <button onClick={()=>{setEditTarget(null);setModal("addUpcoming");}} style={{padding:"0.4rem 0.85rem",background:"rgba(74,144,217,0.18)",color:C.sky,border:"1px solid rgba(74,144,217,0.35)",borderRadius:"7px",fontWeight:700,fontSize:"0.76rem",cursor:"pointer",display:"flex",alignItems:"center",gap:"0.3rem"}}>
            <Ic.incoming/>Incoming
          </button>
          <button onClick={()=>setModal("addTx")} style={{padding:"0.4rem 0.85rem",background:C.gold,color:C.navy,border:"none",borderRadius:"7px",fontWeight:700,fontSize:"0.76rem",cursor:"pointer",display:"flex",alignItems:"center",gap:"0.3rem"}}>
            <Ic.plus/>Transaction
          </button>
          {/* divider */}
          <div style={{width:"1px",height:"22px",background:"rgba(255,255,255,0.15)",margin:"0 0.2rem"}}/>
          {/* user pill */}
          <div style={{display:"flex",alignItems:"center",gap:"0.5rem",background:"rgba(255,255,255,0.08)",borderRadius:"8px",padding:"0.3rem 0.7rem"}}>
            <div style={{width:"24px",height:"24px",borderRadius:"50%",background:C.sky,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:"0.72rem",flexShrink:0}}>
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{fontSize:"0.72rem",fontWeight:700,color:"#fff",lineHeight:1}}>{currentUser.name}</div>
              <div style={{fontSize:"0.6rem",color:"rgba(255,255,255,0.5)",textTransform:"uppercase",letterSpacing:"0.05em"}}>{currentUser.role}</div>
            </div>
          </div>
          {currentUser.role==="admin"&&(
            <button onClick={()=>setShowUserMgr(true)} style={{padding:"0.35rem 0.7rem",background:"rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.8)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:"7px",fontWeight:600,fontSize:"0.72rem",cursor:"pointer"}}>
              👥 Users
            </button>
          )}
          <button onClick={()=>{clearSession();setCurrentUser(null);}} style={{padding:"0.35rem 0.7rem",background:"rgba(239,68,68,0.15)",color:"#fca5a5",border:"1px solid rgba(239,68,68,0.25)",borderRadius:"7px",fontWeight:600,fontSize:"0.72rem",cursor:"pointer"}}>
            Sign Out
          </button>
        </div>
      </header>

      <main style={{padding:"1.4rem 1.5rem",maxWidth:"1400px",margin:"0 auto"}}>

        {/* STAT CARDS */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:"0.9rem",marginBottom:"1.2rem"}}>
          {[
            {label:"Total SKUs",value:String(products.length),color:C.sky,emoji:"📦"},
            {label:"Total Units",value:totalUnits.toLocaleString(),color:C.navy,emoji:"🗃️"},
            {label:"Stock Value",value:`৳${(totalValue/1000).toFixed(1)}k`,color:"#2E8B57",emoji:"💰"},
            {label:"Avg Margin",value:`${avgMargin}%`,color:avgMargin>=35?"#10b981":avgMargin>=20?"#f59e0b":"#ef4444",emoji:"📊"},
            {label:"Needs Reorder",value:lowStock+outOfStock,color:"#f59e0b",emoji:"⚠️",alert:lowStock+outOfStock>0},
            {label:"Incoming",value:`${pendingOrders} orders`,color:C.sky,emoji:"🚚",sub:`${incomingUnits} units`},
          ].map((s,i)=>(
            <div key={i} style={{background:"#fff",borderRadius:"11px",padding:"1rem 1.1rem",boxShadow:"0 2px 12px rgba(27,58,107,0.07)",border:s.alert?"1.5px solid #fcd34d44":"1.5px solid transparent",position:"relative",display:"flex",flexDirection:"column",gap:"0"}}>
              <div style={{fontSize:"1.05rem",lineHeight:1,marginBottom:"0.4rem"}}>{s.emoji}</div>
              <div style={{fontSize:"1.45rem",fontFamily:"'DM Sans','Segoe UI',sans-serif",fontWeight:800,color:s.color,lineHeight:1,letterSpacing:"-0.02em"}}>{s.value}</div>
              {s.sub&&<div style={{fontSize:"0.72rem",fontFamily:"'DM Sans','Segoe UI',sans-serif",fontWeight:700,color:C.sky,lineHeight:1,marginTop:"0.18rem"}}>{s.sub}</div>}
              <div style={{fontSize:"0.68rem",fontFamily:"'DM Sans','Segoe UI',sans-serif",fontWeight:500,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.06em",marginTop:"0.35rem"}}>{s.label}</div>
              {s.alert&&<div style={{position:"absolute",top:"8px",right:"8px",width:"7px",height:"7px",borderRadius:"50%",background:"#f59e0b",animation:"pulse 1.5s infinite"}}/>}
            </div>
          ))}
        </div>

        {/* ══ INVENTORY TAB ══ */}
        {tab==="inventory"&&<>
          <div style={{display:"flex",gap:"0.6rem",marginBottom:"0.9rem",flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:"170px",position:"relative"}}>
              <span style={{position:"absolute",left:"9px",top:"50%",transform:"translateY(-50%)",color:"#94a3b8"}}><Ic.search/></span>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name or SKU…" style={{...inp,paddingLeft:"1.9rem",background:"#fff"}}/>
            </div>
            <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={{...sel,width:"auto",background:"#fff"}}><option>All</option>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select>
            <select value={filterPlatform} onChange={e=>setFilterPlatform(e.target.value)} style={{...sel,width:"auto",background:"#fff"}}><option>All</option>{PLATFORMS.map(p=><option key={p}>{p}</option>)}</select>
            <button onClick={()=>{setEditTarget(null);setModal("addProduct");}} style={{padding:"0.52rem 1rem",background:C.navy,color:"#fff",border:"none",borderRadius:"8px",fontWeight:700,fontSize:"0.8rem",cursor:"pointer",display:"flex",alignItems:"center",gap:"0.35rem"}}><Ic.plus/>Add Product</button>
          </div>

          {(lowStock>0||outOfStock>0)&&<div style={{background:"#fffbeb",border:"1.5px solid #fcd34d",borderRadius:"9px",padding:"0.6rem 0.9rem",marginBottom:"0.9rem",display:"flex",alignItems:"center",gap:"0.55rem",fontSize:"0.82rem"}}>
            ⚠️ <span style={{color:"#92400e",fontWeight:500}}>{outOfStock>0&&<><strong>{outOfStock}</strong> out-of-stock. </>}{lowStock>0&&<><strong>{lowStock}</strong> below reorder point.</>}</span>
          </div>}

          <div style={{background:"#fff",borderRadius:"13px",overflow:"hidden",boxShadow:"0 2px 16px rgba(27,58,107,0.08)"}}>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead>
                  <tr style={{background:"#F8FAFD"}}>
                    {["SKU","Product","Category","Age","Stock","Cost","Price","Margin","Platforms","Status","Actions"].map(h=>(
                      <th key={h} style={{padding:"0.65rem 0.8rem",textAlign:"left",fontSize:"0.67rem",fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.05em",borderBottom:"1.5px solid #e8edf5",whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p,i)=>{
                    const st=stockStatus(p); const cost=calcCost(p); const margin=calcMargin(p);
                    return (
                      <tr key={p.id} style={{borderBottom:"1px solid #f1f5f9",background:i%2===0?"#fff":"#fafbfd"}}>
                        <td style={{padding:"0.7rem 0.8rem"}}><span style={{fontFamily:"monospace",fontSize:"0.72rem",background:"#EBF5FF",color:C.navy,padding:"2px 5px",borderRadius:"4px"}}>{p.sku}</span></td>
                        <td style={{padding:"0.7rem 0.8rem"}}><div style={{fontWeight:600,fontSize:"0.85rem",color:"#1e293b",lineHeight:1.3}}>{p.name}</div><div style={{fontSize:"0.7rem",color:"#94a3b8",marginTop:"1px"}}>{p.color}</div></td>
                        <td style={{padding:"0.7rem 0.8rem",fontSize:"0.78rem",color:"#475569"}}>{p.category}</td>
                        <td style={{padding:"0.7rem 0.8rem"}}><Badge color="#475569" bg="#f1f5f9">{p.ageRange}</Badge></td>
                        <td style={{padding:"0.7rem 0.8rem"}}><div style={{fontWeight:700,fontSize:"0.9rem",color:st.color}}>{p.stock}</div><div style={{fontSize:"0.63rem",color:"#94a3b8"}}>min {p.reorderPoint}</div></td>
                        <td style={{padding:"0.7rem 0.8rem",fontSize:"0.8rem",color:"#475569"}}>৳{cost}</td>
                        <td style={{padding:"0.7rem 0.8rem",fontSize:"0.82rem",fontWeight:600,color:"#1e293b"}}>৳{p.price}</td>
                        <td style={{padding:"0.7rem 0.8rem"}}><span style={{fontSize:"0.8rem",fontWeight:700,color:margin>=35?"#10b981":margin>=20?"#f59e0b":"#ef4444"}}>{margin}%</span></td>
                        <td style={{padding:"0.7rem 0.8rem"}}><div style={{display:"flex",gap:"0.18rem",flexWrap:"wrap"}}>{p.platform.map(pl=><Badge key={pl}>{pl}</Badge>)}</div></td>
                        <td style={{padding:"0.7rem 0.8rem"}}><span style={{display:"inline-flex",alignItems:"center",gap:"3px",fontSize:"0.68rem",fontWeight:700,color:st.color,background:st.bg,padding:"2px 7px",borderRadius:"20px"}}><span style={{width:"5px",height:"5px",borderRadius:"50%",background:st.dot,flexShrink:0}}/>{st.label}</span></td>
                        <td style={{padding:"0.7rem 0.8rem"}}>
                          <div style={{display:"flex",gap:"0.28rem"}}>
                            <button title="Cost Breakdown" onClick={()=>setCostProd(p)} style={{padding:"5px",background:"#f0fdf4",border:"none",borderRadius:"6px",cursor:"pointer",color:"#10b981",display:"flex"}}><Ic.cost/></button>
                            <button title="Edit" onClick={()=>{setEditTarget(p);setModal("editProduct");}} style={{padding:"5px",background:"#f0f7ff",border:"none",borderRadius:"6px",cursor:"pointer",color:C.sky,display:"flex"}}><Ic.edit/></button>
                            <button title="Delete" onClick={()=>deleteProduct(p.id)} style={{padding:"5px",background:"#fff0f0",border:"none",borderRadius:"6px",cursor:"pointer",color:"#ef4444",display:"flex"}}><Ic.trash/></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length===0&&<div style={{padding:"2.5rem",textAlign:"center",color:"#94a3b8"}}>No products match your filters.</div>}
            </div>
          </div>
        </>}

        {/* ══ UPCOMING STOCK TAB ══ */}
        {tab==="upcoming"&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"1rem"}}>
            <div>
              <h2 style={{margin:0,fontFamily:"'DM Sans','Segoe UI',sans-serif",fontSize:"1.1rem",color:C.navy}}>Upcoming Stock & Purchase Orders</h2>
              <p style={{margin:"0.15rem 0 0",fontSize:"0.76rem",color:"#94a3b8"}}>{pendingOrders} active orders · {incomingUnits} units on the way</p>
            </div>
            <button onClick={()=>{setEditTarget(null);setModal("addUpcoming");}} style={{padding:"0.52rem 1rem",background:C.sky,color:"#fff",border:"none",borderRadius:"8px",fontWeight:700,fontSize:"0.8rem",cursor:"pointer",display:"flex",alignItems:"center",gap:"0.35rem"}}><Ic.plus/>New Order</button>
          </div>

          <div style={{display:"flex",gap:"0.55rem",marginBottom:"1rem",flexWrap:"wrap"}}>
            {Object.entries(US_STATUS_CFG).map(([s,cfg])=>{
              const count=upcomingStock.filter(u=>u.status===s).length;
              return <div key={s} style={{background:"#fff",borderRadius:"9px",padding:"0.6rem 0.9rem",border:`1.5px solid ${cfg.color}33`,display:"flex",alignItems:"center",gap:"0.5rem"}}>
                <span style={{width:"8px",height:"8px",borderRadius:"50%",background:cfg.color,flexShrink:0}}/>
                <span style={{fontSize:"0.78rem",fontWeight:600,color:cfg.color}}>{s}</span>
                <span style={{fontFamily:"'DM Sans','Segoe UI',sans-serif",fontWeight:800,color:cfg.color,fontSize:"0.95rem"}}>{count}</span>
              </div>;
            })}
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:"0.7rem"}}>
            {upcomingStock.length===0&&<div style={{background:"#fff",borderRadius:"13px",padding:"2.5rem",textAlign:"center",color:"#94a3b8"}}>No orders yet. Add your first incoming stock order.</div>}
            {upcomingStock.map(us=>{
              const prod=products.find(p=>p.id===us.productId);
              const cfg=US_STATUS_CFG[us.status]||US_STATUS_CFG["Ordered"];
              const today=new Date(); const exp=us.expectedDate?new Date(us.expectedDate):null;
              const daysLeft=exp?Math.ceil((exp-today)/(1000*60*60*24)):null;
              const overdue=daysLeft!==null&&daysLeft<0&&us.status!=="Arrived"&&us.status!=="Cancelled";
              return (
                <div key={us.id} style={{background:"#fff",borderRadius:"13px",padding:"1rem 1.2rem",boxShadow:"0 2px 12px rgba(27,58,107,0.07)",border:`1.5px solid ${overdue?"#ef444433":cfg.color+"22"}`,display:"grid",gridTemplateColumns:"90px 1fr 180px 80px 120px 130px 120px 130px",alignItems:"center",gap:"0 1rem"}}>
                  
                  {/* COL 1 — Status + Overdue */}
                  <div>
                    <Badge color={cfg.color} bg={cfg.bg}>{us.status}</Badge>
                    {overdue&&<div style={{fontSize:"0.68rem",fontFamily:"'DM Sans',sans-serif",fontWeight:800,letterSpacing:"0.05em",color:"#ef4444",marginTop:"4px"}}>OVERDUE</div>}
                  </div>

                  {/* COL 2 — Product name + SKU */}
                  <div>
                    <div style={{fontWeight:700,fontSize:"0.88rem",fontFamily:"'DM Sans',sans-serif",color:"#1e293b",lineHeight:1.3}}>{prod?.name||us.productId}</div>
                    <div style={{fontSize:"0.69rem",fontFamily:"'DM Sans',sans-serif",color:"#94a3b8",marginTop:"2px"}}>{prod?.sku} · {prod?.category}</div>
                  </div>

                  {/* COL 3 — Supplier */}
                  <div>
                    <div style={{fontSize:"0.65rem",fontFamily:"'DM Sans',sans-serif",color:"#94a3b8",textTransform:"uppercase",fontWeight:600,letterSpacing:"0.06em",marginBottom:"2px"}}>Supplier</div>
                    <div style={{fontSize:"0.84rem",fontFamily:"'DM Sans',sans-serif",color:"#334155",fontWeight:600,lineHeight:1.3}}>{us.supplierName||"—"}</div>
                    {us.invoiceNo&&<div style={{fontSize:"0.67rem",fontFamily:"'DM Sans',sans-serif",fontWeight:500,color:C.sky,marginTop:"2px"}}>{us.invoiceNo}</div>}
                  </div>

                  {/* COL 4 — QTY */}
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:"0.65rem",fontFamily:"'DM Sans',sans-serif",color:"#94a3b8",textTransform:"uppercase",fontWeight:600,letterSpacing:"0.06em",marginBottom:"2px"}}>QTY</div>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontWeight:800,fontSize:"1.35rem",color:C.sky,lineHeight:1,letterSpacing:"-0.02em"}}>{us.qty}</div>
                    <div style={{fontSize:"0.67rem",fontFamily:"'DM Sans',sans-serif",color:"#94a3b8",fontWeight:500,marginTop:"2px"}}>units</div>
                  </div>

                  {/* COL 5 — Total Cost */}
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:"0.65rem",fontFamily:"'DM Sans',sans-serif",color:"#94a3b8",textTransform:"uppercase",fontWeight:600,letterSpacing:"0.06em",marginBottom:"2px"}}>Total Cost</div>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontWeight:800,fontSize:"1.1rem",color:C.navy,lineHeight:1,letterSpacing:"-0.01em"}}>৳{(us.qty*us.unitCost).toLocaleString()}</div>
                    <div style={{fontSize:"0.67rem",fontFamily:"'DM Sans',sans-serif",color:"#94a3b8",fontWeight:500,marginTop:"2px"}}>৳{us.unitCost}/unit</div>
                  </div>

                  {/* COL 6 — Ordered + Expected */}
                  <div>
                    <div style={{fontSize:"0.65rem",fontFamily:"'DM Sans',sans-serif",color:"#94a3b8",textTransform:"uppercase",fontWeight:600,letterSpacing:"0.06em"}}>Ordered</div>
                    <div style={{fontSize:"0.79rem",fontFamily:"'DM Sans',sans-serif",fontWeight:500,color:"#475569",marginBottom:"4px"}}>{us.orderDate}</div>
                    <div style={{fontSize:"0.65rem",fontFamily:"'DM Sans',sans-serif",color:"#94a3b8",textTransform:"uppercase",fontWeight:600,letterSpacing:"0.06em"}}>Expected</div>
                    <div style={{fontSize:"0.79rem",fontFamily:"'DM Sans',sans-serif",fontWeight:700,color:overdue?"#ef4444":daysLeft!==null&&daysLeft<=3?"#f59e0b":"#334155"}}>
                      {us.expectedDate||"—"}
                    </div>
                    {daysLeft!==null&&us.status!=="Arrived"&&us.status!=="Cancelled"&&(
                      <div style={{fontSize:"0.69rem",fontFamily:"'DM Sans',sans-serif",fontWeight:700,color:overdue?"#ef4444":daysLeft<=3?"#f59e0b":"#10b981",marginTop:"1px"}}>{overdue?`${Math.abs(daysLeft)}d late`:daysLeft===0?"Today":`${daysLeft}d left`}</div>
                    )}
                  </div>

                  {/* COL 7 — Note */}
                  <div style={{fontSize:"0.74rem",fontFamily:"'DM Sans',sans-serif",color:"#64748b",fontStyle:"italic"}}>
                    {us.note?`"${us.note}"`:""}
                  </div>

                  {/* COL 8 — Actions */}
                  <div style={{display:"flex",gap:"0.3rem",justifyContent:"flex-end"}}>
                    {us.status!=="Arrived"&&us.status!=="Cancelled"&&(
                      <button onClick={()=>receiveStock(us)} style={{padding:"5px 9px",background:"#ecfdf5",border:"none",borderRadius:"7px",cursor:"pointer",color:"#10b981",display:"flex",alignItems:"center",gap:"3px",fontSize:"0.72rem",fontWeight:700,fontFamily:"'DM Sans',sans-serif"}}>
                        <Ic.receive/>Receive
                      </button>
                    )}
                    <button onClick={()=>{setEditTarget(us);setModal("editUpcoming");}} style={{padding:"5px",background:"#f0f7ff",border:"none",borderRadius:"7px",cursor:"pointer",color:C.sky,display:"flex"}}><Ic.edit/></button>
                    <button onClick={()=>deleteUpcoming(us.id)} style={{padding:"5px",background:"#fff0f0",border:"none",borderRadius:"7px",cursor:"pointer",color:"#ef4444",display:"flex"}}><Ic.trash/></button>
                  </div>
                </div>
              );
            })}
          </div>
        </>}

        {/* ══ TRANSACTIONS TAB ══ */}
        {tab==="transactions"&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.9rem"}}>
            <h2 style={{margin:0,fontFamily:"'DM Sans','Segoe UI',sans-serif",fontSize:"1.1rem",color:C.navy}}>Transaction Log</h2>
            <button onClick={()=>setModal("addTx")} style={{padding:"0.52rem 1rem",background:C.sky,color:"#fff",border:"none",borderRadius:"8px",fontWeight:700,fontSize:"0.8rem",cursor:"pointer",display:"flex",alignItems:"center",gap:"0.35rem"}}><Ic.plus/>New Transaction</button>
          </div>
          <div style={{background:"#fff",borderRadius:"13px",overflow:"hidden",boxShadow:"0 2px 16px rgba(27,58,107,0.08)"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr style={{background:"#F8FAFD"}}>{["ID","Date","Type","Product","Qty","Platform","Note"].map(h=><th key={h} style={{padding:"0.65rem 0.85rem",textAlign:"left",fontSize:"0.67rem",fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.05em",borderBottom:"1.5px solid #e8edf5",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
              <tbody>
                {transactions.map((tx,i)=>{
                  const prod=products.find(p=>p.id===tx.productId);
                  const tc={sale:{color:"#ef4444",bg:"#fef2f2",label:"Sale"},restock:{color:"#10b981",bg:"#ecfdf5",label:"Restock"},adjustment:{color:"#f59e0b",bg:"#fffbeb",label:"Adjust"}}[tx.type]||{color:"#94a3b8",bg:"#f1f5f9",label:tx.type};
                  return <tr key={tx.id} style={{borderBottom:"1px solid #f1f5f9",background:i%2===0?"#fff":"#fafbfd"}}>
                    <td style={{padding:"0.72rem 0.85rem"}}><span style={{fontFamily:"monospace",fontSize:"0.72rem",color:"#94a3b8"}}>{tx.id}</span></td>
                    <td style={{padding:"0.72rem 0.85rem",fontSize:"0.78rem",color:"#475569"}}>{tx.date}</td>
                    <td style={{padding:"0.72rem 0.85rem"}}><Badge color={tc.color} bg={tc.bg}>{tc.label}</Badge></td>
                    <td style={{padding:"0.72rem 0.85rem",fontSize:"0.82rem",fontWeight:500,color:"#1e293b"}}>{prod?.name||tx.productId}</td>
                    <td style={{padding:"0.72rem 0.85rem"}}><span style={{fontWeight:700,color:tx.type==="sale"?"#ef4444":"#10b981",fontSize:"0.88rem"}}>{tx.type==="sale"?"-":"+"}{Math.abs(tx.qty)}</span></td>
                    <td style={{padding:"0.72rem 0.85rem"}}><Badge>{tx.platform}</Badge></td>
                    <td style={{padding:"0.72rem 0.85rem",fontSize:"0.78rem",color:"#64748b",fontStyle:tx.note?"normal":"italic"}}>{tx.note||"—"}</td>
                  </tr>;
                })}
              </tbody>
            </table>
            {transactions.length===0&&<div style={{padding:"2.5rem",textAlign:"center",color:"#94a3b8"}}>No transactions yet.</div>}
          </div>
        </>}

        {/* ══ ANALYTICS TAB ══ */}
        {tab==="analytics"&&<>
          <h2 style={{margin:"0 0 1rem",fontFamily:"'DM Sans','Segoe UI',sans-serif",fontSize:"1.1rem",color:C.navy}}>Analytics Overview</h2>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1rem"}}>
            {/* margin health */}
            <div style={{background:"#fff",borderRadius:"13px",padding:"1.1rem",boxShadow:"0 2px 16px rgba(27,58,107,0.08)"}}>
              <h3 style={{margin:"0 0 0.85rem",fontSize:"0.8rem",fontWeight:700,color:C.navy,textTransform:"uppercase",letterSpacing:"0.05em"}}>Margin Health per Product</h3>
              {[...products].sort((a,b)=>calcMargin(b)-calcMargin(a)).map(p=>{
                const m=calcMargin(p); const color=m>=35?"#10b981":m>=20?"#f59e0b":"#ef4444";
                return <div key={p.id} style={{display:"flex",alignItems:"center",gap:"0.65rem",marginBottom:"0.5rem"}}>
                  <span style={{fontSize:"0.7rem",color:"#94a3b8",width:"95px",flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
                  <div style={{flex:1,height:"9px",background:"#f0f4fa",borderRadius:"20px",overflow:"hidden"}}><div style={{height:"100%",width:`${m}%`,background:color,borderRadius:"20px"}}/></div>
                  <span style={{fontSize:"0.76rem",fontWeight:700,color,width:"32px",textAlign:"right"}}>{m}%</span>
                </div>;
              })}
            </div>

            {/* avg cost structure */}
            <div style={{background:"#fff",borderRadius:"13px",padding:"1.1rem",boxShadow:"0 2px 16px rgba(27,58,107,0.08)"}}>
              <h3 style={{margin:"0 0 0.85rem",fontSize:"0.8rem",fontWeight:700,color:C.navy,textTransform:"uppercase",letterSpacing:"0.05em"}}>Avg Cost Structure</h3>
              {[{label:"Manufacturing",key:"manufacturing",color:"#4A90D9"},{label:"Packaging",key:"packaging",color:C.navy},{label:"Platform Fees",key:"platformFee",color:C.gold},{label:"Delivery",key:"delivery",color:"#10b981"}].map(({label,key,color})=>{
                const avg=products.length?Math.round(products.reduce((s,p)=>s+(p[key]||0),0)/products.length):0;
                return <div key={key} style={{display:"flex",alignItems:"center",gap:"0.65rem",marginBottom:"0.65rem"}}>
                  <span style={{width:"9px",height:"9px",borderRadius:"2px",background:color,flexShrink:0}}/>
                  <span style={{fontSize:"0.76rem",color:"#475569",width:"105px",flexShrink:0}}>{label}</span>
                  <div style={{flex:1,height:"11px",background:"#f0f4fa",borderRadius:"20px",overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(100,(avg/600)*100)}%`,background:color,borderRadius:"20px"}}/></div>
                  <span style={{fontSize:"0.76rem",fontWeight:700,color,width:"38px",textAlign:"right"}}>৳{avg}</span>
                </div>;
              })}
              <div style={{marginTop:"0.9rem",borderTop:"1.5px solid #f0f4fa",paddingTop:"0.7rem",display:"flex",flexDirection:"column",gap:"0.35rem"}}>
                <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:"0.8rem",color:"#334155"}}>Avg Total Cost / Unit</span><span style={{fontFamily:"'DM Sans','Segoe UI',sans-serif",fontWeight:800,color:C.navy}}>৳{products.length?Math.round(products.reduce((s,p)=>s+calcCost(p),0)/products.length):0}</span></div>
                <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:"0.8rem",color:"#334155"}}>Avg Selling Price / Unit</span><span style={{fontFamily:"'DM Sans','Segoe UI',sans-serif",fontWeight:800,color:C.sky}}>৳{products.length?Math.round(products.reduce((s,p)=>s+p.price,0)/products.length):0}</span></div>
              </div>
            </div>

            {/* stock by category */}
            <div style={{background:"#fff",borderRadius:"13px",padding:"1.1rem",boxShadow:"0 2px 16px rgba(27,58,107,0.08)"}}>
              <h3 style={{margin:"0 0 0.85rem",fontSize:"0.8rem",fontWeight:700,color:C.navy,textTransform:"uppercase",letterSpacing:"0.05em"}}>Stock Units by Category</h3>
              {CATEGORIES.map(cat=>{
                const units=products.filter(p=>p.category===cat).reduce((s,p)=>s+p.stock,0);
                if(!units)return null;
                const max=Math.max(...CATEGORIES.map(c=>products.filter(p=>p.category===c).reduce((s,p)=>s+p.stock,0)));
                return <div key={cat} style={{marginBottom:"0.65rem"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:"0.22rem"}}><span style={{fontSize:"0.78rem",color:"#475569"}}>{cat}</span><span style={{fontSize:"0.78rem",fontWeight:700,color:C.navy}}>{units}</span></div>
                  <div style={{height:"8px",background:"#f0f4fa",borderRadius:"20px",overflow:"hidden"}}><div style={{height:"100%",width:`${max>0?(units/max)*100:0}%`,background:`linear-gradient(90deg,${C.sky},${C.navy})`,borderRadius:"20px"}}/></div>
                </div>;
              })}
            </div>

            {/* platform + incoming */}
            <div style={{background:"#fff",borderRadius:"13px",padding:"1.1rem",boxShadow:"0 2px 16px rgba(27,58,107,0.08)"}}>
              <h3 style={{margin:"0 0 0.85rem",fontSize:"0.8rem",fontWeight:700,color:C.navy,textTransform:"uppercase",letterSpacing:"0.05em"}}>Platform Coverage</h3>
              {PLATFORMS.map(pl=>{
                const pp=products.filter(p=>p.platform.includes(pl));
                const colors={"Own Store":C.sky,"Daraz":"#FF6633","Cartup":"#10b981"};
                return <div key={pl} style={{border:"1.5px solid #e8edf5",borderRadius:"9px",padding:"0.7rem 0.9rem",marginBottom:"0.55rem",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"0.55rem"}}><div style={{width:"9px",height:"9px",borderRadius:"50%",background:colors[pl]}}/><span style={{fontSize:"0.82rem",fontWeight:600,color:"#1e293b"}}>{pl}</span></div>
                  <div style={{textAlign:"right"}}><div style={{fontSize:"0.82rem",fontWeight:700,color:colors[pl]}}>{pp.length} SKUs</div><div style={{fontSize:"0.66rem",color:"#94a3b8"}}>{pp.reduce((s,p)=>s+p.stock,0)} units</div></div>
                </div>;
              })}
              {upcomingStock.filter(u=>u.status!=="Arrived"&&u.status!=="Cancelled").length>0&&(
                <div style={{marginTop:"0.85rem",background:C.lightSky,borderRadius:"9px",padding:"0.8rem"}}>
                  <div style={{fontSize:"0.7rem",fontWeight:700,color:C.navy,textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:"0.45rem"}}>🚚 Incoming</div>
                  {upcomingStock.filter(u=>u.status!=="Arrived"&&u.status!=="Cancelled").map(u=>{
                    const p=products.find(x=>x.id===u.productId); const cfg=US_STATUS_CFG[u.status]||US_STATUS_CFG["Ordered"];
                    return <div key={u.id} style={{display:"flex",justifyContent:"space-between",fontSize:"0.76rem",marginBottom:"0.28rem"}}>
                      <span style={{color:"#334155"}}>{p?.name||u.productId}</span>
                      <div style={{display:"flex",gap:"0.45rem",alignItems:"center"}}><span style={{fontWeight:600,color:C.sky}}>+{u.qty}</span><Badge color={cfg.color} bg={cfg.bg}>{u.status}</Badge></div>
                    </div>;
                  })}
                </div>
              )}
            </div>
          </div>
        </>}
      </main>

      {/* MODALS */}
      {modal==="addProduct"&&<Modal title="Add New Product" onClose={()=>setModal(null)} wide><ProductForm onSave={saveProduct} onClose={()=>setModal(null)}/></Modal>}
      {modal==="editProduct"&&editTarget&&<Modal title="Edit Product" onClose={()=>{setModal(null);setEditTarget(null);}} wide><ProductForm initial={editTarget} onSave={saveProduct} onClose={()=>{setModal(null);setEditTarget(null);}}/></Modal>}
      {modal==="addTx"&&<Modal title="Record Transaction" onClose={()=>setModal(null)}><TxForm products={products} onSave={saveTx} onClose={()=>setModal(null)}/></Modal>}
      {modal==="addUpcoming"&&<Modal title="Add Incoming Stock Order" onClose={()=>setModal(null)} wide><UpcomingForm products={products} onSave={saveUpcoming} onClose={()=>setModal(null)}/></Modal>}
      {modal==="editUpcoming"&&editTarget&&<Modal title="Edit Order" onClose={()=>{setModal(null);setEditTarget(null);}} wide><UpcomingForm initial={editTarget} products={products} onSave={saveUpcoming} onClose={()=>{setModal(null);setEditTarget(null);}}/></Modal>}
      {costProd&&<CostModal p={costProd} onClose={()=>setCostProd(null)}/>}
      {showUserMgr&&<UserManager currentUser={currentUser} onClose={()=>setShowUserMgr(false)}/>}

      {toast&&<div style={{position:"fixed",bottom:"1.4rem",right:"1.4rem",background:C.navy,color:"#fff",padding:"0.75rem 1.1rem",borderRadius:"10px",boxShadow:"0 8px 30px rgba(0,0,0,0.2)",display:"flex",alignItems:"center",gap:"0.5rem",fontSize:"0.82rem",fontWeight:500,zIndex:200,animation:"slideIn 0.3s ease"}}>
        <span style={{background:C.sky,borderRadius:"50%",width:"17px",height:"17px",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Ic.check/></span>{toast.msg}
      </div>}

      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes slideIn{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}
        *{box-sizing:border-box}
        input:focus,select:focus{border-color:#4A90D9!important;box-shadow:0 0 0 3px rgba(74,144,217,0.14)}
        tbody tr:hover{background:#f5f9ff!important}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:20px}
      `}</style>
    </div>
  );
}
