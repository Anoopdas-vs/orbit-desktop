import { IntentClassification, IntentCategory } from '../types/tools';
import { multilingualNLP } from './multilingual-nlp';

export class KnowledgeRouter {
  /**
   * Classify user prompt into Knowledge, Computer Action, External Workflow, or Hybrid.
   */
  public classify(prompt: string): IntentClassification {
    const raw = prompt.trim();
    const clean = raw.toLowerCase().replace(/^(?:hey|hei|hi|hello)?\s*janki[,:.\- ]*/i, '').trim();
    const isMalayalam = /[\u0D00-\u0D7F]/.test(raw) || multilingualNLP.detectLanguage(raw) === 'ml';

    // 1. Check for Hybrid Multi-step Workflows first
    // E.g. "Search the web and save the result into a file", "Search for X and write report to Y"
    if (
      (clean.includes('search') || clean.includes('research')) &&
      (clean.includes('save') || clean.includes('write to a file') || clean.includes('save into a file') || clean.includes('save to file'))
    ) {
      const queryMatch = clean.match(/(?:search|research)\s+(?:the\s+web\s+for|google\s+for|for)?\s*([^,]+?)(?:\s+(?:and|then)\s+(?:save|write)|$)/i);
      const query = queryMatch && queryMatch[1] ? queryMatch[1].trim() : 'latest technology trends';

      return {
        category: 'HYBRID_WORKFLOW',
        interpretedIntent: `Search web for "${query}" and save to file`,
        confidence: 0.95,
        extractedQuery: query,
        targetTool: 'web_search',
        isLanguageMalayalam: isMalayalam,
        subIntents: ['web_search', 'file_save'],
      };
    }

    // 2. External Application Workflows: Email, Calendar, Cloud integrations
    if (
      clean.includes('email') ||
      clean.includes('gmail') ||
      clean.includes('inbox') ||
      clean.includes('mail from') ||
      clean.includes('send an email')
    ) {
      let interpretedIntent = 'Inspect Emails';
      let extractedQuery: string | undefined;

      if (clean.includes('summarize') || clean.includes('from ')) {
        const fromMatch = clean.match(/(?:from)\s+([a-zA-Z0-9@._-]+)/i);
        extractedQuery = fromMatch ? fromMatch[1] : undefined;
        interpretedIntent = `Find and Summarize Email${extractedQuery ? ` from ${extractedQuery}` : ''}`;
      } else if (clean.includes('send')) {
        interpretedIntent = 'Prepare Email Dispatch';
      }

      return {
        category: 'EXTERNAL_WORKFLOW',
        interpretedIntent,
        confidence: 0.92,
        extractedQuery,
        targetApp: 'Gmail',
        targetTool: 'email_workflow',
        isLanguageMalayalam: isMalayalam,
      };
    }

    if (clean.includes('calendar') || clean.includes('schedule') || clean.includes('meeting') || clean.includes('appointment')) {
      return {
        category: 'EXTERNAL_WORKFLOW',
        interpretedIntent: clean.includes('create') || clean.includes('schedule') ? 'Schedule Calendar Event' : 'Check Upcoming Schedule',
        confidence: 0.9,
        targetApp: 'Calendar',
        targetTool: 'calendar_workflow',
        isLanguageMalayalam: isMalayalam,
      };
    }

    // 3. Browser-based Google Research
    // E.g. "Search Google for the latest GST changes and explain them", "Search Google for X and tell me"
    if (
      clean.includes('search google') ||
      clean.includes('google search') ||
      clean.includes('search in google') ||
      (clean.includes('search') && clean.includes('and explain')) ||
      (clean.includes('search') && clean.includes('and tell me'))
    ) {
      const qMatch = clean.match(/(?:search\s+google\s+for|search\s+in\s+google\s+for|search\s+for|search)\s+([^,]+?)(?:\s+and\s+(?:explain|tell|summarize)|$)/i);
      const query = qMatch && qMatch[1] ? qMatch[1].trim() : clean.replace(/search google for/i, '').trim();

      return {
        category: 'KNOWLEDGE_RESEARCH',
        interpretedIntent: `Research & Explain: "${query}"`,
        confidence: 0.94,
        extractedQuery: query,
        targetApp: 'Safari',
        targetTool: 'browser_research',
        isLanguageMalayalam: isMalayalam,
        subIntents: ['browser_search', 'answer_synthesis'],
      };
    }

    // 4. Knowledge / Web Intelligence Questions
    // E.g. "What is the current price of gold?", "What is the latest information about Apple's new MacBook?",
    // Malayalam: "ഇന്നത്തെ പ്രധാന വാർത്തകൾ എന്തൊക്കെയാണ്?"
    const isKnowledgeQuestion =
      clean.startsWith('what is') ||
      clean.startsWith("what's") ||
      clean.startsWith('who is') ||
      clean.startsWith('how to') ||
      clean.startsWith('why is') ||
      clean.startsWith('explain ') ||
      clean.startsWith('tell me about ') ||
      clean.includes('price of ') ||
      clean.includes('latest information about') ||
      clean.includes('news about') ||
      clean.includes('current price') ||
      clean.includes('വാർത്തകൾ') ||
      clean.includes('എന്തൊക്കെയാണ്') ||
      clean.includes('വില എത്രയാണ്') ||
      (isMalayalam && (clean.includes('എങ്ങനെ') || clean.includes('ആരാണ്') || clean.includes('എന്താണ്')));

    if (isKnowledgeQuestion) {
      let query = clean
        .replace(/^(?:what is|what's|tell me about|explain|who is)\s+(?:the\s+)?/i, '')
        .replace(/^(?:latest information about|information about)\s+/i, '')
        .trim();

      if (isMalayalam) {
        query = raw.replace(/[?.,!]+$/, '').trim();
      }

      return {
        category: 'KNOWLEDGE_RESEARCH',
        interpretedIntent: `Web Knowledge Research: "${query.slice(0, 40)}"`,
        confidence: 0.95,
        extractedQuery: query,
        targetTool: 'web_search',
        isLanguageMalayalam: isMalayalam,
        subIntents: ['web_search', 'answer_synthesis'],
      };
    }

    // 5. Native Computer Actions
    // E.g. "Open Safari", "Open TextEdit", "Set volume to 40", "Mute audio", "Close window"
    const isComputerAction =
      clean.startsWith('open ') ||
      clean.startsWith('launch ') ||
      clean.startsWith('close ') ||
      clean.startsWith('quit ') ||
      clean.startsWith('set volume') ||
      clean.startsWith('mute') ||
      clean.startsWith('unmute') ||
      clean.startsWith('minimize') ||
      clean.startsWith('maximize') ||
      clean.startsWith('zoom');

    if (isComputerAction) {
      const appTarget = clean.replace(/^(?:open|launch|close|quit)\s+/i, '').trim();
      return {
        category: 'COMPUTER_ACTION',
        interpretedIntent: `Computer Action: ${clean}`,
        confidence: 0.95,
        targetApp: appTarget,
        targetTool: 'computer_control',
        isLanguageMalayalam: isMalayalam,
      };
    }

    // Default: General request
    return {
      category: 'COMPUTER_ACTION',
      interpretedIntent: 'General Command',
      confidence: 0.7,
      targetTool: 'computer_control',
      isLanguageMalayalam: isMalayalam,
    };
  }
}

export const knowledgeRouter = new KnowledgeRouter();
