// Vendored from the external scanner of tree-sitter-c-sharp, with the IMPLICIT_* tokens and
// scan_implicit_continuation added for Razor. The TokenType order must start with the upstream
// order because grammar.js appends its own externals to the imported list; `node
// tools/scanner-drift.mjs` checks that and this version marker, and runs in the verify workflow.
// Upstream: tree-sitter-c-sharp 0.23.5
#include "tree_sitter/alloc.h"
#include "tree_sitter/array.h"
#include "tree_sitter/parser.h"

#include <ctype.h>
#include <wctype.h>

enum TokenType {
    OPT_SEMI,
    INTERPOLATION_REGULAR_START,
    INTERPOLATION_VERBATIM_START,
    INTERPOLATION_RAW_START,
    INTERPOLATION_START_QUOTE,
    INTERPOLATION_END_QUOTE,
    INTERPOLATION_OPEN_BRACE,
    INTERPOLATION_CLOSE_BRACE,
    INTERPOLATION_STRING_CONTENT,
    RAW_STRING_START,
    RAW_STRING_END,
    RAW_STRING_CONTENT,
    IMPLICIT_DOT,
    IMPLICIT_PAREN,
    IMPLICIT_BRACKET,
    IMPLICIT_QUESTION,
    RAW_SCRIPT_TEXT,
    RAW_STYLE_TEXT,
    RAZOR_EVENT_NAME,
    TYPEPARAM_WHERE,
};

typedef enum {
    REGULAR = 1 << 0,
    VERBATIM = 1 << 1,
    RAW = 1 << 2,
} StringType;

typedef struct {
    uint8_t dollar_count;
    uint8_t open_brace_count;
    uint8_t quote_count;
    StringType string_type;
} Interpolation;

static inline bool is_regular(Interpolation *interpolation) { return interpolation->string_type & REGULAR; }

static inline bool is_verbatim(Interpolation *interpolation) { return interpolation->string_type & VERBATIM; }

static inline bool is_raw(Interpolation *interpolation) { return interpolation->string_type & RAW; }

typedef struct {
    uint8_t quote_count;
    Array(Interpolation) interpolation_stack;
} Scanner;

static inline void advance(TSLexer *lexer) { lexer->advance(lexer, false); }

static inline void skip(TSLexer *lexer) { lexer->advance(lexer, true); }

void *tree_sitter_razor_external_scanner_create() {
    Scanner *scanner = ts_calloc(1, sizeof(Scanner));
    array_init(&scanner->interpolation_stack);
    return scanner;
}

void tree_sitter_razor_external_scanner_destroy(void *payload) {
    Scanner *scanner = (Scanner *)payload;
    array_delete(&scanner->interpolation_stack);
    ts_free(scanner);
}

unsigned tree_sitter_razor_external_scanner_serialize(void *payload, char *buffer) {
    Scanner *scanner = (Scanner *)payload;

    if (scanner->interpolation_stack.size * 4 + 2 > TREE_SITTER_SERIALIZATION_BUFFER_SIZE) {
        return 0;
    }

    unsigned size = 0;

    buffer[size++] = (char)scanner->quote_count;
    buffer[size++] = (char)scanner->interpolation_stack.size;

    for (unsigned i = 0; i < scanner->interpolation_stack.size; i++) {
        Interpolation interpolation = scanner->interpolation_stack.contents[i];
        buffer[size++] = (char)interpolation.dollar_count;
        buffer[size++] = (char)interpolation.open_brace_count;
        buffer[size++] = (char)interpolation.quote_count;
        buffer[size++] = (char)interpolation.string_type;
    }

    return size;
}

