// Builds games/beerech/data.js from a real supermarket price file.
//
// Israel's price-transparency law (חוק קידום התחרות בענף המזון, 2014) makes every large chain publish
// the full shelf-price list of every store, daily. This script downloads Shufersal's "PriceFull" file
// for one store, looks up a hand-picked list of barcodes in it and writes their prices to data.js.
// Nothing is invented: a barcode that is missing from the file is dropped, never estimated.
//
// Usage:  node games/beerech/build-data.mjs                 download today's file and rebuild
//         node games/beerech/build-data.mjs --file pf.gz    rebuild from a file already on disk
//         add --report to print feed name next to our name, for proof-reading the list
//
// Re-running changes prices (and possibly drops products), which is fine: the daily order depends
// only on the order of PICKS below. Add new picks at the end, and not casually once the site is live.
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const PORTAL = 'https://prices.shufersal.co.il/';
const STORE_ID = 1;
const CHAIN = 'שופרסל';
const STORE = 'שופרסל שלי בן יהודה, תל אביב';
// Generic on purpose: the portal is public and needs no identification.
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; price-fetch)' };

// [barcode, name as shown to the player, size, category]. Names are cleaned by hand from the feed's
// abbreviations ("גב.צהובה עמק פרוס28% 200") into ordinary Hebrew; sizes come from the feed.
const KG = 'מחיר לק"ג';
const PICKS = [
  // ---- dairy ----
  ['7290004131074', 'חלב 3% בקרטון, תנובה', '1 ליטר', 'dairy'],
  ['7290000042015', 'חלב 3% בשקית', '1 ליטר', 'dairy'],
  ['7290000042435', 'חלב 1% בקרטון, תנובה', '1 ליטר', 'dairy'],
  ['7290000042503', 'חלב עמיד 3%, תנובה', '1 ליטר', 'dairy'],
  ['7290107932080', 'חלב מועשר 3% בבקבוק, יטבתה', '1 ליטר', 'dairy'],
  ['7290116936307', 'חלב 3%, תנובה', '2 ליטר', 'dairy'],
  ['7290004127077', 'קוטג\' 3%, תנובה', '250 גרם', 'dairy'],
  ['7290011194246', 'קוטג\' 5%, שטראוס', '250 גרם', 'dairy'],
  ['7290002868996', 'קוטג\' 5%, טרה', '250 גרם', 'dairy'],
  ['7290110321277', 'קוטג\' 5% בגביע קטן', '100 גרם', 'dairy'],
  ['7290000048185', 'גבינה לבנה 5%', '250 גרם', 'dairy'],
  ['7290004127862', 'גבינה לבנה 5%', '750 גרם', 'dairy'],
  ['7290004122270', 'גבינה צהובה עמק 28%, פרוסה', '200 גרם', 'dairy'],
  ['7290000474830', 'גבינה צהובה מגורדת', '500 גרם', 'dairy'],
  ['7290000554471', 'גבינת מוצרלה 22%', '180 גרם', 'dairy'],
  ['7290000554532', 'גבינה צפתית מעודנת 5%', '200 גרם', 'dairy'],
  ['7290000041858', 'שמנת חמוצה 15%', '200 מ"ל', 'dairy'],
  ['7290000043814', 'שמנת להקצפה 38%', '250 מ"ל', 'dairy'],
  ['7290116932033', 'חמאה, תנובה', '200 גרם', 'dairy'],
  ['7290000057149', 'יוגורט ביו 3%, תנובה', '200 גרם', 'dairy'],
  ['7290000408316', 'יוגורט ביו 3%, דנונה', '200 גרם', 'dairy'],
  ['7290000043944', 'יוגורט 4% בכד', '1.5 ליטר', 'dairy'],
  ['7290000042855', 'שוקו בשקית, יטבתה', '225 מ"ל', 'dairy'],
  ['7290003029181', 'שוקו בבקבוק, יטבתה', '1 ליטר', 'dairy'],
  ['7290104726712', 'מילקי שוקולד, מארז', '8 × 170 מ"ל', 'dairy'],
  ['7290110557423', 'מילקי שכבות שוקולד וקצפת', '170 מ"ל', 'dairy'],
  ['7290006664655', 'אקטימל לבן, מארז', '8 × 100 מ"ל', 'dairy'],
  ['7290004585907', 'דני וניל', '125 גרם', 'dairy'],
  ['7290110561604', 'גמדים תות־בננה, מארז', '8 × 100 גרם', 'dairy'],
  ['7290004125578', 'משקה סויה אלטרנטיב', '1 ליטר', 'dairy'],
  // ---- eggs ----
  ['7290001201855', 'ביצים אומגה 3, גודל L', '12 ביצים', 'eggs'],
  ['7296073484417', 'ביצים אומגה 3, גודל L', '6 ביצים', 'eggs'],
  // ---- bread ----
  ['7290000002026', 'לחם אחיד', '750 גרם', 'bread'],
  ['7290000497112', 'לחם אחיד פרוס', '750 גרם', 'bread'],
  ['7290000002040', 'חלה', '500 גרם', 'bread'],
  ['7290000497044', 'לחם ברמן אקטיב', '750 גרם', 'bread'],
  ['7290001598580', 'פיתות כוסמין', '6 פיתות', 'bread'],
  ['7290001902783', 'לחמניית המבורגר', 'יחידה אחת', 'bread'],
  ['7290009398618', 'סופגנייה גדולה עם ריבה', 'יחידה אחת', 'bread'],
  // ---- salty snacks ----
  ['7290000066318', 'במבה', '80 גרם', 'snack'],
  ['7290000068787', 'במבה, שקית קטנה', '25 גרם', 'snack'],
  ['7290006652027', 'במבה, מארז שקיות קטנות', '20 × 15 גרם', 'snack'],
  ['7290000066141', 'ביסלי גריל', '70 גרם', 'snack'],
  ['7290000066196', 'ביסלי גריל', '200 גרם', 'snack'],
  ['7290000066332', 'אפרופו', '50 גרם', 'snack'],
  ['7290000178707', 'תפוצ\'יפס טבעי', '50 גרם', 'snack'],
  ['7290000178721', 'תפוצ\'יפס טבעי', '200 גרם', 'snack'],
  ['7290100850930', 'דוריטוס טבעי', '70 גרם', 'snack'],
  ['7290001817728', 'צ\'יטוס קטשופ', '55 גרם', 'snack'],
  ['7290000071008', 'בייגלה שטוח עם מלח, אסם', '60 גרם', 'snack'],
  ['7290000076133', 'בייגלה שמיניות קטנות', '400 גרם', 'snack'],
  ['7296073733454', 'גרעיני תירס לפופקורן', '1 ק"ג', 'snack'],
  ['38000232176', 'פרינגלס שמנת־בצל', '158 גרם', 'snack'],
  // ---- sweets ----
  ['7290000170053', 'שוקולד פרה חלב', '100 גרם', 'sweet'],
  ['7290000170077', 'שוקולד פרה מריר', '100 גרם', 'sweet'],
  ['72991008', 'פסק זמן קלאסי', '45 גרם', 'sweet'],
  ['72917367', 'טעמי', '40 גרם', 'sweet'],
  ['7290105362377', 'כיף כף', '45 גרם', 'sweet'],
  ['7290106658479', 'טורטית', '40 גרם', 'sweet'],
  ['7290112494221', 'קליק ביסקוויט', '65 גרם', 'sweet'],
  ['40084107', 'ביצת קינדר הפתעה', '20 גרם', 'sweet'],
  ['5413548280189', 'קינדר שוקובונס', '125 גרם', 'sweet'],
  ['4014400923711', 'טופיפי', '125 גרם', 'sweet'],
  ['7290000416021', 'ממרח השחר העולה', '500 גרם', 'sweet'],
  ['7290006681553', 'קרמבו וניל', '8 יחידות', 'sweet'],
  ['7290002752349', 'מנטוס מנטה', '37.5 גרם', 'sweet'],
  ['7290106721906', 'מסטיק בזוקה', '66 גרם', 'sweet'],
  ['4009900403023', 'מסטיק אורביט מנטה', '64 גרם', 'sweet'],
  ['7290000174099', 'בפלות שוקולד, עלית', '500 גרם', 'sweet'],
  ['7290000311210', 'ופלים בטעם לימון', '200 גרם', 'sweet'],
  ['7290000074184', 'פתי בר קלאסי, אסם', '500 גרם', 'sweet'],
  ['7290000061245', 'עוגיות שוקולד צ\'יפס, אסם', '220 גרם', 'sweet'],
  ['7290001216125', 'חלווה שוקו־וניל', '300 גרם', 'sweet'],
  ['7290010032310', 'דבש פרחי בר', '500 גרם', 'sweet'],
  ['7290006374738', 'קונפיטורת תות', '340 גרם', 'sweet'],
  ['7290002190516', 'ממרח ריבת חלב', '450 גרם', 'sweet'],
  ['7296073749899', 'מרשמלו', '150 גרם', 'sweet'],
  // ---- soft drinks ----
  ['7290000136141', 'פפסי', '1.5 ליטר', 'drink'],
  ['7290000136769', 'פפסי, שישייה', '6 × 1.5 ליטר', 'drink'],
  ['7290001594155', 'קוקה קולה, בקבוק אישי', '500 מ"ל', 'drink'],
  ['7290110115296', 'פאנטה אורנג\'', '1.5 ליטר', 'drink'],
  ['7290110115272', 'ספרייט זירו', '1.5 ליטר', 'drink'],
  ['7290000136240', 'סודה, טמפו', '1.5 ליטר', 'drink'],
  ['7290019056973', 'מים מינרליים מי עדן, שישייה', '6 × 1.5 ליטר', 'drink'],
  ['7290002331360', 'מים מינרליים נביעות בפקק ספורט, שישייה', '6 × 500 מ"ל', 'drink'],
  ['7290001594377', 'פריגת תפוזים', '500 מ"ל', 'drink'],
  ['7290001247129', 'ספרינג תפוזים בקרטון', '1 ליטר', 'drink'],
  ['7290000136585', 'ג\'אמפ תפוזים', '1.5 ליטר', 'drink'],
  ['7290000433103', 'משקה אנרגיה XL אפרסק־משמש, פחית', '250 מ"ל', 'drink'],
  ['7290000136646', 'בירה שחורה נשר מאלט', '1.5 ליטר', 'drink'],
  ['7296073527282', 'תירוש אדום', '750 מ"ל', 'drink'],
  // ---- alcohol ----
  ['7290001594568', 'בירה קרלסברג, פחית', '500 מ"ל', 'alcohol'],
  ['7290001594865', 'בירה קרלסברג, שישיית בקבוקים', '6 × 330 מ"ל', 'alcohol'],
  ['5000213014905', 'בירה גינס, פחית', '440 מ"ל', 'alcohol'],
  ['7290000023809', 'יין אדום ברקן קלאסיק קברנה סוביניון', '750 מ"ל', 'alcohol'],
  ['7290000521015', 'יין לבן יבש, סגל', '750 מ"ל', 'alcohol'],
  ['6440003100095', 'וודקה פינלנדיה', '700 מ"ל', 'alcohol'],
  ['7290000484747', 'ערק עלית', '700 מ"ל', 'alcohol'],
  // ---- coffee and tea ----
  ['7290005201882', 'קפה טורקי, עלית', '200 גרם', 'coffee'],
  ['7290000176420', 'קפה נמס, עלית', '200 גרם', 'coffee'],
  ['7290000072753', 'קפה נמס טסטרס צ\'ויס', '200 גרם', 'coffee'],
  ['7290000061764', 'נס קפה רד מאג', '200 גרם', 'coffee'],
  ['7290000345284', 'תה ויסוצקי קלאסי', '100 שקיקים', 'coffee'],
  ['7290000345260', 'תה ויסוצקי', '25 שקיקים', 'coffee'],
  ['7290000174723', 'שוקולית, עלית', '500 גרם', 'coffee'],
  // ---- pantry ----
  ['7290000211442', 'אורז פרסי, סוגת', '1 ק"ג', 'pantry'],
  ['7290000211169', 'אורז תאילנדי, סוגת', '1 ק"ג', 'pantry'],
  ['5011157630281', 'אורז בסמטי טילדה', '1 ק"ג', 'pantry'],
  ['7290000060880', 'ספגטי, אסם', '500 גרם', 'pantry'],
  ['7290000060903', 'פתיתים אפויים (אורז), אסם', '500 גרם', 'pantry'],
  ['7290002040019', 'קוסקוס', '350 גרם', 'pantry'],
  ['7290003107216', 'קמח לבן', '1 ק"ג', 'pantry'],
  ['7296073746539', 'סוכר לבן', '1 ק"ג', 'pantry'],
  ['7290000523804', 'מלח עדין בצנצנת, מלח הארץ', '1 ק"ג', 'pantry'],
  ['7290000144474', 'שמן קנולה', '1 ליטר', 'pantry'],
  ['7296073693284', 'שמן זית כתית', '750 מ"ל', 'pantry'],
  ['7290000072623', 'קטשופ, אסם', '750 גרם', 'pantry'],
  ['7290000111186', 'מיונז, תלמה', '500 גרם', 'pantry'],
  ['7290000120836', 'מיונז הלמנס', '394 גרם', 'pantry'],
  ['7290000209012', 'חומץ 5%', '1 ליטר', 'pantry'],
  ['7290000116945', 'רוטב סויה, קנור', '300 מ"ל', 'pantry'],
  ['7290000134871', 'פלפל שחור טחון', '100 גרם', 'pantry'],
  ['7290001216040', 'טחינה גולמית, אל ארז', '500 גרם', 'pantry'],
  ['7290000068701', 'שקדי מרק', '400 גרם', 'pantry'],
  ['7290000070308', 'אבקת מרק עוף, אסם', '400 גרם', 'pantry'],
  ['7290000073750', 'מנה חמה נודלס בטעם עוף', '71 גרם', 'pantry'],
  ['7290000068138', 'אינסטנט פודינג וניל', '80 גרם', 'pantry'],
  ['5000108478119', 'שיבולת שועל קוואקר', '500 גרם', 'pantry'],
  ['7290020505606', 'קורנפלקס ללא גלוטן', '500 גרם', 'pantry'],
  ['7290000446547', 'חמאת בוטנים טבעית', '350 גרם', 'pantry'],
  ['7290000504278', 'סוכרזית', '700 טבליות', 'pantry'],
  // ---- cans and jars ----
  ['7290005287206', 'טונה בשמן סטארקיסט, רביעייה', '4 × 160 גרם', 'can'],
  ['7290000208329', 'תירס מתוק, יכין', '550 גרם', 'can'],
  ['7290000208022', 'עגבניות מרוסקות, יכין', '800 גרם', 'can'],
  ['7290000208428', 'גרגירי חומוס בשימורים, יכין', '560 גרם', 'can'],
  ['7290000208213', 'שעועית ברוטב עגבניות', '580 גרם', 'can'],
  ['7290002317128', 'מלפפונים במלח', '560 גרם', 'can'],
  ['7290002317326', 'זיתים ירוקים מנזנילו', '560 גרם', 'can'],
  ['7290002881278', 'אפרסקים חצויים בשימורים', '820 גרם', 'can'],
  // ---- chilled salads ----
  ['7290106573628', 'חומוס עם טחינה, צבר', '400 גרם', 'deli'],
  ['7290000467320', 'חומוס אבו מרוואן, צבר', '400 גרם', 'deli'],
  ['7290011800840', 'טחינה מוכנה, צבר', '400 גרם', 'deli'],
  // ---- meat and fish ----
  ['7290000616827', 'חזה עוף טרי', KG, 'meat'],
  ['7290000616810', 'כנפי עוף טריות', KG, 'meat'],
  ['7290000933740', 'בשר בקר טחון טרי', KG, 'meat'],
  ['7290000319131', 'נקניקיות עוף', '400 גרם', 'meat'],
  ['7290000552927', 'בשר עוף טחון קפוא', '500 גרם', 'meat'],
  ['7290000939995', 'פילה סלמון קפוא', KG, 'meat'],
  ['7290002442066', 'פילה אמנון קפוא', KG, 'meat'],
  // ---- frozen ----
  ['7290000238173', 'בורקס גבינה קפוא', '800 גרם', 'frozen'],
  ['7290008343626', 'פלאפל קפוא', '1 ק"ג', 'frozen'],
  ['7290000104676', 'אפונה ירוקה קפואה', '800 גרם', 'frozen'],
  ['7290000104690', 'גרעיני תירס קפואים', '800 גרם', 'frozen'],
  ['7290000300900', 'שניצל תירס', '750 גרם', 'frozen'],
  ['7290121010191', 'ג\'חנון לאפייה', '650 גרם', 'frozen'],
  // ---- fruit and vegetables ----
  ['7290000000022', 'עגבניות', KG, 'veg'],
  ['7290000000046', 'מלפפונים', KG, 'veg'],
  ['7290000000480', 'בצל יבש', KG, 'veg'],
  ['7290000000596', 'תפוחי אדמה לבנים', KG, 'veg'],
  ['7290000001661', 'גזר', KG, 'veg'],
  ['7290000964775', 'בננות', KG, 'produce'],
  ['7290000964980', 'אבוקדו', KG, 'produce'],
  ['7290000000091', 'פלפל אדום', KG, 'veg'],
  ['7290000000114', 'חצילים', KG, 'veg'],
  ['7290000000138', 'כרוב לבן', KG, 'veg'],
  ['7290000000428', 'בטטות', KG, 'veg'],
  ['7290000000053', 'קישואים', KG, 'veg'],
  ['7290000000176', 'כרובית', KG, 'veg'],
  ['7290000963082', 'תפוחי עץ מוזהבים', KG, 'produce'],
  ['7290000964560', 'קלמנטינות', KG, 'produce'],
  ['726529983456', 'ענבים ירוקים', KG, 'produce'],
  ['7290000000282', 'חסה ערבית', 'יחידה אחת', 'veg'],
  ['7290000000916', 'עגבניות שרי בקופסה', '460 גרם', 'veg'],
  // ---- cleaning ----
  ['7290000288079', 'אקונומיקה סנו ז\'אוול לימון', '2 ליטר', 'clean'],
  ['7290000294780', 'אקונומיקה סמיכה סנו ז\'אוול', '4 ליטר', 'clean'],
  ['4084500853553', 'נוזל כלים פיירי', '650 מ"ל', 'clean'],
  ['7290001305188', 'נוזל כלים פלמוליב', '750 מ"ל', 'clean'],
  ['7290016509786', 'ג\'ל כביסה פרסיל', '2.5 ליטר', 'clean'],
  ['5413149655522', 'אבקת כביסה אריאל', '1.25 ק"ג', 'clean'],
  ['4013162036233', 'מרכך כביסה הדובי המפנק', '1 ליטר', 'clean'],
  ['7290000289748', 'מסיר שומנים סנו פורטה', '750 מ"ל', 'clean'],
  ['7290000288352', 'תרסיס נגד חרקים K-300', '630 מ"ל', 'clean'],
  ['7290112006011', 'קפסולות למדיח פיניש', '50 קפסולות', 'clean'],
  ['7290019841968', 'נוזל לניקוי רצפות', '4 ליטר', 'clean'],
  ['7296073731726', 'שקיות אשפה XXL', '50 שקיות', 'clean'],
  ['7290103706630', 'ספוג הפלא', '6 יחידות', 'clean'],
  // ---- paper and disposables ----
  ['7290000187938', 'נייר טואלט לילי', '32 גלילים', 'paper'],
  ['7290000188355', 'מגבות נייר ניקול', '6 גלילים', 'paper'],
  ['3034250007813', 'טישו כיס קלינקס', '9 חבילות', 'paper'],
  ['7290000195773', 'מגבונים לחים האגיס', '4 × 56 מגבונים', 'paper'],
  ['7296073707448', 'חיתולי במבינו, מידה 4', '40 חיתולים', 'paper'],
  ['7290005095245', 'נרות שבת', '72 נרות', 'paper'],
  ['7290014731264', 'כוסות חד־פעמיות לשתייה קרה', '100 כוסות', 'paper'],
  ['7290019860433', 'רדיד אלומיניום', 'גליל 60 מטר', 'paper'],
  ['7290103705213', 'נייר אפייה', '40 גיליונות', 'paper'],
  // ---- personal care ----
  ['6920354826191', 'משחת שיניים קולגייט', '100 מ"ל', 'care'],
  ['7290112492449', 'שמפו פינוק לשיער רגיל', '700 מ"ל', 'care'],
  ['7290003387205', 'דאודורנט ספיד סטיק לגבר', '56 גרם', 'care'],
  ['4005900513045', 'דאודורנט ספריי ניוואה לגבר', '150 מ"ל', 'care'],
  ['7290000560533', 'ג\'ל גילוח אדג\'', '198 גרם', 'care'],
  ['7290000193205', 'תחבושות לילי ללילה', '20 תחבושות', 'care'],
  ['7290003026227', 'שמפו אל־דמע קמיל בלו', '1 ליטר', 'care'],
  ['7290002515333', 'אל־סבון קמיל בלו סנסיטיב', '500 מ"ל', 'care'],
  ['7290000244761', 'קרם ידיים ולווטה', '100 מ"ל', 'care'],
  ['3574660058857', 'שמן תינוקות ג\'ונסון', '500 מ"ל', 'care'],
  // ---- pets ----
  ['7290005111761', 'מזון יבש לכלבים בונזו', '3 ק"ג', 'pet'],
  ['7290000805900', 'מזון יבש לחתולים לה קט', '2.85 ק"ג', 'pet'],
  ['50000170180', 'מזון לחתולים פריסקיז, פחית', '156 גרם', 'pet'],
];

