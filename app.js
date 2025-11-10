/* OsteoPlan v1.0 v7 — generic tools, selectable readouts, export strip */
(() => {
  const $ = (s)=>document.querySelector(s);

  // DOM
  const canvas = $('#canvas'); const ctx = canvas.getContext('2d');
  const wrapper = $('#canvasWrapper'); const dropHint = $('#dropHint');
  const overlayInfo = $('#overlayInfo'); const guided = $('#guided');
  const presetSelect = $('#presetSelect'); const presetACL = $('#presetACL');
  const readoutsEl = $('#readouts'); const wedgeBadge = $('#wedgeBadge');
  const imageLoader = $('#imageLoader');
  const btnExport = $('#btnExport'); const btnSaveJSON = $('#btnSaveJSON');
  const btnUndo = $('#btnUndo'); const btnReset = $('#btnReset');
  const logBox = $('#log'); const helpModal = $('#helpModal');
  const helpClose = $('#helpClose'); const btnHelp = $('#btnHelp');
  const kneeSideEl=$('#kneeSide'); const exportReadoutsEl=$('#exportReadouts'); const caseNotesEl=$('#caseNotes');
  const selAllBtn=$('#selAll'); const selNoneBtn=$('#selNone');
  const calLenEl=$('#calLen'); const calUnitsEl=$('#calUnits'); const calStatusEl=$('#calStatus');

  // Reference ranges
  const refs = {
    HKA:[parseFloat($('#refHKAlo').value), parseFloat($('#refHKAhi').value)],
    MPTA:[parseFloat($('#refMPTAlo').value), parseFloat($('#refMPTAhi').value)],
    LDFA:[parseFloat($('#refLDFAlo').value), parseFloat($('#refLDFAhi').value)],
    JLCA:[parseFloat($('#refJLCAlo').value), parseFloat($('#refJLCAhi').value)],
    BHx:[parseFloat($('#refBHxlo').value), parseFloat($('#refBHxhi').value)],
    BHy:[parseFloat($('#refBHylo').value), parseFloat($('#refBHyhi').value)],
    TTLat:[parseFloat($('#refTTLatLo').value), parseFloat($('#refTTLatHi').value)],
    TTAP:[parseFloat($('#refTTAPLo').value), parseFloat($('#refTTAPHi').value)],
    TTPct:[parseFloat($('#refTTPctLo').value), parseFloat($('#refTTPctHi').value)],
    TTML:[parseFloat($('#refTTMLLo').value), parseFloat($('#refTTMLHi').value)],
    Slope:[parseFloat($('#refSlopeLo').value), parseFloat($('#refSlopeHi').value)],
    TTSag:[parseFloat($('#refTTSagLo').value), parseFloat($('#refTTSagHi').value)],
    DIVMax: parseFloat($('#refDIVMax').value),
    ClockRight: $('#refClockRight').value,
    ClockLeft: $('#refClockLeft').value
  };
  $('#refSave').addEventListener('click', ()=>{
    refs.HKA=[parseFloat($('#refHKAlo').value), parseFloat($('#refHKAhi').value)];
    refs.MPTA=[parseFloat($('#refMPTAlo').value), parseFloat($('#refMPTAhi').value)];
    refs.LDFA=[parseFloat($('#refLDFAlo').value), parseFloat($('#refLDFAhi').value)];
    refs.JLCA=[parseFloat($('#refJLCAlo').value), parseFloat($('#refJLCAhi').value)];
    refs.BHx=[parseFloat($('#refBHxlo').value), parseFloat($('#refBHxhi').value)];
    refs.BHy=[parseFloat($('#refBHylo').value), parseFloat($('#refBHyhi').value)];
    refs.TTLat=[parseFloat($('#refTTLatLo').value), parseFloat($('#refTTLatHi').value)];
    refs.TTAP=[parseFloat($('#refTTAPLo').value), parseFloat($('#refTTAPHi').value)];
    refs.TTPct=[parseFloat($('#refTTPctLo').value), parseFloat($('#refTTPctHi').value)];
    refs.TTML=[parseFloat($('#refTTMLLo').value), parseFloat($('#refTTMLHi').value)];
    refs.TTSag=[parseFloat($('#refTTSagLo').value), parseFloat($('#refTTSagHi').value)];
    refs.DIVMax=parseFloat($('#refDIVMax').value);
    refs.ClockRight=$('#refClockRight').value;
    refs.ClockLeft=$('#refClockLeft').value;
    toast('Reference ranges saved');
  });

  // helpers
  function toast(msg){ const t=$('#toast'); if(!t) return; t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1400); }
  function log(m){ if(!logBox) return; const t=new Date().toLocaleTimeString(); logBox.textContent += `[${t}] ${m}\n`; logBox.scrollTop=logBox.scrollHeight; }
  const badge=(ok)=> ok?'<span class="ok">✔</span>':'<span class="warn">✖</span>';
  const within=(v,lo,hi)=> v>=lo && v<=hi;

  // canvas/image state
  let img=new Image(), imgLoaded=false, imgNaturalW=0, imgNaturalH=0;
  let scale=1, originX=0, originY=0; const DPR=window.devicePixelRatio||1;

  // draw state
  let currentTool='pan'; let shapes=[]; let history=[];
  let activePreset=null; let presetState=[];
  let toolState=[]; // generic tool clicks
  let pixelsPerMM=null; let lastJLCAdeg=0;
  let _currentWedge=null, _bhRect=null, _clockFace=null;

  // sizing
  function setCanvasSize(){ const rect=wrapper.getBoundingClientRect(); canvas.width=Math.floor(rect.width*DPR); canvas.height=Math.floor(rect.height*DPR); canvas.style.width=rect.width+'px'; canvas.style.height=rect.height+'px'; draw(); }
  window.addEventListener('resize', setCanvasSize);

  // coords
  function clientToCanvasPx(e){ const r=canvas.getBoundingClientRect(); return {x:(e.clientX-r.left)*DPR, y:(e.clientY-r.top)*DPR}; }
  function canvasPxToImage(p){ const ox=originX*DPR, oy=originY*DPR; return {x:(p.x-ox)/(scale*DPR), y:(p.y-oy)/(scale*DPR)}; }
  function imageToCanvasPx(p){ const ox=originX*DPR, oy=originY*DPR; return {x:p.x*scale*DPR+ox, y:p.y*scale*DPR+oy}; }

  // math
  function lineAngleDeg(a,b){ return Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI; }
  function angleBetweenTwoLines(a1,a2,b1,b2){ let d=Math.abs(lineAngleDeg(a1,a2)-lineAngleDeg(b1,b2)); return d>180?360-d:d; }
  function clamp(min,v,max){ return Math.max(min, Math.min(max, v)); }
  function distPx(a,b){ const A=imageToCanvasPx(a), B=imageToCanvasPx(b); return Math.hypot(A.x-B.x, A.y-B.y); }
  function mmFromPx(px){ if(!pixelsPerMM) return null; return px / pixelsPerMM; }

  // draw primitives
  function drawPoint(pt,label){ const r=7*DPR; const c=imageToCanvasPx(pt); ctx.beginPath(); ctx.arc(c.x,c.y,r,0,Math.PI*2); ctx.fillStyle="#4cc9f0"; ctx.fill(); if(label){ ctx.fillStyle="#e8ecf1"; ctx.font=`${10*DPR}px ui-sans-serif`; ctx.fillText(label,c.x+10*DPR,c.y-8*DPR);} }
  function drawLine(a,b,label){ const ca=imageToCanvasPx(a), cb=imageToCanvasPx(b); ctx.lineWidth=2*DPR; ctx.strokeStyle="#ffd166"; ctx.beginPath(); ctx.moveTo(ca.x,ca.y); ctx.lineTo(cb.x,cb.y); ctx.stroke(); if(label){ ctx.fillStyle="#e8ecf1"; ctx.font=`${10*DPR}px ui-sans-serif`; ctx.fillText(label,(ca.x+cb.x)/2+6*DPR,(ca.y+cb.y)/2);} }

  function draw(){
    ctx.save(); ctx.clearRect(0,0,canvas.width,canvas.height); ctx.fillStyle="#0a0f18"; ctx.fillRect(0,0,canvas.width,canvas.height);
    if(imgLoaded){ const iw=imgNaturalW*scale*DPR, ih=imgNaturalH*scale*DPR, ox=originX*DPR, oy=originY*DPR; ctx.drawImage(img,0,0,imgNaturalW,imgNaturalH,ox,oy,iw,ih); dropHint.style.display='none'; } else { dropHint.style.display='block'; }
    for(const s of shapes){ if(s.type==='point') drawPoint(s.points[0], s.meta?.label); else if(s.type==='line') drawLine(s.points[0], s.points[1], s.meta?.label); }
    if (_currentWedge){ const {H, M, Mrot} = _currentWedge; const Hpx=imageToCanvasPx(H), Mpx=imageToCanvasPx(M), Mrpx=imageToCanvasPx(Mrot); ctx.beginPath(); ctx.moveTo(Hpx.x,Hpx.y); ctx.lineTo(Mpx.x,Mpx.y); ctx.lineTo(Mrpx.x,Mrpx.y); ctx.closePath(); ctx.fillStyle='rgba(255,209,102,0.28)'; ctx.fill(); ctx.lineWidth=1*DPR; ctx.strokeStyle='#ffd166'; ctx.stroke(); }
    if (_bhRect){ const {O, U, V, L, H, C, txt} = _bhRect; ctx.lineWidth=1*DPR; ctx.strokeStyle='#66d9ff'; ctx.fillStyle='rgba(76,201,240,0.12)'; const corners=[O, {x:O.x+U.x*L,y:O.y+U.y*L}, {x:O.x+U.x*L+V.x*H,y:O.y+U.y*L+V.y*H}, {x:O.x+V.x*H,y:O.y+V.y*H}]; ctx.beginPath(); const c0=imageToCanvasPx(corners[0]); ctx.moveTo(c0.x,c0.y); for(let i=1;i<4;i++){ const cp=imageToCanvasPx(corners[i]); ctx.lineTo(cp.x,cp.y); } ctx.closePath(); ctx.stroke(); ctx.fill(); if(C){ const Cp=imageToCanvasPx(C); ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(Cp.x,Cp.y,3*DPR,0,Math.PI*2); ctx.fill(); ctx.font=`${12*DPR}px ui-sans-serif`; ctx.fillText(txt, Cp.x+8*DPR, Cp.y-8*DPR); } }
    if (_clockFace){ const {center, rim, centerPx} = _clockFace; const cc=imageToCanvasPx(center); const rr=imageToCanvasPx(rim); const R=Math.hypot(rr.x-cc.x, rr.y-cc.y); ctx.lineWidth=1*DPR; ctx.strokeStyle='#a0ffa0'; ctx.beginPath(); ctx.arc(cc.x,cc.y,R,0,Math.PI*2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cc.x, cc.y-R); ctx.lineTo(cc.x, cc.y-R+8*DPR); ctx.stroke(); if(centerPx){ ctx.fillStyle='#fff'; ctx.beginPath(); const tp=imageToCanvasPx(centerPx); ctx.arc(tp.x,tp.y,3*DPR,0,Math.PI*2); ctx.fill(); } }
    ctx.restore();
    // update overlay info (scale, image size)
    try{ let info = (currentTool==='pan'? 'Pan/Select' : currentTool); if(imgLoaded){ if(pixelsPerMM){ info += ' • Scale: '+pixelsPerMM.toFixed(2)+' px/mm ('+(1/pixelsPerMM).toFixed(3)+' mm/px)'; } info += ' • Img: '+imgNaturalW+'×'+imgNaturalH+' px'; } overlayInfo.innerText = info; }catch(e){}
  
  }

  // image loading
  function loadWithDataURL(file, onok, onfail){
    const reader=new FileReader();
    reader.onload=()=>{ const im=new Image(); im.onload=()=>onok(im, 'dataURL'); im.onerror=onfail; im.src=reader.result; };
    reader.onerror=onfail; reader.readAsDataURL(file);
  }
  function loadWithObjectURL(file, onok, onfail){
    try{ const url=URL.createObjectURL(file); const im=new Image(); im.onload=()=>{ URL.revokeObjectURL(url); onok(im, 'objectURL'); }; im.onerror=(e)=>{ URL.revokeObjectURL(url); onfail(e); }; im.src=url; }catch(e){ onfail(e); }
  }
  

function applyLoadedImage(loadedImg){
    // Apply new image and reset relevant annotation/readout state
    img = loadedImg;
    imgLoaded = true;
    imgNaturalW = img.naturalWidth || img.width;
    imgNaturalH = img.naturalHeight || img.height;

    // CLEAR previous annotations/readouts/history/presets
    shapes = [];
    history = [];
    presetState = [];
    toolState = [];
    activePreset = null;
    guided.textContent = '';
    readoutsEl.innerHTML = '';
    pixelsPerMM = null;
    lastJLCAdeg = 0;
    _currentWedge = null;
    _bhRect = null;
    _clockFace = null;

    // Fit and center new image if helper exists, otherwise set canvas size
    if (typeof fitImage === 'function') {
        fitImage();
    } else {
        scale = 1; originX = 0; originY = 0;
        setCanvasSize();
    }
    draw();

    log(`Image loaded ${imgNaturalW}×${imgNaturalH}`);
}


  function loadFromFile(file){ if(!file) return; loadWithDataURL(file, (im)=>applyLoadedImage(im), ()=>{ loadWithObjectURL(file, (im)=>applyLoadedImage(im), ()=>toast('Could not load image')); }); }
  
  // Clear old results when new image is loaded
  readoutsEl.innerHTML = '';
imageLoader.addEventListener('change', (e)=>{ const f=e.target.files?.[0]; if(f) loadFromFile(f); });
  wrapper.addEventListener('click', ()=>{ if(!imgLoaded) imageLoader.click(); });
  wrapper.addEventListener('dragover', (e)=>{ e.preventDefault(); });
  wrapper.addEventListener('drop', (e)=>{ e.preventDefault(); const file=e.dataTransfer.files?.[0]; if(file && file.type.startsWith('image/')) loadFromFile(file); });
// allow paste from clipboard (Ctrl+V) to load image
window.addEventListener('paste', (ev)=>{ try{ const items = ev.clipboardData && ev.clipboardData.files && ev.clipboardData.files.length? ev.clipboardData.files: (ev.clipboardData && ev.clipboardData.items? ev.clipboardData.items: null); if(items && items.length){ for(const f of items){ try{ const file = f instanceof File? f: (f.getAsFile? f.getAsFile(): null); if(file && file.type && file.type.startsWith('image/')){ loadFromFile(file); ev.preventDefault(); return; } }catch(e){} } } }catch(e){} }, false);


  function fitImage(){ const rect=wrapper.getBoundingClientRect(); const sx=rect.width/imgNaturalW, sy=rect.height/imgNaturalH; scale=Math.min(sx,sy)*0.98; originX=(rect.width-imgNaturalW*scale)/2; originY=(rect.height-imgNaturalH*scale)/2; }

  // pan/zoom
  let isPanning=false, startPanPx={x:0,y:0}, panOrigin={x:0,y:0};
  wrapper.addEventListener('mousedown', (e)=>{ const posPx = clientToCanvasPx(e); if (activePreset && imgLoaded && currentTool!=='pan'){ const pos=canvasPxToImage(posPx); handlePresetClick(pos); draw(); return; }
    if(!imgLoaded) return;
    if(e.button===0){
      if(currentTool==='pan'){ isPanning=true; startPanPx=posPx; panOrigin={x:originX,y:originY}; }
      else { const pos=canvasPxToImage(posPx); handleToolClick(pos); draw(); }
    }
  });
  window.addEventListener('mouseup', ()=>{ isPanning=false; });
  window.addEventListener('mousemove', (e)=>{ if(isPanning){ const mp=clientToCanvasPx(e); originX=panOrigin.x+(mp.x-startPanPx.x)/DPR; originY=panOrigin.y+(mp.y-startPanPx.y)/DPR; draw(); } });
  wrapper.addEventListener('wheel', (e)=>{ e.preventDefault(); const factor=Math.sign(e.deltaY)>0?0.9:1.1; const rect=wrapper.getBoundingClientRect(); const centerPx={x:rect.width*DPR/2,y:rect.height*DPR/2}; const centerImg=canvasPxToImage(centerPx); scale=Math.max(0.05, Math.min(10, scale*factor)); originX=(centerPx.x/DPR)-centerImg.x*scale; originY=(centerPx.y/DPR)-centerImg.y*scale; draw(); }, {passive:false});

  
function setTool(name){
  // allow toggling pan (click pan again to unselect)
  if(activePreset && name!=='pan'){
    toast('Guided preset active — click landmarks.');
    return;
  }
  if(name==='pan' && currentTool==='pan'){
    // unselect pan
    currentTool = '';
    document.querySelectorAll('.tool').forEach(b=>b.classList.toggle('active', b.dataset.tool===currentTool));
    overlayInfo.textContent = 'None';
    return;
  }
  currentTool = name;
  // update UI active states to match current tool
  document.querySelectorAll('.tool').forEach(b=>b.classList.toggle('active', b.dataset.tool===currentTool));
  overlayInfo.textContent = currentTool==='pan' ? 'Pan/Select' : currentTool;
}

  document.querySelectorAll('.tool').forEach(b=>b.addEventListener('click', ()=>setTool(b.dataset.tool))); setTool('pan');

  function addPoint(p,label){ shapes.push({type:'point',points:[{x:p.x,y:p.y}],meta:{label}}); }
  function addLine(a,b,label){ shapes.push({type:'line',points:[{x:a.x,y:a.y},{x:b.x,y:b.y}],meta:{label}}); }
  function pushReadout(title, htmlText){
    const entry = document.createElement('div'); entry.className='entry';
    const cb = document.createElement('input'); cb.type='checkbox'; cb.checked=true;
    const titleEl = document.createElement('div'); titleEl.className='title'; titleEl.textContent=title+':';
    const valueEl = document.createElement('div'); valueEl.className='value'; valueEl.innerHTML=htmlText;
    entry.appendChild(cb); entry.appendChild(titleEl); entry.appendChild(valueEl);
    readoutsEl.appendChild(entry);
  }
  selAllBtn?.addEventListener('click', ()=>{ readoutsEl.querySelectorAll('input[type=checkbox]').forEach(c=>c.checked=true); });
  selNoneBtn?.addEventListener('click', ()=>{ readoutsEl.querySelectorAll('input[type=checkbox]').forEach(c=>{ if(c.checked){ const entry = c.closest('.entry'); if(entry) entry.remove(); }}); });

  // --- Generic tools ---
  function handleToolClick(p){
    if(currentTool==='line'){
      toolState.push(p); addPoint(p, toolState.length===1?'L1':'L2');
      if(toolState.length===2){
        addLine(toolState[0], toolState[1], 'Line');
        const dpx = distPx(toolState[0], toolState[1]);
        const dmm = mmFromPx(dpx);
        pushReadout('Line length', dmm ? `${dmm.toFixed(1)} mm` : `${dpx.toFixed(0)} px <small>(calibrate for mm)</small>`);
        toolState=[];
      }
      return;
    }
    if(currentTool==='angle3'){
      toolState.push(p); addPoint(p, ['A','B','C'][toolState.length-1]);
      if(toolState.length===3){
        addLine(toolState[0], toolState[1], 'AB'); addLine(toolState[2], toolState[1], 'CB');
        // angle at B between BA and BC
        const A=toolState[0], B=toolState[1], C=toolState[2];
        function angleAt(B,A,C){
          const v1={x:A.x-B.x,y:A.y-B.y}, v2={x:C.x-B.x,y:C.y-B.y};
          const dot=v1.x*v2.x+v1.y*v2.y;
          const m1=Math.hypot(v1.x,v1.y), m2=Math.hypot(v2.x,v2.y);
          let ang=Math.acos(Math.max(-1,Math.min(1,dot/(m1*m2))))*180/Math.PI;
          return ang;
        }
        const ang = angleAt(B,A,C);
        pushReadout('Angle (A–B–C)', `${ang.toFixed(1)}°`);
        toolState=[];
      }
      return;
    }
    if(currentTool==='calibrate'){
      toolState.push(p); addPoint(p, toolState.length===1?'Cal1':'Cal2');
      if(toolState.length===2){
        addLine(toolState[0], toolState[1], 'Cal');
        const dpx = distPx(toolState[0], toolState[1]);
        let known = parseFloat(calLenEl.value||'0'); if((calUnitsEl.value||'mm')==='cm') known*=10;
        if(known>0){ pixelsPerMM = dpx/known; calStatusEl.textContent = `Calibrated: ${pixelsPerMM.toFixed(3)} px/mm`; toast('Calibration set'); }
        else { calStatusEl.textContent='Enter a valid length'; }
        toolState=[];
      }
      return;
    }
  }

  // --- Guided presets (from v6.1) ---
  function setPreset(name){
    _bhRect=null; _clockFace=null; _currentWedge=null; wedgeBadge.style.display='none';
    activePreset=name||null; presetState=[];
    if(name) presetACL.value='';
    
    const txt = {
      'HKA':'HKA: Hip → Knee → Ankle',
      'MPTA':'MPTA: Tib axis(2) → Joint line (med→lat)',
      'LDFA':'LDFA: Fem axis(2) → Distal joint line',
      'JLCA':'JLCA: Fem JL (med→lat) → Tib JL (med→lat)',
      'HTO':'HTO: Hip → Knee_med → Knee_lat → Ankle → Hinge → Open_med (wedge shaded)',
      'TibialSlope':'Tibial slope: Plateau (2) → Tibial axis (2)'
    }[name]||'';
    guided.textContent=txt;
  }
  presetSelect.addEventListener('change', ()=>setPreset(presetSelect.value));
  function setPresetACL(name){
    _bhRect=null; _clockFace=null; _currentWedge=null; wedgeBadge.style.display='none';
    activePreset=name||null; presetState=[];
    if(name) presetSelect.value='';
    
    const txt = {
      'ACL_TT':'ACL – Tibial Tunnel Angle (Lat): Tibial axis (2) → Tunnel (2)',
      'ACL_TT_AP':'ACL – Tibial Tunnel Inclination (AP): Tibial axis (2) → Tunnel (2)',
      'ACL_TT_PCT':'ACL – Tibial Tunnel % (AP): Anterior → Posterior → Center',
      'ACL_TT_ML':'ACL – Tibial Tunnel % (ML): Medial → Lateral → Center',
      'ACL_TT_SAG':'ACL – Tibial Tunnel vs Plateau (Sagittal): Plateau (2) → Tunnel (2)',
      'ACL_BH':'ACL – Bernard–Hertel: BL start→end → Posterior → Distal → Anterior → Center',
      'ACL_DIV':'ACL – Divergence: Graft (2) → Screw (2)',
      'ACL_LEN':'ACL – Screw Length: Head → Tip',
      'ACL_CLOCK':'ACL – Clock‑face: 12‑o’clock rim → Center → Tunnel'
    }[name]||'';
    guided.textContent=txt;
  }
  presetACL.addEventListener('change', ()=>setPresetACL(presetACL.value));
  function endPreset(){ activePreset=null; guided.textContent=''; presetSelect.value=''; presetACL.value=''; }

  // all preset handlers — each writes to pushReadout()
  function handlePresetClick(p){
    if(activePreset==='HKA'){
      const labels=['Hip','Knee','Ankle']; presetState.push(p); addPoint(p, labels[presetState.length-1]);
      if(presetState.length===3){ const [hip,knee,ankle]=presetState; addLine(hip,knee,'Fem mech axis'); addLine(ankle,knee,'Tib mech axis'); const ang=angleBetweenTwoLines(hip,knee,ankle,knee); const hka=(180-ang); const ok=within(hka, refs.HKA[0], refs.HKA[1]); pushReadout('HKA', `${hka.toFixed(1)}° ${ok?'<span class="ok">✔</span>':'<span class="warn">✖</span>'} <small>Ref ${refs.HKA[0]}–${refs.HKA[1]}°</small>`); endPreset(); } else guided.textContent='HKA: next'; return;
    }
    if(activePreset==='MPTA'){
      const labels=['TibiaAx1','TibiaAx2','JT_med','JT_lat']; presetState.push(p); addPoint(p, labels[presetState.length-1]);
      if(presetState.length===2){ addLine(presetState[0],presetState[1],'Tibial axis'); }
      if(presetState.length===4){ const [ax1,ax2,med,lat]=presetState; addLine(med,lat,'Tibial joint'); const ang=angleBetweenTwoLines(ax1,ax2,med,lat); const mpta=(90-ang); const ok=within(mpta, refs.MPTA[0], refs.MPTA[1]); pushReadout('MPTA', `${mpta.toFixed(1)}° ${ok?'<span class="ok">✔</span>':'<span class="warn">✖</span>'} <small>Ref ${refs.MPTA[0]}–${refs.MPTA[1]}°</small>`); endPreset(); } else guided.textContent='MPTA: next'; return;
    }
    if(activePreset==='LDFA'){
      const labels=['FemAx1','FemAx2','DF_med','DF_lat']; presetState.push(p); addPoint(p, labels[presetState.length-1]);
      if(presetState.length===2){ addLine(presetState[0],presetState[1],'Femoral axis'); }
      if(presetState.length===4){ const [ax1,ax2,med,lat]=presetState; addLine(med,lat,'Distal fem JL'); const ang=angleBetweenTwoLines(ax1,ax2,med,lat); const ldfa=(180-ang); const ok=within(ldfa, refs.LDFA[0], refs.LDFA[1]); pushReadout('LDFA', `${ldfa.toFixed(1)}° ${ok?'<span class="ok">✔</span>':'<span class="warn">✖</span>'} <small>Ref ${refs.LDFA[0]}–${refs.LDFA[1]}°</small>`); endPreset(); } else guided.textContent='LDFA: next'; return;
    }
    if(activePreset==='JLCA'){
      const labels=['FJL_med','FJL_lat','TJL_med','TJL_lat']; presetState.push(p); addPoint(p, labels[presetState.length-1]);
      if(presetState.length===2){ addLine(presetState[0],presetState[1],'Fem JL'); }
      if(presetState.length===4){ const [fmed,flat,tmed,tlat]=presetState; addLine(tmed,tlat,'Tib JL'); const ang=angleBetweenTwoLines(fmed,flat,tmed,tlat); const ok=within(ang, refs.JLCA[0], refs.JLCA[1]); lastJLCAdeg=ang; pushReadout('JLCA', `${ang.toFixed(1)}° ${ok?'<span class="ok">✔</span>':'<span class="warn">✖</span>'} <small>Ref ${refs.JLCA[0]}–${refs.JLCA[1]}°</small>`); endPreset(); } else guided.textContent='JLCA: next'; return;
    }
    if(activePreset==='HTO'){
      const labels=['Hip','Knee_med','Knee_lat','Ankle','Hinge','Open_med']; presetState.push(p); addPoint(p, labels[presetState.length-1]);
      if(presetState.length<6){ guided.textContent = `HTO: click ${labels[presetState.length]} next` + (presetState.length===5 ? ' — mark Open_med' : ''); if(presetState.length===3){ addLine(presetState[1],presetState[2],'Knee width'); } return; }
      const F=presetState[0], Km=presetState[1], Kl=presetState[2], A=presetState[3], H=presetState[4], M=presetState[5]; const wbl=0.625; const T={x:Km.x+(Kl.x-Km.x)*wbl, y:Km.y+(Kl.y-Km.y)*wbl};
      function rotate(p,c,t){ const s=Math.sin(t),cc=Math.cos(t),dx=p.x-c.x,dy=p.y-c.y; return {x:c.x+cc*dx-s*dy,y:c.y+s*dx+cc*dy}; }
      function area(a,b,c){ return 0.5*((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)); }
      function solve(F,T,A,H){ let lo=-0.436,hi=0.436; function f(th){ const Ar=rotate(A,H,th); return area(F,T,Ar); } for(let i=0;i<80;i++){ const mid=(lo+hi)/2, fm=f(mid); if(Math.sign(fm)===Math.sign(f(lo))) lo=mid; else hi=mid; } return (lo+hi)/2; }
      let theta=solve(F,T,A,H); let thetaDeg=theta*180/Math.PI; if(lastJLCAdeg) thetaDeg=Math.max(0, thetaDeg-lastJLCAdeg);
      const Arot=rotate(A,H,theta); addLine(F,T,'Target WBL'); addLine(H,A,'Pre-op'); addLine(H,Arot,'Post-op');
      const Hpx=imageToCanvasPx(H), Mpx=imageToCanvasPx(M); const Rpx=Math.hypot(Hpx.x-Mpx.x,Hpx.y-Mpx.y); const tpx=2*Rpx*Math.sin(Math.abs(theta)/2);
      const wedgeTxt = (pixelsPerMM ? (tpx/pixelsPerMM).toFixed(1)+' mm' : tpx.toFixed(1)+' px'); const Mrot=rotate(M,H,theta); _currentWedge={H,M,Mrot}; wedgeBadge.style.display='block'; wedgeBadge.textContent=`Wedge: ${wedgeTxt}`;
      pushReadout('HTO', `Correction θ: ${thetaDeg.toFixed(2)}°  |  Wedge: ${wedgeTxt}`); endPreset(); draw(); return;
    }

    
    if(activePreset==='TibialSlope'){
      const labels=['Plateau1','Plateau2','TibAx1','TibAx2'];
      presetState.push(p); addPoint(p, labels[presetState.length-1]);
      if(presetState.length===2){ addLine(presetState[0],presetState[1],'Plateau'); }
      if(presetState.length===4){
        addLine(presetState[2],presetState[3],'Tibial axis');
        const ang = angleBetweenTwoLines(presetState[0],presetState[1],presetState[2],presetState[3]);
        // Convert to posterior tibial slope approximation: slope = 90 - ang
        const slope = 90 - ang;
        const ok = within(slope, refs.Slope[0], refs.Slope[1]);
        pushReadout('Tibial slope', `${slope.toFixed(1)}° ${ok?'<span class="ok">✔</span>':'<span class="warn">✖</span>'} <small>Ref ${refs.Slope[0]}–${refs.Slope[1]}°</small>`);
        endPreset(); draw();
      } else guided.textContent='Tibial slope: click next';
      return;
    }
// ACL presets
    if(activePreset==='ACL_TT' || activePreset==='ACL_TT_AP'){
      const labels=['TibAx1','TibAx2','TunnelProx','TunnelDist']; presetState.push(p); addPoint(p,labels[presetState.length-1]);
      if(presetState.length===2){ addLine(presetState[0],presetState[1],'Tibial axis'); }
      if(presetState.length===4){
        addLine(presetState[2],presetState[3],'Tunnel');
        const ang=angleBetweenTwoLines(presetState[0],presetState[1],presetState[2],presetState[3]);
        const isAP = activePreset==='ACL_TT_AP'; const ref = isAP?refs.TTAP:refs.TTLat; const ok=within(ang,ref[0],ref[1]);
        pushReadout(isAP?'TT inclination (AP)':'TT angle (Lat)', `${ang.toFixed(1)}° ${ok?'<span class="ok">✔</span>':'<span class="warn">✖</span>'} <small>Ref ${ref[0]}–${ref[1]}°</small>`);
        endPreset();
      } else guided.textContent='Select next point';
      return;
    }
    if(activePreset==='ACL_TT_PCT'){
      const labels=['Anterior','Posterior','Center']; presetState.push(p); addPoint(p,labels[presetState.length-1]);
      if(presetState.length===2){ addLine(presetState[0],presetState[1],'AP plateau'); }
      if(presetState.length===3){
        const A=presetState[0], P=presetState[1], C=presetState[2];
        const AP={x:P.x-A.x,y:P.y-A.y}; const L=Math.hypot(AP.x,AP.y)||1; const U={x:AP.x/L,y:AP.y/L};
        const d=(C.x-A.x)*U.x + (C.y-A.y)*U.y; const pct=clamp(0,(d/L)*100,100); const ok=within(pct, refs.TTPct[0], refs.TTPct[1]);
        pushReadout('Tibial tunnel AP %', `${pct.toFixed(1)}% from anterior ${ok?'<span class="ok">✔</span>':'<span class="warn">✖</span>'} <small>Ref ${refs.TTPct[0]}–${refs.TTPct[1]}%</small>`);
        endPreset(); draw();
      } else guided.textContent='AP %: click next';
      return;
    }
    if(activePreset==='ACL_TT_ML'){
      const labels=['Medial','Lateral','Center']; presetState.push(p); addPoint(p,labels[presetState.length-1]);
      if(presetState.length===2){ addLine(presetState[0],presetState[1],'ML plateau'); }
      if(presetState.length===3){
        const M=presetState[0], Lp=presetState[1], C=presetState[2];
        const ML={x:Lp.x-M.x,y:Lp.y-M.y}; const Llen=Math.hypot(ML.x,ML.y)||1; const U={x:ML.x/Llen,y:ML.y/Llen};
        const d=(C.x-M.x)*U.x + (C.y-M.y)*U.y; const pct=clamp(0,(d/Llen)*100,100); const ok=within(pct, refs.TTML[0], refs.TTML[1]);
        pushReadout('Tibial tunnel ML %', `${pct.toFixed(1)}% from medial ${ok?'<span class="ok">✔</span>':'<span class="warn">✖</span>'} <small>Ref ${refs.TTML[0]}–${refs.TTML[1]}%</small>`);
        endPreset(); draw();
      } else guided.textContent='ML %: click next';
      return;
    }
    if(activePreset==='ACL_TT_SAG'){
      const labels=['Plateau1','Plateau2','Tunnel1','Tunnel2']; presetState.push(p); addPoint(p,labels[presetState.length-1]);
      if(presetState.length===2){ addLine(presetState[0],presetState[1],'Plateau'); }
      if(presetState.length===4){
        addLine(presetState[2],presetState[3],'Tunnel');
        const ang=angleBetweenTwoLines(presetState[0],presetState[1],presetState[2],presetState[3]);
        const ok=within(ang, refs.TTSag[0], refs.TTSag[1]);
        pushReadout('Tunnel vs Plateau (sagittal)', `${ang.toFixed(1)}° ${ok?'<span class="ok">✔</span>':'<span class="warn">✖</span>'} <small>Ref ${refs.TTSag[0]}–${refs.TTSag[1]}°</small>`);
        endPreset();
      } else guided.textContent='Sagittal: click next';
      return;
    }
    if(activePreset==='ACL_BH'){
      const labels=['BL_start','BL_end','Posterior','Distal','Anterior','Center']; presetState.push(p); addPoint(p,labels[presetState.length-1]);
      if(presetState.length===2){ addLine(presetState[0],presetState[1],'Blumensaat'); }
      if(presetState.length===6){
        const [B1,B2,P,D,A,C]=presetState;
        const Uraw={x:B2.x-B1.x,y:B2.y-B1.y}; const Umag=Math.hypot(Uraw.x,Uraw.y)||1; const U={x:Uraw.x/Umag,y:Uraw.y/Umag};
        const V={x:-U.y,y:U.x};
        function proj(p,origin,axis){ return (p.x-origin.x)*axis.x + (p.y-origin.y)*axis.y; }
        const pU=proj(P,B1,U), aU=proj(A,B1,U); const dV=proj(D,B1,V);
        const L=Math.abs(aU-pU), H=Math.abs(dV); const O={x:B1.x + U.x*Math.min(pU,aU), y:B1.y + U.y*Math.min(pU,aU)};
        const cU=proj(C,O,U), cV=proj(C,O,V);
        const xPerc=clamp(0,(cU/L)*100,100), yPerc=clamp(0,(cV/H)*100,100);
        _bhRect={O,U,V,L,H,C,txt:`${xPerc.toFixed(1)}% deep–shallow, ${yPerc.toFixed(1)}% high–low`};
        const okX=within(xPerc, refs.BHx[0], refs.BHx[1]); const okY=within(yPerc, refs.BHy[0], refs.BHy[1]);
        pushReadout('Femoral tunnel (BH)', `deep–shallow ${xPerc.toFixed(1)}% ${okX?'<span class="ok">✔</span>':'<span class="warn">✖</span>'} <small>Ref ${refs.BHx[0]}–${refs.BHx[1]}%</small><br/>high–low ${yPerc.toFixed(1)}% ${okY?'<span class="ok">✔</span>':'<span class="warn">✖</span>'} <small>Ref ${refs.BHy[0]}–${refs.BHy[1]}%</small>`);
        endPreset(); draw();
      } else guided.textContent='Bernard–Hertel: click next'; return;
    }
    if(activePreset==='ACL_DIV'){
      const labels=['Graft1','Graft2','Screw1','Screw2']; presetState.push(p); addPoint(p,labels[presetState.length-1]);
      if(presetState.length===2){ addLine(presetState[0],presetState[1],'Graft axis'); }
      if(presetState.length===4){
        addLine(presetState[2],presetState[3],'Screw axis');
        const ang=angleBetweenTwoLines(presetState[0],presetState[1],presetState[2],presetState[3]);
        const ok = ang <= refs.DIVMax;
        pushReadout('Screw–Graft divergence', `${ang.toFixed(1)}° ${ok?'<span class="ok">✔</span>':'<span class="warn">✖</span>'} <small>Ref ≤ ${refs.DIVMax}°</small>`);
        endPreset();
      } else guided.textContent='Select next point'; return;
    }
    if(activePreset==='ACL_LEN'){
      const labels=['Head','Tip']; presetState.push(p); addPoint(p,labels[presetState.length-1]);
      if(presetState.length===2){
        addLine(presetState[0],presetState[1],'Screw');
        const dpx = distPx(presetState[0], presetState[1]);
        const dmm = mmFromPx(dpx);
        pushReadout('Screw length', dmm ? `${dmm.toFixed(1)} mm` : `${dpx.toFixed(0)} px <small>(calibrate for mm)</small>`);
        endPreset();
      } else guided.textContent='Click Tip'; return;
    }
    if(activePreset==='ACL_CLOCK'){
      const labels=['TwelveRim','NotchCenter','TunnelCenter']; presetState.push(p); addPoint(p,labels[presetState.length-1]);
      if(presetState.length===2){
        addLine(presetState[0],presetState[1],'12→Center');
        _clockFace = {center: presetState[1], rim: presetState[0]};
      }
      if(presetState.length===3){
        const twelve = presetState[0], center = presetState[1], tunnel = presetState[2];
        _clockFace.centerPx = tunnel;
        function angle(c, ref, pt){ const v0={x:ref.x-c.x,y:ref.y-c.y}, v1={x:pt.x-c.x,y:pt.y-c.y}; const a0=Math.atan2(v0.y,v0.x), a1=Math.atan2(v1.y,v1.x); let ang=((a1-a0)*180/Math.PI); ang=(( -ang % 360)+360)%360; return ang; }
        let ang = angle(center, twelve, tunnel);
        const side = kneeSideEl.value||'right'; if(side==='left'){ ang=(360-ang)%360; }
        const hours = Math.floor(ang / 30); const minutes = Math.round(((ang % 30)/30)*60);
        pushReadout(`Femoral clock‑face (${side})`, `${hours}:${minutes.toString().padStart(2,'0')} o’clock <small>(${ang.toFixed(1)}° from 12)</small>`);
        endPreset(); draw();
      } else guided.textContent='Clock‑face: Center, then Tunnel'; return;
    }
  }

  // Undo / Reset / Save / Load
  btnUndo.addEventListener('click', ()=>{ const op=history.pop(); if(!op) return; if(op.action==='add'){ shapes.splice(-op.count, op.count); } draw(); });
  btnReset.addEventListener('click', ()=>{
  if(!confirm('Clear drawn lines?')) return;
  // Clear only drawings and undo history; preserve calibration and readouts
  if (Array.isArray(shapes)) shapes.length = 0;
  if (Array.isArray(history)) history.length = 0;
  // reset temporary drawing state
  _currentWedge = null;
  if (typeof wedgeBadge !== 'undefined' && wedgeBadge) wedgeBadge.style.display='none';
  guided.textContent='';
  // keep pixelsPerMM (calibration) and readouts intact
  // do not change active tool on reset — preserve current tool
  draw();
  showToast('Drawing lines cleared, results preserved.');
});

  btnSaveJSON.addEventListener('click', ()=>{
    const readoutsData=[...readoutsEl.querySelectorAll('.entry')].map(e=>({checked:e.querySelector('input').checked,title:e.querySelector('.title').textContent.replace(':',''),html:e.querySelector('.value').innerHTML}));
    const data={shapes,pixelsPerMM,lastJLCAdeg,refs, wedge:_currentWedge, bh:_bhRect, clock:_clockFace, kneeSide:kneeSideEl.value, readouts:readoutsData};
    const blob=new Blob([JSON.stringify(data)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='osteolab-pro-v7.json'; a.click(); URL.revokeObjectURL(a.href);
  });
  

  



// Export with readouts (only checked)
btnExport.addEventListener('click', ()=>{
    const withInfo = !!exportReadoutsEl?.checked;
    const rect = wrapper.getBoundingClientRect();
    const DPR = window.devicePixelRatio || 1;

    // collect readouts/notes
    const entries = [...readoutsEl.querySelectorAll('.entry')];
    const chosen = entries.filter(e => e.querySelector('input')?.checked);
    const resultsLines = (chosen.length ? chosen : entries).map(e => (`${e.querySelector('.title').textContent} ${e.querySelector('.value').innerText}`).toUpperCase());
    const notesRaw = (caseNotesEl?.value || '').trim();
    const notesLine = notesRaw ? ('Notes: ' + notesRaw) : null;

    const pad = Math.round(20 * DPR);
    const fontSize = Math.round(22 * DPR);
    const lineH = Math.round(28 * DPR);
    const linesCount = resultsLines.length + (notesLine ? 1 : 0);
    const totalHeight = withInfo ? (pad * 2 + linesCount * lineH) : 0;

    // Compute visible/cropped source region in source pixels
    const visibleW_img = Math.round(rect.width / scale);
    const visibleH_img = Math.round(rect.height / scale);
    const sx = Math.max(0, Math.round((-originX) / scale));
    const sy = Math.max(0, Math.round((-originY) / scale));
    const sw = Math.min(imgNaturalW - sx, visibleW_img);
    const sh = Math.min(imgNaturalH - sy, visibleH_img);
    const destW = Math.max(1, Math.round(sw * DPR));
    const destH = Math.max(1, Math.round(sh * DPR));

    // Create canvas sized to the cropped image width (destW) and cropped image height + strip
    const ex = document.createElement('canvas');
    ex.width = destW;
    ex.height = destH + totalHeight;
    const cx = ex.getContext('2d');

    // Draw cropped image into top of canvas (no white borders)
    if (imgLoaded) {
      cx.drawImage(img, sx, sy, sw, sh, 0, 0, destW, destH);
    } else {
      // fallback: fill background if no image
      cx.fillStyle = "#000"; cx.fillRect(0, 0, ex.width, ex.height);
    }

    // helper functions map to exported canvas coordinates (scale * DPR applied)
    function _to(p) { return { x: Math.round((p.x - sx) * scale * DPR), y: Math.round((p.y - sy) * scale * DPR) }; }
    function _point(p, label) {
      const c = _to(p); const r = 7 * DPR;
      cx.beginPath(); cx.arc(c.x, c.y, r, 0, Math.PI * 2); cx.fillStyle = "#fff"; cx.fill();
      if (label) { cx.fillStyle = "#fff"; cx.font = `${12 * DPR}px ui-sans-serif`; cx.fillText(label, c.x + 10 * DPR, c.y - 8 * DPR); }
    }
    function _line(a, b, label) {
      const ca = _to(a), cb = _to(b);
      cx.beginPath(); cx.moveTo(ca.x, ca.y); cx.lineTo(cb.x, cb.y); cx.strokeStyle = "#fff"; cx.lineWidth = 2 * DPR; cx.stroke();
      if (label) { cx.fillStyle = "#fff"; cx.font = `${12 * DPR}px ui-sans-serif`; cx.fillText(label, (ca.x + cb.x) / 2 + 6 * DPR, (ca.y + cb.y) / 2); }
    }

    // draw shapes translated to new coordinates
    for (const s of shapes) {
      if (s.type === 'point') _point(s.points[0], s.meta?.label);
      else if (s.type === 'line') _line(s.points[0], s.points[1], s.meta?.label);
    }
    if (_currentWedge) {
      const H = _to(_currentWedge.H), M = _to(_currentWedge.M), Mr = _to(_currentWedge.Mr);
      cx.beginPath(); cx.moveTo(H.x, H.y); cx.lineTo(M.x, M.y); cx.lineTo(Mr.x, Mr.y);
      cx.closePath(); cx.strokeStyle = "#fff"; cx.lineWidth = 2 * DPR; cx.stroke(); cx.fillStyle = "rgba(255,255,255,0.06)"; cx.fill();
    }

    // Draw bottom strip full width = destW, so readout text block matches image width
    if (withInfo && totalHeight > 0) {
      const stripY = destH;
      cx.fillStyle = "#000";
      cx.fillRect(0, stripY, destW, totalHeight);
      // draw text within width of image (destW), right aligned to destW - pad
      cx.textBaseline = "top";
      let y = stripY + pad;
      const xRight = destW - pad;
      // Draw results lines (ALL CAPS) right-aligned
      for (let i = 0; i < resultsLines.length; i++) {
        const ln = resultsLines[i];
        cx.fillStyle = "#fff";
        cx.font = `bold ${fontSize}px ui-sans-serif`;
        const metrics = cx.measureText(ln);
        const drawX = Math.max(pad, xRight - metrics.width);
        cx.fillText(ln, drawX, y);
        y += lineH;
      }
      // Draw notes (native case) right-aligned
      if (notesLine) {
        cx.fillStyle = "#fff";
        cx.font = `${fontSize}px ui-sans-serif`;
        const metrics = cx.measureText(notesLine);
        const drawX = Math.max(pad, xRight - metrics.width);
        cx.fillText(notesLine, drawX, y);
        y += lineH;
      }
      // Place OsteoPlan mark bottom-left inside strip
      const markFontSize = Math.round(14 * DPR);
      cx.font = `${markFontSize}px ui-sans-serif`;
      cx.fillStyle = "#e8ecf1";
      const mark = "OsteoPlan v1.0";
      const markX = pad;
      const markY = stripY + totalHeight - pad - markFontSize;
      cx.fillText(mark, markX, markY);
    }

    ex.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'osteoplan-export.png';
      a.click();
      URL.revokeObjectURL(a.href);
    });
});
function wrapText(ctx, text, x, y, maxWidth, lineHeight){
    const words = text.split(/\s+/); let lineStr='';
    for(let n=0;n<words.length;n++){
      const test = lineStr + words[n] + ' ';
      const m = ctx.measureText(test);
      if(m.width > maxWidth && n>0){ ctx.fillText(lineStr, x, y); lineStr=words[n]+' '; y += lineHeight; }
      else { lineStr = test; }
    }
    if(lineStr) ctx.fillText(lineStr, x, y);
  }

  // Help modal
  btnHelp?.addEventListener('click', ()=>helpModal.classList.add('open'));
  helpClose?.addEventListener('click', ()=>helpModal.classList.remove('open'));
  helpModal?.addEventListener('click', (e)=>{ const box=helpModal.querySelector('.help-box'); if(box && !box.contains(e.target)) helpModal.classList.remove('open'); });

  // init
  setCanvasSize(); overlayInfo.textContent='Pan/Select'; log('OsteoPlan ready (v1.0)');
})();