void tree_sitter_razor_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {
    Scanner *scanner = (Scanner *)payload;

    scanner->quote_count = 0;
    array_clear(&scanner->interpolation_stack);
    unsigned size = 0;

    if (length > 0) {
        scanner->quote_count = (unsigned char)buffer[size++];
        scanner->interpolation_stack.size = (unsigned char)buffer[size++];
        array_reserve(&scanner->interpolation_stack, scanner->interpolation_stack.size);

        for (unsigned i = 0; i < scanner->interpolation_stack.size; i++) {
            Interpolation interpolation = {0};
            interpolation.dollar_count = buffer[size++];
            interpolation.open_brace_count = buffer[size++];
            interpolation.quote_count = buffer[size++];
            interpolation.string_type = (unsigned char)buffer[size++];
            scanner->interpolation_stack.contents[i] = interpolation;
        }
    }

    assert(size == length);
}

// The most characters the closing-bracket lookahead reads before it gives up and treats the
// bracket as unclosed, so a long line of unclosed brackets costs a bounded amount per bracket
// instead of the rest of the line each time.
#define INDEX_LOOKAHEAD_LIMIT 4096

// Moves past a string or char literal whose opening quote is the lookahead, honoring backslash
// escapes and counting the characters read in `*budget`. Reports false when the line ends or the
// budget runs out before the closing quote.
static bool skip_quoted(TSLexer *lexer, int *budget) {
    int32_t quote = lexer->lookahead;
    advance(lexer);
    while (lexer->lookahead != 0 && lexer->lookahead != '\n' && lexer->lookahead != '\r') {
        if (--*budget < 0) {
            return false;
        }
        if (lexer->lookahead == '\\') {
            advance(lexer);
            if (lexer->lookahead == 0 || lexer->lookahead == '\n' || lexer->lookahead == '\r') {
                return false;
            }
        } else if (lexer->lookahead == quote) {
            advance(lexer);
            return true;
        }
        advance(lexer);
    }
    return false;
}

// After the `[` of a possible index, reports whether a matching `]` closes it on the same line
// within INDEX_LOOKAHEAD_LIMIT characters, so prose such as `@name[` or `@name?[` with no closing
// bracket stays text. Brackets inside string and char literals do not count. The scan only moves
// the lexer's lookahead; the caller has already marked the end of its token.
static bool index_is_closed(TSLexer *lexer) {
    int depth = 1;
    int budget = INDEX_LOOKAHEAD_LIMIT;
    while (lexer->lookahead != 0 && lexer->lookahead != '\n' && lexer->lookahead != '\r') {
        if (--budget < 0) {
            return false;
        }
        if (lexer->lookahead == '"' || lexer->lookahead == '\'') {
            if (!skip_quoted(lexer, &budget)) {
                return false;
            }
            continue;
        }
        if (lexer->lookahead == '[') {
            depth++;
        } else if (lexer->lookahead == ']' && --depth == 0) {
            return true;
        }
        advance(lexer);
    }
    return false;
}

