import 'dotenv/config';
import { mkdir, writeFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseFile } from 'music-metadata';
import type { Album, LibrarySnapshot, Track } from '../../shared/library.ts';

const AUDIO_EXTENSIONS = ['.flac', '.mp3', '.wav', '.aiff', '.ogg', '.m4a'];
const COVER_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tif', '.tiff', '.webp'];
const COVER_NAMES = ['cover', 'front', 'folder', 'album'];

interface AlbumMetadata {
  era?: string;
  genre?: string;
  description?: string;
  tags?: string[];
  subtitle?: string;
}

// Frank Zappa album metadata knowledge base
const ALBUM_METADATA: Record<string, AlbumMetadata> = {
  'freak out!': {
    era: 'Mothers Of Invention',
    genre: 'Experimental Rock',
    description: 'The debut double album by The Mothers of Invention, a groundbreaking work of experimental rock and social satire.',
    tags: ['debut', 'classic', 'experimental'],
    subtitle: '1966 Debut Album',
  },
  'absolutely free': {
    era: 'Mothers Of Invention',
    genre: 'Experimental Rock',
    description: 'A satirical concept album critiquing American society and culture.',
    tags: ['concept', 'satire', 'classic'],
  },
  "we're only in it for the money": {
    era: 'Mothers Of Invention',
    genre: 'Experimental Rock',
    description: 'A satirical parody of The Beatles\' Sgt. Pepper\'s Lonely Hearts Club Band.',
    tags: ['parody', 'satire', 'classic'],
  },
  'lumpy gravy': {
    era: 'Mothers Of Invention',
    genre: 'Avant-Garde',
    description: 'An orchestral work featuring spoken word and experimental compositions.',
    tags: ['orchestral', 'experimental', 'avant-garde'],
  },
  'cruising with ruben & the jets': {
    era: 'Mothers Of Invention',
    genre: 'Doo-Wop',
    description: 'A doo-wop parody album paying tribute to 1950s vocal groups.',
    tags: ['parody', 'doo-wop', 'retro'],
  },
  'mothermania': {
    era: 'Mothers Of Invention',
    genre: 'Compilation',
    description: 'A compilation album of early Mothers of Invention material.',
    tags: ['compilation', 'early'],
  },
  'uncle meat': {
    era: 'Mothers Of Invention',
    genre: 'Experimental Rock',
    description: 'A double album featuring music from the unfinished film "Uncle Meat".',
    tags: ['soundtrack', 'experimental', 'film'],
  },
  'hot rats': {
    era: 'Solo',
    genre: 'Jazz Fusion',
    description: 'Frank Zappa\'s groundbreaking experiment mixing rock instrumentation with jazz improvisation.',
    tags: ['classic', 'fusion', 'instrumental'],
    subtitle: '1969 Studio Album',
  },
  'burnt weeny sandwich': {
    era: 'Mothers Of Invention',
    genre: 'Experimental Rock',
    description: 'A compilation of studio and live recordings.',
    tags: ['compilation', 'experimental'],
  },
  'weasels ripped my flesh': {
    era: 'Mothers Of Invention',
    genre: 'Experimental Rock',
    description: 'A compilation of live and studio recordings.',
    tags: ['compilation', 'live', 'experimental'],
  },
  'chunga\'s revenge': {
    era: 'Solo',
    genre: 'Rock',
    description: 'A mix of studio and live recordings featuring the Flo & Eddie lineup.',
    tags: ['live', 'studio', 'flo-eddie'],
  },
  'fillmore east, june 1971': {
    era: 'Solo',
    genre: 'Live Rock',
    description: 'Live recordings from the Fillmore East featuring Flo & Eddie.',
    tags: ['live', 'flo-eddie', 'fillmore'],
  },
  '200 motels': {
    era: 'Solo',
    genre: 'Soundtrack',
    description: 'Soundtrack to the surreal film "200 Motels".',
    tags: ['soundtrack', 'film', 'surreal'],
  },
  'just another band from l.a.': {
    era: 'Solo',
    genre: 'Live Rock',
    description: 'Live album featuring Flo & Eddie with comedic stage banter.',
    tags: ['live', 'flo-eddie', 'comedy'],
  },
  'waka-jawaka': {
    era: 'Solo',
    genre: 'Jazz Fusion',
    description: 'A jazz-rock fusion album featuring complex arrangements.',
    tags: ['fusion', 'instrumental', 'complex'],
  },
  'the grand wazoo': {
    era: 'Solo',
    genre: 'Jazz Fusion',
    description: 'An orchestral jazz-rock fusion album.',
    tags: ['fusion', 'orchestral', 'instrumental'],
  },
  'over-nite sensation': {
    era: 'Solo',
    genre: 'Rock',
    description: 'A commercial breakthrough featuring accessible rock songs with complex arrangements.',
    tags: ['commercial', 'accessible', 'classic'],
  },
  'apostrophe (\')': {
    era: 'Solo',
    genre: 'Rock',
    description: 'A successful rock album featuring "Don\'t Eat The Yellow Snow" suite.',
    tags: ['commercial', 'classic', 'suite'],
  },
  'roxy & elsewhere': {
    era: 'Solo',
    genre: 'Live Rock',
    description: 'Live recordings from the Roxy Theatre featuring the 1973-74 band.',
    tags: ['live', 'roxy', 'classic'],
  },
  'one size fits all': {
    era: 'Solo',
    genre: 'Rock',
    description: 'A rock album featuring complex compositions and the track "Inca Roads".',
    tags: ['complex', 'compositional'],
  },
  'bongo fury': {
    era: 'Solo',
    genre: 'Live Rock',
    description: 'Live album featuring Captain Beefheart on vocals.',
    tags: ['live', 'beefheart', 'collaboration'],
  },
  'zoot allures': {
    era: 'Solo',
    genre: 'Rock',
    description: 'A rock album featuring the instrumental "Black Napkins".',
    tags: ['instrumental', 'guitar'],
  },
  'zappa in new york': {
    era: 'Solo',
    genre: 'Live Rock',
    description: 'Live recordings from New York featuring complex compositions.',
    tags: ['live', 'complex', 'compositional'],
  },
  'studio tan': {
    era: 'Solo',
    genre: 'Rock',
    description: 'Part of the Läther project, featuring orchestral and rock compositions.',
    tags: ['läther', 'orchestral'],
  },
  'sleep dirt': {
    era: 'Solo',
    genre: 'Rock',
    description: 'Part of the Läther project, featuring instrumental compositions.',
    tags: ['läther', 'instrumental'],
  },
  'orchestral favorites': {
    era: 'Solo',
    genre: 'Orchestral',
    description: 'Orchestral compositions performed by the Abnuceals Emuukha Electric Symphony Orchestra.',
    tags: ['orchestral', 'classical'],
  },
  'sheik yerbouti': {
    era: 'Solo',
    genre: 'Rock',
    description: 'A double album featuring satirical songs and complex instrumentals.',
    tags: ['satire', 'double-album', 'comedy'],
  },
  'joe\'s garage acts i, ii & iii': {
    era: 'Solo',
    genre: 'Rock Opera',
    description: 'A three-act rock opera about a dystopian future where music is illegal.',
    tags: ['rock-opera', 'concept', 'dystopian'],
  },
  'tinsel town rebellion': {
    era: 'Solo',
    genre: 'Live Rock',
    description: 'Live album featuring songs from various eras.',
    tags: ['live', 'compilation'],
  },
  'shut up \'n play yer guitar': {
    era: 'Solo',
    genre: 'Instrumental',
    description: 'A triple album of guitar solos and instrumentals.',
    tags: ['instrumental', 'guitar', 'solo'],
  },
  'you are what you is': {
    era: 'Solo',
    genre: 'Rock',
    description: 'A double album featuring social commentary and complex arrangements.',
    tags: ['social-commentary', 'double-album'],
  },
  'ship arriving too late to save a drowning witch': {
    era: 'Solo',
    genre: 'Rock',
    description: 'Features the hit single "Valley Girl" with Moon Unit Zappa.',
    tags: ['valley-girl', 'commercial'],
  },
  'the man from utopia': {
    era: 'Solo',
    genre: 'Rock',
    description: 'A rock album featuring various styles and the track "Cocaine Decisions".',
    tags: ['varied-styles'],
  },
  'baby snakes': {
    era: 'Solo',
    genre: 'Live Rock',
    description: 'Live album and soundtrack to the film "Baby Snakes".',
    tags: ['live', 'film', 'soundtrack'],
  },
  'francesco zappa': {
    era: 'Solo',
    genre: 'Classical',
    description: 'Electronic interpretations of 18th-century composer Francesco Zappa\'s works.',
    tags: ['classical', 'electronic', 'synclavier'],
  },
  'the perfect stranger': {
    era: 'Solo',
    genre: 'Contemporary Classical',
    description: 'Orchestral works performed by the Ensemble InterContemporain.',
    tags: ['orchestral', 'contemporary-classical'],
  },
  'thing-fish': {
    era: 'Solo',
    genre: 'Rock Opera',
    description: 'A three-act rock opera with controversial themes.',
    tags: ['rock-opera', 'controversial', 'concept'],
  },
  'them or us': {
    era: 'Solo',
    genre: 'Rock',
    description: 'A double album featuring various styles and complex compositions.',
    tags: ['double-album', 'varied-styles'],
  },
  'frank zappa meets the mothers of prevention': {
    era: 'Solo',
    genre: 'Rock',
    description: 'An album addressing censorship and the PMRC.',
    tags: ['censorship', 'pmrc', 'political'],
  },
  'does humor belong in music?': {
    era: 'Solo',
    genre: 'Live Rock',
    description: 'Live album featuring comedic stage banter and complex compositions.',
    tags: ['live', 'comedy', 'complex'],
  },
  'jazz from hell': {
    era: 'Solo',
    genre: 'Electronic',
    description: 'A Grammy-winning album featuring Synclavier compositions.',
    tags: ['synclavier', 'electronic', 'grammy'],
  },
  'guitar': {
    era: 'Solo',
    genre: 'Instrumental',
    description: 'A double album of guitar solos and instrumentals.',
    tags: ['instrumental', 'guitar', 'solo', 'double-album'],
  },
  'you can\'t do that on stage anymore, vol. 1': {
    era: 'Solo',
    genre: 'Live Rock',
    description: 'First volume in a series of live compilation albums.',
    tags: ['live', 'compilation', 'series'],
  },
  'you can\'t do that on stage anymore, vol. 2': {
    era: 'Solo',
    genre: 'Live Rock',
    description: 'Second volume in a series of live compilation albums.',
    tags: ['live', 'compilation', 'series'],
  },
  'you can\'t do that on stage anymore, vol. 3': {
    era: 'Solo',
    genre: 'Live Rock',
    description: 'Third volume in a series of live compilation albums.',
    tags: ['live', 'compilation', 'series'],
  },
  'you can\'t do that on stage anymore, vol. 4': {
    era: 'Solo',
    genre: 'Live Rock',
    description: 'Fourth volume in a series of live compilation albums.',
    tags: ['live', 'compilation', 'series'],
  },
  'you can\'t do that on stage anymore, vol. 5': {
    era: 'Solo',
    genre: 'Live Rock',
    description: 'Fifth volume in a series of live compilation albums.',
    tags: ['live', 'compilation', 'series'],
  },
  'you can\'t do that on stage anymore, vol. 6': {
    era: 'Solo',
    genre: 'Live Rock',
    description: 'Sixth volume in a series of live compilation albums.',
    tags: ['live', 'compilation', 'series'],
  },
  'broadway the hard way': {
    era: 'Solo',
    genre: 'Live Rock',
    description: 'Live album featuring political and social commentary.',
    tags: ['live', 'political', 'social-commentary'],
  },
  'the best band you never heard in your life': {
    era: 'Solo',
    genre: 'Live Rock',
    description: 'Live album from the 1988 tour featuring covers and originals.',
    tags: ['live', 'covers', '1988-tour'],
  },
  'make a jazz noise here': {
    era: 'Solo',
    genre: 'Live Rock',
    description: 'Live album featuring complex instrumental compositions.',
    tags: ['live', 'instrumental', 'complex'],
  },
  'playground psychotics': {
    era: 'Solo',
    genre: 'Live Rock',
    description: 'Live album featuring Flo & Eddie era material.',
    tags: ['live', 'flo-eddie', 'retro'],
  },
  'ahead of their time': {
    era: 'Mothers Of Invention',
    genre: 'Live Rock',
    description: 'Live recording from 1968 featuring orchestral arrangements.',
    tags: ['live', 'orchestral', '1968'],
  },
  'the yellow shark': {
    era: 'Solo',
    genre: 'Contemporary Classical',
    description: 'Orchestral works performed by the Ensemble Modern.',
    tags: ['orchestral', 'contemporary-classical', 'ensemble-modern'],
  },
  'civilization phaze iii': {
    era: 'Solo',
    genre: 'Electronic',
    description: 'A Synclavier album featuring complex electronic compositions.',
    tags: ['synclavier', 'electronic', 'complex'],
  },
  'the lost episodes': {
    era: 'Solo',
    genre: 'Compilation',
    description: 'A compilation of previously unreleased material from various eras.',
    tags: ['compilation', 'unreleased', 'rarities'],
  },
  'läther': {
    era: 'Solo',
    genre: 'Rock',
    description: 'A four-disc compilation originally intended as a single release.',
    tags: ['compilation', 'four-disc', 'concept'],
  },
  'frank zappa plays the music of frank zappa': {
    era: 'Solo',
    genre: 'Compilation',
    description: 'A compilation album featuring various tracks.',
    tags: ['compilation'],
  },
  'have i offended someone?': {
    era: 'Solo',
    genre: 'Compilation',
    description: 'A compilation album addressing censorship and controversy.',
    tags: ['compilation', 'censorship', 'controversy'],
  },
  'mystery disc': {
    era: 'Solo',
    genre: 'Compilation',
    description: 'A compilation of rare and unreleased material.',
    tags: ['compilation', 'rare', 'unreleased'],
  },
  'everything is healing nicely': {
    era: 'Solo',
    genre: 'Compilation',
    description: 'A compilation of instrumental works.',
    tags: ['compilation', 'instrumental'],
  },
  'fz-oz': {
    era: 'Solo',
    genre: 'Live Rock',
    description: 'Live recordings from Australia.',
    tags: ['live', 'australia'],
  },
  'halloween': {
    era: 'Solo',
    genre: 'Live Rock',
    description: 'Live recordings from Halloween shows.',
    tags: ['live', 'halloween'],
  },
  'joe\'s corsage': {
    era: 'Solo',
    genre: 'Compilation',
    description: 'Part of the Joe\'s series of archival releases.',
    tags: ['archival', 'joe-series'],
  },
  'joe\'s domage': {
    era: 'Solo',
    genre: 'Compilation',
    description: 'Part of the Joe\'s series of archival releases.',
    tags: ['archival', 'joe-series'],
  },
  'joe\'s xmasage': {
    era: 'Solo',
    genre: 'Compilation',
    description: 'Part of the Joe\'s series of archival releases.',
    tags: ['archival', 'joe-series', 'christmas'],
  },
  'quaudioplhiac': {
    era: 'Solo',
    genre: 'Compilation',
    description: 'A compilation featuring surround sound mixes.',
    tags: ['compilation', 'surround-sound'],
  },
  'joe\'s menage': {
    era: 'Solo',
    genre: 'Compilation',
    description: 'Part of the Joe\'s series of archival releases.',
    tags: ['archival', 'joe-series'],
  },
  'the lumpy money project-object': {
    era: 'Solo',
    genre: 'Compilation',
    description: 'A compilation focusing on the Lumpy Gravy project.',
    tags: ['compilation', 'lumpy-gravy'],
  },
  'philly \'76': {
    era: 'Solo',
    genre: 'Live Rock',
    description: 'Live recordings from Philadelphia in 1976.',
    tags: ['live', '1976', 'philadelphia'],
  },
  'greasy love songs': {
    era: 'Solo',
    genre: 'Compilation',
    description: 'A compilation focusing on Ruben & The Jets material.',
    tags: ['compilation', 'ruben-jets'],
  },
  'congress shall make no law...': {
    era: 'Solo',
    genre: 'Compilation',
    description: 'A compilation addressing free speech and censorship.',
    tags: ['compilation', 'free-speech', 'censorship'],
  },
  'hammersmith odeon': {
    era: 'Solo',
    genre: 'Live Rock',
    description: 'Live recordings from the Hammersmith Odeon.',
    tags: ['live', 'hammersmith'],
  },
  'feeding the monkies at ma maison': {
    era: 'Solo',
    genre: 'Compilation',
    description: 'A compilation of previously unreleased material.',
    tags: ['compilation', 'unreleased'],
  },
  'carnegie hall': {
    era: 'Solo',
    genre: 'Live Rock',
    description: 'Live recordings from Carnegie Hall.',
    tags: ['live', 'carnegie-hall'],
  },
  'understanding america': {
    era: 'Solo',
    genre: 'Compilation',
    description: 'A compilation addressing American culture and politics.',
    tags: ['compilation', 'political', 'american-culture'],
  },
  'road tapes, venue #1': {
    era: 'Solo',
    genre: 'Live Rock',
    description: 'Part of the Road Tapes series of archival live recordings.',
    tags: ['live', 'archival', 'road-tapes'],
  },
  'road tapes, venue #2': {
    era: 'Solo',
    genre: 'Live Rock',
    description: 'Part of the Road Tapes series of archival live recordings.',
    tags: ['live', 'archival', 'road-tapes'],
  },
  'finer moments': {
    era: 'Solo',
    genre: 'Compilation',
    description: 'A compilation of rare and unreleased material.',
    tags: ['compilation', 'rare', 'unreleased'],
  },
  'buffalo': {
    era: 'Solo',
    genre: 'Live Rock',
    description: 'Live recordings from Buffalo.',
    tags: ['live', 'buffalo'],
  },
  'wazoo': {
    era: 'Solo',
    genre: 'Live Rock',
    description: 'Live recordings featuring the Grand Wazoo orchestra.',
    tags: ['live', 'orchestral', 'grand-wazoo'],
  },
  'trance-fusion': {
    era: 'Solo',
    genre: 'Electronic',
    description: 'A compilation of Synclavier works.',
    tags: ['synclavier', 'electronic', 'compilation'],
  },
  'imaginary diseases': {
    era: 'Solo',
    genre: 'Live Rock',
    description: 'Live recordings from the Petit Wazoo tour.',
    tags: ['live', 'petit-wazoo'],
  },
  'the mofo project-object': {
    era: 'Solo',
    genre: 'Compilation',
    description: 'A compilation focusing on the Mothers of Invention era.',
    tags: ['compilation', 'mothers-of-invention'],
  },
  'one shot deal': {
    era: 'Solo',
    genre: 'Compilation',
    description: 'A compilation of previously unreleased material.',
    tags: ['compilation', 'unreleased'],
  },
  'joe\'s camouflage': {
    era: 'Solo',
    genre: 'Compilation',
    description: 'Part of the Joe\'s series of archival releases.',
    tags: ['archival', 'joe-series'],
  },
  'roxy by proxy': {
    era: 'Solo',
    genre: 'Live Rock',
    description: 'Additional live recordings from the Roxy Theatre.',
    tags: ['live', 'roxy'],
  },
  'dance me this': {
    era: 'Solo',
    genre: 'Electronic',
    description: 'A Synclavier album featuring dance-oriented electronic compositions.',
    tags: ['synclavier', 'electronic', 'dance'],
  },
  'roxy- the movie': {
    era: 'Solo',
    genre: 'Live Rock',
    description: 'Soundtrack to the Roxy: The Movie film.',
    tags: ['live', 'roxy', 'film', 'soundtrack'],
  },
  'a token of his extreme': {
    era: 'Solo',
    genre: 'Live Rock',
    description: 'Live recordings from a 1974 television special.',
    tags: ['live', 'television', '1974'],
  },
  'aaafnraa': {
    era: 'Solo',
    genre: 'Compilation',
    description: 'A compilation of previously unreleased material.',
    tags: ['compilation', 'unreleased'],
  },
  'zappa erie': {
    era: 'Solo',
    genre: 'Live Rock',
    description: 'Live recordings from Erie, Pennsylvania featuring performances from 1974 and 1976.',
    tags: ['live', 'erie', 'archival', '1974', '1976'],
  },
  'tinseltown rebellion': {
    era: 'Solo',
    genre: 'Live Rock',
    description: 'Live album featuring songs from various eras with comedic stage banter.',
    tags: ['live', 'comedy'],
  },
  'zappa vol1': {
    era: 'Solo',
    genre: 'Compilation',
    description: 'First volume in a series of compilation albums.',
    tags: ['compilation', 'series'],
  },
  'zappa vol 2': {
    era: 'Solo',
    genre: 'Compilation',
    description: 'Second volume in a series of compilation albums.',
    tags: ['compilation', 'series'],
  },
  'the lumpy money po': {
    era: 'Solo',
    genre: 'Compilation',
    description: 'A compilation focusing on the Lumpy Gravy project.',
    tags: ['compilation', 'lumpy-gravy'],
  },
  'chicago 78': {
    era: 'Solo',
    genre: 'Live Rock',
    description: 'Live recordings from Chicago in 1978 featuring the 1978 touring band.',
    tags: ['live', 'chicago', '1978'],
  },
  'frank zappa for president': {
    era: 'Solo',
    genre: 'Compilation',
    description: 'A compilation album themed around Zappa\'s 1992 presidential campaign, featuring political songs and spoken word pieces.',
    tags: ['compilation', 'political', 'presidential-campaign'],
  },
  'little dots': {
    era: 'Solo',
    genre: 'Live Rock',
    description: 'Live recordings featuring performances from various venues, including material from the "Little Dots" composition.',
    tags: ['live', 'archival'],
  },
  'zappatite': {
    era: 'Solo',
    genre: 'Compilation',
    description: 'A compilation album featuring some of Frank Zappa\'s most popular and accessible tracks.',
    tags: ['compilation', 'best-of', 'accessible'],
  },
  'the roxy performances': {
    era: 'Solo',
    genre: 'Live Rock',
    description: 'Comprehensive collection of live recordings from the Roxy Theatre in 1973, featuring the complete performances.',
    tags: ['live', 'roxy', '1973', 'complete'],
  },
  'zappa 75 zagreb ljubljana': {
    era: 'Solo',
    genre: 'Live Rock',
    description: 'Live recordings from Zagreb and Ljubljana in 1975, featuring the 1975 touring band.',
    tags: ['live', 'zagreb', 'ljubljana', '1975', 'yugoslavia'],
  },
  'zappa 75 zagreb ljubljana 2022': {
    era: 'Solo',
    genre: 'Live Rock',
    description: 'Live recordings from Zagreb and Ljubljana in 1975, featuring the 1975 touring band.',
    tags: ['live', 'zagreb', 'ljubljana', '1975', 'yugoslavia'],
  },
  'funky nothingness': {
    era: 'Solo',
    genre: 'Rock',
    description: 'A posthumous release featuring previously unreleased studio recordings from 1970, including outtakes and alternate versions.',
    tags: ['unreleased', 'studio', '1970', 'outtakes'],
  },
};

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD') // Decompose Unicode characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^\w\s]/g, '') // Remove non-word characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

