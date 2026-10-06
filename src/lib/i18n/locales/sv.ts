import type { Messages, Segment } from './en';

// Swedish UI text; see en.ts for the conventions.
// Addresses the visitor as «du», as Swedish sites do.

const num = (n: number) => n.toLocaleString('sv');
/** Pick the word form for n: 1 röst, 2 röster. */
const plural = (n: number, one: string, other: string) => (n === 1 ? one : other);
const by = (segment: Segment) =>
  segment === 'designers' ? ' från designers' : segment === 'others' ? ' från icke-designers' : '';

export const sv: Messages = {
  brand: 'Poster Vote',
  loading: 'Laddar',
  yes: 'Ja',
  no: 'Nej',
  designerQuestion: 'Är du designer?',
  coffee: 'Bjud oss på en kaffe',

  share: {
    label: 'Dela',
    poster: (title: string) => `Dela ${title}`,
    copied: 'Länken kopierad'
  },

  header: {
    mute: 'Stäng av ljud',
    unmute: 'Slå på ljud',
    muteLabel: 'Stäng av ljudet',
    unmuteLabel: 'Slå på ljudet',
    keepVoting: '← Fortsätt rösta',
    rankings: 'Topplista →',
    setupTitle: 'Nästan klart',
    setupBody: ['Lägg till din Convex-URL i ', ' (eller kör ', ' för att ställa in den).']
  },

  menu: {
    label: 'Meny',
    vote: 'Rösta',
    rankings: 'Topplista',
    about: 'Om',
    settings: 'Inställningar',
    past: 'Tidigare tävlingar'
  },

  vote: {
    vaultError: 'Kunde inte nå postervalvet.',
    noPosters: 'Inga affischer än',
    noPostersBody: ['Lägg bilder i ', ' och kör ', '.'],
    start: 'Börja rösta',
    doneTitle: 'Det var alla par!',
    doneBody: (pairs: number) =>
      `Du har gått igenom alla ${num(pairs)} par av de nuvarande affischerna. Kom tillbaka när nya dyker upp.`,
    seeRankings: 'Se topplistan →',
    seenAllTitle: 'Du har röstat på alla affischer!',
    seenAllBody: '(Men det finns fortfarande många fler kombinationer att rösta på)',
    continueVoting: 'Fortsätt rösta!',
    progress: (seen: number, total: number) => `${num(seen)} av ${num(total)} affischer sedda`,
    votesOnPair: (n: number) => `${num(n)} ${plural(n, 'röst', 'röster')} på det här paret`,
    voteFor: (title: string) => `Rösta på ${title}`,
    yourPick: 'ditt val',
    ofVoters: 'av rösterna',
    skip: 'Kan inte välja? Hoppa över →',
    next: 'Nästa →',
    pastVotes: 'Tidigare röster',
    previousVote: 'Föregående röst',
    nextVote: 'Nästa röst',
    pauseAutoplay: 'Pausa automatisk uppspelning',
    resumeAutoplay: 'Återuppta automatisk uppspelning',
    error: 'Rösten försvann bland prickarna. Prova nästa par!',
    verdict: {
      tie: [
        'Helt oavgjort. Rösterna står och väger.',
        'Delade meningar — det är 50/50!',
        'Dött lopp! Båda affischerna har lika många röster.',
        'Låst läge! Rösterna är exakt jämnt fördelade.',
        'Oavgjort! Är de här två lika starka?'
      ],
      unanimous: [
        'Enhälligt. Alla håller med.',
        'Enhälligt! Alla är överens.',
        'Total enighet — 100 % av rösterna är likadana.',
        'Fullständig konsensus! Varenda röst håller med.',
        'Enhälligt beslut! Inte en enda röst emot.'
      ],
      obvious: [
        'Självklart. Nästan alla håller med.',
        'Överväldigande! Nästan alla är med på noterna.',
        'Nästan rent hus! En stor majoritet håller med.',
        'Tydlig majoritet! Nästan alla röster går åt samma håll.',
        'Klar vinnare! De allra flesta håller med.'
      ],
      streak: (n: number) => [
        `I takt med massan — ${num(n)} i rad!`,
        `Helt i synk — ${num(n)} i rad!`,
        `På rulle — ${num(n)} i rad!`,
        `Mitt i prick med massan — ${num(n)} i rad!`,
        `Samma smak som massan — ${num(n)} i rad!`
      ],
      crowd: [
        'Du håller med de flesta.',
        'Du följer massan — och är i gott sällskap.',
        'I linje med majoriteten — du är en av många.',
        'Med strömmen — du hör till majoriteten.',
        'Majoriteten bestämmer — och du valde vinnaren.'
      ],
      contrarian: [
        'En äkta rebell. Ikoniskt.',
        'Mot strömmen — du sticker ut från mängden.',
        'Självständig tänkare — du går din egen väg.',
        'Som en ensamvarg — du röstade mot massan.',
        'Mot massan! Du styr ditt eget öde.'
      ],
      minority: [
        'Modig smak — du är i minoritet.',
        'I minoritet — följ ditt hjärta!',
        'Ingen säger åt dig hur du ska rösta.',
        'Du tänker annorlunda än massan — precis som du ska!',
        'Rebellröst — du bröt dig loss från majoriteten.'
      ]
    }
  },

  settings: {
    title: 'Inställningar',
    designerHint: 'Används för att dela upp topplistan. En ändring gäller dina röster från och med nu.',
    language: 'Språk',
    yourVotes: 'Dina röster',
    counting: 'Räknar…',
    votedBefore: 'Du har röstat',
    votedAfter: (n: number) => `${plural(n, 'gång', 'gånger')}.`,
    clearHint: 'Att rensa glömmer ditt designersvar, hur långt du har kommit bland paren och dina ljud- och språkinställningar.',
    clear: 'Rensa data',
    clearConfirm:
      'Rensa allt Poster Vote minns på den här enheten? Du börjar om som en ny röstare. Röster du redan har lagt finns kvar i topplistan.'
  },

  about: {
    title: 'Om',
    madeBy: 'Gjord av',
    supportUs: 'Stöd oss',
    people: ['Alisa Vasileva', 'Josh Thompson'],
    elo: {
      title: 'Så funkar topplistan',
      body: [
        'Affischerna rankas med Elo-systemet, samma som används i schack. Varje affisch börjar på 1000 poäng, och varje röst flyttar poäng från förloraren till vinnaren.',
        'Hur många beror på vem man slår: att slå en jämbördig affisch ger 16 poäng, att fälla en favorit ger upp till 32, och att slå en underdog ger bara några få.',
        'En affisch som vinner ofta över många dueller kan alltså gå förbi en med perfekt facit från bara några få. Några poängs skillnad är i praktiken oavgjort.'
      ],
      more: ['Läs mer om ', 'Elo-rating', ' på Wikipedia.'],
      url: 'https://sv.wikipedia.org/wiki/Elo-rating'
    },
    bradleyTerry: {
      title: 'Så funkar topplistan',
      body: [
        'Affischerna rankas med Bradley–Terry-modellen, ett vanligt sätt att ranka saker utifrån dueller. Den tittar på alla röster hittills på en gång och räknar fram de poäng som bäst förklarar vem som slog vem.',
        'Att slå en stark affisch väger alltså tyngre än att slå en svag, och ordningen rösterna kom i spelar ingen roll. Varje affisch börjar runt 1000 poäng, och det krävs en rad röster för att komma långt därifrån.',
        'Poängen funkar som schackrating: en affisch som ligger 100 poäng före väntas vinna ungefär 64 % av gångerna, och en som ligger 400 poäng före ungefär 91 %. Några poängs skillnad är i praktiken oavgjort.'
      ],
      more: ['Läs mer om ', 'Bradley–Terry-modellen', ' på Wikipedia (på engelska).'],
      url: 'https://en.wikipedia.org/wiki/Bradley%E2%80%93Terry_model'
    },
    font: {
      title: 'Vårt typsnitt',
      made: ['Vi gjorde ett typsnitt som heter ', 'Remi Pop', ' för ', 'Poster Vote!', ' för att ge projektet en unik och lekfull känsla.'],
      download: 'Vill du använda det i ditt eget projekt kan du ladda ner det här:',
      button: 'Ladda ner Remi Pop (.ttf)',
      tellUs:
        'Om du använder det får du gärna höra av dig på våra sociala medier och berätta! Typsnittet växer tillsammans med sajten, så säg till om det saknas tecken som du behöver.'
    }
  },

  error: {
    notFoundTitle: 'Ingenting på den här väggen',
    notFoundBody: 'Sidan har rivits ner, eller så sattes den aldrig upp. Det finns gott om andra affischer att titta på.',
    title: 'Något gick fel',
    body: 'Sidan kunde inte laddas. Försök igen om en stund.',
    vote: 'Rösta',
    rankings: 'Se topplistan'
  },

  results: {
    title: 'Topplista',
    heading: ['Hela', 'topplistan'],
    views: {
      all: 'Alla',
      designers: 'Designers',
      others: 'Icke-designers',
      disagree: 'Största oenigheterna'
    },
    viewsLabel: 'Vems röster som visas',
    archived: 'Arkiverad',
    noCompetitionHere: 'Det finns ingen tävling här.',
    noCompetition: 'Ingen tävling pågår än.',
    disagreeSub: 'Där designers och alla andra går isär.',
    final: (votes: number, segment: Segment) =>
      `Slutresultat från ${num(votes)} ${plural(votes, 'duell', 'dueller')}${by(segment)}.`,
    live: (votes: number, segment: Segment) =>
      `Live från ${num(votes)} ${plural(votes, 'duell', 'dueller')}${by(segment)}. Topplistan ligger högst 15 minuter efter.`,
    tallying: 'Räknar prickarna…',
    seeCurrent: 'Se den aktuella topplistan',
    loadError: (message: string) => `Kunde inte ladda resultaten: ${message}`,
    notEnough: (min: number, designerVotes: number, otherVotes: number) =>
      `För lite för att jämföra än: varje affisch behöver ${num(min)} ${plural(min, 'duell', 'dueller')} ` +
      `från både designers och icke-designers. ` +
      `Hittills: ${num(designerVotes)} röster från designers, ${num(otherVotes)} från icke-designers.`,
    versusTitle: 'Designers mot alla andra',
    versusNote: 'Hur ofta varje affisch vinner hos varje grupp, största skillnaden först.',
    designers: 'Designers',
    others: 'Andra',
    gap: (points: number) => `${num(points)} p`,
    designersLove: 'designers älskar den',
    designersNotSold: 'designers är inte övertygade',
    gapChart: {
      title: 'Vem gillar vad',
      note: 'Varje affisch hamnar efter hur mycket oftare den ena gruppen väljer den. Ju längre ut, desto större skillnad.',
      othersPrefer: 'Andra föredrar',
      designersPrefer: 'Designers föredrar',
      even: 'lika'
    },
    scoreChart: {
      title: 'Poäng mot poäng',
      note: (r: string) =>
        `Varje affischs poäng hos andra i sidled och hos designers på höjden. På linjen är grupperna överens. Korrelation: ${r} (1 är helt överens, 0 inget samband).`,
      othersScore: 'Andras poäng',
      designersScore: 'Designers poäng',
      designersHigher: 'Designers ger högre poäng',
      othersHigher: 'Andra ger högre poäng',
      points: (n: number) => `${num(n)} p`
    },
    stats: {
      votes: 'Lagda röster',
      voters: 'Röstare',
      posters: 'Affischer',
      today: 'Röster i dag',
      explored: 'Utforskade par'
    },
    noVotesArchived: (segment: Segment) => `Inga röster lades${by(segment)}.`,
    noVotesYet: ['Inga röster än — ', 'lägg den första', '.'],
    noVotesSegment: (segment: Segment) => `Inga röster${by(segment)} än.`,
    topThree: 'Topp tre',
    podium: (rating: number, winRate: string) => `${num(rating)} p · ${winRate} vinster`,
    closest: 'Jämnaste rivaliteten',
    closestBlurb: 'Dött lopp',
    lopsided: 'Mest ensidigt',
    lopsidedBlurb: 'Inte ens nära',
    vs: 'vs',
    everyPoster: 'Alla affischer',
    places: {
      title: 'Var rösterna kommer ifrån',
      note: (votes: number, countries: number) =>
        `${num(votes)} ${plural(votes, 'röst', 'röster')} från ${num(countries)} ${plural(countries, 'land', 'länder')} hittills.`,
      localTitle: 'Lokala favoriter',
      localNote: (min: number) => `Affischen varje stad väljer oftast. En stad behöver ${num(min)} röster för att räknas.`,
      localPick: 'Lokal favorit',
      previous: 'Föregående städer',
      next: 'Fler städer',
      wonThere: (wins: number, matches: number) => `Vann ${num(wins)} av ${num(matches)} där`
    },
    detail: {
      close: 'Stäng',
      rank: (rank: number) => `Nr ${num(rank)}`,
      points: 'Poäng',
      record: 'Vunna–förlorade',
      winRate: 'Vinstandel',
      matches: 'Dueller',
      byGroup: 'Vilka den vinner hos',
      noVotes: 'inga röster än',
      headToHead: 'Mot varandra',
      noMatches: 'Den har inte mött någon annan affisch än.',
      fans: 'Största fansen',
      fanWins: (n: number) => `${num(n)} ${plural(n, 'vinst', 'vinster')}`,
      more: (n: number) => `och ${num(n)} till`,
      allRankings: '← Hela topplistan',
      noPoster: 'Det finns ingen affisch här.',
      seeRankings: 'Se topplistan'
    }
  }
};