// Scans the continuation of a Razor implicit expression (`@a.b(c)[0]`, `@a?.b`). Each token
// must begin exactly where the previous one ended, so no whitespace is skipped, and a `.` or `?`
// only counts when what follows shows it belongs to the expression: `@a. b`, `@a.@b`, and
// `@a? b` end the expression and leave the punctuation to the surrounding text.
static bool scan_implicit_continuation(TSLexer *lexer, const bool *valid_symbols, bool *consumed) {
    int32_t c = lexer->lookahead;
    // Inside a script or style element a failed continuation resumes the raw text scan from the
    // lexer's position, so the closing-bracket lookahead (which reads on to the end of the line)
    // would swallow an end tag; the index is accepted there as before.
    bool in_raw_text = valid_symbols[RAW_SCRIPT_TEXT] || valid_symbols[RAW_STYLE_TEXT];
    // Right after a `?` only `.` and `[` can continue the expression, and the `?` token already
    // ran the closing-bracket check (or skipped it inside raw text), so that `[` is not checked
    // again: a second check there would reject an index the exemption above accepted.
    bool after_question = !valid_symbols[IMPLICIT_PAREN];

    if (c == '(' && valid_symbols[IMPLICIT_PAREN]) {
        advance(lexer);
        lexer->result_symbol = IMPLICIT_PAREN;
        return true;
    }

    if (c == '[' && valid_symbols[IMPLICIT_BRACKET]) {
        advance(lexer);
        lexer->mark_end(lexer);
        *consumed = true;
        if (!in_raw_text && !after_question && !index_is_closed(lexer)) {
            return false;
        }
        lexer->result_symbol = IMPLICIT_BRACKET;
        return true;
    }

    if (c == '.' && valid_symbols[IMPLICIT_DOT]) {
        advance(lexer);
        *consumed = true;
        lexer->mark_end(lexer);
        if (lexer->lookahead == '_' || iswalpha(lexer->lookahead)) {
            lexer->result_symbol = IMPLICIT_DOT;
            return true;
        }
        return false;
    }

    if (c == '?' && valid_symbols[IMPLICIT_QUESTION]) {
        // `?.` followed by a name continues the expression; the `?` is the token and the `.`
        // is left for the next one. A lone `?` is text.
        advance(lexer);
        *consumed = true;
        lexer->mark_end(lexer);
        if (lexer->lookahead == '[') {
            advance(lexer);
            if (!in_raw_text && !index_is_closed(lexer)) {
                return false;
            }
            lexer->result_symbol = IMPLICIT_QUESTION;
            return true;
        }
        if (lexer->lookahead != '.') {
            return false;
        }
        advance(lexer);
        if (lexer->lookahead == '_' || iswalpha(lexer->lookahead)) {
            lexer->result_symbol = IMPLICIT_QUESTION;
            return true;
        }
        return false;
    }

    return false;
}

// Scans the raw text of a `script` or `style` element: everything up to, but not including, the
// matching end tag (`</script` or `</style`, any case, followed by whitespace, `/` or `>`), or a
// Razor `@` transition, which the grammar parses as code. An `@` between two letters or digits is
// part of the text (an email address), the same as in markup text. The token is left out when
// there is no content before the stopping point. `consumed` says that a failed continuation scan
// already read characters, which then belong to the token as content.
static bool scan_raw_text(TSLexer *lexer, const char *tag, enum TokenType symbol, bool consumed) {
    bool has_content = consumed;
    int32_t previous = 0;
    lexer->mark_end(lexer);
    while (lexer->lookahead != 0) {
        if (lexer->lookahead == '@') {
            if (iswalnum(previous)) {
                advance(lexer);
                if (iswalnum(lexer->lookahead)) {
                    lexer->mark_end(lexer);
                    previous = '@';
                    continue;
                }
            }
            // The token ends before the `@`, where the last mark was left.
            if (!has_content) {
                return false;
            }
            lexer->result_symbol = symbol;
            return true;
        }
        if (lexer->lookahead != '<') {
            previous = lexer->lookahead;
            advance(lexer);
            lexer->mark_end(lexer);
            has_content = true;
            continue;
        }
        // Candidate end tag: the token ends before this `<` when it turns out to be one.
        advance(lexer);
        if (lexer->lookahead == '/') {
            advance(lexer);
            const char *c = tag;
            while (*c != '\0' && towlower(lexer->lookahead) == *c) {
                advance(lexer);
                c++;
            }
            if (*c == '\0' && (lexer->lookahead == '>' || lexer->lookahead == '/' ||
                               iswspace(lexer->lookahead))) {
                if (!has_content) {
                    return false;
                }
                lexer->result_symbol = symbol;
                return true;
            }
        }
        // Not an end tag: the characters just read are content.
        previous = 0;
        lexer->mark_end(lexer);
        has_content = true;
    }
    if (!has_content) {
        return false;
    }
    lexer->result_symbol = symbol;
    return true;
}

