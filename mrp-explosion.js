(()=>{
  const baseRenderMrp=renderMrp;
  const escMrp=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const horizonWeeks=()=>Number(document.querySelector('#mrpHorizon')?.value||4);
  const daysBetween=(a,b)=>Math.floor((new Date((b||today())+'T12:00:00')-new Date((a||today())+'T12:00:00'))/86400000);
  const periodIndex=(date,horizon)=>{const delta=daysBetween(today(),date);return delta<0?0:Math.min(horizon,1+Math.floor(delta/7));};
  const periodStart=(index)=>index===0?today():addDays(today(),(index-1)*7);
  const periodLabel=(index)=>index===0?'Now / overdue':`Week ${index} · ${fmtDate(periodStart(index))}`;
  function totalOnHand(itemId,item){
    const rows=(data.inventory||[]).filter(row=>row.itemId===itemId);
    return rows.length?rows.reduce((sum,row)=>sum+Number(row.onHand||0),0):Number(item?.onhand??item?.onHand??0);
  }
  function scheduledSupply(itemId,item,horizon){
    const buckets=Array(horizon+1).fill(0);let total=0;
    for(const po of data.purchaseOrders||[]){
      if(!['Order Sent','Partially Received'].includes(po.status))continue;
      for(const line of po.lines||[]){
        if(line.itemId!==itemId)continue;
        const qty=Math.max(0,Number(line.qtyOrdered||0)-Number(line.qtyReceived||0));if(!qty)continue;
        const date=line.expectedDate||po.expectedDate||item?.poDue||today();buckets[periodIndex(date,horizon)]+=qty;total+=qty;
      }
    }
    if(item&&Number(item.openpo||0)>total){const extra=Number(item.openpo)-total;buckets[periodIndex(item.poDue||today(),horizon)]+=extra;total+=extra;}
    if(data.productionOrders){
      for(const work of data.productionOrders){
        if(work.status!=='Issued'||(work.product||work.itemId)!==itemId)continue;
        const qty=Math.max(0,Number(work.qtyStarted||work.qty||0)-Number(work.qtyGood||0)-Number(work.qtyScrap||0));if(!qty)continue;
        buckets[periodIndex(work.expectedDate||work.dueDate||today(),horizon)]+=qty;total+=qty;
      }
    }
    return{buckets,total};
  }
  function planItem(itemId,item,kind,gross,horizon){
    const lead=kind==='parent'?Math.max(0,Number(item.leadDays||0)):Math.max(0,Number(item.lead||0));
    const lot=Math.max(1,Math.ceil(Number(item.orderMultiple||1)));
    const beginning=totalOnHand(itemId,item),supply=scheduledSupply(itemId,item,horizon);
    const projected=[],net=[],plannedReceipts=[],plannedReleases=Array.from({length:horizon+1},()=>[]);
    let available=beginning;
    for(let i=0;i<=horizon;i++){
      const need=Number(gross[i]||0),receipt=Number(supply.buckets[i]||0);
      const shortage=Math.max(0,need-(available+receipt));
      const planned=shortage?Math.ceil(shortage/lot)*lot:0;
      const end=available+receipt+planned-need;
      net.push(shortage);plannedReceipts.push(planned);projected.push(end);
      if(planned){const reqDate=periodStart(i),releaseDate=addDays(reqDate,-lead),releaseIndex=periodIndex(releaseDate,horizon);plannedReleases[releaseIndex].push({qty:planned,date:releaseDate,receiptDate:reqDate});}
      available=end;
    }
    return{itemId,item,kind,lead,lot,beginning,scheduled:supply.buckets,scheduledTotal:supply.total,gross,projected,net,plannedReceipts,plannedReleases,totalGross:gross.reduce((a,b)=>a+Number(b||0),0),totalNet:net.reduce((a,b)=>a+Number(b||0),0),totalPlanned:plannedReceipts.reduce((a,b)=>a+Number(b||0),0)};
  }
  function calculateExplosion(calc){
    const h=calc.horizon||horizonWeeks(),parentGross=new Map();
    for(const p of data.products){parentGross.set(p.id,Array(h+1).fill(0));}
    for(const order of calc.orders||[]){const arr=parentGross.get(order.product);if(!arr)continue;arr[periodIndex(order.date,h)]+=Number(order.qty||0);}
    const parents=data.products.map(p=>planItem(p.id,p,'parent',parentGross.get(p.id)||Array(h+1).fill(0),h));
    const componentGross=new Map(data.components.map(c=>[c.id,Array(h+1).fill(0)]));
    for(const plan of parents){
      for(let i=0;i<=h;i++){
        const qty=Number(plan.plannedReceipts[i]||0);if(!qty)continue;
        const releaseDate=addDays(periodStart(i),-plan.lead),releaseBucket=periodIndex(releaseDate,h);
        for(const [componentId,perParent] of Object.entries(plan.item.bom||{})){
          const arr=componentGross.get(componentId);if(arr)arr[releaseBucket]+=qty*Number(perParent||0);
        }
      }
    }
    const components=data.components.map(c=>planItem(c.id,c,'component',componentGross.get(c.id)||Array(h+1).fill(0),h));
    return{h,parents,components};
  }
  function timelineTable(plan,h){
    const heads=Array.from({length:h+1},(_,i)=>`<th class="${i===0?'timeline-now':''}">${escMrp(periodLabel(i))}</th>`).join('');
    const cell=(value,i,kind='qty')=>{
      if(kind==='release'){
        const entries=plan.plannedReleases[i]||[];return entries.length?entries.map(entry=>`<span class="timeline-qty">${entry.qty}</span><span class="timeline-date">Release ${escMrp(fmtDate(entry.date))}${entry.date<today()?' · overdue':''}</span>`).join(''):'—';
      }
      return Number(value||0)?`<span class="timeline-qty">${Number(value)}</span>`:'—';
    };
    const row=(label,values,kind='qty',className='')=>`<tr class="${className}"><td>${label}</td><td>${kind==='projected'?`<span class="timeline-qty">${plan.beginning}</span>`:'—'}</td>${values.map((v,i)=>`<td class="${i===0?'timeline-now':''}">${cell(v,i,kind)}</td>`).join('')}</tr>`;
    return`<div class="mrp-timeline-wrap"><table class="mrp-timeline"><thead><tr><th>MRP calculation row</th><th>Beginning<br>on hand</th>${heads}</tr></thead><tbody>${row('Gross requirements',plan.gross)}${row('Scheduled receipts',plan.scheduled)}${row('Projected on hand',plan.projected,'qty','projected-row')}${row('Net requirements',plan.net)}${row('Planned order receipts',plan.plannedReceipts)}${row('Planned order releases',plan.plannedReleases,'release')}</tbody></table></div>`;
  }
  function settingsHtml(plan){
    const leadField=plan.kind==='parent'?'leadDays':'lead',leadValue=plan.item[leadField];
    return`<div class="mrp-settings"><label>Lead time (days)<input type="number" min="0" step="1" data-mrp-setting="${leadField}" data-mrp-kind="${plan.kind}" data-mrp-id="${escMrp(plan.itemId)}" value="${leadValue==null?'':Number(leadValue)}" placeholder="${plan.kind==='parent'?'Set':'0'}" aria-label="${escMrp(plan.item.name)} lead time in days"></label><label>Order multiple<input type="number" min="1" step="1" data-mrp-setting="orderMultiple" data-mrp-kind="${plan.kind}" data-mrp-id="${escMrp(plan.itemId)}" value="${plan.item.orderMultiple==null?1:Number(plan.item.orderMultiple)}" aria-label="${escMrp(plan.item.name)} order multiple"></label><span class="mrp-summary-stats"><span>Beginning on hand <b>${plan.beginning}</b></span><span>Scheduled receipts <b>${plan.scheduledTotal}</b></span><span>Net quantity <b>${plan.totalNet}</b></span><span>Planned quantity <b>${plan.totalPlanned}</b></span><span>Rule <b>${plan.lot===1?'Lot for lot':`Fixed multiple of ${plan.lot}`}</b></span></span></div>`;
  }
  function renderExplosion(calc){
    const host=document.querySelector('#mrpExplosion');if(!host)return{parents:[],components:[]};
    const result=calculateExplosion(calc),demandByParent=new Map();
    for(const order of calc.orders||[])demandByParent.set(order.product,(demandByParent.get(order.product)||0)+Number(order.qty||0));
    const firstDemand=data.products.find(p=>(demandByParent.get(p.id)||0)>0)?.id;
    const parentHtml=result.parents.map(plan=>{
      const count=demandByParent.get(plan.itemId)||0,children=Object.entries(plan.item.bom||{}).filter(([,qty])=>Number(qty)>0);
      return`<details class="mrp-parent-block" ${plan.itemId===firstDemand?'open':''}><summary><span class="mrp-summary-main"><strong>${escMrp(plan.item.name)}</strong><span>Parent item · ${escMrp(plan.item.sku||'')} · ${count} confirmed units · ${children.length} BOM components</span></span><span class="mrp-summary-stats"><span>On hand <b>${plan.beginning}</b></span><span>Build need <b>${plan.totalNet}</b></span></span></summary>${settingsHtml(plan)}<p class="explosion-help">Level 0 · confirmed orders are parent gross requirements; planned build releases create level 1 component demand.</p>${timelineTable(plan,result.h)}<div class="explosion-help">BOM: ${children.map(([id,qty])=>`${Number(qty)} × ${escMrp(data.components.find(c=>c.id===id)?.name||id)}`).join(' · ')||'No child components configured'}</div></details>`;
    }).join('');
    const componentHtml=result.components.map(plan=>{
      const contributingParents=result.parents.filter(parent=>Number(parent.item.bom?.[plan.itemId]||0)>0).map(parent=>parent.item.name);
      return`<details class="mrp-component-block"><summary><span class="mrp-summary-main"><strong>${escMrp(plan.item.name)}</strong><span>Child component · ${escMrp(plan.item.sku||'')} · Required by ${escMrp(contributingParents.join(', ')||'no current BOM')}</span></span><span class="mrp-summary-stats"><span>Need <b>${plan.totalGross}</b></span><span>On hand <b>${plan.beginning}</b></span><span>Open PO <b>${plan.scheduledTotal}</b></span><span>Net order <b>${plan.totalNet}</b></span></span></summary>${settingsHtml(plan)}<p class="explosion-help">Level 1 · requirements are based on planned parent order releases across all confirmed parent demand.</p>${timelineTable(plan,result.h)}</details>`;
    }).join('');
    const parentsWithDemand=result.parents.filter(p=>demandByParent.get(p.itemId)>0).length;
    host.innerHTML=`<h3 class="explosion-heading">Parent items · Level 0 (${parentsWithDemand} with demand)</h3>${parentHtml||'<div class="empty">No parent items are configured.</div>'}<h3 class="explosion-heading">Shared child supply · Level 1</h3>${componentHtml||'<div class="empty">No child components are configured.</div>'}`;
    return result;
  }
  function firstNeed(plan){for(let i=0;i<plan.gross.length;i++)if(Number(plan.gross[i]||0)>0)return periodStart(i);return'';}
  function firstOrderBy(plan){const entries=plan.plannedReleases.flat().sort((a,b)=>a.date.localeCompare(b.date));return entries[0]?.date||'';}
  function committedMrpQty(itemId){return(data.purchaseOrders||[]).filter(po=>po.source==='mrp_action'&&['Order Sent','Partially Received'].includes(po.status)).reduce((sum,po)=>sum+(po.lines||[]).filter(line=>line.itemId===itemId).reduce((qty,line)=>qty+Math.max(0,Number(line.qtyOrdered||0)-Number(line.qtyReceived||0)),0),0);}
  function actionableQty(plan){return Math.max(0,Number(plan.totalPlanned||0)-committedMrpQty(plan.itemId));}
  function renderComponentSummary(result){
    const host=document.querySelector('#mrpTable');if(!host)return;
    host.innerHTML=`<table class="table"><thead><tr><th>Component</th><th>Qty for confirmed demand</th><th>Beginning on hand</th><th>Scheduled receipts / open PO</th><th>Net quantity to order</th><th>Suggested order qty</th><th>Lead time</th><th>Order by</th></tr></thead><tbody>${result.components.map(p=>{const need=firstNeed(p),by=firstOrderBy(p),committed=committedMrpQty(p.itemId),suggested=actionableQty(p);return`<tr><td><strong>${escMrp(p.item.name)}</strong><div class="small-muted">${escMrp(p.item.sku||'')}</div></td><td>${p.totalGross}</td><td>${p.beginning}</td><td>${p.scheduledTotal}${committed?`<div class="small-muted">${committed} committed on MRP PO</div>`:''}</td><td><strong>${p.totalNet||'—'}</strong></td><td><strong>${suggested||'—'}</strong></td><td>${p.lead} days</td><td>${by?`<span class="pill ${by<today()?'red':'yellow'}">${fmtDate(by)}</span>`:'—'}${need?`<div class="small-muted">Need ${fmtDate(need)}</div>`:''}</td></tr>`}).join('')}</tbody></table>`;
  }
  function renderDemandTable(calc){
    const host=document.querySelector('#ordersList');if(!host)return;
    const orders=(calc.orders||[]).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    host.innerHTML=orders.length?`<div class="table-wrap"><table class="table mrp-demand-table"><thead><tr><th>Order</th><th>Customer</th><th>Requested date</th><th>Parent product</th><th>Quantity</th><th>Status</th></tr></thead><tbody>${orders.map(o=>`<tr><td><strong>${escMrp(o.ref||'Sales order')}</strong></td><td>${escMrp(o.customer||'Customer')}</td><td>${fmtDate(o.date)}</td><td>${escMrp(product(o.product)?.name||'Unknown product')}</td><td><strong>${Number(o.qty||0)}</strong></td><td><span class="pill ${o.planningOnly?'yellow':'blue'}">${o.planningOnly?'Planning only':'Confirmed'}</span></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">No confirmed customer orders in this planning window.</div>';
  }
  function renderActionQueue(result){
    const host=document.querySelector('#actionTable');if(!host)return;
    const action=result.components.filter(p=>actionableQty(p)>0).sort((a,b)=>firstOrderBy(a).localeCompare(firstOrderBy(b)));
    const orders=mrpCalc().orders||[];
    const supplierFor={shell:'SUP-SM',lid:'SUP-BP',sensor:'SUP-NC',base:'SUP-MO',seal:'SUP-AS',straw:'SUP-CC',strawSensor:'SUP-NC'};
    host.innerHTML=action.length?`<table class="table mrp-action-table"><thead><tr><th>Suggested order</th><th>Supplier · lead time</th><th>Need by</th><th>Order by</th><th>Est. spend</th><th>Status</th><th>Action</th></tr></thead><tbody>${action.map(p=>{const suggested=actionableQty(p),need=firstNeed(p),by=firstOrderBy(p),supplier=data.suppliers.find(s=>s.id===supplierFor[p.itemId])||data.suppliers[0],unitCost=Number(data.supplierItemQuotes?.[supplier?.id]?.[p.itemId]??p.item.cost??0),drivers=new Map();for(const order of orders){const parent=product(order.product),per=Number(parent?.bom?.[p.itemId]||0);if(parent&&per>0)drivers.set(parent.name,(drivers.get(parent.name)||0)+Number(order.qty||0));}const parentText=[...drivers].map(([name,qty])=>`${name} (${qty})`).join(', '),status=by&&by<today()?'Past due':'Ready to order';return`<tr><td class="mrp-action-item"><strong>${escMrp(p.item.name)}</strong><div class="small-muted">${escMrp(p.item.sku||'')} · suggested ${suggested} units</div><div class="mrp-action-reason">${p.totalGross} needed; ${p.totalNet} net shortage after ${p.beginning} on hand + ${p.scheduledTotal} open PO${committedMrpQty(p.itemId)?` · ${committedMrpQty(p.itemId)} already committed on MRP PO`:''}${parentText?` · for ${escMrp(parentText)}`:''}</div></td><td>${escMrp(supplier?.name||'Supplier not set')}<div class="small-muted">${Number(supplier?.leadDays??p.lead)} days quoted · MRP lead ${p.lead} days · ${money2(unitCost)}/unit</div></td><td>${need?fmtDate(need):'—'}</td><td><strong>${by?fmtDate(by):'—'}</strong></td><td>${money2(suggested*unitCost)}</td><td><span class="pill ${by&&by<today()?'red':'yellow'}">${status}</span></td><td><button type="button" class="btn primary mrp-create-po" aria-label="Create purchase order for ${escMrp(suggested)} ${escMrp(p.item.name)}" data-component="${escMrp(p.itemId)}" data-qty="${suggested}">Create PO</button></td></tr>`}).join('')}</tbody></table>`:'<div class="empty">All child components are covered for this planning window.</div>';
  }
  function refreshMrpView(){
    const calc=mrpCalc(),result=renderExplosion(calc);renderComponentSummary(result);renderDemandTable(calc);renderActionQueue(result);
    const needed=result.components.filter(p=>actionableQty(p)>0).length;
    const unitCount=(calc.orders||[]).reduce((n,o)=>n+Number(o.qty||0),0);
    const heroActions=document.querySelector('#heroActions'),kpiBuy=document.querySelector('#kpiBuy'),heroDemand=document.querySelector('#heroDemand'),kpiUnits=document.querySelector('#kpiUnits');
    if(heroActions)heroActions.textContent=`${needed} components`;if(kpiBuy)kpiBuy.textContent=String(needed);if(heroDemand)heroDemand.textContent=`${unitCount} units`;if(kpiUnits)kpiUnits.textContent=String(unitCount);
  }
  renderOrders=function(){renderDemandTable(mrpCalc());};
  renderMrp=function(){baseRenderMrp();refreshMrpView();};
  document.querySelector('#mrpExplosion')?.addEventListener('change',event=>{
    const input=event.target.closest('[data-mrp-setting]');if(!input)return;
    const item=input.dataset.mrpKind==='parent'?data.products.find(p=>p.id===input.dataset.mrpId):data.components.find(c=>c.id===input.dataset.mrpId);if(!item)return;
    const field=input.dataset.mrpSetting,value=Number(input.value);
    if(!Number.isFinite(value)||value<0){input.value=field==='orderMultiple'?String(item.orderMultiple||1):String(item[field]||0);return;}
    item[field]=field==='orderMultiple'?Math.max(1,Math.ceil(value)):value;save();renderAll();toast(`${item.name} MRP setting saved.`);
  });
  document.querySelector('#actionTable')?.addEventListener('click',event=>{
    const button=event.target.closest('.mrp-create-po');if(!button)return;
    const componentId=button.dataset.component,qty=Number(button.dataset.qty);if(!componentId||qty<1)return;
    document.dispatchEvent(new CustomEvent('watagachi:mrp-create-po',{detail:{componentId,qty}}));
  });
  renderMrp();
})();
