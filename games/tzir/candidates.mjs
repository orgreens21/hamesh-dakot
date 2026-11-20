// Hand-curated candidate events for על הציר. This file is only an input to build-data.mjs; the game
// never loads it. Each line: Wikipedia article | the year the curator expects | Hebrew phrase | topic | optional property.
// The article is on English Wikipedia unless it starts with "he:". The build keeps a line only when
// Wikidata's own date for that article agrees with the expected year, so a slip of memory here drops
// the event instead of shipping a wrong year.
// Topics: place, inst, biz, media, tv, film, music, book, sport, space, tech, build, play, art.

export const ISRAEL = `
Tel Aviv | 1909 | נוסדת תל אביב, אז עוד "אחוזת בית" | place
Petah Tikva | 1878 | נוסדת פתח תקווה, "אם המושבות" | place
Rishon LeZion | 1882 | נוסדת ראשון לציון | place
Zikhron Ya'akov | 1882 | נוסדת זכרון יעקב | place
Rosh Pinna | 1882 | נוסדת ראש פינה | place
Rehovot | 1890 | נוסדת רחובות | place
Hadera | 1891 | נוסדת חדרה | place
Metula | 1896 | נוסדת מטולה | place
Gedera | 1884 | נוסדת גדרה | place
Ness Ziona | 1883 | נוסדת נס ציונה | place
Mazkeret Batya | 1883 | נוסדת מזכרת בתיה | place
Kfar Saba | 1903 | נוסדת כפר סבא | place
Kfar Tavor | 1901 | נוסדת כפר תבור | place
Degania Alef | 1910 | קמה דגניה, "אם הקבוצות" | place
Nahalal | 1921 | קם נהלל, מושב העובדים הראשון | place
Ein Harod | 1921 | קם קיבוץ עין חרוד | place
Ramat Gan | 1921 | נוסדת רמת גן | place
Ra'anana | 1922 | נוסדת רעננה | place
Givatayim | 1922 | נוסדת גבעתיים | place
Binyamina | 1922 | נוסדת בנימינה | place
Ramat HaSharon | 1923 | נוסדת רמת השרון | place
Herzliya | 1924 | נוסדת הרצליה | place
Bnei Brak | 1924 | נוסדת בני ברק | place
Afula | 1925 | נוסדת עפולה | place
Bat Yam | 1926 | נוסדת בת ים | place
Netanya | 1929 | נוסדת נתניה | place
Pardes Hanna-Karkur | 1929 | נוסדת פרדס חנה | place
Even Yehuda | 1932 | נוסדת אבן יהודה | place
Kiryat Bialik | 1934 | נוסדת קריית ביאליק | place
Kiryat Motzkin | 1934 | נוסדת קריית מוצקין | place
Nahariya | 1935 | נוסדת נהריה | place
Holon | 1935 | נוסדת חולון | place
Hanita | 1938 | עולה לקרקע קיבוץ חניתה | place
Kiryat Ono | 1939 | נוסדת קריית אונו | place
Kiryat Shmona | 1949 | נוסדת קריית שמונה | place
Rosh HaAyin | 1949 | נוסדת ראש העין | place
Tirat Carmel | 1949 | נוסדת טירת כרמל | place
Beit Shemesh | 1950 | נוסדת בית שמש החדשה | place
Yokneam Illit | 1950 | נוסדת יקנעם עילית | place
Eilat | 1951 | נוסדת העיר אילת | place
Sderot | 1951 | נוסדת שדרות | place
Mitzpe Ramon | 1951 | נוסדת מצפה רמון | place
Yeruham | 1951 | נוסדת ירוחם | place
Or Akiva | 1951 | נוסדת אור עקיבא | place
Kiryat Malakhi | 1951 | נוסדת קריית מלאכי | place
Sde Boker | 1952 | קם קיבוץ שדה בוקר | place
Migdal HaEmek | 1953 | נוסדת מגדל העמק | place
Kiryat Gat | 1954 | נוסדת קריית גת | place
Dimona | 1955 | נוסדת דימונה | place
Ofakim | 1955 | נוסדת אופקים | place
Ashdod | 1956 | נוסדת העיר אשדוד | place
Netivot | 1956 | נוסדת נתיבות | place
Nof HaGalil | 1957 | נוסדת נצרת עילית, לימים נוף הגליל | place
Arad, Israel | 1962 | נוסדת ערד | place
Karmiel | 1964 | נוסדת כרמיאל | place
Hod HaSharon | 1964 | מוקמת הוד השרון מאיחוד מושבות | place
Meitar | 1984 | נוסד היישוב מיתר | place
Shoham | 1993 | נוסד היישוב שוהם | place
Modi'in-Maccabim-Re'ut | 1993 | מונחת אבן הפינה לעיר מודיעין | place
El'ad | 1998 | נוסדת העיר אלעד | place
Mishkenot Sha'ananim | 1860 | נבנית משכנות שאננים, השכונה הראשונה מחוץ לחומות ירושלים | place
Mea Shearim | 1874 | נוסדת שכונת מאה שערים | place
Neve Tzedek | 1887 | נוסדת שכונת נווה צדק | place
Mikveh Israel | 1870 | נפתח בית הספר החקלאי מקווה ישראל | inst
Technion – Israel Institute of Technology | 1912 | מונחת אבן הפינה לטכניון בחיפה | inst
Hebrew University of Jerusalem | 1918 | מונחות אבני הפינה לאוניברסיטה העברית | inst
Weizmann Institute of Science | 1934 | נוסד מכון זיו, לימים מכון ויצמן למדע | inst
Tel Aviv University | 1956 | נוסדת אוניברסיטת תל אביב | inst
Bar-Ilan University | 1955 | נוסדת אוניברסיטת בר-אילן | inst
University of Haifa | 1963 | נוסדת אוניברסיטת חיפה | inst
Ben-Gurion University of the Negev | 1969 | נוסדת אוניברסיטת הנגב בבאר שבע | inst
Open University of Israel | 1974 | נוסדת האוניברסיטה הפתוחה | inst
Bezalel Academy of Arts and Design | 1906 | בוריס שץ מקים את "בצלאל" | inst
Hebrew Reali School | 1913 | נוסד בית הספר הריאלי בחיפה | inst
Herzliya Hebrew Gymnasium | 1905 | נוסדת הגימנסיה העברית "הרצליה" | inst
Sheba Medical Center | 1948 | נוסד בית החולים תל השומר | inst
Rambam Health Care Campus | 1938 | נפתח בית החולים רמב"ם בחיפה | inst
Shaare Zedek Medical Center | 1902 | נפתח בית החולים שערי צדק | inst
Soroka Medical Center | 1959 | נפתח בית החולים סורוקה בבאר שבע | inst
Magen David Adom | 1930 | נוסד מגן דוד אדום | inst
Israel Philharmonic Orchestra | 1936 | נוסדת התזמורת הפילהרמונית | inst
Habima Theatre | 1917 | נוסד תיאטרון "הבימה" במוסקבה | inst
Cameri Theatre | 1944 | נוסד התיאטרון הקאמרי | inst
Batsheva Dance Company | 1964 | נוסדת להקת המחול בת שבע | inst
Israel Museum | 1965 | נפתח מוזיאון ישראל בירושלים | inst
Tel Aviv Museum of Art | 1932 | נפתח מוזיאון תל אביב לאמנות | inst
ANU - Museum of the Jewish People | 1978 | נפתח בית התפוצות | inst
Eretz Israel Museum | 1953 | נוסד מוזיאון ארץ ישראל | inst
Bloomfield Science Museum | 1992 | נפתח מוזיאון המדע בירושלים | inst
Academy of the Hebrew Language | 1953 | קמה האקדמיה ללשון העברית | inst
Israel Prize | 1953 | מוענק לראשונה פרס ישראל | inst
Mifal HaPayis | 1951 | נוסד מפעל הפיס | inst
Society for the Protection of Nature in Israel | 1953 | נוסדת החברה להגנת הטבע | inst
Jewish National Fund | 1901 | נוסדת הקרן הקיימת לישראל | inst
Women's International Zionist Organization | 1920 | נוסד ארגון ויצ"ו | inst
First Zionist Congress | 1897 | מתכנס הקונגרס הציוני הראשון בבזל | inst
Der Judenstaat | 1896 | הרצל מפרסם את "מדינת היהודים" | book
Bank of Israel | 1954 | נוסד בנק ישראל | biz
Bank Leumi | 1902 | נוסד בנק אנגלו-פלשתינה, לימים בנק לאומי | biz
Bank Hapoalim | 1921 | נוסד בנק הפועלים | biz
Israel Discount Bank | 1935 | נוסד בנק דיסקונט | biz
Tel Aviv Stock Exchange | 1953 | נפתחת הבורסה לניירות ערך בתל אביב | biz
Israel Electric Corporation | 1923 | פנחס רוטנברג מקים את חברת החשמל | biz
Mekorot | 1937 | נוסדת חברת "מקורות" | biz
Egged (company) | 1933 | נוסד קואופרטיב "אגד" | biz
Dan Bus Company | 1945 | נוסד קואופרטיב "דן" | biz
El Al | 1948 | נוסדת חברת התעופה אל על | biz
Arkia | 1949 | נוסדת חברת התעופה ארקיע | biz
Zim Integrated Shipping Services | 1945 | נוסדת חברת הספנות צים | biz
Teva Pharmaceuticals | 1901 | נוסדת בירושלים חברת התרופות שתהפוך ל"טבע" | biz
Tnuva | 1926 | נוסדת תנובה | biz
Strauss Group | 1936 | נוסדת מחלבת שטראוס בנהריה | biz
Osem (company) | 1942 | נוסדת חברת אסם | biz
Bamba (snack) | 1964 | הבמבה מגיעה למדפים | biz
Bissli | 1975 | הביסלי מגיע למדפים | biz
Bezeq | 1984 | חברת בזק מתחילה לפעול | biz
Pelephone | 1986 | נוסדת פלאפון, חברת הסלולר הראשונה בישראל | biz
Cellcom (Israel) | 1994 | נוסדת סלקום | biz
Check Point | 1993 | נוסדת צ'ק פוינט | tech
ICQ | 1996 | חברת מיראביליס הישראלית משיקה את ICQ | tech
Mobileye | 1999 | נוסדת מובילאיי | tech
Wix.com | 2006 | נוסדת Wix | tech
Fiverr | 2010 | נוסדת Fiverr | tech
Monday.com | 2012 | נוסדת מאנדיי | tech
Moovit | 2012 | נוסדת Moovit | tech
Viber | 2010 | מושקת אפליקציית וייבר | tech
EToro | 2007 | נוסדת eToro | tech
Mellanox Technologies | 1999 | נוסדת מלאנוקס ביקנעם | tech
Amdocs | 1982 | נוסדת אמדוקס | tech
Netafim | 1965 | קיבוץ חצרים מקים את נטפים, חלוצת הטפטפות | tech
Super-Pharm | 1978 | נפתח הסניף הראשון של סופר-פארם | biz
Shufersal | 1958 | נפתח הסופרמרקט הראשון של שופרסל | biz
Castro (clothing) | 1950 | נוסד בית האופנה קסטרו | biz
Aroma Espresso Bar | 1994 | נפתח בירושלים הסניף הראשון של ארומה | biz
Max Brenner | 1996 | נוסדת רשת השוקולד מקס ברנר | biz
Ahava | 1988 | נוסדת חברת הקוסמטיקה "אהבה" | biz
Rami Levy Hashikma Marketing | 1976 | רמי לוי פותח את החנות הראשונה שלו | biz
Delek | 1951 | נוסדת חברת הדלק "דלק" | biz
Paz Oil Company | 1922 | נוסדת חברת "פז" | biz
Angel Bakeries | 1927 | נוסדת מאפיית אנג'ל | biz
Carmel Winery | 1882 | נוסדים יקבי כרמל | biz
Goldstar (beer) | 1950 | נמזגת לראשונה בירה גולדסטאר | biz
Maccabee (beer) | 1968 | נמזגת לראשונה בירה מכבי | biz
Steimatzky | 1925 | נפתחת חנות הספרים הראשונה של סטימצקי | biz
Am Oved | 1942 | נוסדת הוצאת עם עובד | biz
Israeli new shekel | 1985 | השקל החדש נכנס לשימוש | biz
Old Israeli shekel | 1980 | השקל מחליף את הלירה | biz
Azrieli Center | 1999 | נפתח מרכז עזריאלי בתל אביב | build
Shalom Meir Tower | 1965 | נחנך מגדל שלום בתל אביב | build
Moshe Aviv Tower | 2001 | נחנך מגדל משה אביב ברמת גן | build
Azrieli Sarona Tower | 2017 | נחנך מגדל עזריאלי שרונה | build
Ayalon Mall | 1985 | נפתח קניון איילון, הראשון בישראל | build
Ramon Airport | 2019 | נפתח נמל התעופה רמון | build
Port of Haifa | 1933 | נחנך נמל חיפה | build
Port of Ashdod | 1965 | נפתח נמל אשדוד | build
Carmelit | 1959 | הכרמלית בחיפה מתחילה לנסוע | build
Jerusalem Light Rail | 2011 | הרכבת הקלה בירושלים מתחילה לנסוע | build
Red Line (Tel Aviv Light Rail) | 2023 | הקו האדום של הרכבת הקלה בגוש דן מתחיל לפעול | build
Carmel Tunnels | 2010 | נפתחות מנהרות הכרמל | build
Chords Bridge | 2008 | נחנך גשר המיתרים בירושלים | build
National Water Carrier of Israel | 1964 | המוביל הארצי מתחיל להזרים מים | build
Jaffa–Jerusalem railway | 1892 | נחנכת מסילת הרכבת מיפו לירושלים | build
Jezreel Valley railway | 1905 | נחנכת רכבת העמק | build
Shrine of the Book | 1965 | נחנך היכל הספר | build
Safari Ramat Gan | 1974 | נפתח הספארי ברמת גן | build
Jerusalem Biblical Zoo | 1940 | נוסד גן החיות התנ"כי | build
Luna Park, Tel Aviv | 1970 | נפתח הלונה פארק בתל אביב | build
Superland | 1991 | נפתח הסופרלנד בראשון לציון | build
Mini Israel | 2002 | נפתח פארק מיני ישראל | build
Charles Bronfman Auditorium | 1957 | נחנך היכל התרבות בתל אביב | build
Teddy Stadium | 1991 | נחנך אצטדיון טדי | build
Bloomfield Stadium | 1962 | נחנך אצטדיון בלומפילד | build
Ramat Gan Stadium | 1951 | נחנך אצטדיון רמת גן | build
Sammy Ofer Stadium | 2014 | נחנך אצטדיון סמי עופר | build
Menora Mivtachim Arena | 1963 | נחנך היכל הספורט יד אליהו | build
Reading Power Station | 1938 | תחנת הכוח רדינג מתחילה לפעול | build
Tel Aviv Central Bus Station | 1993 | נפתחת התחנה המרכזית החדשה בתל אביב | build
Carmel Market | 1920 | נפתח שוק הכרמל | build
Yarkon Park | 1973 | נפתח פארק הירקון | build
1932 Maccabiah Games | 1932 | נערכת המכביה הראשונה | sport
Israel Football Association | 1928 | נוסדת ההתאחדות לכדורגל | sport
Maccabi Tel Aviv F.C. | 1906 | נוסדת מכבי תל אביב | sport
Hapoel Tel Aviv F.C. | 1923 | נוסדת הפועל תל אביב | sport
Maccabi Haifa F.C. | 1913 | נוסדת מכבי חיפה | sport
Beitar Jerusalem F.C. | 1936 | נוסדת בית"ר ירושלים | sport
Hapoel Be'er Sheva F.C. | 1949 | נוסדת הפועל באר שבע | sport
Hapoel Haifa F.C. | 1924 | נוסדת הפועל חיפה | sport
Maccabi Netanya F.C. | 1934 | נוסדת מכבי נתניה | sport
Bnei Yehuda Tel Aviv F.C. | 1936 | נוסדת בני יהודה | sport
Hapoel Petah Tikva F.C. | 1934 | נוסדת הפועל פתח תקווה | sport
Maccabi Petah Tikva F.C. | 1912 | נוסדת מכבי פתח תקווה | sport
Maccabi Tel Aviv B.C. | 1932 | נוסדת קבוצת הכדורסל של מכבי תל אביב | sport
Hapoel Jerusalem B.C. | 1943 | נוסדת קבוצת הכדורסל של הפועל ירושלים | sport
Israeli Premier League | 1999 | ליגת העל בכדורגל יוצאת לדרך | sport
1964 AFC Asian Cup | 1964 | נבחרת ישראל זוכה בגביע אסיה בכדורגל | sport
1970 FIFA World Cup | 1970 | נבחרת ישראל משחקת במונדיאל, בפעם היחידה עד היום | sport
Israel at the 1992 Summer Olympics | 1992 | יעל ארד זוכה במדליה האולימפית הראשונה של ישראל | sport
Israel at the 2004 Summer Olympics | 2004 | גל פרידמן זוכה בזהב האולימפי הראשון של ישראל | sport
2004 Euroleague Final Four | 2004 | מכבי תל אביב זוכה ביורוליג בפיינל פור ביד אליהו | sport
2014 Euroleague Final Four | 2014 | מכבי תל אביב של דייוויד בלאט זוכה ביורוליג במילאנו | sport
Miss Universe 1976 | 1976 | רינה מור נבחרת למיס יוניברס | media
Miss World 1998 | 1998 | לינור אברג'יל נבחרת למיס עולם | media
Shmuel Yosef Agnon | 1966 | ש"י עגנון זוכה בפרס נובל לספרות | inst | NOBEL
Daniel Kahneman | 2002 | דניאל כהנמן זוכה בפרס נובל לכלכלה | inst | NOBEL
Aaron Ciechanover | 2004 | אהרן צ'חנובר ואברהם הרשקו זוכים בפרס נובל לכימיה | inst | NOBEL
Robert Aumann | 2005 | ישראל אומן זוכה בפרס נובל לכלכלה | inst | NOBEL
Ada Yonath | 2009 | עדה יונת זוכה בפרס נובל לכימיה | inst | NOBEL
Dan Shechtman | 2011 | דן שכטמן זוכה בפרס נובל לכימיה | inst | NOBEL
Arieh Warshel | 2013 | אריה ורשל ומיכאל לויט זוכים בפרס נובל לכימיה | inst | NOBEL
Axiom Mission 1 | 2022 | איתן סטיבה ממריא לתחנת החלל הבין-לאומית | space
Beresheet | 2019 | החללית הישראלית "בראשית" משוגרת אל הירח | space
Amos-1 | 1996 | משוגר "עמוס 1", לוויין התקשורת הישראלי הראשון | space
Haaretz | 1918 | נוסד העיתון "הארץ" | media
Yedioth Ahronoth | 1939 | נוסד העיתון "ידיעות אחרונות" | media
Maariv (newspaper) | 1948 | נוסד העיתון "מעריב" | media
The Jerusalem Post | 1932 | נוסד העיתון "פלסטיין פוסט", לימים "ג'רוזלם פוסט" | media
Davar | 1925 | נוסד העיתון "דבר" | media
Globes (newspaper) | 1983 | נוסד העיתון הכלכלי "גלובס" | media
Calcalist | 2008 | נוסד העיתון "כלכליסט" | media
Ynet | 2000 | עולה לרשת אתר ynet | media
Walla! | 1995 | עולה לרשת פורטל וואלה | media
Israel Defense Forces Radio | 1950 | גלי צה"ל מתחילה לשדר | media
Galgalatz | 1993 | גלגלצ מתחילה לשדר | media
Reshet Gimel | 1976 | רשת ג' מתחילה לשדר | media
Israeli Educational Television | 1966 | הטלוויזיה החינוכית מתחילה לשדר | media
Channel 1 (Israel) | 1968 | הטלוויזיה הישראלית מתחילה לשדר | media
Channel 2 (Israel) | 1993 | ערוץ 2 המסחרי מתחיל לשדר | media
Channel 10 (Israel) | 2002 | ערוץ 10 מתחיל לשדר | media
Yes (Israel) | 2000 | חברת הלוויין yes מתחילה לשדר | media
Arutz HaYeladim | 1989 | ערוץ הילדים עולה לאוויר | media
Zehu Ze! | 1978 | "זהו זה!" עולה לשידור בטלוויזיה החינוכית | tv
Nikui Rosh | 1974 | "ניקוי ראש" עולה לשידור | tv
Lool | 1970 | "לול" של אריק איינשטיין ואורי זוהר משודרת לראשונה | tv
The Chamber Quintet | 1993 | "החמישייה הקאמרית" עולה לשידור | tv
Eretz Nehederet | 2003 | "ארץ נהדרת" עולה לשידור | tv
Ramat Aviv Gimel (TV series) | 1995 | הטלנובלה "רמת אביב גימל" עולה לשידור | tv
Florentine (TV series) | 1997 | הסדרה "פלורנטין" עולה לשידור | tv
Hartzufim | 1996 | "החרצופים" עולה לשידור | tv
Parpar Nechmad | 1982 | "פרפר נחמד" עולה לשידור | tv
Rechov Sumsum | 1983 | "רחוב סומסום" עולה לשידור | tv
Krovim Krovim | 1983 | "קרובים קרובים", הסיטקום הישראלי הראשון, עולה לשידור | tv
Kokhav Nolad | 2003 | "כוכב נולד" עולה לשידור | tv
BeTipul | 2005 | הסדרה "בטיפול" עולה לשידור | tv
Prisoners of War (TV series) | 2010 | הסדרה "חטופים" עולה לשידור | tv
Shtisel | 2013 | הסדרה "שטיסל" עולה לשידור | tv
Srugim | 2008 | הסדרה "סרוגים" עולה לשידור | tv
The Bourgeoisie (TV series) | 2000 | הסדרה "הבורגנים" עולה לשידור | tv
HaAh HaGadol | 2008 | "האח הגדול" עולה לשידור בישראל | tv
HaPijamot | 2003 | "הפיג'מות" עולה לשידור | tv
HaShminiya | 2005 | סדרת הנוער "השמיניה" עולה לשידור | tv
Shemesh (TV series) | 1997 | הסיטקום "שמש" עולה לשידור | tv
Ramzor | 2008 | הסיטקום "רמזור" עולה לשידור | tv
Arab Labor | 2007 | הסדרה "עבודה ערבית" עולה לשידור | tv
M.K. 22 | 2004 | סדרת האנימציה "מ.ק. 22" עולה לשידור | tv
Mesudarim | 2007 | הסדרה "מסודרים" עולה לשידור | tv
Zaguri Imperia | 2014 | הסדרה "זגורי אימפריה" עולה לשידור | tv
Sabri Maranan | 2011 | הסיטקום "סברי מרנן" עולה לשידור | tv
HaMerotz LaMillion | 2009 | "המירוץ למיליון" עולה לשידור בישראל | tv
MasterChef Israel | 2010 | "מאסטר שף" עולה לשידור בישראל | tv
The Voice Israel | 2012 | "דה וויס" עולה לשידור בישראל | tv
HaKokhav HaBa | 2013 | "הכוכב הבא" עולה לשידור | tv
Euphoria (Israeli TV series) | 2012 | הסדרה הישראלית "אופוריה" עולה לשידור | tv
Galis | 2012 | סדרת הנוער "גאליס" עולה לשידור | tv
Sallah Shabati | 1964 | "סאלח שבתי" יוצא לאקרנים | film
Kazablan | 1973 | הסרט "קזבלן" יוצא לאקרנים | film
Giv'at Halfon Eina Ona | 1976 | "גבעת חלפון אינה עונה" יוצא לאקרנים | film
Lemon Popsicle | 1978 | "אסקימו לימון" יוצא לאקרנים | film
Hagiga B'Snuker | 1975 | "חגיגה בסנוקר" יוצא לאקרנים | film
Charlie Ve'hetzi | 1974 | "צ'רלי וחצי" יוצא לאקרנים | film
The Policeman | 1971 | "השוטר אזולאי" יוצא לאקרנים | film
The Big Dig (film) | 1969 | "תעלת בלאומילך" של קישון יוצא לאקרנים | film
I Love You Rosa | 1972 | "אני אוהב אותך רוזה" יוצא לאקרנים | film
The House on Chelouche Street | 1973 | "הבית ברחוב שלוש" יוצא לאקרנים | film
Alex Holeh Ahavah | 1986 | "אלכס חולה אהבה" יוצא לאקרנים | film
Late Summer Blues | 1987 | "בלוז לחופש הגדול" יוצא לאקרנים | film
Shuroo | 1990 | "שורו" יוצא לאקרנים | film
Life According to Agfa | 1992 | "החיים על פי אגפא" יוצא לאקרנים | film
Song of the Siren | 1994 | "שירת הסירנה" יוצא לאקרנים | film
Saint Clara (film) | 1996 | "קלרה הקדושה" יוצא לאקרנים | film
Late Marriage | 2001 | "חתונה מאוחרת" יוצא לאקרנים | film
Broken Wings (2002 film) | 2002 | "כנפיים שבורות" יוצא לאקרנים | film
Nina's Tragedies | 2003 | "האסונות של נינה" יוצא לאקרנים | film
Bonjour Monsieur Shlomi | 2003 | "הכוכבים של שלומי" יוצא לאקרנים | film
Turn Left at the End of the World | 2004 | "סוף העולם שמאלה" יוצא לאקרנים | film
Ushpizin | 2004 | "האושפיזין" יוצא לאקרנים | film
Walk on Water (film) | 2004 | "ללכת על המים" יוצא לאקרנים | film
Aviva, My Love | 2006 | "אביבה אהובתי" יוצא לאקרנים | film
The Band's Visit | 2007 | "ביקור התזמורת" יוצא לאקרנים | film
Footnote (film) | 2011 | "הערת שוליים" יוצא לאקרנים | film
Fill the Void | 2012 | "למלא את החלל" יוצא לאקרנים | film
Zero Motivation | 2014 | "אפס ביחסי אנוש" יוצא לאקרנים | film
Gett: The Trial of Viviane Amsalem | 2014 | "גט" של רונית ושלומי אלקבץ יוצא לאקרנים | film
The Farewell Party | 2014 | "מיתה טובה" יוצא לאקרנים | film
Operation Grandma | 1999 | "מבצע סבתא" משודר לראשונה | film
The Troupe | 1978 | הסרט "הלהקה" יוצא לאקרנים | film
Three Days and a Child | 1967 | "שלושה ימים וילד" יוצא לאקרנים | film
Yana's Friends | 1999 | "החברים של יאנה" יוצא לאקרנים | film
Lost Islands (film) | 2008 | "איים אבודים" יוצא לאקרנים | film
A Matter of Size | 2009 | "סיפור גדול" יוצא לאקרנים | film
This Is Sodom | 2010 | "זוהי סדום" יוצא לאקרנים | film
Maktub (2017 film) | 2017 | "מכתוב" יוצא לאקרנים | film
Jerusalem of Gold | 1967 | נעמי שמר כותבת את "ירושלים של זהב" | music
Hallelujah (Milk and Honey song) | 1979 | "הללויה" של חלב ודבש זוכה באירוויזיון | music
A-Ba-Ni-Bi | 1978 | "א-ב-ני-בי" מביא לישראל זכייה ראשונה באירוויזיון | music
Diva (Dana International song) | 1998 | דנה אינטרנשיונל זוכה באירוויזיון עם "דיווה" | music
Toy (song) | 2018 | נטע ברזילי זוכה באירוויזיון עם "Toy" | music
Golden Boy (Nadav Guedj song) | 2015 | נדב גדג' שר את "גולדן בוי" באירוויזיון | music
Eurovision Song Contest 2019 | 2019 | האירוויזיון נערך בתל אביב | music
Eurovision Song Contest 1999 | 1999 | האירוויזיון נערך בירושלים בפעם השנייה | music
Kaveret | 1973 | קמה להקת כוורת | music
Poogy Tales | 1973 | יוצא "סיפורי פוגי", אלבום הבכורה של כוורת | music
HaGashash HaHiver | 1963 | קמה שלישיית הגשש החיוור | music
Nahal Band | 1950 | קמה להקת הנח"ל | music
The High Windows | 1966 | קמה שלישיית החלונות הגבוהים | music
Tislam | 1980 | קמה להקת תיסלם | music
Teapacks | 1988 | קמה בשדרות להקת טיפקס | music
Hadag Nahash | 1996 | קמה להקת הדג נחש | music
Infected Mushroom | 1996 | קם הצמד אינפקטד מאשרום | music
Mashina | 1983 | קמה להקת משינה | music
Israel Festival | 1961 | נערך לראשונה פסטיבל ישראל | music
Red Sea Jazz Festival | 1987 | נערך לראשונה פסטיבל הג'אז באילת | music
Jerusalem Film Festival | 1984 | נערך לראשונה פסטיבל הקולנוע ירושלים | film
Festigal | 1981 | נערך לראשונה הפסטיגל | music
Altneuland | 1902 | הרצל מפרסם את "אלטנוילנד" | book
A Tale of Love and Darkness | 2002 | עמוס עוז מפרסם את "סיפור על אהבה וחושך" | book
My Michael | 1968 | עמוס עוז מפרסם את "מיכאל שלי" | book
Hasamba | 1949 | יוצא הספר הראשון בסדרת "חסמבה" | book
He Walked Through the Fields | 1947 | משה שמיר מפרסם את "הוא הלך בשדות" | book
Only Yesterday (novel) | 1945 | עגנון מפרסם את "תמול שלשום" | book
Past Continuous (novel) | 1977 | יעקב שבתאי מפרסם את "זכרון דברים" | book
The Lover (Yehoshua novel) | 1977 | א"ב יהושע מפרסם את "המאהב" | book
Sapiens: A Brief History of Humankind | 2011 | יובל נח הררי מפרסם את "קיצור תולדות האנושות" | book
A Pigeon and a Boy | 2006 | מאיר שלו מפרסם את "יונה ונער" | book
Someone to Run With | 2000 | דויד גרוסמן מפרסם את "מישהו לרוץ איתו" | book
The Blue Mountain (novel) | 1988 | מאיר שלו מפרסם את "רומן רוסי" | book
The Zigzag Kid | 1994 | דויד גרוסמן מפרסם את "יש ילדים זיגזג" | book
`;

