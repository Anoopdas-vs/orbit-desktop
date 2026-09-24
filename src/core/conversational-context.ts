export interface PendingProposal {
  id: string;
  type: 'OPEN_YOUTUBE_CHROME' | 'RUN_MIGRATION' | 'CUSTOM_FALLBACK';
  question: string;
  targetUrl?: string;
  appName?: string;
  musicQuery?: string;
  onConfirmTitle: string;
  onConfirmDescription: string;
  params: Record<string, any>;
  createdAt: number;
}

class ConversationalContextManager {
  private activeProposal: PendingProposal | null = null;
  private readonly PROPOSAL_TTL_MS = 60000; // 1 minute expiry

  public setPendingProposal(proposal: Omit<PendingProposal, 'id' | 'createdAt'>): PendingProposal {
    const fullProposal: PendingProposal = {
      ...proposal,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    this.activeProposal = fullProposal;
    return fullProposal;
  }

  public getPendingProposal(): PendingProposal | null {
    if (!this.activeProposal) return null;
    // Check if proposal has expired
    if (Date.now() - this.activeProposal.createdAt > this.PROPOSAL_TTL_MS) {
      this.activeProposal = null;
      return null;
    }
    return this.activeProposal;
  }

  public hasPendingProposal(): boolean {
    return this.getPendingProposal() !== null;
  }

  public clearPendingProposal(): void {
    this.activeProposal = null;
  }

  public isAffirmative(input: string): boolean {
    const clean = input.trim().toLowerCase();
    const affirmativePatterns = [
      /^y(?:es|eah|ep|up)?$/i,
      /\b(?:yes|yeah|sure|ok|okay|yep|yup|please|go ahead|proceed|do it|open in chrome|open via chrome|play it)\b/i,
    ];
    return affirmativePatterns.some((pattern) => pattern.test(clean));
  }

  public isNegative(input: string): boolean {
    const clean = input.trim().toLowerCase();
    const negativePatterns = [
      /^no$/i,
      /\b(?:no|nope|cancel|don't|stop|never mind|abort|reject)\b/i,
    ];
    return negativePatterns.some((pattern) => pattern.test(clean));
  }
}

export const conversationalContext = new ConversationalContextManager();
