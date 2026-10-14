# Reciprocal sharing and source briefs

[Mutual approval](reaction:Briefing.SynchronizeAfterApproval) triggers [card grants](reaction:Briefing.Activate) and [report starts](reaction:Briefing.StartReports). [Report registration](reaction:Briefing.RegisterReport) precedes report sharing.

```text
when Exchanging.approve (user, exchange, revision): (exchange, ACTIVE)
then Exchanging.synchronize (exchange)

when Exchanging.synchronize (exchange): (exchange, ACTIVE)
where Exchanging: exchange is ACTIVE, owner offers card, and viewer is the other participant
then Sharing.grant (owner, viewer, card, exchange)

when Exchanging.synchronize (exchange): (exchange, ACTIVE)
where Exchanging: exchange is ACTIVE and owner offers card
and Collecting: card contains urls
then Researching.start (owner, exchange, urls)

when Researching.start (owner, exchange, urls): (report)
then Sharing.register (owner, report)

when Sharing.register (owner, report) succeeds in that report-start flow
where Exchanging: exchange is ACTIVE, owner participates, and viewer is the other participant
then Sharing.grant (owner, viewer, report, exchange)
```

Each matching offer triggers the rules. RegisterReport carries owner, report, and exchange through both stages of the same flow.

[End](reaction:Briefing.End) and [repair ended exchanges](reaction:Briefing.RepairEnd) revoke access, then cancel pending research.

```text
when Exchanging.end (user, exchange): (exchange)
then Sharing.revoke (exchange)

when Exchanging.synchronize (exchange): (exchange, ENDED)
then Sharing.revoke (exchange)

when Sharing.revoke (exchange) succeeds in either cleanup flow above
then Researching.cancelContext (exchange)
```

The optional [owner's brief](former:Briefing.Brief) requires report access. The optional [shared offer](former:Briefing.SharedOffer) requires an ACTIVE exchange and card access. [Get](reaction:Briefing.Get) returns [details](former:Briefing.Details) when the report [exists and is readable](view:Briefing.ReadableReport).

```text
when UI.getReport (viewer, report)
where Researching: report exists
and Access.Readable(viewer, report)
then UI.respond (report: Briefing.Details(report))

when UI.getReport (viewer, report)
where report does not satisfy Briefing.ReadableReport(viewer, report)
then UI.respond (error: REPORT_UNAVAILABLE)
```

`Worker` denotes the internal retrieval service. [Work requests](reaction:Briefing.WorkerWork) return a [work list](former:Briefing.Work): exchanges needing recovery and reports ready for retrieval. A report is [publishable](view:Briefing.Publishable) when it is PENDING in an ACTIVE exchange. Only these reports appear in the work list.

An [offer is complete](view:Briefing.OfferComplete) when the viewer has grants in that exchange for both the card and its owner's report. An [incomplete offer](view:Briefing.IncompleteOffer) lacks either effect. [Lifecycle work is complete](view:Briefing.LifecycleComplete) when an ACTIVE exchange has offers and none is incomplete, or an inactive exchange has both a revoked sharing scope and a cancelled research context. The recovery list checks ACTIVE and ENDED exchanges only.

```text
when Worker.work ()
then Worker.respond (work: Briefing.Work())

when Worker.recover (exchange)
then Exchanging.synchronize (exchange)

when that recovery flow settles
then Worker.respond (exchange)
```

[Recovery](reaction:Briefing.WorkerRecover) repeats the existing lifecycle reactions. The next work request checks the saved effects again, so incomplete work can be retried without creating duplicate reports. The host schedules at most two fetches and aborts jobs absent from the current report list.

[Result](reaction:Briefing.WorkerResult) and [failure](reaction:Briefing.WorkerFailure) requests check Publishable again before storing an outcome.

```text
when Worker.result (report, sourceData, findingData)
where Researching: report is PENDING and has context exchange
and Exchanging: exchange is ACTIVE
then Researching.finish (report, sourceData, findingData)

when Worker.failure (report)
where Researching: report is PENDING and has context exchange
and Exchanging: exchange is ACTIVE
then Researching.fail (report)
```

Worker requests return stored, or false when the guard fails. The host blocks their HTTP paths and serializes publication with ending; Researching validates evidence.

```endpoints
Briefing.Get at /reports/get
Briefing.WorkerWork at /_worker/work
Briefing.WorkerRecover at /_worker/recover
Briefing.WorkerResult at /_worker/result
Briefing.WorkerFailure at /_worker/failure
```
