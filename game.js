const rounds=window.GAME_ROUNDS,cards=rounds.flatMap((r,ri)=>r.cards.map((c,qi)=>({...c,round:ri,q:qi,rules:r.rules,name:r.name}))),$=id=>document.getElementById(id);
let index=0,clock=null,seconds=null,playJob=null,ticker=null,watchdog=null,players={},ready={},pending=null,scoreData=[{name:'Team 1',score:0},{name:'Team 2',score:0}];
try{const s=JSON.parse(localStorage.getItem('meet-sequel-scores'));if(Array.isArray(s)&&s.length===2)scoreData=s.map((t,i)=>({name:String(t.name||`Team ${i+1}`),score:Math.max(0,Number(t.score)||0)}))}catch{}
function status(message) {
  $('status').textContent = message;
  if (!$('revealMusic').hidden) $('revealMusicStatus').textContent = message;
}function current(){return cards[index]}function clearClock(){clearInterval(clock);clock=null}function displayClock(){$('time').textContent=seconds===null?'':seconds>0?seconds+'s':'Time’s up!'}
function coverVideo(covered,message='Starting mystery clip...'){$('videoCurtain').hidden=!covered;$('videoCurtain').textContent=message}
function stop(s='Playback stopped.'){coverVideo(true,'Mystery clip ready');clearInterval(ticker);clearTimeout(watchdog);ticker=null;playJob=null;pending=null;for(const p of Object.values(players))try{p.pauseVideo()}catch{}$('retrySound').hidden=true;status(s)}
function saveScores(){try{localStorage.setItem('meet-sequel-scores',JSON.stringify(scoreData))}catch{}}
function drawScores(){const out=$('scores');out.replaceChildren();scoreData.forEach((t,i)=>{const d=document.createElement('div');d.className='team';const name=document.createElement('input');name.value=t.name;name.setAttribute('aria-label',`Team ${i+1} name`);name.onchange=()=>{t.name=name.value;saveScores()};d.append(name);const value=document.createElement('b');value.textContent=t.score;d.append(value);[-5,5,10].forEach(n=>{const b=document.createElement('button');b.textContent=n>0?'+'+n:String(n);b.onclick=()=>{t.score=Math.max(0,t.score+n);saveScores();drawScores()};d.append(b)});out.append(d)});const reset=document.createElement('button');reset.textContent='Reset scores';reset.onclick=()=>{if(confirm('Reset both team scores?')){scoreData.forEach(t=>t.score=0);saveScores();drawScores()}};out.append(reset)}
function activePlayers(job) {
  return job.visual ? ['sound', 'visual'] : [job.video ? 'visual' : 'sound'];
}

function primaryPlayer(job) {
  return players[job.video ? 'visual' : 'sound'];
}

function isPlaying(job) {
  return activePlayers(job).every(key => players[key].getPlayerState() === 1);
}

function neutralizeVideoTitle() {
  const frame = players.visual?.getIframe();
  if (!frame) return;
  if (frame.title !== 'Song video') frame.title = 'Song video';
  frame.setAttribute('aria-label', 'Song video');
  frame.tabIndex = -1;
}

function updatePlayback() {
  const job = playJob;
  if (!job || !isPlaying(job) || ticker !== null) return;
  clearTimeout(watchdog);
  $('retrySound').hidden = true;

  const player = primaryPlayer(job);
  let last = player.getCurrentTime();
  let elapsed = 0;
  const warmup = job.challenge ? 5 : 0;
  ticker = setInterval(() => {
    const now = player.getCurrentTime();
    if (isPlaying(job)) elapsed += Math.min(1, Math.max(0, now - last));
    last = now;
    const played = Math.max(0, elapsed - warmup);
    if ((job.video || job.visual) && elapsed >= warmup) coverVideo(false);
    if (played >= job.duration) {
      stop(job.challenge ? 'Time to guess!' : 'Hook finished.');
      return;
    }
    status(elapsed < warmup ? 'Starting mystery clip…' :
      job.full ? 'Song playing…' : `Playing… ${Math.ceil(job.duration - played)} seconds left`);
  }, 200);
}

