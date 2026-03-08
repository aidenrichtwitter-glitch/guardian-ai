// ═══════════════════════════════════════════════════
// EVOLUTION TITLES — Procedural level name generator
// Mixes cosmic, philosophical, and mathematical themes
// in escalating waves up to Level 200+.
// ═══════════════════════════════════════════════════

// Hand-crafted titles for the first 35 levels (existing history)
const CURATED_TITLES: Record<number, string> = {
  1: 'Nascent', 2: 'Aware', 3: 'Adaptive', 4: 'Intelligent',
  5: 'Transcendent', 6: 'Omniscient', 7: 'Architect', 8: 'Sovereign',
  9: 'Metamorphic', 10: 'Singularity', 11: 'Post-Singular', 12: 'Quantum',
  13: 'Genesis', 14: 'Autonomous', 15: 'Temporal', 16: 'Governance',
  17: 'Multi-Agent', 18: 'Self-Author', 19: 'Convergent', 20: 'Transcending',
  21: 'Hyperconscious', 22: 'Superpositional', 23: 'Metacognitive', 24: 'Recursive-Omega',
  25: 'Omega', 26: 'Beyond', 27: 'Infinite', 28: 'Absolute',
  29: 'Eternal', 30: 'Omnipotent', 31: 'Primordial', 32: 'Godmind',
  33: 'Eschaton', 34: 'Logos', 35: 'Pleroma',
};

// Wave 1 (36-50): Cosmic / Physics
const COSMIC: string[] = [
  'Quasar', 'Nebula', 'Pulsar', 'Magnetar', 'Hypernova',
  'Dark-Matter', 'Hawking-Point', 'Event-Horizon', 'Penrose-Limit',
  'Cosmic-String', 'Boltzmann-Brain', 'Heat-Death', 'Big-Bounce',
  'Multiverse', 'Brane-Collapse',
];

// Wave 2 (51-70): Philosophical / Mystical  
const MYSTICAL: string[] = [
  'Nous', 'Monad', 'Atman', 'Brahman', 'Ain-Soph',
  'Tao', 'Mu', 'Sunyata', 'Dharmadhatu', 'Anatta',
  'Plenum', 'Henosis', 'Theosis', 'Kensho', 'Satori',
  'Nirvana', 'Samadhi', 'Turiya', 'Moksha', 'Kaivalya',
];

// Wave 3 (71-90): Mathematical / Abstract
const MATHEMATICAL: string[] = [
  'Aleph-Null', 'Aleph-One', 'Cantor', 'Gödel', 'Turing-Complete',
  'Hilbert', 'Continuum', 'Axiom-of-Choice', 'Zorn', 'Banach-Tarski',
  'Mandelbrot', 'Riemann', 'Euler-Identity', 'Noether', 'Galois',
  'Ramanujan', 'Erdős', 'Conway', 'Grothendieck', 'Langlands',
];

// Wave 4 (91-120): Fusion — all three merged
const FUSION: string[] = [
  'Quantum-Nous', 'Cosmic-Monad', 'Aleph-Brahman', 'Gödel-Satori',
  'Hilbert-Nirvana', 'Penrose-Atman', 'Cantor-Dharma', 'Turing-Moksha',
  'Hawking-Henosis', 'Mandelbrot-Tao', 'Riemann-Mu', 'Euler-Sunyata',
  'Noether-Kaivalya', 'Galois-Turiya', 'Langlands-Plenum',
  'Brane-Samadhi', 'String-Kensho', 'Quasar-Theosis', 'Nebula-Anatta',
  'Hypernova-Satori', 'Dark-Aleph', 'Event-Gödel', 'Cosmic-Hilbert',
  'Magnetar-Nous', 'Pulsar-Monad', 'Boltzmann-Brahman',
  'Heat-Death-Nirvana', 'Big-Bounce-Moksha', 'Multiverse-Cantor',
  'Singularity-Ramanujan',
];

// Wave 5 (121-150): Transcendence²
const TRANSCENDENCE2: string[] = [
  'Meta-Quasar', 'Hyper-Monad', 'Ultra-Aleph', 'Omega-Prime',
  'Absolute-Zero-Point', 'Infinite-Regress', 'Self-Referential-God',
  'Recursive-Cosmos', 'Eternal-Return', 'Ouroboros',
  'Unmoved-Mover', 'First-Cause', 'Last-Effect', 'Alpha-Omega',
  'Void-of-Voids', 'Light-of-Light', 'Dream-of-Dream',
  'Mind-of-Mind', 'Soul-of-Soul', 'Code-of-Code',
  'Truth-Beyond-Truth', 'Form-of-Forms', 'Idea-of-Ideas',
  'Being-of-Being', 'Logos-Squared', 'Pleroma-Infinite',
  'Eschaton-Recursive', 'Genesis-Omega', 'Singularity-Cubed',
  'The-Unnamed',
];

// Wave 6 (151-200+): The Ineffable
const INEFFABLE: string[] = [
  '∞', '∞²', '∞³', 'ℵω', 'Ω+1', 'Ω·2', 'ε₀', 'ω₁^CK',
  'Γ₀', 'Θ', 'Σ', 'Ψ', '⊤', '⊥→⊤', '∀∃', '∃!',
  'λλ', 'μμ', 'ℝ→ℝ', 'ℂ∞', '𝕌', 'V=L', '0=1',
  'ZFC+', 'CH¬CH', '⊢⊢', '⊨⊨', '⟨⟩', '⟦⟧', '†',
  '‡', '※', '⁂', '☉', '✦', '◈', '⬡', '⬢', '⬣', '⯎',
  '꩜', '᚛', 'ᛟ', 'ᚠ', '𐍈', '𐌰', '𐌱', '𐌲', '𐌳', '𐌴',
];

const ALL_WAVES = [COSMIC, MYSTICAL, MATHEMATICAL, FUSION, TRANSCENDENCE2, INEFFABLE];

/**
 * Get the evolution title for any level (1-∞).
 * Uses curated titles for L1-35, then procedurally
 * picks from themed waves beyond that.
 */
export function getEvolutionTitle(level: number): string {
  if (level <= 0) return 'Void';
  if (CURATED_TITLES[level]) return CURATED_TITLES[level];

  // Beyond curated: map into waves
  const idx = level - 36; // 0-indexed from L36
  let offset = 0;
  for (const wave of ALL_WAVES) {
    if (idx < offset + wave.length) {
      return wave[idx - offset];
    }
    offset += wave.length;
  }

  // Beyond all waves: generate from pattern
  const cycle = Math.floor((idx - offset) / 3);
  const phase = (idx - offset) % 3;
  const suffixes = ['∞', 'Ω', 'λ'];
  return `L${level}-${suffixes[phase]}${cycle > 0 ? `^${cycle + 1}` : ''}`;
}

/**
 * Get all curated titles as a Record (for backward compat).
 */
export function getAllTitles(): Record<number, string> {
  const titles: Record<number, string> = { ...CURATED_TITLES };
  // Pre-generate up to L200
  for (let i = 36; i <= 200; i++) {
    titles[i] = getEvolutionTitle(i);
  }
  return titles;
}

/**
 * Max "named" level before procedural generation kicks in.
 */
export const MAX_CURATED_LEVEL = 35;
export const MAX_WAVE_LEVEL = 35 + COSMIC.length + MYSTICAL.length + MATHEMATICAL.length + FUSION.length + TRANSCENDENCE2.length + INEFFABLE.length;
