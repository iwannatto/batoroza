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

// nextPlayerRotate
function nextPlayerRotate(playerid) {
  return (playerid+1) % 4;
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
  * @param {!Play} play
  * @return {boolean}
  */
  inPlay(play) {
    if (play.isCard()) {
      return this.id === play.cardId();
    } else if (play.isRevolution()) {
      let revolution = play.revolution();
      for (let i = 0; i < revolution.length; ++i) {
        if (this.id === revolution[i].id) { return true; }
      }
      return false;
    } else {
      throw new Error("Card inPlay");
    }
  }
}

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

// play
/** @enum {number} */
const PlayType = {
  CARD: 0,
  REVOLUTION: 1,
  PASS: 2,
};

class Play {
  /**
  * @param {PlayType} playType
  * @param {!Card|Array<!Card>} arg
  */
  constructor(playType, arg) {
    /** @const @private {PlayType} */
    this.type_ = playType;
    switch (playType) {
      case PlayType.CARD:
        /** @const {!Card} */
        this.card_ = arg;
        break;
      case PlayType.REVOLUTION:
        /** @const {Array<!Card>} */
        this.revolution_ = arg;
        break;
      case PlayType.PASS:
        break;
      default:
        throw new Error("Play constructor");
    }
  }

  /** @return {boolean} */
  isCard() {
    return this.type_ === PlayType.CARD;
  }

  /** @return {number} */
  cardId() {
    if (!this.isCard()) { throw new Error("Play cardId"); }
    return this.card_.id;
  }

  /** @return {!Card} */
  card() {
    if (!this.isCard()) { throw new Error("Play card"); }
    return this.card_;
  }

  /** @return {boolean} */
  isEight() {
    return this.isCard() && this.card_.isEight();
  }

  /** @return {boolean} */
  isRevolution() {
    return this.type_ === PlayType.REVOLUTION;
  }

  /** @return {Array<!Card>} */
  revolution() {
    if (!this.isRevolution()) { throw new Error("Play revolution"); }
    return this.revolution_;
  }

  /** @return {boolean} */
  isPass() {
    return this.type_ === PlayType.PASS;
  }

  /** @return {boolean} */
  isValidToField() {
    // 想定外
    if (this.isPass() || field.lastCard === null) {
      throw new Error("Play isValidToField");
    }

    // 革命は何に対しても出せる
    if (this.isRevolution()) { return true; }

    let card = this.card_;
    let lastCard = field.lastCard;
    let underRevolution = field.underRevolution;

    // 同色ならfalse
    if (card.color === lastCard.color) { return false; }

    // 数の大小比較
    if (underRevolution) {
      return card.n < lastCard.n;
    } else {
      return card.n > lastCard.n;
    }
  }

  /** @return {string} */
  toString() {
    if (this.isCard()) {
      return this.card_.toString();
    } else if (this.isRevolution()) {
      return this.revolution_.map(card => card.toString()).join(", ");
    } else if (this.isPass()) {
      return "pass";
    } else {
      console.log("Play toString");
      return ""
    }
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
    /** @type {Array<Play>} */
    this.validPlays = [];
  }

  // デッキからカードを引く
  draw() {
    this.hand_.push(field.deck.draw());
    this.sortHand_();
  }