/* --- Export PNG (readouts + notes) - appended by assistant --- */
(function(){
  if (window.__export_png_attached) return;
  window.__export_png_attached = true;

  const btnExport = document.getElementById('btnExport');
  const canvasWrapper = document.getElementById('canvasWrapper');
  const exportReadouts = document.getElementById('exportReadouts');
  const readouts = document.getElementById('readouts');
  const caseNotes = document.getElementById('caseNotes');

  if (!btnExport || !canvasWrapper) {
    console.warn('Export: required DOM elements not found.');
    return;
  }

  btnExport.addEventListener('click', async () => {
    try {
      // Create overlay container showing readouts/notes
      let exportContainer = document.createElement('div');
      exportContainer.style.position = 'absolute';
      exportContainer.style.bottom = '10px';
      exportContainer.style.right = '10px';
      exportContainer.style.background = 'rgba(0,0,0,0.6)';
      exportContainer.style.color = '#fff';
      exportContainer.style.fontSize = '12px';
      exportContainer.style.padding = '10px';
      exportContainer.style.borderRadius = '10px';
      exportContainer.style.maxWidth = '320px';
      exportContainer.style.zIndex = 9999;
      exportContainer.style.whiteSpace = 'pre-wrap';
      exportContainer.style.pointerEvents = 'none';

      if (exportReadouts && exportReadouts.checked && readouts) {
        const notesText = caseNotes && caseNotes.value.trim() ? `Notes:\n${caseNotes.value}\n\n` : '';
        const readoutText = Array.from(readouts.querySelectorAll('.entry'))
          .filter(e => e.querySelector('input[type="checkbox"]:checked'))
          .map(e => {
            const titleEl = e.querySelector('.title');
            const valEl = e.querySelector('.value');
            const title = titleEl ? titleEl.innerText.trim() : '';
            const val = valEl ? valEl.innerText.trim() : e.innerText.trim();
            return title ? `${title}: ${val}` : val;
          })
          .join('\n');

        exportContainer.textContent = `${notesText}${readoutText}`.trim();
        canvasWrapper.appendChild(exportContainer);
      }

      // Load html2canvas from CDN if missing
      if (typeof html2canvas === 'undefined') {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
          s.onload = resolve;
          s.onerror = () => reject(new Error('Failed to load html2canvas from CDN'));
          document.head.appendChild(s);
        });
      }

      const screenshot = await html2canvas(canvasWrapper, {
        useCORS: true,
        backgroundColor: '#0a0f18',
        scale: Math.max(1, window.devicePixelRatio || 1)
      });

      screenshot.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'OsteoPlan_Export.png';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      }, 'image/png');

      // Cleanup overlay
      if (exportContainer.parentNode) exportContainer.remove();
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed. See console for details.');
    }
  });
})();


