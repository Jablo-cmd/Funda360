import { describe, expect, it } from 'vitest';
import { conversationHasUnread, conversationTitle, formatConversationTime } from './conversationDisplay';

const participant = (firstName: string, lastName: string) => ({
  profileId: `${firstName}-${lastName}`,
  firstName,
  lastName,
  lastReadAt: null,
  archived: false,
  muted: false,
});

describe('conversationTitle', () => {
  it('prefers an explicit subject', () => {
    expect(conversationTitle({ subject: '  Term fees  ', otherParticipants: [participant('Ada', 'Lovelace')] })).toBe(
      'Term fees',
    );
  });

  it('falls back to participant names for a direct thread', () => {
    expect(conversationTitle({ subject: null, otherParticipants: [participant('Ada', 'Lovelace')] })).toBe('Ada Lovelace');
  });

  it('truncates a group with more than two others', () => {
    expect(
      conversationTitle({
        subject: '',
        otherParticipants: [participant('A', 'One'), participant('B', 'Two'), participant('C', 'Three')],
      }),
    ).toBe('A One, B Two +1');
  });

  it('handles a thread with no visible participants', () => {
    expect(conversationTitle({ subject: null, otherParticipants: [] })).toBe('Conversation');
  });
});

describe('conversationHasUnread', () => {
  const base = {
    lastMessageAt: '2026-09-07T10:00:00.000Z',
    lastMessageSenderId: 'other',
    myLastReadAt: '2026-09-07T09:00:00.000Z',
    myProfileId: 'me',
  };

  it('is true when the latest message is newer than the read cursor and from someone else', () => {
    expect(conversationHasUnread(base)).toBe(true);
  });

  it('is false when the latest message is my own', () => {
    expect(conversationHasUnread({ ...base, lastMessageSenderId: 'me' })).toBe(false);
  });

  it('is false when the read cursor is at or past the latest message', () => {
    expect(conversationHasUnread({ ...base, myLastReadAt: '2026-09-07T10:00:00.000Z' })).toBe(false);
  });

  it('is true when there is no read cursor yet', () => {
    expect(conversationHasUnread({ ...base, myLastReadAt: null })).toBe(true);
  });

  it('is false for an empty conversation', () => {
    expect(conversationHasUnread({ ...base, lastMessageAt: null, lastMessageSenderId: null })).toBe(false);
  });
});

describe('formatConversationTime', () => {
  it('shows a time for a message sent today', () => {
    const now = new Date('2026-09-07T15:00:00.000Z');
    const result = formatConversationTime('2026-09-07T08:30:00.000Z', now);
    expect(result).toMatch(/\d/);
    expect(result).not.toMatch(/Sep/);
  });

  it('shows a day and month for an older message', () => {
    const now = new Date('2026-09-07T15:00:00.000Z');
    expect(formatConversationTime('2026-09-01T08:30:00.000Z', now)).toMatch(/Sep/);
  });
});
