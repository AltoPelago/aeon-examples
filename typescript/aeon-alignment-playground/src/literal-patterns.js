// Sticky: the editor sets lastIndex to the current token offset.
// Only one '>' is a trimtick marker; SPACE/TAB may separate it from '`'.
// Escape and ordinary-character branches are disjoint to avoid backtracking
// across a long unterminated run of backslashes. Tokenization is line-local.
export const trimtickStringPattern = /(?<!>)>[ \t]*`(?:\\[^\r\n]|[^`\\\r\n])*`/y;
