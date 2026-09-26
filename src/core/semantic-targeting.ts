import { UiElementInfo, UiTreeResult } from '../adapters/native/tauri-bridge';

export interface ResolvedTarget {
  element: UiElementInfo;
  clickX: number;
  clickY: number;
  confidence: number; // 0.0 to 1.0
  matchReason: string;
}

export interface TargetQuery {
  rawTarget: string;
  expectedRole?: 'BUTTON' | 'TEXTFIELD' | 'LINK' | 'CHECKBOX' | 'MENUITEM';
  actionContext?: 'click' | 'type' | 'focus' | 'toggle';
}

export class SemanticTargetResolver {
  /**
   * Parse a natural-language target description and find the best matching accessible element.
   */
  public resolve(
    targetInput: string | TargetQuery,
    tree: UiTreeResult
  ): ResolvedTarget | null {
    if (!tree.elements || tree.elements.length === 0) {
      return null;
    }

    const query: TargetQuery =
      typeof targetInput === 'string'
        ? this.parseTargetQuery(targetInput)
        : targetInput;

    const normalizedTarget = query.rawTarget.toLowerCase().trim();

    // 1. Direct Exact Title / Name Match
    for (const el of tree.elements) {
      if (el.title.toLowerCase().trim() === normalizedTarget) {
        return this.createResolved(el, 1.0, `Exact title match: "${el.title}"`);
      }
    }

    // 2. Role-Constrained Match (e.g. "Send button", "Search input")
    if (query.expectedRole) {
      const candidates = tree.elements.filter(
        (el) => el.role.toUpperCase() === query.expectedRole
      );
      for (const el of candidates) {
        if (
          el.title.toLowerCase().includes(normalizedTarget) ||
          (el.description && el.description.toLowerCase().includes(normalizedTarget))
        ) {
          return this.createResolved(
            el,
            0.95,
            `Role ${query.expectedRole} match containing "${normalizedTarget}"`
          );
        }
      }
    }

    // 3. Address Bar / Search Field special heuristic for browsers
    if (
      normalizedTarget.includes('address') ||
      normalizedTarget.includes('search') ||
      normalizedTarget.includes('url')
    ) {
      const textFields = tree.elements.filter((el) => el.role.toUpperCase() === 'TEXTFIELD');
      if (textFields.length > 0) {
        // Find focused one or first one
        const focused = textFields.find((el) => el.focused);
        const bestField = focused || textFields[0];
        return this.createResolved(
          bestField,
          0.9,
          `Matched browser search/address field: "${bestField.title || bestField.description || 'Address Bar'}"`
        );
      }
    }

    // 4. Substring Title / Description Match
    for (const el of tree.elements) {
      const tLower = el.title.toLowerCase();
      const dLower = (el.description || '').toLowerCase();
      if (tLower.includes(normalizedTarget) || dLower.includes(normalizedTarget)) {
        return this.createResolved(
          el,
          0.85,
          `Substring match in ${el.role}: "${el.title || el.description}"`
        );
      }
    }

    // 5. Keyword Token Overlap (Split words and score)
    const queryTokens = normalizedTarget.split(/\s+/).filter((w) => w.length > 2);
    let bestEl: UiElementInfo | null = null;
    let highestScore = 0;

    for (const el of tree.elements) {
      const content = `${el.title} ${el.description || ''} ${el.role}`.toLowerCase();
      let matchCount = 0;
      for (const token of queryTokens) {
        if (content.includes(token)) matchCount++;
      }
      if (matchCount > 0) {
        const score = matchCount / queryTokens.length;
        if (score > highestScore) {
          highestScore = score;
          bestEl = el;
        }
      }
    }

    if (bestEl && highestScore >= 0.5) {
      return this.createResolved(
        bestEl,
        0.5 + highestScore * 0.3,
        `Token overlap (${Math.round(highestScore * 100)}%) on element: "${bestEl.title}"`
      );
    }

    return null;
  }

  private parseTargetQuery(raw: string): TargetQuery {
    const clean = raw.toLowerCase().trim();
    let expectedRole: TargetQuery['expectedRole'];
    let actionContext: TargetQuery['actionContext'];
    let queryText = clean;

    if (clean.includes('button')) {
      expectedRole = 'BUTTON';
      actionContext = 'click';
      queryText = queryText.replace(/\bbutton\b/g, '').trim();
    } else if (clean.includes('field') || clean.includes('input') || clean.includes('box') || clean.includes('bar')) {
      expectedRole = 'TEXTFIELD';
      actionContext = 'type';
      queryText = queryText.replace(/\b(?:field|input|box|bar)\b/g, '').trim();
    } else if (clean.includes('checkbox') || clean.includes('check box')) {
      expectedRole = 'CHECKBOX';
      actionContext = 'toggle';
      queryText = queryText.replace(/\b(?:checkbox|check box)\b/g, '').trim();
    } else if (clean.includes('link')) {
      expectedRole = 'LINK';
      actionContext = 'click';
      queryText = queryText.replace(/\blink\b/g, '').trim();
    }

    return {
      rawTarget: queryText.length > 0 ? queryText : raw,
      expectedRole,
      actionContext,
    };
  }

  private createResolved(
    element: UiElementInfo,
    confidence: number,
    matchReason: string
  ): ResolvedTarget {
    const clickX = element.x + Math.max(1, Math.floor(element.width / 2));
    const clickY = element.y + Math.max(1, Math.floor(element.height / 2));
    return {
      element,
      clickX,
      clickY,
      confidence,
      matchReason,
    };
  }
}

export const semanticTargetResolver = new SemanticTargetResolver();
