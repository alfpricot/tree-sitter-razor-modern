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

- Text directly after a directive, or at the start of a file, must start with a letter or digit. Text that starts with punctuation, a quote, or an HTML entity there is not plain text, although the same text after an element is. A line starting with `where` directly after `@typeparam` is read as a constraint clause.
- The header directives (`@page`, `@model`, `@inherits`, `@typeparam`, and the others that set up a file) are only recognized before the first node, except `@using` and `@inject`, which are accepted anywhere at the top level of a file. The block directives `@code`, `@functions` and `@section` work anywhere. Text directly after one of those late directives has the same start-character limit.
- HTML void elements (`<br>`, `<input>`, and the rest) end at `>`, so an explicit end tag on one (`<input></input>`) is not accepted.
- An HTML comment closes only at `-->`; the abrupt forms `<!-->` and `<!--->` are not closed.
- An implicit expression does not take generic type arguments, as in Razor; use `@(Method<T>())`. A null-conditional index (`@items?[0]`) is not part of an implicit expression, but `@item?.Name` is.
- A `default:` label in a `@switch` needs a body of its own, so `default:` directly followed by another `case` label is not accepted.
- An implicit expression in an attribute position whose name starts with `on` followed by letters is read as a directive attribute name.
- The content of `script` and `style` elements is raw text up to the matching end tag, apart from Razor transitions, and an unterminated `script` runs to the end of the file.
