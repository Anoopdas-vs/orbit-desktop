import { describe, it, expect } from 'vitest';
import { moodIntelligence, MOOD_CATALOG } from '../src/skills/mood-intelligence';

describe('Mood Intelligence & Music Engine', () => {
  it('detects stress and cognitive overload', () => {
    const profile = moodIntelligence.analyzeMood('I had a really rough day and feeling overwhelmed');
    expect(profile.mood).toBe('STRESSED_OVERLOADED');
    expect(profile.recommendedGenre).toContain('Ambient');
    expect(profile.empathyResponse).toContain('tension');
  });

  it('detects tiredness and fatigue', () => {
    const profile = moodIntelligence.analyzeMood('I am exhausted and drained after coding all day');
    expect(profile.mood).toBe('TIRED_EXHAUSTED');
    expect(profile.recommendedGenre).toContain('Piano');
  });

  it('detects high drive and energy', () => {
    const profile = moodIntelligence.analyzeMood('I am super hyped and pumped up for workout, lets go');
    expect(profile.mood).toBe('ENERGETIC_HIGH_DRIVE');
    expect(profile.suggestedTrackTitle).toContain('Believer');
  });

  it('detects peaceful and spiritual reflection', () => {
    const profile = moodIntelligence.analyzeMood('I need peace, calm meditation, and spiritual stillness');
    expect(profile.mood).toBe('REFLECTIVE_PEACEFUL');
    expect(profile.recommendedGenre).toContain('Flute');
  });

  it('maintains mood history log', () => {
    moodIntelligence.analyzeMood('Feeling deep focus');
    const history = moodIntelligence.getMoodHistory();
    expect(history.length).toBeGreaterThan(0);
  });
});
