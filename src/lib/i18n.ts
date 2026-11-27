import { useSyncExternalStore } from 'react';
import portionNamesEn from './portion-names.en.json';

export type Lang = 'en' | 'nb';
export type LangSetting = 'auto' | Lang;

const en = {
  'nav.diary': 'Diary',
  'nav.foods': 'My foods',
  'nav.settings': 'Settings',
  'nav.main': 'Main',

  'common.back': 'Back',
  'common.loading': 'Loading…',
  'common.save': 'Save',
  'common.close': 'Close',
  'common.cancel': 'Cancel',

  'day.today': 'Today',
  'day.yesterday': 'Yesterday',
  'day.tomorrow': 'Tomorrow',
  'day.prev': 'Previous day',
  'day.next': 'Next day',
  'day.goToday': 'Go to today',
  'cal.open': 'Choose date',
  'cal.close': 'Close',
  'cal.prevMonth': 'Previous month',
  'cal.nextMonth': 'Next month',
  'cal.within': 'Within goal',
  'cal.over': 'Over goal',

  'meal.breakfast': 'Breakfast',
  'meal.lunch': 'Lunch',
  'meal.dinner': 'Dinner',
  'meal.snacks': 'Snacks',
  'meal.label': 'Meal',

  'source.matvaretabellen': 'Matvaretabellen',
  'source.openfoodfacts': 'Open Food Facts',
  'source.vetduat': 'VetDuAt',
  'source.custom': 'My food',
  'source.quick': 'Quick add',
  'source.recipe': 'Recipe',

  'summary.aria': 'Daily summary',
  'summary.left': 'kcal left',
  'summary.over': 'kcal over',
  'summary.eaten': 'eaten',
  'summary.goal': 'goal',
  'summary.eatenBig': 'kcal eaten',
  'summary.leftShort': 'left',
  'summary.modeEaten': 'Eaten',
  'summary.modeLeft': 'Left',
  'summary.modeAria': 'Show eaten or left',
  'summary.gLeft': '{g} g left',
  'summary.gOver': '{g} g over',

  'macro.protein': 'Protein',
  'macro.carbs': 'Carbs',
  'macro.fat': 'Fat',
  'macro.kcalShort': 'kcal',
  'macro.proteinShort': 'protein',
  'macro.carbsShort': 'carbs',
  'macro.fatShort': 'fat',

  'unit.grams': 'grams',
  'unit.package': 'package',
  'unit.serving': 'serving',
  'unit.recipe': 'whole recipe',
  'unit.kcal': 'kcal',
  'unit.protein': 'g protein',
  'unit.kcalPer100': 'kcal/100 g',
  'unit.kcalPerServing': 'kcal/serving',
  'unit.kcalPerRecipe': 'kcal/recipe',

  'diary.addFood': 'Add food',
  'diary.copyYesterday': 'Copy {count} from yesterday · {kcal} kcal',
  'diary.delete': 'Delete',
  'diary.fromRecipe': 'From {name}',
  'diary.deleteRecipe': 'Delete all of {name}',
  'diary.deleted': 'Deleted “{name}”',
  'diary.undo': 'Undo',

  'add.to': 'Add to',
  'add.search': 'Search foods',
  'add.scan': 'Scan',
  'add.create': 'Create food',
  'add.quick': 'Quick add',
  'add.recipe': 'Recipes',
  'recipes.title': 'Recipe for {meal}',
  'recipes.empty': 'No recipes yet. Make one from the foods you use, and log it here in one go.',
  'add.recent': 'Recent',
  'add.emptyCount': 'Search {count} foods from Matvaretabellen, Norwegian grocery products and your own, or scan a barcode.',
  'add.empty': 'Search Matvaretabellen, Norwegian grocery products and your own foods, or scan a barcode.',
  'add.noNutrition': 'no nutrition data, add it from the label',
  'add.keyHint': 'Add a VetDuAt proxy in Settings to also search Norwegian grocery products.',
  'search.filterAria': 'Filter results by source',
  'search.all': 'All',
  'search.mine': 'My foods',
  'search.mineShort': 'Mine',
  'search.vetduat': 'Groceries (VetDuAt)',
  'search.searchingIn': 'Searching {source}…',
  'search.showAll': 'Show all {count}',
  'search.noMatches': 'No matches.',
  'search.noMatchesAnywhere': 'No matches in any source.',
  'search.retry': 'Try again',

  'log.addTo': 'Add to {meal}',
  'log.addFood': 'Add food',
  'log.edit': 'Edit entry',
  'log.entry': 'Entry',
  'log.entryGone': 'This entry no longer exists.',
  'log.foodGone': 'This food could not be found.',
  'log.editFood': 'Edit food',
  'log.amount': 'Amount',
  'log.quantity': 'Quantity',
  'log.unit': 'Unit',
  'log.per100': 'Per 100 g',
  'log.delete': 'Delete entry',
  'log.addButton': 'Add {kcal} kcal to {meal}',

  'nutr.energy': 'Energy',
  'nutr.protein': 'Protein',
  'nutr.carbs': 'Carbs',
  'nutr.sugar': 'of which sugars',
  'nutr.fat': 'Fat',
  'nutr.satFat': 'of which saturated',
  'nutr.fiber': 'Fiber',
  'nutr.salt': 'Salt',

  'field.kcal': 'Energy (kcal)',
  'field.protein': 'Protein (g)',
  'field.carbs': 'Carbohydrates (g)',
  'field.sugar': 'of which sugars (g)',
  'field.fat': 'Fat (g)',
  'field.satFat': 'of which saturated (g)',
  'field.fiber': 'Fiber (g)',
  'field.salt': 'Salt (g)',

  'quick.title': 'Quick add to {meal}',
  'quick.editTitle': 'Edit quick add',
  'quick.description': 'Description (optional)',
  'quick.placeholder': 'e.g. Lunch at work',
  'quick.kcal': 'Calories (kcal)',
  'quick.fromMacros': '{kcal} from macros',
  'quick.carbs': 'Carbs (g)',
  'quick.add': 'Add {kcal} kcal',

  'food.title': 'Food',
  'food.new': 'New food',
  'food.edit': 'Edit food',
  'food.gone': 'This food no longer exists.',
  'food.notFound': 'Barcode {ean} wasn’t found. Enter the values from the label (per 100 g) and it will be saved for next time.',
  'food.noNutrition': 'No nutrition data was found for this product. Copy the values from the label (per 100 g).',
  'food.name': 'Name',
  'food.brand': 'Brand',
  'food.barcode': 'Barcode',
  'food.per100': 'Per 100 g',
  'food.estimate': 'Macros add up to about {kcal} kcal.',
  'food.estimateUsed': 'That will be used if you leave energy empty.',
  'food.sizes': 'Sizes (optional)',
  'food.servingName': 'Serving name',
  'food.servingPlaceholder': 'e.g. slice',
  'food.servingGrams': 'Serving (g)',
  'food.packageGrams': 'Package (g)',
  'food.delete': 'Delete food',
  'food.confirmDelete': 'Delete “{name}”? Entries you already logged keep their values.',
  'food.errName': 'Give the food a name.',
  'food.errKcal': 'Enter the energy (kcal) per 100 g, or the macros.',
  'food.saveContinue': 'Save and continue',
  'food.save': 'Save food',

  'recipe.new': 'New recipe',
  'recipe.edit': 'Edit recipe',
  'recipe.namePlaceholder': 'e.g. Cottage cheese with apple & peanut butter',
  'recipe.servings': 'Servings',
  'recipe.cookedGrams': 'Cooked weight (g)',
  'recipe.save': 'Save recipe',
  'recipe.cookedHint': 'Optional. Fill in cooked weight if cooking changes it; otherwise the ingredients are added up: {grams} g.',
  'recipe.ingredients': 'Ingredients',
  'recipe.addIngredient': 'Add ingredient',
  'recipe.noIngredients': 'No ingredients yet. Add what goes into it, with amounts.',
  'recipe.whole': 'Whole recipe ({grams} g)',
  'recipe.perServing': 'Per serving ({grams} g)',
  'recipe.delete': 'Delete recipe',
  'recipe.errIngredients': 'Add at least one ingredient.',
  'ingredient.add': 'Add ingredient',
  'ingredient.edit': 'Change ingredient',
  'ingredient.remove': 'Remove',
  'ingredient.notFound': '{code} wasn’t found. Create it under My foods first, then add it here.',
  'ingredient.scanTitle': 'Scan ingredient',
  'ingredient.addButton': 'Add {grams} g',

  'share.button': 'Share',
  'share.text': '{name} – a food for Matlogg',
  'share.copied': 'Link copied. Send it to someone who uses Matlogg; opening it lets them save the food.',
  'import.title': 'Shared food',
  'import.intro': 'Someone shared this food with you. Save it to add it to your foods.',
  'import.save': 'Save to my foods',
  'import.invalid': 'This share link is broken or incomplete. Ask for a new one.',

  'foods.title': 'My foods',
  'foods.new': 'New food',
  'foods.hint': 'Foods you created or scanned. Edit one to fix wrong values; past entries keep theirs.',
  'foods.filter': 'Filter',
  'foods.noMatches': 'No matches.',
  'foods.empty': 'Nothing here yet. Scan a barcode or create a food.',

  'scan.title': 'Scan barcode',
  'scan.looking': 'Looking up {code}…',
  'scan.notFoundWarn': '{code} wasn’t found, and a source failed: {warnings}',
  'scan.retry': 'Try again',
  'scan.manual': 'Enter manually',
  'scan.another': 'Scan another',
  'scan.typeLabel': 'Or type the barcode',
  'scan.placeholder': 'e.g. 7038010009457',
  'scan.lookup': 'Look up',
  'scan.offOnly':
    'Looking up in Open Food Facts only. Add a VetDuAt proxy in Settings for better coverage of Norwegian products.',

  'camera.starting': 'Starting camera…',
  'camera.https': 'The camera needs a secure (HTTPS) connection. Type the barcode below.',
  'camera.denied': 'Camera access was denied. Allow it in your browser settings, or type the barcode below.',
  'camera.none': 'No camera found. Type the barcode below.',
  'camera.busy': 'The camera is in use by another app.',
  'camera.failed': 'Could not start the camera: {message}',

  'lookup.offUnreachable': 'Could not reach Open Food Facts. Check your connection.',
  'lookup.offError': 'Open Food Facts error (HTTP {status})',
  'lookup.offTimeout': 'Open Food Facts took too long to answer. Try again.',
  'lookup.offSearchBusy': 'Open Food Facts search is unavailable right now (it limits searches when busy). Scanning barcodes still works.',
  'lookup.vetduatUnreachable': 'Could not reach the VetDuAt proxy. Check the address in Settings.',
  'lookup.vetduatError': 'VetDuAt proxy error (HTTP {status})',
  'lookup.vetduatTimeout': 'The VetDuAt proxy took too long to answer. Try again.',
  'mvt.loadError': 'Could not load Matvaretabellen (HTTP {status})',

  'settings.title': 'Settings',
  'settings.language': 'Language',
  'settings.langAuto': 'Same as device',
  'settings.theme': 'Theme',
  'settings.themeAuto': 'Auto',
  'settings.themeLight': 'Light',
  'settings.themeDark': 'Dark',
  'settings.goals': 'Daily goals',
  'settings.goalKcal': 'Calories (kcal)',
  'settings.goalProtein': 'Protein (g)',
  'settings.goalCarbs': 'Carbs (g)',
  'settings.goalFat': 'Fat (g)',
  'settings.carbsMode': 'Carbs goal',
  'settings.carbsFixed': 'Set grams',
  'settings.carbsRest': 'Rest of calories',
  'settings.carbsRestHint': 'Carbs get the calories left after protein and fat: {kcal} − {proteinKcal} − {fatKcal} = {carbsKcal} kcal ≈ {carbs} g.',
  'settings.carbsRestNegative': 'Protein and fat alone add up to {kcal} kcal, more than your calorie goal.',
  'settings.macroSum': 'Your macro goals add up to {kcal} kcal.',
  'settings.saveGoals': 'Save goals',
  'settings.goalsSaved': 'Goals saved.',
  'settings.meals': 'Meals',
  'settings.mealsHint': 'The meals in your diary. Rename, reorder, add or remove them.',
  'settings.mealNameAria': 'Name of {meal}',
  'settings.mealUp': 'Move {meal} up',
  'settings.mealDown': 'Move {meal} down',
  'settings.mealRemove': 'Remove {meal}',
  'settings.mealMoveEntries': '{meal} has diary entries ({count}). Move them to:',
  'settings.mealMoveAndRemove': 'Move and remove',
  'settings.mealNewPlaceholder': 'New meal, e.g. Supper',
  'settings.mealAdd': 'Add',
  'settings.mealRemoved': '{meal} removed.',
  'settings.mealRemovedMoved': '{meal} removed. Its entries ({count}) were moved to {target}.',
  'settings.save': 'Save',
  'settings.test': 'Test',
  'settings.testing': 'Testing…',
  'settings.vetduatTitle': 'VetDuAt (Tradesolution EPD)',
  'settings.vetduatHint':
    'The most complete source for Norwegian grocery products (Tradesolution EPD). When set up, barcode scans try it first. Needs a proxy you host, since its API only accepts requests from vetduat.no. Paste the proxy address below.',
  'settings.vetduatUrl': 'Proxy address',
  'settings.vetduatUrlAria': 'VetDuAt proxy address',
  'settings.vetduatSaved': 'VetDuAt proxy saved.',
  'settings.vetduatRemoved': 'VetDuAt proxy removed.',
  'settings.vetduatWorksFound': 'The proxy works. Test lookup found “{name}”.',
  'settings.vetduatWorks': 'The proxy works, but the test product was not found.',
  'settings.data': 'Your data',
  'settings.dataHint':
    'Everything is stored in this browser on this device. Export a backup now and then, and import it to move to another device.',
  'settings.export': 'Export backup',
  'settings.import': 'Import backup',
  'settings.deleteAll': 'Delete all data',
  'settings.deleteAllConfirm':
    'Delete all diary entries, foods, recipes and settings on this device? This cannot be undone. Export a backup first if you want to keep anything.',
  'settings.importConfirm': 'Import {entries} diary entries and {foods} foods from {date}? Items with the same id are replaced.',
  'settings.imported': 'Backup imported.',
  'settings.notBackup': 'This is not a Matlogg backup file.',
  'settings.mayClear': 'The browser may clear this data if the device runs low on space.',
  'settings.askKeep': 'Ask to keep it',
  'settings.kept': 'The browser has agreed to keep this data.',
  'settings.about': 'About',
  'settings.aboutMvt1': 'Nutrition data for basic foods comes from ',
  'settings.aboutMvt2': ', the Norwegian Food Composition Table by Mattilsynet',
  'settings.downloaded': ' (downloaded {date})',
  'settings.aboutProducts1': 'Product data comes from ',
  'settings.and': ' and ',
  'settings.aboutProducts2': ' (Open Database License).',
} as const;