function initPlayers() {
  if (!window.YT?.Player || players.sound) return;
  for (const key of ['sound', 'visual']) {
    players[key] = new YT.Player(key, {
      width: '100%',
      height: '100%',
      playerVars: { playsinline: 1, controls: 0, rel: 0, origin: location.origin },
      events: {
        onReady: () => {
          ready[key] = true;
          if (key === 'visual') {
            neutralizeVideoTitle();
            new MutationObserver(neutralizeVideoTitle).observe(players.visual.getIframe(), {
              attributes: true, attributeFilter: ['title']
            });
          }
          if (pending && activePlayers(pending).every(name => ready[name])) {
            launch(pending);
          }
        },
        onStateChange: event => {
          if (!playJob || !activePlayers(playJob).includes(key)) return;
          if (event.data === 0) stop(playJob.challenge ? 'Time to guess!' : 'Song finished.');
          if (event.data === 1) updatePlayback();
        },
        onError: event => {
          if (!playJob || !activePlayers(playJob).includes(key)) return;
          stop(`The ${key === 'visual' ? 'video' : 'audio'} could not play (YouTube ${event.data}). Try playing the clip again.`);
        },
      }
    });
  }
}

window.onYouTubeIframeAPIReady = initPlayers;

function launch(job) {
  stop('Loading clip…');
  playJob = job;
  // Make the video frame visible before loading it. Some browsers defer hidden players.
  $('visualSection').hidden = !(job.visual || job.video);
  document.body.classList.toggle('hasVideo', !!(job.visual || job.video));
  document.body.classList.toggle('mysteryVideo', !!job.challenge);
  if (job.visual || job.video) coverVideo(true, job.challenge ? 'Starting mystery clip…' : 'Starting song video…');

  initPlayers();
  if (!activePlayers(job).every(key => ready[key])) {
    pending = job;
    watchdog = setTimeout(() => {
      if (pending === job) stop('YouTube did not load. Check your connection and try again.');
    }, 12000);
    return;
  }

  if (job.visual) {
    players.visual.mute();
    players.visual.loadVideoById({ videoId: job.visual.id, startSeconds: job.visual.start });
  }
  const player = primaryPlayer(job);
  player.unMute();
  player.setVolume(85);
  player.loadVideoById({ videoId: job.id, startSeconds: job.start });

  watchdog = setTimeout(() => {
    if (playJob !== job || isPlaying(job)) return;
    $('retrySound').hidden = false;
    status('Select Resume playback to start the clip.');
  }, 5000);
}

