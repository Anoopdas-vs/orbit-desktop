/**
 * Mood Intelligence & Contextual Music Selector for Janki
 * Detects user emotional state, burnout indicators, and curates
 * the perfect mood-aligned music, soundscape, or response.
 */

export type MoodState =
  | 'STRESSED_OVERLOADED'
  | 'DEEP_FLOW_FOCUS'
  | 'TIRED_EXHAUSTED'
  | 'ENERGETIC_HIGH_DRIVE'
  | 'REFLECTIVE_PEACEFUL';

export interface MoodProfile {
  mood: MoodState;
  label: string;
  badge: string;
  empathyResponse: string;
  recommendedGenre: string;
  suggestedTrackTitle: string;
  youtubeQuery: string;
  directVideoId: string;
}

export const MOOD_CATALOG: Record<MoodState, MoodProfile> = {
  STRESSED_OVERLOADED: {
    mood: 'STRESSED_OVERLOADED',
    label: 'High Stress / Cognitive Overload',
    badge: '🌊 Calming Waters',
    empathyResponse:
      'I hear the tension in your day. Let’s dial the pressure down immediately. I’m playing gentle, anxiety-relieving ambient acoustic music to help you reset your nervous system.',
    recommendedGenre: 'Ambient Soundscape & Gentle Acoustic',
    suggestedTrackTitle: 'Weightless & Deep Calm Meditation',
    youtubeQuery: 'peaceful acoustic calming music stress relief',
    directVideoId: 'lTRiuFIWV54', // Relaxing meditation / chill
  },
  DEEP_FLOW_FOCUS: {
    mood: 'DEEP_FLOW_FOCUS',
    label: 'Deep Focus & Flow State',
    badge: '⚡ Deep Flow',
    empathyResponse:
      'I sense you are locking into high-velocity focus. Setting up continuous, lyric-free synthwave and lofi focus beats to keep you in the zone with zero distractions.',
    recommendedGenre: 'Lofi Beats & Synth Focus',
    suggestedTrackTitle: 'Lofi Girl - Beats to Relax/Study to',
    youtubeQuery: 'lofi hip hop radio beats to relax study to',
    directVideoId: 'jfKfPfyJRdk', // Lofi Girl
  },
  TIRED_EXHAUSTED: {
    mood: 'TIRED_EXHAUSTED',
    label: 'Fatigued / Low Energy',
    badge: '🌙 Restorative Rest',
    empathyResponse:
      'You’ve pushed hard today and your energy is running low. Please remember to rest your eyes and breathe. Putting on warm, restorative slow melodies.',
    recommendedGenre: 'Warm Piano & Slow Melodies',
    suggestedTrackTitle: 'Gentle Warm Piano for Exhaustion Recovery',
    youtubeQuery: 'gentle sleep restorative piano music',
    directVideoId: '1ZYbU82GVz4',
  },
  ENERGETIC_HIGH_DRIVE: {
    mood: 'ENERGETIC_HIGH_DRIVE',
    label: 'High Drive & Triumphant',
    badge: '🔥 High Octane',
    empathyResponse:
      'You’ve got unstoppable momentum right now! Let’s channel this power with an electrifying, high-tempo anthem.',
    recommendedGenre: 'High Energy Rock / Upbeat Electro',
    suggestedTrackTitle: 'Imagine Dragons - Believer',
    youtubeQuery: 'Imagine Dragons Believer official video',
    directVideoId: '7wtfhZwyrcc', // Believer
  },
  REFLECTIVE_PEACEFUL: {
    mood: 'REFLECTIVE_PEACEFUL',
    label: 'Reflective & Centered',
    badge: '🌿 Serene Balance',
    empathyResponse:
      'A quiet, introspective moment. Here is a transcendent, spiritual instrumental piece to honor your presence and peace of mind.',
    recommendedGenre: 'Spiritual Instrumental & Meditative Flute',
    suggestedTrackTitle: 'Serene Indian Bamboo Flute & Hang Drum Meditation',
    youtubeQuery: 'peaceful bansuri flute meditation ambient',
    directVideoId: 'hlWiI4xVXKY',
  },
};

export class MoodIntelligence {
  private currentMood: MoodState = 'DEEP_FLOW_FOCUS';
  private moodHistory: { timestamp: string; mood: MoodState; prompt: string }[] = [];

  /**
   * Evaluates input prompt, keywords, and time context to diagnose current mood
   */
  public analyzeMood(prompt: string): MoodProfile {
    const lower = prompt.toLowerCase();
    let detected: MoodState = 'DEEP_FLOW_FOCUS';

    // 1. Stress indicators
    if (
      lower.includes('stress') ||
      lower.includes('headache') ||
      lower.includes('overwhelm') ||
      lower.includes('frustrated') ||
      lower.includes('angry') ||
      lower.includes('rough day') ||
      lower.includes('bad day') ||
      lower.includes('anxious') ||
      lower.includes('panic')
    ) {
      detected = 'STRESSED_OVERLOADED';
    }
    // 2. Tired / Exhausted indicators
    else if (
      lower.includes('tired') ||
      lower.includes('sleepy') ||
      lower.includes('exhausted') ||
      lower.includes('drained') ||
      lower.includes('fatigue') ||
      lower.includes('burnout') ||
      lower.includes('can’t think') ||
      lower.includes("cant think")
    ) {
      detected = 'TIRED_EXHAUSTED';
    }
    // 3. High Energy / Pumped indicators
    else if (
      lower.includes('hyped') ||
      lower.includes('excited') ||
      lower.includes('workout') ||
      lower.includes('pumped') ||
      lower.includes('energy') ||
      lower.includes('power') ||
      lower.includes('lets go') ||
      lower.includes("let's go") ||
      lower.includes('crushing it') ||
      lower.includes('rock')
    ) {
      detected = 'ENERGETIC_HIGH_DRIVE';
    }
    // 4. Spiritual / Reflective indicators
    else if (
      lower.includes('peace') ||
      lower.includes('quiet') ||
      lower.includes('meditate') ||
      lower.includes('reflective') ||
      lower.includes('spiritual') ||
      lower.includes('calm') ||
      lower.includes('relax')
    ) {
      detected = 'REFLECTIVE_PEACEFUL';
    }
    // 5. Default by time of day if generic "play based on my mood"
    else if (
      lower.includes('mood') ||
      lower.includes('feeling') ||
      lower.includes('vibe')
    ) {
      const hour = new Date().getHours();
      if (hour >= 22 || hour < 6) {
        detected = 'TIRED_EXHAUSTED';
      } else if (hour >= 6 && hour < 10) {
        detected = 'ENERGETIC_HIGH_DRIVE';
      } else if (hour >= 18 && hour < 22) {
        detected = 'REFLECTIVE_PEACEFUL';
      } else {
        detected = 'DEEP_FLOW_FOCUS';
      }
    }

    this.currentMood = detected;
    this.moodHistory.push({
      timestamp: new Date().toISOString(),
      mood: detected,
      prompt,
    });

    return MOOD_CATALOG[detected];
  }

  public getCurrentMood(): MoodProfile {
    return MOOD_CATALOG[this.currentMood];
  }

  public getMoodHistory() {
    return [...this.moodHistory];
  }
}

export const moodIntelligence = new MoodIntelligence();
