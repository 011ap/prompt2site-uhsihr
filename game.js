// Vibe Race: Gen Z Remote Board Game (Ludo-inspired, up to 4 players)
// Core logic, UI, and multiplayer via Socket.IO (peer-to-peer fallback for demo)

const COLORS = [
  { name: 'Pink', color: '#ff69b4', emoji: '💖' },
  { name: 'Blue', color: '#00bfff', emoji: '💙' },
  { name: 'Green', color: '#39e75f', emoji: '💚' },
  { name: 'Yellow', color: '#ffe066', emoji: '💛' }
];
const BOARD_SIZE = 20; // 20 spaces in a loop
const TOKENS_PER_PLAYER = 2;
const WIN_TOKENS = TOKENS_PER_PLAYER;
const MAX_PLAYERS = 4;

let socket = null;
let myId = null;
let myColorIdx = null;
let myNickname = '';
let roomId = null;
let isHost = false;
let gameState = null;
let chatHistory = [];

// --- UI Elements ---
const lobbyPanel = document.getElementById('lobby');
const playerListDiv = document.getElementById('player-list');
const nicknameInput = document.getElementById('nickname');
const joinBtn = document.getElementById('join-btn');
const startBtn = document.getElementById('start-btn');
const roomInfo = document.getElementById('room-info');
const gamePanel = document.getElementById('game');
const boardCanvas = document.getElementById('board-canvas');
const rollBtn = document.getElementById('roll-btn');
const diceResultDiv = document.getElementById('dice-result');
const moveOptionsDiv = document.getElementById('move-options');
const playerStatusDiv = document.getElementById('player-status');
const chatDiv = document.getElementById('chat');
const chatMessagesDiv = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat');
const gameOverPanel = document.getElementById('game-over');
const winnerDiv = document.getElementById('winner');
const restartBtn = document.getElementById('restart-btn');

// --- Utility Functions ---
function randomRoomId() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}
function randomColorIdx(used) {
  let idx;
  do { idx = Math.floor(Math.random() * COLORS.length); } while (used.includes(idx));
  return idx;
}
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// --- Socket.IO Setup (local fallback for demo) ---
function setupSocket() {
  // For demo: use local peer-to-peer emulation if no server
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // Local fallback: single player
    socket = {
      id: 'local',
      emit: (event, data) => {
        if (event === 'join') onJoin({ ...data, id: 'local' });
        if (event === 'start') onStart();
        if (event === 'roll') onRoll({ ...data, id: 'local' });
        if (event === 'move') onMove({ ...data, id: 'local' });
        if (event === 'chat') onChat({ ...data, id: 'local' });
        if (event === 'restart') onRestart();
      },
      on: () => {}
    };
    myId = 'local';
    isHost = true;
    updateLobby([{ id: 'local', nickname: 'You', colorIdx: 0 }]);
    return;
  }
  socket = io();
  socket.on('connect', () => {
    myId = socket.id;
  });
  socket.on('lobby', updateLobby);
  socket.on('start', onStart);
  socket.on('state', onState);
  socket.on('roll', onRoll);
  socket.on('move', onMove);
  socket.on('chat', onChat);
  socket.on('gameover', onGameOver);
  socket.on('restart', onRestart);
}

// --- Lobby Logic ---
let lobbyPlayers = [];
function updateLobby(players) {
  lobbyPlayers = players;
  playerListDiv.innerHTML = '<b>Players:</b><br>' + players.map(p => {
    const c = COLORS[p.colorIdx] || COLORS;
    return `<span style="color:${c.color}">${c.emoji} ${p.nickname}</span>`;
  }).join('<br>');
  if (players.length >= 2 && players.length <= MAX_PLAYERS) {
    startBtn.disabled = false;
  } else {
    startBtn.disabled = true;
  }
  isHost = players && players.id === myId;
  startBtn.style.display = isHost ? '' : 'none';
}

