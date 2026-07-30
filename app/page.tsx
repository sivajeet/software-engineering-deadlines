"use client";

import { useEffect, useMemo, useState } from "react";
import journalData from "./journals.json";
import venueData from "./venues.json";

type Edition = (typeof venueData.editions)[number];
type Track = Edition["tracks"][number];
type Journal = (typeof journalData.journals)[number];
type JournalCall = Journal["calls"][number];

type ConferenceRecord = {
  kind: "conference";
  id: string;
  date: string;
  abstractDates: string[];
  tracks: Track[];
  edition: Edition;
};

type JournalRecord = {
  kind: "journal";
  id: string;
  date: string | null;
  call: JournalCall;
  journal: Journal;
};

type DeadlineRecord = ConferenceRecord | JournalRecord;

const weekDays = ["M", "T", "W", "T", "F", "S", "S"];

function dateFromIso(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function getLocalTodayIso() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatDate(
  date: string,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  },
) {
  return new Intl.DateTimeFormat("en", {
    ...options,
    timeZone: "UTC",
  }).format(dateFromIso(date));
}

function daysUntil(date: string, currentDate: string) {
  return Math.round(
    (dateFromIso(date).getTime() - dateFromIso(currentDate).getTime()) /
      86_400_000,
  );
}

function formatLocation(edition: Edition) {
  const location = [edition.location.city, edition.location.country].filter(
    Boolean,
  );
  return location.length > 0 ? location.join(", ") : "To be announced";
}

function formatPagePolicy(call: JournalCall) {
  const { minimum_pages: minimum, maximum_pages: maximum } = call.page_policy;

  if (minimum && maximum) return `${minimum}–${maximum} pages`;
  if (minimum) return `${minimum}+ pages`;
  if (maximum) return `Up to ${maximum} pages`;
  return "Full-length manuscript (accepts 8+ pages)";
}

function getCalendarMonths(currentDate: string) {
  const current = dateFromIso(currentDate);

  return Array.from({ length: 3 }, (_, index) => {
    const month = new Date(
      Date.UTC(
        current.getUTCFullYear(),
        current.getUTCMonth() + index,
        1,
        12,
      ),
    );
    const firstDay = (month.getUTCDay() + 6) % 7;
    const dayCount = new Date(
      Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0, 12),
    ).getUTCDate();

    return {
      month,
      cells: [
        ...Array.from({ length: firstDay }, () => null),
        ...Array.from({ length: dayCount }, (_, day) => day + 1),
      ],
    };
  });
}

const conferenceRecords: ConferenceRecord[] = venueData.editions
  .flatMap((edition) => {
    const tracksByPaperDate = new Map<string, Track[]>();

    edition.tracks.forEach((track) => {
      const paperDeadline = track.deadlines.find(
        (deadline) => deadline.type === "full_paper",
      );
      if (!paperDeadline) return;

      const tracks = tracksByPaperDate.get(paperDeadline.date) ?? [];
      tracks.push(track);
      tracksByPaperDate.set(paperDeadline.date, tracks);
    });

    return [...tracksByPaperDate.entries()].map(([date, tracks]) => ({
      kind: "conference" as const,
      id: `${edition.id}-${date}`,
      date,
      edition,
      tracks,
      abstractDates: [
        ...new Set(
          tracks.flatMap((track) =>
            track.deadlines
              .filter((deadline) => deadline.type === "abstract")
              .map((deadline) => deadline.date),
          ),
        ),
      ].sort(),
    }));
  })
  .sort((a, b) => a.date.localeCompare(b.date));

const journalRecords: JournalRecord[] = journalData.journals.flatMap(
  (journal) =>
    journal.calls.map((call) => ({
      kind: "journal" as const,
      id: call.id,
      date: call.deadline,
      call,
      journal,
    })),
);

const datedRecords: DeadlineRecord[] = [
  ...conferenceRecords,
  ...journalRecords.filter((record) => record.date !== null),
].sort((a, b) => (a.date as string).localeCompare(b.date as string));

