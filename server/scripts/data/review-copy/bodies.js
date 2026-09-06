// scripts/data/review-copy/bodies.js
//
// Review copy, keyed by family then by sentiment tier.
//
//   high (5★) — enthusiastic, would rebuy
//   mid  (4★) — positive with a small qualifier
//   low  (3★) — genuinely lukewarm: fine, not remarkable, mild criticism
//
// Splitting by tier is the point. The previous bank was tier-blind, so a 3★
// review carried the text "Rich, rounded and genuinely smooth" — glowing copy
// under a mediocre score. That mismatch is what made the seeded reviews read
// as generated.
//
// Every string is >= 10 chars after trim (server minimum, enforced by
// assertCopyValid in ../review-templates.js). Flavour language is family-
// accurate: no "smoky notes" on a gin, no "crisp and cold" on a cognac.

const BODIES = {
  // ── Whisky family ────────────────────────────────────────────────────────
  singleMalt: {
    high: [
      { title: 'Exceptional dram', comment: 'Layered and complex, with a long finish that keeps developing. Opens up beautifully with a few drops of water.' },
      { title: 'Worth every naira', comment: 'Rich malt character and a warm, lingering finish. This is the bottle I bring out when guests actually know whisky.' },
      { title: 'Superb', comment: 'Deep and rounded with real depth to it. No harshness at all, just a long warming finish. Genuinely special.' },
      { title: 'Excellent single malt', comment: 'Beautifully balanced between the sweetness and the oak. Sipped neat over one large cube and it was perfect.' },
      { title: 'Best I have had', comment: 'Honeyed and full-bodied with a finish that lasts. You can taste the age in this one, it is not subtle.' },
    ],
    mid: [
      { title: 'Very good malt', comment: 'Smooth with a decent finish and plenty of character. A touch of water opens it up nicely.' },
      { title: 'Solid choice', comment: 'Warm and well rounded without any burn. Not the most complex I have tried but very easy to enjoy.' },
      { title: 'Enjoyable', comment: 'Good depth and a pleasant oaky finish. Does what a malt at this level should do.' },
      { title: 'Happy with it', comment: 'Nicely balanced and smooth enough to drink neat. Slightly lighter than I expected but still good.' },
    ],
    low: [
      { title: 'Decent, not outstanding', comment: 'Perfectly drinkable but the finish is shorter than I hoped for at this price. Fine over ice.' },
      { title: 'Bit underwhelming', comment: 'Smooth enough but fairly one note. I was expecting more complexity given the age statement.' },
      { title: 'Pleasant, not memorable', comment: 'Nothing wrong with it, just not memorable. Pleasant enough neat but I would not go out of my way for it.' },
    ],
  },

  blendedWhisky: {
    high: [
      { title: 'Great everyday scotch', comment: 'Smooth and easy going with just enough character. Works neat or with a splash of soda.' },
      { title: 'Very impressed', comment: 'Far smoother than I expected from a blend. No sharpness at all and a genuinely pleasant finish.' },
      { title: 'House pour sorted', comment: 'Consistent and reliable with a warm, malty finish. This has become the bottle I always keep stocked.' },
      { title: 'Excellent value', comment: 'Punches well above its price. Mixes beautifully but honestly it holds up neat too.' },
    ],
    mid: [
      { title: 'Good blend', comment: 'Easy drinking with a mild sweetness. Better with a little ice than completely neat.' },
      { title: 'Does the job well', comment: 'Reliable and smooth. Nothing complicated about it but that is exactly what I wanted.' },
      { title: 'Nice and smooth', comment: 'Light on the palate with a clean finish. Good for mixing or a casual glass after work.' },
      { title: 'Solid bottle', comment: 'Well balanced without any rough edges. Perfectly good for the price bracket.' },
    ],
    low: [
      { title: 'Thin for a blend', comment: 'Drinkable but quite thin. Better in a mixer than on its own, where it falls a bit flat.' },
      { title: 'Just okay', comment: 'Does the basics fine but there is not much character here. I would use it for cocktails.' },
      { title: 'Forgettable blend', comment: 'Smooth enough but forgettable. Fine if you are mixing, less so if you are sipping.' },
    ],
  },

  irishWhiskey: {
    high: [
      { title: 'Beautifully smooth', comment: 'That classic triple distilled softness with a light honeyed sweetness. Dangerously easy to drink.' },
      { title: 'Really lovely', comment: 'Gentle and creamy with a clean finish. No burn whatsoever, just a warm mellow character.' },
      { title: 'My favourite Irish', comment: 'Silky texture with vanilla and a hint of orchard fruit. Excellent neat and even better in a highball.' },
      { title: 'Superb bottle', comment: 'Rich without being heavy, with a lovely soft finish. Converted two whisky sceptics with this one.' },
    ],
    mid: [
      { title: 'Very drinkable', comment: 'Smooth and light with a mild sweetness. Easy sipping though the finish is on the shorter side.' },
      { title: 'Good stuff', comment: 'Soft and approachable with a clean vanilla note. Nice option when I do not want anything heavy.' },
      { title: 'Enjoyed this', comment: 'Mellow and easy going. Works well neat and mixes cleanly with ginger ale.' },
    ],
    low: [
      { title: 'Pleasant but light', comment: 'Very smooth, almost too much so. Lacks the depth I usually want from a whiskey at this price.' },
      { title: 'Fine, a bit plain', comment: 'No complaints on smoothness but it is quite simple. Better as a mixer than a sipper.' },
      { title: 'Middle of the road', comment: 'Perfectly nice, nothing objectionable, but also nothing that stood out to me.' },
    ],
  },

  bourbon: {
    high: [
      { title: 'Rich and full', comment: 'Big vanilla and caramel with a warm oaky backbone. Makes an outstanding old fashioned.' },
      { title: 'Excellent bourbon', comment: 'Sweet up front then a lovely dry spice on the finish. Genuinely good value for the quality.' },
      { title: 'Very happy', comment: 'Full bodied with real depth of flavour. Neat over ice is where this one shines.' },
    ],
    mid: [
      { title: 'Good pour', comment: 'Nice caramel sweetness with a decent spice finish. A little hot neat, better over ice.' },
      { title: 'Solid bourbon', comment: 'Sweet and easy with enough character to hold up in cocktails. Reliable bottle.' },
      { title: 'Enjoyable', comment: 'Plenty of vanilla and oak. Not the most refined but very satisfying for the money.' },
    ],
    low: [
      { title: 'A bit sweet for me', comment: 'Quite sugary on the front and the finish is short. Works better mixed than neat.' },
      { title: 'Harsh for sipping', comment: 'Drinkable but slightly harsh. I would keep this one for cocktails rather than sipping.' },
    ],
  },

  cognac: {
    high: [
      { title: 'Exceptional', comment: 'Silky and rich with dried fruit and a long warming finish. Everything a good cognac should be.' },
      { title: 'Beautiful bottle', comment: 'Wonderfully smooth with layers of oak and stone fruit. Genuinely luxurious to sip after dinner.' },
      { title: 'Outstanding', comment: 'Velvety texture and a finish that lingers properly. Bought it as a gift and immediately bought a second.' },
    ],
    mid: [
      { title: 'Very good', comment: 'Smooth and rounded with a nice fruity warmth. Not the deepest but thoroughly enjoyable.' },
      { title: 'Nice after dinner', comment: 'Rich enough to sip slowly with a pleasant sweetness. Good balance overall.' },
      { title: 'Happy with this', comment: 'Warm and mellow with no harsh edges. Does exactly what I wanted it to.' },
    ],
    low: [
      { title: 'Decent but pricey', comment: 'Smooth and pleasant, though for the money I expected a longer finish and more depth.' },
      { title: 'Thin for the money', comment: 'Perfectly drinkable but a little thin compared to others in this bracket. Better with a cube.' },
    ],
  },

  brandy: {
    high: [
      { title: 'Lovely and warm', comment: 'Smooth with a raisin sweetness and a comforting finish. Excellent value for what it delivers.' },
      { title: 'Really good', comment: 'Rounded and mellow with no harshness. Perfect for a slow glass on a cool evening.' },
    ],
    mid: [
      { title: 'Good brandy', comment: 'Sweet and easy with a decent warmth. Nothing complicated but very drinkable.' },
      { title: 'Reasonable brandy', comment: 'Smooth enough neat and mixes well too. Reasonable quality for the price point.' },
    ],
    low: [
      { title: 'Sharp finish', comment: 'A bit sharp on the finish. Fine in a mixer but I would not sip this one on its own.' },
      { title: 'Okay for the price', comment: 'Does the job but the sweetness is a little artificial tasting. Passable.' },
    ],
  },

  // ── White spirits ────────────────────────────────────────────────────────
  gin: {
    high: [
      { title: 'Outstanding gin', comment: 'Beautifully balanced botanicals with a bright citrus lift. Makes an exceptional G and T.' },
      { title: 'My new favourite', comment: 'Juniper forward but with real complexity behind it. Floral and fresh without being perfumed.' },
      { title: 'Superb', comment: 'Crisp, clean and genuinely aromatic. Works with a simple tonic and a slice of grapefruit.' },
      { title: 'Excellent bottle', comment: 'Smooth enough to sip and complex enough to carry a proper martini. Lovely citrus finish.' },
    ],
    mid: [
      { title: 'Very nice gin', comment: 'Good clean juniper with a pleasant citrus edge. Mixes beautifully with tonic.' },
      { title: 'Enjoyable', comment: 'Bright and fresh though the botanicals are fairly straightforward. Good everyday bottle.' },
      { title: 'Good value', comment: 'Crisp and easy drinking. Not the most distinctive but reliable in a gin and tonic.' },
      { title: 'Happy with it', comment: 'Smooth with a nice herbal note. Better with tonic than neat but that is what I bought it for.' },
    ],
    low: [
      { title: 'Bit sharp', comment: 'Juniper is quite dominant and it needs a strong tonic to balance it. Fine, not memorable.' },
      { title: 'Average gin', comment: 'Perfectly drinkable but fairly generic. Nothing here that stands out from the cheaper options.' },
      { title: 'Slight harshness', comment: 'Does the job in a mixer but there is a slight harshness on the finish that I noticed.' },
    ],
  },

  vodka: {
    high: [
      { title: 'Exceptionally clean', comment: 'No burn at all, just a smooth neutral finish. Excellent in a martini and fine straight from the freezer.' },
      { title: 'Very smooth', comment: 'Genuinely clean with a soft mouthfeel. You can taste the difference against the supermarket brands.' },
    ],
    mid: [
      { title: 'Good vodka', comment: 'Clean and smooth with only the faintest bite. Mixes without leaving any aftertaste.' },
      { title: 'Clean and neutral', comment: 'Does exactly what a good vodka should — disappears into the mix. Reliable bottle.' },
    ],
    low: [
      { title: 'A bit harsh', comment: 'Noticeable burn on the finish. Fine buried in a cocktail but not one to drink chilled on its own.' },
      { title: 'Edge on the finish', comment: 'Perfectly usable for mixing but there is a slight edge to it. Nothing special.' },
    ],
  },

  tequila: {
    high: [
      { title: 'Outstanding', comment: 'Proper cooked agave sweetness with a clean peppery finish. Smooth enough to sip neat, no salt needed.' },
      { title: 'Genuinely excellent', comment: 'Soft vanilla from the barrel over bright agave. This changed my mind about sipping tequila.' },
      { title: 'Superb bottle', comment: 'Silky and rounded with a warm finish. Far too easy to drink for something this strong.' },
      { title: 'Best in the cabinet', comment: 'Rich agave character with a touch of oak and citrus. Makes a spectacular margarita but wasted on one.' },
    ],
    mid: [
      { title: 'Very good', comment: 'Clean agave flavour with a mild pepper finish. Smooth enough neat, excellent in a margarita.' },
      { title: 'Nice tequila', comment: 'Well balanced with a soft sweetness. Not the most complex but very drinkable.' },
      { title: 'Solid choice', comment: 'Good agave forward taste without any harshness. Does well in cocktails and holds up on ice.' },
    ],
    low: [
      { title: 'Bit rough neat', comment: 'Fine in a mixer but there is a sharpness that makes sipping it less pleasant. Decent for the price.' },
      { title: 'Muted agave', comment: 'Agave flavour is there but muted. Perfectly serviceable for cocktails, not for sipping.' },
      { title: 'Thin finish', comment: 'Drinkable but I have had better at this price. The finish is a little thin.' },
    ],
  },

  rum: {
    high: [
      { title: 'Excellent rum', comment: 'Rich molasses sweetness with a warm spiced finish. Wonderful neat and superb in a dark and stormy.' },
      { title: 'Really lovely', comment: 'Smooth with vanilla and dried fruit coming through. No burn at all on the finish.' },
    ],
    mid: [
      { title: 'Good bottle', comment: 'Pleasant sweetness with a decent depth. Mixes very well and is fine over ice.' },
      { title: 'Enjoyable', comment: 'Smooth and easy with a mild spice. Good everyday rum for the price.' },
    ],
    low: [
      { title: 'Quite sweet', comment: 'Sugary for my taste and the finish is short. Works fine in a cocktail with plenty of lime.' },
      { title: 'One dimensional', comment: 'Drinkable but a bit one dimensional. Fine mixed, unremarkable neat.' },
    ],
  },

  // ── Sparkling ────────────────────────────────────────────────────────────
  champagne: {
    high: [
      { title: 'Absolutely superb', comment: 'Fine persistent bubbles with proper brioche depth and a crisp citrus finish. Worth the occasion.' },
      { title: 'Beautiful champagne', comment: 'Elegant and dry with a lovely creamy mousse. Everyone at the table asked what we were drinking.' },
      { title: 'Exceptional', comment: 'Delicate bubbles and a long, refined finish. Genuinely special and it showed the moment we poured it.' },
      { title: 'Perfect for the night', comment: 'Crisp, toasty and beautifully balanced. Chilled properly and it was the highlight of the evening.' },
    ],
    mid: [
      { title: 'Very good', comment: 'Lovely fine bubbles and a clean dry finish. Slightly lighter than I expected but thoroughly enjoyable.' },
      { title: 'Lovely bottle', comment: 'Crisp and refreshing with a nice citrus note. Went down very well with the guests.' },
      { title: 'Happy with this', comment: 'Elegant and well chilled on arrival. Good balance, though the finish is a touch short.' },
    ],
    low: [
      { title: 'Good but pricey', comment: 'Perfectly pleasant with nice bubbles, but for the money I have had better. Slightly sharp finish.' },
      { title: 'Decent', comment: 'Fine champagne, nothing wrong with it, but it did not stand out the way I hoped it would.' },
    ],
  },

  sparkling: {
    high: [
      { title: 'Lovely and crisp', comment: 'Light, fresh and beautifully fizzy with a clean pear note. Excellent value for a celebration.' },
      { title: 'Great bottle', comment: 'Delicate bubbles with a bright fruitiness and a dry finish. Disappeared far too quickly.' },
    ],
    mid: [
      { title: 'Very refreshing', comment: 'Crisp and light with plenty of fizz. Easy drinking on a warm afternoon.' },
      { title: 'Good value', comment: 'Fresh and fruity with a decent balance. Not complex but exactly right for the price.' },
      { title: 'Nice sparkling', comment: 'Clean and bubbly with a mild sweetness. Good for a toast without spending a fortune.' },
    ],
    low: [
      { title: 'A little sweet', comment: 'More sugary than I expected and the bubbles faded quickly. Fine in a spritz.' },
      { title: 'Ordinary fizz', comment: 'Drinkable but fairly ordinary. Does the job for a large gathering where nobody is analysing it.' },
    ],
  },

  // ── Still wine ───────────────────────────────────────────────────────────
  redWine: {
    high: [
      { title: 'Excellent bottle', comment: 'Full bodied with dark fruit and soft tannins. Paired it with grilled beef and it was outstanding.' },
      { title: 'Really impressed', comment: 'Rich and structured with a long finish. Opened it an hour early and it rewarded the patience.' },
      { title: 'Superb red', comment: 'Deep and velvety without being heavy. Genuine complexity here, not just fruit.' },
      { title: 'Will buy again', comment: 'Beautiful balance between the fruit and the oak. Held up perfectly over a long dinner.' },
    ],
    mid: [
      { title: 'Very good red', comment: 'Smooth with decent body and soft tannins. Went nicely with pepper soup and grilled chicken.' },
      { title: 'Enjoyable', comment: 'Good dark fruit character and an easy finish. Not complex but very pleasant with food.' },
      { title: 'Solid everyday bottle', comment: 'Well rounded and drinkable with no rough edges. Good option for a weeknight.' },
      { title: 'Happy with it', comment: 'Nicely balanced, slightly lighter than expected but it worked well with the meal.' },
    ],
    low: [
      { title: 'A bit thin', comment: 'Drinkable but lacking body, and the finish disappears quickly. Better with food than on its own.' },
      { title: 'Sharp tannins', comment: 'Perfectly fine but unremarkable. The tannins are a little sharp on the first glass.' },
      { title: 'Not much going on', comment: 'Nothing wrong with it, just not much going on. Fine for a casual glass.' },
    ],
  },

  whiteWine: {
    high: [
      { title: 'Beautifully crisp', comment: 'Bright citrus and a clean mineral finish. Chilled properly it was outstanding with the fish.' },
      { title: 'Excellent white', comment: 'Fresh, zesty and beautifully balanced. Not a hint of the flabbiness cheaper whites can have.' },
      { title: 'Really lovely', comment: 'Crisp green apple with a long dry finish. This is going to be my summer bottle.' },
    ],
    mid: [
      { title: 'Very refreshing', comment: 'Clean and citrusy with a decent acidity. Good with grilled fish and easy on its own.' },
      { title: 'Good bottle', comment: 'Fresh and light with a pleasant finish. Nothing complex but exactly what I wanted chilled.' },
      { title: 'Enjoyed this', comment: 'Nicely balanced between the fruit and the acidity. Solid choice for the price.' },
    ],
    low: [
      { title: 'Bit flat', comment: 'Drinkable but the acidity is low so it feels a little dull. Fine well chilled.' },
      { title: 'Average white', comment: 'Perfectly serviceable but forgettable. Nothing here that made me want a second glass.' },
    ],
  },

  roseWine: {
    high: [
      { title: 'Lovely rosé', comment: 'Dry, crisp and beautifully pale with real strawberry character. Perfect on a warm evening.' },
      { title: 'Excellent', comment: 'Fresh and elegant without any of the sweetness that puts me off some rosés. Genuinely good.' },
    ],
    mid: [
      { title: 'Very drinkable', comment: 'Light and refreshing with a soft berry note. Went down easily over lunch.' },
      { title: 'Good summer bottle', comment: 'Crisp with a mild fruitiness. Nothing complicated but very pleasant chilled.' },
    ],
    low: [
      { title: 'Sweeter than expected', comment: 'I was hoping for something drier. Pleasant enough but it leans quite sugary.' },
      { title: 'Plain rosé', comment: 'Fine but fairly plain. Does the job on a hot afternoon and not much more.' },
    ],
  },

  sweetRed: {
    high: [
      { title: 'Deliciously smooth', comment: 'Rich and sweet without being cloying, with a lovely berry depth. Exactly what I was after.' },
      { title: 'Perfect for me', comment: 'Beautifully smooth with a jammy fruit character. Goes down far too easily.' },
    ],
    mid: [
      { title: 'Very nice', comment: 'Sweet and easy drinking with good fruit. A touch heavy after the second glass but enjoyable.' },
      { title: 'Good sweet red', comment: 'Smooth with plenty of berry flavour. Well balanced for the style and reasonably priced.' },
    ],
    low: [
      { title: 'Too sweet for me', comment: 'The sugar dominates and it gets sickly by the second glass. Fine if that is what you want.' },
      { title: 'Syrupy', comment: 'Drinkable but quite syrupy. Better served well chilled to cut the sweetness.' },
    ],
  },

  sweetWhite: {
    high: [
      { title: 'Lovely and light', comment: 'Delicate sweetness with a floral aroma and a clean finish. Beautiful chilled after dinner.' },
      { title: 'Really enjoyable', comment: 'Sweet but balanced by good acidity, so it never gets heavy. Excellent with fruit and cheese.' },
    ],
    mid: [
      { title: 'Nice and sweet', comment: 'Pleasant honeyed flavour with a soft finish. Good served very cold.' },
      { title: 'Good value', comment: 'Easy drinking with a gentle sweetness. Not complex but does what it promises.' },
    ],
    low: [
      { title: 'A bit sugary', comment: 'Sweetness overwhelms the fruit and there is little acidity to balance it. Drinkable, not great.' },
      { title: 'One note', comment: 'Fine chilled but quite one dimensional. I would not seek it out again.' },
    ],
  },

  fortified: {
    high: [
      { title: 'Excellent port', comment: 'Rich, warming and beautifully sweet with dried fruit and nuts. Perfect with cheese after dinner.' },
      { title: 'Superb', comment: 'Deep and complex with a long finish. Sipped slowly it is genuinely wonderful.' },
    ],
    mid: [
      { title: 'Very good', comment: 'Sweet and warming with a nice nutty depth. Lovely in a small glass after a meal.' },
      { title: 'Enjoyable', comment: 'Rich without being overpowering. Good balance and pleasant on the finish.' },
    ],
    low: [
      { title: 'Quite heavy', comment: 'Very sweet and a bit syrupy for me. Fine in a small measure with something salty.' },
    ],
  },

  liqueur: {
    high: [
      { title: 'Delicious', comment: 'Beautifully creamy with a rich flavour that is not the least bit artificial. Superb over ice.' },
      { title: 'Excellent', comment: 'Perfectly balanced sweetness with real depth behind it. Lovely as a dessert pour.' },
    ],
    mid: [
      { title: 'Very nice', comment: 'Smooth and sweet with a pleasant finish. Works well over ice and in coffee.' },
      { title: 'Good in cocktails', comment: 'Carries a drink nicely without overpowering it. Decent quality for the price.' },
    ],
    low: [
      { title: 'A bit sweet', comment: 'Pleasant but the sugar is heavy and the flavour tastes slightly synthetic. Fine mixed.' },
      { title: 'Mixer only', comment: 'Does the job in cocktails but I would not drink it on its own. Fairly ordinary.' },
    ],
  },

  // ── Long tail ────────────────────────────────────────────────────────────
  beer: {
    high: [
      { title: 'Crisp and cold', comment: 'Really refreshing with a clean finish and just enough bitterness. Every bottle arrived intact.' },
      { title: 'Great crate', comment: 'Consistent taste across the whole pack and properly chilled on arrival. Now my regular order.' },
    ],
    mid: [
      { title: 'Good beer', comment: 'Light bodied but still full of flavour. Went well with suya and pepper soup.' },
      { title: 'Reliable lager', comment: 'Refreshing and easy drinking. Nothing remarkable but reliable and well priced.' },
    ],
    low: [
      { title: 'Bit watery', comment: 'Drinkable but thin, and the finish is very short. Fine ice cold on a hot day.' },
    ],
  },

  cider: {
    high: [
      { title: 'Wonderfully crisp', comment: 'Proper apple flavour, lightly sparkling and not too sweet. Really refreshing over ice.' },
    ],
    mid: [
      { title: 'Refreshing', comment: 'Good level of fizz with a clean fruity finish. Better than most of the mass market options.' },
    ],
    low: [
      { title: 'Too sweet', comment: 'More like apple juice than cider for my taste. Drinkable but the sugar dominates.' },
    ],
  },

  readyToDrink: {
    high: [
      { title: 'Very handy', comment: 'Perfectly balanced and not overly sugary. Ideal when you do not want to mix anything yourself.' },
    ],
    mid: [
      { title: 'Good for parties', comment: 'Grabbed a few for a gathering and they went quickly. Consistent and refreshing.' },
    ],
    low: [
      { title: 'Quite sweet', comment: 'Drinkable but noticeably sugary. Fine over plenty of ice.' },
    ],
  },

  softDrink: {
    high: [
      { title: 'Perfectly chilled', comment: 'Arrived cold and properly fizzy. Whole pack was in excellent condition, not a single dent.' },
      { title: 'Great value', comment: 'Strong flavour with plenty of carbonation. The kids finished the pack in two days.' },
    ],
    mid: [
      { title: 'Good order', comment: 'Reliable quality and quick delivery. Nothing was leaking or damaged.' },
    ],
    low: [
      { title: 'Bit flat', comment: 'A couple of the bottles had lost their fizz. The rest were fine.' },
    ],
  },

  nonAlcoholic: {
    high: [
      { title: 'Genuinely impressive', comment: 'Does not taste like a compromise at all. Full flavour and I did not miss the alcohol one bit.' },
    ],
    mid: [
      { title: 'Pretty good', comment: 'Bought it for a friend who does not drink and we all had some. Better than expected.' },
    ],
    low: [
      { title: 'Not quite there', comment: 'Decent effort but you can tell something is missing. Refreshing enough over ice.' },
    ],
  },

  generic: {
    high: [
      { title: 'Very happy', comment: 'Exactly as described and the quality is excellent. Packaging was secure and delivery on time.' },
      { title: 'Excellent', comment: 'No complaints at all. Arrived in perfect condition and tastes just as I hoped it would.' },
    ],
    mid: [
      { title: 'Good purchase', comment: 'Straightforward ordering, quick delivery and the product itself is solid. Would order again.' },
      { title: 'Happy with it', comment: 'Arrived well packaged and as described. Good quality for what I paid.' },
    ],
    low: [
      { title: 'Ordinary', comment: 'Nothing wrong with the order but the product itself is fairly ordinary. Delivery was fine.' },
    ],
  },
};

module.exports = { BODIES };
