import { useMemo, useState } from 'react';
import { LoadFailed, useApi } from './useApi.jsx';

const REGIONS = [
  ['all', 'All areas'], ['central', 'Central'], ['south', 'South'], ['west', 'West'], ['east', 'East'],
  ['north', 'North'], ['north-east', 'North East'], ['north-west', 'North West'],
];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TYPES = [['all', 'Everyone'], ['adult', 'Adults'], ['children', 'Children']];
const SLOT_LABEL = { adult: 'Adults', children: 'Children', mixed: 'Mixed' };
const STATUS_LABEL = { closed: 'Temporarily closed', renovation: 'Under renovation' };
const PAGE_SIZE = 12;

const today = () => new Date().toLocaleDateString('en-SG', { timeZone: 'Asia/Singapore', weekday: 'short' });

function minutes(time) {
  const [, h, m, ap] = time.match(/(\d+):(\d+)(am|pm)/);
  return ((Number(h) % 12) + (ap === 'pm' ? 12 : 0)) * 60 + Number(m);
}

function ChipGroup({ legend, options, value, onChange }) {
  return (
    <fieldset className="chips">
      <legend>{legend}</legend>
      {options.map(([key, label]) => (
        <label key={key} className={value === key ? 'chip is-on' : 'chip'}>
          <input type="radio" name={legend} checked={value === key} onChange={() => onChange(key)} />
          {label}
        </label>
      ))}
    </fieldset>
  );
}

/** Slots a visitor could attend, given the filters. Mixed classes welcome both adults and children. */
function matchingSlots(dojo, day, type) {
  return dojo.slots.filter((s) => (
    (day === 'all' || s.day === day) && (type === 'all' || s.type === type || s.type === 'mixed')
  ));
}