function getAlbumMetadata(title: string): AlbumMetadata {
  // First, try to remove date/year information from the title
  let cleaned = title;
  const dateMatch = cleaned.match(/^(.+?)\s*\([^)]*(?:19|20)\d{2}[^)]*\)/i);
  if (dateMatch) {
    cleaned = dateMatch[1].trim();
  }
  
  // Normalize both the cleaned title and try to find a match
  const normalized = normalizeTitle(cleaned);
  
  // Try exact match first
  if (ALBUM_METADATA[normalized]) {
    return ALBUM_METADATA[normalized];
  }
  
  // Try matching against normalized keys (in case keys have different normalization)
  for (const [key, value] of Object.entries(ALBUM_METADATA)) {
    if (normalizeTitle(key) === normalized) {
      return value;
    }
  }
  
  // Try partial match (in case title has extra words)
  for (const [key, value] of Object.entries(ALBUM_METADATA)) {
    const normalizedKey = normalizeTitle(key);
    if (normalized.includes(normalizedKey) || normalizedKey.includes(normalized)) {
      return value;
    }
  }
  
  // Special handling for albums with special characters
  if (normalized.includes('zagreb') && normalized.includes('ljubljana')) {
    return {
      era: 'Solo',
      genre: 'Live Rock',
      description: 'Live recordings from Zagreb and Ljubljana in 1975, featuring the 1975 touring band.',
      tags: ['live', 'zagreb', 'ljubljana', '1975', 'yugoslavia'],
    };
  }
  
  return {};
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function extractYear(text: string): number | undefined {
  const match = text.match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : undefined;
}