const args = process.argv.slice(2);
const fileArg = args.includes('--file') ? args[args.indexOf('--file') + 1] : null;
const report = args.includes('--report');

async function download() {
  const page = await (await fetch(`${PORTAL}FileObject/UpdateCategory?catID=2&storeId=${STORE_ID}`, { headers: HEADERS })).text();
  const href = page.match(/href="([^"]*PriceFull[^"]*)"/);
  if (!href) throw new Error('No PriceFull link on the portal page; its layout may have changed.');
  const url = href[1].replaceAll('&amp;', '&');
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  return { name: new URL(url).pathname.split('/').pop(), bytes: Buffer.from(await res.arrayBuffer()) };
}

const source = fileArg ? { name: fileArg.split('/').pop(), bytes: readFileSync(fileArg) } : await download();
const xml = (source.bytes[0] === 0x1f ? gunzipSync(source.bytes) : source.bytes).toString('utf8');

// The file's date is in its name (PriceFull<chain>-<sub>-<store>-YYYYMMDD-HHMMSS.gz); --date overrides it for a renamed local copy.
const stamp = source.name.match(/-(\d{4})(\d{2})(\d{2})-\d{6}/);
const date = args.includes('--date') ? args[args.indexOf('--date') + 1] : stamp ? `${stamp[1]}-${stamp[2]}-${stamp[3]}` : null;
if (!date) throw new Error('Cannot tell the date of the price file; pass --date YYYY-MM-DD.');

