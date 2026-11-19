/**
 * Dictionnaire local (hors ligne) pour la note Primal.
 * Référence : philosophie "Primal Blueprint" (aliments entiers, bonnes graisses ;
 * limiter céréales, sucres, huiles de graines industrielles, produits ultra-transformés).
 * Le classement est INDICATIF et réglable ; les ingrédients non reconnus restent "inconnus" (jamais jugés mauvais).
 */
export type IngClass =
  | 'whole' | 'natural_fat' | 'dairy' | 'fermented' | 'legume' | 'grain_whole' | 'grain_refined'
  | 'modified_starch' | 'sugar' | 'natural_sweetener' | 'sweetener' | 'refined_oil' | 'bad_fat'
  | 'industrial' | 'flavouring' | 'water_salt' | 'unknown';

export interface ClassInfo {
  /** 0..1 : proximité avec un aliment entier selon la philosophie Primal */
  naturalness: number;
  /** 0..1 : degré de non-transformation (1 = brut) */
  transformation: number;
  fat?: 'good' | 'bad';
  addedSugar?: boolean;
  label: string;
}

export const CLASS_INFO: Record<IngClass, ClassInfo> = {
  whole:             { naturalness: 1,    transformation: 1,    label: 'Aliment entier' },
  natural_fat:       { naturalness: 1,    transformation: 0.8,  fat: 'good', label: 'Matière grasse naturelle' },
  dairy:             { naturalness: 0.85, transformation: 0.8,  fat: 'good', label: 'Produit laitier' },
  fermented:         { naturalness: 0.8,  transformation: 0.75, label: 'Aliment fermenté / condiment' },
  legume:            { naturalness: 0.6,  transformation: 0.9,  label: 'Légumineuse' },
  grain_whole:       { naturalness: 0.5,  transformation: 0.8,  label: 'Céréale complète' },
  grain_refined:     { naturalness: 0.2,  transformation: 0.45, label: 'Céréale raffinée / farine' },
  modified_starch:   { naturalness: 0.05, transformation: 0.1,  label: 'Amidon / fécule transformé' },
  sugar:             { naturalness: 0.1,  transformation: 0.4,  addedSugar: true, label: 'Sucre ajouté' },
  natural_sweetener: { naturalness: 0.5,  transformation: 0.7,  addedSugar: true, label: 'Sucrant naturel (miel, sirop)' },
  sweetener:         { naturalness: 0.1,  transformation: 0.1,  label: 'Édulcorant' },
  refined_oil:       { naturalness: 0.1,  transformation: 0.3,  fat: 'bad', label: 'Huile raffinée / de graines' },
  bad_fat:           { naturalness: 0.05, transformation: 0.1,  fat: 'bad', label: 'Graisse hydrogénée / palme' },
  industrial:        { naturalness: 0,    transformation: 0,    label: 'Ingrédient industriel' },
  flavouring:        { naturalness: 0.1,  transformation: 0.05, label: 'Arôme' },
  water_salt:        { naturalness: 1,    transformation: 1,    label: 'Eau / sel' },
  unknown:           { naturalness: 0.5,  transformation: 0.5,  label: 'Non reconnu' },
};

