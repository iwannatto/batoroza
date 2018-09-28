// 全体の構造
// gameManagerがいて、一定時間(0.1sとか)ごとに起きる
// computerのターンなら進行、playerのターンなら待機
// player待ちは入力が2段階あることになるので、
// 待っている方の関数のみをactivateしておく。
// 両方の関数が動いたらターンを進める処理により進行する。


// drawPhase
//   drawableをもとに引くか引かないか選択
//   引く処理
//   validPlays生成
// discardPhase
//   validPlaysをもとにplayを選択
//   捨てる処理
//   進行、nextPlayeridとdrawable決定
//
// をループする

// field
// [0, ..., 74]をシャッフルしたものを返す
function fieldDeckInit() {
  // [0, ..., 74]を用意
  let deck = Array.from({length: 75}, (v,k) => k);

  // シャッフル
  for (let i = deck.length-1; i > 0; i--) {
    let r = Math.floor(Math.random() * (i+1));
    let tmp = deck[i];
    deck[i] = deck[r];
    deck[r] = tmp;
  }

  return deck;
}

function fieldDeckDrawable() {
  return field.di < 74;
}

// 山札切れになった瞬間ゲーム終了処理に移行なので、そのように書き直す
function fieldDeckDraw() {
  if (!fieldDeckDrawable()) { throw new Error("deck out"); }
  return field.deck[field.di++];
}

// hands
// プレイヤー4人に10枚づつ配る
function handsInit() {
  let hands = [[], [], [], []];
  for (let i = 0; i < 4; ++i) {
    for (let j = 0; j < 10; ++j) { hands[i].push(fieldDeckDraw()); }
    handsSortHand(hands[i]);
  }
  return hands;
}

function handsSortHand(hand) {
  hand.sort(cardCompare);
}

// card
function cardNum(card, toStr=false) {
  if (toStr) { return (card%15 + 1).toString(); }
  return card%15;
}

function cardColor(card, toStr=false) {
  let color = Math.floor(card/15);
  if (toStr) { return ["r", "b", "y", "g", "o"][color]; }
  return color;
}

function cardCompare(card1, card2) {
  let numDif = cardNum(card1) - cardNum(card2);
  if (numDif !== 0) { return numDif; }
  return cardColor(card1) - cardColor(card2);
}

function cardIsEight(card) {
  return cardNum(card) === 7;
}

// validPlays
// |         |===1          |<=3        |otherwise|
// |:--------|:-------------|:----------|:--------|
// |null     |without 8, rev|without rev|anything |
// |8        |nothing       |only 8     |only 8   |
// |otherwise|without 8, rev|without rev|upper    |
function validPlaysGenerate(playerid) {
  const hand = hands[playerid];
  let validPlays = hand.slice(); // コピー

  // 8上がり禁止
  if (hand.length === 1) {
    validPlays = validPlays.filter(card => !cardIsEight(card));
  }
  // 革命上がり禁止のため、4枚以上のときのみ革命が可能になる
  if (hand.length >= 4) {
    validPlays = [...validPlays, ...validPlaysRevolutions(validPlays)];
  }

  const pass = "pass";
  if (field.lastCard === null) {
    // フィールドが無なら何でも出せるがパスはできない
    return [...validPlays];
  } else if (cardIsEight(field.lastCard)) {
    // 8切りに対しては8しか出せない
    return [...validPlays.filter(validPlaysCardEight), pass];
  } else {
    // フィールドより大きい数字（と革命）
    return [...validPlays.filter(validPlaysLarger), pass];
  }
}

function validPlaysRevolutions(validPlays) {
  let revolutions = [];
  for (let n = 0; n < 15; ++n) {
    // 8は革命できない
    if (cardIsEight(n)) { continue; }

    let nCards = validPlays.filter(card => cardNum(card) === n);

    // 3つ組を全列挙して革命リストに追加
    if (nCards.length >= 3) {
      for (let i = 0; i < nCards.length-2; ++i) {
        for (let j = i; j < nCards.length-1; ++j) {
          for (let k = j; k < nCards.length; ++k) {
            revolutions.push([nCards[i], nCards[j], nCards[k]]);
          }
        }
      }
    }
  }
  return revolutions;
}

// カードであり、なおかつ8であるならtrue
function validPlaysCardEight(play) {
  return (typeof play === "number") && cardIsEight(play);
}

// 革命であるか、カードでありフィールドと同色でなくかつ数字が<u>大きい</u>(革命考慮)
function validPlaysLarger(play, lastCard, underRevolution) {
  // playが革命なら常に出せるのでtrue
  if (Array.isArray(play)) { return true; }

  const playCard = play;
  if (cardColor(playCard) === cardColor(lastCard)) { return false; }

  if (underRevolution) {
    return cardNum(playCard) < cardNum(lastCard);
  } else {
    return cardNum(playCard) > cardNum(lastCard);
  }
}

