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


// ここから本コード

// utility
/**
* @param {Array<*>} array
* @return {Array<*>}
*/
function shuffle(array) {
  for (let i = array.length-1; i > 0; i--) {
    let r = Math.floor(Math.random() * (i+1));
    let tmp = array[i];
    array[i] = array[r];
    array[r] = tmp;
  }
  return array;
}

// Card
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

  /**
  * @param {Array<!Card>} revolution
  * @return {boolean}
  */
  inRevolution(revolution) {
    for (let i = 0; i < revolution.length; ++i) {
      if (this.id === revolution[i].id) { return true; }
    }
    return false;
  }
}

/**
* 数字を比較してcard2が大きければtrue。決まらなければ色番号を比較。
* @param {!Card} card1
* @param {!Card} card2
* @return {boolean}
*/

// Deck
class Deck {
  constructor() {
    /**
    * カード配列[0, ..., 74]をシャッフルしたもの
    * @private @const {Array<!Card>}
    */
    this.cards_ = shuffle(Array.from({length: 75}, (v, k) => new Card(k)));
    /** @private {number} */
    this.topi_ = 0;
  }

  /**
  * 引いたらデッキが0枚になってしまうならtrue
  * @return {boolean}
  */
  willOut() {
    return this.topi_ === 74;
  }

  /** @return {!Card} */
  draw() {
    // TODO:エラーを使わない制御に書き直すといいかも
    if (this.willOut()) { throw new Error("deck out"); }

    return this.cards_[this.topi_++];
  }
}

// Player
class Player {
  constructor(playerid) {
    /** @const {number} */
    this.id = playerid;
    /** @private {Array<Card>} */
    this.hand_ = Array.from({length: 10}, (v, k) => field.deck.draw());
    this.sortHand_();
    /** @type {Array<Card|Array<number>|string>} */
    this.validPlays = [];
  }

  // デッキからカードを引く
  draw() {
    this.hand_.push(field.deck.draw());
    this.sortHand_();
  }

  // hand_から合法手を生成し、this.validPlaysに反映
  generateValidPlays() {
    const pass = "pass";

    // 8上がり禁止
    // 残り1枚で8しか持っていなかったら出せない
    if (this.hand_.length === 1 && this.hand_[0].isEight()) {
      // フィールドが無ならパスさえできない
      this.validPlays = (field.lastCard === null) ? [] : [pass];
      return;
    }

    // handをコピー、この時点では{Array<!Card>}
    let validPlays = this.hand_.slice();

    // 革命上がり禁止
    // 手札が4枚以上のときのみ革命が可能とする
    // この時点で{Array<!Card|Array<!Card>>}
    if (this.hand_.length >= 4) {
      validPlays = [...validPlays, ...validPlaysRevolutions(validPlays)];
    }

    // フィールドに応じて分岐
    if (field.lastCard === null) {
      // フィールドが無なら何でも出せるがパスはできない
      this.validPlays = validPlays;
    } else if (field.lastCard.isEight()) {
      // 8切りに対しては8しか出せない
      this.validPlays = [...validPlays.filter(validPlaysCardEight), pass];
    } else {
      // フィールドより大きい数字（と革命）
      this.validPlays = [...validPlays.filter(validPlaysLarger), pass];
    }
  }

  /**
  * playのカードを捨て、それをthis.hand_に反映
  * TODO:勝ちの処理がこの中にあるが、攻撃を導入するとおかしくなるのでそしたら修正
  * @param {!Card|Array<!Card>|string} play
  */
  discard(play) {
    // 捨てる処理
    if (play instanceof Card) {
      // playがcardだった場合、handにplay以外のものを残すことで捨てる
      this.hand_ = this.hand_.filter(card => card.id !== play.id);
    } else if (Array.isArray(play)) {
      // playが革命だった場合、handにplayに含まれないもののみを残すことで捨てる
      this.hand_ = this.hand_.filter(card => !card.inRevolution(play));
    } else {
      // playがpassなら何もしないで終了
      return;
    }

    // 勝ちの処理
    if (this.hand_.length === 0) {
      log.push(`player ${this.id} win`);
      clearInterval(intervalId);
    }
  }

  // 数字昇順ソート（数字が同じなら色番号昇順）
  sortHand_() {
    let cardCompare = function(card1, card2) {
      if (card1.n !== card2.n) { return card1.n > card2.n; }
      return card1.color > card2.color;
    }
    this.hand_.sort(cardCompare);
  }
}

/**
* @param {Array<!Card>} validPlays
* @return {Array<Array<!Card>>}
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

// ここからfix


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
  let player = players[playerid];

  // 引く処理
  if (drawable) {
    // 引くかどうかをランダム(1/10)で決定
    let willDraw = (Math.floor(Math.random() * 10) < 1) ? true : false;

    // 引く処理の実行
    // デッキアウトの例外処理がめんどいのでデッキアウトになるなら引かない
    if (willDraw && !field.deck.willOut()) {
      player.draw();
    }
  }

  // 合法手生成
  player.generateValidPlays();
}

// function drawPhaseExecuteHuman(willDraw) {
//   let playerid = field.currentPlayerid;
//   let drawable = field.currentDrawable;
//
//   if (willDraw) {
//     hands[playerid].push(field.deck.draw());
//     handsSortHand(hands[playerid]);
//   }
// }

// discardPhase
function discardPhaseExecuteComputer(playerid) {
  let player = players[playerid];
  let validPlays = player.validPlays;

  if (validPlays.length === 0) {
    clearInterval(intervalId);
    throw new Error("can't do anything");
  }

  // 捨てる手をランダムで決定
  const play = validPlays[Math.floor(Math.random() * validPlays.length)];

  // 捨てる
  log.push(`${playerid} ${playToStr(play)}`);
  player.discard(play);

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

  drawPhaseExecuteComputer(playerid, drawable);
  let nextPlayeridAndDrawable = discardPhaseExecuteComputer(playerid);
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
  deck:            new Deck(),
  /** @type {?Card} */
  lastCard:        null,
  lastPlayerid:    null,
  underRevolution: false,
  currentPlayerid: 0,
  currentDrawable: false,
};

// TODO:グローバルっぽい名前つける
let players = Array.from({length: 4}, (v, k) => new Player(k));

let human = [0];

let log = [];

let vm = new Vue({
  el: "#vm",
  data: {
    field,
    players,
    log,
    validPlays: [],
    drawButtonActive: true,
  },
  methods: {
    voidFunc: function() { console.log("void"); },
  },
});

let intervalId = setInterval(gameManager, 100); // 100ms間隔
