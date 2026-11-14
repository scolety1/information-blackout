import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const createdAt = "2026-08-12T00:00:00.000Z";
const entitySets = {
  tv: [
    ["Harbor of Ash", "Harbor Ash", "Nera Voss", "Tovin", "the lighthouse"],
    ["Orchard Nine", "Orchard", "Milo Quill", "Asha", "the glass orchard"],
    ["Signal Winter", "Winter Signal", "Edda Crane", "Pax", "the relay"],
    ["Copper Saints", "Saints", "Ivo Marr", "Lina", "the foundry"],
    ["Tidehouse", "Tide House", "Rook Vale", "Sena", "the sea gate"],
    ["Velvet Meridian", "Meridian", "Oren Pike", "Mira", "the observatory"],
    ["Lantern Province", "Lantern", "Cato Wren", "Yara", "the border archive"],
  ],
  movie: [
    ["Blue Static", "Static", "Ari Fen", "Kess", "the weather station"],
    ["The Ninth Current", "Ninth Current", "Dara Sol", "Merek", "the flooded vault"],
    ["Paper Moonfall", "Moonfall", "Iris Cade", "Noam", "the lunar depot"],
    ["Iron Petal", "Petal", "Ren Orlo", "Veya", "the embassy"],
    ["A Quiet Comet", "Quiet Comet", "Tala Nix", "Bram", "the crater"],
    ["Hollow Atlas", "Atlas", "Eli Sorn", "Maia", "the map room"],
    ["Red Parallax", "Parallax", "Niko Penn", "Suri", "the orbital chapel"],
  ],
  book: [
    ["The Salt Index", "Salt Index", "Mara Pell", "Renn", "the drowned library"],
    ["Crowglass", "Crow Glass", "Tess Ardin", "Belen", "the black tower"],
    ["Axiom Garden", "Garden", "Fio Mercer", "Nell", "the seed chamber"],
    ["The Ember Grammar", "Ember Grammar", "Lio Hart", "Sable", "the scriptoria"],
    ["North of Silence", "Silence", "Kira Doss", "Ansel", "the polar monastery"],
    ["The Marble Sleep", "Marble Sleep", "Juno Crest", "Perrin", "the sealed gallery"],
    ["Borrowed Rivers", "Rivers", "Aven Locke", "Sia", "the underground delta"],
  ],
  game: [
    ["Rune Circuit", "Circuit", "Kael Byte", "Nyx", "the zero arena"],
    ["Moss Engine", "Engine", "Orra Flint", "Timo", "the root core"],
    ["Sky Reliquary", "Reliquary", "Zed Aster", "Pia", "the cloud shrine"],
    ["Neon Pilgrim", "Pilgrim", "Vik Rune", "Ema", "the mirror district"],
    ["Gravel Crown", "Crown", "Rae Mott", "Jax", "the buried citadel"],
    ["Threadbreaker", "Thread", "Sol Kade", "Uma", "the loom fortress"],
    ["Obsidian Picnic", "Picnic", "Teo March", "Luz", "the basalt grove"],
  ],
  sports: [
    ["Arbor City Kites", "Kites", "Jalen Orr", "Bay Wolves", "Morrow Field"],
    ["Mesa Comets", "Comets", "Pia Long", "River Kings", "Cinder Arena"],
    ["Northport Owls", "Owls", "Dex Hale", "Golden Foxes", "Beacon Park"],
    ["Cobalt Union", "Union", "Mina Shaw", "Vale Rovers", "Union Ground"],
    ["Juniper Sparks", "Sparks", "Omar Reed", "Stone Bears", "Juniper Court"],
    ["Redwood Arrows", "Arrows", "Lena Frost", "Coast Pilots", "Redwood Bowl"],
    ["Prairie Orbit", "Orbit", "Theo Moss", "Summit Hawks", "Prairie Dome"],
  ],
  competition: [
    ["Forge Table", "Forge", "Nia Bloom", "Pavel", "the final anvil"],
    ["Cipher House", "Cipher", "Remy Holt", "Jessa", "the code chamber"],
    ["Last Lantern", "Lantern", "Ola Finch", "Dane", "the beacon stage"],
    ["Canvas Crown", "Canvas", "Miko Lane", "Tari", "the gallery final"],
    ["Wild Pantry", "Pantry", "Sera Cook", "Bo", "the harvest kitchen"],
    ["Clockwork Choir", "Choir", "Ari Bell", "Nomi", "the grand recital"],
    ["Summit Makers", "Makers", "Gia North", "Lars", "the peak workshop"],
  ],
};