function detectFormat(filename: string): string {
  const ext = path.extname(filename).replace('.', '').toUpperCase();
  return ext || 'UNKNOWN';
}

async function findCoverArt(albumPath: string): Promise<string | undefined> {
  try {
    const coverDir = path.join(albumPath, 'Cover');
    const coverStat = await stat(coverDir).catch(() => null);
    
    if (coverStat?.isDirectory()) {
      const files = await readdir(coverDir);
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (COVER_EXTENSIONS.includes(ext)) {
          const lowerName = file.toLowerCase();
          if (COVER_NAMES.some(name => lowerName.includes(name)) || lowerName.includes('front')) {
            return path.join(coverDir, file).replace(/\\/g, '/');
          }
        }
      }
      // If no named cover found, return first image
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (COVER_EXTENSIONS.includes(ext)) {
          return path.join(coverDir, file).replace(/\\/g, '/');
        }
      }
    }
    
    // Check root directory for cover art
    const files = await readdir(albumPath);
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      const lowerName = file.toLowerCase();
      if (COVER_EXTENSIONS.includes(ext) && 
          (COVER_NAMES.some(name => lowerName.includes(name)) || lowerName.includes('cover'))) {
        return path.join(albumPath, file).replace(/\\/g, '/');
      }
    }
  } catch (error) {
    // Ignore errors
  }
  return undefined;
}

