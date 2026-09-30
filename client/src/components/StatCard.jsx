export default function StatCard({ icon: Icon, label, value, tone = 'blue', note }) {
  return <div className={`stat-card ${tone}`}>
    <div className="stat-icon"><Icon size={20} /></div>
    <div><div className="stat-label">{label}</div><div className="stat-value">{value}</div>{note && <div className="stat-note">{note}</div>}</div>
  </div>
}