function DojoRow({ dojo, slots }) {
  return (
    <li className={dojo.status === 'open' ? 'dojo' : 'dojo is-muted'}>
      <h4>
        {dojo.name}
        {dojo.isHq && <span className="tag tag-red">Headquarters</span>}
        {dojo.membersOnly && <span className="tag">Students and alumni only</span>}
      </h4>
      <p className="dojo-address">
        {dojo.mapUrl
          ? <a href={dojo.mapUrl} target="_blank" rel="noopener">{dojo.address}</a>
          : dojo.address}
      </p>
      {dojo.status !== 'open' && <p className="dojo-status">{STATUS_LABEL[dojo.status]}</p>}
      {dojo.isHq && <p className="dojo-slots-note"><a href="#hq-timetable">Classes every day. See the full timetable</a></p>}
      {slots.length > 0 && (
        <ul className="slots">
          {slots.map((s) => (
            <li key={`${s.day}${s.time}${s.type}`}>
              <span className="slot-day">{s.day}</span>
              <span className="slot-time">{s.time}</span>
              <span className={`slot-type slot-${s.type}`}>{SLOT_LABEL[s.type]}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function DojoFinder({ dojos }) {
  const [region, setRegion] = useState('all');
  const [day, setDay] = useState('all');
  const [type, setType] = useState('all');
  const [showAll, setShowAll] = useState(false);
  const now = today();

  const dayOptions = [['all', 'Any day'], ...DAYS.map((d) => [d, d === now ? `${d} (today)` : d])];

  const results = useMemo(() => {
    const filtering = day !== 'all' || type !== 'all';
    return dojos
      .filter((d) => region === 'all' || d.region === region)
      .map((dojo) => ({ dojo, slots: matchingSlots(dojo, day, type) }))
      // HQ runs classes every day, so it always matches. Closed dojos drop out once a visitor narrows by class.
      .filter(({ dojo, slots }) => dojo.isHq || slots.length > 0 || (!filtering && dojo.status !== 'open' ))
      .sort((a, b) => {
        if (a.dojo.isHq !== b.dojo.isHq) return a.dojo.isHq ? -1 : 1;
        if ((a.dojo.status === 'open') !== (b.dojo.status === 'open')) return a.dojo.status === 'open' ? -1 : 1;
        if (day !== 'all' && a.slots[0] && b.slots[0]) return minutes(a.slots[0].time) - minutes(b.slots[0].time);
        return a.dojo.name.localeCompare(b.dojo.name);
      });
  }, [dojos, region, day, type]);

  const reset = () => { setRegion('all'); setDay('all'); setType('all'); setShowAll(false); };
  const visible = showAll ? results : results.slice(0, PAGE_SIZE);
  const change = (setter) => (value) => { setter(value); setShowAll(false); };
  const count = results.length;

  return (
    <>
      <div className="filters">
        <ChipGroup legend="Area" options={REGIONS} value={region} onChange={change(setRegion)} />
        <ChipGroup legend="Day" options={dayOptions} value={day} onChange={change(setDay)} />
        <ChipGroup legend="Who for" options={TYPES} value={type} onChange={change(setType)} />
      </div>
      <p className="result-count" role="status">{count === 1 ? '1 dojo matches' : `${count} dojos match`}</p>
      <ul className="dojo-list">
        {visible.map(({ dojo, slots }) => <DojoRow key={dojo.name} dojo={dojo} slots={slots} />)}
      </ul>
      {count > PAGE_SIZE && !showAll && (
        <button type="button" className="button button-quiet" onClick={() => setShowAll(true)}>
          Show all {count} dojos
        </button>
      )}
      {count <= 1 && (region !== 'all' || day !== 'all' || type !== 'all') && (
        <p className="filters-hint">
          {count === 0 ? 'No classes match these choices.' : 'Only 1 dojo matches.'} <button type="button" className="link-button" onClick={reset}>Clear the filters</button> to see every dojo.
        </p>
      )}
    </>
  );
}

function TimetableGrid({ title, grid }) {
  return (
    <div className="table-scroll" role="region" aria-label={`${title} timetable`} tabIndex={0}>
      <table className="timetable">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Time</th>
            {grid.days.map((d) => <th key={d} scope="col">{d}</th>)}
          </tr>
        </thead>
        <tbody>
          {grid.rows.map((row) => (
            <tr key={row.time}>
              <th scope="row">{row.time}</th>
              {row.classes.map((c, i) => (
                <td key={grid.days[i]}>
                  {c && (
                    <>
                      {c[0] && <span className="tt-name">{c[0]}</span>}
                      <span className={/^(adults|beginners)$/i.test(c[1]) ? 'tt-type' : 'tt-type tt-special'}>{c[1]}</span>
                    </>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HqTimetable({ data }) {
  const [group, setGroup] = useState('adults');
  const groups = [['adults', 'Adults'], ['children', 'Children']];
  const legend = data.legend.filter((l) => (group === 'children'
    ? /children|mixed/i.test(l.name)
    : !/children/i.test(l.name)));

  return (
    <div className="hq" id="hq-timetable">
      <h3>Headquarters timetable</h3>
      <p>Thomson V One, 9 Sin Ming Road, #B1-02. All classes run for 60 minutes.</p>
      <div className="tabs" role="group" aria-label="Choose a timetable">
        {groups.map(([key, label]) => (
          <button key={key} type="button" aria-pressed={group === key} className={group === key ? 'tab is-on' : 'tab'} onClick={() => setGroup(key)}>
            {label}
          </button>
        ))}
      </div>
      <TimetableGrid title="Monday to Friday" grid={data[group].weekdays} />
      <TimetableGrid title="Saturday and Sunday" grid={data[group].weekend} />
      <dl className="legend">
        {legend.map((l) => (
          <div key={l.name}><dt>{l.name}</dt><dd>{l.detail}</dd></div>
        ))}
      </dl>
    </div>
  );
}

export default function Classes() {
  const dojos = useApi('/api/dojos');
  const timetable = useApi('/api/timetable');

  return (
    <section className="classes" id="classes">
      <div className="wrap">
        <h2>Find a class</h2>
        <p className="lead">
          Classes don&rsquo;t follow a fixed course, so you can start any time. You learn the basics in your first
          few lessons, then join the main class. You&rsquo;re welcome to visit a dojo and watch first.
        </p>
        {dojos.failed && <LoadFailed what="The dojo list" />}
        {dojos.data && <DojoFinder dojos={dojos.data} />}
        {timetable.failed && <LoadFailed what="The Headquarters timetable" />}
        {timetable.data && <HqTimetable data={timetable.data} />}
      </div>
    </section>
  );
}
