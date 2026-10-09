'use strict';

/*
 * Instruments. Notes are shown at WRITTEN pitch; `transpose` is the number of semitones
 * from written to sounding (concert) pitch and `transposeSteps` the same interval in diatonic steps. The choice is remembered in localStorage.
 */
const Instruments = (() => {
  const KEY = 'saxnoten.instrument';
  const DEFAULT_ID = 'altsax';

  const CLARINET_SVG =
    '<svg class="inst-svg" viewBox="0 0 64 64" aria-hidden="true"><g transform="rotate(35 32 32)">' +
    '<rect x="29.5" y="1" width="5" height="9" rx="2" fill="#555"/>' +
    '<rect x="28" y="9" width="8" height="42" rx="2" fill="#2b2b2b"/>' +
    '<path d="M28 50 L23 62 H41 L36 50 Z" fill="#2b2b2b"/>' +
    '<rect x="27" y="20" width="10" height="2" fill="#c9c9c9"/>' +
    '<rect x="27" y="36" width="10" height="2" fill="#c9c9c9"/>' +
    '<circle cx="32" cy="26" r="1.8" fill="#e6e6e6"/><circle cx="32" cy="31" r="1.8" fill="#e6e6e6"/>' +
    '<circle cx="32" cy="42" r="1.8" fill="#e6e6e6"/><circle cx="32" cy="46.5" r="1.8" fill="#e6e6e6"/>' +
    '</g></svg>';

  const LIST = [
    {
      id: 'altsax', name: 'Altsaxofoon', short: 'Altsax', nameEn: 'Alto saxophone', shortEn: 'Alto sax', icon: '🎷',
      soundfont: 'alto_sax', transpose: -9, transposeSteps: -5, // Eb instrument: sounds a major sixth lower
      lowest: 'Bb3', highest: 'F6', defaultLow: 'D4', defaultHigh: 'C6',
    },
    {
      id: 'klarinet', name: 'Klarinet', short: 'Klarinet', nameEn: 'Clarinet', shortEn: 'Clarinet', icon: CLARINET_SVG,
      soundfont: 'clarinet', transpose: -2, transposeSteps: -1, // Bb instrument: sounds a major second lower
      lowest: 'E3', highest: 'C7', defaultLow: 'E4', defaultHigh: 'C6',
    },
    {
      id: 'trompet', name: 'Trompet', short: 'Trompet', nameEn: 'Trumpet', shortEn: 'Trumpet', icon: '🎺',
      soundfont: 'trumpet', transpose: -2, transposeSteps: -1, // Bb instrument: sounds a major second lower
      lowest: 'F#3', highest: 'C6', defaultLow: 'C4', defaultHigh: 'G5',
    },
  ].map((inst) => ({ ...inst, rangeIds: Notes.rangeIds(inst.lowest, inst.highest) }));

  const byId = (id) => LIST.find((i) => i.id === id);

  let currentId = DEFAULT_ID;
  try {
    const saved = localStorage.getItem(KEY);
    if (byId(saved)) currentId = saved;
  } catch { /* private mode */ }

  function get() {
    return byId(currentId);
  }

  function set(id) {
    if (!byId(id) || id === currentId) return;
    currentId = id;
    try { localStorage.setItem(KEY, id); } catch { /* private mode */ }
    document.dispatchEvent(new CustomEvent('instrument-change', { detail: get() }));
  }

  return { LIST, DEFAULT_ID, byId, get, set };
})();
