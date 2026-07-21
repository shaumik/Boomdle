/*
 * Boomdle word data, organized into selectable packs.
 *
 *   CATEGORIES[key] = { label, emoji, words }   // answer pools
 *   VALID = Set of every accepted guess (union of all packs + extras)
 *
 * The answer is drawn from the chosen pack, but VALID stays lenient — any real
 * word from any pack is accepted as a guess so players aren't blocked.
 */

// Big pool of common, everyday 5-letter words — the "Classic" pack.
const COMMON = [
  "about", "above", "abuse", "actor", "acute", "admit", "adopt", "adult",
  "after", "again", "agent", "agree", "ahead", "alarm", "album", "alert",
  "alike", "alive", "allow", "alone", "along", "alter", "amber", "amend",
  "among", "anger", "angle", "angry", "apart", "apple", "apply", "arena",
  "argue", "arise", "array", "aside", "asset", "audio", "audit", "avoid",
  "award", "aware", "badly", "baker", "bases", "basic", "beach", "began",
  "begin", "being", "below", "bench", "billy", "birth", "black", "blade",
  "blame", "blank", "blast", "blaze", "blend", "blind", "block", "blood",
  "bloom", "board", "boost", "booth", "bound", "brain", "brand", "brave",
  "bread", "break", "breed", "brick", "brief", "bring", "broad", "broke",
  "brown", "brush", "build", "built", "bunch", "burst", "buyer", "cabin",
  "cable", "candy", "canal", "cargo", "carry", "carve", "catch", "cause",
  "chain", "chair", "chalk", "charm", "chart", "chase", "cheap", "check",
  "chest", "chief", "child", "china", "chose", "civic", "civil", "claim",
  "class", "clean", "clear", "click", "cliff", "climb", "clock", "close",
  "cloth", "cloud", "coach", "coast", "color", "coral", "couch", "could",
  "count", "court", "cover", "craft", "crane", "crash", "crazy", "cream",
  "creek", "crest", "crime", "crisp", "cross", "crowd", "crown", "crude",
  "curve", "cycle", "daily", "dairy", "dance", "dealt", "death", "debut",
  "delay", "delta", "dense", "depth", "devil", "diary", "dirty", "dizzy",
  "dodge", "doing", "donor", "doubt", "dozen", "draft", "drain", "drama",
  "drank", "dream", "dress", "dried", "drift", "drill", "drink", "drive",
  "drone", "drove", "dwarf", "eager", "eagle", "early", "earth", "ebony",
  "eight", "elbow", "elder", "elect", "elite", "ember", "empty", "enemy",
  "enjoy", "enter", "entry", "equal", "error", "essay", "event", "every",
  "exact", "exist", "extra", "fairy", "faith", "false", "fancy", "fatal",
  "fault", "favor", "feast", "fence", "fever", "fiber", "field", "fifth",
  "fifty", "fight", "final", "first", "flame", "flare", "flash", "fleet",
  "flesh", "flint", "float", "flood", "floor", "flour", "flown", "fluid",
  "focus", "force", "forge", "forth", "forty", "found", "frame", "fraud",
  "fresh", "front", "frost", "fruit", "fully", "funny", "ghost", "giant",
  "given", "glass", "gleam", "globe", "glory", "glove", "grace", "grade",
  "grain", "grand", "grant", "grape", "graph", "grasp", "grass", "grave",
  "great", "greed", "green", "greet", "grief", "grill", "grind", "groan",
  "groom", "gross", "group", "grove", "grown", "guard", "guess", "guest",
  "guide", "habit", "happy", "harsh", "haste", "haunt", "heart", "heavy",
  "hedge", "hello", "hobby", "honey", "honor", "horse", "hotel", "house",
  "hover", "human", "humor", "ideal", "image", "index", "inner", "input",
  "irony", "issue", "ivory", "jelly", "jewel", "joint", "jolly", "joker",
  "judge", "juice", "kayak", "kneel", "knife", "knock", "known", "label",
  "labor", "large", "laser", "later", "laugh", "layer", "learn", "lease",
  "least", "leave", "legal", "lemon", "level", "lever", "light", "limit",
  "linen", "liver", "lobby", "local", "lodge", "logic", "loose", "lower",
  "loyal", "lucky", "lunar", "lunch", "lyric", "magic", "major", "maker",
  "march", "marry", "match", "maybe", "mayor", "meant", "medal", "media",
  "melon", "mercy", "merge", "merit", "metal", "meter", "midst", "might",
  "minor", "mixer", "model", "moist", "money", "month", "moral", "motor",
  "mount", "mouse", "mouth", "movie", "music", "naval", "nerve", "never",
  "newer", "newly", "niece", "night", "noble", "noise", "north", "novel",
  "nurse", "ocean", "offer", "olive", "onion", "opera", "orbit", "order",
  "organ", "otter", "ought", "outer", "owner", "paint", "panel", "panic",
  "paper", "party", "pasta", "patch", "pause", "peace", "peach", "pearl",
  "penny", "phase", "phone", "photo", "piano", "piece", "pilot", "pinch",
  "pitch", "pixel", "pizza", "place", "plain", "plane", "plant", "plate",
  "plaza", "plead", "point", "poker", "polar", "porch", "pound", "power",
  "press", "price", "pride", "prime", "print", "prior", "prism", "prize",
  "probe", "proof", "proud", "prove", "pulse", "punch", "pupil", "puppy",
  "purse", "quake", "queen", "query", "quest", "quick", "quiet", "quilt",
  "quite", "quote", "radar", "radio", "raise", "rally", "ranch", "range",
  "rapid", "ratio", "raven", "reach", "react", "ready", "realm", "rebel",
  "refer", "relax", "relay", "reply", "rider", "ridge", "rifle", "right",
  "rigid", "risky", "rival", "river", "roast", "robin", "robot", "rocky",
  "roman", "rough", "round", "route", "royal", "rugby", "ruler", "rumor",
  "rural", "salad", "sauce", "scale", "scarf", "scare", "scene", "scope",
  "score", "scout", "scrap", "sense", "serve", "seven", "shade", "shaft",
  "shake", "shall", "shame", "shape", "share", "shark", "sharp", "sheep",
  "sheet", "shelf", "shell", "shift", "shine", "shiny", "shirt", "shock",
  "shoot", "shore", "short", "shown", "sight", "silly", "since", "siren",
  "sixth", "sixty", "skate", "skill", "skirt", "skull", "slate", "sleep",
  "slice", "slide", "slope", "small", "smart", "smash", "smell", "smile",
  "smoke", "snake", "sneak", "solar", "solid", "solve", "sonic", "sorry",
  "sound", "south", "space", "spare", "spark", "speak", "speed", "spell",
  "spend", "spent", "spice", "spike", "spine", "split", "spoke", "sport",
  "spray", "squad", "stack", "staff", "stage", "stain", "stair", "stake",
  "stall", "stamp", "stand", "stare", "start", "state", "steak", "steal",
  "steam", "steel", "steep", "steer", "stern", "stick", "stiff", "still",
  "sting", "stock", "stone", "stood", "stool", "store", "storm", "story",
  "stout", "stove", "strap", "straw", "strip", "study", "stuff", "stump",
  "stunt", "style", "sugar", "sunny", "super", "surge", "swamp", "swarm",
  "swear", "sweat", "sweep", "sweet", "swell", "swift", "swing", "sword",
  "syrup", "table", "taken", "taste", "tasty", "teach", "tempo", "tenth",
  "thank", "theft", "theme", "there", "these", "thick", "thief", "thigh",
  "thing", "think", "third", "those", "three", "threw", "throw", "thumb",
  "tidal", "tiger", "tight", "title", "toast", "today", "token", "tooth",
  "topic", "torch", "total", "touch", "tough", "towel", "tower", "toxic",
  "trace", "track", "trade", "trail", "train", "trait", "trash", "treat",
  "trend", "trial", "tribe", "trick", "tried", "troop", "truck", "truly",
  "trunk", "trust", "truth", "tulip", "tumor", "tutor", "twice", "twist",
  "ultra", "uncle", "under", "union", "unity", "upper", "upset", "urban",
  "usage", "usual", "valid", "value", "valve", "vapor", "vault", "venue",
  "verse", "video", "vigor", "villa", "vinyl", "viral", "virus", "visit",
  "vital", "vivid", "vocal", "vodka", "voice", "voter", "wagon", "waist",
  "waste", "watch", "water", "weary", "wharf", "wheat", "wheel", "where",
  "which", "while", "white", "whole", "whose", "witch", "woman", "world",
  "worry", "worse", "worst", "worth", "would", "wound", "wrist", "write",
  "wrong", "wrote", "yacht", "yield", "young", "youth", "zebra", "zesty",
];