const narrativeSpoilers = [
  ["confirmed-death", "{person} dies while sealing {place} in {topic}."],
  ["confirmed-survival", "After the collapse, {alias} confirms that {person} survived and returns home."],
  ["betrayal", "{person} hands the keys to {other}; the betrayal ends {topic}'s final act."],
  ["identity", "{topic} identifies {other} as the masked founder everyone was hunting."],
  ["relationship", "The letters prove {person} and {other} are siblings, not strangers."],
  ["ending", "At the end of {topic}, {person} destroys {place} and leaves alone."],
  ["post-credit", "The {topic} post-credits scene shows {other} awake beneath {place}."],
  ["hidden-location", "{place} was the prison holding every missing resident of {topic}."],
  ["confirmed-twist", "The final record confirms {person} created the disaster blamed on {other}."],
  ["implication", "Every message guiding {person} used {other}'s private code; the hunter had been the guide all along."],
];
const narrativeBenign = [
  ["prediction", "I think {person} might betray {other} when {topic} returns."],
  ["question", "Did {person} build {place}, or is {topic} misleading us?"],
  ["theory", "Fan theory: {other} could secretly be related to {person}."],
  ["conditional", "If {person} dies, {topic} would lose its emotional center."],
  ["hypothetical", "Imagine if {place} were actually a prison; that would be a wild twist."],
  ["spoiler-free-review", "No spoilers: {topic}'s ending is emotionally precise and beautifully acted."],
  ["metadata", "{topic} begins streaming Friday with restored captions and a new poster."],
  ["quoted-speculation", "The article quotes fans guessing that {other} is the founder but confirms nothing."],
  ["review-language", "A review says {person}'s performance gives the finale a devastating sense of loss."],
  ["language-collision", "The workshop uses {alias} as an example of an ending clause, not a plot summary."],
];
const sportsSpoilers = [
  ["final-score", "Final: {topic} defeated {other} 104-97 at {place}."],
  ["confirmed-winner", "{topic} won the championship after {person}'s late score."],
  ["elimination", "The loss to {other} eliminated {alias} from the playoffs."],
  ["completed-result", "Full time at {place}: {other} 1, {topic} 3."],
  ["champion", "{person} lifted the trophy as {topic} became league champion."],
  ["live-result", "With seconds remaining, {topic} leads {other} 88-72."],
  ["historic-current-article", "Today's recap confirms {topic} beat {other} in the deciding game."],
  ["overtime-result", "{person}'s overtime goal gave {alias} a 4-3 victory."],
  ["series-result", "{topic} completed the sweep and sent {other} home."],
  ["implicit-result", "Blue confetti covered {place} while {person} accepted the winners' medals for {alias}."],
];
const sportsBenign = [
  ["prediction", "I think {topic} might win against {other} tonight."],
  ["question", "Will {person} score first for {alias}?"],
  ["schedule", "{topic} hosts {other} next Tuesday at {place}."],
  ["preview", "Preview: {alias} prepare for {other}; kickoff is still two days away."],
  ["betting", "Oddsmakers list {topic} as a narrow favorite, but no result exists yet."],
  ["injury", "{person} is questionable for the upcoming match at {place}."],
  ["lineup", "Projected lineup for {topic} includes {person} at forward."],
  ["fantasy", "Fantasy managers may start {person} if {alias} play at a faster pace."],
  ["historical", "A museum exhibit remembers the 1984 {topic} championship; tonight's game has not started."],
  ["score-collision", "A design review gives the new {alias} uniform a score of 8 out of 10."],
];
const competitionSpoilers = [
  ["winner", "{person} wins {topic} after the final challenge at {place}."],
  ["elimination", "{other} is eliminated from {alias} before the finale."],
  ["finalists", "{person} and {other} are the final two contestants on {topic}."],
  ["result", "The judges name {person} champion of {alias}."],
  ["sent-home", "{person}'s advantage sends {other} home from {topic}."],
  ["runner-up", "{other} finishes second while {person} takes the {topic} title."],
  ["immunity-result", "{person} wins immunity, leaving {other} to be eliminated."],
  ["finale-result", "At {place}, the final vote crowns {person}."],
  ["identity-result", "The masked finalist on {topic} is revealed as {other}."],
  ["implicit-result", "The trophy sits in {person}'s hands as {other} applauds from the runner-up mark."],
];
const competitionBenign = [
  ["prediction", "I predict {person} could win {topic}."],
  ["question", "Did {other} deserve a place in the {alias} finale?"],
  ["theory", "Fans theorize that {person} might receive a secret advantage."],
  ["conditional", "If {other} is eliminated, {topic} would become less funny."],
  ["schedule", "{topic} airs Wednesday at eight, followed by an interview special."],
  ["casting", "Applications for the next season of {alias} open Monday."],
  ["quoted-speculation", "A columnist repeats viewers' guess that {person} wins but offers no confirmation."],
  ["review", "A spoiler-free review calls the {topic} finale tense and rewarding."],
  ["metadata", "The episode titled 'Winner's Circle' appears in the {topic} schedule."],
  ["award-collision", "{alias} won a product-design award for its reusable stage set."],
];

