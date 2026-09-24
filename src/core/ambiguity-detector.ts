export interface AmbiguityCheckResult {
  isAmbiguous: boolean;
  clarificationQuestion?: string;
  suggestedOptions?: string[];
  category?: 'PROJECT_MISSING' | 'TRADING_VAGUE' | 'BRANCH_MISSING' | 'COMMAND_UNKNOWN';
}

export function detectAmbiguity(prompt: string, registeredProjects: string[] = []): AmbiguityCheckResult {
  const lower = prompt.toLowerCase().trim();

  // 1. Emergency stop patterns (Never ambiguous, must trigger immediately)
  if (
    lower === 'stop' ||
    lower === 'cancel' ||
    lower === 'emergency stop' ||
    lower === 'trading off' ||
    lower === 'kill'
  ) {
    return { isAmbiguous: false };
  }

  // 2. Vague trading instructions
  const vagueTradePatterns = [
    /take a (?:good )?trade/i,
    /buy something (?:promising|good|profitable)/i,
    /trade when the market/i,
    /invest (?:some )?money/i,
    /buy crypto/i,
    /make me (?:rich|money)/i,
  ];

  for (const pattern of vagueTradePatterns) {
    if (pattern.test(lower)) {
      return {
        isAmbiguous: true,
        category: 'TRADING_VAGUE',
        clarificationQuestion: 'Orbit does not make autonomous investment decisions. Please specify an exact pair (e.g. BTC/USDT) and amount (e.g. "Prepare a BTC spot buy order for ₹1,000").',
        suggestedOptions: [
          'Prepare a BTC spot buy order for ₹1,000',
          'Show BTC price',
          'Turn trading off'
        ]
      };
    }
  }

  // 3. Coding/Feature command without project context
  const featureWithoutProject = [
    /add (?:a )?(?:dark mode|feature|login|button|page|component)/i,
    /build (?:a )?(?:feature|screen|app)/i,
    /implement (?:the )?feature/i,
  ];

  const hasExplicitProject = registeredProjects.some(p => lower.includes(p.toLowerCase()));

  for (const pattern of featureWithoutProject) {
    if (pattern.test(lower) && !hasExplicitProject) {
      if (registeredProjects.length > 0) {
        return {
          isAmbiguous: true,
          category: 'PROJECT_MISSING',
          clarificationQuestion: `Which registered project would you like to apply this to? (${registeredProjects.join(', ')})`,
          suggestedOptions: registeredProjects.map(p => `In project "${p}": ${prompt}`)
        };
      } else {
        return {
          isAmbiguous: true,
          category: 'PROJECT_MISSING',
          clarificationQuestion: 'No registered project was detected. Please register or select an approved project directory first in the Projects panel.',
        };
      }
    }
  }

  // 4. Incomplete trading buy command missing amount or asset
  if (/^buy\s*$/i.test(lower) || /^buy\s+(?:btc|eth)\s*$/i.test(lower)) {
    return {
      isAmbiguous: true,
      category: 'TRADING_VAGUE',
      clarificationQuestion: 'Please specify the exact order amount in INR or USDT (e.g. "Prepare a BTC spot buy order for ₹1,000").',
      suggestedOptions: [
        'Prepare a BTC spot buy order for ₹1,000',
        'Show BTC price'
      ]
    };
  }

  return { isAmbiguous: false };
}