const continuousRecords: JournalRecord[] = journalRecords
  .filter((record) => record.date === null)
  .sort(
    (a, b) =>
      a.journal.acronym.localeCompare(b.journal.acronym) ||
      a.call.title.localeCompare(b.call.title),
  );

const countries = [
  ...new Set(
    venueData.editions.flatMap((edition) =>
      edition.location.country ? [edition.location.country] : [],
    ),
  ),
].sort();
const continents = [
  ...new Set(
    venueData.editions.flatMap((edition) =>
      edition.location.continent ? [edition.location.continent] : [],
    ),
  ),
].sort();
const trackNames = [
  ...new Set(
    venueData.editions.flatMap((edition) =>
      edition.tracks.map((track) => track.name),
    ),
  ),
].sort();

function recordRankKey(record: DeadlineRecord) {
  return record.kind === "conference"
    ? `core:${record.edition.conference.ranking.rank}`
    : `sjr:${record.journal.ranking.quartile}`;
}

function recordMatchesQuery(record: DeadlineRecord, query: string) {
  if (!query) return true;

  const searchable =
    record.kind === "conference"
      ? [
          record.edition.conference.acronym,
          record.edition.conference.name,
          record.edition.location.city,
          record.edition.location.country,
          ...record.tracks.map((track) => track.name),
        ]
      : [
          record.journal.acronym,
          record.journal.name,
          record.journal.publisher,
          record.call.title,
          record.call.paper_type,
        ];

  return searchable.join(" ").toLowerCase().includes(query);
}

function RecordDate({
  record,
  currentDate,
}: {
  record: DeadlineRecord;
  currentDate: string;
}) {
  if (!record.date) {
    return (
      <div className="v6-record-date v6-record-date-continuous">
        <strong>Open</strong>
        <span>Ongoing</span>
        <small>Continuous</small>
      </div>
    );
  }

  return (
    <div className="v6-record-date">
      <strong>{dateFromIso(record.date).getUTCDate()}</strong>
      <span>
        {formatDate(record.date, {
          month: "short",
          year: "numeric",
        })}
      </span>
      <small>
        {daysUntil(record.date, currentDate) === 0
          ? "Today"
          : `${daysUntil(record.date, currentDate)} days`}
      </small>
    </div>
  );
}

function ConferenceDetails({ record }: { record: ConferenceRecord }) {
  return (
    <div className="v6-record-body">
      <div className="v6-record-title">
        <h3>{record.edition.conference.acronym}</h3>
        <span>CORE {record.edition.conference.ranking.rank}</span>
        <em>Conference</em>
      </div>
      <p>{record.edition.conference.name}</p>

      <dl>
        <div>
          <dt>Location</dt>
          <dd>{formatLocation(record.edition)}</dd>
        </div>
        <div>
          <dt>Eligible paper length</dt>
          <dd>
            {record.tracks
              .flatMap((track) =>
                track.paper_categories.map(
                  (category) =>
                    `${track.name} — ${category.name}: ${category.main_text_pages} pages`,
                ),
              )
              .join("; ")}
          </dd>
        </div>
        <div>
          <dt>{record.tracks.length === 1 ? "Track" : "Tracks"}</dt>
          <dd>{record.tracks.map((track) => track.name).join("; ")}</dd>
        </div>
        <div>
          <dt>Paper deadline</dt>
          <dd>{formatDate(record.date)}</dd>
        </div>
        <div>
          <dt>Abstract deadline</dt>
          <dd>
            {record.abstractDates.length > 0
              ? record.abstractDates.map((date) => formatDate(date)).join(", ")
              : "No separate abstract deadline"}
          </dd>
        </div>
      </dl>

      <a href={record.edition.official_url} target="_blank" rel="noreferrer">
        Official conference page
      </a>
    </div>
  );
}