// Scans the name of a directive event attribute (`@onclick`, `@onsubmit:preventDefault`): `on`
// and letters. It is a name only when `=` or `:` follows, so `@onlineStatus` in an attribute
// position stays an expression; the name ends before that character. Whitespace, line breaks
// included, may sit between the name and the `=`, as HTML allows around an attribute's equals
// sign.
static bool is_blank(int32_t c);

static bool scan_event_name(TSLexer *lexer) {
    if (towlower(lexer->lookahead) != 'o') {
        return false;
    }
    advance(lexer);
    if (towlower(lexer->lookahead) != 'n') {
        return false;
    }
    advance(lexer);
    int letters = 0;
    while (lexer->lookahead < 128 && isalpha(lexer->lookahead)) {
        advance(lexer);
        letters++;
    }
    lexer->mark_end(lexer);
    if (letters == 0) {
        return false;
    }
    if (lexer->lookahead != ':') {
        while (is_blank(lexer->lookahead) || lexer->lookahead == '\n' || lexer->lookahead == '\r') {
            advance(lexer);
        }
        if (lexer->lookahead != '=') {
            return false;
        }
    }
    lexer->result_symbol = RAZOR_EVENT_NAME;
    return true;
}

static bool is_blank(int32_t c) { return c == ' ' || c == '\t'; }

static bool is_name_start(int32_t c) { return c == '_' || c == '@' || iswalpha(c) || c >= 128; }

static bool is_name_part(int32_t c) { return c == '_' || iswalnum(c) || c >= 128; }

// Moves past blanks and same-line block comments (`where /* c */ T : class`), reporting whether
// at least one was found. A `/` that does not start a comment, or a comment that is not closed on
// the line, sets `*malformed`: the lookahead is then left inside it and the caller must reject.
static bool skip_blanks_and_comments(TSLexer *lexer, bool *malformed) {
    bool found = false;
    for (;;) {
        if (is_blank(lexer->lookahead)) {
            found = true;
            advance(lexer);
            continue;
        }
        if (lexer->lookahead != '/') {
            return found;
        }
        advance(lexer);
        if (lexer->lookahead != '*') {
            *malformed = true;
            return false;
        }
        advance(lexer);
        bool star = false;
        while (lexer->lookahead != 0 && lexer->lookahead != '\n' && lexer->lookahead != '\r') {
            if (star && lexer->lookahead == '/') {
                break;
            }
            star = lexer->lookahead == '*';
            advance(lexer);
        }
        if (lexer->lookahead != '/') {
            *malformed = true;
            return false;
        }
        advance(lexer);
        found = true;
    }
}

static bool is_hex_digit(int32_t c) {
    return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
}

// Moves past a `\uXXXX` or `\UXXXXXXXX` escape inside a name; the lookahead is on the backslash.
static bool skip_unicode_escape(TSLexer *lexer) {
    advance(lexer);
    int digits;
    if (lexer->lookahead == 'u') {
        digits = 4;
    } else if (lexer->lookahead == 'U') {
        digits = 8;
    } else {
        return false;
    }
    advance(lexer);
    for (int i = 0; i < digits; i++) {
        if (!is_hex_digit(lexer->lookahead)) {
            return false;
        }
        advance(lexer);
    }
    return true;
}