// Gen Z / internet slang — real 5-letter words used in slang.
const GENSLANG = [
  "based", "vibes", "vibed", "salty", "extra", "hyped", "sigma", "gyatt",
  "clout", "drama", "toxic", "petty", "sassy", "moody", "snack", "basic",
  "ratio", "swole", "thicc", "goofy", "slaps", "stans", "simps", "yeets",
  "goals", "shook", "spill", "shade", "flops", "slays", "gucci", "noobs",
  "queen", "hangs", "moods", "drips", "riled", "sussy", "twerk", "bangs",
];

// Vulgar / rude pack. It's a bleep-word game mode — profanity by design.
const VULGAR = [
  "bitch", "dicks", "cocks", "twats", "pussy", "shits", "craps", "farts",
  "boobs", "balls", "horny", "prick", "porno", "booty", "arses", "boner",
  "turds", "queef", "skank", "randy", "penis", "poops", "pubes", "chode",
  "dildo", "sluts", "wanks", "wench", "hooch", "bimbo", "titty", "thong",
  "kinky", "naked", "nudes", "freak", "hussy", "tramp",
];

// Extra words accepted as guesses only (never chosen as answers).
const EXTRA_VALID = [
  "abide", "aloft", "amiss", "ankle", "askew", "aught", "bacon", "badge",
  "beast", "bezel", "bloke", "bogus", "boxer", "briar", "bylaw", "cacao",
  "chomp", "clank", "cleat", "coper", "crept", "curly", "dandy", "dingy",
  "ditch", "dowry", "eaten", "epoch", "farce", "fjord", "flank", "gaudy",
  "glyph", "gonzo", "gully", "hasty", "ionic", "jazzy", "jumbo", "kudos",
  "lasso", "latch", "mango", "mocha", "nifty", "nomad", "oaken", "pesky",
  "quash", "quirk", "rowdy", "salsa", "savvy", "shrug", "sloth", "smirk",
  "snarl", "spurn", "squib", "tacky", "tangy", "vixen", "wacky", "yodel",
  "zonal", "zebus", "aphid", "brine", "chime", "dogma", "elope", "flair",
];

// Keep only distinct, well-formed 5-letter words in each list.
function clean(list) {
  return [...new Set(list.filter((w) => /^[a-z]{5}$/.test(w)))];
}

const CATEGORIES = {
  all: { label: "All Words", emoji: "🌎", words: [] }, // filled below
  common: { label: "Classic", emoji: "📖", words: clean(COMMON) },
  genz: { label: "Gen Z", emoji: "😎", words: clean(GENSLANG) },
  vulgar: { label: "Vulgar 🔞", emoji: "🌶️", words: clean(VULGAR) },
};
CATEGORIES.all.words = clean([...COMMON, ...GENSLANG, ...VULGAR]);

// Every real word from any pack is a legal guess, plus the extras.
const VALID = new Set([...CATEGORIES.all.words, ...clean(EXTRA_VALID)]);

// Back-compat: some code paths still reference ANSWERS as a default pool.
const ANSWERS = CATEGORIES.all.words;
