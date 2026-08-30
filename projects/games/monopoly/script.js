/* BOARD DATA  */
const GROUP_COLORS = {
  brown:'#8b4a2b', lightblue:'#a9ddf3', pink:'#d9498c', orange:'#e08a2c',
  red:'#d1382f', yellow:'#f2d33c', green:'#2e8b57', blue:'#1f5fa8',
  railroad:'#2b2b2b', utility:'#6b6b6b'
};

// index 0..39 going clockwise starting at GO (bottom-right corner)
const BOARD = [
  {i:0, type:'go', name:'GO'},
  {i:1, type:'property', name:'Mediterranean Ave', group:'brown', price:60, rent:2},
  {i:2, type:'chest', name:'Community Chest'},
  {i:3, type:'property', name:'Baltic Ave', group:'brown', price:60, rent:4},
  {i:4, type:'tax', name:'Income Tax', amount:200},
  {i:5, type:'railroad', name:'Reading Railroad', price:200},
  {i:6, type:'property', name:'Oriental Ave', group:'lightblue', price:100, rent:6},
  {i:7, type:'chance', name:'Chance'},
  {i:8, type:'property', name:'Vermont Ave', group:'lightblue', price:100, rent:6},
  {i:9, type:'property', name:'Connecticut Ave', group:'lightblue', price:120, rent:8},
  {i:10, type:'jail', name:'Jail'},
  {i:11, type:'property', name:'St. Charles Place', group:'pink', price:140, rent:10},
  {i:12, type:'utility', name:'Electric Company', price:150},
  {i:13, type:'property', name:'States Ave', group:'pink', price:140, rent:10},
  {i:14, type:'property', name:'Virginia Ave', group:'pink', price:160, rent:12},
  {i:15, type:'railroad', name:'Pennsylvania Railroad', price:200},
  {i:16, type:'property', name:'St. James Place', group:'orange', price:180, rent:14},
  {i:17, type:'chest', name:'Community Chest'},
  {i:18, type:'property', name:'Tennessee Ave', group:'orange', price:180, rent:14},
  {i:19, type:'property', name:'New York Ave', group:'orange', price:200, rent:16},
  {i:20, type:'parking', name:'Free Parking'},
  {i:21, type:'property', name:'Kentucky Ave', group:'red', price:220, rent:18},
  {i:22, type:'chance', name:'Chance'},
  {i:23, type:'property', name:'Indiana Ave', group:'red', price:220, rent:18},
  {i:24, type:'property', name:'Illinois Ave', group:'red', price:240, rent:20},
  {i:25, type:'railroad', name:'B&O Railroad', price:200},
  {i:26, type:'property', name:'Atlantic Ave', group:'yellow', price:260, rent:22},
  {i:27, type:'property', name:'Ventnor Ave', group:'yellow', price:260, rent:22},
  {i:28, type:'utility', name:'Water Works', price:150},
  {i:29, type:'property', name:'Marvin Gardens', group:'yellow', price:280, rent:24},
  {i:30, type:'gotojail', name:'Go To Jail'},
  {i:31, type:'property', name:'Pacific Ave', group:'green', price:300, rent:26},
  {i:32, type:'property', name:'North Carolina Ave', group:'green', price:300, rent:26},
  {i:33, type:'chest', name:'Community Chest'},
  {i:34, type:'property', name:'Pennsylvania Ave', group:'green', price:320, rent:28},
  {i:35, type:'railroad', name:'Short Line', price:200},
  {i:36, type:'chance', name:'Chance'},
  {i:37, type:'property', name:'Park Place', group:'blue', price:350, rent:35},
  {i:38, type:'tax', name:'Luxury Tax', amount:100},
  {i:39, type:'property', name:'Boardwalk', group:'blue', price:400, rent:50},
];

