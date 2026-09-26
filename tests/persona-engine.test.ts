import { describe, it, expect } from 'vitest';
import { personaEngine, PERSONA_PROFILES } from '../src/core/persona-engine';

describe('Chameleon Persona Engine', () => {
  it('initializes with default PIONEER persona', () => {
    const current = personaEngine.getPersona();
    expect(current.type).toBe('PIONEER');
    expect(current.name).toContain('Pioneer');
  });

  it('switches persona correctly and emits greeting', () => {
    const mentor = personaEngine.setPersona('MENTOR');
    expect(mentor.type).toBe('MENTOR');
    expect(personaEngine.getPersona().type).toBe('MENTOR');

    const greeting = personaEngine.getRandomGreeting('MENTOR');
    expect(greeting.length).toBeGreaterThan(10);
  });

  it('detects persona requests accurately from natural language', () => {
    expect(personaEngine.detectPersonaRequest('Please act as my mentor')).toBe('MENTOR');
    expect(personaEngine.detectPersonaRequest('Be my teacher today')).toBe('MENTOR');
    expect(personaEngine.detectPersonaRequest('Talk to me as a psychologist, I am stressed')).toBe('PSYCHOLOGIST');
    expect(personaEngine.detectPersonaRequest('Act like a father figure and guide me')).toBe('FATHER_FIGURE');
    expect(personaEngine.detectPersonaRequest('Be my spiritual leader and guide my mindfulness')).toBe('SPIRITUAL_LEADER');
    expect(personaEngine.detectPersonaRequest('Switch to pioneer mode and let us build')).toBe('PIONEER');
    expect(personaEngine.detectPersonaRequest('open google chrome')).toBeNull();
  });
});