// Mobile overlay toggles — show sidebar/inspector as full-screen overlays on small screens
(function(){
  const btnLeft = document.getElementById('btnLeftMenu');
  const btnRight = document.getElementById('btnRightMenu');
  let leftOverlay = null, rightOverlay = null;

  function createOverlay(id, contentHtml){
    const ov = document.createElement('div');
    ov.className = 'panel-overlay';
    ov.id = id;
    const close = document.createElement('div');
    close.style.display='flex';
    close.style.justifyContent='space-between';
    close.style.alignItems='center';
    close.innerHTML = '<div style="font-weight:700;">Menu</div>';
    const btn = document.createElement('button');
    btn.textContent = 'Close';
    btn.className = 'close-btn';
    btn.addEventListener('click', ()=>{ ov.remove(); });
    close.appendChild(btn);
    ov.appendChild(close);
    const container = document.createElement('div');
    container.innerHTML = contentHtml;
    ov.appendChild(container);
    return ov;
  }

  if(btnLeft){
    btnLeft.addEventListener('click', ()=>{
      // prevent opening when desktop
      if(window.innerWidth>700) return;
      if(leftOverlay) { leftOverlay.remove(); leftOverlay=null; return; }
      const sidebar = document.querySelector('.sidebar');
      if(!sidebar) return;
      leftOverlay = createOverlay('leftOverlay', sidebar.innerHTML);
      document.body.appendChild(leftOverlay);
    });
  }
  if(btnRight){
    btnRight.addEventListener('click', ()=>{
      if(window.innerWidth>700) return;
      if(rightOverlay) { rightOverlay.remove(); rightOverlay=null; return; }
      const insp = document.querySelector('.inspector');
      if(!insp) return;
      rightOverlay = createOverlay('rightOverlay', insp.innerHTML);
      document.body.appendChild(rightOverlay);
    });
  }

  // Remove overlays on resize to desktop
  window.addEventListener('resize', ()=>{
    if(window.innerWidth>700){
      if(leftOverlay){ leftOverlay.remove(); leftOverlay=null; }
      if(rightOverlay){ rightOverlay.remove(); rightOverlay=null; }
    }
  });
})();







