// shiokmash server - the backbone of this shiok operation lah
// node.js handles HTTP + file I/O, lahlang handles the actual game logic
const express    = require('express');
const fs         = require('fs');
const path       = require('path');
const os         = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');

const chiong_go      = express();        // the main app lah
const PORT           = 1965; // year singapore became independent lah - shiok choice
const execFileAsync  = promisify(execFile);

const DATA_FOLDER  = path.join(__dirname, 'data');
const DISHES_FILE  = path.join(DATA_FOLDER, 'dishes.json');
const SCORES_FILE  = path.join(DATA_FOLDER, 'scores.json');
const LAH_FOLDER   = path.join(__dirname, 'lah');
const BONUS_POINTS = 15;               // shiok points awarded each round

chiong_go.use(express.json());
chiong_go.use(express.static('public'));

// ─── lahlang runner ──────────────────────────────────────────────────────────
// writes a .lah script to a temp file, runs it via lahlang CLI, returns stdout
// we embed live data directly into the script so lahlang does pure computation
async function bo_jio_lahlang(lah_script) {
  const tmp_file = path.join(os.tmpdir(), `shiokmash_${Date.now()}_${Math.random().toString(36).slice(2)}.lah`);
  try {
    fs.writeFileSync(tmp_file, lah_script);
    const lahlang_bin = path.join(__dirname, 'node_modules', '.bin', 'lahlang');
    const { stdout } = await execFileAsync(lahlang_bin, [tmp_file], { timeout: 5000 });
    return stdout.trim();
  } finally {
    try { fs.unlinkSync(tmp_file); } catch { /* bo jio - already gone lah */ }
  }
}

// ─── data helpers ────────────────────────────────────────────────────────────
function read_dishes_lah()        { return JSON.parse(fs.readFileSync(DISHES_FILE, 'utf8')); }
function read_scores_lah()        { return JSON.parse(fs.readFileSync(SCORES_FILE, 'utf8')); }
function save_scores_lah(scores)  { fs.writeFileSync(SCORES_FILE, JSON.stringify(scores, null, 2)); }

// create scores.json with 1000 base score for each dish if it doesn't exist yet
function init_scores_if_bo_jio() {
  if (!fs.existsSync(SCORES_FILE)) {
    const all_dishes = read_dishes_lah();
    const initial_scores = {};
    all_dishes.forEach(dish => {
      initial_scores[dish.id] = { score: 1000, wins: 0, losses: 0 };
    });
    save_scores_lah(initial_scores);
    console.log('Scores file bo jio - created fresh lah!');
  }
}