/** Ordre IMPORTANT : le premier mot-clé qui correspond gagne (du plus spécifique au plus général). */
export const INGREDIENT_RULES: Array<[IngClass, string[]]> = [
  ['whole', ['lait de coco', 'coconut milk', 'creme de coco', 'coconut cream', 'lait d amande']],
  // --- graisses mauvaises / hydrogénées / palme
  ['bad_fat', ['hydrogen', 'hydrogenat', 'partially hydrogenated', 'shortening', 'huile de palme', 'palm oil', 'palm fat', 'graisse de palme', 'palmiste', 'palm kernel', 'margarine']],
  // --- huiles raffinées / de graines
  ['refined_oil', ['huile de tournesol', 'sunflower oil', 'huile de colza', 'rapeseed oil', 'canola', 'huile de soja', 'soybean oil', 'soya oil', 'huile de mais', 'corn oil', 'huile de coton', 'cottonseed', 'huile de carthame', 'safflower', 'huile de pepins de raisin', 'grapeseed', 'huile vegetale', 'vegetable oil', 'vegetable fat', 'matiere grasse vegetale', 'huile de graines', 'huiles vegetales', 'huile de riz', 'rice bran oil']],
  // --- bonnes graisses
  ['natural_fat', ['huile d olive', 'huile olive', 'olive oil', 'huile de coco', 'coconut oil', 'huile de noix de coco', 'huile d avocat', 'avocado oil', 'beurre de cacao', 'cocoa butter', 'beurre clarifie', 'ghee', 'saindoux', 'lard', 'graisse de canard', 'duck fat', 'graisse de boeuf', 'suif', 'tallow', 'huile de noix', 'huile de noisette', 'huile de sesame', 'sesame oil', 'huile de lin', 'huile d argan', 'beurre', 'butter']],
  // --- sucres & sirops industriels
  ['sugar', ['sirop de glucose', 'glucose syrup', 'glucose-fructose', 'glucose fructose', 'fructose', 'high fructose', 'sirop de mais', 'corn syrup', 'dextrose', 'saccharose', 'sucrose', 'sucre inverti', 'invert sugar', 'sirop de sucre', 'sucre de canne', 'cane sugar', 'sucre roux', 'sucre glace', 'sucre', 'sugar', 'maltodextrine', 'maltodextrin', 'sirop d agave', 'agave', 'melasse', 'molasses', 'maltose', 'sirop de riz', 'caramel', 'sirop de ble', 'jus de fruits concentre', 'concentrated fruit juice', 'jus concentre']],
  ['natural_sweetener', ['miel', 'honey', 'sirop d erable', 'maple syrup', 'sirop de datte', 'date syrup', 'pate de datte', 'sucre de coco', 'coconut sugar']],
  ['sweetener', ['aspartame', 'sucralose', 'acesulfame', 'saccharine', 'saccharin', 'cyclamate', 'sorbitol', 'maltitol', 'xylitol', 'erythritol', 'mannitol', 'isomalt', 'polyol', 'steviol', 'stevia', 'stevioside', 'edulcorant', 'sweetener', 'neotame', 'thaumatine', 'lactitol']],
  // --- industriels / arômes
  ['flavouring', ['arome', 'aroma', 'flavour', 'flavor', 'vanilline', 'vanillin', 'extrait de levure', 'yeast extract']],
  ['modified_starch', ['amidon modifie', 'modified starch', 'amidon', 'starch', 'fecule', 'amidon de mais', 'cornstarch', 'corn starch', 'amidon de ble', 'amidon de pomme de terre']],
  ['industrial', ['proteine de soja', 'soy protein', 'isolat', 'isolate', 'proteines de lait', 'milk protein', 'caseinate', 'proteines de ble', 'gluten de ble', 'wheat gluten', 'proteines vegetales', 'texturee', 'textured', 'lactoserum en poudre', 'whey powder', 'poudre de lactoserum', 'fibres', 'fibre de', 'polydextrose', 'inuline', 'inulin', 'dextrine', 'dextrin', 'viande separee mecaniquement', 'mechanically separated', 'agent', 'emulsifiant', 'emulsifier', 'epaississant', 'thickener', 'stabilisant', 'stabiliser', 'gelifiant', 'colorant', 'colour', 'color', 'conservateur', 'preservative', 'acidifiant', 'acidity regulator', 'regulateur d acidite', 'antioxydant', 'exhausteur', 'flavour enhancer', 'gomme', 'gum', 'poudre a lever', 'raising agent', 'agent levant', 'bicarbonate', 'carbonate', 'phosphate', 'sulfite', 'nitrite', 'nitrate', 'lecithine', 'lecithin', 'pectine', 'pectin', 'carraghenane', 'carrageenan', 'cellulose', 'mono- et diglycerides', 'mono and diglycerides', 'glycerol', 'glycerine', 'enzyme', 'ferments lactiques', 'sirop', 'syrup']],
  // --- céréales
  ['grain_whole', ['ble complet', 'farine complete', 'farine integrale', 'pain complet', 'pates completes', 'seigle complet', 'ble entier', 'cereales completes', 'wholegrain', 'whole grain', 'whole wheat', 'integral', 'flocons d avoine', 'avoine', 'oat', 'epeautre', 'spelt', 'sarrasin', 'buckwheat', 'quinoa', 'millet', 'seigle', 'rye', 'orge', 'barley', 'riz complet', 'brown rice', 'riz sauvage', 'amarante']],
  ['grain_refined', ['farine', 'flour', 'semoule', 'semolina', 'ble', 'wheat', 'froment', 'riz', 'rice', 'mais', 'corn', 'maize', 'pates', 'pasta', 'pain', 'bread', 'chapelure', 'breadcrumb', 'biscuit', 'cereale', 'cereal', 'son de', 'bran', 'couscous', 'tapioca', 'malt', 'orge maltee']],
  // --- légumineuses
  ['legume', ['soja', 'soy', 'lentille', 'lentil', 'pois chiche', 'chickpea', 'haricot', 'bean', 'feve', 'pois', 'pea', 'lupin', 'tofu', 'tempeh', 'houmous', 'hummus', 'cacahuete', 'peanut', 'arachide', 'edamame']],
  // --- produits laitiers
  ['dairy', ['creme', 'cream', 'lait', 'milk', 'yaourt', 'yogurt', 'yoghurt', 'fromage', 'cheese', 'kefir', 'skyr', 'mozzarella', 'parmesan', 'emmental', 'comte', 'gruyere', 'cheddar', 'feta', 'ricotta', 'mascarpone', 'lactose', 'petit-lait', 'fromage blanc', 'caillebotte']],
  // --- fermentés / condiments
  ['fermented', ['vinaigre', 'vinegar', 'miso', 'choucroute', 'sauerkraut', 'kimchi', 'moutarde', 'mustard', 'sauce soja', 'soy sauce', 'tamari', 'cornichon', 'pickle', 'ketchup', 'tomate concentree', 'concentre de tomate', 'tomato paste', 'vin', 'wine', 'bouillon', 'broth', 'stock']],
  // --- eau / sel
  ['water_salt', ['eau', 'water', 'sel', 'salt', 'fleur de sel', 'sel de mer', 'sea salt']],
  // --- aliments entiers
  ['whole', ['oeuf', 'egg', 'poulet', 'chicken', 'dinde', 'turkey', 'boeuf', 'beef', 'veau', 'veal', 'porc', 'pork', 'jambon', 'ham', 'agneau', 'lamb', 'canard', 'duck', 'viande', 'meat', 'bacon', 'lardon', 'saucisse', 'sausage', 'saumon', 'salmon', 'thon', 'tuna', 'sardine', 'maquereau', 'mackerel', 'cabillaud', 'cod', 'poisson', 'fish', 'crevette', 'shrimp', 'prawn', 'moule', 'mussel', 'huitre', 'oyster', 'crabe', 'crab', 'anchois', 'anchovy', 'foie', 'liver',
    'pomme de terre', 'potato', 'patate douce', 'sweet potato', 'carotte', 'carrot', 'tomate', 'tomato', 'oignon', 'onion', 'ail', 'garlic', 'echalote', 'shallot', 'poireau', 'leek', 'courgette', 'zucchini', 'aubergine', 'eggplant', 'poivron', 'pepper', 'champignon', 'mushroom', 'epinard', 'spinach', 'salade', 'lettuce', 'chou', 'cabbage', 'brocoli', 'broccoli', 'concombre', 'cucumber', 'celeri', 'celery', 'betterave', 'beetroot', 'radis', 'radish', 'navet', 'courge', 'squash', 'pumpkin', 'potiron', 'asperge', 'asparagus', 'artichaut', 'legume', 'vegetable', 'avocat', 'avocado', 'olive',
    'pomme', 'apple', 'poire', 'pear', 'banane', 'banana', 'orange', 'citron', 'lemon', 'lime', 'fraise', 'strawberry', 'framboise', 'raspberry', 'myrtille', 'blueberry', 'cerise', 'cherry', 'raisin', 'grape', 'peche', 'peach', 'abricot', 'apricot', 'prune', 'plum', 'mangue', 'mango', 'ananas', 'pineapple', 'kiwi', 'melon', 'pasteque', 'watermelon', 'datte', 'date', 'figue', 'fig', 'fruit', 'coco', 'coconut', 'noix', 'walnut', 'amande', 'almond', 'noisette', 'hazelnut', 'pistache', 'pistachio', 'cajou', 'cashew', 'pecan', 'macadamia', 'graine', 'seed', 'chia', 'lin', 'flax', 'tournesol', 'sunflower', 'sesame', 'courge', 'pavot', 'cacao', 'cocoa', 'cocoa mass', 'pate de cacao', 'chocolat noir', 'dark chocolate', 'cafe', 'coffee', 'the vert', 'tea', 'epice', 'spice', 'herbe', 'herb', 'persil', 'parsley', 'basilic', 'basil', 'thym', 'thyme', 'romarin', 'rosemary', 'origan', 'oregano', 'coriandre', 'coriander', 'cumin', 'curcuma', 'turmeric', 'paprika', 'poivre', 'pepper', 'cannelle', 'cinnamon', 'gingembre', 'ginger', 'muscade', 'nutmeg', 'piment', 'chili', 'vanille', 'vanilla', 'moutarde en grain', 'algue', 'seaweed', 'bouillon d os', 'bone broth', 'gelatine', 'collagene']],
];

