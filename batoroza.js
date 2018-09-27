// 構造
// 山札と場を合わせて「Field」
// 各プレイヤーを「Player」とする
// 進行をするのは「Game」
// Field←→Game←→Playerの図式を守る
// PlayerにFieldを直接渡すこともあるが、変更はしない。

// 分け方が微妙だった気がしてきたなあ
// 選択(引くか引かないか)
// 合法手生成(field, hand)
// 選択
// 進行
// のループでいいんじゃないか
// プレイヤー待ちを入れることを考えると、基本は
// それぞれが次をトリガーするという形でいいんじゃないかと思う
// そうするとgameクラスの必要性がだいぶ微妙になってくるけど

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
    // フィールドが無なら何でも出せる
    return [...validPlays, pass]; // TODO: returnなわけない
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
  let hand = hands[playerid];

  if (play === "pass") {
    ;
  } else if (Array.isArray(play)) {
    // playが革命だった場合、handを革命に現れないカードのみにする
    const revolution = play;
    hand = hand.filter(card => !discardIsIncluded(card, revolution));
  } else {
    // playがcardだった場合、handからplayを除く
    hand = hand.filter(card => card !== play);
  }

  if (hand.length === 0) { throw new Error("win"); }
}

function discardIsIncluded(element, array) {
  return array.indexOf(element) !== -1;
}

// nextPlayerRotate
function nextPlayerRotate(playerid) {
  return (playerid+1) % 4;
}

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
  let validPlays = validPlaysGenerate(playerid);

  // フェーズ移行
  discardPhaseExecuteComputer(playerid, validPlays);
}

// function drawPhaseExecutePlayerTrue(playerid) {}
// function drawPhaseExecutePlayerFalse(playerid) {}


// discardPhase
function discardPhaseExecuteComputer(playerid, validPlays) {
  // 捨てる手をランダムで決定
  const play = validPlays[Math.floor(Math.random() * validPlays.length)];

  // 捨てる
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
  drawPhaseExecuteComputer(nextPlayerid, drawable);
}

let field = {
  deck:            fieldDeckInit(),
  di:              0,
  lastCard:        null,
  lastPlayerid:    null,
  underRevolution: false,
};

let hands = handsInit();

drawPhaseExecuteComputer(0, false);

// 旧コード

// util
function shuffle(array) {
  for (let i = array.length-1; i > 0; i--) {
    let r = Math.floor(Math.random() * (i+1));
    let tmp = array[i];
    array[i] = array[r];
    array[r] = tmp;
  }
  return array;
}

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
  if (cardNum(card1) !== cardNum(card2)) {
    return cardNum(card1) - cardNum(card2);
  } else {
    return cardColor(card1) - cardColor(card2);
  }
}

function extractThrees(array) {
  let res = [];
  for (let i = 0; i < array.length-2; ++i) {
    for (let j = i+1; j < array.length-1; ++j) {
      for (let k = j+1; k < array.length; ++k) {
        res.push([array[i], array[j], array[k]]);
      }
    }
  }
  return res;
}

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


// Field
class Field {
  constructor() {
    this.deck = shuffle(Array.from({length: 75}, (v,k) => k));
    this.di = 0;
    this.card = null;
    // XXX*playerNoとかのがいいかも
    this.player = null;
    this.revolution = false;
  }

  // TODO:エラーハンドリング
  draw() {
    if (this.di+1 === 75) { throw new Error("deckOut"); }
    return this.deck[this.di++];
  }

  // TODO:drawNの用意
}

// Player
// Human
// Computer

class Player {
  constructor(array) {
    this.hand = array;
    this.hand.sort(cardCompare);
  }

  add(array) {
    this.hand = this.hand.concat(array);
    this.hand.sort(cardCompare);
  }

  // TODO:エラーハンドリング
  // TODO:最後ターン攻撃に対応
  // XXX:ないやつを指定しても成功してしまう
  remove(array) {
    this.hand = this.hand.filter(i => array.indexOf(i) === -1);
    this.hand.sort(cardCompare);
    if (this.hand.length === 0) { throw new Error("win"); }
  }

  // TODO:8上がりと革命上がり禁止を実装
  // 革命とパス含めた出せる手を配列にして返す
  validPlays(field) {
    if (field.card === null) {
      return [...this.hand, ...this.revolutions(), "pass"];
    } else if (cardNum(field.card) === 7) {
      return [...this.hand.filter(i => cardNum(i) === 7), "pass"];
    } else if (typeof field.card === "number") {
      return [
        ...this.hand.filter(i =>
          cardColor(i) !== cardColor(field.card) &&
          (field.revolution ? cardNum(i) < cardNum(field.card)
                            : cardNum(i) > cardNum(field.card))),
        ...this.revolutions(),
        "pass"];
    } else {
      throw new Error("strange");
    }
  }

  // 革命の配列を返す
  revolutions() {
    let rev = [];
    for (let i = 0; i < 15; ++i) {
      if (i == 7) { continue; }
      let iCards = this.hand.filter(j => cardNum(j) === cardNum(i));
      if (iCards.length >= 3) { rev = [...rev, ...extractThrees(iCards)]; }
    }
    return rev;
  }
}

class Computer extends Player {
  constructor(n, field) { super(n, field); }

  // 引くかどうか、true/false
  play1(field) {
    // ランダム(1/10)で引く
    return (Math.floor(Math.random() * 10) < 1) ? true : false;
  }

  // 出す、数字/配列（革命）/"pass"（パス）
  play2(field) {
    let validPlays = this.validPlays(field);
    // ランダムで出す
    return validPlays[Math.floor(Math.random() * validPlays.length)];
  }
}

// Game

class Game {
  constructor() {
    this.field = new Field();
    this.players = [];
    // TODO:drawNで書き換える
    for (let i = 0; i < 4; ++i) {
      let a = [];
      for (let j = 0; j < 10; ++j) { a.push(this.field.draw()); }
      this.players.push(new Computer(a));
    }
  }

  // 返り値は次のplayerNo
  playComputer(i) {
    let field = this.field;
    let player = this.players[i];

    if (field.player === i) {
      field.card = null;
      field.player = null;
    }

    if (field.card !== null || cardNum(field.card) !== 7) {
      let draw = player.play1(field);
      if (draw) { player.add(field.draw()); }
    }

    let card = field.card;
    let play = player.play2(field);
    console.log(playToStr(play));
    if (typeof play === "number") {
      // 8に8を出したら即流れる
      if (cardNum(card) === 7) {
        player.remove([play]);
        field.card = null;
        field.player = null;
        return i;
      } else {
        player.remove([play]);
        field.card = play;
        field.player = i;
        return (i+1)%4;
      }
    } else if (Array.isArray(play)) {
      player.remove(play);
      field.card = null;
      field.player = null;
      field.revolution = !field.revolution;
      return (i+1)%4;
    } else if (play === "pass") {
      return (i+1)%4;
    }
  }
}

var g = new Game();
var next = 0;

var vm = new Vue({
  el: '#vm',
  data: {
    game: g
  }
});

while (true) {
  console.log(next);
  next = g.playComputer(next);
}