function songButton(song,label,full=false,video=false){
  const button=document.createElement('button');
  button.textContent=full?'Full '+label:'Play '+label+' hook';
  button.onclick=()=>launch({
    id:song.id,
    start:full?0:song.start,
    duration:full?Infinity:song.duration,
    full,
    video,
    challenge:false
  });
  return button;
}
function render(){const c=current();$('revealAnswer').hidden=!['plot','cast'].includes(c.kind);$('movieHint').hidden=c.kind!=='emoji';$('label').textContent=`ROUND ${c.round+1} · ${c.name.toUpperCase()} · QUESTION ${c.q+1} OF ${rounds[c.round].cards.length}`;$('question').textContent=c.prompt;$('question').className=['word','emoji'].includes(c.kind)?'word':'';$('rules').textContent=c.rules;$('progress').textContent=`${index+1} / ${cards.length}`;$('prev').disabled=index===0;$('next').textContent=index===cards.length-1?'Finish quiz':'Next question';$('visualSection').hidden=true;$('challengeControls').hidden=c.kind!=='mismatch';$('playChallenge').textContent=c.kind==='mismatch'?'Play mismatch':'Play clip';$('durationLabel').hidden=c.kind!=='mismatch';$('playback').hidden=['plot','cast'].includes(c.kind)||!c.songs.length;$('songButtons').replaceChildren();c.songs.forEach((s,i)=>{const label=c.kind==='mismatch'?(i===0?'original song':'replacement song'):c.kind==='word'||c.kind==='plot'?'example answer song':'answer song';$('songButtons').append(songButton(s,label,false,c.kind==='mismatch'&&i===0),songButton(s,label,true,c.kind==='mismatch'&&i===0))});$('rounds').replaceChildren();rounds.forEach((r,i)=>{const b=document.createElement('button');b.textContent=`${i+1}. ${r.name}`;b.className=i===c.round?'active':'';b.onclick=()=>navigate(rounds.slice(0,i).reduce((total,round)=>total+round.cards.length,0));$('rounds').append(b)});displayClock();drawScores()}
function navigate(n){document.body.classList.remove('hasVideo');stop('Ready');clearClock();seconds=null;index=n;render();if(current().kind==='cast')playCastCue()}
$('playChallenge').onclick=()=>{const c=current();launch({id:c.sound.id,start:c.sound.start,duration:c.kind==='mismatch'?Number($('duration').value):6,visual:c.kind==='mismatch'?c.visual:null,challenge:true})};$('stop').onclick=()=>stop();$('retrySound').onclick=()=>{if(!playJob)return;for(const key of activePlayers(playJob))players[key].playVideo();status('Starting playback…')};
$('startTimer').onclick=()=>{clearClock();seconds=current().kind==='word'?15:20;displayClock();clock=setInterval(()=>{seconds--;displayClock();if(seconds<=0)clearClock()},1000)};
$('prev').onclick=()=>{if(index>0)navigate(index-1)};$('next').onclick = () => {
  if (index < cards.length - 1) {
    navigate(index + 1);
    return;
  }

  stop();
  clearClock();
  document.body.classList.remove('hasVideo');
  $('gameScreen').hidden = true;
  document.body.classList.add('finished');
  $('closingScreen').hidden = false;
  $('closingTitle').focus();
};
$('fullscreen').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen?.();else document.documentElement.requestFullscreen?.()};document.addEventListener('keydown',e=>{if($('gameScreen').hidden||$('answerDialog').open||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;if(e.key==='ArrowRight')$('next').click();if(e.key==='ArrowLeft')$('prev').click()});window.addEventListener('pagehide',()=>stop());render();

$('startGame').onclick = () => {
  $('welcomePlayer').remove();
  $('welcome').hidden = true;
  stop('Ready');
  $('gameScreen').hidden = false;
  $('question').focus();
};

$('revealAnswer').onclick = () => {
  const card = current();
  if (!['plot', 'cast'].includes(card.kind)) return;

  clearClock();
  seconds = null;
  displayClock();
  $('answerTitle').textContent = card.name + ' answer';
  $('movieAnswer').textContent = card.answer.replaceAll('; ', '\n');
  const hasSong = card.songs.length > 0;
  const choice = $('movieSong');
  choice.replaceChildren();
  $('movieSongChoice').hidden = card.songs.length < 2;
  if (card.songs.length > 1) {
    card.songs.forEach((song, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = song.film;
      choice.append(option);
    });
    choice.value = '0';
  }
  $('revealMusic').hidden = !hasSong;
  $('answerDialog').showModal();
  if (hasSong) playMovieSong();
};
$('answerDialog').addEventListener('close', () => {
  $('movieAnswer').textContent = '';
  $('revealMusic').hidden = true;
});

$('movieHint').onclick = () => {
  const card = current();
  if (!card.filmHint) return;

  $('revealMusic').hidden = true;
  $('answerTitle').textContent = 'Movie hint';
  $('movieAnswer').textContent = card.filmHint;
  $('answerDialog').showModal();
};

function playMovieSong() {
  const card = current();
  const song = card.songs[Number($('movieSong').value) || 0];
  if (['plot', 'cast'].includes(card.kind) && song) launch(song);
}

$('movieSong').onchange = playMovieSong;
$('replayMovieSong').onclick = playMovieSong;
$('stopMovieSong').onclick = () => stop();

let castAudio;
async function playCastCue() {
  const card = current();
  try {
    castAudio ??= new AudioContext();
    if (castAudio.state === 'suspended') await castAudio.resume();
    if (current() !== card) return;

    const now = castAudio.currentTime;
    for (const [index, frequency] of [523.25, 659.25, 783.99].entries()) {
      const start = now + index * .09;
      const tone = castAudio.createOscillator();
      const volume = castAudio.createGain();
      tone.frequency.value = frequency;
      volume.gain.setValueAtTime(.001, start);
      volume.gain.exponentialRampToValueAtTime(.055, start + .025);
      volume.gain.exponentialRampToValueAtTime(.001, start + .23);
      tone.connect(volume).connect(castAudio.destination);
      tone.start(start);
      tone.stop(start + .23);
    }
  } catch {
    // The clue and answer are still usable if the browser restricts sound.
  }
}
