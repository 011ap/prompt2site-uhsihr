// GenZ Ludo Board Game
// Minimal implementation with dice, room, players, start/join

const COLORS = ['red', 'green', 'blue', 'yellow'];
const TOKENS_PER_PLAYER = 4;
const BOARD_SIZE = 11;
const SAFE_SQUARES = [
  [0, 4], [0, 6], [4, 0], [6, 0], [10, 4], [10, 6], [4, 10], [6, 10], // starting squares
  [2, 5], [5, 2], [8, 5], [5, 8] // center safe squares
];

let roomId = '';
let players = [];
let currentPlayer = 0;
let gameStarted = false;
let diceValue = null;
let tokens = {};

function $(id) { return document.getElementById(id); }

function renderRoom() {
  if (roomId) {
    $('room').textContent = `Room: ${roomId}`;
  } else {
    $('room').textContent = '';
  }
}

function renderPlayers() {
  $('players').innerHTML =
    players.map((p, i) => `<span style="color:${COLORS[i]};font-weight:bold;">${p}${i === currentPlayer ? ' (Your turn)' : ''}</span>`).join(' | ');
}

function renderBoard() {
  const board = $('board');
  board.innerHTML = '';
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      let square = document.createElement('div');
      square.className = 'square';
      // Color home columns
      if (r < 2 && c > 3 && c < 7) square.classList.add('red');
      if (c < 2 && r > 3 && r < 7) square.classList.add('green');
      if (r > 8 && c > 3 && c < 7) square.classList.add('yellow');
      if (c > 8 && r > 3 && r < 7) square.classList.add('blue');
      // Safe squares
      if (SAFE_SQUARES.some(([rr, cc]) => rr === r && cc === c)) square.classList.add('safe');
      // Tokens
      for (let pi = 0; pi < players.length; pi++) {
        if (!tokens[pi]) continue;
        tokens[pi].forEach((t, ti) => {
          if (t.r === r && t.c === c) {
            let tok = document.createElement('span');
            tok.className = `token ${COLORS[pi]}`;
            tok.title = `${players[pi]} Token ${ti+1}`;
            square.appendChild(tok);
          }
        });
      }
      board.appendChild(square);
    }
  }
}

function randomRoomId() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

function startGame() {
  if (players.length < 2) {
    alert('Need at least 2 players to start.');
    return;
  }
  gameStarted = true;
  currentPlayer = 0;
  diceValue = null;
  // Place tokens in home (off board)
  tokens = {};
  for (let pi = 0; pi < players.length; pi++) {
    tokens[pi] = [];
    for (let ti = 0; ti < TOKENS_PER_PLAYER; ti++) {
      tokens[pi].push({ r: -1, c: -1, atHome: true });
    }
  }
  renderBoard();
  renderPlayers();
  $('rollDiceBtn').disabled = false;
}

function joinGame() {
  if (gameStarted) {
    alert('Game already started.');
    return;
  }
  let name = prompt('Enter your player name:');
  if (!name) return;
  if (players.length >= 4) {
    alert('Room full (max 4 players).');
    return;
  }
  players.push(name);
  renderPlayers();
}

function rollDice() {
  if (!gameStarted) return;
  diceValue = Math.floor(Math.random() * 6) + 1;
  $('dice').textContent = diceValue;
  // Move logic (minimal, only allow moving out of home)
  let pi = currentPlayer;
  let canMoveOut = diceValue === 6 && tokens[pi].some(t => t.atHome);
  if (canMoveOut) {
    // Move first home token to starting square
    let t = tokens[pi].find(tk => tk.atHome);
    let pos = getStartSquare(pi);
    t.r = pos.r;
    t.c = pos.c;
    t.atHome = false;
    renderBoard();
    // Player gets another turn on rolling 6
    return;
  }
  // Next player's turn
  currentPlayer = (currentPlayer + 1) % players.length;
  renderPlayers();
}

function getStartSquare(pi) {
  // Red: [0,4], Green: [4,0], Blue: [6,10], Yellow: [10,6]
  if (COLORS[pi] === 'red') return { r: 0, c: 4 };
  if (COLORS[pi] === 'green') return { r: 4, c: 0 };
  if (COLORS[pi] === 'blue') return { r: 6, c: 10 };
  if (COLORS[pi] === 'yellow') return { r: 10, c: 6 };
  return { r: 0, c: 0 };
}

$('startBtn').onclick = function() {
  if (!roomId) {
    roomId = randomRoomId();
    renderRoom();
  }
  startGame();
};

$('joinBtn').onclick = function() {
  if (!roomId) {
    roomId = randomRoomId();
    renderRoom();
  }
  joinGame();
};

$('rollDiceBtn').onclick = rollDice;

// Initial render
renderBoard();
renderPlayers();
renderRoom();
$('rollDiceBtn').disabled = true;
