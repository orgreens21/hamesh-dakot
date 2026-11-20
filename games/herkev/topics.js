// The topics of צומת. Each day's grid belongs to one of them (grids.js says which), and only that
// topic's answer list is loaded (data/<id>.js, one file per topic, built by build-data.mjs).
// Everything here is written by hand; nothing in it is a fact about an answer.

export const TOPICS = {
  countries: {
    label: 'מדינות העולם',
    noun: 'מדינה',
    placeholder: 'הקלידו שם של מדינה…',
    none: 'לא מצאנו מדינה כזאת ברשימה',
    example: 'למשל מדינה באפריקה שהשפה הרשמית שלה צרפתית',
    icon: 'globe',
    load: () => import('./data/countries.js'),
  },
  screen: {
    label: 'קולנוע וטלוויזיה',
    noun: 'שחקן או שחקנית',
    placeholder: 'הקלידו שם של שחקן או שחקנית…',
    none: 'לא מצאנו שם כזה ברשימה',
    example: 'למשל מי שזכו באוסקר וגם הופיעו בסרטי הארי פוטר',
    icon: 'film',
    load: () => import('./data/screen.js'),
  },
  music: {
    label: 'מוזיקה ישראלית',
    noun: 'זמר או זמרת',
    placeholder: 'הקלידו שם של זמר או זמרת…',
    none: 'לא מצאנו שם כזה ברשימה',
    example: 'למשל מי שנולדו בשנות ה־70 ושרו באירוויזיון',
    icon: 'note',
    load: () => import('./data/music.js'),
  },
  places: {
    label: 'יישובים בישראל',
    noun: 'יישוב',
    placeholder: 'הקלידו שם של יישוב…',
    none: 'לא מצאנו יישוב כזה ברשימה',
    example: 'למשל קיבוץ במחוז הצפון',
    icon: 'pin',
    load: () => import('./data/places.js'),
  },
  football: {
    label: 'כדורגל ישראלי',
    noun: 'כדורגלן',
    placeholder: 'הקלידו שם של כדורגלן…',
    none: 'לא מצאנו כדורגלן כזה ברשימה',
    example: 'למשל מי ששיחק גם במכבי חיפה וגם בהפועל תל אביב',
    icon: 'ball',
    load: () => import('./data/football.js'),
  },
};

export const TOPIC_IDS = Object.keys(TOPICS);