const CHANCE_CARDS = [
  {text:'Advance to GO. Collect $200.', fn:p=>{moveTo(p,0,true);}},
  {text:'Bank pays you a dividend of $50.', fn:p=>{pay(p,50);}},
  {text:'You have been elected Chairman of the Board. Pay each player $50.', fn:p=>{payEachPlayer(p,50);}},
  {text:'Your building loan matures. Collect $150.', fn:p=>{pay(p,150);}},
  {text:'Take a trip to Boardwalk.', fn:p=>{moveTo(p,39,false);}},
  {text:'Go directly to Jail. Do not pass GO.', fn:p=>{sendToJail(p);}},
  {text:'Speeding fine. Pay $15.', fn:p=>{charge(p,15);}},
  {text:'Advance to Illinois Ave.', fn:p=>{moveTo(p,24,true);}},
];
const CHEST_CARDS = [
  {text:'Bank error in your favor. Collect $200.', fn:p=>{pay(p,200);}},
  {text:'Doctor\'s fees. Pay $50.', fn:p=>{charge(p,50);}},
  {text:'From sale of stock you get $50.', fn:p=>{pay(p,50);}},
  {text:'Holiday fund matures. Receive $100.', fn:p=>{pay(p,100);}},
  {text:'Income tax refund. Collect $20.', fn:p=>{pay(p,20);}},
  {text:'Life insurance matures. Collect $100.', fn:p=>{pay(p,100);}},
  {text:'Pay hospital fees of $100.', fn:p=>{charge(p,100);}},
  {text:'Go to Jail. Do not pass GO.', fn:p=>{sendToJail(p);}},
];

const TOKEN_COLORS = ['#c0392b','#2980b9','#27ae60','#8e44ad'];
const TOKEN_LETTERS = ['A','B','C','D'];

/* ---------------- STATE ---------------- */
let players = [];
let currentPlayerIdx = 0;
let owners = {}; // spaceIndex -> playerIdx
let doublesCount = 0;
let pendingSpace = null;

/* ---------------- SETUP UI ---------------- */
let numPlayers = 2;
const numPickerEl = document.getElementById('numPicker');
const nameInputsEl = document.getElementById('nameInputs');

function renderNameInputs(){
  nameInputsEl.innerHTML = '';

  for(let i=0;i<numPlayers;i++){
    const row = document.createElement('div');
    row.className = 'ni';

    const swatch = document.createElement('div');
    swatch.className = 'swatchdot';
    swatch.style.background = TOKEN_COLORS[i];

    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 14;
    input.placeholder = `Player ${i + 1}`;
    input.id = `nameIn${i}`;

    row.appendChild(swatch);
    row.appendChild(input);
    nameInputsEl.appendChild(row);
  }
}
renderNameInputs();

numPickerEl.querySelectorAll('button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    numPickerEl.querySelectorAll('button').forEach(b=>b.classList.remove('sel'));
    btn.classList.add('sel');
    numPlayers = parseInt(btn.dataset.n);
    renderNameInputs();
  });
});

document.getElementById('startGameBtn').addEventListener('click', ()=>{
  players = [];
  for(let i=0;i<numPlayers;i++){
    const val = document.getElementById('nameIn'+i).value.trim();
    players.push({
      id:i, name: val || ('Player '+(i+1)), cash:1500, pos:0,
      color: TOKEN_COLORS[i], letter: TOKEN_LETTERS[i],
      inJail:false, jailTurns:0, bankrupt:false
    });
  }
  document.getElementById('setupOverlay').style.display='none';
  initBoard();
  renderAll();
  logMsg('Game started with ' + players.map(p=>p.name).join(', ') + '.');
});

/*  BOARD RENDERING  */
function cellGridArea(i){
  if(i>=0 && i<=10){
    return {col: 11 - i, row: 11};
  } else if(i>10 && i<=20){
    return {col: 1, row: 11 - (i-10)};
  } else if(i>20 && i<=30){
    return {col: 1 + (i-20), row: 1};
  } else {
    return {col: 11, row: 1 + (i-30)};
  }
}

