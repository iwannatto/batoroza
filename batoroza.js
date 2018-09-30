// 全体の構造
// playerに対してdrawPhaseとdiscardPhaseをすることでターン進行
// discardPhaseの最後でplayer更新
// computerTurnが一定時間(0.1s)で起きて、今computerの番ならターンを進行させる
// humanの番ならdrawPhaseとdiscardPhaseはボタンで起動する

// ハードコード集：
// player4人
// humanはplayerid=0の一人だけ
// 初期手札は5枚
// 攻撃あり（３）

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

  /**
  * @param {?Card} card
  * @return {number}
  */
  attackN(fieldCard) {
    if (!this.isCard()) { throw new Error("Play attackN"); }
    let card = this.card_;

    if (fieldCard === null) { return 0; }

    let attackColor = [[0, 1], [1, 0], [2, 3], [3, 2]];
    for (let i = 0; i < attackColor.length; ++i) {
      if (card.color === attackColor[i][0] &&
          fieldCard.color === attackColor[i][1]) {
        let diff = card.n - fieldCard.n;
        if (field.underRevolution) { diff *= -1; }
        return Math.floor(diff/3);
      }
    }

    return 0;
  }
}

// Player
class Player {
  constructor(playerid) {
    /** @const {number} */
    this.id = playerid;
    /** @private {Array<Card>} */
    this.hand_ = Array.from({length: 5}, (v, k) => field.deck.draw());
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

    log.unshift(`${this.id} ${play} | ${this.hand_.length}`);

    // 勝ちの処理
    if (this.hand_.length === 0) {
      log.unshift(`player ${this.id} win`);
      clearInterval(intervalId);
    }
  }

  handString() {
    let s = "";
    for (let i = 0; i < this.hand_.length; ++i) {
      s += `${this.hand_[i]} `;
    }
    return s;
  }

  // hand_を数字昇順ソート（数字が同じなら色番号昇順）
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

// phase
function drawPhase(willDraw) {
  let playerid = field.currentPlayerid;
  let player = players[playerid];

  // TODO:デッキアウトの処理
  if (willDraw) { player.draw(); }

  player.generateValidPlays();

  // パスすらできないときの処理
  // TODO:こうならないようにする（できる）
  if (player.validPlays.length === 0) {
    log.unshift("can't do anything");
    clearInterval(intervalId);
  }

  // TODO:0ハードコーディングはまずいかも
  if (playerid === 0) {
    vm.drawButtonActive = false;
    vm.notDrawButtonActive = false;
    vm.hand = player.handString();
    vm.validPlaysActive = true;
    vm.validPlays = player.validPlays;
  }
}

function discardPhase(play) {
  let playerid = field.currentPlayerid;
  let player = players[playerid];

  // 捨てる
  player.discard(play);
  if (playerid === 0) {
    vm.hand = player.handString();
    vm.validPlaysActive = false;
  }

  // フィールド退避
  const oldLastCard = field.lastCard;
  const oldLastPlayerid = field.lastPlayerid;

  // 攻撃
  // TODO:遅延勝利評価
  if (play.isCard()) {
    let attacked = players[oldLastPlayerid];
    let n = play.attackN(oldLastCard);
    for (let i = 0; i < n; ++i) {
      if (i === 0) {
        log.unshift(`attack ${n} from ${playerid} to ${oldLastPlayerid}`);
      }
      attacked.draw();
      if (i === n-1 && oldLastPlayerid === 0) {
        vm.hand = attacked.handString();
      }
    }
  }

  // 革命の反映
  if (play.isRevolution()) { field.underRevolution = !field.underRevolution; }

  // フィールドの更新
  if (play.isPass()) {
    // パスのとき
    // 1巡するならフィールドリセット、そうでないなら何もしない
    if (oldLastPlayerid === (playerid+1)%4) {
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

  // 次プレイヤーの決定・更新
  if (play.isEight() && oldLastCard && oldLastCard.isEight()) {
    // 8切り返しのときのみプレイヤー変わらず
    field.currentPlayerid = playerid;
  } else {
    // TODO:人数ハードコーディングはよくない
    field.currentPlayerid = (playerid+1) % 4;
  }

  // drawableの決定
  // nullでも8でもないときに引ける
  field.currentDrawable
      = !((field.lastCard === null) || (field.lastCard.isEight()));

  // 次プレイヤーならdrawボタンとnot drawボタンを更新
  if (field.currentPlayerid === 0) {
    vm.drawButtonActive = field.currentDrawable;
    vm.notDrawButtonActive = true;
  }
}

function computerTurn() {
  if (field.currentPlayerid === 0) { return; }

  // 引くかどうかをランダム(1/10)で決定
  let willDraw = (Math.floor(Math.random() * 10) < 1) ? true : false;
  willDraw = willDraw && field.currentDrawable;
  drawPhase(willDraw);

  // 取る行動をランダムで決定
  let validPlays = players[field.currentPlayerid].validPlays;
  let play = validPlays[Math.floor(Math.random() * validPlays.length)];
  discardPhase(play);
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

let log = [];

let vm = new Vue({
  el: "#vm",
  data: {
    hand: players[0].handString(),
    validPlays: players[0].validPlays,
    log,
    drawButtonActive: false,
    notDrawButtonActive: true,
    validPlaysActive: false,
  },
  methods: {
    drawPhase: drawPhase,
    discardPhase: discardPhase,
  },
});

let intervalId = setInterval(computerTurn, 100); // 100ms間隔