function JournalDetails({ record }: { record: JournalRecord }) {
  return (
    <div className="v6-record-body">
      <div className="v6-record-title">
        <h3>{record.journal.acronym}</h3>
        <span className="v6-journal-rank">
          SJR {record.journal.ranking.quartile}
        </span>
        <em className="v6-journal-type">Journal</em>
      </div>
      <p>{record.journal.name}</p>

      <dl>
        <div>
          <dt>Call for papers</dt>
          <dd>{record.call.title}</dd>
        </div>
        <div>
          <dt>Publisher</dt>
          <dd>{record.journal.publisher}</dd>
        </div>
        <div>
          <dt>Paper type</dt>
          <dd>{record.call.paper_type}</dd>
        </div>
        <div>
          <dt>Eligible paper length</dt>
          <dd>
            {formatPagePolicy(record.call)} — {record.call.page_policy.notes}
          </dd>
        </div>
        <div>
          <dt>Submission deadline</dt>
          <dd>{record.date ? formatDate(record.date) : "Ongoing"}</dd>
        </div>
      </dl>

      <a href={record.call.source_url} target="_blank" rel="noreferrer">
        Official journal call
      </a>
    </div>
  );
}

function DeadlineItem({
  record,
  currentDate,
}: {
  record: DeadlineRecord;
  currentDate: string;
}) {
  return (
    <article
      className={`v6-record ${
        record.kind === "journal" ? "v6-journal-record" : ""
      }`}
    >
      <RecordDate record={record} currentDate={currentDate} />
      {record.kind === "conference" ? (
        <ConferenceDetails record={record} />
      ) : (
        <JournalDetails record={record} />
      )}
    </article>
  );
}