/** Classement par catégorie CIQUAL / OFF quand l'aliment n'a pas de liste d'ingrédients. */
export const CATEGORY_RULES: Array<[RegExp, IngClass]> = [
  [/fruits?|legumes?|oleagineux|noix|graines|herbes|epices|champignons|algues/, 'whole'],
  [/viandes?|poissons?|oeufs?|coquillages|crustaces|volailles?|charcuterie/, 'whole'],
  [/lait|laitier|fromage|yaourt|cremerie/, 'dairy'],
  [/legumineuses/, 'legume'],
  [/matieres? grasses?|huiles?/, 'natural_fat'],
  [/cereales?|pain|pates|riz|farine|biscuit|viennoiserie|patisserie/, 'grain_refined'],
  [/sucre|confiserie|chocolat|confiture|dessert|glace/, 'sugar'],
  [/eau|boissons? non sucrees|infusion|cafe|the/, 'water_salt'],
];

export type AdditiveCategory = 'colorant' | 'conservateur' | 'édulcorant' | 'émulsifiant' | 'épaississant' | 'exhausteur' | 'antioxydant' | 'acidifiant' | 'autre';
export interface Additive { code: string; name: string; category: AdditiveCategory; risk: 0 | 1 | 2 | 3; note?: string }

/** risk : 0 = bénin, 1 = technologique, 2 = discuté, 3 = préoccupant (indicatif, d'après avis EFSA/ANSES/CIRC publics) */
export const ADDITIVES: Additive[] = [
  { code: 'e100', name: 'Curcumine', category: 'colorant', risk: 0 },
  { code: 'e101', name: 'Riboflavine', category: 'colorant', risk: 0 },
  { code: 'e102', name: 'Tartrazine', category: 'colorant', risk: 2, note: 'Azoïque ; mention d’avertissement obligatoire dans l’UE' },
  { code: 'e104', name: 'Jaune de quinoléine', category: 'colorant', risk: 2 },
  { code: 'e110', name: 'Jaune orangé S', category: 'colorant', risk: 2 },
  { code: 'e120', name: 'Carmin', category: 'colorant', risk: 1 },
  { code: 'e122', name: 'Azorubine', category: 'colorant', risk: 2 },
  { code: 'e124', name: 'Ponceau 4R', category: 'colorant', risk: 2 },
  { code: 'e129', name: 'Rouge allura', category: 'colorant', risk: 2 },
  { code: 'e131', name: 'Bleu patenté V', category: 'colorant', risk: 2 },
  { code: 'e132', name: 'Indigotine', category: 'colorant', risk: 1 },
  { code: 'e133', name: 'Bleu brillant', category: 'colorant', risk: 1 },
  { code: 'e140', name: 'Chlorophylles', category: 'colorant', risk: 0 },
  { code: 'e141', name: 'Complexes cuivre-chlorophylles', category: 'colorant', risk: 1 },
  { code: 'e150a', name: 'Caramel ordinaire', category: 'colorant', risk: 1 },
  { code: 'e150c', name: 'Caramel ammoniacal', category: 'colorant', risk: 2 },
  { code: 'e150d', name: 'Caramel au sulfite d’ammonium', category: 'colorant', risk: 2, note: '4-MeI potentiellement présent' },
  { code: 'e160a', name: 'Bêta-carotène', category: 'colorant', risk: 0 },
  { code: 'e160b', name: 'Rocou / annatto', category: 'colorant', risk: 1 },
  { code: 'e160c', name: 'Extrait de paprika', category: 'colorant', risk: 0 },
  { code: 'e162', name: 'Rouge de betterave', category: 'colorant', risk: 0 },
  { code: 'e163', name: 'Anthocyanes', category: 'colorant', risk: 0 },
  { code: 'e170', name: 'Carbonate de calcium', category: 'autre', risk: 0 },
  { code: 'e171', name: 'Dioxyde de titane', category: 'colorant', risk: 3, note: 'Interdit dans l’UE comme additif alimentaire depuis 2022' },
  { code: 'e172', name: 'Oxydes de fer', category: 'colorant', risk: 1 },
  { code: 'e200', name: 'Acide sorbique', category: 'conservateur', risk: 1 },
  { code: 'e202', name: 'Sorbate de potassium', category: 'conservateur', risk: 1 },
  { code: 'e210', name: 'Acide benzoïque', category: 'conservateur', risk: 2 },
  { code: 'e211', name: 'Benzoate de sodium', category: 'conservateur', risk: 2 },
  { code: 'e212', name: 'Benzoate de potassium', category: 'conservateur', risk: 2 },
  { code: 'e220', name: 'Dioxyde de soufre', category: 'conservateur', risk: 2 },
  { code: 'e221', name: 'Sulfite de sodium', category: 'conservateur', risk: 2 },
  { code: 'e223', name: 'Disulfite de sodium', category: 'conservateur', risk: 2 },
  { code: 'e224', name: 'Disulfite de potassium', category: 'conservateur', risk: 2 },
  { code: 'e228', name: 'Bisulfite de potassium', category: 'conservateur', risk: 2 },
  { code: 'e234', name: 'Nisine', category: 'conservateur', risk: 1 },
  { code: 'e249', name: 'Nitrite de potassium', category: 'conservateur', risk: 3, note: 'Nitrites : viandes transformées classées cancérogènes (CIRC)' },
  { code: 'e250', name: 'Nitrite de sodium', category: 'conservateur', risk: 3, note: 'Nitrites : viandes transformées classées cancérogènes (CIRC)' },
  { code: 'e251', name: 'Nitrate de sodium', category: 'conservateur', risk: 2 },
  { code: 'e252', name: 'Nitrate de potassium', category: 'conservateur', risk: 2 },
  { code: 'e260', name: 'Acide acétique', category: 'acidifiant', risk: 0 },
  { code: 'e270', name: 'Acide lactique', category: 'acidifiant', risk: 0 },
  { code: 'e280', name: 'Acide propionique', category: 'conservateur', risk: 1 },
  { code: 'e282', name: 'Propionate de calcium', category: 'conservateur', risk: 1 },
  { code: 'e296', name: 'Acide malique', category: 'acidifiant', risk: 0 },
  { code: 'e300', name: 'Acide ascorbique (vit. C)', category: 'antioxydant', risk: 0 },
  { code: 'e301', name: 'Ascorbate de sodium', category: 'antioxydant', risk: 0 },
  { code: 'e306', name: 'Extrait riche en tocophérols', category: 'antioxydant', risk: 0 },
  { code: 'e322', name: 'Lécithines', category: 'émulsifiant', risk: 0 },
  { code: 'e320', name: 'BHA', category: 'antioxydant', risk: 3 },
  { code: 'e321', name: 'BHT', category: 'antioxydant', risk: 2 },
  { code: 'e325', name: 'Lactate de sodium', category: 'acidifiant', risk: 0 },
  { code: 'e330', name: 'Acide citrique', category: 'acidifiant', risk: 0 },
  { code: 'e331', name: 'Citrates de sodium', category: 'acidifiant', risk: 0 },
  { code: 'e332', name: 'Citrates de potassium', category: 'acidifiant', risk: 0 },
  { code: 'e333', name: 'Citrates de calcium', category: 'acidifiant', risk: 0 },
  { code: 'e334', name: 'Acide tartrique', category: 'acidifiant', risk: 0 },
  { code: 'e338', name: 'Acide phosphorique', category: 'acidifiant', risk: 2 },
  { code: 'e339', name: 'Phosphates de sodium', category: 'autre', risk: 2 },
  { code: 'e340', name: 'Phosphates de potassium', category: 'autre', risk: 2 },
  { code: 'e341', name: 'Phosphates de calcium', category: 'autre', risk: 1 },
  { code: 'e407', name: 'Carraghénanes', category: 'épaississant', risk: 2 },
  { code: 'e410', name: 'Farine de graines de caroube', category: 'épaississant', risk: 0 },
  { code: 'e412', name: 'Gomme guar', category: 'épaississant', risk: 1 },
  { code: 'e414', name: 'Gomme arabique', category: 'épaississant', risk: 1 },
  { code: 'e415', name: 'Gomme xanthane', category: 'épaississant', risk: 1 },
  { code: 'e417', name: 'Gomme tara', category: 'épaississant', risk: 1 },
  { code: 'e418', name: 'Gomme gellane', category: 'épaississant', risk: 1 },
  { code: 'e420', name: 'Sorbitol', category: 'édulcorant', risk: 1 },
  { code: 'e421', name: 'Mannitol', category: 'édulcorant', risk: 1 },
  { code: 'e422', name: 'Glycérol', category: 'autre', risk: 0 },
  { code: 'e440', name: 'Pectines', category: 'épaississant', risk: 0 },
  { code: 'e450', name: 'Diphosphates', category: 'autre', risk: 2 },
  { code: 'e451', name: 'Triphosphates', category: 'autre', risk: 2 },
  { code: 'e452', name: 'Polyphosphates', category: 'autre', risk: 2 },
  { code: 'e460', name: 'Cellulose', category: 'épaississant', risk: 1 },
  { code: 'e461', name: 'Méthylcellulose', category: 'épaississant', risk: 1 },
  { code: 'e466', name: 'Carboxyméthylcellulose', category: 'épaississant', risk: 2 },
  { code: 'e471', name: 'Mono- et diglycérides d’acides gras', category: 'émulsifiant', risk: 1 },
  { code: 'e472e', name: 'Esters mono/diacétyltartriques', category: 'émulsifiant', risk: 1 },
  { code: 'e475', name: 'Esters polyglycériques', category: 'émulsifiant', risk: 1 },
  { code: 'e481', name: 'Stéaroyl-2-lactylate de sodium', category: 'émulsifiant', risk: 1 },
  { code: 'e491', name: 'Monostéarate de sorbitane', category: 'émulsifiant', risk: 1 },
  { code: 'e500', name: 'Carbonates de sodium', category: 'autre', risk: 0 },
  { code: 'e503', name: 'Carbonates d’ammonium', category: 'autre', risk: 0 },
  { code: 'e551', name: 'Dioxyde de silicium', category: 'autre', risk: 1 },
  { code: 'e570', name: 'Acides gras', category: 'autre', risk: 0 },
  { code: 'e620', name: 'Acide glutamique', category: 'exhausteur', risk: 1 },
  { code: 'e621', name: 'Glutamate monosodique', category: 'exhausteur', risk: 2 },
  { code: 'e627', name: 'Guanylate disodique', category: 'exhausteur', risk: 1 },
  { code: 'e631', name: 'Inosinate disodique', category: 'exhausteur', risk: 1 },
  { code: 'e635', name: 'Ribonucléotides disodiques', category: 'exhausteur', risk: 1 },
  { code: 'e901', name: 'Cire d’abeille', category: 'autre', risk: 0 },
  { code: 'e903', name: 'Cire de carnauba', category: 'autre', risk: 0 },
  { code: 'e904', name: 'Gomme laque', category: 'autre', risk: 1 },
  { code: 'e950', name: 'Acésulfame K', category: 'édulcorant', risk: 2 },
  { code: 'e951', name: 'Aspartame', category: 'édulcorant', risk: 2, note: 'Classé "peut-être cancérogène" (2B) par le CIRC en 2023, dose journalière admissible inchangée' },
  { code: 'e952', name: 'Cyclamate', category: 'édulcorant', risk: 2 },
  { code: 'e954', name: 'Saccharine', category: 'édulcorant', risk: 2 },
  { code: 'e955', name: 'Sucralose', category: 'édulcorant', risk: 2 },
  { code: 'e960', name: 'Glycosides de stéviol', category: 'édulcorant', risk: 1 },
  { code: 'e965', name: 'Maltitol', category: 'édulcorant', risk: 1 },
  { code: 'e967', name: 'Xylitol', category: 'édulcorant', risk: 1 },
  { code: 'e968', name: 'Érythritol', category: 'édulcorant', risk: 1 },
  { code: 'e1103', name: 'Invertase', category: 'autre', risk: 0 },
  { code: 'e1400', name: 'Dextrine', category: 'épaississant', risk: 1 },
  { code: 'e1404', name: 'Amidon oxydé', category: 'épaississant', risk: 1 },
  { code: 'e1412', name: 'Phosphate de diamidon', category: 'épaississant', risk: 1 },
  { code: 'e1422', name: 'Adipate de diamidon acétylé', category: 'épaississant', risk: 1 },
  { code: 'e1442', name: 'Phosphate de diamidon hydroxypropylé', category: 'épaississant', risk: 1 },
  { code: 'e1520', name: 'Propylène glycol', category: 'autre', risk: 1 },
];
export const ADDITIVE_BY_CODE: Record<string, Additive> = Object.fromEntries(ADDITIVES.map((a) => [a.code, a]));