// sanitise a string so it is safe to embed as a lahlang string literal
function safe_for_lah(str) {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

// ─── routes ──────────────────────────────────────────────────────────────────

// GET /api/matchup
// node.js picks two random dishes, lahlang writes the hype intro text
chiong_go.get('/api/matchup', async (req, res) => {
  const all_dishes = read_dishes_lah();

  // pick two different dish indices - confirm no same same lah
  const idx_one = Math.floor(Math.random() * all_dishes.length);
  let idx_two   = Math.floor(Math.random() * (all_dishes.length - 1));
  if (idx_two >= idx_one) idx_two++;

  const dish_one = all_dishes[idx_one];
  const dish_two = all_dishes[idx_two];

  // lahlang generates the flavour text for this matchup
  // embed the dish names directly into the .lah script
  const battle_intro_lah = `eh listen lah
  eh got dish_one = "${safe_for_lah(dish_one.name)}";
  eh got dish_two = "${safe_for_lah(dish_two.name)}";

  oi "Wah lau eh! " + dish_one + " vs " + dish_two + " - which one more shiok? You decide lah!";
ok lah bye
`;

  let intro_text;
  try {
    intro_text = await bo_jio_lahlang(battle_intro_lah);
  } catch (err) {
    // aiyah lahlang siao siao - use fallback lah
    console.error('bo_jio_lahlang battle-intro suay:', err.message);
    intro_text = `${dish_one.name} vs ${dish_two.name} — which one more shiok?`;
  }

  const scores = read_scores_lah();

  res.json({
    dish_one: { ...dish_one, score: scores[dish_one.id]?.score ?? 1000 },
    dish_two: { ...dish_two, score: scores[dish_two.id]?.score ?? 1000 },
    intro:    intro_text
  });
});

// POST /api/vote
// lahlang does the score arithmetic, node.js persists the result
chiong_go.post('/api/vote', async (req, res) => {
  const { winner_id, loser_id } = req.body;

  const all_dishes = read_dishes_lah();
  const scores     = read_scores_lah();

  const winner_dish = all_dishes.find(d => d.id === winner_id);
  const loser_dish  = all_dishes.find(d => d.id === loser_id);

  if (!winner_dish || !loser_dish || winner_id === loser_id) {
    return res.status(400).json({ error: 'Aiyah invalid vote lah! Bo jio proper dish ids.' });
  }

  const winner_current = scores[winner_id]?.score ?? 1000;
  const loser_current  = scores[loser_id]?.score  ?? 1000;

  // lahlang script does the score update arithmetic - this is real computation lah
  // embed current scores into the script so lahlang can crunch the numbers
  const update_score_lah = `eh listen lah
  confirm got BONUS_POINTS = ${BONUS_POINTS};
  eh got winner_score = ${winner_current};
  eh got loser_score  = ${loser_current};
  eh got shiok_score = winner_score + BONUS_POINTS;
  eh got suay_score = loser_score - BONUS_POINTS;
  confirm or not (suay_score less than 0) {
    eh change suay_score = 0;
  }
  oi to_words(shiok_score) + "|" + to_words(suay_score);
ok lah bye
`;

  let new_winner_score, new_loser_score;

  try {
    const lah_output   = await bo_jio_lahlang(update_score_lah);
    const score_parts  = lah_output.split('|');
    new_winner_score   = parseFloat(score_parts[0]);
    new_loser_score    = parseFloat(score_parts[1]);

    if (isNaN(new_winner_score) || isNaN(new_loser_score)) {
      throw new Error('TokKokError: lahlang output bo jio valid numbers lah');
    }
  } catch (err) {
    // lahlang kena siao - fallback to plain JS so the vote still counts lah
    console.error('bo_jio_lahlang update-score suay:', err.message);
    new_winner_score = winner_current + BONUS_POINTS;
    new_loser_score  = Math.max(0, loser_current - BONUS_POINTS);
  }

  // persist the new scores - node.js handles the file I/O lah
  if (!scores[winner_id]) scores[winner_id] = { score: 1000, wins: 0, losses: 0 };
  if (!scores[loser_id])  scores[loser_id]  = { score: 1000, wins: 0, losses: 0 };

  scores[winner_id].score   = new_winner_score;
  scores[winner_id].wins   += 1;
  scores[loser_id].score    = new_loser_score;
  scores[loser_id].losses  += 1;

  save_scores_lah(scores);

  res.json({
    winner: { id: winner_id, name: winner_dish.name, new_score: new_winner_score },
    loser:  { id: loser_id,  name: loser_dish.name,  new_score: new_loser_score  }
  });
});

// GET /api/leaderboard
// node.js sorts the dishes, lahlang writes the Singlish commentary
chiong_go.get('/api/leaderboard', async (req, res) => {
  const all_dishes = read_dishes_lah();
  const scores     = read_scores_lah();

  // build and sort the leaderboard - highest score first lah
  const leaderboard = all_dishes.map(dish => ({
    ...dish,
    score:       scores[dish.id]?.score    ?? 1000,
    wins:        scores[dish.id]?.wins     ?? 0,
    losses:      scores[dish.id]?.losses   ?? 0,
    total_votes: (scores[dish.id]?.wins ?? 0) + (scores[dish.id]?.losses ?? 0)
  })).sort((a, b) => b.score - a.score);

  const total_votes_lah = leaderboard.reduce((sum, d) => sum + d.wins, 0);
  const top_dish_name   = leaderboard[0]?.name ?? 'nobody lah';

  // lahlang generates the leaderboard page commentary
  const leaderboard_intro_lah = `eh listen lah
  eh got total_votes = ${total_votes_lah};
  eh got top_dish    = "${safe_for_lah(top_dish_name)}";
  confirm or not (total_votes same same 0) {
    oi "Wah, no votes yet! Quick quick go vote lah! Cannot be so paiseh one!";
  } or maybe (total_votes less than 10) {
    oi "Aiyah only " + to_words(total_votes) + " votes leh. Vote more lah, dun be shy!";
  } or maybe (total_votes less than 50) {
    oi "Getting shiok lah! " + to_words(total_votes) + " votes already. " + top_dish + " leading so far!";
  } or maybe (total_votes less than 100) {
    oi "Wah steady pom pi pi! " + to_words(total_votes) + " votes sia. " + top_dish + " confirm plus chop?";
  } abuden {
    oi "Wah so many votes sia! " + to_words(total_votes) + " Singaporeans confirm " + top_dish + " is top shiok lah!";
  }
ok lah bye
`;

  let commentary;
  try {
    commentary = await bo_jio_lahlang(leaderboard_intro_lah);
  } catch (err) {
    console.error('bo_jio_lahlang leaderboard-intro suay:', err.message);
    commentary = `${total_votes_lah} votes counted. ${top_dish_name} is leading!`;
  }

  res.json({ leaderboard, commentary });
});

// ─── boot ─────────────────────────────────────────────────────────────────────
init_scores_if_bo_jio();
chiong_go.listen(PORT, () => {
  console.log(`Shiokmash is ready lah! → http://localhost:${PORT}`);
  console.log('Come vote for your favourite Singapore dish!');
});