async function extractTrackMetadata(filePath: string): Promise<Partial<Track>> {
  try {
    const metadata = await parseFile(filePath);
    const { common, format } = metadata;
    
    return {
      title: common.title || path.basename(filePath, path.extname(filePath)),
      durationMs: format.duration ? Math.round(format.duration * 1000) : 0,
      trackNumber: common.track?.no || 0,
      discNumber: common.disk?.no,
    };
  } catch (error) {
    console.warn(`Failed to extract metadata from ${filePath}:`, error);
    return {
      title: path.basename(filePath, path.extname(filePath)),
      durationMs: 0,
      trackNumber: 0,
    };
  }
}

async function findAudioFiles(dirPath: string, relativePath: string = ''): Promise<Array<{ filePath: string; relativePath: string; discNumber?: number }>> {
  const audioFiles: Array<{ filePath: string; relativePath: string; discNumber?: number }> = [];
  const entries = await readdir(dirPath, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relPath = path.join(relativePath, entry.name);
    
    if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (AUDIO_EXTENSIONS.includes(ext)) {
        // Try to extract disc number from directory name (e.g., "CD 1", "Disc 2")
        let discNumber: number | undefined;
        if (relativePath) {
          const discMatch = relativePath.match(/(?:cd|disc)\s*(\d+)/i);
          if (discMatch) {
            discNumber = Number(discMatch[1]);
          }
        }
        
        audioFiles.push({
          filePath: fullPath,
          relativePath: relPath,
          discNumber,
        });
      }
    } else if (entry.isDirectory() && !entry.name.toLowerCase().includes('cover')) {
      // Recursively search subdirectories (but skip Cover folders)
      const subFiles = await findAudioFiles(fullPath, relPath);
      audioFiles.push(...subFiles);
    }
  }
  
  return audioFiles;
}