joinBtn.onclick = () => {
  myNickname = nicknameInput.value.trim() || `Player${Math.floor(Math.random()*1000)}`;
  if (!roomId) {
    roomId = randomRoomId();
    roomInfo.textContent = `Room ID: ${roomId}`;
  }
  myColorIdx = randomColorIdx(lobbyPlayers.map(p => p.colorIdx));
  socket.emit('join', { roomId, nickname: myNickname, colorIdx: myColorIdx });
  joinBtn.disabled = true;
  nicknameInput.disabled = true;
};

startBtn.onclick = () => {
  if (lobbyPlayers.length >= 2) {
    socket.emit('start', { roomId });
  }
};

// --- Game State ---
function initialGameState(players) {
  // Each player: { id, nickname, colorIdx, tokens: [ { pos: -1, finished: false } ] }
  return {
    players: players.map(p => ({
      ...p,
      tokens: Array(TOKENS_PER_PLAYER).fill(0).map(() => ({ pos: -1, finished: false }))
    })),
    turn: 0,
    dice: null,
    phase: 'roll', // or 'move'
    winner: null
  };
}

function onStart() {
  lobbyPanel.classList.add('hidden');
  gamePanel.classList.remove('hidden');
  gameState = initialGameState(lobbyPlayers);
  drawBoard();
  updateGameUI();
}

function onState(state) {
  gameState = state;
  drawBoard();
  updateGameUI();
}

function onRoll({ id, dice }) {
  if (!gameState) return;
  gameState.dice = dice;
  gameState.phase = 'move';
  drawBoard();
  updateGameUI();
}

function onMove({ id, tokenIdx, newPos, finished }) {
  if (!gameState) return;
  const player = gameState.players[gameState.turn];
  if (!player) return;
  player.tokens[tokenIdx].pos = newPos;
  player.tokens[tokenIdx].finished = finished;
  // Check win
  if (player.tokens.every(t => t.finished)) {
    gameState.winner = player;
    setTimeout(() => onGameOver({ winner: player }), 500);
    return;
  }
  // Next turn
  gameState.turn = (gameState.turn + 1) % gameState.players.length;
  gameState.dice = null;
  gameState.phase = 'roll';
  drawBoard();
  updateGameUI();
}

function onGameOver({ winner }) {
  gamePanel.classList.add('hidden');
  gameOverPanel.classList.remove('hidden');
  winnerDiv.innerHTML = `${COLORS[winner.colorIdx].emoji} <b>${winner.nickname}</b> wins!`;
}

restartBtn.onclick = () => {
  socket.emit('restart', { roomId });
};

function onRestart() {
  gameOverPanel.classList.add('hidden');
  lobbyPanel.classList.remove('hidden');
  joinBtn.disabled = false;
  nicknameInput.disabled = false;
}

// --- Game UI ---
function updateGameUI() {
  if (!gameState) return;
  const me = gameState.players.find(p => p.id === myId);
  const isMyTurn = gameState.players[gameState.turn].id === myId;
  playerStatusDiv.innerHTML = `Turn: <b style="color:${COLORS[gameState.players[gameState.turn].colorIdx].color}">${gameState.players[gameState.turn].nickname}</b>`;
  rollBtn.disabled = !(isMyTurn && gameState.phase === 'roll');
  moveOptionsDiv.innerHTML = '';
  diceResultDiv.textContent = gameState.dice ? `Rolled: ${gameState.dice}` : '';
  if (isMyTurn && gameState.phase === 'move') {
    // Show move options
    const myPlayer = gameState.players[gameState.turn];
    myPlayer.tokens.forEach((token, idx) => {
      if (token.finished) return;
      let canMove = false;
      if (token.pos === -1 && gameState.dice === 6) canMove = true;
      if (token.pos >= 0 && token.pos < BOARD_SIZE) canMove = true;
      if (canMove) {
        const btn = document.createElement('button');
        btn.textContent = `Move Token ${idx + 1}`;
        btn.onclick = () => doMove(idx);
        moveOptionsDiv.appendChild(btn);
      }
    });
    if (!moveOptionsDiv.children.length) {
      // No moves possible, next turn
      setTimeout(() => {
        socket.emit('move', { roomId, tokenIdx: 0, newPos: -1, finished: false, skip: true });
      }, 900);
    }
  }
}

