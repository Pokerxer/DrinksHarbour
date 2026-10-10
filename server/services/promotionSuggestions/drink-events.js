const weekday = (year, month, day, occurrence) => {
  const first = new Date(Date.UTC(year, month - 1, 1));
  return new Date(
    Date.UTC(
      year,
      month - 1,
      1 + ((day - first.getUTCDay() + 7) % 7) + (occurrence - 1) * 7,
    ),
  )
    .toISOString()
    .slice(0, 10);
};
function drinkEvents(year) {
  const events = [
    [
      "whisky",
      "World Whisky Day",
      weekday(year, 5, 6, 3),
      "https://www.worldwhiskyday.com/what-world-whisky-day/",
    ],
    [
      "gin",
      "World Gin Day",
      weekday(year, 6, 6, 2),
      "https://worldginday.com/about/",
    ],
    [
      "beer",
      "International Beer Day",
      weekday(year, 8, 5, 1),
      "https://internationalbeerday.com/about-international-beer-day/",
    ],
    [
      "tea",
      "International Tea Day",
      `${year}-05-21`,
      "https://www.fao.org/international-tea-day/en",
    ],
    [
      "coffee",
      "International Coffee Day",
      `${year}-10-01`,
      "https://internationalcoffeeday.org/about/",
    ],
    [
      "beaujolais",
      "Beaujolais Nouveau Day",
      weekday(year, 11, 4, 3),
      "https://carnet.beaujolais.com/en/",
    ],
  ];
  if (year === 2026)
    events.push([
      "champagne",
      "Champagne Day",
      "2026-10-23",
      "https://www.champagneday.fr/world/",
    ]);
  return events.map(([family, name, date, sourceUrl]) => ({
    family,
    name,
    date,
    sourceUrl,
    kind: "drinks",
    verifiedOn: "2026-10-10",
  }));
}
const types = {
  whisky: [
    "whiskey",
    "whisky",
    "bourbon",
    "scotch",
    "rye_whiskey",
    "irish_whiskey",
    "japanese_whisky",
  ],
  gin: ["gin"],
  beer: [
    "beer",
    "lager",
    "ale",
    "stout",
    "porter",
    "ipa",
    "pilsner",
    "wheat_beer",
    "sour_beer",
    "craft_beer",
    "non_alcoholic_beer",
  ],
  tea: [
    "tea",
    "green_tea",
    "black_tea",
    "herbal_tea",
    "oolong_tea",
    "white_tea",
    "chai",
    "matcha",
  ],
  coffee: ["coffee", "espresso", "cold_brew", "instant_coffee"],
  champagne: ["champagne"],
};
function matchesEvent(event, product) {
  if (event.kind !== "drinks") return true;
  const normalize = (v) =>
    String(v || "")
      .toLowerCase()
      .replace(/[ -]/g, "_");
  const type = normalize(product.drinkType),
    subtype = normalize(product.drinkSubType);
  if (event.family === "beaujolais")
    return (
      (type === "wine" || type.endsWith("_wine")) &&
      /\bbeaujolais\b.*\bnouveau\b|\bnouveau\b.*\bbeaujolais\b/i.test(
        product.catalogueName || "",
      )
    );
  return (types[event.family] || []).some((t) => t === type || t === subtype);
}
module.exports = { drinkEvents, matchesEvent };