// Mobile action bar toggle and wiring
(function(){
  const btn = document.getElementById('btnActionToggle');
  const bar = document.getElementById('mobileActionBar');
  const imageLoader = document.getElementById('imageLoader');
  const exportReadouts = document.getElementById('exportReadouts');
  const btnExport = document.getElementById('btnExport');
  const btnHelp = document.getElementById('btnHelp');
  const btnSaveJSON = document.getElementById('btnSaveJSON');

  if(btn && bar){
    btn.addEventListener('click', ()=>{
      if(window.innerWidth>700) return;
      bar.style.display = (bar.style.display === 'flex') ? 'none' : 'flex';
    });
  }
  // wire mobileLoad to imageLoader
  const mobileLoad = document.getElementById('mobileLoad');
  if(mobileLoad && imageLoader){
    mobileLoad.addEventListener('click', ()=> imageLoader.click());
  }
  // wire mobileExportReadouts to the main checkbox
  const mobileExportReadouts = document.getElementById('mobileExportReadouts');
  if(mobileExportReadouts && exportReadouts){
    // sync states both ways
    mobileExportReadouts.checked = exportReadouts.checked;
    mobileExportReadouts.addEventListener('change', ()=> exportReadouts.checked = mobileExportReadouts.checked);
    exportReadouts.addEventListener('change', ()=> mobileExportReadouts.checked = exportReadouts.checked);
  }
  // wire mobileExportPNG to btnExport
  const mobileExportPNG = document.getElementById('mobileExportPNG');
  if(mobileExportPNG && btnExport){
    mobileExportPNG.addEventListener('click', ()=> btnExport.click());
  }
  // wire mobileHelpBtn to help modal
  const mobileHelpBtn = document.getElementById('mobileHelpBtn');
  if(mobileHelpBtn && btnHelp){
    mobileHelpBtn.addEventListener('click', ()=> btnHelp.click());
  }

  // hide bar on resize to desktop
  window.addEventListener('resize', ()=>{ if(window.innerWidth>700 && bar) bar.style.display='none'; });

})();