rollBtn.onclick = () => {
  if (!gameState) return;
  const dice = Math.floor(Math.random() * 6) + 1;
  socket.emit('roll', { roomId, dice });
};

function doMove(tokenIdx) {
  const player = gameState.players[gameState.turn];
  const token = player.tokens[tokenIdx];
  let newPos = token.pos;
  let finished = false;
  if (token.pos === -1 && gameState.dice === 6) {
    newPos = 0;
  } else if (token.pos >= 0) {
    newPos = token.pos + gameState.dice;
    if (newPos >= BOARD_SIZE) {
      finished = true;
      newPos = -2; // off board
    }
  }
  socket.emit('move', { roomId, tokenIdx, newPos, finished });
}

// --- Board Drawing ---
function drawBoard() {
  const ctx = boardCanvas.getContext('2d');
  ctx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
  // Draw board loop
  const cx = 250, cy = 250, r = 180;
  for (let i = 0; i < BOARD_SIZE; ++i) {
    const angle = (2 * Math.PI * i) / BOARD_SIZE - Math.PI/2;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, 2 * Math.PI);
    ctx.fillStyle = '#23233b';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#657ced';
    ctx.stroke();
    ctx.font = 'bold 16px Inter';
    ctx.fillStyle = '#b3b3ff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(i+1, x, y);
  }
  // Draw tokens
  if (!gameState) return;
  gameState.players.forEach((p, pIdx) => {
    p.tokens.forEach((t, tIdx) => {
      if (t.pos >= 0 && t.pos < BOARD_SIZE) {
        const angle = (2 * Math.PI * t.pos) / BOARD_SIZE - Math.PI/2;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        ctx.beginPath();
        ctx.arc(x, y, 13, 0, 2 * Math.PI);
        ctx.fillStyle = COLORS[p.colorIdx].color;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#fff';
        ctx.stroke();
        ctx.font = 'bold 18px Inter';
        ctx.fillStyle = '#23233b';
        ctx.fillText(COLORS[p.colorIdx].emoji, x, y);
      }
    });
  });
  // Draw home/finish zones
  gameState.players.forEach((p, pIdx) => {
    for (let t = 0; t < TOKENS_PER_PLAYER; ++t) {
      let x = 60 + pIdx * 110, y = 460;
      ctx.beginPath();
      ctx.arc(x, y + t * 30, 13, 0, 2 * Math.PI);
      ctx.fillStyle = COLORS[p.colorIdx].color;
      ctx.globalAlpha = 0.3;
      ctx.fill();
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
      ctx.font = 'bold 18px Inter';
      ctx.fillStyle = '#fff';
      ctx.fillText(COLORS[p.colorIdx].emoji, x, y + t * 30);
    }
  });
}

// --- Chat ---
function renderChat() {
  chatMessagesDiv.innerHTML = chatHistory.map(msg => {
    const c = COLORS[msg.colorIdx] || COLORS;
    return `<span style="color:${c.color}">${c.emoji} <b>${msg.nickname}</b>:</span> ${msg.text}`;
  }).join('<br>');
  chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
}

sendChatBtn.onclick = () => {
  const text = chatInput.value.trim();
  if (text) {
    socket.emit('chat', { roomId, nickname: myNickname, colorIdx: myColorIdx, text });
    chatInput.value = '';
  }
};
chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') sendChatBtn.click();
});

function onChat(msg) {
  chatHistory.push(msg);
  if (chatHistory.length > 40) chatHistory.shift();
  renderChat();
}

// --- Init ---
setupSocket();
window.onload = () => {
  drawBoard();
  updateGameUI();
  renderChat();
};