// Scans the `where` keyword of a type parameter constraint clause. It is the keyword only when a
// name and a colon follow on the same line (`where TItem : class`), as a directive ends at its line
// break, so a line of text that starts with the word `where` is not mistaken for it. Same-line
// block comments may sit between the parts, and the name may hold `\uXXXX` escapes. The token
// ends after the keyword.
static bool scan_typeparam_where(TSLexer *lexer) {
    while (is_blank(lexer->lookahead)) {
        skip(lexer);
    }
    const char *word = "where";
    for (const char *c = word; *c != '\0'; c++) {
        if (lexer->lookahead != *c) {
            return false;
        }
        advance(lexer);
    }
    lexer->mark_end(lexer);
    bool malformed = false;
    if (!skip_blanks_and_comments(lexer, &malformed) || malformed) {
        return false;
    }
    if (lexer->lookahead == '\\') {
        if (!skip_unicode_escape(lexer)) {
            return false;
        }
    } else if (is_name_start(lexer->lookahead)) {
        advance(lexer);
    } else {
        return false;
    }
    for (;;) {
        if (lexer->lookahead == '\\') {
            if (!skip_unicode_escape(lexer)) {
                return false;
            }
        } else if (is_name_part(lexer->lookahead)) {
            advance(lexer);
        } else {
            break;
        }
    }
    skip_blanks_and_comments(lexer, &malformed);
    if (malformed || lexer->lookahead != ':') {
        return false;
    }
    lexer->result_symbol = TYPEPARAM_WHERE;
    return true;
}