export default function Home() {
  const [currentDate, setCurrentDate] = useState(venueData.meta.as_of_date);
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [continent, setContinent] = useState("");
  const [ranking, setRanking] = useState("");
  const [track, setTrack] = useState("");
  const [recordType, setRecordType] = useState("");
  const [journalId, setJournalId] = useState("");

  useEffect(() => {
    function refreshCurrentDate() {
      setCurrentDate(getLocalTodayIso());
    }

    refreshCurrentDate();
    const interval = window.setInterval(refreshCurrentDate, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const upcomingDatedRecords = useMemo(
    () =>
      datedRecords.filter(
        (record) => (record.date as string) >= currentDate,
      ),
    [currentDate],
  );
  const visibleRecords = useMemo(
    () => [...upcomingDatedRecords, ...continuousRecords],
    [upcomingDatedRecords],
  );
  const calendarMonths = useMemo(
    () => getCalendarMonths(currentDate),
    [currentDate],
  );

  const filteredRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return visibleRecords.filter((record) => {
      if (recordType && record.kind !== recordType) return false;
      if (!recordMatchesQuery(record, normalizedQuery)) return false;
      if (ranking && recordRankKey(record) !== ranking) return false;

      if (country) {
        if (
          record.kind !== "conference" ||
          record.edition.location.country !== country
        ) {
          return false;
        }
      }

      if (continent) {
        if (
          record.kind !== "conference" ||
          record.edition.location.continent !== continent
        ) {
          return false;
        }
      }

      if (track) {
        if (
          record.kind !== "conference" ||
          !record.tracks.some((item) => item.name === track)
        ) {
          return false;
        }
      }

      if (journalId) {
        if (record.kind !== "journal" || record.journal.id !== journalId) {
          return false;
        }
      }

      return true;
    });
  }, [
    query,
    country,
    continent,
    ranking,
    track,
    recordType,
    journalId,
    visibleRecords,
  ]);

  const filteredDated = filteredRecords.filter((record) => record.date);
  const filteredConferenceRecords = filteredDated.filter(
    (record): record is ConferenceRecord => record.kind === "conference",
  );
  const filteredJournalRecords = filteredDated.filter(
    (record): record is JournalRecord => record.kind === "journal",
  );
  const filteredContinuous = filteredRecords.filter(
    (record): record is JournalRecord =>
      record.kind === "journal" && !record.date,
  );
  const hasFilters = Boolean(
    query ||
      country ||
      continent ||
      ranking ||
      track ||
      recordType ||
      journalId,
  );
  const nextConferenceRecord = upcomingDatedRecords.find(
    (record): record is ConferenceRecord => record.kind === "conference",
  );
  const nextJournalRecord = upcomingDatedRecords.find(
    (record): record is JournalRecord => record.kind === "journal",
  );

  function resetFilters() {
    setQuery("");
    setCountry("");
    setContinent("");
    setRanking("");
    setTrack("");
    setRecordType("");
    setJournalId("");
  }

  return (
    <main className="v6-page">
      <div className="v6-utility">
        <div>
          <span>Software Engineering Deadlines</span>
          <span>ICORE 2026 · SJR 2024</span>
        </div>
      </div>

      <header className="v6-header">
        <div className="v6-header-inner">
          <div>
            <strong>Software Engineering</strong>
            <span>Conference deadlines and journal calls for papers</span>
          </div>
          <div className="v6-mark" aria-hidden="true">
            SE
          </div>
        </div>
      </header>

      <div className="v6-layout">
        <nav className="v6-nav" aria-label="Page sections">
          <a href="#overview">Overview</a>
          <a href="#calendar">Three-month calendar</a>
          <a href="#deadlines">Submission deadlines</a>
          <a href="#scope">Data scope</a>
          <a href="#sources">Sources</a>
        </nav>

        <article className="v6-content">
          <p className="v6-breadcrumb">Home › Software Engineering Deadlines</p>

          <section id="overview" className="v6-introduction">
            <h1>Software Engineering Deadlines</h1>
            <p>
              Verified conference paper deadlines and public journal calls for
              papers. Conference tracks sharing a deadline are grouped;
              continuous journal calls appear after all dated records.
            </p>
            <a className="v6-jump-link" href="#journal-calls">
              Jump to journal calls
              <span aria-hidden="true">↓</span>
            </a>
          </section>

          <section id="calendar" className="v6-section">
            <div className="v6-section-title">
              <h2>Three-month calendar</h2>
              <p>
                Blue marks conference paper deadlines; purple marks journal
                calls. Hover or focus a date for details.
              </p>
              <div className="v6-calendar-legend" aria-label="Calendar legend">
                <span>
                  <i className="v6-conference-dot" /> Conference
                </span>
                <span>
                  <i className="v6-journal-dot" /> Journal
                </span>
              </div>
            </div>

            <div className="v6-calendars">
              {calendarMonths.map(({ month, cells }) => {
                const monthRecords = upcomingDatedRecords.filter((record) => {
                  const deadlineDate = dateFromIso(record.date as string);
                  return (
                    deadlineDate.getUTCMonth() === month.getUTCMonth() &&
                    deadlineDate.getUTCFullYear() === month.getUTCFullYear()
                  );
                });

                return (
                  <article className="v6-calendar" key={month.toISOString()}>
                    <header>
                      <h3>
                        {new Intl.DateTimeFormat("en", {
                          month: "long",
                          year: "numeric",
                          timeZone: "UTC",
                        }).format(month)}
                      </h3>
                      <span>{monthRecords.length}</span>
                    </header>

                    <div className="v6-weekdays" aria-hidden="true">
                      {weekDays.map((day, index) => (
                        <span key={`${day}-${index}`}>{day}</span>
                      ))}
                    </div>

                    <div className="v6-days">
                      {cells.map((day, index) => {
                        const dateKey =
                          day &&
                          `${month.getUTCFullYear()}-${String(
                            month.getUTCMonth() + 1,
                          ).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                        const recordsForDay = monthRecords.filter(
                          (record) => record.date === dateKey,
                        );
                        const isPast = Boolean(
                          dateKey && dateKey < currentDate,
                        );
                        const isToday = dateKey === currentDate;

                        return (
                          <div
                            className={`v6-day ${
                              recordsForDay.length ? "v6-deadline-day" : ""
                            } ${isPast ? "v6-past-day" : ""} ${
                              isToday ? "v6-today" : ""
                            }`}
                            key={`${month.toISOString()}-${index}`}
                            tabIndex={recordsForDay.length ? 0 : undefined}
                          >
                            {day && <span>{day}</span>}
                            {recordsForDay.length > 0 && (
                              <>
                                <div className="v6-dots">
                                  {recordsForDay.map((record) => (
                                    <i
                                      className={
                                        record.kind === "journal"
                                          ? "v6-journal-dot"
                                          : "v6-conference-dot"
                                      }
                                      key={record.id}
                                    />
                                  ))}
                                </div>
                                <div className="v6-tooltip" role="tooltip">
                                  <time>{formatDate(dateKey as string)}</time>
                                  {recordsForDay.map((record) => (
                                    <div
                                      className={
                                        record.kind === "journal"
                                          ? "v6-tooltip-journal"
                                          : ""
                                      }
                                      key={record.id}
                                    >
                                      <strong>
                                        {record.kind === "conference"
                                          ? record.edition.conference.acronym
                                          : record.journal.acronym}
                                        <span>
                                          {record.kind === "conference"
                                            ? `CORE ${record.edition.conference.ranking.rank}`
                                            : `SJR ${record.journal.ranking.quartile}`}
                                        </span>
                                      </strong>
                                      <p>
                                        {record.kind === "conference"
                                          ? record.tracks
                                              .map((track) => track.name)
                                              .join(", ")
                                          : record.call.title}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section id="deadlines" className="v6-section">
            <div className="v6-section-title v6-deadline-heading">
              <div>
                <h2>Submission deadlines</h2>
                <p>
                  {filteredRecords.length} records match the current filters.
                </p>
              </div>
              <label className="v6-search">
                <span className="sr-only">Search submission records</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search venue, journal, track, or call"
                />
              </label>
            </div>

            {filteredRecords.length > 0 ? (
              <div className="v6-deadline-records">
                {filteredConferenceRecords.length > 0 && (
                  <div className="v6-list-heading">
                    <h3>Conference deadlines</h3>
                    <p>
                      {filteredConferenceRecords.length} grouped conference
                      records.
                    </p>
                  </div>
                )}

                {filteredConferenceRecords.map((record) => (
                  <DeadlineItem
                    record={record}
                    currentDate={currentDate}
                    key={record.id}
                  />
                ))}

                <div
                  className="v6-list-heading v6-journal-list-heading"
                  id="journal-calls"
                >
                  <h3>Journal calls for papers</h3>
                  <p>
                    {filteredJournalRecords.length +
                      filteredContinuous.length}{" "}
                    dated and continuous journal calls.
                  </p>
                </div>

                {filteredJournalRecords.map((record) => (
                  <DeadlineItem
                    record={record}
                    currentDate={currentDate}
                    key={record.id}
                  />
                ))}

                {filteredContinuous.length > 0 && (
                  <div className="v6-list-subheading">
                    <h3>Continuous journal calls</h3>
                    <p>
                      Official calls marked ongoing or open for submission at
                      any time.
                    </p>
                  </div>
                )}

                {filteredContinuous.map((record) => (
                  <DeadlineItem
                    record={record}
                    currentDate={currentDate}
                    key={record.id}
                  />
                ))}

                {filteredJournalRecords.length === 0 &&
                  filteredContinuous.length === 0 && (
                    <p className="v6-no-journal-results">
                      No journal calls match the current filters.
                    </p>
                  )}
              </div>
            ) : (
              <div className="v6-empty">
                <p>No submission records match the current filters.</p>
                <button type="button" onClick={resetFilters}>
                  Reset filters
                </button>
              </div>
            )}
          </section>

          <section id="sources" className="v6-section v6-source-note">
            <h2>Sources and verification</h2>
            <p>
              Conference data was audited against official venue pages.
              Journal calls were audited on 29 July 2026 against the official
              ACM, IEEE, Elsevier, and Springer Nature pages. Journal quartiles
              use the 2024 SCImago Software category. Invite-only and expired
              calls are omitted.
            </p>
          </section>
        </article>

        <aside className="v6-sidebar">
          <section>
            <h2>Filter records</h2>

            <label>
              <span>Record type</span>
              <select
                value={recordType}
                onChange={(event) => setRecordType(event.target.value)}
              >
                <option value="">Conferences and journals</option>
                <option value="conference">Conferences</option>
                <option value="journal">Journals</option>
              </select>
            </label>

            <label>
              <span>Ranking</span>
              <select
                value={ranking}
                onChange={(event) => setRanking(event.target.value)}
              >
                <option value="">All rankings</option>
                <option value="core:A*">CORE A*</option>
                <option value="core:A">CORE A</option>
                <option value="sjr:Q1">SJR Q1</option>
                <option value="sjr:Q2">SJR Q2</option>
              </select>
            </label>

            <label>
              <span>Country</span>
              <select
                value={country}
                onChange={(event) => setCountry(event.target.value)}
              >
                <option value="">All countries</option>
                {countries.map((item) => (
                  <option value={item} key={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Continent</span>
              <select
                value={continent}
                onChange={(event) => setContinent(event.target.value)}
              >
                <option value="">All continents</option>
                {continents.map((item) => (
                  <option value={item} key={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Journal</span>
              <select
                value={journalId}
                onChange={(event) => setJournalId(event.target.value)}
              >
                <option value="">All journals</option>
                {journalData.journals.map((journal) => (
                  <option value={journal.id} key={journal.id}>
                    {journal.acronym}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Conference track</span>
              <select
                value={track}
                onChange={(event) => setTrack(event.target.value)}
              >
                <option value="">All tracks</option>
                {trackNames.map((item) => (
                  <option value={item} key={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            {hasFilters && (
              <button type="button" onClick={resetFilters}>
                Reset all filters
              </button>
            )}
          </section>

          <section className="v6-next">
            <h2>Next submission deadlines</h2>
            <div className="v6-next-grid">
              <div>
                <span>Conference</span>
                {nextConferenceRecord ? (
                  <>
                    <strong>
                      {nextConferenceRecord.edition.conference.acronym}
                    </strong>
                    <time>{formatDate(nextConferenceRecord.date)}</time>
                    <p>
                      {nextConferenceRecord.tracks
                        .map((track) => track.name)
                        .join(", ")}
                    </p>
                  </>
                ) : (
                  <p>No future dated conference deadline.</p>
                )}
              </div>

              <div>
                <span>Journal</span>
                {nextJournalRecord ? (
                  <>
                    <strong>{nextJournalRecord.journal.acronym}</strong>
                    <time>{formatDate(nextJournalRecord.date as string)}</time>
                    <p>{nextJournalRecord.call.title}</p>
                  </>
                ) : (
                  <p>No future dated journal deadline.</p>
                )}
              </div>
            </div>
          </section>

          <section id="scope">
            <h2>Data scope</h2>
            <ul>
              <li>Software engineering conferences and journals</li>
              <li>Conference rank: ICORE 2026 A or A*</li>
              <li>Journal rank: SJR 2024 Q1 or Q2</li>
              <li>Public archival calls accepting papers of 8+ pages</li>
              <li>Future dated and officially ongoing calls</li>
              <li>Invite-only journal calls excluded</li>
            </ul>
          </section>
        </aside>
      </div>

      <footer className="v6-footer">
        <div>
          <strong>Software Engineering Deadlines</strong>
          <span>Human-reviewed conference and journal data</span>
        </div>
        <p>Showing deadlines from {formatDate(currentDate)}</p>
      </footer>
    </main>
  );
}