// Mobile: two toggles — Actions (load/export/help) and Tools (tools & presets overlay). Results visible below image.
(function(){
  const actionsBtn = document.getElementById('btnActionsToggle');
  const toolsBtn = document.getElementById('btnToolsToggle');
  const mobileBar = document.getElementById('mobileActionBar');
  let toolsOverlay = null;

  // Actions toggle: show/hide mobileActionBar
  if(actionsBtn && mobileBar){
    actionsBtn.addEventListener('click', ()=>{
      if(window.innerWidth>700) return;
      mobileBar.style.display = (mobileBar.style.display==='flex') ? 'none' : 'flex';
      // if opening actions, close tools overlay
      if(mobileBar.style.display==='flex' && toolsOverlay){ toolsOverlay.remove(); toolsOverlay=null; }
    });
  }

  // Tools toggle: show combined tools+presets overlay (compact)
  function createToolsOverlay(sidebarHtml){
    const ov = document.createElement('div');
    ov.className = 'panel-overlay combined';
    ov.style.overflow='auto';
    const top = document.createElement('div');
    top.style.display='flex'; top.style.justifyContent='space-between'; top.style.alignItems='center'; top.style.marginBottom='8px';
    const title = document.createElement('div'); title.innerHTML='<strong>Tools & Presets</strong>';
    const closeBtn = document.createElement('button'); closeBtn.className='close-btn'; closeBtn.textContent='✕';
    closeBtn.addEventListener('click', ()=>{ ov.remove(); toolsOverlay=null; });
    top.appendChild(title); top.appendChild(closeBtn);
    ov.appendChild(top);
    const container = document.createElement('div');
    container.innerHTML = sidebarHtml;
    ov.appendChild(container);
    return ov;
  }

  if(toolsBtn){
    toolsBtn.addEventListener('click', ()=>{
      if(window.innerWidth>700) return;
      // toggle
      if(toolsOverlay){ toolsOverlay.remove(); toolsOverlay=null; return; }
      const sidebar = document.querySelector('.sidebar');
      if(!sidebar) return;
      toolsOverlay = createToolsOverlay(sidebar.innerHTML);
      document.body.appendChild(toolsOverlay);
      // close mobile action bar if open
      if(mobileBar) mobileBar.style.display='none';
    });
  }

  // Close overlays on resize to desktop
  window.addEventListener('resize', ()=>{
    if(window.innerWidth>700){
      if(toolsOverlay){ toolsOverlay.remove(); toolsOverlay=null; }
      if(mobileBar) mobileBar.style.display='none';
    }
  });
})();