export type MessageKey = keyof typeof en;

const nb: Record<MessageKey, string> = {
  'nav.diary': 'Dagbok',
  'nav.foods': 'Mine matvarer',
  'nav.settings': 'Innstillinger',
  'nav.main': 'Hovedmeny',

  'common.back': 'Tilbake',
  'common.loading': 'Laster…',
  'common.save': 'Lagre',
  'common.close': 'Lukk',
  'common.cancel': 'Avbryt',

  'day.today': 'I dag',
  'day.yesterday': 'I går',
  'day.tomorrow': 'I morgen',
  'day.prev': 'Forrige dag',
  'day.next': 'Neste dag',
  'day.goToday': 'Gå til i dag',
  'cal.open': 'Velg dato',
  'cal.close': 'Lukk',
  'cal.prevMonth': 'Forrige måned',
  'cal.nextMonth': 'Neste måned',
  'cal.within': 'Innenfor målet',
  'cal.over': 'Over målet',

  'meal.breakfast': 'Frokost',
  'meal.lunch': 'Lunsj',
  'meal.dinner': 'Middag',
  'meal.snacks': 'Mellommåltid',
  'meal.label': 'Måltid',

  'source.matvaretabellen': 'Matvaretabellen',
  'source.openfoodfacts': 'Open Food Facts',
  'source.vetduat': 'VetDuAt',
  'source.custom': 'Min matvare',
  'source.quick': 'Hurtigregistrering',
  'source.recipe': 'Oppskrift',

  'summary.aria': 'Dagens oppsummering',
  'summary.left': 'kcal igjen',
  'summary.over': 'kcal over',
  'summary.eaten': 'spist',
  'summary.goal': 'mål',
  'summary.eatenBig': 'kcal spist',
  'summary.leftShort': 'igjen',
  'summary.modeEaten': 'Spist',
  'summary.modeLeft': 'Igjen',
  'summary.modeAria': 'Vis spist eller igjen',
  'summary.gLeft': '{g} g igjen',
  'summary.gOver': '{g} g over',

  'macro.protein': 'Protein',
  'macro.carbs': 'Karbohydrater',
  'macro.fat': 'Fett',
  'macro.kcalShort': 'kcal',
  'macro.proteinShort': 'protein',
  'macro.carbsShort': 'karbo',
  'macro.fatShort': 'fett',

  'unit.grams': 'gram',
  'unit.package': 'pakke',
  'unit.serving': 'porsjon',
  'unit.recipe': 'hele oppskriften',
  'unit.kcal': 'kcal',
  'unit.protein': 'g protein',
  'unit.kcalPer100': 'kcal/100 g',
  'unit.kcalPerServing': 'kcal/porsjon',
  'unit.kcalPerRecipe': 'kcal/oppskrift',

  'diary.addFood': 'Legg til mat',
  'diary.copyYesterday': 'Kopier {count} fra i går · {kcal} kcal',
  'diary.delete': 'Slett',
  'diary.fromRecipe': 'Fra {name}',
  'diary.deleteRecipe': 'Slett hele {name}',
  'diary.deleted': 'Slettet «{name}»',
  'diary.undo': 'Angre',

  'add.to': 'Legg til i',
  'add.search': 'Søk etter mat',
  'add.scan': 'Skann',
  'add.create': 'Ny matvare',
  'add.quick': 'Hurtig',
  'add.recipe': 'Oppskrifter',
  'recipes.title': 'Oppskrift til {meal}',
  'recipes.empty': 'Ingen oppskrifter ennå. Lag en av matvarene du bruker, og legg den til her på én gang.',
  'add.recent': 'Nylig brukt',
  'add.emptyCount': 'Søk blant {count} matvarer fra Matvaretabellen, norske dagligvarer og dine egne, eller skann en strekkode.',
  'add.empty': 'Søk i Matvaretabellen, norske dagligvarer og dine egne matvarer, eller skann en strekkode.',
  'add.noNutrition': 'mangler næringsinnhold, legg det inn fra etiketten',
  'add.keyHint': 'Legg inn en VetDuAt-proxy i Innstillinger for å også søke i norske dagligvareprodukter.',
  'search.filterAria': 'Filtrer treff etter kilde',
  'search.all': 'Alle',
  'search.mine': 'Mine matvarer',
  'search.mineShort': 'Mine',
  'search.vetduat': 'Dagligvarer (VetDuAt)',
  'search.searchingIn': 'Søker i {source}…',
  'search.showAll': 'Vis alle {count}',
  'search.noMatches': 'Ingen treff.',
  'search.noMatchesAnywhere': 'Ingen treff i noen kilder.',
  'search.retry': 'Prøv igjen',

  'log.addTo': 'Legg til i {meal}',
  'log.addFood': 'Legg til mat',
  'log.edit': 'Rediger oppføring',
  'log.entry': 'Oppføring',
  'log.entryGone': 'Denne oppføringen finnes ikke lenger.',
  'log.foodGone': 'Fant ikke denne matvaren.',
  'log.editFood': 'Rediger matvare',
  'log.amount': 'Mengde',
  'log.quantity': 'Antall',
  'log.unit': 'Enhet',
  'log.per100': 'Per 100 g',
  'log.delete': 'Slett oppføring',
  'log.addButton': 'Legg til {kcal} kcal i {meal}',

  'nutr.energy': 'Energi',
  'nutr.protein': 'Protein',
  'nutr.carbs': 'Karbohydrater',
  'nutr.sugar': 'hvorav sukkerarter',
  'nutr.fat': 'Fett',
  'nutr.satFat': 'hvorav mettede fettsyrer',
  'nutr.fiber': 'Kostfiber',
  'nutr.salt': 'Salt',

  'field.kcal': 'Energi (kcal)',
  'field.protein': 'Protein (g)',
  'field.carbs': 'Karbohydrater (g)',
  'field.sugar': 'hvorav sukkerarter (g)',
  'field.fat': 'Fett (g)',
  'field.satFat': 'hvorav mettede fettsyrer (g)',
  'field.fiber': 'Kostfiber (g)',
  'field.salt': 'Salt (g)',

  'quick.title': 'Hurtigregistrering i {meal}',
  'quick.editTitle': 'Rediger hurtigregistrering',
  'quick.description': 'Beskrivelse (valgfritt)',
  'quick.placeholder': 'f.eks. Lunsj på jobben',
  'quick.kcal': 'Kalorier (kcal)',
  'quick.fromMacros': '{kcal} fra makroene',
  'quick.carbs': 'Karbo (g)',
  'quick.add': 'Legg til {kcal} kcal',

  'food.title': 'Matvare',
  'food.new': 'Ny matvare',
  'food.edit': 'Rediger matvare',
  'food.gone': 'Denne matvaren finnes ikke lenger.',
  'food.notFound': 'Fant ikke strekkoden {ean}. Legg inn verdiene fra etiketten (per 100 g), så er den lagret til neste gang.',
  'food.noNutrition': 'Fant ikke næringsinnhold for dette produktet. Skriv av verdiene fra etiketten (per 100 g).',
  'food.name': 'Navn',
  'food.brand': 'Merke',
  'food.barcode': 'Strekkode',
  'food.per100': 'Per 100 g',
  'food.estimate': 'Makroene tilsvarer omtrent {kcal} kcal.',
  'food.estimateUsed': 'Det brukes hvis du lar energi stå tomt.',
  'food.sizes': 'Størrelser (valgfritt)',
  'food.servingName': 'Porsjonsnavn',
  'food.servingPlaceholder': 'f.eks. skive',
  'food.servingGrams': 'Porsjon (g)',
  'food.packageGrams': 'Pakke (g)',
  'food.delete': 'Slett matvare',
  'food.confirmDelete': 'Slette «{name}»? Oppføringer du allerede har logget, beholder verdiene sine.',
  'food.errName': 'Gi matvaren et navn.',
  'food.errKcal': 'Legg inn energi (kcal) per 100 g, eller makroene.',
  'food.saveContinue': 'Lagre og fortsett',
  'food.save': 'Lagre matvare',

  'recipe.new': 'Ny oppskrift',
  'recipe.edit': 'Rediger oppskrift',
  'recipe.namePlaceholder': 'f.eks. Cottage cheese med eple og peanøttsmør',
  'recipe.servings': 'Porsjoner',
  'recipe.cookedGrams': 'Ferdig vekt (g)',
  'recipe.save': 'Lagre oppskrift',
  'recipe.cookedHint': 'Valgfritt. Fyll inn ferdig vekt hvis tilberedningen endrer den; ellers summeres ingrediensene: {grams} g.',
  'recipe.ingredients': 'Ingredienser',
  'recipe.addIngredient': 'Legg til ingrediens',
  'recipe.noIngredients': 'Ingen ingredienser ennå. Legg til det som går i den, med mengde.',
  'recipe.whole': 'Hele oppskriften ({grams} g)',
  'recipe.perServing': 'Per porsjon ({grams} g)',
  'recipe.delete': 'Slett oppskrift',
  'recipe.errIngredients': 'Legg til minst én ingrediens.',
  'ingredient.add': 'Legg til ingrediens',
  'ingredient.edit': 'Endre ingrediens',
  'ingredient.remove': 'Fjern',
  'ingredient.notFound': 'Fant ikke {code}. Lag matvaren under Mine matvarer først, og legg den til her etterpå.',
  'ingredient.scanTitle': 'Skann ingrediens',
  'ingredient.addButton': 'Legg til {grams} g',

  'share.button': 'Del',
  'share.text': '{name} – en matvare til Matlogg',
  'share.copied': 'Lenken er kopiert. Send den til noen som bruker Matlogg; når de åpner den, kan de lagre matvaren.',
  'import.title': 'Delt matvare',
  'import.intro': 'Noen har delt denne matvaren med deg. Lagre den for å legge den til i matvarene dine.',
  'import.save': 'Lagre i mine matvarer',
  'import.invalid': 'Denne delingslenken er ødelagt eller ufullstendig. Be om en ny.',

  'foods.title': 'Mine matvarer',
  'foods.new': 'Ny matvare',
  'foods.hint': 'Matvarer du har laget eller skannet. Rediger en for å rette feil verdier; tidligere oppføringer beholder sine.',
  'foods.filter': 'Filtrer',
  'foods.noMatches': 'Ingen treff.',
  'foods.empty': 'Ingenting her ennå. Skann en strekkode eller lag en matvare.',

  'scan.title': 'Skann strekkode',
  'scan.looking': 'Slår opp {code}…',
  'scan.notFoundWarn': 'Fant ikke {code}, og en kilde feilet: {warnings}',
  'scan.retry': 'Prøv igjen',
  'scan.manual': 'Legg inn manuelt',
  'scan.another': 'Skann en annen',
  'scan.typeLabel': 'Eller skriv inn strekkoden',
  'scan.placeholder': 'f.eks. 7038010009457',
  'scan.lookup': 'Slå opp',
  'scan.offOnly':
    'Slår bare opp i Open Food Facts. Legg inn en VetDuAt-proxy i Innstillinger for bedre dekning av norske produkter.',

  'camera.starting': 'Starter kameraet…',
  'camera.https': 'Kameraet krever en sikker (HTTPS) tilkobling. Skriv inn strekkoden nedenfor.',
  'camera.denied': 'Tilgang til kameraet ble avvist. Tillat det i nettleserinnstillingene, eller skriv inn strekkoden nedenfor.',
  'camera.none': 'Fant ikke noe kamera. Skriv inn strekkoden nedenfor.',
  'camera.busy': 'Kameraet brukes av en annen app.',
  'camera.failed': 'Kunne ikke starte kameraet: {message}',

  'lookup.offUnreachable': 'Fikk ikke kontakt med Open Food Facts. Sjekk nettforbindelsen.',
  'lookup.offError': 'Feil fra Open Food Facts (HTTP {status})',
  'lookup.offTimeout': 'Open Food Facts brukte for lang tid på å svare. Prøv igjen.',
  'lookup.offSearchBusy': 'Open Food Facts-søket er utilgjengelig akkurat nå (de begrenser søk ved høy pågang). Strekkodeskanning virker fortsatt.',
  'lookup.vetduatUnreachable': 'Fikk ikke kontakt med VetDuAt-proxyen. Sjekk adressen i Innstillinger.',
  'lookup.vetduatError': 'Feil fra VetDuAt-proxyen (HTTP {status})',
  'lookup.vetduatTimeout': 'VetDuAt-proxyen brukte for lang tid på å svare. Prøv igjen.',
  'mvt.loadError': 'Kunne ikke laste Matvaretabellen (HTTP {status})',

  'settings.title': 'Innstillinger',
  'settings.language': 'Språk',
  'settings.langAuto': 'Som enheten',
  'settings.theme': 'Tema',
  'settings.themeAuto': 'Auto',
  'settings.themeLight': 'Lys',
  'settings.themeDark': 'Mørk',
  'settings.goals': 'Daglige mål',
  'settings.goalKcal': 'Kalorier (kcal)',
  'settings.goalProtein': 'Protein (g)',
  'settings.goalCarbs': 'Karbohydrater (g)',
  'settings.goalFat': 'Fett (g)',
  'settings.carbsMode': 'Mål for karbohydrater',
  'settings.carbsFixed': 'Fast mengde',
  'settings.carbsRest': 'Resten av kaloriene',
  'settings.carbsRestHint':
    'Karbohydratene får kaloriene som er igjen etter protein og fett: {kcal} − {proteinKcal} − {fatKcal} = {carbsKcal} kcal ≈ {carbs} g.',
  'settings.carbsRestNegative': 'Protein og fett alene utgjør {kcal} kcal, mer enn kalorimålet ditt.',
  'settings.macroSum': 'Makromålene dine tilsvarer {kcal} kcal.',
  'settings.saveGoals': 'Lagre mål',
  'settings.goalsSaved': 'Målene er lagret.',
  'settings.meals': 'Måltider',
  'settings.mealsHint': 'Måltidene i dagboken. Gi dem nytt navn, endre rekkefølgen, legg til eller fjern.',
  'settings.mealNameAria': 'Navn på {meal}',
  'settings.mealUp': 'Flytt {meal} opp',
  'settings.mealDown': 'Flytt {meal} ned',
  'settings.mealRemove': 'Fjern {meal}',
  'settings.mealMoveEntries': '{meal} har dagbokoppføringer ({count}). Flytt dem til:',
  'settings.mealMoveAndRemove': 'Flytt og fjern',
  'settings.mealNewPlaceholder': 'Nytt måltid, f.eks. Kveldsmat',
  'settings.mealAdd': 'Legg til',
  'settings.mealRemoved': '{meal} er fjernet.',
  'settings.mealRemovedMoved': '{meal} er fjernet. Oppføringene ({count}) ble flyttet til {target}.',
  'settings.save': 'Lagre',
  'settings.test': 'Test',
  'settings.testing': 'Tester…',
  'settings.vetduatTitle': 'VetDuAt (Tradesolution EPD)',
  'settings.vetduatHint':
    'Den mest komplette kilden for norske dagligvarer (Tradesolution EPD). Når den er satt opp, prøves den først ved strekkodeskanning. Krever en proxy du selv drifter, siden API-et bare godtar forespørsler fra vetduat.no. Lim inn proxy-adressen under.',
  'settings.vetduatUrl': 'Proxy-adresse',
  'settings.vetduatUrlAria': 'Proxy-adresse for VetDuAt',
  'settings.vetduatSaved': 'VetDuAt-proxyen er lagret.',
  'settings.vetduatRemoved': 'VetDuAt-proxyen er fjernet.',
  'settings.vetduatWorksFound': 'Proxyen virker. Testoppslaget fant «{name}».',
  'settings.vetduatWorks': 'Proxyen virker, men testproduktet ble ikke funnet.',
  'settings.data': 'Dine data',
  'settings.dataHint':
    'Alt lagres i nettleseren på denne enheten. Eksporter en sikkerhetskopi av og til, og importer den for å flytte til en annen enhet.',
  'settings.export': 'Eksporter sikkerhetskopi',
  'settings.import': 'Importer sikkerhetskopi',
  'settings.deleteAll': 'Slett alle data',
  'settings.deleteAllConfirm':
    'Slette alle dagbokføringer, matvarer, oppskrifter og innstillinger på denne enheten? Dette kan ikke angres. Eksporter en sikkerhetskopi først hvis du vil beholde noe.',
  'settings.importConfirm':
    'Importere {entries} dagbokoppføringer og {foods} matvarer fra {date}? Elementer med samme id blir erstattet.',
  'settings.imported': 'Sikkerhetskopien er importert.',
  'settings.notBackup': 'Dette er ikke en sikkerhetskopi fra Matlogg.',
  'settings.mayClear': 'Nettleseren kan slette disse dataene hvis enheten får lite lagringsplass.',
  'settings.askKeep': 'Be om å beholde dem',
  'settings.kept': 'Nettleseren har lovet å beholde disse dataene.',
  'settings.about': 'Om',
  'settings.aboutMvt1': 'Næringsdata for basismatvarer kommer fra ',
  'settings.aboutMvt2': ', Mattilsynets offisielle matvaretabell',
  'settings.downloaded': ' (lastet ned {date})',
  'settings.aboutProducts1': 'Produktdata kommer fra ',
  'settings.and': ' og ',
  'settings.aboutProducts2': ' (Open Database License).',
};

