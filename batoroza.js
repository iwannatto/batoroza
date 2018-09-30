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

// 旧コード
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

class Card {
  /** @param {number} id 0~74のカードid */
  constructor(id) {
    /** @const {number} */
    this.id = id;
    /** @const {number} */
    this.n = id%15;
    /** @const {number} */
    this.color = Math.floor(id/15);
  }

  /** @return {boolean} */
  isEight() {
    return this.n === 7;
  }

  /**
  * "red7"のような形式の文字列を返す。数字は1~15。
  * @return {string}
  */
  toString() {
    let colorStrings = ["r", "b", "y", "g", "o"];
    return `${colorStrings[this.color]}${this.n + 1}`;
  }
}

/**
* 数字を比較してcard2が大きければtrue。決まらなければ色番号を比較。
* @param {!Card} card1
* @param {!Card} card2
* @return {boolean}
*/
function cardCompare(card1, card2) {
  if (card1.n !== card2.n) { return card1.n < card2.n; }
  return card1.color < card2.color;
}

/**
* カード配列[0, ..., 74]をシャッフルしたものを返す
* @return {!Array<Card>}
*/
function deckInit() {
  // カード配列[0, ..., 74]を用意
  let deck = Array.from({length: 75}, (v,k) => new Card(k));

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

/**
* プレイヤー4人にカードを10枚づつ配る
* @return {Array<Array<Card>>}
*/
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

// validPlays
// |         |===1          |<=3        |otherwise|
// |:--------|:-------------|:----------|:--------|
// |null     |without 8, rev|without rev|anything |
// |8        |nothing       |only 8     |only 8   |
// |otherwise|without 8, rev|without rev|upper    |
/**
* @param {number} playerid
* @return {Array<!Card|Array<number>|string>}
*/
function validPlaysGenerate(playerid) {
  const hand = hands[playerid];
  /** @type {Array<Card>} */
  let validPlays = hand.slice(); // コピー

  // 8上がり禁止
  if (hand.length === 1) {
    validPlays = validPlays.filter(card => !card.isEight());
  }
  // 革命上がり禁止のため、4枚以上のときのみ革命が可能になる
  if (hand.length >= 4) {
    validPlays = [...validPlays, ...validPlaysRevolutions(validPlays)];
  }

  const pass = "pass";
  if (field.lastCard === null) {
    // フィールドが無なら何でも出せるがパスはできない
    return [...validPlays];
  } else if (field.lastCard.isEight()) {
    // 8切りに対しては8しか出せない
    return [...validPlays.filter(validPlaysCardEight), pass];
  } else {
    // フィールドより大きい数字（と革命）
    return [...validPlays.filter(validPlaysLarger), pass];
  }
}

/**
* @param {Array<!Card>} validPlays
* @return {Array<Array<number>>}
*/
function validPlaysRevolutions(validPlays) {
  let revolutions = [];
  for (let n = 0; n < 15; ++n) {
    // 8は革命できない
    if (n === 7) { continue; }

    let nCards = validPlays.filter(card => card.n === n);

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

/**
* カードであり、なおかつ8であるならtrue
* @param {!Card|Array<number>} play
* @return {boolean}
*/
function validPlaysCardEight(play) {
  return (play instanceof Card) && play.isEight();
}

/**
* 革命ならtrue
* カードであり、フィールドと同色でなくかつ革命考慮した上で数字が大きいならtrue
* @param {!Card|Array<number>} play
* @return {boolean}
*/
function validPlaysLarger(play) {
  // 呼び出され方的に、lastCardはnullでないCard
  let lastCard = field.lastCard;
  let underRevolution = field.underRevolution;

  // 革命なのでtrue
  if (Array.isArray(play)) { return true; }

  // 革命でないので、以下playはCard

  if (play.color === lastCard.color) { return false; }

  if (underRevolution) {
    return play.n < lastCard.n;
  } else {
    return play.n > lastCard.n;
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
    hands[playerid] = hand.filter(card => card.id !== play.id);
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

function isHuman(playerid) {
  return human.includes(playerid);
}

function playToStr(play) {
  if (play instanceof Card) {
    return play.toString();
  } else if (Array.isArray(play)) {
    return play.map(card => card.toString()).join(", ");
  } else if (play === "pass") {
    return play;
  }
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

function drawPhaseExecuteHuman(willDraw) {
  let playerid = field.currentPlayerid;
  let drawable = field.currentDrawable;

  if (willDraw) {
    hands[playerid].push(fieldDeckDraw());
    handsSortHand(hands[playerid]);
  }
}

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
  } else if (Array.isArray(play) ||
             ((oldLastCard instanceof Card) && oldLastCard.isEight())) {
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
  } else if (oldLastCard !== null && oldLastCard.isEight() && play.isEight()) {
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
  deck:            deckInit(),
  di:              0,
  /** @type {?Card} */
  lastCard:        null,
  lastPlayerid:    null,
  underRevolution: false,
  currentPlayerid: 0,
  currentDrawable: false,
};

let hands = handsInit();

let human = [0];

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

let intervalId = setInterval(gameManager, 100); // 100ms間隔
