(function(){
'use strict';

const state = { muted:false, reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches };
const Scenes = {};

/* ---------------------------------------------------------
   0. AUDIO ENGINE
   --------------------------------------------------------- */
const Audio_ = (function(){

  const cache = {};
  function getSound(src, loop){
    let snd = cache[src];
    if(!snd){
      snd = new Audio(src);
      snd.loop = !!loop;
      cache[src] = snd;
    }
    return snd;
  }
  function playSound(src, volume, loop){
    if(state.muted) return;
    const snd = getSound(src, loop);
    snd.volume = volume;
    snd.currentTime = 0;
    snd.play().catch(()=>{ /* ignored: needs a user gesture first */ });
  }
  function stopSound(src){
    const snd = cache[src];
    if(!snd) return;
    snd.pause();
    snd.currentTime = 0;
  }

  const SND = {
    pencil:  'assets/sound/pencil_stroke.mp3',
    swoosh:  'assets/sound/swoosh.mp3',
    click:   'assets/sound/btn_click.mp3',
    stars:   'assets/sound/step3_starry_memories.mp3',
    boxOpen: 'assets/sound/step4_box-open.mp3',
    page:    'assets/sound/page-turn.mp3',
    music:   'assets/sound/TeraYaarHoonMain.mp3',
  };

  function playPencilLoop(){ playSound(SND.pencil, 0.35, true); }
  function stopPencilLoop(){ stopSound(SND.pencil); }

  function playTieRakhi(){ playSound(SND.swoosh, 0.6); }
  function playCeremonyChime(){ playSound(SND.swoosh, 0.55); }

  function playCeremony(){ playSound(SND.click, 0.55); }
  function playStarClick(){ playSound(SND.click, 0.5); }

  function startStarsAmbience(){ playSound(SND.stars, 0.3); }
  function stopStarsAmbience(){ stopSound(SND.stars); }

  function playBoxOpen(){ playSound(SND.boxOpen, 0.6); }
  function playPageTurn(){ playSound(SND.page, 0.4); }

  const musicTrack = getSound(SND.music, true);
  musicTrack.volume = 0.35;
  let playing = false;

  function setMuted(m){
    state.muted = m;
    Object.values(cache).forEach(snd => { snd.muted = m; });
  }
  function startMusic() {
    playing = true;
    if (!state.muted) {
        musicTrack.play().catch(() => {});
    }
  }
  function stopMusic() {
      playing = false;
      musicTrack.pause();
  }
  function setVolume(v){ musicTrack.volume = v; }

  return { setMuted, startMusic, stopMusic, setVolume,
    playPencilLoop, stopPencilLoop, playCeremony, startStarsAmbience, stopStarsAmbience, playBoxOpen,
    playTieRakhi, playCeremonyChime, playStarClick, playPageTurn,
    get playing(){ return playing; } };
})();

/* ---------------------------------------------------------
   2. CURSOR GLOW
   --------------------------------------------------------- */
const glow = document.getElementById('cursorGlow');
window.addEventListener('pointermove', e=>{
  glow.style.left = e.clientX+'px'; glow.style.top = e.clientY+'px';
}, {passive:true});

/* ---------------------------------------------------------
   3. AMBIENT BACKGROUND — stars & drifting petals (single viewport)
   --------------------------------------------------------- */
const bgCanvas = document.getElementById('bg-particles');
const bgCtx = bgCanvas.getContext('2d');
let W,H, bgStars=[], bgPetals=[];
function resizeBg(){
  W = bgCanvas.width = window.innerWidth;
  H = bgCanvas.height = window.innerHeight;
}
function seedBg(){
  bgStars = Array.from({length: Math.min(140, Math.floor(W*H/12000))}, ()=>({
    x:Math.random()*W, y:Math.random()*H, r:Math.random()*1.4+0.3,
    tw:Math.random()*Math.PI*2, speed:Math.random()*0.02+0.01
  }));
  bgPetals = Array.from({length:16}, ()=>({
    x:Math.random()*W, y:Math.random()*H, size:Math.random()*10+6,
    speedY:Math.random()*0.4+0.15, speedX:Math.random()*0.3-0.15,
    rot:Math.random()*360, rotSpeed:Math.random()*0.6-0.3,
    hue: Math.random()>0.5?'#FF5E9C':'#F29D72'
  }));
}
function drawBg(){
  bgCtx.clearRect(0,0,W,H);
  bgStars.forEach(s=>{
    s.tw += s.speed;
    const alpha = 0.4+Math.sin(s.tw)*0.4;
    bgCtx.beginPath();
    bgCtx.fillStyle = `rgba(245,200,92,${Math.max(0,alpha)})`;
    bgCtx.arc(s.x, s.y, s.r, 0, Math.PI*2);
    bgCtx.fill();
  });
  if(!state.reducedMotion){
    bgPetals.forEach(p=>{
      p.y += p.speedY; p.x += p.speedX; p.rot += p.rotSpeed;
      if(p.y>H+20){ p.y=-20; p.x=Math.random()*W; }
      bgCtx.save();
      bgCtx.translate(p.x,p.y); bgCtx.rotate(p.rot*Math.PI/180);
      bgCtx.fillStyle = p.hue; bgCtx.globalAlpha=0.5;
      bgCtx.beginPath();
      bgCtx.ellipse(0,0,p.size*0.5,p.size,0,0,Math.PI*2);
      bgCtx.fill();
      bgCtx.restore();
    });
  }
  requestAnimationFrame(drawBg);
}
window.addEventListener('resize', ()=>{ resizeBg(); seedBg(); });
resizeBg(); seedBg(); requestAnimationFrame(drawBg);

/* ---------------------------------------------------------
   4. SCENE ENTER HELPERS — reveal-up content within a scene
   --------------------------------------------------------- */
function revealScene(sectionEl){
  sectionEl.querySelectorAll('.reveal-up').forEach(el=>el.classList.add('in-view'));
}

/* ---------------------------------------------------------
   5. SECTION 2 — TIE THE RAKHI (drag + touch + keyboard)
   --------------------------------------------------------- */
(function(){
  const rakhi = document.getElementById('rakhiPiece');
  const shell = document.getElementById('rakhiStageShell');
  const handImage = document.querySelector('.hand-image');
  const sparkleLayer = document.getElementById('sparkleLayer');
  const petalLayer = document.getElementById('petalLayer');
  const target = document.getElementById('wristTarget');
  const successBox = document.getElementById('tieSuccess');
  const instruction = document.getElementById('tieInstruction');
  const handScene = document.querySelector('.hand-scene');
  const tieSection = document.getElementById('tie');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let placed = false;
  let dragging = false;
  let activePointerId = null;
  let homeX = 0;
  let homeY = 0;
  let grabOffsetX = 0;
  let grabOffsetY = 0;
  let currentX = 0;
  let currentY = 0;
  let frameId = null;

  function setRakhiPosition(x, y) {
    rakhi.style.left = `${x}px`;
    rakhi.style.top = `${y}px`;
  }

  function setHandBrightened(bright) {
    document.querySelector('.hand-scene').classList.toggle('brightened', bright);
  }

  function updateRakhiFromPointer() {
    if (!dragging) return;
    setRakhiPosition(currentX, currentY);
    frameId = null;
  }

  function queueFrame() {
    if (frameId !== null) return;
    frameId = window.requestAnimationFrame(updateRakhiFromPointer);
  }

  function placeAtStart() {
    const stageRect = shell.getBoundingClientRect();
    homeX = stageRect.width * 0.84;
    homeY = stageRect.height * 0.62;
    setRakhiPosition(homeX, homeY);
  }

  function alignTargetToHand() {
    const hand = document.querySelector('.hand-scene');
    const handRect = hand.getBoundingClientRect();
    const imageRect = handImage.getBoundingClientRect();
    const width = Math.min(260, Math.max(220, imageRect.width * 0.68));
    const height = Math.min(90, Math.max(70, imageRect.height * 0.07));
    target.style.width = `${width}px`;
    target.style.height = `${height}px`;
    target.style.left = `${imageRect.left - handRect.left + imageRect.width * 0.5}px`;
    target.style.top = `${imageRect.top - handRect.top + imageRect.height * 0.65}px`;
  }

  function positionCompletionUI() {
    const imageRect = handImage.getBoundingClientRect();
    // Keep the compact message/action panel in the clear space above the fingers.
    const top = Math.max(18, imageRect.top - 118);
    tieSection.style.setProperty('--tied-ui-top', `${top}px`);
  }

  function magnetizeToWrist(x, y) {
    const targetRect = target.getBoundingClientRect();
    const shellRect = shell.getBoundingClientRect();
    const targetX = targetRect.left + targetRect.width / 2 - shellRect.left;
    const targetY = targetRect.top + targetRect.height / 2 - shellRect.top;
    const distance = Math.hypot(targetX - x, targetY - y);
    const near = distance < 190;
    if (!near) return { x, y };
    const pull = Math.max(.1, Math.min(.42, (190 - distance) / 190 * .42));
    return { x:x + (targetX - x) * pull, y:y + (targetY - y) * pull };
  }

  function withinTarget() {
    const rakhiRect = rakhi.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const dx = (rakhiRect.left + rakhiRect.width / 2) - (targetRect.left + targetRect.width / 2);
    const dy = (rakhiRect.top + rakhiRect.height / 2) - (targetRect.top + targetRect.height / 2);
    return Math.abs(dx) < targetRect.width * .55 && Math.abs(dy) < targetRect.height * .85;
  }

  function centerRakhiOnTarget() {
    const targetRect = target.getBoundingClientRect();
    const shellRect = shell.getBoundingClientRect();
    setRakhiPosition(
      targetRect.left + targetRect.width / 2 - shellRect.left,
      targetRect.top + targetRect.height / 2 - shellRect.top
    );
  }

  function preloadImages() {
    const images = [
      new Image(),
      new Image()
    ];
    images[0].src = 'assets/rakhi/rakhi-horizontal.png';
    images[1].src = 'assets/rakhi/rakhi-tied.png';
    const tiedHand = new Image();
    tiedHand.src = 'assets/hand/rakhi-tied-hand.png';
  }

  function makeSparkles(x, y) {
    const count = reducedMotion ? 8 : 18;
    for (let i = 0; i < count; i++) {
      const sparkle = document.createElement('span');
      sparkle.className = 'sparkle';
      sparkleLayer.appendChild(sparkle);
      const angle = Math.random() * Math.PI * 2;
      const dist = 36 + Math.random() * 56;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      sparkle.style.left = `${x}px`;
      sparkle.style.top = `${y}px`;
      sparkle.animate([
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(0)`, opacity: 0 }
      ], { duration: 700 + Math.random() * 400, easing: 'cubic-bezier(.22,.61,.36,1)' });
      setTimeout(() => sparkle.remove(), 1100);
    }
  }

  function makePetals(x, y) {
    if (reducedMotion) return;
    const count = 12;
    for (let i = 0; i < count; i++) {
      const petal = document.createElement('span');
      petal.className = 'petal';
      petalLayer.appendChild(petal);
      const size = 10 + Math.random() * 10;
      petal.style.width = `${size}px`;
      petal.style.height = `${size * 1.3}px`;
      petal.style.left = `${x}px`;
      petal.style.top = `${y}px`;
      petal.style.transform = `rotate(${Math.random() * 180}deg)`;
      petal.animate([
        { transform: `translate(0, 0) rotate(0deg)`, opacity: 0.72 },
        { transform: `translate(${(Math.random() - 0.5) * 120}px, 140px) rotate(180deg)`, opacity: 0 }
      ], { duration: 1700 + Math.random() * 600, easing: 'cubic-bezier(.22,.61,.36,1)' });
      setTimeout(() => petal.remove(), 2400);
    }
  }

  function startCelebration() {
    shell.classList.add('celebrating');
    rakhi.classList.add('celebrating');
    const rect = target.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    makeSparkles(x, y);
    makePetals(x, y);
    setTimeout(() => {
      shell.classList.remove('celebrating');
      rakhi.classList.remove('celebrating');
    }, 1200);
  }

  function succeed() {
    placed = true;
    dragging = false;
    rakhi.classList.remove('dragging');
    rakhi.classList.add('animating');
    target.classList.add('dropped');
    instruction.textContent = 'Tied with love ✨';

    centerRakhiOnTarget();
    Audio_.playTieRakhi();
    if (navigator.vibrate) navigator.vibrate([40, 30, 60]);
    setTimeout(() => {
      rakhi.classList.add('tying');
    }, reducedMotion ? 1 : 620);
    setTimeout(() => {
      rakhi.classList.add('tying-left');
    }, reducedMotion ? 2 : 840);
    setTimeout(() => {
      rakhi.classList.remove('tying-left');
      rakhi.classList.add('tying-right');
    }, reducedMotion ? 3 : 1130);
    setTimeout(() => {
      rakhi.classList.remove('tying-right');
      rakhi.classList.add('tightening');
    }, reducedMotion ? 4 : 1420);
    setTimeout(() => {
      rakhi.classList.remove('tying', 'tightening');
      rakhi.classList.add('placed');
      rakhi.classList.remove('animating');
      handScene.classList.add('tied-hand');
      positionCompletionUI();
      tieSection.classList.add('rakhi-complete');
      startCelebration();
      successBox.classList.add('show');
    }, reducedMotion ? 5 : 1710);
  }

  function onPointerDown(event) {
    if (placed) return;
    event.preventDefault();
    dragging = true;
    activePointerId = event.pointerId;
    rakhi.setPointerCapture(event.pointerId);
    rakhi.classList.add('dragging');
    setHandBrightened(true);
    const rect = rakhi.getBoundingClientRect();
    const shellRect = shell.getBoundingClientRect();
    grabOffsetX = event.clientX - (rect.left + rect.width / 2);
    grabOffsetY = event.clientY - (rect.top + rect.height / 2);
    currentX = rect.left - shellRect.left + rect.width / 2;
    currentY = rect.top - shellRect.top + rect.height / 2;
  }

  function onPointerMove(event) {
    if (!dragging || event.pointerId !== activePointerId) return;
    event.preventDefault();
    const shellRect = shell.getBoundingClientRect();
    const desiredX = event.clientX - shellRect.left - grabOffsetX;
    const desiredY = event.clientY - shellRect.top - grabOffsetY;
    const magnetized = magnetizeToWrist(desiredX, desiredY);
    currentX = magnetized.x;
    currentY = magnetized.y;
    if (!reducedMotion) {
      const sparkle = document.createElement('span');
      sparkle.className = 'sparkle';
      sparkleLayer.appendChild(sparkle);
      sparkle.style.left = `${event.clientX - shellRect.left}px`;
      sparkle.style.top = `${event.clientY - shellRect.top}px`;
      sparkle.animate([
        { transform: 'translate(0, 0) scale(1)', opacity: 0.8 },
        { transform: 'translate(0, 18px) scale(0)', opacity: 0 }
      ], { duration: 650, easing: 'cubic-bezier(.22,.61,.36,1)' });
      setTimeout(() => sparkle.remove(), 700);
    }
    queueFrame();
  }

  function onPointerUp(event) {
    if (!dragging || (activePointerId !== null && event.pointerId !== activePointerId)) return;
    dragging = false;
    rakhi.classList.remove('dragging');
    setHandBrightened(false);
    if (frameId !== null) {
      window.cancelAnimationFrame(frameId);
      frameId = null;
    }
    if (withinTarget()) {
      succeed();
    } else {
      rakhi.classList.add('animating');
      setRakhiPosition(homeX, homeY);
      setTimeout(() => rakhi.classList.remove('animating'), 620);
    }
    activePointerId = null;
  }

  function onKeyDown(event) {
    if ((event.key === 'Enter' || event.key === ' ') && !placed) {
      event.preventDefault();
      event.stopPropagation();
      succeed();
    }
  }

  preloadImages();
  alignTargetToHand();
  placeAtStart();

  handImage.addEventListener('load', () => {
    alignTargetToHand();
    if (!placed) placeAtStart();
  }, { once:true });

  rakhi.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
  rakhi.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', () => {
    alignTargetToHand();
    if (!placed) {
      placeAtStart();
    } else {
      centerRakhiOnTarget();
      positionCompletionUI();
    }
  });
})();

/* ---------------------------------------------------------
   6. SECTION 3 — CEREMONY SEQUENCE
   --------------------------------------------------------- */
(function(){
  const btn = document.getElementById('startCeremony');
  const stage = document.getElementById('thaliStage');
  const glowEl = document.getElementById('ceremonyGlow');
  const quote = document.getElementById('ceremonyQuote');

  function spawnFx(emoji, count){
    for(let i=0;i<count;i++){
      setTimeout(()=>{
        const el = document.createElement('div');
        el.className='fx-particle';
        el.textContent=emoji;
        el.style.left = (20+Math.random()*60)+'%';
        el.style.top = '0%';
        el.style.fontSize = (14+Math.random()*10)+'px';
        stage.appendChild(el);
        const anim = el.animate([
          {transform:'translateY(0) rotate(0deg)', opacity:1},
          {transform:`translateY(${stage.clientHeight}px) rotate(${Math.random()*360}deg)`, opacity:0.9}
        ], {duration:1400+Math.random()*600, easing:'ease-in'});
        anim.onfinish = ()=>el.remove();
      }, i*90);
    }
  }
  btn.addEventListener('click', ()=>{
    btn.classList.add('hide');
    Audio_.playCeremony();
    setTimeout(()=>spawnFx('🪷', 10), 700);
    setTimeout(()=>spawnFx('🌸', 10), 1600);
    setTimeout(()=>{ glowEl.classList.add('show'); Audio_.playCeremonyChime(); }, 2600);
    setTimeout(()=>quote.classList.add('show'), 3400);
  });
})();

/* ---------------------------------------------------------
   7. SECTION 4 — STARRY MEMORIES
   --------------------------------------------------------- */
(function(){
  const field = document.getElementById('starField');
  const canvas = document.getElementById('constellationCanvas');
  const ctx = canvas.getContext('2d');
  const shootingCanvas = document.getElementById("shootingStars");
  const shootingCtx = shootingCanvas.getContext("2d");
  const modal = document.getElementById('memoryModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalStory = document.getElementById('modalStory');
  const modalPhoto = document.getElementById('modalPhoto');
  const modalClose = document.getElementById('modalClose');

  const memories = [
    {image: 'assets/memories/first-call.png', title: 'Our First Team Call', story: 'We started as two names on a screen, but somewhere between introductions and meetings, you became the brother I never expected to find at work.'},
    {image: 'assets/memories/virtual-coffee.png', title: 'Virtual Coffee Breaks', story: 'Those quick chats before meetings somehow turned into the best part of the workday, making even busy days feel lighter.'},
    {image: 'assets/memories/late-night-work.png', title: 'Late-Night Deadlines', story: 'Whenever work stretched, it never felt lonely because we were tackling it together.'},
    {image: 'assets/memories/helping-hand.png', title: 'Always Ready to Help', story: 'No matter how many questions I had, you never made me hesitate to ask. Your patience and guidance meant more than you know.'},
    {image: 'assets/memories/team-success.png', title: 'Celebrating Every Win', story: 'Every completed project, every appreciation, and every small victory felt even more special because we celebrated it together.'},
    {image: 'assets/memories/random-chat.png', title: 'Beyond Work', story: 'Some of my favorite moments weren\'t in meetings—they were the random chats, jokes, and conversations that made work feel like home.'},
    {image: 'assets/memories/support.png', title: 'Miles Apart, Always There', story: 'Even though we\'ve never shared the same office, you\'ve always been just one message away whenever I needed support.'},
    {image: 'assets/memories/rakhi.png', title: 'A Bond Across Screens', story: 'Distance never mattered because kindness, trust, and respect built a bond that feels just like family.'  }
  ];

  let positions = [], laidOut=false;
  let shootingStars = [];
  let shootingAnimation = null;
  let shootingRunning = false;

  function layout(){
    field.innerHTML=''; positions=[]; laidOut=true;
    memories.forEach((m,i)=>{
      const x = 8+Math.random()*84, y = 12+Math.random()*72;
      positions.push({x,y,visited:false});
      const b = document.createElement('button');
      b.className='mem-star'; b.style.left=x+'%'; b.style.top=y+'%';
      b.style.animationDelay=(Math.random()*2)+'s';
      b.setAttribute('aria-label', 'Memory: '+m.title);
      b.innerHTML = `<svg viewBox="0 0 24 24"><polygon points="12,2 15,9 22,9 16.5,13.5 18.5,21 12,16.5 5.5,21 7.5,13.5 2,9 9,9"/></svg>`;
      b.addEventListener('click', ()=>openMemory(i,b));
      field.appendChild(b);
    });
    resizeCanvas();
  }

  function resizeCanvas(){
    canvas.width = field.clientWidth;
    canvas.height = field.clientHeight;
    shootingCanvas.width = field.clientWidth;
    shootingCanvas.height = field.clientHeight;
    drawLines();
  }

  function drawLines(){
    if(!canvas.width) return;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const visited = positions.filter(p=>p.visited);
    if(visited.length<2) return;
    ctx.strokeStyle='rgba(245,200,92,.45)'; ctx.lineWidth=1;
    ctx.beginPath();
    visited.forEach((p,i)=>{
      const x=p.x/100*canvas.width, y=p.y/100*canvas.height;
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();
  }

  class ShootingStar{
    constructor(){this.reset();}
    reset(){
      this.x = Math.random()*shootingCanvas.width;
      this.y = Math.random()*shootingCanvas.height*0.4;
      this.length = 80 + Math.random()*180;
      this.speed = 0.8 + Math.random()*2;
      this.opacity = 0;
      this.active = false;
      this.delay = Math.random()*180;
    }
    update(){
        if(this.delay>0){this.delay--;return;}
        this.active=true;
        this.x+=this.speed;
        this.y+=this.speed*0.45;
        this.opacity+=0.03;
        if(this.x>shootingCanvas.width+200||this.y>shootingCanvas.height+200)this.reset();
    }
    draw(){
        if(!this.active)return;
        shootingCtx.save();
        const gradient=shootingCtx.createLinearGradient(this.x-this.length,this.y-this.length*.45,this.x,this.y);
        gradient.addColorStop(0,"rgba(255,255,255,0)");
        gradient.addColorStop(1,"rgba(255,245,180,1)");
        shootingCtx.strokeStyle=gradient;
        shootingCtx.lineWidth=2;
        shootingCtx.shadowBlur=12;
        shootingCtx.shadowColor="#FFD86B";
        shootingCtx.beginPath();
        shootingCtx.moveTo(this.x-this.length,this.y-this.length*.45);
        shootingCtx.lineTo(this.x,this.y);
        shootingCtx.stroke();
        shootingCtx.restore();
    }
  }

function startShootingStars(){
    if(shootingRunning)return;
    shootingRunning=true;
    shootingStars=[];
    for(let i=0;i<4;i++)shootingStars.push(new ShootingStar());
    function animate(){
        if(!shootingRunning)return;
        shootingCtx.clearRect(0,0,shootingCanvas.width,shootingCanvas.height);
        shootingStars.forEach(star=>{star.update();star.draw();});
        shootingAnimation=requestAnimationFrame(animate);
    }
    animate();
}

function stopShootingStars(){
    shootingRunning=false;
    if(shootingAnimation)cancelAnimationFrame(shootingAnimation);
    shootingCtx.clearRect(0,0,shootingCanvas.width,shootingCanvas.height);
}


  function openMemory(i,btn){
    positions[i].visited=true;
    btn.classList.add('visited');
    drawLines();
    Audio_.playStarClick();
    const m = memories[i];
    modalPhoto.innerHTML = `<img src="${m.image}" alt="${m.title}">`;
    modalTitle.textContent = m.title;
    modalStory.textContent = m.story;
    modal.classList.add('show'); modal.setAttribute('aria-hidden','false');
  }
  modalClose.addEventListener('click', closeModal);
  modal.addEventListener('click', e=>{ if(e.target===modal) closeModal(); });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeModal(); });
  function closeModal(){ modal.classList.remove('show'); modal.setAttribute('aria-hidden','true'); }

  window.addEventListener('resize', resizeCanvas);
  Scenes.starsEnter = function(){
    if(!laidOut) layout(); else resizeCanvas();
    startShootingStars();
    Audio_.startStarsAmbience();
  };
})();

/* ---------------------------------------------------------
   8. SECTION 5 — REASONS I'M GRATEFUL
   --------------------------------------------------------- */
(function(){
  const grid = document.getElementById('envelopeGrid');
  const fill = document.getElementById('gratefulFill');
  const count = document.getElementById('gratefulCount');
  const reasons = [
    "For being the best big brother at work.",
    "For being someone I always admire and learn from.",
    "For making every workday a little brighter.",
    "For always being approachable and ready to help.",
    "For making every challenge an opportunity to grow.",
    "For being a source of inspiration and motivation.",
  ];
  let opened=0;
  reasons.forEach((text,i)=>{
    const env = document.createElement('div');
    env.className='envelope';
    env.innerHTML = `
      <div class="envelope-inner">
        <div class="envelope-message">${text}</div>
        <div class="envelope-flap"></div>
        <div class="envelope-heart">💌</div>
      </div>`;
    env.addEventListener('click', ()=>{
      if(env.classList.contains('open')) return;
      env.classList.add('open');
      opened++;
      Audio_.playBoxOpen();
      fill.style.width = (opened/reasons.length*100)+'%';
      count.textContent = `${opened} / ${reasons.length} opened`;
      for(let h=0; h<5; h++){
        const heart = document.createElement('span');
        heart.className='mini-heart'; heart.textContent='💗';
        heart.style.left=(30+Math.random()*40)+'%';
        heart.style.bottom='30%';
        heart.style.animationDelay=(h*0.08)+'s';
        env.appendChild(heart);
        setTimeout(()=>heart.remove(), 1800);
      }
    });
    grid.appendChild(env);
  });
})();

/* ---------------------------------------------------------
   9. SECTION 6 — HANDWRITTEN LETTER (typewriter)
   --------------------------------------------------------- */
(function(){
  const textEl = document.getElementById('letterText');
  const seal = document.getElementById('waxSeal');
  const full = `To my dearest big bro,

Some bonds are built by birth, 
while others are formed through trust and respect. 
I'm thankful to have found a brother-like friend in you at work. 
Wishing you a Raksha Bandhan filled with happiness, 
strength, and all the success you truly deserve.

Always,
Your lil sis ❤️`;

  let typed=false;
  function type(){
    if(typed) return; typed=true;
    let i=0;
    if(state.reducedMotion){ textEl.textContent = full; seal.classList.add('show'); return; }
    Audio_.playPencilLoop();
    (function step(){
      textEl.textContent = full.slice(0,i);
      i++;
      if(i<=full.length){ setTimeout(step, 26); }
      else {
        Audio_.stopPencilLoop();
        setTimeout(()=>seal.classList.add('show'), 300);
      }
    })();
  }
  Scenes.letterEnter = type;
})();

/* ---------------------------------------------------------
   10. SECTION 7 — FINALE FIREWORKS
   --------------------------------------------------------- */
(function(){
  const canvas = document.getElementById('fireworksCanvas');
  const ctx = canvas.getContext('2d');
  const section = document.getElementById('finale');
  let particles=[], running=false, launchTimer=null, raf=null;

  function resize(){ canvas.width = section.clientWidth; canvas.height = section.clientHeight; }
  window.addEventListener('resize', resize);

  function launchFirework(){
    const x = canvas.width*(0.2+Math.random()*0.6);
    const y = canvas.height*(0.2+Math.random()*0.4);
    const hue = [45, 330, 270, 25][Math.floor(Math.random()*4)];
    const count = state.reducedMotion?0:26;
    for(let i=0;i<count;i++){
      const angle = (Math.PI*2*i)/count;
      const speed = 1.5+Math.random()*2.5;
      particles.push({ x,y, vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed, life:1, hue: hue+Math.random()*20-10 });
    }
  }
  function tick(){
    if(!running) return;
    ctx.fillStyle='rgba(15,7,34,0.18)';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    particles.forEach(p=>{
      p.x+=p.vx; p.y+=p.vy; p.vy+=0.03; p.life-=0.014;
      ctx.beginPath();
      ctx.fillStyle=`hsla(${p.hue},85%,65%,${Math.max(p.life,0)})`;
      ctx.arc(p.x,p.y,2.4,0,Math.PI*2);
      ctx.fill();
    });
    particles = particles.filter(p=>p.life>0);
    raf = requestAnimationFrame(tick);
  }
  Scenes.fireworksStart = function(){
    if(running) return;
    resize(); running=true; tick();
    launchFirework();
    launchTimer = setInterval(launchFirework, 1500);
  };
  Scenes.fireworksStop = function(){
    running=false; clearInterval(launchTimer); if(raf) cancelAnimationFrame(raf);
    ctx.clearRect(0,0,canvas.width,canvas.height); particles=[];
  };
})();

/* ---------------------------------------------------------
   11. PLAY / PAUSE BUTTON
   --------------------------------------------------------- */
(function () {

  const playBtn = document.getElementById("playPause");
  const playIcon = document.getElementById("playIcon");

  function updateButton() {
    playIcon.setAttribute(
      "d",
      Audio_.playing
        ? "M7 5h4v14H7zm6 0h4v14h-4z"   // Pause icon
        : "M8 5v14l11-7z"              // Play icon
    );

    playBtn.setAttribute(
      "aria-label",
      Audio_.playing ? "Pause Music" : "Play Music"
    );
  }

  // Start music when Begin Journey is clicked
  document.getElementById("beginJourney").addEventListener("click", () => {
    if (!Audio_.playing) {
      Audio_.startMusic();
      updateButton();
    }
  });

  // Toggle play / pause
  playBtn.addEventListener("click", () => {
    if (Audio_.playing) {
      Audio_.stopMusic();
    } else {
      Audio_.startMusic();
    }

    updateButton();
  });

  updateButton();

})();

/* ============================================================
   12. SCENE / PAGINATION CONTROLLER
   One full-screen scene visible at a time. Advances via wheel,
   touch swipe, keyboard, nav dots, or the prev/next buttons.
   ============================================================ */
(function(){
  const sectionEls = Array.from(document.querySelectorAll('main .section'));
  const navDots = Array.from(document.querySelectorAll('.nav-dot'));
  const flash = document.getElementById('transitionFlash');
  const prevBtn = document.getElementById('scenePrev');
  const nextBtn = document.getElementById('sceneNext');
  const srLive = document.getElementById('srLive');
  const TRANSITION_MS = 900;

  let current = 0, isAnimating = false;

  // Elements whose own gestures (drag / tap / scroll-within) must not
  // be hijacked by the scene-navigation wheel & swipe handlers.
  const INTERACTIVE_SELECTOR = '.rakhi-piece, .envelope, .mem-star, .music-control, ' +
    '.section-nav, .utility-bar, .modal-overlay, .cta-gold, .cta-outline, ' +
    '.nav-dot, .page-nav-btn, .letter-paper, input, .glass-btn';

  function updateNav(){
    navDots.forEach((d,i)=>d.classList.toggle('active', i===current));
    prevBtn.disabled = current===0;
    nextBtn.disabled = current===sectionEls.length-1;
    srLive.textContent = sectionEls[current].getAttribute('aria-label');
  }

  function onSceneEnter(idx){
    const el = sectionEls[idx];
    revealScene(el);
    if(el.id!=='letter') Audio_.stopPencilLoop();
    if(el.id!=='stars') {
      Audio_.stopStarsAmbience();
      if(typeof stopShootingStars === "function"){
        stopShootingStars();
      }
    } 
    if(el.id==='stars' && Scenes.starsEnter) Scenes.starsEnter();
    if(el.id==='letter' && Scenes.letterEnter) Scenes.letterEnter();
    if(el.id==='finale' && Scenes.fireworksStart) Scenes.fireworksStart();
    else if(Scenes.fireworksStop) Scenes.fireworksStop();
  }

  function goTo(idx){
    if(isAnimating || idx<0 || idx>=sectionEls.length || idx===current) return;
    const dir = idx>current ? 1 : -1;
    isAnimating = true;
    const outgoing = sectionEls[current];
    const incoming = sectionEls[idx];

    flash.classList.add('show');
    setTimeout(()=>flash.classList.remove('show'), 480);
    Audio_.playPageTurn();

    outgoing.classList.remove('active');
    outgoing.classList.add(dir===1?'exit-fwd':'exit-bwd');
    // Force reflow so the incoming section's transition also runs
    void incoming.offsetWidth;
    incoming.classList.add('active');

    current = idx;
    updateNav();

    setTimeout(()=>{
      outgoing.classList.remove('exit-fwd','exit-bwd');
      isAnimating = false;
      onSceneEnter(idx);
    }, TRANSITION_MS);
  }

  navDots.forEach((dot,i)=>dot.addEventListener('click', ()=>goTo(i)));
  prevBtn.addEventListener('click', ()=>goTo(current-1));
  nextBtn.addEventListener('click', ()=>goTo(current+1));
  document.querySelectorAll('[data-next]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const idx = sectionEls.findIndex(s=>s.id===btn.dataset.next);
      if(idx>-1) goTo(idx);
    });
  });
  document.getElementById('beginJourney').addEventListener('click', () => goTo(1));
  document.getElementById('replayBtn').addEventListener('click', ()=>goTo(0));

  // Wheel navigation (with cooldown so one gesture = one page)
  let wheelCooldown=false;
  window.addEventListener('wheel', e=>{
    if(isAnimating || wheelCooldown) return;
    if(Math.abs(e.deltaY) < 12) return;
    e.preventDefault();
    goTo(current + (e.deltaY>0?1:-1));
    wheelCooldown = true;
    setTimeout(()=>wheelCooldown=false, TRANSITION_MS+80);
  }, {passive:false});

  // Touch swipe navigation
  let touchStartY=0, touchStartTarget=null;
  window.addEventListener('touchstart', e=>{
    touchStartY = e.touches[0].clientY;
    touchStartTarget = e.target;
  }, {passive:true});
  window.addEventListener('touchend', e=>{
    if(isAnimating) return;
    if(touchStartTarget && touchStartTarget.closest && touchStartTarget.closest(INTERACTIVE_SELECTOR)) return;
    const dy = touchStartY - e.changedTouches[0].clientY;
    if(Math.abs(dy) < 60) return;
    goTo(current + (dy>0?1:-1));
  }, {passive:true});

  // Keyboard navigation
  window.addEventListener('keydown', e=>{
    if(isAnimating) return;
    const tag = (e.target && e.target.tagName) || '';
    if(tag==='INPUT' || tag==='TEXTAREA') return;
    if(e.target && e.target.closest && e.target.closest('.rakhi-piece')) return;
    if(['ArrowDown','ArrowRight','PageDown'].includes(e.key)){ e.preventDefault(); goTo(current+1); }
    else if(['ArrowUp','ArrowLeft','PageUp'].includes(e.key)){ e.preventDefault(); goTo(current-1); }
    else if(e.key===' ' && !e.target.closest('button')){ e.preventDefault(); goTo(current+1); }
  });

  // Initial state: hero is active immediately (revealed after preload)
  sectionEls[0].classList.add('active');
  updateNav();

  /* ---------- Preloader ---------- */
  const preloader = document.getElementById('preloader');
  const fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
  Promise.race([fontsReady, new Promise(r=>setTimeout(r,1800))]).then(()=>{
    setTimeout(()=>{
      preloader.classList.add('hide');
      revealScene(sectionEls[0]);
    }, 500);
  });
})();

})();