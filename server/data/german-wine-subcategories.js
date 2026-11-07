// Country-qualified additions, preserving existing generic grape/style entries.
const categories = [];
const subcategories = [];
const add = (parent, name, slug, blurb) => subcategories.push({parent,name,slug,blurb,create:true});
for (const [name,slug,grape] of [
 ['Riesling','riesling','Riesling'],
 ['Müller-Thurgau (Rivaner)','muller-thurgau','Müller-Thurgau, also called Rivaner'],
 ['Silvaner','silvaner','Silvaner'],
 ['Grauburgunder (Pinot Gris)','grauburgunder','Grauburgunder (Pinot Gris)'],
 ['Weissburgunder (Pinot Blanc)','weissburgunder','Weissburgunder (Pinot Blanc)'],
 ['Kerner','kerner','Kerner'],['Scheurebe','scheurebe','Scheurebe'],
 ['Bacchus','bacchus','Bacchus'],['Gutedel (Chasselas)','gutedel','Gutedel (Chasselas)'],
 ['Elbling','elbling','Elbling'],['Gewürztraminer','gewurztraminer','Gewürztraminer'],
 ['Morio-Muskat','morio-muskat','Morio-Muskat'],
]) add('white-wine','German '+name,'german-'+slug,`German white wine made from ${grape}.`);
for (const [name,slug,grape] of [
 ['Spätburgunder (Pinot Noir)','spatburgunder','Spätburgunder (Pinot Noir)'],
 ['Dornfelder','dornfelder','Dornfelder'],['Lemberger (Blaufränkisch)','lemberger','Lemberger (Blaufränkisch)'],
 ['Trollinger','trollinger','Trollinger'],['Schwarzriesling (Pinot Meunier)','schwarzriesling','Schwarzriesling (Pinot Meunier)'],
 ['Frühburgunder','fruhburgunder','Frühburgunder'],['Regent','regent','Regent'],['Domina','domina','Domina'],
]) add('red-wine','German '+name,'german-'+slug,`German red wine made from ${grape}.`);
for (const [parent,name,slug,region] of [
 ['white-wine','Mosel Riesling','mosel-riesling','Mosel'],
 ['white-wine','Rheingau Riesling','rheingau-riesling','Rheingau'],
 ['white-wine','Rheinhessen White Wine','rheinhessen-white-wine','Rheinhessen'],
 ['white-wine','Pfalz White Wine','pfalz-white-wine','Pfalz'],
 ['white-wine','Nahe White Wine','nahe-white-wine','Nahe'],
 ['white-wine','Franken Silvaner','franken-silvaner','Franken'],
 ['white-wine','Baden White Wine','baden-white-wine','Baden'],
 ['red-wine','Württemberg Red Wine','wurttemberg-red-wine','Württemberg'],
 ['red-wine','Ahr Spätburgunder','ahr-spatburgunder','Ahr'],
 ['white-wine','Mittelrhein Riesling','mittelrhein-riesling','Mittelrhein'],
 ['white-wine','Hessische Bergstraße White Wine','hessische-bergstrasse-white-wine','Hessische Bergstraße'],
 ['white-wine','Saale-Unstrut White Wine','saale-unstrut-white-wine','Saale-Unstrut'],
 ['white-wine','Sachsen White Wine','sachsen-white-wine','Sachsen'],
]) add(parent,name,slug,`${name} from Germany’s ${region} wine-growing region.`);
for (const [name,slug] of [
 ['Kabinett','kabinett'],['Spätlese','spatlese'],['Auslese','auslese'],
 ['Beerenauslese','beerenauslese'],['Trockenbeerenauslese','trockenbeerenauslese'],['Eiswein','eiswein'],
]) add('white-wine','German Riesling '+name,'german-riesling-'+slug,
 `German Riesling carrying the ${name} Prädikat designation. Verify sweetness separately from the Prädikat label.`);
add('white-wine','Liebfraumilch','liebfraumilch','German white wine labelled Liebfraumilch.');
add('rose-wine','German Spätburgunder Rosé','german-spatburgunder-rose','German rosé wine made from Spätburgunder (Pinot Noir).');
add('rose-wine','German Dornfelder Rosé','german-dornfelder-rose','German rosé wine made from Dornfelder.');
add('rose-wine','Weissherbst','weissherbst','German rosé wine carrying the Weissherbst designation.');
for (const [name,slug,blurb] of [
 ['Deutscher Sekt','deutscher-sekt','Sekt made from German base wines and labelled Deutscher Sekt.'],
 ['Winzersekt','winzersekt','German sparkling wine carrying the estate-produced Winzersekt designation.'],
 ['German Riesling Sekt','german-riesling-sekt','German sparkling wine made from Riesling.'],
 ['German Rosé Sekt','german-rose-sekt','German rosé sparkling wine labelled Sekt.'],
 ['German Perlwein','german-perlwein','German semi-sparkling wine labelled Perlwein.'],
]) add('sparkling-wine',name,slug,blurb);
module.exports = {categories,subcategories};
