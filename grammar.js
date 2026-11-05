/**
 * @file Razor grammar for tree-sitter
 * @author Tristan Knight <admin@snappeh.com>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

import CSHARP from 'tree-sitter-c-sharp/grammar.js';

/**
 * Zero or more comma-separated items.
 * @param {RuleOrLiteral} rule
 */
function commaSep(rule) {
  return optional(commaSep1(rule));
}

/**
 * One or more comma-separated items.
 * @param {RuleOrLiteral} rule
 */
function commaSep1(rule) {
  return seq(rule, repeat(seq(',', rule)));
}

/**
 * The attributes and embedded expressions between an element's tag name and its closing `>`.
 * @param {GrammarSymbols<string>} $
 */
function elementAttributes($) {
  return repeat(
    prec.left(
      seq(
        choice(
          $._html_attribute,
          $.razor_html_attribute,
          $.razor_explicit_expression,
          $.razor_implicit_expression,
        ),
        optional(' '),
      ),
    ),
  );
}

/**
 * The rest of the file after its first node or text run: nodes and text, optionally ending in a
 * `@using` or `@inject` directive (which then carries the remainder itself).
 * @param {GrammarSymbols<string>} $
 */
function bodyRest($) {
  return seq(repeat(choice($._node, $._html_text)), optional($._late_directive));
}