async function scanAlbum(albumPath: string, albumName: string): Promise<Album | null> {
  try {
    const audioFiles = await findAudioFiles(albumPath);
    const tracks: Track[] = [];
    
    // Extract metadata for all audio files
    for (const { filePath, relativePath, discNumber: dirDiscNumber } of audioFiles) {
      const fileStat = await stat(filePath);
      const fileName = path.basename(filePath);
      
      // Extract track number from filename
      const numberMatch = fileName.match(/^(\d{1,2})/);
      const trackNumber = numberMatch ? Number(numberMatch[1]) : tracks.length + 1;
      
      // Extract metadata from file
      const fileMetadata = await extractTrackMetadata(filePath);
      
      const track: Track = {
        id: slugify(path.join(albumPath, relativePath)),
        title: fileMetadata.title || fileName.replace(/\.[^.]+$/, '').replace(/^\d{1,2}\s*-*\s*/, ''),
        durationMs: fileMetadata.durationMs || 0,
        trackNumber: fileMetadata.trackNumber || trackNumber,
        discNumber: fileMetadata.discNumber || dirDiscNumber,
        format: detectFormat(fileName),
        filePath: path.join(albumPath, relativePath).replace(/\\/g, '/'),
        sizeBytes: fileStat.size,
      };
      
      tracks.push(track);
    }
    
    if (tracks.length === 0) {
      return null;
    }
    
    // Sort tracks by track number
    tracks.sort((a, b) => {
      if (a.discNumber && b.discNumber && a.discNumber !== b.discNumber) {
        return a.discNumber - b.discNumber;
      }
      return a.trackNumber - b.trackNumber;
    });
    
    // Calculate totals
    const totalSize = tracks.reduce((sum, track) => sum + track.sizeBytes, 0);
    const totalDuration = tracks.reduce((sum, track) => sum + track.durationMs, 0);
    const formats = Array.from(new Set(tracks.map(track => track.format)));
    
    // Find cover art
    const coverPath = await findCoverArt(albumPath);
    
    // Clean up album title (remove date info if present) for display
    let cleanTitle = albumName;
    const titleMatch = albumName.match(/^(.+?)\s*\([^)]+\)$/);
    if (titleMatch) {
      cleanTitle = titleMatch[1].trim();
    }
    
    // Get enriched metadata - try both original and cleaned title
    const metadata = getAlbumMetadata(albumName) || getAlbumMetadata(cleanTitle);
    
    // Extract year from album name
    const year = extractYear(albumName);
    
    const album: Album = {
      id: slugify(albumPath),
      title: cleanTitle,
      subtitle: metadata.subtitle,
      year,
      era: metadata.era,
      genre: metadata.genre,
      description: metadata.description,
      coverUrl: coverPath,
      locationPath: albumPath.replace(/\\/g, '/'),
      lastSyncedAt: new Date().toISOString(),
      tags: metadata.tags || [],
      tracks,
      formats,
      totalDurationMs: totalDuration,
      totalSizeBytes: totalSize,
    };
    
    return album;
  } catch (error) {
    console.error(`Error scanning album ${albumPath}:`, error);
    return null;
  }
}

