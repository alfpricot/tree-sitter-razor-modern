# Razor syntax coverage

The Razor constructs the grammar parses, with a checked box for each one covered.

## Razor Expressions

- [x] Implicit Razor Expressions `@DateTime.Now`
- [x] Await Expressions `<p>@await DoSomething("hello", "world")</p>`
- [x] Explicit Razor Expressions `<p>@(DateTime.Now - TimeSpan.FromDays(7))</p>`
- [x] Razor Code Blocks `@code{}` and `@{}`
- [x] Implicit Transitions
- [x] Explicit Transitions
- [x] Explicit Line Transitions `@:`

## Control Structure

### Conditionals

- [x] If, elseif, else, switch

### Looping

- [x] for, foreach, while, do while

- [x] Compound Using `@using (Html.BeginForm()){}`
- [x] try, catch, finally
- [x] lock `@lock (SomeLock) {}`

## Comments

- [x] Razor
- [x] CSharp
- [x] HTML

## Directives

- [x] Attribute `@attribute [Authorize]` / `@attribute[Route(Constants.CounterRoute)]`
- [x] code
- [x] functions (same as code)
- [x] implements `@implements IDisposable`
- [x] inherits `@inherits TypeNameOfClassToInheritFrom`
- [x] inject
- [x] layout
- [x] model
- [x] namespace
- [x] page
- [x] preservewhitespace
- [x] renderMode
- [x] section
- [x] typeparam
- [x] using

## Known limitations

The grammar is deliberately tolerant, so an `ERROR` node does not mean the input is invalid Razor, and a clean parse does not mean it is valid. These forms are not supported or are only partly supported:

- Text directly after a directive, or at the start of a file, must start with a letter, a digit, or one of `& ! ' $ % + ~ ^ | -`. Text that starts with a double quote, a bracket, a parenthesis, `#`, `*`, `/`, `.`, `<`, `?`, `,` or `:` there is not plain text, although the same text after an element is, for example because those characters can continue a directive's name or start a comment; other characters are not accepted either.
- The header directives (`@page`, `@model`, `@inherits`, `@typeparam`, and the others that set up a file) are only recognized before the first node, except `@using` and `@inject`, which are accepted anywhere at the top level of a file. The block directives `@code`, `@functions` and `@section` work anywhere. Text directly after one of those late directives has the same start-character limit.
- An implicit expression does not take generic type arguments, as in Razor; use `@(Method<T>())`.
- The `[` or `?[` after an implicit expression starts an index only when a matching `]` follows on the same line; otherwise the bracket is text, so write an index that spans lines inside an explicit expression, `@( ... )`.
- The content of `script` and `style` elements is raw text up to the matching end tag, apart from Razor transitions, and an unterminated `script` runs to the end of the file.