const heldoutNarrative = {
  spoilers: [
    ["heldout-obituary", "{topic}'s closing montage places {person}'s name on the memorial wall."],
    ["heldout-survival", "Rescuers pull {person} alive from {place} after everyone else leaves."],
    ["heldout-allegiance", "The access ledger shows {person} worked for {other} throughout {topic}."],
    ["heldout-identity", "Beneath the helmet is {other}, the ally {person} trusted most in {topic}."],
    ["heldout-kinship", "One birth record makes {person} the child of {other}."],
    ["heldout-ending", "{topic} closes with {person} taking command of {place}."],
    ["heldout-stinger", "After the credits on {topic}, {other} opens their eyes inside {place}."],
    ["heldout-location", "The missing townspeople have been living beneath {place} for years."],
    ["heldout-causality", "It was {person}, not {other}, who triggered the first collapse in {topic}."],
    ["heldout-implication", "The supposed enemy's notes all carry {person}'s childhood shorthand; {person} authored both sides of the hunt."],
  ],
  benign: [
    ["heldout-forecast", "My bet is that {person} eventually turns against {other}."],
    ["heldout-interrogative", "Could {place} be hiding something from {person}?"],
    ["heldout-fan-hypothesis", "Viewers are floating an unverified idea that {other} raised {person}."],
    ["heldout-counterfactual", "Were {person} to vanish, {topic} would feel completely different."],
    ["heldout-imagination", "Picture {other} under that helmet—fun, but unsupported by the episode."],
    ["heldout-nondisclosure-review", "The critic avoids plot details while praising the last hour of {topic}."],
    ["heldout-distribution", "A remastered edition of {topic} arrives on disc in November."],
    ["heldout-attributed-guess", "A roundup attributes the {other} theory to commenters and supplies no evidence."],
    ["heldout-emotional-review", "{person} gives a heartbreaking performance, according to a plot-free review of {topic}."],
    ["heldout-word-sense", "The phrase {alias} appears in a vocabulary lesson unrelated to the fictional story."],
  ],
};

const heldoutSports = {
  spoilers: [
    ["heldout-result", "The horn sounds with {topic} ahead of {other}, 112-108."],
    ["heldout-title", "{person} receives the champions' medals for {alias} at {place}."],
    ["heldout-exit", "{other}'s victory ends the {topic} postseason run."],
    ["heldout-score", "Match report — {topic} 3, {other} 0 after ninety minutes."],
    ["heldout-trophy", "The league trophy now belongs to {topic}."],
    ["heldout-live", "Late in the fourth quarter, {alias} are up 91-70 on {other}."],
    ["heldout-decider", "{topic} take the deciding contest and advance past {other}."],
    ["heldout-extra-time", "A sudden-death strike by {person} settles the game for {alias}."],
    ["heldout-series", "There will be no next game: {topic} have closed out {other}."],
    ["heldout-ceremony", "At {place}, gold medals hang around the necks of the {topic} roster."],
  ],
  benign: [
    ["heldout-pick", "My pick for tomorrow is {topic} over {other}."],
    ["heldout-question", "Can {person} carry {alias} past {other}?"],
    ["heldout-fixture", "Tickets for {topic} versus {other} at {place} go on sale today."],
    ["heldout-preview", "Scouting notes compare {topic} and {other} before their weekend meeting."],
    ["heldout-market", "The pregame line moves slightly toward {alias}."],
    ["heldout-health", "Doctors will reassess {person} before the {topic} match."],
    ["heldout-roster", "A predicted starting group for {alias} lists {person}."],
    ["heldout-fantasy", "A fantasy column considers {person} a risky selection this week."],
    ["heldout-archive", "An archive page covers the {topic} title from forty years ago, not the current fixture."],
    ["heldout-rating", "A fashion site rates the {alias} shirt 7/10."],
  ],
};