export const WORLD = `
Eiffel Tower | 1889 | נחנך מגדל אייפל | build
Statue of Liberty | 1886 | נחנך פסל החירות | build
Brooklyn Bridge | 1883 | נפתח גשר ברוקלין | build
Golden Gate Bridge | 1937 | נפתח גשר שער הזהב | build
Empire State Building | 1931 | נחנך בניין האמפייר סטייט | build
Chrysler Building | 1930 | נחנך בניין קרייזלר | build
Sydney Opera House | 1973 | נפתח בית האופרה של סידני | build
Sydney Harbour Bridge | 1932 | נפתח גשר נמל סידני | build
Burj Khalifa | 2010 | נחנך בורג' ח'ליפה בדובאי | build
Burj Al Arab | 1999 | נפתח מלון בורג' אל-ערב | build
Taipei 101 | 2004 | נחנך מגדל טאיפיי 101 | build
Tokyo Tower | 1958 | נחנך מגדל טוקיו | build
Tokyo Skytree | 2012 | נפתח מגדל טוקיו סקייטרי | build
CN Tower | 1976 | נפתח מגדל CN בטורונטו | build
Space Needle | 1962 | נפתח מגדל "מחט החלל" בסיאטל | build
Gateway Arch | 1965 | הושלמה קשת השער בסנט לואיס | build
Atomium | 1958 | נחנך האטומיום בבריסל | build
Fernsehturm Berlin | 1969 | נחנך מגדל הטלוויזיה של ברלין | build
Tower Bridge | 1894 | נפתח גשר המצודה בלונדון | build
London Eye | 2000 | הלונדון איי נפתח לקהל | build
Tate Modern | 2000 | נפתח מוזיאון טייט מודרן | build
Louvre Pyramid | 1989 | נחנכת פירמידת הזכוכית בלובר | build
Centre Pompidou | 1977 | נפתח מרכז פומפידו בפריז | build
Guggenheim Museum Bilbao | 1997 | נפתח מוזיאון גוגנהיים בבילבאו | build
Millau Viaduct | 2004 | נחנך גשר מיו בצרפת | build
Christ the Redeemer (statue) | 1931 | נחנך פסל ישו הגואל בריו דה ז'ניירו | build
Hollywood Sign | 1923 | מוצב שלט הוליווד | build
Suez Canal | 1869 | נפתחת תעלת סואץ | build
Panama Canal | 1914 | נפתחת תעלת פנמה | build
Channel Tunnel | 1994 | נפתחת מנהרת התעלה בין אנגליה לצרפת | build
London Underground | 1863 | הרכבת התחתית של לונדון מתחילה לפעול | build
Paris Métro | 1900 | המטרו של פריז מתחיל לפעול | build
New York City Subway | 1904 | הרכבת התחתית של ניו יורק מתחילה לפעול | build
Disneyland | 1955 | נפתח פארק דיסנילנד בקליפורניה | build
Walt Disney World | 1971 | נפתח דיסני וורלד בפלורידה | build
Disneyland Paris | 1992 | נפתח יורודיסני ליד פריז | build
Camp Nou | 1957 | נחנך אצטדיון קאמפ נואו | build
Maracanã Stadium | 1950 | נחנך אצטדיון המרקאנה | build
Santiago Bernabéu Stadium | 1947 | נחנך אצטדיון סנטיאגו ברנבאו | build
Old Trafford | 1910 | נחנך אצטדיון אולד טראפורד | build
Coca-Cola | 1886 | בבית מרקחת באטלנטה נמכרת לראשונה קוקה-קולה | biz
Starbucks | 1971 | נפתח בסיאטל בית הקפה הראשון של סטארבקס | biz
IKEA | 1943 | נוסדת איקאה | biz
The Lego Group | 1932 | נוסדת חברת לגו | biz
Nintendo | 1889 | נוסדת נינטנדו, אז יצרנית קלפים | biz
Sony | 1946 | נוסדת סוני | biz
Toyota | 1937 | נוסדת טויוטה | biz
Samsung | 1938 | נוסדת סמסונג | biz
Apple Inc. | 1976 | נוסדת אפל | tech
Microsoft | 1975 | נוסדת מיקרוסופט | tech
Google | 1998 | נוסדת גוגל | tech
Amazon (company) | 1994 | נוסדת אמזון | tech
Facebook | 2004 | פייסבוק עולה לרשת | tech
Twitter | 2006 | טוויטר עולה לרשת | tech
YouTube | 2005 | יוטיוב עולה לרשת | tech
Wikipedia | 2001 | ויקיפדיה עולה לרשת | tech
Netflix | 1997 | נוסדת נטפליקס | tech
Tesla, Inc. | 2003 | נוסדת טסלה | tech
SpaceX | 2002 | נוסדת ספייס אקס | tech
Instagram | 2010 | מושקת אינסטגרם | tech
WhatsApp | 2009 | נוסדת ווטסאפ | tech
Airbnb | 2008 | נוסדת Airbnb | tech
Uber | 2009 | נוסדת אובר | tech
EBay | 1995 | נוסדת eBay | tech
PayPal | 1998 | נוסדת פייפאל | tech
Skype | 2003 | מושקת סקייפ | tech
Zoom Video Communications | 2011 | נוסדת זום | tech
Nokia | 1865 | נוסדת נוקיה, אז מפעל נייר | biz
Adidas | 1949 | נוסדת אדידס | biz
Nike, Inc. | 1964 | נוסדת נייקי | biz
Puma (brand) | 1948 | נוסדת פומה | biz
Ford Motor Company | 1903 | נוסדת חברת פורד | biz
Mercedes-Benz | 1926 | נולד המותג מרצדס-בנץ | biz
BMW | 1916 | נוסדת ב.מ.וו | biz
Volkswagen | 1937 | נוסדת פולקסווגן | biz
Harley-Davidson | 1903 | נוסדת הארלי-דייווידסון | biz
Boeing | 1916 | נוסדת בואינג | biz
Airbus | 1970 | נוסדת איירבוס | biz
The Walt Disney Company | 1923 | נוסדת חברת וולט דיסני | biz
Warner Bros. | 1923 | נוסדים אולפני האחים וורנר | biz
Pixar | 1986 | נוסדת פיקסאר | biz
Nestlé | 1866 | נוסדת נסטלה | biz
Kellogg's | 1906 | נוסדת קלוגס | biz
Nutella | 1964 | נוטלה מגיעה למדפים | biz
Barbie | 1959 | בובת ברבי מוצגת לראשונה | play
Rubik's Cube | 1974 | ארנה רוביק ממציא את הקובייה ההונגרית | play
Monopoly (game) | 1935 | משחק המונופול יוצא לחנויות | play
Tetris | 1984 | אלכסיי פאז'יטנוב יוצר את טטריס | play
Game Boy | 1989 | נינטנדו משיקה את הגיים בוי | play
PlayStation (console) | 1994 | סוני משיקה את הפלייסטיישן הראשון | play
Xbox (console) | 2001 | מיקרוסופט משיקה את ה-Xbox הראשון | play
Nintendo Entertainment System | 1983 | נינטנדו משיקה ביפן את קונסולת ה-NES | play
Wii | 2006 | נינטנדו משיקה את ה-Wii | play
Nintendo Switch | 2017 | נינטנדו משיקה את הסוויץ' | play
Atari 2600 | 1977 | אטארי משיקה את הקונסולה הביתית שלה | play
Pac-Man | 1980 | פקמן מגיע לאולמות המשחקים | play
Super Mario Bros. | 1985 | יוצא המשחק "סופר מריו ברוס" | play
The Legend of Zelda (video game) | 1986 | יוצא המשחק הראשון בסדרת "זלדה" | play
Pokémon Red, Blue, and Yellow | 1996 | יוצאים משחקי הפוקימון הראשונים | play
The Sims (video game) | 2000 | יוצא המשחק "הסימס" | play
Fortnite | 2017 | יוצא המשחק "פורטנייט" | play
Angry Birds (video game) | 2009 | יוצא המשחק "אנגרי בירדס" | play
Candy Crush Saga | 2012 | יוצא המשחק "קנדי קראש" | play
Pokémon Go | 2016 | "פוקימון גו" מוציא את כולם לרחובות | play
Pong | 1972 | אטארי מוציאה את משחק הווידאו "פונג" | play
Space Invaders | 1978 | יוצא המשחק "פולשים מהחלל" | play
Donkey Kong (1981 video game) | 1981 | יוצא המשחק "דונקי קונג" | play
Sonic the Hedgehog (1991 video game) | 1991 | יוצא המשחק הראשון של סוניק הקיפוד | play
Doom (1993 video game) | 1993 | יוצא משחק המחשב "דום" | play
Tomb Raider (1996 video game) | 1996 | יוצא המשחק הראשון של לארה קרופט | play
Grand Theft Auto V | 2013 | יוצא המשחק GTA V | play
World of Warcraft | 2004 | יוצא המשחק "וורלד אוף וורקראפט" | play
Tamagotchi | 1996 | הטמגוצ'י יוצא לחנויות | play
Furby | 1998 | בובת הפרבי יוצאת לחנויות | play
Uno (card game) | 1971 | נולד משחק הקלפים "אונו" | play
Dungeons & Dragons | 1974 | יוצא משחק התפקידים "מבוכים ודרקונים" | play
Magic: The Gathering | 1993 | יוצא משחק הקלפים "מג'יק" | play
Walkman | 1979 | סוני משיקה את הווקמן | tech
Compact disc | 1982 | הקומפקט דיסק יוצא לשוק | tech
IPod | 2001 | אפל משיקה את האייפוד | tech
IPhone (1st generation) | 2007 | אפל משיקה את האייפון הראשון | tech
IPad (1st generation) | 2010 | אפל משיקה את האייפד הראשון | tech
Macintosh 128K | 1984 | אפל משיקה את מחשב המקינטוש | tech
IBM Personal Computer | 1981 | יבמ משיקה את המחשב האישי שלה, ה-PC | tech
Commodore 64 | 1982 | יוצא לשוק מחשב הקומודור 64 | tech
Linux kernel | 1991 | לינוס טורבאלדס משחרר את לינוקס | tech
Netscape Navigator | 1994 | יוצא הדפדפן נטסקייפ | tech
Internet Explorer | 1995 | יוצא הדפדפן אינטרנט אקספלורר | tech
Google Chrome | 2008 | יוצא הדפדפן גוגל כרום | tech
Gmail | 2004 | גוגל משיקה את Gmail | tech
Google Maps | 2005 | גוגל משיקה את Google Maps | tech
Bitcoin | 2009 | נכרה הביטקוין הראשון | tech
ChatGPT | 2022 | ChatGPT נפתח לציבור | tech
Amazon Kindle | 2007 | אמזון משיקה את הקינדל | tech
Nokia 3310 | 2000 | נוקיה משיקה את ה-3310 | tech
USB | 1996 | מוצג תקן החיבור USB | tech
Telephone | 1876 | אלכסנדר גרהם בל רושם פטנט על הטלפון | tech
Phonograph | 1877 | אדיסון ממציא את הפונוגרף | tech
Dynamite | 1867 | אלפרד נובל רושם פטנט על הדינמיט | tech
Penicillin | 1928 | אלכסנדר פלמינג מגלה את הפניצילין | space
X-ray | 1895 | רנטגן מגלה את קרני ה-X | space
Pluto | 1930 | מתגלה פלוטו | space
Uranus | 1781 | ויליאם הרשל מגלה את כוכב הלכת אורנוס | space
Neptune | 1846 | מתגלה כוכב הלכת נפטון | space
Higgs boson | 2012 | בסרן מכריזים על גילוי בוזון היגס | space
Tomb of Tutankhamun | 1922 | הווארד קרטר מגלה את קבר תות ענח' אמון | space
Rosetta Stone | 1799 | מתגלה אבן רוזטה | space
Lascaux | 1940 | מתגלים ציורי המערות בלאסקו | space
Terracotta Army | 1974 | מתגלה בסין צבא הטרקוטה | space
On the Origin of Species | 1859 | דרווין מפרסם את "מוצא המינים" | book
Philosophiæ Naturalis Principia Mathematica | 1687 | ניוטון מפרסם את ה"פרינקיפיה" | book
Sputnik 1 | 1957 | משוגר ספוטניק 1, הלוויין המלאכותי הראשון | space
Vostok 1 | 1961 | יורי גגארין הוא האדם הראשון בחלל | space
Vostok 6 | 1963 | ולנטינה טרשקובה היא האישה הראשונה בחלל | space
Voskhod 2 | 1965 | אלכסיי לאונוב מבצע את הליכת החלל הראשונה | space
Apollo 8 | 1968 | אפולו 8 מקיפה את הירח עם צוות | space
Apollo 11 | 1969 | ניל ארמסטרונג צועד על הירח | space
Apollo 13 | 1970 | "יוסטון, יש לנו בעיה": אפולו 13 חוזרת בשלום | space
Apollo 17 | 1972 | אפולו 17: בני אדם על הירח בפעם האחרונה | space
Voyager 1 | 1977 | משוגרת החללית וויאג'ר 1 | space
Pioneer 10 | 1972 | משוגרת החללית פיוניר 10 | space
Mir | 1986 | משוגרת תחנת החלל מיר | space
International Space Station | 1998 | משוגר הרכיב הראשון של תחנת החלל הבין-לאומית | space
Skylab | 1973 | משוגרת תחנת החלל סקיילאב | space
STS-1 | 1981 | מעבורת החלל קולומביה ממריאה לטיסת הבכורה | space
Hubble Space Telescope | 1990 | משוגר טלסקופ החלל האבל | space
James Webb Space Telescope | 2021 | משוגר טלסקופ החלל ג'יימס וב | space
Mars Pathfinder | 1996 | משוגרת למאדים החללית פאת'פיינדר | space
New Horizons | 2006 | משוגרת החללית ניו הורייזונס אל פלוטו | space
Cassini–Huygens | 1997 | משוגרת החללית קאסיני אל שבתאי | space
Telstar 1 | 1962 | משוגר טלסטאר, לוויין התקשורת שהעביר שידור טלוויזיה חי | space
Explorer 1 | 1958 | משוגר אקספלורר 1, הלוויין האמריקאי הראשון | space
Chandrayaan-3 | 2023 | הודו מנחיתה חללית ליד הקוטב הדרומי של הירח | space
Falcon Heavy test flight | 2018 | ספייס אקס משגרת לחלל מכונית טסלה | space
Crew Dragon Demo-2 | 2020 | ספייס אקס משגרת אסטרונאוטים בפעם הראשונה | space
NASA | 1958 | נוסדת נאס"א | space
CERN | 1954 | נוסד מרכז המחקר סרן | space
Wright Flyer | 1903 | האחים רייט ממריאים בטיסה הממונעת הראשונה | tech
Concorde | 1969 | הקונקורד ממריא לטיסת הבכורה | tech | P606
Boeing 747 | 1969 | מטוס הג'מבו ממריא לטיסת הבכורה | tech | P606
Airbus A380 | 2005 | איירבוס A380 ממריא לטיסת הבכורה | tech | P606
Ford Model T | 1908 | פורד מתחילה לייצר את מודל T | tech
Volkswagen Beetle | 1938 | החיפושית של פולקסווגן יוצאת לדרך | tech
Mini | 1959 | המיני מיינור יוצאת לכבישים | tech
Tōkaidō Shinkansen | 1964 | רכבת הקליע הראשונה יוצאת לדרך ביפן | build
TGV | 1981 | רכבת ה-TGV מתחילה לנסוע בצרפת | build
Eurostar | 1994 | רכבת היורוסטאר מתחילה לנסוע | build
Orient Express | 1883 | האוריינט אקספרס יוצא למסע הראשון | build
Vespa | 1946 | הווספה הראשונה יוצאת מהמפעל | tech
1896 Summer Olympics | 1896 | נפתחים באתונה המשחקים האולימפיים המודרניים הראשונים | sport
1924 Winter Olympics | 1924 | נערכת אולימפיאדת החורף הראשונה | sport
1930 FIFA World Cup | 1930 | אורוגוואי מארחת את המונדיאל הראשון וזוכה בו | sport
1958 FIFA World Cup | 1958 | פלה בן ה-17 זוכה במונדיאל בשוודיה | sport
1966 FIFA World Cup | 1966 | אנגליה זוכה במונדיאל היחיד שלה | sport
1978 FIFA World Cup | 1978 | ארגנטינה זוכה לראשונה במונדיאל, על אדמתה | sport
1982 FIFA World Cup | 1982 | איטליה של פאולו רוסי זוכה במונדיאל בספרד | sport
1986 FIFA World Cup | 1986 | מראדונה מבקיע את "יד האלוהים" וזוכה במונדיאל | sport
1994 FIFA World Cup | 1994 | ברזיל גוברת על איטליה בפנדלים בגמר המונדיאל בפסדינה | sport
1998 FIFA World Cup | 1998 | צרפת זוכה לראשונה במונדיאל, על אדמתה | sport
2002 FIFA World Cup | 2002 | המונדיאל נערך ביפן ובדרום קוריאה | sport
2006 FIFA World Cup | 2006 | זידאן נוגח במטראצי בגמר המונדיאל | sport
2010 FIFA World Cup | 2010 | ספרד זוכה לראשונה במונדיאל, בדרום אפריקה | sport
2014 FIFA World Cup | 2014 | גרמניה מביסה את ברזיל 7:1 בחצי גמר המונדיאל | sport
2022 FIFA World Cup | 2022 | מסי מניף את גביע העולם בקטאר | sport
1960 Summer Olympics | 1960 | אבבה ביקילה מנצח יחף במרתון האולימפי ברומא | sport
1968 Summer Olympics | 1968 | דיק פוסברי קופץ לגובה בסגנון הגב באולימפיאדת מקסיקו סיטי | sport
1976 Summer Olympics | 1976 | נדיה קומנצ'י מקבלת 10 מושלם באולימפיאדת מונטריאול | sport
1984 Summer Olympics | 1984 | קרל לואיס זוכה בארבע מדליות זהב באולימפיאדת לוס אנג'לס | sport
1988 Summer Olympics | 1988 | סיאול מארחת את האולימפיאדה | sport
1996 Summer Olympics | 1996 | מוחמד עלי מדליק את הלפיד באולימפיאדת אטלנטה | sport
2000 Summer Olympics | 2000 | סידני מארחת את האולימפיאדה | sport
2008 Summer Olympics | 2008 | מייקל פלפס זוכה בשמונה מדליות זהב באולימפיאדת בייג'ינג | sport
2012 Summer Olympics | 2012 | לונדון מארחת את האולימפיאדה בפעם השלישית | sport
2016 Summer Olympics | 2016 | ריו דה ז'ניירו מארחת את האולימפיאדה | sport
UEFA Euro 1992 | 1992 | דנמרק מפתיעה וזוכה ביורו | sport
UEFA Euro 2004 | 2004 | יוון מפתיעה וזוכה ביורו | sport
UEFA Euro 2016 | 2016 | פורטוגל זוכה ביורו בפעם הראשונה | sport
1999 UEFA Champions League final | 1999 | מנצ'סטר יונייטד מהפכת את גמר ליגת האלופות בתוספת הזמן | sport
2005 UEFA Champions League final | 2005 | ליברפול חוזרת מפיגור 3:0 בגמר ליגת האלופות באיסטנבול | sport
Premier League | 1992 | נוסדת הפרמייר ליג האנגלית | sport
National Basketball Association | 1946 | נוסדת ליגת ה-NBA | sport
1903 Tour de France | 1903 | יוצא לדרך הטור דה פראנס הראשון | sport
1877 Wimbledon Championship | 1877 | נערך טורניר וימבלדון הראשון | sport
Super Bowl I | 1967 | נערך הסופרבול הראשון | sport
FIFA | 1904 | נוסדת פיפ"א | sport
UEFA | 1954 | נוסדת אופ"א | sport
International Olympic Committee | 1894 | נוסד הוועד האולימפי הבין-לאומי | sport
FC Barcelona | 1899 | נוסד מועדון הכדורגל ברצלונה | sport
Real Madrid CF | 1902 | נוסד מועדון הכדורגל ריאל מדריד | sport
Liverpool F.C. | 1892 | נוסד מועדון הכדורגל ליברפול | sport
Juventus FC | 1897 | נוסד מועדון הכדורגל יובנטוס | sport
FC Bayern Munich | 1900 | נוסד מועדון הכדורגל באיירן מינכן | sport
Chelsea F.C. | 1905 | נוסד מועדון הכדורגל צ'לסי | sport
Paris Saint-Germain FC | 1970 | נוסד מועדון הכדורגל פריז סן-ז'רמן | sport
The Rumble in the Jungle | 1974 | מוחמד עלי מנצח את ג'ורג' פורמן ב"קרב בג'ונגל" | sport
World Chess Championship 1972 | 1972 | בובי פישר מנצח את בוריס ספסקי ונעשה אלוף העולם בשחמט | sport
AlphaGo versus Lee Sedol | 2016 | תוכנת AlphaGo מנצחת את אלוף הגו לי סדול | tech
1953 British Mount Everest expedition | 1953 | הילרי וטנזינג מגיעים לראשונה לפסגת האוורסט | sport
Snow White and the Seven Dwarfs (1937 film) | 1937 | דיסני מוציא את "שלגייה ושבעת הגמדים" | film
The Wizard of Oz | 1939 | הסרט "הקוסם מארץ עוץ" יוצא לאקרנים | film
Gone with the Wind (film) | 1939 | "חלף עם הרוח" יוצא לאקרנים | film
Casablanca (film) | 1942 | "קזבלנקה" יוצא לאקרנים | film
Singin' in the Rain | 1952 | "שיר אשיר בגשם" יוצא לאקרנים | film
Psycho (1960 film) | 1960 | "פסיכו" של היצ'קוק יוצא לאקרנים | film
The Sound of Music (film) | 1965 | "צלילי המוזיקה" יוצא לאקרנים | film
The Godfather | 1972 | "הסנדק" יוצא לאקרנים | film
Jaws (film) | 1975 | "מלתעות" יוצא לאקרנים | film
Star Wars (film) | 1977 | הסרט הראשון של "מלחמת הכוכבים" יוצא לאקרנים | film
Grease (film) | 1978 | "גריז" יוצא לאקרנים | film
E.T. the Extra-Terrestrial | 1982 | "אי.טי. חבר מכוכב אחר" יוצא לאקרנים | film
Back to the Future | 1985 | "בחזרה לעתיד" יוצא לאקרנים | film
Top Gun | 1986 | "אהבה בשחקים" יוצא לאקרנים | film
Dirty Dancing | 1987 | "ריקוד מושחת" יוצא לאקרנים | film
Home Alone | 1990 | "שכחו אותי בבית" יוצא לאקרנים | film
Jurassic Park (film) | 1993 | "פארק היורה" יוצא לאקרנים | film
The Lion King | 1994 | "מלך האריות" יוצא לאקרנים | film
Pulp Fiction | 1994 | "ספרות זולה" יוצא לאקרנים | film
Forrest Gump | 1994 | "פורסט גאמפ" יוצא לאקרנים | film
Toy Story | 1995 | "צעצוע של סיפור" יוצא לאקרנים | film
Titanic (1997 film) | 1997 | "טיטניק" של ג'יימס קמרון יוצא לאקרנים | film
The Matrix | 1999 | "מטריקס" יוצא לאקרנים | film
Gladiator (2000 film) | 2000 | "גלדיאטור" יוצא לאקרנים | film
Shrek | 2001 | "שרק" יוצא לאקרנים | film
Harry Potter and the Philosopher's Stone (film) | 2001 | הסרט הראשון של הארי פוטר יוצא לאקרנים | film
The Lord of the Rings: The Fellowship of the Ring | 2001 | הסרט הראשון של "שר הטבעות" יוצא לאקרנים | film
Finding Nemo | 2003 | "מוצאים את נמו" יוצא לאקרנים | film
Avatar (2009 film) | 2009 | "אווטאר" יוצא לאקרנים | film
Frozen (2013 film) | 2013 | "לשבור את הקרח" יוצא לאקרנים | film
Inception | 2010 | "התחלה" של כריסטופר נולאן יוצא לאקרנים | film
The Dark Knight | 2008 | "האביר האפל" יוצא לאקרנים | film
Parasite (2019 film) | 2019 | "פרזיטים" הקוריאני יוצא לאקרנים | film
Barbie (film) | 2023 | הסרט "ברבי" יוצא לאקרנים | film
La La Land | 2016 | "לה לה לנד" יוצא לאקרנים | film
The Jazz Singer | 1927 | "זמר הג'אז", הסרט המדבר הראשון, יוצא לאקרנים | film
Steamboat Willie | 1928 | מיקי מאוס מופיע לראשונה בסרט "ספינת הקיטור וילי" | film
Modern Times (film) | 1936 | "זמנים מודרניים" של צ'פלין יוצא לאקרנים | film
Citizen Kane | 1941 | "האזרח קיין" יוצא לאקרנים | film
Bambi | 1942 | "במבי" של דיסני יוצא לאקרנים | film
Cinderella (1950 film) | 1950 | "סינדרלה" של דיסני יוצא לאקרנים | film
Ben-Hur (1959 film) | 1959 | "בן חור" עם צ'רלטון הסטון יוצא לאקרנים | film
Breakfast at Tiffany's (film) | 1961 | "ארוחת בוקר בטיפאני" יוצא לאקרנים | film
Dr. No (film) | 1962 | ג'יימס בונד מגיע לקולנוע ב"ד"ר נו" | film
Mary Poppins (film) | 1964 | "מרי פופינס" יוצא לאקרנים | film
The Graduate | 1967 | "הבוגר" יוצא לאקרנים | film
Rocky | 1976 | "רוקי" יוצא לאקרנים | film
Saturday Night Fever | 1977 | "שיגעון המוזיקה" יוצא לאקרנים | film
Raiders of the Lost Ark | 1981 | אינדיאנה ג'ונס מגיע לקולנוע | film
Ghostbusters | 1984 | "מכסחי השדים" יוצא לאקרנים | film
The Terminator | 1984 | "שליחות קטלנית" יוצא לאקרנים | film
Pretty Woman | 1990 | "אישה יפה" יוצא לאקרנים | film
The Silence of the Lambs (film) | 1991 | "שתיקת הכבשים" יוצא לאקרנים | film
The Truman Show | 1998 | "המופע של טרומן" יוצא לאקרנים | film
Amélie | 2001 | "אמלי" יוצא לאקרנים | film
Slumdog Millionaire | 2008 | "נער החידות ממומביי" יוצא לאקרנים | film
The Social Network | 2010 | "הרשת החברתית" יוצא לאקרנים | film
Avengers: Endgame | 2019 | "הנוקמים: סוף המשחק" יוצא לאקרנים | film
Spirited Away | 2001 | "המסע המופלא" של מיאזאקי יוצא לאקרנים | film
1st Academy Awards | 1929 | נערך טקס האוסקר הראשון | film
Cannes Film Festival | 1946 | נערך לראשונה פסטיבל קאן | film
I Love Lucy | 1951 | "אני אוהב את לוסי" עולה לשידור | tv
Sesame Street | 1969 | "רחוב סומסום" האמריקאית עולה לשידור | tv
The Simpsons | 1989 | "משפחת סימפסון" עולה לשידור כסדרה | tv
Friends | 1994 | "חברים" עולה לשידור | tv
Seinfeld | 1989 | "סיינפלד" עולה לשידור | tv
Dallas (1978 TV series) | 1978 | "דאלאס" עולה לשידור | tv
The Muppet Show | 1976 | "החבובות" עולה לשידור | tv
Star Trek: The Original Series | 1966 | "מסע בין כוכבים" עולה לשידור | tv
Doctor Who | 1963 | "דוקטור הו" עולה לשידור ב-BBC | tv
The Sopranos | 1999 | "הסופרנוס" עולה לשידור | tv
Lost (2004 TV series) | 2004 | "אבודים" עולה לשידור | tv
Game of Thrones | 2011 | "משחקי הכס" עולה לשידור | tv
Breaking Bad | 2008 | "שובר שורות" עולה לשידור | tv
Squid Game | 2021 | "משחקי הדיונון" עולה בנטפליקס | tv
Stranger Things | 2016 | "דברים מוזרים" עולה בנטפליקס | tv
The Office (American TV series) | 2005 | הגרסה האמריקאית של "המשרד" עולה לשידור | tv
Sex and the City | 1998 | "סקס והעיר הגדולה" עולה לשידור | tv
The X-Files | 1993 | "תיקים באפלה" עולה לשידור | tv
Baywatch | 1989 | "משמר המפרץ" עולה לשידור | tv
Beverly Hills, 90210 | 1990 | "בוורלי הילס 90210" עולה לשידור | tv
MTV | 1981 | MTV מתחיל לשדר | media
CNN | 1980 | CNN מתחיל לשדר חדשות מסביב לשעון | media
BBC | 1922 | נוסד ה-BBC | media
Eurovision Song Contest 1956 | 1956 | נערכת תחרות האירוויזיון הראשונה | music
Eurovision Song Contest 1974 | 1974 | אבבא זוכה באירוויזיון עם "ווטרלו" | music
Survivor (American TV series) | 2000 | "הישרדות" האמריקאית עולה לשידור | tv
American Idol | 2002 | "אמריקן איידול" עולה לשידור | tv
SpongeBob SquarePants | 1999 | "בובספוג מכנסמרובע" עולה לשידור | tv
The Flintstones | 1960 | "משפחת קדמוני" עולה לשידור | tv
Superman | 1938 | סופרמן מופיע לראשונה בחוברת קומיקס | book
Batman | 1939 | באטמן מופיע לראשונה בחוברת קומיקס | book
Spider-Man | 1962 | ספיידרמן מופיע לראשונה בחוברת קומיקס | book
Peanuts | 1950 | סנופי וצ'רלי בראון מופיעים לראשונה בעיתון | book
Garfield | 1978 | החתול גארפילד מופיע לראשונה בעיתון | book
Hello Kitty | 1974 | נולדת הדמות הלו קיטי | play
Asterix | 1959 | אסטריקס מופיע לראשונה | book
The Smurfs | 1958 | הדרדסים מופיעים לראשונה בקומיקס בלגי | book
Winnie-the-Pooh (book) | 1926 | יוצא לאור "פו הדב" | book
Robinson Crusoe | 1719 | יוצא לאור "רובינזון קרוזו" | book
Gulliver's Travels | 1726 | יוצא לאור "מסעי גוליבר" | book
Pride and Prejudice | 1813 | ג'יין אוסטן מפרסמת את "גאווה ודעה קדומה" | book
Frankenstein | 1818 | מרי שלי מפרסמת את "פרנקנשטיין" | book
Alice's Adventures in Wonderland | 1865 | יוצא לאור "הרפתקאות אליס בארץ הפלאות" | book
Les Misérables | 1862 | ויקטור הוגו מפרסם את "עלובי החיים" | book
The Adventures of Tom Sawyer | 1876 | מארק טוויין מפרסם את "הרפתקאות תום סויר" | book
Treasure Island | 1883 | יוצא לאור כספר "אי המטמון" | book
A Study in Scarlet | 1887 | שרלוק הולמס מופיע לראשונה, ב"חקירה בשני" | book
Dracula | 1897 | בראם סטוקר מפרסם את "דרקולה" | book
The Jungle Book | 1894 | קיפלינג מפרסם את "ספר הג'ונגל" | book
The Wonderful Wizard of Oz | 1900 | יוצא לאור הספר "הקוסם מארץ עוץ" | book
Anne of Green Gables | 1908 | יוצא לאור "האסופית" | book
The Little Prince | 1943 | יוצא לאור "הנסיך הקטן" | book
Animal Farm | 1945 | ג'ורג' אורוול מפרסם את "חוות החיות" | book
The Catcher in the Rye | 1951 | יוצא לאור "התפסן בשדה השיפון" | book
The Old Man and the Sea | 1952 | המינגוויי מפרסם את "הזקן והים" | book
The Hobbit | 1937 | טולקין מפרסם את "ההוביט" | book
The Lion, the Witch and the Wardrobe | 1950 | יוצא לאור "האריה, המכשפה וארון הבגדים" | book
Pippi Longstocking (novel) | 1945 | יוצא לאור "בילבי" של אסטריד לינדגרן | book
Charlie and the Chocolate Factory | 1964 | רואלד דאל מפרסם את "צ'רלי והשוקולדה" | book
One Hundred Years of Solitude | 1967 | גבריאל גארסיה מארקס מפרסם את "מאה שנים של בדידות" | book
The Hitchhiker's Guide to the Galaxy (novel) | 1979 | יוצא לאור הספר "מדריך הטרמפיסט לגלקסיה" | book
The Name of the Rose | 1980 | אומברטו אקו מפרסם את "שם הוורד" | book
Harry Potter and the Philosopher's Stone | 1997 | יוצא לאור הספר הראשון של הארי פוטר | book
The Da Vinci Code | 2003 | יוצא לאור "צופן דה וינצ'י" | book
The Hunger Games (novel) | 2008 | יוצא לאור "משחקי הרעב" | book
Twilight (Meyer novel) | 2005 | יוצא לאור "דמדומים" | book
A Brief History of Time | 1988 | סטיבן הוקינג מפרסם את "קיצור תולדות הזמן" | book
The Alchemist (novel) | 1988 | פאולו קואלו מפרסם את "האלכימאי" | book
Guinness World Records | 1955 | יוצא לאור ספר השיאים של גינס הראשון | book
Encyclopædia Britannica | 1768 | מתחילה לצאת לאור אנציקלופדיה בריטניקה | book
The Beatles | 1960 | קמה להקת הביטלס | music
The Rolling Stones | 1962 | קמה להקת הרולינג סטונס | music
Queen (band) | 1970 | קמה להקת קווין | music
ABBA | 1972 | קמה להקת אבבא | music
Sgt. Pepper's Lonely Hearts Club Band | 1967 | הביטלס מוציאים את "סרג'נט פפר" | music
Abbey Road | 1969 | הביטלס מוציאים את "אבי רואד" | music
Thriller (album) | 1982 | מייקל ג'קסון מוציא את "Thriller" | music
The Dark Side of the Moon | 1973 | פינק פלויד מוציאה את "הצד האפל של הירח" | music
The Wall | 1979 | פינק פלויד מוציאה את "החומה" | music
Nevermind | 1991 | נירוונה מוציאה את "Nevermind" | music
Bohemian Rhapsody | 1975 | קווין מוציאה את "רפסודיה בוהמית" | music
Imagine (song) | 1971 | ג'ון לנון מוציא את "Imagine" | music
Like a Virgin (album) | 1984 | מדונה מוציאה את "Like a Virgin" | music
Purple Rain (album) | 1984 | פרינס מוציא את "Purple Rain" | music
Hotel California (album) | 1976 | האיגלס מוציאים את "הוטל קליפורניה" | music
Gangnam Style | 2012 | "גנגנם סטייל" כובש את יוטיוב | music
Despacito | 2017 | "דספסיטו" יוצא ושובר שיאי צפיות | music
...Baby One More Time (song) | 1998 | בריטני ספירס מוציאה את "Baby One More Time" | music
Wannabe | 1996 | הספייס גירלס מוציאות את "Wannabe" | music
We Are the World | 1985 | כוכבי הפופ האמריקאים מקליטים את "We Are the World" | music
Live Aid | 1985 | מופע הענק "לייב אייד" נערך בלונדון ובפילדלפיה | music
Woodstock | 1969 | נערך פסטיבל וודסטוק | music
Like a Rolling Stone | 1965 | בוב דילן מוציא את "Like a Rolling Stone" | music
Yesterday (Beatles song) | 1965 | הביטלס מוציאים את "Yesterday" | music
Hey Jude | 1968 | הביטלס מוציאים את "Hey Jude" | music
Dancing Queen | 1976 | אבבא מוציאה את "Dancing Queen" | music
I Will Survive | 1978 | גלוריה גיינור מוציאה את "I Will Survive" | music
Back in Black | 1980 | AC/DC מוציאה את "Back in Black" | music
The Joshua Tree | 1987 | U2 מוציאה את "The Joshua Tree" | music
Bad (album) | 1987 | מייקל ג'קסון מוציא את "Bad" | music
OK Computer | 1997 | רדיוהד מוציאה את "OK Computer" | music
Shape of You | 2017 | אד שירן מוציא את "Shape of You" | music
Hallelujah (Leonard Cohen song) | 1984 | לאונרד כהן מוציא את "הללויה" | music
White Christmas (song) | 1942 | בינג קרוסבי מקליט את "White Christmas" | music
Heartbreak Hotel | 1956 | אלביס פרסלי מוציא את "Heartbreak Hotel" | music
Love Me Do | 1962 | הביטלס מוציאים את הסינגל הראשון, "Love Me Do" | music
Boléro | 1928 | ה"בולרו" של ראוול מבוצע לראשונה | music
The Rite of Spring | 1913 | "פולחן האביב" של סטרווינסקי מסעיר את פריז בבכורה | music
Symphony No. 9 (Beethoven) | 1824 | הסימפוניה התשיעית של בטהובן מבוצעת לראשונה | music
The Magic Flute | 1791 | "חליל הקסם" של מוצרט עולה לראשונה | music
Carmen | 1875 | האופרה "כרמן" עולה לראשונה | music
Swan Lake | 1877 | הבלט "אגם הברבורים" עולה לראשונה | music
The Nutcracker | 1892 | הבלט "מפצח האגוזים" עולה לראשונה | music
La traviata | 1853 | האופרה "לה טרוויאטה" עולה לראשונה | music
West Side Story | 1957 | המחזמר "סיפור הפרברים" עולה בברודוויי | music
Cats (musical) | 1981 | המחזמר "קאטס" עולה בלונדון | music
The Phantom of the Opera (1986 musical) | 1986 | המחזמר "פנטום האופרה" עולה בלונדון | music
Hair (musical) | 1967 | המחזמר "שיער" עולה לראשונה | music
Fiddler on the Roof | 1964 | המחזמר "כנר על הגג" עולה בברודוויי | music
Hamilton (musical) | 2015 | המחזמר "המילטון" עולה לראשונה | music
Mamma Mia! (musical) | 1999 | המחזמר "מאמא מיה!" עולה בלונדון | music
The Starry Night | 1889 | ואן גוך מצייר את "ליל כוכבים" | art
The Scream | 1893 | אדוורד מונק מצייר את "הצעקה" | art
The Persistence of Memory | 1931 | סלבדור דאלי מצייר את השעונים הנמסים | art
Campbell's Soup Cans | 1962 | אנדי וורהול מציג את פחיות המרק של קמפבל | art
Impression, Sunrise | 1872 | קלוד מונה מצייר את "התרשמות, זריחה" | art
Les Demoiselles d'Avignon | 1907 | פיקאסו מצייר את "העלמות מאביניון" | art
Fountain (Duchamp) | 1917 | מרסל דושאן מציג משתנה כיצירת אמנות | art
Michelin Guide | 1900 | יוצא לאור מדריך מישלן הראשון | book
Time (magazine) | 1923 | יוצא הגיליון הראשון של המגזין "טיים" | media
National Geographic | 1888 | יוצא הגיליון הראשון של "נשיונל ג'יאוגרפיק" | media
The New York Times | 1851 | נוסד העיתון "ניו יורק טיימס" | media
Vogue (magazine) | 1892 | נוסד מגזין האופנה "ווג" | media
Harvard University | 1636 | נוסדת אוניברסיטת הרווארד | inst
Yale University | 1701 | נוסדת אוניברסיטת ייל | inst
Massachusetts Institute of Technology | 1861 | נוסד המכון הטכנולוגי של מסצ'וסטס, MIT | inst
International Committee of the Red Cross | 1863 | נוסד הצלב האדום | inst
World Wide Fund for Nature | 1961 | נוסדת קרן WWF לשימור הטבע | inst
Greenpeace | 1971 | נוסד ארגון גרינפיס | inst
Mensa International | 1946 | נוסד ארגון מנסה | inst
Heineken | 1864 | נוסדת מבשלת הייניקן | biz
Carlsberg Group | 1847 | נוסדת מבשלת קרלסברג | biz
Levi Strauss & Co. | 1853 | נוסדת חברת ליווייס | biz
Louis Vuitton | 1854 | נוסד בית האופנה לואי ויטון | biz
Gucci | 1921 | נוסד בית האופנה גוצ'י | biz
H&M | 1947 | נוסדת רשת H&M | biz
Rolex | 1905 | נוסדת רולקס | biz
Swatch | 1983 | שעוני סווטש יוצאים לשוק | biz
Gillette | 1901 | נוסדת ג'ילט | biz
Chupa Chups | 1958 | נולד הסוכר על מקל צ'ופה צ'ופס | biz
Haribo | 1920 | נוסדת חברת הממתקים האריבו | biz
Toblerone | 1908 | נולד שוקולד טובלרון | biz
Oreo | 1912 | עוגיות אוראו מגיעות למדפים | biz
M&M's | 1941 | סוכריות M&M's מגיעות למדפים | biz
Kit Kat | 1935 | חטיף הקיט קט מגיע למדפים | biz
Snickers | 1930 | חטיף הסניקרס מגיע למדפים | biz
Nespresso | 1986 | נוסדת נספרסו | biz
Sprite (drink) | 1961 | המשקה ספרייט יוצא לשוק | biz
Happy Meal | 1979 | מקדונלד'ס משיקה את ארוחת הילדים "הפי מיל" | biz
Tabasco sauce | 1868 | רוטב הטבסקו יוצא לשוק | biz
Ben & Jerry's | 1978 | נפתחת הגלידרייה הראשונה של בן אנד ג'ריס | biz
Domino's | 1960 | נוסדת דומינו'ס פיצה | biz
Pizza Hut | 1958 | נוסדת פיצה האט | biz
Subway (restaurant) | 1965 | נוסדת רשת סאבוויי | biz
Walmart | 1962 | נפתחת החנות הראשונה של וולמארט | biz
American Express | 1850 | נוסדת אמריקן אקספרס | biz
Play-Doh | 1956 | הפלסטלינה "פליי-דו" יוצאת לחנויות | play
Etch A Sketch | 1960 | לוח הציור "אץ' א סקץ'" יוצא לחנויות | play
Street Fighter II | 1991 | יוצא המשחק "סטריט פייטר 2" | play
Mortal Kombat (1992 video game) | 1992 | יוצא המשחק "מורטל קומבט" | play
FIFA International Soccer | 1993 | יוצא המשחק הראשון בסדרת FIFA | play
SimCity (1989 video game) | 1989 | יוצא המשחק "סים סיטי" | play
Minecraft | 2011 | יוצאת הגרסה המלאה של "מיינקראפט" | play
TikTok | 2016 | מושקת בסין האפליקציה שתהפוך לטיקטוק | tech
Spotify | 2006 | נוסדת ספוטיפיי | tech
LinkedIn | 2003 | לינקדאין עולה לרשת | tech
Firefox | 2004 | יוצא הדפדפן פיירפוקס | tech
Android (operating system) | 2008 | יוצא הטלפון הראשון עם מערכת אנדרואיד | tech
Microsoft Windows | 1985 | מיקרוסופט מוציאה את הגרסה הראשונה של חלונות | tech
DVD | 1996 | נגני ה-DVD הראשונים יוצאים לשוק | tech
Petronas Towers | 1999 | נחנכים מגדלי פטרונס בקואלה לומפור | build
Big Ben | 1859 | שעון הביג בן מתחיל לתקתק | build
Wembley Stadium | 2007 | נפתח אצטדיון ומבלי החדש | build
Pepsi | 1893 | רוקח מצפון קרוליינה ממציא את המשקה שיהפוך לפפסי | biz
Kodak | 1888 | ג'ורג' איסטמן משיק את מצלמת הקודאק | tech
Stanford University | 1885 | נוסדת אוניברסיטת סטנפורד | inst
Red Bull | 1987 | משקה האנרגיה רד בול יוצא לשוק | biz
Burger King | 1954 | נוסדת ברגר קינג | biz
Zara (retailer) | 1975 | נפתחת בספרד החנות הראשונה של זארה | biz
Around the World in Eighty Days | 1873 | ז'ול ורן מפרסם את "מסביב לעולם בשמונים יום" | book
Messiah (Handel) | 1742 | ה"משיח" של הנדל מבוצע לראשונה | music
Band-Aid | 1920 | מומצא הפלסטר הדביק | tech
`;