// Robust export for mobile/desktop: capture the displayed canvas area (wrapper) as PNG
function exportVisibleCanvas(filename='osteo_export.png'){
  try{
    const DPR = window.devicePixelRatio || 1;
    const wrapRect = wrapper.getBoundingClientRect();
    const w = Math.max(1, Math.round(wrapRect.width));
    const h = Math.max(1, Math.round(wrapRect.height));
    // create temp canvas at DPR scaled resolution
    const tmp = document.createElement('canvas');
    tmp.width = Math.round(w * DPR);
    tmp.height = Math.round(h * DPR);
    tmp.style.width = w + 'px'; tmp.style.height = h + 'px';
    const tctx = tmp.getContext('2d');
    // fill background same as wrapper
    tctx.fillStyle = getComputedStyle(wrapper).backgroundColor || '#0a0f18';
    tctx.fillRect(0,0,tmp.width,tmp.height);
    // draw the main canvas content scaled to fit wrapper box
    // compute source canvas pixel size
    const srcCanvas = canvas;
    // Determine the displayed size of the source canvas (CSS pixels)
    const srcRect = srcCanvas.getBoundingClientRect();
    // draw the actual canvas bitmap into tmp canvas, scaling appropriately
    tctx.drawImage(srcCanvas, 0, 0, srcCanvas.width, srcCanvas.height, 0, 0, tmp.width, tmp.height);
    // Optionally draw readouts text into bottom-left (if exportReadouts enabled)
    if(document.getElementById('exportReadouts')?.checked){
      const ro = document.getElementById('readouts');
      if(ro){
        tctx.save();
        tctx.scale(DPR, DPR);
        tctx.font = '12px sans-serif';
        tctx.fillStyle = 'white';
        // draw a translucent backdrop for readability
        tctx.globalAlpha = 0.6;
        const pad=8, lineH=16;
        const lines = ro.innerText.split('\n').slice(0, 30);
        const boxW = Math.min(240, Math.max(120, wrapRect.width*0.6));
        const boxH = (lines.length+1)*lineH + pad*2;
        tctx.fillRect(8, tmp.height/DPR - boxH - 8, boxW, boxH);
        tctx.globalAlpha = 1.0;
        tctx.fillStyle = 'white';
        for(let i=0;i<lines.length;i++){
          tctx.fillText(lines[i], 12, tmp.height/DPR - boxH + pad + (i+1)*lineH - 6);
        }
        tctx.restore();
      }
    }
    // create blob and download
    tmp.toBlob((blob)=>{
      const a = document.createElement('a');
      const url = URL.createObjectURL(blob);
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 1500);
    }, 'image/png');
  }catch(e){ console.error('Export failed', e); toast('Export failed'); }
}

