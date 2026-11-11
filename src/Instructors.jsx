import { LoadFailed, useApi } from './useApi.jsx';

export default function Instructors() {
  const { data, failed } = useApi('/api/instructors');

  return (
    <section className="instructors" id="instructors">
      <div className="wrap">
        <h2>Our instructors</h2>
        {failed && <LoadFailed what="The instructor list" />}
        {data && (
          <>
            <article className="founder">
              <img src={data.founder.photo} alt={`Portrait of ${data.founder.name}`} width="150" height="170" loading="lazy" />
              <div>
                <h3>{data.founder.name} <span lang="zh-Hans">{data.founder.nameZh}</span></h3>
                <p className="founder-role">{data.founder.role}, {data.founder.rank}</p>
                <p>{data.founder.bio}</p>
                <blockquote><p>&ldquo;{data.founder.quote}&rdquo;</p></blockquote>
              </div>
            </article>

            <h3 className="seniors-title">6th Dan senior instructors</h3>
            <ul className="seniors">
              {data.seniors.map((p) => (
                <li key={p.name}>
                  <img src={p.photo} alt="" width="150" height="170" loading="lazy" />
                  <span>{p.name}</span>
                </li>
              ))}
            </ul>

            <details className="roster">
              <summary>See all instructors by rank</summary>
              <div className="roster-grid">
                {data.roster.map((group) => (
                  <div key={group.rank}>
                    <h4>{group.rank}</h4>
                    <ul>{group.names.map((n) => <li key={n}>{n}</li>)}</ul>
                  </div>
                ))}
              </div>
            </details>
          </>
        )}
      </div>
    </section>
  );
}
