// English UI text. ru.ts and sv.ts must match this shape (it's typed against it).
// Functions take raw numbers and format them for the language themselves.
// Arrays are text split around an element (a link or <code>) that the page puts between them.

/** Whose votes a results line is about. */
export type Segment = 'all' | 'designers' | 'others';

const num = (n: number) => n.toLocaleString('en');
const s = (n: number) => (n === 1 ? '' : 's');
const by = (segment: Segment) =>
  segment === 'designers' ? ' by designers' : segment === 'others' ? ' by non-designers' : '';

export const en = {
  brand: 'Poster Vote',
  loading: 'Loading',
  yes: 'Yes',
  no: 'No',
  designerQuestion: 'Are you a designer?',
  coffee: 'Buy Us A Coffee',

  share: {
    label: 'Share',
    poster: (title: string) => `Share ${title}`,
    copied: 'Link copied'
  },

  header: {
    mute: 'Mute',
    unmute: 'Unmute',
    muteLabel: 'Mute sound',
    unmuteLabel: 'Unmute sound',
    keepVoting: '← Keep voting',
    rankings: 'Rankings →',
    setupTitle: 'Almost there',
    setupBody: ['Add your Convex URL to ', ' (or run ', ' to set it up).']
  },

  menu: {
    label: 'Menu',
    vote: 'Voting',
    rankings: 'Rankings',
    about: 'About',
    settings: 'Settings',
    past: 'Past competitions'
  },

  vote: {
    vaultError: 'Couldn’t reach the poster vault.',
    noPosters: 'No posters yet',
    noPostersBody: ['Drop images into ', ' and run ', '.'],
    start: 'Start voting',
    doneTitle: 'That’s every pair!',
    doneBody: (pairs: number) =>
      `You’ve been through all ${num(pairs)} pairs of the current posters. Come back when new ones go up.`,
    seeRankings: 'See the rankings →',
    seenAllTitle: 'You’ve voted on every poster!',
    seenAllBody: '(But there are still many more different combinations you can vote on)',
    continueVoting: 'Continue voting!',
    progress: (seen: number, total: number) => `${num(seen)} of ${num(total)} posters seen`,
    votesOnPair: (n: number) => `${num(n)} vote${s(n)} on this pair`,
    voteFor: (title: string) => `Vote for ${title}`,
    yourPick: 'your pick',
    ofVoters: 'of voters',
    skip: 'Can’t decide? Skip →',
    next: 'Next →',
    pastVotes: 'Past Votes',
    previousVote: 'Previous vote',
    nextVote: 'Next vote',
    pauseAutoplay: 'Pause autoplay',
    resumeAutoplay: 'Resume autoplay',
    error: 'That vote got lost in the dots. Try the next pair!',
    // A few wordings of each, one picked per pair (see verdict.ts).
    verdict: {
      tie: [
        'A perfect tie. The votes are neck and neck.',
        'Split decision — it’s 50/50!',
        'It’s a dead heat! Both posters have equal votes.',
        'Deadlock! The votes are perfectly even.',
        'It’s a draw! Are these two perfectly matched?'
      ],
      unanimous: [
        'Unanimous. Everyone agrees.',
        'Unanimous! Everyone’s on the same page.',
        'Complete agreement — 100% of votes are the same.',
        'Total consensus! Every single vote agrees.',
        'Unanimous decision! Not one vote against.'
      ],
      obvious: [
        'Obviously. Almost everyone agrees.',
        'Overwhelming agreement! Almost everyone’s on board.',
        'Nearly a clean sweep! The majority rules.',
        'Decisive majority! Almost all votes line up.',
        'Clear winner! A vast majority agrees.'
      ],
      streak: (n: number) => [
        `In tune with the crowd — ${num(n)} in a row!`,
        `In complete sync — ${num(n)} in a row!`,
        `On a roll — ${num(n)} in a row!`,
        `Spot on with the crowd — ${num(n)} in a row!`,
        `Crowd consensus — ${num(n)} in a row!`
      ],
      crowd: [
        'You’re with the crowd.',
        'Following the crowd — you’re in good company.',
        'In line with the majority — you’re part of the crowd.',
        'Going with the flow — you’re among the majority.',
        'Majority rules — you picked the winner.'
      ],
      contrarian: [
        'A true contrarian. Iconic.',
        'Going against the grain — you stand out from the crowd.',
        'Independent thinker — you march to your own beat.',
        'Lone wolf energy — you voted against the masses.',
        'Against the crowd! You’re in charge of your own destiny.'
      ],
      minority: [
        'Bold taste — you’re in the minority.',
        'In the minority — follow your heart!',
        'No one tells you how to vote — you went against the crowd.',
        'Thinking differently from the crowd — as you should!',
        'Rogue voter — you broke from the majority.'
      ]
    }
  },

  settings: {
    title: 'Settings',
    designerHint: 'Used to split the rankings. A change applies to your votes from now on.',
    language: 'Language',
    yourVotes: 'Your votes',
    counting: 'Counting…',
    // "You have voted <strong>n</strong> times."
    votedBefore: 'You have voted',
    votedAfter: (n: number): string => (n === 1 ? 'time.' : 'times.'),
    clearHint: 'Clearing storage forgets your designer answer, how far you’ve got through the pairs, and your sound and language settings.',
    clear: 'Clear storage',
    clearConfirm:
      'Clear everything Poster Vote remembers on this device? You’ll start again as a new voter. Votes you’ve already cast stay in the rankings.'
  },

  about: {
    title: 'About',
    madeBy: 'Made by',
    supportUs: 'Support Us',
    // Non-breaking spaces keep each name on one line.
    people: ['Alisa Vasileva', 'Josh Thompson'],
    elo: {
      title: 'How the rankings work',
      body: [
        'Posters are ranked with the Elo rating system, the one used in chess. Every poster starts on 1000 points, and each vote moves points from the loser to the winner.',
        'How many depends on who you beat: beating an equal poster wins 16 points, toppling a favourite wins up to 32, and beating an underdog wins only a few.',
        'So a poster that keeps winning over many matches can outrank one with a perfect record from just a few. A gap of a few points is basically a tie.'
      ],
      // [before, link text, after]
      more: ['Read more about the ', 'Elo rating system', ' on Wikipedia.'],
      url: 'https://en.wikipedia.org/wiki/Elo_rating_system'
    },
    bradleyTerry: {
      title: 'How the rankings work',
      body: [
        'Posters are ranked with the Bradley–Terry model, a standard way to rank things from head-to-head contests. It looks at every vote cast so far, all at once, and works out the scores that best explain who beat whom.',
        'So beating a strong poster counts for more than beating a weak one, and the order the votes came in doesn’t matter. Every poster starts near 1000 points, and it takes a run of votes to move far from it.',
        'Scores work like chess ratings: a poster 100 points ahead is expected to win about 64% of the time, and one 400 points ahead about 91%. A gap of a few points is basically a tie.'
      ],
      // [before, link text, after]
      more: ['Read more about the ', 'Bradley–Terry model', ' on Wikipedia.'],
      url: 'https://en.wikipedia.org/wiki/Bradley%E2%80%93Terry_model'
    },
    font: {
      title: 'Our Font',
      // Every other piece, from the second, is set in Remi Pop.
      made: ['We made a font called ', 'Remi Pop', ' for ', 'Poster Vote!', ' to give this project a unique feel and playfulness.'],
      download: 'If you want to use it on your own project, download it here:',
      button: 'Download Remi Pop (.ttf)',
      tellUs:
        'If you do use it, please contact us on our socials to let us know! The font is evolving with the site, so let us know if there are characters that are missing that you need.'
    }
  },

  // The page for a link that goes nowhere (404) or a page that broke.
  error: {
    notFoundTitle: 'Nothing on this wall',
    notFoundBody: 'This page has been torn down, or it was never put up. There are plenty of other posters to look at.',
    title: 'Something went wrong',
    body: 'This page didn’t load. Try again in a moment.',
    vote: 'Go vote',
    rankings: 'See the rankings'
  },

  results: {
    title: 'Rankings',
    // The big two-word heading.
    heading: ['The', 'Rankings'],
    views: {
      all: 'Everyone',
      designers: 'Designers',
      others: 'Non-designers',
      disagree: 'Biggest disagreements'
    },
    viewsLabel: 'Whose votes to show',
    archived: 'Archived',
    noCompetitionHere: 'There’s no competition here.',
    noCompetition: 'No competition is running yet.',
    disagreeSub: 'Where designers and everyone else part ways.',
    final: (votes: number, segment: Segment) => `Final results from ${num(votes)} head-to-heads${by(segment)}.`,
    live: (votes: number, segment: Segment) =>
      `Live from ${num(votes)} head-to-heads${by(segment)}. Rankings are at most 15 minutes behind.`,
    tallying: 'Tallying the dots…',
    seeCurrent: 'See the current rankings',
    loadError: (message: string) => `Couldn’t load results: ${message}`,
    notEnough: (min: number, designerVotes: number, otherVotes: number) =>
      `Not enough to compare yet: each poster needs ${num(min)} match-ups from designers and from non-designers. ` +
      `So far: ${num(designerVotes)} designer votes, ${num(otherVotes)} non-designer votes.`,
    versusTitle: 'Designers vs everyone else',
    versusNote: 'How often each poster wins with each group, biggest gap first.',
    designers: 'Designers',
    others: 'Others',
    gap: (points: number) => `${num(points)} pts`,
    designersLove: 'designers love it',
    designersNotSold: 'designers aren’t sold',
    gapChart: {
      title: 'Who likes what',
      note: 'Each poster sits by how much more one group picks it. The further out, the bigger the split.',
      othersPrefer: 'Non-designers prefer',
      designersPrefer: 'Designers prefer',
      even: 'even'
    },
    scoreChart: {
      title: 'Score against score',
      note: (r: string) =>
        `Each poster’s score with non-designers across, and with designers up. On the line, both groups agree. Correlation: ${r} (1 is full agreement, 0 none).`,
      othersScore: 'Non-designers’ score',
      designersScore: 'Designers’ score',
      designersHigher: 'Designers rate it higher',
      othersHigher: 'Non-designers rate it higher',
      points: (n: number) => `${num(n)} pts`
    },
    stats: {
      votes: 'Votes cast',
      voters: 'Voters',
      posters: 'Posters',
      today: 'Votes today',
      explored: 'Match-ups explored'
    },
    noVotesArchived: (segment: Segment) => `No votes were cast${by(segment)}.`,
    noVotesYet: ['No votes yet — ', 'go cast the first one', '.'],
    noVotesSegment: (segment: Segment) => `No votes${by(segment)} yet.`,
    topThree: 'Top three',
    podium: (rating: number, winRate: string) => `${num(rating)} pts · ${winRate} wins`,
    closest: 'Closest rivalry',
    closestBlurb: 'Neck and neck',
    lopsided: 'Most lopsided',
    lopsidedBlurb: 'Not even close',
    vs: 'vs',
    everyPoster: 'Every poster',
    places: {
      title: 'Where the votes come from',
      note: (votes: number, countries: number) =>
        `${num(votes)} vote${s(votes)} from ${num(countries)} countr${countries === 1 ? 'y' : 'ies'} so far.`,
      localTitle: 'Local favourites',
      localNote: (min: number) => `The poster each city picks most. A city needs ${num(min)} votes to count.`,
      localPick: 'Local pick',
      previous: 'Previous cities',
      next: 'More cities',
      wonThere: (wins: number, matches: number) => `Won ${num(wins)} of ${num(matches)} there`
    },
    detail: {
      close: 'Close',
      rank: (rank: number) => `No. ${num(rank)}`,
      points: 'Points',
      record: 'Won–lost',
      winRate: 'Win rate',
      matches: 'Match-ups',
      byGroup: 'Who it wins with',
      noVotes: 'no votes yet',
      headToHead: 'Head-to-head',
      noMatches: 'It hasn’t met another poster yet.',
      fans: 'Biggest fans',
      fanWins: (n: number) => `${num(n)} win${s(n)}`,
      more: (n: number) => `and ${num(n)} more`,
      // On the poster's own page.
      allRankings: '← All rankings',
      noPoster: 'There’s no poster here.',
      seeRankings: 'See the rankings'
    }
  }
};

export type Messages = typeof en;