// Wire btnExport to exportVisibleCanvas (override existing if present)
(function bindExportOverride(){
  const btnExportEl = document.getElementById('btnExport');
  if(btnExportEl){
    btnExportEl.addEventListener('click', (ev)=>{
      ev.preventDefault(); ev.stopPropagation();
      exportVisibleCanvas();
    });
  }
  // Also wire mobileExportPNG if exists
  const mobileExportPNG = document.getElementById('mobileExportPNG');
  if(mobileExportPNG){
    mobileExportPNG.addEventListener('click', (e)=>{ e.preventDefault(); exportVisibleCanvas(); });
  }
})();


 for Presets + Actions
(function(){
  const pBtn = document.getElementById('btnPresetsToggle');
  const aBtn = document.getElementById('btnActionsToggle');
  const pPanel = document.getElementById('portraitPresetsPanel');
  const aBar = document.getElementById('portraitActionBar');
  const sidebar = document.querySelector('.sidebar');
  const canvas = document.getElementById('canvas');

  if(sidebar && pPanel){
    pPanel.innerHTML = sidebar.innerHTML;
  }

  function togglePresets(){
    if(!pPanel) return;
    const active = pPanel.classList.contains('active');
    if(active){
      pPanel.classList.remove('active');
      setTimeout(()=>{ pPanel.style.display='none'; },200);
      if(canvas) canvas.style.pointerEvents='auto';
    } else {
      pPanel.style.display='block';
      setTimeout(()=> pPanel.classList.add('active'),10);
      if(canvas) canvas.style.pointerEvents='none';
      if(aBar) aBar.style.display='none';
    }
  }

  function toggleActions(){
    if(!aBar) return;
    const visible = aBar.style.display==='flex';
    aBar.style.display = visible ? 'none' : 'flex';
    if(pPanel){
      pPanel.classList.remove('active');
      pPanel.style.display='none';
    }
  }

  if(pBtn) pBtn.addEventListener('click', togglePresets);
  if(aBtn) aBtn.addEventListener('click', toggleActions);

  // Outside click closes all
  document.addEventListener('click', (e)=>{
    if(window.innerWidth>700) return;
    const inPresets = pPanel.contains(e.target) || pBtn.contains(e.target);
    const inActions = aBar.contains(e.target) || aBtn.contains(e.target);
    if(!inPresets){ pPanel.classList.remove('active'); pPanel.style.display='none'; }
    if(!inActions){ aBar.style.display='none'; }
  });

  // Wire action buttons
  const loadBtn = document.getElementById('pLoad');
  const exportBtn = document.getElementById('pExport');
  const helpBtn = document.getElementById('pHelp');
  const fileInput = document.getElementById('imageLoader');
  const exportMain = document.getElementById('btnExport');
  const helpMain = document.getElementById('btnHelp');

  if(loadBtn && fileInput){ loadBtn.addEventListener('click', ()=> fileInput.click()); }
  if(exportBtn && exportMain){ exportBtn.addEventListener('click', ()=> exportMain.click()); }
  if(helpBtn && helpMain){ helpBtn.addEventListener('click', ()=> helpMain.click()); }

  window.addEventListener('resize', ()=>{
    if(window.innerWidth>700){
      if(pPanel){ pPanel.classList.remove('active'); pPanel.style.display='none'; }
      if(aBar){ aBar.style.display='none'; }
    }
  });
})();



 — disable canvas pointer events while panel open, small open delay