function initBoard(){
  const boardEl = document.getElementById('board');
  BOARD.forEach(space=>{
    const {col,row} = cellGridArea(space.i);
    const div = document.createElement('div');
    div.className = 'cell';
    div.id = 'cell-'+space.i;
    div.style.gridColumn = col;
    div.style.gridRow = row;
    const isCorner = [0,10,20,30].includes(space.i);
    const isBottom = space.i>=0 && space.i<=10;

    if(isCorner){
      div.classList.add('corner');
      let label = space.i===0?'GO':space.i===10?'JAIL':space.i===20?'PARKING':'GO TO JAIL';
      div.innerHTML = `<div>${label}</div>`;
    } else if(space.type==='property'){
      div.classList.add('ownable');
      if(isBottom) div.classList.add('side-bottom');
      div.innerHTML = `<div class="colorbar" style="background:${GROUP_COLORS[space.group]}"></div>
        <div class="name">${space.name}</div>
        <div class="price">$${space.price}</div>
        <div class="owner-strip"></div>`;
    } else if(space.type==='railroad' || space.type==='utility'){
      div.classList.add('ownable', 'special');
      div.innerHTML = `<div class="name">${space.name}</div><div class="price">$${space.price}</div>
        <div class="owner-strip"></div>`;
    } else {
      div.classList.add('special');
      div.innerHTML = `<div class="name">${space.name}${space.amount?('<br>$'+space.amount):''}</div>`;
    }
    boardEl.appendChild(div);
  });
}

function renderTokens(){
  document.querySelectorAll('.tokens-on-cell').forEach(e=>e.remove());
  players.forEach(p=>{
    if(p.bankrupt) return;
    let holder = document.getElementById('cell-'+p.pos).querySelector('.tokens-on-cell');
    if(!holder){
      holder = document.createElement('div');
      holder.className = 'tokens-on-cell';
      document.getElementById('cell-'+p.pos).appendChild(holder);
    }
    const t = document.createElement('div');
    t.className = 'token';
    t.style.background = p.color;
    t.textContent = p.letter;
    holder.appendChild(t);
  });
}

function renderOwnership(){
  document.querySelectorAll('.owner-strip').forEach(e=>e.innerHTML='');
  Object.entries(owners).forEach(([idx, playerIdx])=>{
    const strip = document.querySelector('#cell-'+idx+' .owner-strip');
    if(strip){
      const dot = document.createElement('div');
      dot.className = 'owner-dot';
      dot.style.background = players[playerIdx].color;
      strip.appendChild(dot);
    }
  });
}

function renderPlayers(){
  const el = document.getElementById('playersList');
  el.innerHTML = '';

  players.forEach((p,idx)=>{
    const row = document.createElement('div');
    row.className = 'player-row' +
      (idx===currentPlayerIdx?' active':'') +
      (p.bankrupt?' bankrupt':'');

    const token = document.createElement('div');
    token.className = 'tok';
    token.style.background = p.color;
    token.textContent = p.letter;

    const info = document.createElement('div');
    info.className = 'info';

    const name = document.createElement('div');
    name.className = 'nm';
    name.appendChild(document.createTextNode(p.name));

    if (p.inJail) {
      const jailBadge = document.createElement('span');
      jailBadge.className = 'jail-badge';
      jailBadge.textContent = 'JAIL';
      name.appendChild(jailBadge);
    }

    const cash = document.createElement('div');
    cash.className = 'cash';
    cash.textContent = `$${p.cash.toLocaleString()}`;

    info.appendChild(name);
    info.appendChild(cash);
    row.appendChild(token);
    row.appendChild(info);
    el.appendChild(row);
  });
}

function renderAll(){
  renderTokens();
  renderOwnership();
  renderPlayers();
}