const MESSAGES: Record<Lang, Record<MessageKey, string>> = { en, nb };

const STORAGE_KEY = 'matlogg.lang';
const listeners = new Set<() => void>();

function readSetting(): LangSetting {
  try {
    const v = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (v === 'en' || v === 'nb') return v;
  } catch {
  }
  return 'auto';
}

export function detectLang(languages: readonly string[] = globalThis.navigator?.languages ?? []): Lang {
  for (const l of languages) {
    const code = l.toLowerCase().slice(0, 2);
    if (code === 'nb' || code === 'no' || code === 'nn') return 'nb';
    if (code === 'en') return 'en';
  }
  return 'en';
}

let setting: LangSetting = readSetting();
let lang: Lang = setting === 'auto' ? detectLang() : setting;

function applyDocumentLang() {
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}
applyDocumentLang();

export function getLang(): Lang {
  return lang;
}

export function getLangSetting(): LangSetting {
  return setting;
}

export function setLangSetting(next: LangSetting) {
  setting = next;
  try {
    if (next === 'auto') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, next);
  } catch {
  }
  lang = next === 'auto' ? detectLang() : next;
  applyDocumentLang();
  for (const l of listeners) l();
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getLang,
  );
}

export function locale(): string {
  return lang === 'nb' ? 'nb-NO' : 'en-GB';
}

export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  const text = MESSAGES[lang][key] ?? en[key];
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
}

const PORTIONS_EN: Record<string, string> = portionNamesEn;
const BUILT_IN_UNITS: Record<string, MessageKey> = {
  package: 'unit.package',
  serving: 'unit.serving',
  recipe: 'unit.recipe',
  __kcal: 'unit.kcal',
  __protein: 'unit.protein',
};

export function portionLabel(label: string): string {
  if (BUILT_IN_UNITS[label]) return t(BUILT_IN_UNITS[label]);
  if (lang === 'en') return PORTIONS_EN[label] ?? label;
  return label;
}
