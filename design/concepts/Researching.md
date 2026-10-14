# Researching

## Purpose

Make material from several pages easier to compare while preserving the evidence for each comparison.

## Principle

If a report starts with a fixed set of URLs and retrieval finishes, it presents the readable sources and cited comparisons together. Unavailable pages do not prevent partial results. Cancelling an unfinished report prevents a late result from being stored.

## Types

```types
external User
  The owner of a report.
external Context
  The interaction authorizing research.
Status is PENDING or READY or FAILED or CANCELLED
SourceStatus is READABLE or UNAVAILABLE
opaque Kind
  A finding category. Only LINK is accepted in this increment.
opaque URLs
  An ordered array of one to five distinct HTTPS URLs.
opaque SourceDataSet
  An array supplying the Sources fields except report. Optional values use null. The worker supplies excerpts from retrieved text and linksTo from observed links to other selected pages.
opaque FindingDataSet
  An array of records with kind, sourceURLs, and explanation. Each LINK has two distinct readable source URLs in direction order. SAME_TEXT and PASSAGES from P1 are deferred in this increment.
opaque ReportDetails
  The owner, context, saved URLs, status, sources, and findings of one report.
```

## State

```state
a set of Contexts with
  a unique context Context
  a cancelled Flag
a set of Reports with
  an owner User
  a context Context
  a urls set of String
  a status Status
  unique owner and context
a set of Sources with
  a report Report
  a url String
  an optional title String
  an outcome SourceStatus
  an excerpt String
  a retrievedAt DateTime
  an optional pageDate String
  an optional finalUrl String
  a linksTo set of String
  unique report and url
a set of Findings with
  a report Report
  a kind Kind
  a sources set of Source
  an explanation String
Rule: A report's URL selection and input order never change. A cancelled context cannot accept new work. Terminal reports cannot change. Sources and findings belong to one report and are stored within it. A LINK's ordered sourceURLs identify the source and target; its explanation states the direction. Findings do not establish identity or truth.
```

## Actions

```actions
start(owner: User, context: Context, urls: URLs) : returns (report: Report)
  where urls is not one to five distinct HTTPS URLs, context is cancelled, or an existing report for owner and context has a different URL selection or order
  then
    refuses INVALID_RESEARCH "Research requires a fixed selection of one to five HTTPS URLs in an open context."
  where urls is valid, context is open, and a report for owner and context has the same URLs in the same order
  then
    returns report
  where context is open and no report exists for owner and context and urls is valid
  then
    create a PENDING report with the given owner, context, and urls, no sources or findings, and return its identity
    returns report

finish(report: Report, sourceData: SourceDataSet, findingData: FindingDataSet) : returns (stored: Flag)
  where report is unknown or is not PENDING or its context is cancelled
  then
    set stored to false
    returns stored
  where report is PENDING and results fail validation: exactly one outcome for every saved URL and no others; valid outcome and retrieval timestamp; title at most 200 characters, page date at most 80, and excerpt at most 1000; READABLE excerpts nonblank; UNAVAILABLE excerpts and links empty; links only to other saved URLs; final URL null or HTTPS on the original hostname without credentials or a nondefault port; at most 20 LINK findings, each with an explanation of at most 300 characters and two distinct readable sources supported by the first source's linksTo
  then
    refuses INVALID_RESEARCH_RESULT "Results must describe exactly the saved sources and supported links between them."
  where results are valid and report is still PENDING in an open context
  then
    create the report's Sources and Findings from sourceData and findingData and atomically set status to READY
    set stored to true
    returns stored

fail(report: Report) : returns (stored: Flag)
  where report is PENDING in an open context
  then
    set report to FAILED
    set stored to true
    returns stored
  where report is unknown or terminal or its context is cancelled
  then
    set stored to false
    returns stored

cancel(report: Report) : returns ()
  where true
  then
    change report from PENDING to CANCELLED if present; otherwise leave it unchanged
    returns

cancelContext(context: Context) : returns ()
  where true
  then
    atomically mark context cancelled and change every PENDING report in it to CANCELLED, preserving terminal reports
    returns
```

## Queries

```queries
_get(report: Report) : optional (details: ReportDetails)
  Answers the saved report details, or no row if unknown.

_forOwner(owner: User, context: Context) : optional (report: Report)
  Answers the unique report for owner and context, or no row if absent.

_pending() : many (report: Report, context: Context, urls: URLs)
  Answers PENDING reports in open contexts ordered by context identity then creation order within context. Answers no rows when none exist.

_pendingReport(report: Report) : optional (context: Context)
  Answers the saved context only when the given report is PENDING in an uncancelled context. Unknown and terminal reports answer no row.

_cancelled(context: Context) : one (cancelled: Flag)
  Answers whether context has been cancelled, including false for unknown contexts.
```
