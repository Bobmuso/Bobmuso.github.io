const suits = ["♠","♥","♦","♣"];
const suitNames = ["spade","heart","diamond","club"];
const ranks = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];

let deck = [],
    waste = [],
    foundations = [[],[],[],[]],
    tableau = [[],[],[],[],[],[],[]],
    hidden = [0,1,2,3,4,5,6]; // number face-down in each tableau

function makeDeck() {
  let d = [];
  for (let s = 0; s < 4; s++)
    for (let r = 0; r < 13; r++)
      d.push({
        suit: suits[s],
        suitIdx:s,
        rank: ranks[r],
        rankIdx:r,
        color: (s === 1 || s === 2) ? "red" : "black"
      });
  // Fisher-Yates shuffle
  for (let i=d.length-1; i>0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function restartGame() {
  deck = makeDeck();
  waste = [];
  foundations = [[],[],[],[]];
  tableau = [[],[],[],[],[],[],[]];
  hidden = [0,1,2,3,4,5,6];
  // Deal tableau
  for (let t=0;t<7;t++) {
    for (let j=0;j<=t;j++) tableau[t].push(deck.pop());
  }
  for (let t=0;t<7;t++) {
    tableau[t] = tableau[t].map((c,idx)=>({...c, faceUp: idx>=hidden[t]}));
  }
  render();
  document.getElementById("win-msg").textContent = "";
}

function render() {
  renderPile(deck, "deck-pile", "deck");
  renderPile(waste, "waste-pile", "waste");
  renderFoundations();
  renderTableau();
}

// --- Rendering Piles and Cards, Drag Support ---
function renderPile(pile, elemId, type) {
  const pileElem = document.getElementById(elemId);
  pileElem.innerHTML = "";
  if(type==="deck" && pile.length > 0) {
    pileElem.appendChild(createCardElem({faceUp:false}, type, pile.length-1));
  } else if (type==="waste" && pile.length > 0) {
    pileElem.appendChild(createCardElem(pile[pile.length-1], type, pile.length-1));
  }
}

function renderFoundations() {
  const zone = document.getElementById("foundations");
  zone.innerHTML = "";
  for (let i=0; i<4; i++) {
    let pile = foundations[i];
    const div = document.createElement("div");
    div.className = "pile foundation-pile";
    div.id = `foundation${i}`;
    div.dataset.foundation = i;
    div.addEventListener("dragover", (e) => dragOverPile(e,div));
    div.addEventListener("drop", (e) => dropOnFoundation(e,i));
    if (pile.length) {
      let c = pile[pile.length-1];
      div.appendChild(createCardElem(c, "foundation", pile.length-1));
    } else {
      let o = document.createElement("div");
      o.className = "card";
      o.innerHTML = suitNames[i][0].toUpperCase();
      o.style.opacity="0.6";
      div.appendChild(o);
    }
    zone.appendChild(div);
  }
}

function renderTableau() {
  const zone = document.getElementById("tableau");
  zone.innerHTML = "";
  for (let t=0;t<7;t++) {
    const pileDiv = document.createElement("div");
    pileDiv.className = "pile tableau-pile";
    pileDiv.id = `tableau${t}`;
    pileDiv.dataset.tableau = t;
    pileDiv.style.position="relative";
    pileDiv.addEventListener("dragover", (e) => dragOverPile(e,pileDiv));
    pileDiv.addEventListener("drop", (e) => dropOnTableau(e,t));
    const pile = tableau[t];
    for (let i=0; i<pile.length; i++) {
      const card = pile[i];
      const el = createCardElem(card,"tableau", i, t);
      el.style.top = `${i*22}px`; // Stack them downward
      el.style.left = "0";
      el.draggable = card.faceUp;
      pileDiv.appendChild(el);
    }
    zone.appendChild(pileDiv);
  }
}

// --- Card UI creation (with drag events) ---
function createCardElem(card, pileType, i, tableauIdx) {
  const d = document.createElement("div");
  d.className = "card";
  if (!card.faceUp) {
    d.classList.add("face-down");
    d.innerHTML = "🂠";
    d.draggable = false;
    return d;
  }
  if(["heart","diamond"].includes(suitNames[card.suitIdx])) d.classList.add("red");
  d.classList.add(suitNames[card.suitIdx]);
  d.innerHTML = `<span>${card.rank}${card.suit}</span>`;
  d.dataset.pile = pileType;
  d.dataset.index = i;
  if (typeof tableauIdx !== "undefined") d.dataset.tableau = tableauIdx;
  d.draggable = true;
  d.addEventListener("dragstart", (e) => startDrag(e,card,pileType,i,tableauIdx));
  d.addEventListener("dragend", (e) => endDrag(e));
  if (pileType==="deck") {
    d.addEventListener("click", drawCard);
    d.title = "Draw card";
  }
  return d;
}

// --- Dragging Logic ---
let dragState = null; // {card, fromType, cardIdx, tableauIdx, cards}
function startDrag(e, card, fromType, cardIdx, tableauIdx=null) {
  dragState = {card, fromType, cardIdx, tableauIdx};
  if (fromType==="tableau" && tableauIdx != null) {
    dragState.cards = tableau[tableauIdx].slice(cardIdx);
  } else if (fromType==="waste") {
    dragState.cards = [waste[waste.length-1]];
  }
  e.dataTransfer.effectAllowed = "move";
  setTimeout(()=>{ e.target.classList.add("dragging"); },0);
}
function endDrag(e) {
  document.querySelectorAll(".pile.drop-target").forEach(el=>el.classList.remove("drop-target"));
  document.querySelectorAll(".card.dragging").forEach(el=>el.classList.remove("dragging"));
  dragState = null;
}

function dragOverPile(e, el) {
  e.preventDefault();
  el.classList.add("drop-target");
}

function dropOnFoundation(e,i) {
  e.preventDefault();
  if (!dragState || dragState.cards.length !== 1) return;
  let card = dragState.cards[0];
  if (canMoveToFoundation(card, i)) {
    moveCardToFoundation(card, dragState);
    render();
    checkWin();
  }
}
function dropOnTableau(e, t) {
  e.preventDefault();
  if (!dragState) return;
  const cards = dragState.cards;
  if (canMoveToTableau(tableau[t], cards[0])) {
    if (dragState.fromType==="tableau") {
      tableau[t].push(...cards);
      tableau[dragState.tableauIdx].splice(dragState.cardIdx, cards.length);
      flipLast(dragState.tableauIdx);
    } else if (dragState.fromType==="waste") {
      tableau[t].push(waste.pop());
    }
    render();
    checkWin();
  }
}

function drawCard() {
  if (!deck.length) return;
  let card = deck.pop();
  card.faceUp = true;
  waste.push(card);
  render();
}

// --- Move validation ---
function canMoveToFoundation(card, fidx) {
  let pile = foundations[fidx];
  if (!card.faceUp) return false;
  if (!pile.length) return card.rank === "A";
  let top = pile[pile.length-1];
  return card.suit===top.suit && ranks.indexOf(card.rank)===ranks.indexOf(top.rank)+1;
}
function canMoveToTableau(pile, card) {
  if (!card.faceUp) return false;
  if (!pile.length) return card.rank === "K";
  let top = pile[pile.length-1];
  return top.faceUp && top.color!==card.color && ranks.indexOf(card.rank)===ranks.indexOf(top.rank)-1;
}
function moveCardToFoundation(card, dragState) {
  foundations[dragState.card.suitIdx].push(card);
  if (dragState.fromType==="waste") waste.pop();
  else if (dragState.fromType==="tableau") {
    tableau[dragState.tableauIdx].pop();
    flipLast(dragState.tableauIdx);
  }
}

// --- Flip last card in tableau face up if needed ---
function flipLast(idx) {
  let pile = tableau[idx];
  if (pile.length && !pile[pile.length-1].faceUp)
    pile[pile.length-1].faceUp = true;
}

// --- WIN! ---
function checkWin() {
  if (foundations.every(pile=>pile.length===13)) {
    document.getElementById("win-msg").textContent = "✨ You won Space Solitaire! ✨";
  }
}

// INIT!
window.onload = restartGame;