(function(){
  const pBtn = document.getElementById('btnPresetsToggle');
  const aBtn = document.getElementById('btnActionsToggle');
  const pPanel = document.getElementById('portraitPresetsPanel');
  const aBar = document.getElementById('portraitActionBar');
  const sidebar = document.querySelector('.sidebar');
  const canvas = document.getElementById('canvas');

  // Populate panel early so iOS hit-testing recognizes elements
  if(sidebar && pPanel){
    pPanel.innerHTML = '<div class="close-btn" style="display:flex;justify-content:flex-end;padding:8px;"><button id="closePresets" class="ghost">✕ Close</button></div>' + sidebar.innerHTML;
  }

  function enableCanvas(enable){
    try{
      if(canvas) canvas.style.pointerEvents = enable ? 'auto' : 'none';
    }catch(e){}
  }

  function openPresets(){
    if(!pPanel) return;
    // disable canvas events first
    enableCanvas(false);
    // small delay to let iOS complete repaint/hit-test
    setTimeout(()=>{
      pPanel.style.display='block';
      pPanel.classList.add('active');
    },150);
  }
  function closePresets(){
    if(!pPanel) return;
    pPanel.classList.remove('active');
    setTimeout(()=>{ pPanel.style.display='none'; enableCanvas(true); },250);
  }

  function togglePresets(){
    if(!pPanel) return;
    if(pPanel.classList.contains('active')) closePresets(); else openPresets();
  }

  function openActions(){
    if(!aBar) return;
    enableCanvas(false);
    setTimeout(()=>{ aBar.style.display = 'flex'; },150);
  }
  function closeActions(){
    if(!aBar) return;
    aBar.style.display = 'none';
    enableCanvas(true);
  }
  function toggleActions(){
    if(!aBar) return;
    if(aBar.style.display==='flex') closeActions(); else openActions();
  }

  if(pBtn) pBtn.addEventListener('click', function(e){ e.stopPropagation(); togglePresets(); });
  if(aBtn) aBtn.addEventListener('click', function(e){ e.stopPropagation(); toggleActions(); });

  // close buttons inside panel
  document.addEventListener('click', function(e){
    // if clicked outside panels in portrait, close them
    if(window.innerWidth>700) return;
    const target = e.target;
    if(pPanel && pPanel.classList.contains('active')){
      if(!pPanel.contains(target) && !pBtn.contains(target)){
        closePresets();
      }
    }
    if(aBar && aBar.style.display==='flex'){
      if(!aBar.contains(target) && !aBtn.contains(target)){
        closeActions();
      }
    }
  }, true);

  // wire portrait action bar buttons to main controls
  const loadBtn = document.getElementById('pLoad');
  const exportBtn = document.getElementById('pExport');
  const helpBtn = document.getElementById('pHelp');
  const fileInput = document.getElementById('imageLoader');
  const exportMain = document.getElementById('btnExport');
  const helpMain = document.getElementById('btnHelp');

  if(loadBtn && fileInput){ loadBtn.addEventListener('click', ()=> fileInput.click()); }
  if(exportBtn && exportMain){ exportBtn.addEventListener('click', ()=> exportMain.click()); }
  if(helpBtn && helpMain){ helpBtn.addEventListener('click', ()=> helpMain.click()); }

  // ensure panels hide on resize to desktop
  window.addEventListener('resize', ()=>{ if(window.innerWidth>700){ if(pPanel){ pPanel.classList.remove('active'); pPanel.style.display='none'; } if(aBar){ aBar.style.display='none'; } enableCanvas(true); }});

  // Ensure panels are initially hidden
  if(pPanel){ pPanel.style.display='none'; pPanel.classList.remove('active'); }
  if(aBar){ aBar.style.display='none'; }

})();


 for portrait buttons
(function(){
  const pBtn = document.getElementById('btnPresetsToggle');
  const aBtn = document.getElementById('btnActionsToggle');
  const canvas = document.getElementById('canvas');

  function disableCanvas(){
    try { if(canvas) canvas.style.pointerEvents = 'none'; } catch(e){}
  }
  function enableCanvas(delay = 250){
    try { setTimeout(()=>{ if(canvas) canvas.style.pointerEvents = 'auto'; }, delay); } catch(e){}
  }

  function attach(btn){
    if(!btn) return;
    btn.addEventListener('touchstart', function(e){
      e.preventDefault && e.preventDefault();
      e.stopPropagation && e.stopPropagation();
      disableCanvas();
    }, {passive:false});
    btn.addEventListener('mousedown', function(e){
      e.preventDefault && e.preventDefault();
      disableCanvas();
    });
    btn.addEventListener('touchend', function(){ enableCanvas(300); });
    btn.addEventListener('blur', function(){ enableCanvas(150); });
  }

  attach(pBtn);
  attach(aBtn);

  document.addEventListener('click', function(){ enableCanvas(50); }, true);
  window.addEventListener('resize', function(){ enableCanvas(50); });
  document.addEventListener('visibilitychange', function(){ if(document.visibilityState === 'visible') enableCanvas(50); });
})();