// discard
function discard(playerid, play) {
  let hand = hands[playerid].slice(); // コピー

  if (play === "pass") {
    ;
  } else if (Array.isArray(play)) {
    // playが革命だった場合、handを革命に現れないカードのみにする
    const revolution = play;
    hands[playerid] = hand.filter(card => !discardIsIncluded(card, revolution));
  } else {
    // playがcardだった場合、handからplayを除く
    hands[playerid] = hand.filter(card => card !== play);
  }

  // 勝ちの処理
  if (hands[playerid].length === 0) {
    log.push(playerid.toString() + " win");
    clearInterval(intervalId);
  }
}

function discardIsIncluded(element, array) {
  return array.indexOf(element) !== -1;
}

// nextPlayerRotate
function nextPlayerRotate(playerid) {
  return (playerid+1) % 4;
}

// phase functions

// drawPhase
function drawPhaseExecuteComputer(playerid, drawable) {
  if (drawable) {
    // 引くかどうかをランダム(1/10)で決定
    let willDraw = (Math.floor(Math.random() * 10) < 1) ? true : false;

    // 引く処理の実行
    if (willDraw && fieldDeckDrawable()) {
      hands[playerid].push(fieldDeckDraw());
      handsSortHand(hands[playerid]);
    }
  }

  // 合法手生成
  return validPlaysGenerate(playerid);
}

// function drawPhaseExecutePlayerTrue(playerid) {}
// function drawPhaseExecutePlayerFalse(playerid) {}

// discardPhase
function discardPhaseExecuteComputer(playerid, validPlays) {
  if (validPlays.length === 0) { throw new Error("can't do anything"); }

  // 捨てる手をランダムで決定
  const play = validPlays[Math.floor(Math.random() * validPlays.length)];

  // 捨てる
  log.push(playerid.toString() + " " + playToStr(play));
  discard(playerid, play);

  // フィールドの更新
  const oldLastCard = field.lastCard;
  const oldLastPlayerid = field.lastPlayerid;
  if (play === "pass") {
    // パスのとき
    // 1巡するならフィールドリセット
    // そうでないなら更新しない
    if (oldLastPlayerid === nextPlayerRotate(playerid)) {
      field.lastCard = null;
      field.lastPlayerid = null;
    }
  } else if (Array.isArray(play) || (cardIsEight(oldLastCard))) {
    // 革命もしくは8切り返しならフィールドリセット
    field.lastCard = null;
    field.lastPlayerid = null;
  } else {
    // その他は普通に更新
    field.lastCard = play;
    field.lastPlayerid = playerid;
  }

  // 次プレイヤーの決定
  let nextPlayerid = null;
  if (play === "pass" || Array.isArray(play)) {
    nextPlayerid = nextPlayerRotate(playerid);
  } else if (cardIsEight(oldLastCard) && cardIsEight(play)) {
    // 8切り返しのときのみプレイヤー変わらず
    nextPlayerid = playerid;
  } else {
    nextPlayerid = nextPlayerRotate(playerid);
  }

  // drawableの決定
  let drawable = (field.lastCard === null);

  // フェーズ移行
  return {nextPlayerid: nextPlayerid, drawable: drawable};
}

// gameManager
function gameManager() {
  let playerid = field.currentPlayerid;
  let drawable = field.currentDrawable;
  let validPlays = drawPhaseExecuteComputer(playerid, drawable);
  let nextPlayeridAndDrawable = discardPhaseExecuteComputer(playerid, validPlays);
  field.currentPlayerid = nextPlayeridAndDrawable.nextPlayerid;
  field.currentDrawable = nextPlayeridAndDrawable.drawable;
}

// vm
function drawButtonActivate() {
  vm.drawButtonActive = true;
}

function drawButtonInactivate() {
  vm.drawButtonActive = false;
}

// main

let field = {
  deck:            fieldDeckInit(),
  di:              0,
  lastCard:        null,
  lastPlayerid:    null,
  underRevolution: false,
  currentPlayerid: 0,
  currentDrawable: false,
};

let hands = handsInit();

let log = [];

let vm = new Vue({
  el: "#vm",
  data: {
    field: field,
    hands: hands,
    log: log,
    validPlays: [],
    drawButtonActive: true,
  },
  methods: {
    voidFunc: function() { console.log("void"); },
  },
});


function voidFunc() {}

let intervalId = setInterval(gameManager, 100); // 100ms間隔

// 旧コード

function playToStr(play) {
  if (typeof play === "number") {
    return cardColor(play, true) + cardNum(play, true);
  } else if (Array.isArray(play)) {
    return play.map(i => cardColor(i, true) + cardNum(i, true)).join();
  } else if (play === "pass") {
    return play;
  }
}

// TODO:全部変える
function attackable(play) {
  if (field === null) { return false; }
  let a = Math.floor(field/15);
  let b = Math.floor(play/15);
  if (a+1 === b) {
    return (a === 0) || (a === 2);
  } else if (a-1 === b) {
    return (a === 1) || (a === 3);
  }
}

// TODO:全部変える
function attack(play, i) {
  if (!attackable(play)) { return; }
  let a = field%15;
  let b = play%15;
  let n = Math.floor(Math.abs(a-b) / 3);
  if (n > 0) {
    for (let i = 0; i < n; ++i) { hands[last].push(draw()); }
    appendToShow(n, "attack from", i, "to", last);
  }
}