/** Noms en toutes lettres (FR/EN) -> code E */
export const ADDITIVE_NAMES: Array<[string, string]> = [
  ['acide citrique', 'e330'], ['citric acid', 'e330'], ['acide ascorbique', 'e300'], ['ascorbic acid', 'e300'],
  ['lecithine', 'e322'], ['lecithin', 'e322'], ['pectine', 'e440'], ['pectin', 'e440'],
  ['gomme xanthane', 'e415'], ['xanthan', 'e415'], ['gomme guar', 'e412'], ['guar', 'e412'],
  ['gomme arabique', 'e414'], ['gum arabic', 'e414'], ['carraghenane', 'e407'], ['carrageenan', 'e407'],
  ['gomme de caroube', 'e410'], ['locust bean', 'e410'], ['farine de graines de caroube', 'e410'],
  ['acide lactique', 'e270'], ['lactic acid', 'e270'], ['acide malique', 'e296'], ['acide tartrique', 'e334'],
  ['mono- et diglycerides', 'e471'], ['mono and diglycerides', 'e471'], ['mono- and diglycerides', 'e471'],
  ['nitrite de sodium', 'e250'], ['sodium nitrite', 'e250'], ['sel nitrite', 'e250'], ['nitrite', 'e250'], ['nitrate de potassium', 'e252'],
  ['sorbate de potassium', 'e202'], ['potassium sorbate', 'e202'], ['benzoate de sodium', 'e211'], ['sodium benzoate', 'e211'],
  ['glutamate monosodique', 'e621'], ['monosodium glutamate', 'e621'], ['glutamate', 'e621'],
  ['aspartame', 'e951'], ['acesulfame', 'e950'], ['sucralose', 'e955'], ['saccharine', 'e954'], ['cyclamate', 'e952'],
  ['steviol', 'e960'], ['stevia', 'e960'], ['maltitol', 'e965'], ['xylitol', 'e967'], ['erythritol', 'e968'], ['sorbitol', 'e420'], ['mannitol', 'e421'],
  ['dioxyde de titane', 'e171'], ['titanium dioxide', 'e171'], ['tartrazine', 'e102'], ['caramel ammoniacal', 'e150c'],
  ['polyphosphate', 'e452'], ['diphosphate', 'e450'], ['triphosphate', 'e451'], ['phosphate de calcium', 'e341'], ['phosphate', 'e339'],
  ['cellulose', 'e460'], ['carboxymethylcellulose', 'e466'], ['bicarbonate de sodium', 'e500'], ['carbonate de calcium', 'e170'],
  ['curcumine', 'e100'], ['beta-carotene', 'e160a'], ['carotene', 'e160a'], ['rocou', 'e160b'], ['annatto', 'e160b'], ['paprika extract', 'e160c'], ['extrait de paprika', 'e160c'],
  ['carmin', 'e120'], ['cochineal', 'e120'],
];