function logMsg(msg){
  const log = document.getElementById('log');
  const div = document.createElement('div');
  div.textContent = msg;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

function setStatus(msg){
  document.getElementById('statusMsg').textContent = msg;
}

/* GAME HELPERS */
function currentPlayer(){ return players[currentPlayerIdx]; }

function pay(p, amt){ p.cash += amt; renderPlayers(); }
function charge(p, amt){
  p.cash -= amt;
  if(p.cash < 0) handleBankruptcy(p);
  renderPlayers();
}
function payEachPlayer(from, amt){
  players.forEach(p=>{ if(p!==from && !p.bankrupt){ from.cash -= amt; p.cash += amt; } });
  if(from.cash < 0) handleBankruptcy(from);
  renderPlayers();
}

function handleBankruptcy(p){
  if(p.bankrupt) return;
  p.bankrupt = true;
  logMsg(p.name + ' has gone bankrupt!');
  Object.keys(owners).forEach(idx=>{
    if(owners[idx]===p.id) delete owners[idx];
  });
  renderAll();
  checkGameOver();
}

function checkGameOver(){
  const alive = players.filter(p=>!p.bankrupt);
  if(alive.length===1){
    setStatus(alive[0].name + ' wins the game!');
    document.getElementById('rollBtn').disabled = true;
    document.getElementById('endTurnBtn').disabled = true;
    logMsg(alive[0].name + ' wins the game!');
  }
}

function sendToJail(p){
  p.pos = 10;
  p.inJail = true;
  p.jailTurns = 0;
  logMsg(p.name + ' is sent to Jail.');
  renderTokens();
}

function moveTo(p, idx, collectIfPassed){
  const passedGo = collectIfPassed && idx < p.pos;
  p.pos = idx;
  if(passedGo){ p.cash += 200; logMsg(p.name + ' passed GO and collected $200.'); }
  renderTokens();
  renderPlayers();
}

/* DICE & TURN LOGIC */
const rollBtn = document.getElementById('rollBtn');
const buyBtn = document.getElementById('buyBtn');
const endTurnBtn = document.getElementById('endTurnBtn');

rollBtn.addEventListener('click', doRoll);
endTurnBtn.addEventListener('click', endTurn);
buyBtn.addEventListener('click', buyCurrentProperty);

function setDie(el, val){ el.dataset.v = val; }

function doRoll(){
  const p = currentPlayer();
  if(p.bankrupt) return;

  const d1 = 1+Math.floor(Math.random()*6);
  const d2 = 1+Math.floor(Math.random()*6);
  setDie(document.getElementById('die1'), d1);
  setDie(document.getElementById('die2'), d2);
  document.getElementById('diceSum').textContent = `= ${d1+d2}` + (d1===d2 ? ' (doubles!)' : '');

  rollBtn.disabled = true;

  if(p.inJail){
    if(d1===d2){
      p.inJail = false;
      logMsg(p.name + ' rolled doubles and got out of Jail!');
    } else {
      p.jailTurns++;
      if(p.jailTurns>=3){
        p.inJail = false;
        p.cash -= 50;
        logMsg(p.name + ' paid $50 bail after 3 turns in Jail.');
      } else {
        logMsg(p.name + ' is still in Jail (attempt ' + p.jailTurns + '/3).');
        renderPlayers();
        endTurnBtn.disabled = false;
        return;
      }
    }
  }

  if(d1===d2){ doublesCount++; } else { doublesCount = 0; }
  if(doublesCount>=3){
    logMsg(p.name + ' rolled doubles three times in a row — straight to Jail!');
    sendToJail(p);
    doublesCount = 0;
    renderPlayers();
    endTurnBtn.disabled = false;
    return;
  }

  const newPos = (p.pos + d1 + d2) % 40;
  const passedGo = newPos < p.pos;
  p.pos = newPos;
  if(passedGo){ p.cash += 200; logMsg(p.name + ' passed GO and collected $200.'); }
  renderTokens();
  renderPlayers();

  logMsg(p.name + ' rolled ' + d1 + ' + ' + d2 + ' and landed on ' + BOARD[p.pos].name + '.');
  resolveSpace(p, d1+d2, d1===d2);
}

function resolveSpace(p, diceSum, wasDouble){
  const space = BOARD[p.pos];
  buyBtn.style.display = 'none';

  if(space.type==='go'){
    setStatus(p.name + ' is on GO.');
    finishNonBuyStep(wasDouble);
  } else if(space.type==='property' || space.type==='railroad' || space.type==='utility'){
    const ownerIdx = owners[space.i];
    if(ownerIdx===undefined){
      pendingSpace = space;
      setStatus(space.name + ' is unowned. Buy for $' + space.price + '?');
      if(p.cash>=space.price){
        buyBtn.style.display='inline-block';
      }
      endTurnBtn.disabled = false;
    } else if(ownerIdx===p.id){
      setStatus(p.name + ' already owns ' + space.name + '.');
      finishNonBuyStep(wasDouble);
    } else {
      const owner = players[ownerIdx];
      const rent = computeRent(space, owner, diceSum);
      p.cash -= rent;
      owner.cash += rent;
      logMsg(p.name + ' paid $' + rent + ' rent to ' + owner.name + ' for ' + space.name + '.');
      renderPlayers();
      if(p.cash<0){ handleBankruptcy(p); }
      setStatus('Paid $' + rent + ' rent to ' + owner.name + '.');
      finishNonBuyStep(wasDouble);
    }
  } else if(space.type==='tax'){
    p.cash -= space.amount;
    logMsg(p.name + ' paid $' + space.amount + ' in ' + space.name + '.');
    renderPlayers();
    if(p.cash<0) handleBankruptcy(p);
    setStatus('Paid $' + space.amount + ' tax.');
    finishNonBuyStep(wasDouble);
  } else if(space.type==='chance' || space.type==='chest'){
    const deck = space.type==='chance' ? CHANCE_CARDS : CHEST_CARDS;
    const card = deck[Math.floor(Math.random()*deck.length)];
    showCardModal(space.type, card, ()=>{
      card.fn(p);
      renderAll();
      if(p.cash<0) handleBankruptcy(p);
      finishNonBuyStep(wasDouble);
    });
    return;
  } else if(space.type==='gotojail'){
    sendToJail(p);
    setStatus(p.name + ' was sent to Jail.');
    renderPlayers();
    endTurnBtn.disabled = false;
  } else if(space.type==='parking'){
    setStatus(p.name + ' is on Free Parking. Nothing happens.');
    finishNonBuyStep(wasDouble);
  } else if(space.type==='jail'){
    setStatus(p.name + ' is just visiting Jail.');
    finishNonBuyStep(wasDouble);
  }
  checkGameOver();
}

function finishNonBuyStep(wasDouble){
  endTurnBtn.disabled = false;
  if(wasDouble){
    setStatus(document.getElementById('statusMsg').textContent + ' Doubles! Roll again after ending this step.');
  }
}

function computeRent(space, owner, diceSum){
  if(space.type==='property'){
    return space.rent; // simplified: base rent only, no houses/hotels
  }
  if(space.type==='railroad'){
    const count = BOARD.filter(s=>s.type==='railroad' && owners[s.i]===owner.id).length;
    return [0,25,50,100,200][count];
  }
  if(space.type==='utility'){
    const count = BOARD.filter(s=>s.type==='utility' && owners[s.i]===owner.id).length;
    return diceSum * (count===2 ? 10 : 4);
  }
  return 0;
}

function buyCurrentProperty(){
  const p = currentPlayer();
  const space = pendingSpace;
  if(!space) return;
  if(p.cash < space.price) return;
  p.cash -= space.price;
  owners[space.i] = p.id;
  logMsg(p.name + ' bought ' + space.name + ' for $' + space.price + '.');
  buyBtn.style.display = 'none';
  pendingSpace = null;
  renderAll();
  setStatus(p.name + ' now owns ' + space.name + '.');
  endTurnBtn.disabled = false;
}

function endTurn(){
  const p = currentPlayer();
  const wasDoubleTurn = document.getElementById('die1').dataset.v === document.getElementById('die2').dataset.v;
  buyBtn.style.display = 'none';
  pendingSpace = null;

  if(wasDoubleTurn && !p.bankrupt && !p.inJail && doublesCount>0 && doublesCount<3){
    setStatus(p.name + ' rolled doubles — roll again!');
    rollBtn.disabled = false;
    endTurnBtn.disabled = true;
    return;
  }

  doublesCount = 0;
  do{
    currentPlayerIdx = (currentPlayerIdx+1) % players.length;
  } while(players[currentPlayerIdx].bankrupt);

  rollBtn.disabled = false;
  endTurnBtn.disabled = true;
  document.getElementById('diceSum').textContent = '';
  renderPlayers();
  setStatus(currentPlayer().name + "'s turn. Roll the dice.");
}

/* ---------------- MODALS ---------------- */
function showCardModal(type, card, onClose){
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  const title = type==='chance' ? 'Chance' : 'Community Chest';
  box.innerHTML = `<h2>${title}</h2><p>${card.text}</p>
    <div class="btn-row"><button id="modalOkBtn">OK</button></div>`;
  overlay.style.display = 'flex';
  document.getElementById('modalOkBtn').addEventListener('click', ()=>{
    overlay.style.display = 'none';
    onClose();
  }, {once:true});
}