const tag = (s, t) => (s.match(new RegExp(`<${t}>([^<]*)</${t}>`)) || [, ''])[1].trim();
const feed = new Map();
for (const m of xml.matchAll(/<Item>([\s\S]*?)<\/Item>/g)) {
  const s = m[1];
  feed.set(tag(s, 'ItemCode'), {
    name: tag(s, 'ItemName'), price: Number(tag(s, 'ItemPrice')), weighted: tag(s, 'bIsWeighted') === '1',
    qty: tag(s, 'Quantity'), unit: tag(s, 'UnitQty'), sold: tag(s, 'LastSaleDateTime').slice(0, 10),
  });
}

const products = [];
const seen = new Set();
for (const [code, name, size, cat] of PICKS) {
  if (seen.has(code)) throw new Error(`Duplicate barcode in PICKS: ${code}`);
  seen.add(code);
  const item = feed.get(code);
  if (!item || !(item.price > 0)) { console.warn(`missing from the price file, dropped: ${code} ${name}`); continue; }
  // A per-kilo label on something sold by the unit (or the reverse) would make the shown price wrong.
  if ((size === KG) !== item.weighted) console.warn(`check unit: ${code} ${name} | ours "${size}" | feed weighted=${item.weighted} ${item.qty} ${item.unit}`);
  if (report) console.log([code, item.price.toFixed(2), `${name} · ${size}`, `<< ${item.name} | ${item.qty} ${item.unit} | נמכר ${item.sold}`].join('  '));
  products.push({ id: code, name, size, cat, price: item.price });
}
if (products.length < 150) throw new Error(`Only ${products.length} products found; refusing to write a thin data file.`);

const out = `// GENERATED by games/beerech/build-data.mjs. Do not edit by hand; edit the list in that script and re-run it.
//
// Every price is the shelf price of that barcode in one real store on one day, taken from the
// price file the chain publishes under Israel's price-transparency law. No price is estimated.
// Prices do not include club or multi-buy discounts.
export const SOURCE = ${JSON.stringify({ chain: CHAIN, store: STORE, storeId: STORE_ID, date, portal: PORTAL, file: source.name }, null, 2)};

/** id is the barcode; price is in shekels; size "${KG}" marks goods sold by weight. */
export const PRODUCTS = [
${products.map((p) => '  ' + JSON.stringify(p) + ',').join('\n')}
];
`;
writeFileSync(fileURLToPath(new URL('./data.js', import.meta.url)), out);
console.log(`Wrote ${products.length} of ${PICKS.length} products, prices from ${source.name} (${date}).`);
