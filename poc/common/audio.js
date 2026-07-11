/**
 * FXA — PoC共通プロシージャル音源（WebAudio・音源ファイル不要・classic script）
 *
 * BGM: 16ステップシーケンサ（ベース/リード/パッド/ハット）をスタイル別パターンで無限ループ
 * SFX: オシレータ＋ノイズの合成プリセット
 *
 * API:
 *   FXA.play('field'|'calm'|'tension'|'cave'|'boss'|'title')  … BGM再生（切替可）
 *   FXA.stop()                                                 … BGM停止
 *   FXA.sfx('jump'|'land'|'pickup'|'coin'|'hit'|'break'|'powerup'|'ui'|
 *           'alarm'|'splash'|'shout'|'heal'|'evil'|'step'|'charge'|'clear'|'gameover')
 *   FXA.duck(0.6)      … BGMを一瞬下げる（SFXを立たせる）
 *   FXA.volume(m, s)   … 音量 (music, sfx) 0..1
 *   FXA.muted = true   … 全ミュート
 *
 * 初回のユーザー操作（pointerdown/keydown）で自動的にAudioContextを起動する。
 */
(function(){
  'use strict';
  let ctx=null, master=null, musicG=null, sfxG=null, delay=null;
  let timer=null, styleName=null, step=0, nextT=0;

  function ensure(){
    if(ctx) return;
    ctx=new (window.AudioContext||window.webkitAudioContext)();
    master=ctx.createGain(); master.gain.value=.75; master.connect(ctx.destination);
    musicG=ctx.createGain(); musicG.gain.value=.42; musicG.connect(master);
    sfxG=ctx.createGain(); sfxG.gain.value=.8; sfxG.connect(master);
    // 空間系（BGM用の軽いエコー）
    delay=ctx.createDelay(.6); delay.delayTime.value=.23;
    const fb=ctx.createGain(); fb.gain.value=.22;
    const wet=ctx.createGain(); wet.gain.value=.18;
    delay.connect(fb).connect(delay); delay.connect(wet).connect(master);
  }
  ['pointerdown','keydown'].forEach(ev=>addEventListener(ev,()=>{ ensure(); if(ctx.state==='suspended') ctx.resume(); }));

  const mf=m=>440*Math.pow(2,(m-69)/12);   // MIDI→Hz

  function tone(t,midi,dur,{type='square',vol=.16,dest,slideTo=0,vib=0,dst}={}){
    if(!ctx||FXA.muted) return;
    const o=ctx.createOscillator(), g=ctx.createGain();
    o.type=type;
    o.frequency.setValueAtTime(mf(midi),t);
    if(slideTo) o.frequency.exponentialRampToValueAtTime(mf(slideTo),t+dur);
    if(vib){ const lf=ctx.createOscillator(), lg=ctx.createGain();
      lf.frequency.value=6; lg.gain.value=vib; lf.connect(lg).connect(o.frequency);
      lf.start(t); lf.stop(t+dur+.05); }
    g.gain.setValueAtTime(0,t);
    g.gain.linearRampToValueAtTime(vol,t+.008);
    g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g); g.connect(dest||sfxG); if(dst!==false&&dest===musicG) g.connect(delay);
    o.start(t); o.stop(t+dur+.03);
  }
  function noiseHit(t,dur,{vol=.2,freq=1200,q=1,type='bandpass',dest,slideTo=0}={}){
    if(!ctx||FXA.muted) return;
    const len=Math.max(1,Math.floor(ctx.sampleRate*dur));
    const buf=ctx.createBuffer(1,len,ctx.sampleRate);
    const d=buf.getChannelData(0);
    for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*(1-i/len);
    const src=ctx.createBufferSource(); src.buffer=buf;
    const f=ctx.createBiquadFilter(); f.type=type; f.Q.value=q;
    f.frequency.setValueAtTime(freq,t);
    if(slideTo) f.frequency.exponentialRampToValueAtTime(slideTo,t+dur);
    const g=ctx.createGain(); g.gain.setValueAtTime(vol,t);
    g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    src.connect(f).connect(g).connect(dest||sfxG);
    src.start(t);
  }

  // ---- BGMスタイル定義（16ステップ、-=休符。midi番号） ----
  // scale基準: A=57(A3)
  // -1=休符
  const R=-1;
  const S={
    title:{ bpm:92, bass:[45,R,R,R,52,R,R,R,45,R,R,R,50,R,R,R], lead:[69,R,72,R,76,R,74,72,69,R,64,R,67,69,R,R],
            pad:[[57,64,69],[57,64,69],[53,60,67],[55,62,67]], hat:2, types:['triangle','sine'] },
    field:{ bpm:116, bass:[45,R,45,R,50,R,50,R,43,R,43,R,48,R,50,R], lead:[69,71,72,R,76,R,72,R,74,72,71,R,69,R,R,R],
            pad:[[57,64,69],[55,62,67],[53,60,65],[55,62,67]], hat:1, types:['square','square'] },
    calm:{ bpm:72, bass:[45,R,R,R,R,R,R,R,41,R,R,R,R,R,R,R], lead:[R,R,69,R,R,72,R,R,R,R,71,R,67,R,R,R],
           pad:[[57,64,69],[57,64,69],[53,60,65],[53,60,65]], hat:0, types:['sine','triangle'] },
    tension:{ bpm:100, bass:[41,R,R,41,R,R,41,R,40,R,R,40,R,R,40,R], lead:[R,R,65,R,R,64,R,R,R,R,63,R,R,R,R,R],
              pad:[[53,56,60],[53,56,60],[52,55,59],[52,55,59]], hat:2, types:['sawtooth','triangle'] },
    cave:{ bpm:84, bass:[33,R,R,R,R,R,40,R,33,R,R,R,38,R,R,R], lead:[R,R,R,57,R,R,R,R,60,R,R,R,R,R,55,R],
           pad:[[45,52,57],[45,52,57],[43,50,55],[43,50,55]], hat:0, types:['triangle','sine'] },
    boss:{ bpm:144, bass:[41,41,R,41,44,R,41,R,40,40,R,40,43,R,40,R], lead:[65,R,68,69,R,68,65,R,63,R,65,68,R,71,72,R],
           pad:[[53,56,60],[53,56,60],[52,55,59],[51,55,58]], hat:1, types:['sawtooth','square'] },
  };

  function schedule(){
    const st=S[styleName]; if(!st) return;
    const spb=60/st.bpm/4;                       // 16分音符の長さ
    while(nextT < ctx.currentTime + .12){
      const i=step%16, bar=(step>>4)%st.pad.length;
      const b=st.bass[i]; if(b>=0) tone(nextT,b,spb*.9,{type:st.types[0],vol:.14,dest:musicG,dst:false});
      const l=st.lead[i]; if(l>=0) tone(nextT,l,spb*1.7,{type:st.types[1],vol:.09,dest:musicG});
      if(i===0) for(const p of st.pad[bar]) tone(nextT,p,spb*15,{type:'sine',vol:.028,dest:musicG,dst:false});
      if(st.hat && i%st.hat===0) noiseHit(nextT,.03,{vol:.05,freq:8000,type:'highpass',dest:musicG});
      nextT+=spb; step++;
    }
  }
  const FXA={
    muted:false,
    play(name){
      ensure();
      if(styleName===name) return;
      styleName=name; step=0; nextT=ctx.currentTime+.05;
      if(!timer) timer=setInterval(()=>{ if(styleName&&!FXA.muted) schedule(); },30);
    },
    stop(){ styleName=null; },
    duck(sec=.5){
      if(!ctx) return;
      musicG.gain.cancelScheduledValues(ctx.currentTime);
      musicG.gain.setValueAtTime(.12,ctx.currentTime);
      musicG.gain.linearRampToValueAtTime(.42,ctx.currentTime+sec);
    },
    volume(m,s){ ensure(); if(m!=null) musicG.gain.value=m; if(s!=null) sfxG.gain.value=s; },
    sfx(name){
      ensure(); if(FXA.muted) return;
      const t=ctx.currentTime;
      switch(name){
        case 'jump':    tone(t,60,.16,{type:'square',vol:.16,slideTo:72}); break;
        case 'land':    noiseHit(t,.09,{vol:.18,freq:300,slideTo:120}); break;
        case 'step':    noiseHit(t,.04,{vol:.08,freq:900}); break;
        case 'pickup':  tone(t,76,.07,{vol:.14}); tone(t+.07,83,.12,{vol:.14}); break;
        case 'coin':    tone(t,88,.06,{vol:.12}); tone(t+.06,93,.18,{vol:.12,type:'triangle'}); break;
        case 'hit':     noiseHit(t,.12,{vol:.24,freq:900,slideTo:200});
                        tone(t,50,.12,{type:'sawtooth',vol:.14,slideTo:38}); break;
        case 'break':   noiseHit(t,.3,{vol:.3,freq:600,slideTo:90,q:.7});
                        tone(t,45,.22,{type:'square',vol:.1,slideTo:33}); break;
        case 'powerup': [64,68,71,76].forEach((m,i)=>tone(t+i*.07,m,.14,{vol:.13})); break;
        case 'heal':    [72,76,79].forEach((m,i)=>tone(t+i*.09,m,.25,{type:'triangle',vol:.11})); break;
        case 'ui':      tone(t,84,.05,{type:'triangle',vol:.1}); break;
        case 'alarm':   tone(t,70,.14,{type:'square',vol:.13}); tone(t+.16,63,.2,{type:'square',vol:.13}); break;
        case 'splash':  noiseHit(t,.28,{vol:.2,freq:1400,slideTo:300,q:.6}); break;
        case 'shout':   tone(t,64,.3,{type:'sawtooth',vol:.2,slideTo:52,vib:14});
                        noiseHit(t,.2,{vol:.1,freq:2500,q:.5}); break;
        case 'charge':  tone(t,48,.5,{type:'sawtooth',vol:.1,slideTo:72}); break;
        case 'evil':    tone(t,46,.5,{type:'sawtooth',vol:.14,slideTo:40,vib:8});
                        tone(t,47,.5,{type:'sawtooth',vol:.1,slideTo:41}); break;
        case 'clear':   [69,73,76,81,88].forEach((m,i)=>tone(t+i*.09,m,.3,{type:'triangle',vol:.13}));
                        FXA.duck(1); break;
        case 'gameover':[57,53,50,45].forEach((m,i)=>tone(t+i*.16,m,.4,{type:'triangle',vol:.14})); break;
        default:        tone(t,72,.08,{vol:.1});
      }
    },
  };
  window.FXA=FXA;
})();