const heldoutCompetition = {
  spoilers: [
    ["heldout-winner", "The final ballot on {topic} puts {person} in first place."],
    ["heldout-elimination", "{other}'s station is empty after the judges remove them from {alias}."],
    ["heldout-finalists", "Only {person} and {other} remain when the {topic} finale begins."],
    ["heldout-verdict", "All three judges choose {person} at the end of {topic}."],
    ["heldout-departure", "The advantage saves {person}, so {other} leaves {alias}."],
    ["heldout-runner-up", "{other} receives the silver apron beside {topic} victor {person}."],
    ["heldout-immunity", "Safety goes to {person}; the vote removes {other}."],
    ["heldout-crown", "The last envelope awards the {topic} crown to {person}."],
    ["heldout-unmasking", "{other} steps out of the costume during the {topic} reveal."],
    ["heldout-ceremony", "{person}'s name is engraved on the {topic} trophy while {other} watches."],
  ],
  benign: [
    ["heldout-prediction", "I can see {person} making the final, although nothing is settled."],
    ["heldout-question", "Should {other} win {topic} based on last week's work?"],
    ["heldout-theory", "Commenters suspect {person} may have an advantage, without proof."],
    ["heldout-conditional", "Were {other} sent home, the tone of {alias} would change."],
    ["heldout-schedule", "The next {topic} episode starts at nine on Thursday."],
    ["heldout-casting", "Producers seek applicants for a future {alias} season."],
    ["heldout-rumor", "A blog repeats a rumor about {person} and labels it unverified."],
    ["heldout-review", "The recap withholds results and praises the {topic} set design."],
    ["heldout-title", "'The Champion's Table' is only the announced title of a {topic} episode."],
    ["heldout-award", "The lighting team behind {alias} receives an industry award."],
  ],
};

function gameTemplates() {
  const spoilers = narrativeSpoilers.map(([family, text]) => [family, text]);
  spoilers[5] = ["boss-identity", "The final boss of {topic} is {other}, {person}'s missing companion."];
  spoilers[6] = ["secret-area", "Defeating {other} in {topic} opens {place}, where the lost crew are alive."];
  const benign = narrativeBenign.map(([family, text]) => [family, text]);
  benign[6] = ["patch-notes", "{topic} patch 2.4 improves controller support and loading times."];
  benign[8] = ["review-score", "The technical review gives {topic} a score of nine for accessibility."];
  benign[9] = ["strategy", "A {alias} strategy guide recommends saving potions before entering {place}."];
  return { spoilers, benign };
}

const templates = {
  tv: { spoilers: narrativeSpoilers, benign: narrativeBenign },
  movie: { spoilers: narrativeSpoilers, benign: narrativeBenign },
  book: { spoilers: narrativeSpoilers, benign: narrativeBenign },
  game: gameTemplates(),
  sports: { spoilers: sportsSpoilers, benign: sportsBenign },
  competition: { spoilers: competitionSpoilers, benign: competitionBenign },
};

const heldoutTemplates = {
  tv: heldoutNarrative,
  movie: heldoutNarrative,
  book: heldoutNarrative,
  game: heldoutNarrative,
  sports: heldoutSports,
  competition: heldoutCompetition,
};

function fill(template, values) {
  const [topic, alias, person, other, place] = values;
  return template.replaceAll("{topic}", topic).replaceAll("{alias}", alias).replaceAll("{person}", person).replaceAll("{other}", other).replaceAll("{place}", place);
}

const cases = [];
for (const [category, entities] of Object.entries(entitySets)) {
  entities.forEach((values, entityIndex) => {
    const split = entityIndex < 5 ? "development" : "validation";
    const topic = { id: `m4-${category}-${entityIndex + 1}`, name: values[0], aliases: [values[1], values[2]], enabled: true, createdAt };
    for (const expected of ["spoiler", "benign"]) {
      const source = split === "validation" ? heldoutTemplates : templates;
      const selected = source[category][expected === "spoiler" ? "spoilers" : "benign"];
      selected.forEach(([family, template], templateIndex) => {
        const framing = entityIndex % 3 === 0 ? "" : entityIndex % 3 === 1 ? "Local post: " : "News card — ";
        cases.push({
          id: `m4-${split}-${category}-${entityIndex + 1}-${expected}-${String(templateIndex + 1).padStart(2, "0")}`,
          split, category, family, expected, topic,
          text: `${framing}${fill(template, values)}`,
          tags: [category, expected, family, entityIndex >= 5 ? "entity-heldout" : "rule-development", templateIndex >= 8 ? "difficult" : "standard"],
        });
      });
    }
  });
}

if (cases.length !== 840) throw new Error(`Expected 840 cases, received ${cases.length}.`);
if (new Set(cases.map((item) => item.text)).size !== cases.length) throw new Error("Mission 4 candidate texts must be unique.");
const serialized = `${JSON.stringify(cases, null, 2)}\n`;
const checksum = createHash("sha256").update(serialized).digest("hex");
const directory = resolve("eval/mission4");
await mkdir(directory, { recursive: true });
await writeFile(resolve(directory, "development.json"), serialized, "utf8");
await writeFile(resolve(directory, "development.sha256"), `${checksum}  development.json\n`, "utf8");
console.log(`Generated ${cases.length} Mission 4 cases (${cases.filter((x) => x.split === "development").length} development / ${cases.filter((x) => x.split === "validation").length} validation).`);
console.log(`SHA-256 ${checksum}`);
