import { ScoreResponse } from './consumerScoreService';

/**
 * Plain-English explainer. This is NOT a language model: it is a small set of
 * templates that read the real fields returned by the backend (model score,
 * decision, the reasons the model pipeline attached to the row). It never
 * invents behaviour that is not in those fields.
 */

export interface ChatMessage {
  id: string;
  sender: 'AI' | 'USER';
  text: string;
  timestamp: string;
  suggestedAction?: 'APPROVE' | 'HOLD' | 'VERIFY';
}

function signals(transfer: ScoreResponse): string {
  const flags = (transfer.spam_flags || []).filter((f) => f && !f.startsWith('No alert'));
  return flags.length ? flags.map((f) => `• ${f}`).join('\n') : '• No alert signals were triggered for this account.';
}

function scoreLine(transfer: ScoreResponse): string {
  if (typeof transfer.model_score === 'number') {
    return `model score ${transfer.model_score.toFixed(4)} (0 to 1, not a probability)`;
  }
  return 'no model score';
}

export function generateInitialExplanation(transfer?: ScoreResponse | null): string {
  if (!transfer) {
    return 'Ready. Pick one of the example transactions or enter an account from the dataset to look up the model output.';
  }
  const amountStr = `${(transfer.amount ?? 0).toLocaleString()} ${transfer.currency || 'USD'}`;

  if (transfer.decision === 'UNSCORED') {
    return `No score for ${amountStr}: ${transfer.status_text}. This demo replays scores the model already produced; it cannot score accounts it has not seen.`;
  }
  if (transfer.decision === 'HOLD') {
    return `Hold recommended for ${amountStr} (${scoreLine(transfer)}). Signals attached by the model pipeline:\n${signals(transfer)}`;
  }
  if (transfer.decision === 'REVIEW') {
    return `Step-up verification recommended for ${amountStr} (${scoreLine(transfer)}). Signals:\n${signals(transfer)}`;
  }
  return `No alert for ${amountStr} (${scoreLine(transfer)}). The model score is below the alert threshold.`;
}

export function answerUserQuestion(question: string, transfer: ScoreResponse | null): string {
  const q = question.toLowerCase();

  if (!transfer) {
    return 'Run a check first, then I can summarise what the model returned.';
  }

  const receiver = transfer.receiver || 'this account';
  const decision = transfer.decision;

  if (q.includes('what is a money mule') || q.includes('what is a mule') || q.includes('mule account')) {
    return 'A money mule account is an account used to move criminal proceeds, often by someone who was recruited or tricked. Funds arrive and are passed on quickly, which makes the money hard to trace. MuleNet looks for transaction patterns that resemble this.';
  }

  if (q.includes('how') && (q.includes('fast') || q.includes('instant') || q.includes('real-time') || q.includes('quick') || q.includes('speed'))) {
    return 'This demo does not run the model live: it looks up scores that the MuleNet pipeline already computed for the IBM AML test stream (results/results.csv). Scoring itself was run separately (see the repo README for where and how).';
  }

  if (q.includes('safe') || q.includes('money') && q.includes('lose')) {
    return decision === 'ALLOW'
      ? `The model raised no alert for ${receiver}. That is not a guarantee: on held-out data the model catches about 28% of laundering transactions at its alert threshold.`
      : 'Nothing is sent by this demo. In a real deployment the payment would be paused for verification while you decide.';
  }

  if (q.includes('block') || q.includes('cancel') || q.includes('stop') || q.includes('freeze') || q.includes('proceed')) {
    return 'Nothing is blocked automatically. The model only recommends allow, step-up verification, or hold for an officer; a human makes the final call.';
  }

  if (decision === 'UNSCORED') {
    return `There is no model output for ${receiver}, so I cannot explain a score. ${transfer.ai_narrative}`;
  }

  if (q.includes('why') || q.includes('scam') || q.includes('risk') || q.includes('flag') || q.includes('dangerous') || q.includes('suspicious') || q.includes('hold')) {
    return decision === 'ALLOW'
      ? `No alert was raised for ${receiver} (${scoreLine(transfer)}).`
      : `${receiver} was flagged (${scoreLine(transfer)}). These are the signals the pipeline attached:\n${signals(transfer)}\nSignals are indicators, not proof of laundering.`;
  }

  return `For ${receiver}: decision ${decision}, ${scoreLine(transfer)}. Ask "Why was this flagged?" or "What is a money mule?".`;
}
