import type { LibrarySnapshot } from '../../shared/library.ts';

export const sampleLibrary: LibrarySnapshot = {
  generatedAt: new Date().toISOString(),
  albumCount: 2,
  trackCount: 6,
  albums: [
    {
      id: 'hot-rats-1969',
      title: 'Hot Rats',
      subtitle: '1969 Studio Album',
      year: 1969,
      era: 'Mothers Of Invention',
      genre: 'Jazz Fusion',
      description:
        'Frank Zappa’s groundbreaking experiment mixing rock instrumentation with jazz improvisation.',
      coverUrl:
        'https://upload.wikimedia.org/wikipedia/en/4/47/Hot_Rats.jpg',
      locationPath: '/ZappaLibrary/Hot Rats (1969)',
      lastSyncedAt: new Date().toISOString(),
      tags: ['classic', 'fusion'],
      formats: ['FLAC', 'MP3'],
      totalDurationMs: 2520_000,
      totalSizeBytes: 950_000_000,
      tracks: [
        {
          id: 'peaches-en-regalia',
          title: 'Peaches En Regalia',
          durationMs: 210_000,
          trackNumber: 1,
          discNumber: 1,
          format: 'FLAC',
          filePath: '/ZappaLibrary/Hot Rats (1969)/01 Peaches En Regalia.flac',
          sizeBytes: 120_000_000,
        },
        {
          id: 'willie-the-pimp',
          title: 'Willie The Pimp',
          durationMs: 540_000,
          trackNumber: 2,
          discNumber: 1,
          format: 'FLAC',
          filePath: '/ZappaLibrary/Hot Rats (1969)/02 Willie The Pimp.flac',
          sizeBytes: 180_000_000,
        },
        {
          id: 'son-of-mr-green-genes',
          title: 'Son Of Mr. Green Genes',
          durationMs: 510_000,
          trackNumber: 3,
          discNumber: 1,
          format: 'FLAC',
          filePath:
            '/ZappaLibrary/Hot Rats (1969)/03 Son Of Mr. Green Genes.flac',
          sizeBytes: 170_000_000,
        },
      ],
    },
    {
      id: 'sheik-yerbouti-1979',
      title: 'Sheik Yerbouti',
      subtitle: '1979 Double Album',
      year: 1979,
      era: 'Solo',
      genre: 'Rock',
      description:
        'A live/studio hybrid double LP capturing the 1977-78 touring band across sardonic rock numbers.',
      coverUrl:
        'https://upload.wikimedia.org/wikipedia/en/b/b1/Sheik_Yerbouti.jpg',
      locationPath: '/ZappaLibrary/Sheik Yerbouti (1979)',
      lastSyncedAt: new Date().toISOString(),
      tags: ['live', 'satire'],
      formats: ['MP3'],
      totalDurationMs: 4320_000,
      totalSizeBytes: 650_000_000,
      tracks: [
        {
          id: 'i-have-been-in-you',
          title: 'I Have Been In You',
          durationMs: 200_000,
          trackNumber: 1,
          discNumber: 1,
          format: 'MP3',
          filePath:
            '/ZappaLibrary/Sheik Yerbouti (1979)/01 I Have Been In You.mp3',
          sizeBytes: 45_000_000,
        },
        {
          id: 'flakes',
          title: 'Flakes',
          durationMs: 380_000,
          trackNumber: 2,
          discNumber: 1,
          format: 'MP3',
          filePath: '/ZappaLibrary/Sheik Yerbouti (1979)/02 Flakes.mp3',
          sizeBytes: 60_000_000,
        },
        {
          id: 'broken-hearts-are-for-assholes',
          title: 'Broken Hearts Are For Assholes',
          durationMs: 260_000,
          trackNumber: 3,
          discNumber: 1,
          format: 'MP3',
          filePath:
            '/ZappaLibrary/Sheik Yerbouti (1979)/03 Broken Hearts Are For Assholes.mp3',
          sizeBytes: 55_000_000,
        },
      ],
    },
  ],
};