export default grammar(CSHARP, {
  name: 'razor',

  externals: ($, original) =>
    original.concat([
      $._implicit_dot,
      $._implicit_paren,
      $._implicit_bracket,
      $._implicit_question,
      $._raw_script_text,
      $._raw_style_text,
      $._razor_event_name,
    ]),

  extras: ($) => [$.razor_comment, $.comment, /\s+/],

  conflicts: ($, o) => [
    [
      $.preproc_if,
      $.preproc_if_in_top_level,
      $.preproc_if_in_expression,
      $.preproc_if_in_attribute_list,
    ],
    [$.preproc_if, $.preproc_if_in_top_level],
    [$.preproc_if, $.preproc_if_in_top_level, $.preproc_if_in_expression],
    [$.preproc_if, $.preproc_if_in_top_level, $.preproc_if_in_attribute_list],
    [
      $.preproc_else,
      $.preproc_else_in_top_level,
      $.preproc_else_in_expression,
      $.preproc_else_in_attribute_list,
    ],
    [$.declaration, $.preproc_if_in_top_level],
    [$.type_declaration, $.declaration],
    [$.method_declaration, $._local_function_declaration],
    [$.declaration, $.preproc_else_in_top_level],
    [
      $.preproc_elif,
      $.preproc_elif_in_top_level,
      $.preproc_elif_in_expression,
      $.preproc_elif_in_attribute_list,
    ],

    [$.destructor_declaration, $._simple_name],

    [$.field_declaration, $.local_declaration_statement],
    ...o,
  ],

  rules: {
    compilation_unit: ($) =>
      seq(
        repeat(
          choice(
            $.shebang_directive, // this is to make sharing highlights easier
            $.razor_page_directive,
            $.razor_using_directive,
            $.razor_model_directive,
            $.razor_rendermode_directive,
            $.razor_inject_directive,
            $.razor_implements_directive,
            $.razor_layout_directive,
            $.razor_inherits_directive,
            $.razor_attribute_directive,
            $.razor_typeparam_directive,
            $.razor_namespace_directive,
            $.razor_preservewhitespace_directive,
            $.razor_addtaghelper_directive,
            $.razor_removetaghelper_directive,
            $.razor_taghelperprefix_directive,
          ),
        ),
        // A leading text run must start with a letter or digit, so it cannot compete with the
        // string that `@page` optionally takes or with the end of a directive's name.
        optional(seq(choice($._node, $._html_text_start), bodyRest($))),
      ),

    // `@using` and `@inject` may also appear after the first node. Text directly after one of
    // them has to start with a letter or digit, for the same reason as the first text run: a
    // text run starting with `.` would otherwise take the rest of a dotted name.
    _late_directive: ($) =>
      seq(
        choice($.razor_using_directive, $.razor_inject_directive),
        optional(choice($._late_directive, seq(choice($._node, $._html_text_start), bodyRest($)))),
      ),

    _identifier_token: (_) =>
      token(
        // @ts-ignore
        /(\p{XID_Start}|_|\\u[0-9A-Fa-f]{4}|\\U[0-9A-Fa-f]{8})(\p{XID_Continue}|\\u[0-9A-Fa-f]{4}|\\U[0-9A-Fa-f]{8})*/,
      ),
    identifier: ($) => choice($._identifier_token, $._reserved_identifier),

    _csharp_nodes: ($) =>
      choice(
        $.statement,
        $._node,

        $.preproc_region,
        $.preproc_endregion,
        $.preproc_line,
        $.preproc_pragma,
        $.preproc_nullable,
        $.preproc_error,
        $.preproc_warning,
        $.preproc_define,
        $.preproc_undef,
      ),

    block: ($) => seq('{', repeat($._csharp_nodes), '}'),

    _node: ($) =>
      prec.right(
        choice(
          $.razor_comment,
          $.razor_escape,
          $.razor_if,
          $.razor_switch,
          $.razor_for,
          $.razor_foreach,
          $.razor_while,
          $.razor_do_while,
          $.razor_try,
          $.explicit_line_transition,
          $.razor_implicit_expression,
          $.razor_explicit_expression,
          $.razor_section,
          $.razor_block,
          $.razor_compound_using,
          $.razor_lock,
          $.element,
          $.html_comment,
          $.html_doctype,
        ),
      ),

    _razor_marker: (_) => token('@'),

    razor_escape: ($) => seq(alias(/@{2}/, 'at_at_escape'), alias($._html_text, $.element)),

    razor_page_directive: ($) =>
      seq(alias(seq($._razor_marker, 'page'), 'at_page'), optional($.string_literal)),
    razor_using_directive: ($) =>
      seq(
        alias(seq($._razor_marker, 'using'), 'at_using'),
        choice(
          seq(optional('unsafe'), field('name', $.identifier), '=', $.type),
          seq(optional('static'), optional('unsafe'), $._name),
        ),
      ),
    razor_model_directive: ($) =>
      seq(alias(seq($._razor_marker, 'model'), 'at_model'), field('name', $._name)),
    razor_preservewhitespace_directive: ($) =>
      seq(
        alias(seq($._razor_marker, 'preservewhitespace'), 'at_preservewhitespace'),
        $.boolean_literal,
      ),
    razor_attribute_directive: ($) =>
      seq(alias(seq($._razor_marker, 'attribute'), 'at_attribute'), $.attribute_list),
    razor_implements_directive: ($) =>
      seq(alias(seq($._razor_marker, 'implements'), 'at_implements'), field('name', $._name)),
    razor_layout_directive: ($) =>
      seq(alias(seq($._razor_marker, 'layout'), 'at_layout'), field('name', $._name)),
    razor_inherits_directive: ($) =>
      seq(alias(seq($._razor_marker, 'inherits'), 'at_inherits'), field('name', $._name)),
    razor_typeparam_directive: ($) =>
      seq(
        alias(seq($._razor_marker, 'typeparam'), 'at_typeparam'),
        field('name', $._name),
        repeat(alias($._typeparam_constraints_clause, $.type_parameter_constraints_clause)),
      ),
    // A `where` clause on a type parameter. Its keyword outranks the text that may follow a
    // directive, which would otherwise take the whole line as text because it matches more.
    _typeparam_constraints_clause: ($) =>
      seq(token(prec(3, 'where')), $.identifier, ':', commaSep1($.type_parameter_constraint)),
    razor_inject_directive: ($) =>
      seq(alias(seq($._razor_marker, 'inject'), 'at_inject'), $.variable_declaration),
    razor_namespace_directive: ($) =>
      seq(alias(seq($._razor_marker, 'namespace'), 'at_namespace'), $._name),
    razor_rendermode_directive: ($) =>
      seq(
        alias(seq($._razor_marker, 'rendermode'), 'at_rendermode'),
        choice($.razor_rendermode, $._name, $.razor_explicit_expression),
      ),
    razor_rendermode: (_) =>
      choice('InteractiveServer', 'InteractiveWebAssembly', 'InteractiveAuto'),

    _taghelper_target: ($) =>
      seq(choice($.identifier, alias('*', $.taghelper_wildcard)), ',', field('assembly', $._name)),
    razor_addtaghelper_directive: ($) =>
      seq(
        alias(seq($._razor_marker, 'addTagHelper'), 'at_addtaghelper'),
        choice($.string_literal, $._taghelper_target),
      ),
    razor_removetaghelper_directive: ($) =>
      seq(
        alias(seq($._razor_marker, 'removeTagHelper'), 'at_removetaghelper'),
        choice($.string_literal, $._taghelper_target),
      ),
    razor_taghelperprefix_directive: ($) =>
      seq(
        alias(seq($._razor_marker, 'tagHelperPrefix'), 'at_taghelperprefix'),
        choice($.string_literal, $.identifier),
      ),

    razor_block: ($) =>
      prec.left(
        seq(
          alias(seq($._razor_marker, optional(choice('code', 'functions'))), 'at_block'),
          '{',
          repeat(choice($.declaration, seq($.statement), $._node)),
          '}',
        ),
      ),

    razor_explicit_expression: ($) =>
      prec.right(
        seq(
          alias($._razor_marker, 'at_explicit'),
          prec.right(
            choice(
              $.parenthesized_expression,
              alias($._parenthesized_lvalue_expression, $.parenthesized_expression),
            ),
          ),
        ),
      ),

    // An implicit expression ends at the first character that cannot continue a member,
    // call, or index chain, so every continuation token is immediate: `@a.b(c)[0]` is one
    // expression, while `@a. b`, `@a (b)`, and `@a.@b` leave the trailing text outside it.
    razor_implicit_expression: ($) =>
      seq(alias($._razor_marker, 'at_implicit'), $._implicit_expression),

    _implicit_expression: ($) =>
      choice($._implicit_chain, $.boolean_literal, alias($._implicit_await, $.await_expression)),

    _implicit_await: ($) => seq('await', $._implicit_chain),

    _implicit_chain: ($) =>
      choice(
        $.identifier,
        'this',
        alias($._implicit_member, $.member_access_expression),
        alias($._implicit_conditional_access, $.conditional_access_expression),
        alias($._implicit_invocation, $.invocation_expression),
        alias($._implicit_index, $.element_access_expression),
      ),

    _implicit_identifier: (_) =>
      token.immediate(
        /(\p{XID_Start}|_|\\u[0-9A-Fa-f]{4}|\\U[0-9A-Fa-f]{8})(\p{XID_Continue}|\\u[0-9A-Fa-f]{4}|\\U[0-9A-Fa-f]{8})*/,
      ),

    _implicit_member_name: ($) => alias($._implicit_identifier, $.identifier),

    _implicit_member: ($) =>
      seq(
        field('expression', $._implicit_chain),
        alias($._implicit_dot, '.'),
        field('name', $._implicit_member_name),
      ),

    // `@a?.b`: the `?` is scanned only when a `.` and a name follow it directly. Razor does not
    // allow generic type arguments in an implicit expression, so `@a<b>(c)` leaves `<b>` as a tag.
    _implicit_member_binding: ($) =>
      seq(alias($._implicit_dot, '.'), field('name', $._implicit_member_name)),

    _implicit_conditional_access: ($) =>
      seq(
        field('condition', $._implicit_chain),
        alias($._implicit_question, '?'),
        alias($._implicit_member_binding, $.member_binding_expression),
      ),

    _implicit_argument_list: ($) => seq(alias($._implicit_paren, '('), commaSep($.argument), ')'),

    _implicit_invocation: ($) =>
      seq(
        field('function', $._implicit_chain),
        field('arguments', alias($._implicit_argument_list, $.argument_list)),
      ),

    _implicit_subscript: ($) => seq(alias($._implicit_bracket, '['), commaSep1($.argument), ']'),

    _implicit_index: ($) =>
      seq(
        field('expression', $._implicit_chain),
        field('subscript', alias($._implicit_subscript, $.bracketed_argument_list)),
      ),

    razor_lock: ($) =>
      seq(
        alias(seq($._razor_marker, 'lock'), 'at_lock'),
        '(',
        $.expression,
        ')',
        '{',
        $._blended_content,
        '}',
      ),

    razor_compound_using: ($) =>
      seq(
        alias(seq($._razor_marker, 'using'), 'at_using'),
        '(',
        choice(alias($.using_variable_declaration, $.variable_declaration), $.expression),
        ')',
        '{',
        $._blended_content,
        '}',
      ),

    razor_if: ($) =>
      seq(
        alias(seq($._razor_marker, 'if'), 'at_if'),
        $.razor_condition,
        seq('{', $._blended_content, '}'),
        repeat(choice($.razor_else_if, $.razor_else)),
      ),

    razor_try: ($) =>
      prec.right(
        seq(
          alias(seq($._razor_marker, 'try'), 'at_try'),
          '{',
          $._blended_content,
          '}',
          repeat(choice($.razor_catch, $.razor_finally)),
        ),
      ),

    razor_catch: ($) =>
      seq(
        token(prec(10, 'catch')),
        repeat(choice($.catch_declaration, $.catch_filter_clause)),
        '{',
        $._blended_content,
        '}',
      ),

    razor_finally: ($) => seq(token(prec(10, 'finally')), '{', $._blended_content, '}'),

    razor_else_if: ($) =>
      seq(token(prec(10, 'else')), 'if', $.razor_condition, '{', $._blended_content, '}'),

    razor_else: ($) => seq(token(prec(10, 'else')), '{', $._blended_content, '}'),

    razor_switch: ($) =>
      seq(
        alias(seq($._razor_marker, 'switch'), 'at_switch'),
        $.razor_condition,
        '{',
        repeat(choice($.razor_switch_case, $.razor_switch_default)),
        '}',
      ),

    razor_condition: ($) => prec(10, seq('(', $.expression, ')')),

    razor_switch_case: ($) =>
      prec.left(
        seq('case', $.razor_case_condition, ':', optional($._blended_content), optional('break;')),
      ),

    razor_switch_default: ($) =>
      prec.right(seq('default', ':', optional($._blended_content), optional('break;'))),

    // A case label is a C# pattern with an optional `when` clause. A label with no body of its own
    // (`case 1:` directly followed by `case 2:`) shares the body of the label after it.
    razor_case_condition: ($) => seq($.pattern, optional($.when_clause)),

    _razor_for_initializer: ($) =>
      seq(
        alias(seq($._razor_marker, 'for'), 'at_for'),
        '(',
        field('initializer', optional(choice($.variable_declaration, $.expression))),
        ';',
        field('condition', optional($.expression)),
        ';',
        field('update', optional($.expression)),
        ')',
      ),

    razor_for: ($) => seq($._razor_for_initializer, '{', field('body', $._blended_content), '}'),

    _blended_content: ($) =>
      repeat1(prec(10, choice($._node, $.explicit_line_transition, $.statement, $.comment))),

    _razor_foreach_initializer: ($) =>
      seq(
        alias(seq($._razor_marker, 'foreach'), 'at_foreach'),
        '(',
        choice(
          seq(field('type', $.type), field('left', choice($.identifier, $.tuple_pattern))),
          field('left', $.expression),
        ),
        'in',
        field('right', $.expression),
        ')',
      ),

    razor_foreach: ($) =>
      seq($._razor_foreach_initializer, '{', field('body', $._blended_content), '}'),

    razor_while: ($) =>
      seq(
        alias(seq($._razor_marker, 'while'), 'at_while'),
        $.razor_condition,
        '{',
        $._blended_content,
        '}',
      ),

    _razor_while_condition: ($) => seq('while', $.razor_condition),

    razor_do_while: ($) =>
      seq(
        alias(seq($._razor_marker, 'do'), 'at_do'),
        '{',
        $._blended_content,
        '}',
        $._razor_while_condition,
        ';',
      ),

    razor_section: ($) =>
      seq(
        alias(seq($._razor_marker, 'section'), 'at_section'),
        $.identifier,
        '{',
        $._blended_content,
        '}',
      ),

    explicit_line_transition: ($) =>
      prec.left(
        seq(alias('@:', 'at_colon_transition'), alias(token(prec(1, /[^\n\r]+/)), $.element)),
      ),

    razor_comment: (_) => token(seq('@*', /[^*]*\*+([^@*][^*]*\*+)*/, '@')),
    razor_attribute_name: ($) =>
      seq(
        $._razor_marker,
        seq(
          choice(
            'attributes',
            'bind',
            // `@bind-Value` for a bound component parameter. The plain `bind` stays a keyword so a
            // longer identifier such as `@bindings` is still read whole as an expression.
            token(prec(10, /bind-[A-Za-z_][A-Za-z0-9_]*/)),
            'formname',
            // `@onclick` and the other event names: the scanner emits this only when `=` or `:` follows
            // the name, so an expression such as `@onlineStatus` is still read as an expression.
            $._razor_event_name,
            'key',
            'ref',
            'rendermode',
          ),
          optional($.razor_attribute_modifier),
        ),
      ),

    razor_attribute_modifier: (_) =>
      choice(
        ':culture',
        ':preventDefault',
        ':stopPropagation',
        ':event',
        ':format',
        ':after',
        ':get',
        ':set',
      ),

    // Ends at the first `-->`; a lone `->` or `--` inside the comment does not close it. The
    // abrupt forms `<!-->` and `<!--->` also close at once, as in a browser, so the body of the
    // longest alternative cannot start with `>` or `->`.
    html_comment: (_) =>
      token(
        choice(
          '<!-->',
          '<!--->',
          seq('<!--', /--+/, '>'),
          seq('<!--', /-*[^->]([^-]|-[^-]|--+[^->])*--+/, '>'),
        ),
      ),

    html_doctype: (_) => token(seq('<!', /[Dd][Oo][Cc][Tt][Yy][Pp][Ee]/, /[^>]*/, '>')),

    // HTML Base Definitions
    // The HTML void elements never have content or an end tag, so `<br>` and `<br />` are both
    // complete. Only the lowercase spelling is recognized so that a component such as `<Link>`
    // still takes an end tag.
    _void_tag_name: (_) =>
      token(prec(1, /area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr/)),

    // An explicit end tag on a void element (`<input></input>`, `<br></br>`) is accepted and
    // ignored. It is one token so that a parent's end tag, which also starts with `</`, is never
    // mistaken for it.
    _void_end_tag: (_) =>
      token(seq('</', /area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr/, /[ \t]*>/)),

    // The content of `script` and `style` is raw text up to the matching end tag, so a `<` in
    // inline JavaScript or CSS is not read as the start of a tag.
    _script_tag_name: (_) => token(prec(1, 'script')),
    _style_tag_name: (_) => token(prec(1, 'style')),

    // Same precedence as the void, script, and style names above, so a longer name that merely
    // starts with one of them (`colgroup`, `metadata`, `input-group`) is still read whole.
    _tag_name: (_) => token(prec(1, /[a-zA-Z0-9-:]+/)),
    _end_tag: ($) => seq('</', $._tag_name, '>'),
    _html_attribute_name: (_) => /[a-zA-Z0-9_:.\-]+/,
    _html_attribute_value: ($) =>
      choice(
        seq(
          '"',
          repeat(choice($.razor_explicit_expression, $.razor_implicit_expression, $._attr_text_dq)),
          '"',
        ),
        seq(
          "'",
          repeat(choice($.razor_explicit_expression, $.razor_implicit_expression, $._attr_text_sq)),
          "'",
        ),
        alias($._attr_text_unquoted, $.attribute_value_unquoted),
        $.razor_explicit_expression,
        $.razor_implicit_expression,
      ),
    // An `@` directly between two letters or digits is part of the text (an email address),
    // and `@@` is an escaped `@`; neither is a transition, so both are allowed inside these text
    // runs.
    _attr_text_dq: (_) => /([^"@]|@@|[\p{L}\p{N}]@[\p{L}\p{N}])+/,
    _attr_text_sq: (_) => /([^'@]|@@|[\p{L}\p{N}]@[\p{L}\p{N}])+/,
    _attr_text_unquoted: (_) => /([^\s"'=<>`@]|@@)+/,
    // Text runs stop at the end of a line so that a `//` comment on the next line is not
    // absorbed into the text before it.
    _html_text: (_) =>
      /([^<@\s]|[\p{L}\p{N}]@[\p{L}\p{N}])(([^<@\r\n]|[\p{L}\p{N}]@[\p{L}\p{N}])*([^<@\s]|[\p{L}\p{N}]@[\p{L}\p{N}]))?/,

    // The same text as `_html_text`, but it must start with a letter or digit. Directly after a
    // directive this keeps the text from taking a double quote (the `@page` string) or the
    // punctuation that continues a directive's name (`.`, `<`, `?`) away from it.
    _html_text_start: (_) =>
      /([\p{L}\p{N}]@[\p{L}\p{N}]|[\p{L}\p{N}])(([^<@\r\n]|[\p{L}\p{N}]@[\p{L}\p{N}])*([^<@\s]|[\p{L}\p{N}]@[\p{L}\p{N}]))?/,

    // Inside an element, `//` is ordinary text (a URL scheme separator, a note), not a C#
    // comment, so this outranks the `comment` extra and keeps it from swallowing the end tag.
    _html_slash_text: (_) => token(prec(2, /\/\/([^<@\r\n]|[\p{L}\p{N}]@[\p{L}\p{N}])*/)),

    // A directive attribute value is C# by default, and may also open with an explicit `@`
    // transition (`@onclick="@Handler"`, `@onclick="@(e => Save(e))"`), which Razor accepts and
    // treats the same way.
    razor_attribute_value: ($) =>
      seq(
        '"',
        choice(
          seq(optional($.modifier), $.expression),
          $.razor_explicit_expression,
          $.razor_implicit_expression,
        ),
        '"',
      ),

    _html_attribute: ($) =>
      seq($._html_attribute_name, optional(seq('=', $._html_attribute_value))),

    razor_html_attribute: ($) =>
      seq($.razor_attribute_name, optional(seq('=', $.razor_attribute_value))),

    element: ($) =>
      choice(
        seq(
          '<',
          $._void_tag_name,
          elementAttributes($),
          choice('/>', seq('>', optional($._void_end_tag))),
        ),
        seq(
          '<',
          $._script_tag_name,
          elementAttributes($),
          choice('/>', seq('>', repeat(choice($._raw_script_text, $._node)), $._end_tag)),
        ),
        seq(
          '<',
          $._style_tag_name,
          elementAttributes($),
          choice('/>', seq('>', repeat(choice($._raw_style_text, $._node)), $._end_tag)),
        ),
        seq(
          '<',
          $._tag_name,
          elementAttributes($),
          choice(
            '/>',
            seq('>', repeat(choice($._node, $._html_text, $._html_slash_text)), $._end_tag),
          ),
        ),
      ),
  },
});