  // hand_から合法手を生成し、this.validPlaysに反映
  generateValidPlays() {
    const pass = new Play(PlayType.PASS);

    // 8上がり禁止
    // 残り1枚で8しか持っていなかったら出せない
    if (this.hand_.length === 1 && this.hand_[0].isEight()) {
      // フィールドが無ならパスさえできない
      this.validPlays = (field.lastCard === null) ? [] : [pass];
      return;
    }

    // handのCardを全部追加
    let validCards = this.hand_.map(card => new Play(PlayType.CARD, card));

    // 革命上がり禁止
    // 手札が4枚以上のときのみ革命が可能とする
    // この時点で{Array<!Card|Array<!Card>>}
    let validCardsRevolutions;
    if (this.hand_.length >= 4) {
      let revolutions = extractRevolutions(this.hand_);
      validCardsRevolutions = [...validCards, ...revolutions];
    } else {
      validCardsRevolutions = validCards;
    }

    // フィールドに応じて分岐
    if (field.lastCard === null) {
      // フィールドが無なら何でも出せるがパスはできない
      this.validPlays = validCardsRevolutions;
    } else if (field.lastCard.isEight()) {
      // 8切りに対しては8しか出せない
      this.validPlays = [
        ...validCardsRevolutions.filter(play => play.isEight()),
        pass,
      ];
    } else {
      // 革命と、フィールドより大きい数字(革命考慮)
      this.validPlays = [
        ...validCardsRevolutions.filter(play => play.isValidToField()),
        pass,
      ];
    }
  }

  /**
  * playのカードを捨て、それをthis.hand_に反映
  * TODO:勝ちの処理がこの中にあるが、攻撃を導入するとおかしくなるのでそしたら修正
  * @param {!Card|Array<!Card>|string} play
  */
  discard(play) {
    // 捨てる処理
    if (play.isCard() || play.isRevolution()) {
      // playに含まれないもののみを残すことで捨てる処理を行う
      this.hand_ = this.hand_.filter(card => !card.inPlay(play));
    } else {
      // playがpassなら何もしない
      ;
    }

    log.push(`${this.id} ${play} | ${this.hand_}`);

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
* @param {Array<!Card>} hand
* @return {Array<!Play>}
*/
function extractRevolutions(hand) {
  let revolutions = [];
  for (let n = 0; n < 15; ++n) {
    // 8は革命できない
    if (n === 7) { continue; }

    let nCards = hand.filter(card => card.n === n);

    // 3つ組を全列挙して革命リストに追加
    for (let i = 0; i < nCards.length-2; ++i) {
      for (let j = i+1; j < nCards.length-1; ++j) {
        for (let k = j+1; k < nCards.length; ++k) {
          let revolution =
              new Play(PlayType.REVOLUTION, [nCards[i], nCards[j], nCards[k]]);
          revolutions.push(revolution);
        }
      }
    }
  }
  return revolutions;
}

// TODO:ここから下をきれいにする

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


// discardPhase
function discardPhaseExecuteComputer(playerid) {
  let player = players[playerid];
  let validPlays = player.validPlays;

  // パスすらできないときの処理
  // TODO:こうならないようにする（できる）
  if (validPlays.length === 0) {
    clearInterval(intervalId);
    throw new Error("can't do anything");
  }

  // 捨てる手をランダムで決定
  const play = validPlays[Math.floor(Math.random() * validPlays.length)];

  // 捨てる
  player.discard(play);

  // フィールド退避
  const oldLastCard = field.lastCard;
  const oldLastPlayerid = field.lastPlayerid;

  // フィールドの更新
  if (play.isPass()) {
    // パスのとき
    // 1巡するならフィールドリセット、そうでないなら何もしない
    if (oldLastPlayerid === nextPlayerRotate(playerid)) {
      field.lastCard = null;
      field.lastPlayerid = null;
    }
  } else if (play.isRevolution() ||
             (play.isEight() && oldLastCard && oldLastCard.isEight())) {
    // 革命もしくは8切り返しならフィールドリセット
    field.lastCard = null;
    field.lastPlayerid = null;
  } else {
    // その他は普通に更新
    field.lastCard = play.card();
    field.lastPlayerid = playerid;
  }

  // 次プレイヤーの決定
  let nextPlayerid = null;
  if (play.isEight() && oldLastCard && oldLastCard.isEight()) {
    // 8切り返しのときのみプレイヤー変わらず
    nextPlayerid = playerid;
  } else {
    // TODO:人数ハードコーディングはよくない
    nextPlayerid = (playerid+1) % 4;
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