async function scanLibrary(libraryPath: string): Promise<LibrarySnapshot> {
  console.log(`Scanning library: ${libraryPath}`);
  
  const entries = await readdir(libraryPath, { withFileTypes: true });
  const albums: Album[] = [];
  
  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      const albumPath = path.join(libraryPath, entry.name);
      console.log(`Processing: ${entry.name}`);
      
      const album = await scanAlbum(albumPath, entry.name);
      if (album) {
        albums.push(album);
        console.log(`  ✓ Found ${album.tracks.length} tracks, ${(album.totalSizeBytes / 1024 / 1024).toFixed(2)} MB`);
      }
    }
  }
  
  return {
    generatedAt: new Date().toISOString(),
    albumCount: albums.length,
    trackCount: albums.reduce((sum, album) => sum + album.tracks.length, 0),
    albums: albums.sort((a, b) => (a.year || 0) - (b.year || 0)),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const libraryPath = args[0] || process.env.LIBRARY_PATH || 'C:\\Users\\kimbe\\Dropbox\\Apps\\ZappaVault\\ZappaLibrary';
  const outputFile = args[1] || path.resolve(path.join(process.cwd(), 'webapp/data/library.generated.json'));
  
  console.log('Starting metadata extraction...');
  console.log(`Library path: ${libraryPath}`);
  console.log(`Output file: ${outputFile}`);
  
  const snapshot = await scanLibrary(libraryPath);
  
  await mkdir(path.dirname(outputFile), { recursive: true });
  await writeFile(outputFile, JSON.stringify(snapshot, null, 2));
  
  console.log('\n=== Summary ===');
  console.log(`Albums: ${snapshot.albumCount}`);
  console.log(`Tracks: ${snapshot.trackCount}`);
  console.log(`Output: ${outputFile}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