bool tree_sitter_razor_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid_symbols) {
    Scanner *scanner = (Scanner *)payload;

    uint8_t brace_advanced = 0;
    uint8_t quote_count = 0;
    bool did_advance = false;
    bool consumed = false;

    // error recovery, gives better trees this way
    if (valid_symbols[OPT_SEMI] && valid_symbols[INTERPOLATION_REGULAR_START]) {
        return false;
    }

    if (valid_symbols[RAZOR_EVENT_NAME]) {
        return scan_event_name(lexer);
    }

    if (valid_symbols[TYPEPARAM_WHERE]) {
        return scan_typeparam_where(lexer);
    }

    if (valid_symbols[IMPLICIT_DOT] || valid_symbols[IMPLICIT_PAREN] ||
        valid_symbols[IMPLICIT_BRACKET] || valid_symbols[IMPLICIT_QUESTION]) {
        // After an implicit expression inside a script or style element, the text that follows
        // it is raw text, so a failed continuation falls through to the raw text scan.
        if (scan_implicit_continuation(lexer, valid_symbols, &consumed)) {
            return true;
        }
        if (!valid_symbols[RAW_SCRIPT_TEXT] && !valid_symbols[RAW_STYLE_TEXT]) {
            return false;
        }
    }

    if (valid_symbols[RAW_SCRIPT_TEXT]) {
        return scan_raw_text(lexer, "script", RAW_SCRIPT_TEXT, consumed);
    }

    if (valid_symbols[RAW_STYLE_TEXT]) {
        return scan_raw_text(lexer, "style", RAW_STYLE_TEXT, consumed);
    }

    if (valid_symbols[OPT_SEMI]) {
        lexer->result_symbol = OPT_SEMI;
        if (lexer->lookahead == ';') {
            advance(lexer);
        }
        return true;
    }

    if (valid_symbols[RAW_STRING_START]) {
        while (iswspace(lexer->lookahead)) {
            skip(lexer);
        }

        if (lexer->lookahead == '"') {
            while (lexer->lookahead == '"') {
                advance(lexer);
                quote_count++;
            }

            if (quote_count >= 3) {
                lexer->result_symbol = RAW_STRING_START;
                scanner->quote_count = quote_count;
                return true;
            }
        }
    }

    if (valid_symbols[RAW_STRING_END] && lexer->lookahead == '"') {
        while (lexer->lookahead == '"') {
            advance(lexer);
            quote_count++;
        }

        if (quote_count == scanner->quote_count) {
            lexer->result_symbol = RAW_STRING_END;
            scanner->quote_count = 0;
            return true;
        }

        did_advance = quote_count > 0;
    }

    if (valid_symbols[RAW_STRING_CONTENT]) {
        while (lexer->lookahead) {
            if (lexer->lookahead == '"') {
                lexer->mark_end(lexer);
                quote_count = 0;

                while (lexer->lookahead == '"') {
                    advance(lexer);
                    quote_count++;
                }

                if (quote_count == scanner->quote_count) {
                    lexer->result_symbol = RAW_STRING_CONTENT;
                    return true;
                }
            }
            advance(lexer);
            did_advance = true;
        }
        lexer->mark_end(lexer);
        lexer->result_symbol = RAW_STRING_CONTENT;
        return true;
    }

    if (valid_symbols[INTERPOLATION_REGULAR_START] || valid_symbols[INTERPOLATION_VERBATIM_START] ||
        valid_symbols[INTERPOLATION_RAW_START]) {
        while (iswspace(lexer->lookahead)) {
            skip(lexer);
        }

        uint8_t dollar_advanced = 0;

        bool is_verbatim = false;

        if (lexer->lookahead == '@') {
            is_verbatim = true;
            advance(lexer);
        }

        while (lexer->lookahead == '$' && quote_count == 0) {
            advance(lexer);
            dollar_advanced++;
        }

        if (dollar_advanced > 0 && (lexer->lookahead == '"' || lexer->lookahead == '@')) {
            lexer->result_symbol = INTERPOLATION_REGULAR_START;
            Interpolation interpolation = {
                .dollar_count = dollar_advanced,
                .open_brace_count = 0,
                .quote_count = 0,
                .string_type = 0,
            };

            if (is_verbatim || lexer->lookahead == '@') {
                if (lexer->lookahead == '@') {
                    advance(lexer);
                    is_verbatim = true;
                }
                lexer->result_symbol = INTERPOLATION_VERBATIM_START;
                interpolation.string_type = VERBATIM;
            }

            lexer->mark_end(lexer);
            advance(lexer);

            if (lexer->lookahead == '"' && !is_verbatim) {
                advance(lexer);
                if (lexer->lookahead == '"') {
                    lexer->result_symbol = INTERPOLATION_RAW_START;
                    interpolation.string_type |= RAW;
                    array_push(&scanner->interpolation_stack, interpolation);
                }
                // If we find 1 or 3 quotes, we push an interpolation.
                // If there's only two quotes, that's just an empty string
            } else {
                interpolation.string_type |= REGULAR;
                array_push(&scanner->interpolation_stack, interpolation);
            }

            return true;
        }
    }

    if (valid_symbols[INTERPOLATION_START_QUOTE] && scanner->interpolation_stack.size > 0) {
        Interpolation *current_interpolation = array_back(&scanner->interpolation_stack);

        if (is_verbatim(current_interpolation) || is_regular(current_interpolation)) {
            if (lexer->lookahead == '"') {
                advance(lexer);
                current_interpolation->quote_count++;
            }
        } else {
            while (lexer->lookahead == '"') {
                advance(lexer);
                current_interpolation->quote_count++;
            }
        }

        lexer->result_symbol = INTERPOLATION_START_QUOTE;
        return current_interpolation->quote_count > 0;
    }

    if (valid_symbols[INTERPOLATION_END_QUOTE] && scanner->interpolation_stack.size > 0) {
        Interpolation *current_interpolation = array_back(&scanner->interpolation_stack);

        while (lexer->lookahead == '"') {
            advance(lexer);
            quote_count++;
        }

        if (quote_count == current_interpolation->quote_count) {
            lexer->result_symbol = INTERPOLATION_END_QUOTE;
            array_pop(&scanner->interpolation_stack);
            return true;
        }

        did_advance = quote_count > 0;
    }

    if (valid_symbols[INTERPOLATION_OPEN_BRACE] && scanner->interpolation_stack.size > 0) {
        Interpolation *current_interpolation = array_back(&scanner->interpolation_stack);

        while (lexer->lookahead == '{' && brace_advanced < current_interpolation->dollar_count) {
            advance(lexer);
            brace_advanced++;
        }

        if (brace_advanced > 0 && brace_advanced == current_interpolation->dollar_count &&
            (brace_advanced == 0 || lexer->lookahead != '{')) {
            current_interpolation->open_brace_count = brace_advanced;
            lexer->result_symbol = INTERPOLATION_OPEN_BRACE;
            return true;
        }
    }

    if (valid_symbols[INTERPOLATION_CLOSE_BRACE] && scanner->interpolation_stack.size > 0) {
        uint8_t brace_advanced = 0;
        Interpolation *current_interpolation = array_back(&scanner->interpolation_stack);

        while (iswspace(lexer->lookahead)) {
            advance(lexer);
        }

        while (lexer->lookahead == '}') {
            advance(lexer);
            brace_advanced++;

            if (brace_advanced == current_interpolation->open_brace_count) {
                current_interpolation->open_brace_count = 0;
                lexer->result_symbol = INTERPOLATION_CLOSE_BRACE;
                return true;
            }
        }

        return false;
    }

    if (valid_symbols[INTERPOLATION_STRING_CONTENT] && scanner->interpolation_stack.size > 0) {
        lexer->result_symbol = INTERPOLATION_STRING_CONTENT;
        Interpolation *current_interpolation = array_back(&scanner->interpolation_stack);

        while (lexer->lookahead) {
            // top-down approach, first see if it's raw
            if (is_raw(current_interpolation)) {
                if (lexer->lookahead == '"') {
                    lexer->mark_end(lexer);
                    advance(lexer);
                    if (lexer->lookahead == '"') {
                        advance(lexer);
                        uint8_t quote_advanced = 2;
                        while (lexer->lookahead == '"') {
                            quote_advanced++;
                            advance(lexer);
                        }
                        if (quote_advanced == current_interpolation->quote_count) {
                            return did_advance;
                        }
                    }
                }

                if (lexer->lookahead == '{') {
                    lexer->mark_end(lexer);

                    while (lexer->lookahead == '{' && brace_advanced < current_interpolation->open_brace_count) {
                        advance(lexer);
                        brace_advanced++;
                    }

                    if (brace_advanced == current_interpolation->open_brace_count &&
                        (brace_advanced == 0 || lexer->lookahead != '{')) {
                        return did_advance;
                    }
                }
            }

            // then verbatim, since it could be verbatim + raw, but run the raw branch first
            else if (is_verbatim(current_interpolation)) {
                if (lexer->lookahead == '"') {
                    lexer->mark_end(lexer);
                    advance(lexer);
                    if (lexer->lookahead == '"') {
                        advance(lexer);
                        continue;
                    }
                    return did_advance;
                }

                if (lexer->lookahead == '{') {
                    lexer->mark_end(lexer);

                    while (lexer->lookahead == '{' && brace_advanced < current_interpolation->open_brace_count) {
                        advance(lexer);
                        brace_advanced++;
                    }

                    if (brace_advanced == current_interpolation->open_brace_count &&
                        (brace_advanced == 0 || lexer->lookahead != '{')) {
                        return did_advance;
                    }
                }
            }

            // finally regular
            else if (is_regular(current_interpolation)) {
                if (lexer->lookahead == '\\' || lexer->lookahead == '\n' || lexer->lookahead == '"') {
                    lexer->mark_end(lexer);
                    return did_advance;
                }

                if (lexer->lookahead == '{') {
                    lexer->mark_end(lexer);

                    while (lexer->lookahead == '{' && brace_advanced < current_interpolation->open_brace_count) {
                        advance(lexer);
                        brace_advanced++;
                    }

                    if (brace_advanced == current_interpolation->open_brace_count &&
                        (brace_advanced == 0 || lexer->lookahead != '{')) { // if we're in a brace we're not allowed to
                                                                            // collect more than the open_brace_count
                        return did_advance;
                    }
                }
            }

            if (lexer->lookahead != '{') {
                brace_advanced = 0;
            }
            advance(lexer);
            did_advance = true;
        }

        lexer->mark_end(lexer);
        return did_advance;
    }

    return false;
}
